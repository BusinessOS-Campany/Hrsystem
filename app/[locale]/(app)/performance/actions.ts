"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, hasPermission } from "@/lib/auth/session";
import { writeAudit } from "@/lib/auth/audit";

export type PerformanceActionResult = {
  ok: boolean;
  error?:
    | "unauthorized"
    | "validation"
    | "notFound"
    | "forbidden"
    | "completed"
    | "invalidDate";
};

const optionalText = (max = 1000) =>
  z.string().trim().max(max).optional().or(z.literal(""));

const optionalDate = optionalText(10);

const cycleSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: optionalText(1000),
  startDate: z.string().min(10),
  endDate: z.string().min(10),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).default("NOT_STARTED"),
  generateReviews: z.boolean().default(true),
});

const goalSchema = z.object({
  employeeId: optionalText(40),
  cycleId: optionalText(40),
  title: z.string().trim().min(2).max(200),
  description: optionalText(1000),
  weight: z.coerce.number().int().min(0).max(100).default(10),
  target: optionalText(300),
  dueDate: optionalDate,
  progress: z.coerce.number().int().min(0).max(100).default(0),
  status: z
    .enum(["NOT_STARTED", "IN_PROGRESS", "ACHIEVED", "MISSED", "CANCELLED"])
    .default("NOT_STARTED"),
});

const selfReviewSchema = z.object({
  selfRating: z.coerce.number().int().min(1).max(5),
  selfComment: optionalText(2000),
});

const managerReviewSchema = z.object({
  managerRating: z.coerce.number().int().min(1).max(5),
  managerComment: optionalText(2000),
});

const goalProgressSchema = z.object({
  progress: z.coerce.number().int().min(0).max(100),
  status: z
    .enum(["NOT_STARTED", "IN_PROGRESS", "ACHIEVED", "MISSED", "CANCELLED"])
    .default("IN_PROGRESS"),
});

function dateOnly(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function done(locale: string) {
  revalidatePath(`/${locale}/performance`);
  revalidatePath(`/${locale}/dashboard`);
}

export async function createCycleAction(
  locale: string,
  input: unknown,
): Promise<PerformanceActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "performance.manage")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = cycleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  const startDate = dateOnly(data.startDate);
  const endDate = dateOnly(data.endDate);
  if (!startDate || !endDate || endDate < startDate) {
    return { ok: false, error: "invalidDate" };
  }

  const company = await prisma.company.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!company) return { ok: false, error: "notFound" };

  const cycle = await prisma.$transaction(async (tx) => {
    const created = await tx.performanceCycle.create({
      data: {
        companyId: company.id,
        name: data.name,
        description: data.description || null,
        startDate,
        endDate,
        status: data.status,
        createdById: user.id,
      },
    });

    if (data.generateReviews) {
      const employees = await tx.employee.findMany({
        where: {
          deletedAt: null,
          status: { in: ["ACTIVE", "PROBATION"] },
        },
        select: { id: true, managerId: true },
      });
      if (employees.length > 0) {
        await tx.performanceReview.createMany({
          data: employees.map((employee) => ({
            cycleId: created.id,
            employeeId: employee.id,
            managerId: employee.managerId,
            status: "DRAFT" as const,
          })),
        });
      }
    }

    return created;
  });

  await writeAudit({
    userId: user.id,
    action: "CREATE",
    entity: "PerformanceCycle",
    entityId: cycle.id,
    newData: {
      name: cycle.name,
      startDate: data.startDate,
      endDate: data.endDate,
      generateReviews: data.generateReviews,
    },
  });

  done(locale);
  return { ok: true };
}

export async function createGoalAction(
  locale: string,
  input: unknown,
): Promise<PerformanceActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  const canManage = hasPermission(user, "performance.manage");
  const canSelf = hasPermission(user, "performance.review_self");
  const employeeId = data.employeeId || user.employeeId;
  if (!employeeId) return { ok: false, error: "forbidden" };
  if (!canManage && !(canSelf && employeeId === user.employeeId)) {
    return { ok: false, error: "forbidden" };
  }

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: { id: true },
  });
  if (!employee) return { ok: false, error: "notFound" };

  if (data.cycleId) {
    const cycle = await prisma.performanceCycle.findUnique({
      where: { id: data.cycleId },
      select: { id: true },
    });
    if (!cycle) return { ok: false, error: "notFound" };
  }

  const dueDate = data.dueDate ? dateOnly(data.dueDate) : null;
  if (data.dueDate && !dueDate) return { ok: false, error: "invalidDate" };

  const goal = await prisma.goal.create({
    data: {
      employeeId,
      cycleId: data.cycleId || null,
      title: data.title,
      description: data.description || null,
      weight: data.weight,
      target: data.target || null,
      dueDate,
      progress: data.progress,
      status: data.status,
    },
  });

  await writeAudit({
    userId: user.id,
    action: "CREATE",
    entity: "Goal",
    entityId: goal.id,
    newData: { employeeId, title: goal.title, weight: goal.weight },
  });

  done(locale);
  return { ok: true };
}

export async function submitSelfReviewAction(
  locale: string,
  reviewId: string,
  input: unknown,
): Promise<PerformanceActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "performance.review_self")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = selfReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const review = await prisma.performanceReview.findUnique({
    where: { id: reviewId },
    include: {
      cycle: true,
      employee: { include: { user: true, manager: { include: { user: true } } } },
    },
  });
  if (!review) return { ok: false, error: "notFound" };
  if (review.employeeId !== user.employeeId) return { ok: false, error: "forbidden" };

  const submitted = await prisma.performanceReview.updateMany({
    where: { id: reviewId, status: { in: ["DRAFT", "SELF_REVIEW"] } },
    data: {
      selfRating: parsed.data.selfRating,
      selfComment: parsed.data.selfComment || null,
      status: "SELF_REVIEW",
      submittedAt: new Date(),
    },
  });
  if (submitted.count !== 1) return { ok: false, error: "completed" };

  const managerUser = review.employee.manager?.user;
  if (managerUser) {
    await prisma.notification.create({
      data: {
        userId: managerUser.id,
        type: "GENERAL",
        title: "Self review submitted",
        titleAr: "تم إرسال التقييم الذاتي",
        message: `${review.employee.firstName} ${review.employee.lastName} submitted a self review for ${review.cycle.name}.`,
        messageAr: `أرسل ${review.employee.firstNameAr ?? review.employee.firstName} ${review.employee.lastNameAr ?? review.employee.lastName} تقييمه الذاتي لدورة ${review.cycle.name}.`,
        link: "/performance",
      },
    });
  }

  await writeAudit({
    userId: user.id,
    action: "UPDATE",
    entity: "PerformanceReview",
    entityId: reviewId,
    oldData: { status: review.status },
    newData: { status: "SELF_REVIEW", selfRating: parsed.data.selfRating },
  });

  done(locale);
  return { ok: true };
}

export async function submitManagerReviewAction(
  locale: string,
  reviewId: string,
  input: unknown,
): Promise<PerformanceActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "performance.review_team")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = managerReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const review = await prisma.performanceReview.findUnique({
    where: { id: reviewId },
    include: {
      cycle: true,
      employee: { include: { user: true } },
    },
  });
  if (!review) return { ok: false, error: "notFound" };

  if (review.employeeId === user.employeeId) {
    return { ok: false, error: "forbidden" };
  }
  const canViewAll = hasPermission(user, "performance.view_all");
  if (!canViewAll && review.managerId !== user.employeeId) {
    return { ok: false, error: "forbidden" };
  }

  const finalRating = review.selfRating
    ? Number(((review.selfRating + parsed.data.managerRating) / 2).toFixed(2))
    : parsed.data.managerRating;

  const completed = await prisma.performanceReview.updateMany({
    where: { id: reviewId, status: { not: "COMPLETED" } },
    data: {
      managerRating: parsed.data.managerRating,
      managerComment: parsed.data.managerComment || null,
      finalRating,
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
  if (completed.count !== 1) return { ok: false, error: "completed" };

  if (review.employee.user) {
    await prisma.notification.create({
      data: {
        userId: review.employee.user.id,
        type: "GENERAL",
        title: "Performance review completed",
        titleAr: "اكتمل تقييم الأداء",
        message: `Your review for ${review.cycle.name} is complete. Final rating: ${finalRating}/5.`,
        messageAr: `اكتمل تقييمك لدورة ${review.cycle.name}. التقييم النهائي: ${finalRating}/5.`,
        link: "/performance",
      },
    });
  }

  await writeAudit({
    userId: user.id,
    action: "APPROVE",
    entity: "PerformanceReview",
    entityId: reviewId,
    oldData: { status: review.status, managerRating: review.managerRating },
    newData: { status: "COMPLETED", managerRating: parsed.data.managerRating, finalRating },
  });

  done(locale);
  return { ok: true };
}

export async function updateGoalProgressAction(
  locale: string,
  goalId: string,
  input: unknown,
): Promise<PerformanceActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const parsed = goalProgressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    include: { employee: { select: { id: true, managerId: true } } },
  });
  if (!goal) return { ok: false, error: "notFound" };

  const canManage = hasPermission(user, "performance.manage");
  const canSelf = hasPermission(user, "performance.review_self");
  const canTeam = hasPermission(user, "performance.review_team");
  const allowed =
    canManage ||
    (canSelf && goal.employeeId === user.employeeId) ||
    (canTeam && goal.employee.managerId === user.employeeId);
  if (!allowed) return { ok: false, error: "forbidden" };

  await prisma.goal.update({
    where: { id: goalId },
    data: {
      progress: parsed.data.progress,
      status: parsed.data.status,
    },
  });

  await writeAudit({
    userId: user.id,
    action: "UPDATE",
    entity: "Goal",
    entityId: goalId,
    oldData: { progress: goal.progress, status: goal.status },
    newData: { progress: parsed.data.progress, status: parsed.data.status },
  });

  done(locale);
  return { ok: true };
}
