"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, hasPermission } from "@/lib/auth/session";
import { writeAudit } from "@/lib/auth/audit";
import { serializable, SERIALIZABLE_TX } from "@/lib/db/transaction";

export type TrainingActionResult = {
  ok: boolean;
  error?:
    | "unauthorized"
    | "validation"
    | "notFound"
    | "duplicate"
    | "full"
    | "alreadyEnrolled"
    | "invalidDate"
    | "invalidScore";
};

const optionalText = (max = 1000) =>
  z.string().trim().max(max).optional().or(z.literal(""));

const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
  z.number().min(0).optional(),
);

const optionalInt = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
  z.number().int().min(0).optional(),
);

const courseSchema = z.object({
  code: z.string().trim().min(2).max(30),
  title: z.string().trim().min(2).max(160),
  titleAr: optionalText(160),
  description: optionalText(2000),
  provider: optionalText(160),
  trainer: optionalText(160),
  category: optionalText(80),
  startDate: optionalText(10),
  endDate: optionalText(10),
  cost: optionalNumber,
  currency: z.string().trim().min(3).max(3).default("YER"),
  capacity: optionalInt,
  status: z
    .enum(["PLANNED", "OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
    .default("PLANNED"),
});

const enrollmentSchema = z.object({
  employeeId: z.string().min(1),
});

const enrollmentUpdateSchema = z.object({
  status: z
    .enum(["ENROLLED", "IN_PROGRESS", "COMPLETED", "FAILED", "WITHDRAWN"])
    .default("ENROLLED"),
  score: optionalInt,
  certificateUrl: optionalText(500),
  feedback: optionalText(1000),
});

function dateOnly(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function done(locale: string) {
  revalidatePath(`/${locale}/training`);
  revalidatePath(`/${locale}/dashboard`);
}

function courseData(input: z.infer<typeof courseSchema>) {
  const startDate = input.startDate ? dateOnly(input.startDate) : null;
  const endDate = input.endDate ? dateOnly(input.endDate) : null;
  if (input.startDate && !startDate) return { error: "invalidDate" as const };
  if (input.endDate && !endDate) return { error: "invalidDate" as const };
  if (startDate && endDate && endDate < startDate) return { error: "invalidDate" as const };
  return {
    data: {
      code: input.code.toUpperCase(),
      title: input.title,
      titleAr: input.titleAr || null,
      description: input.description || null,
      provider: input.provider || null,
      trainer: input.trainer || null,
      category: input.category || null,
      startDate,
      endDate,
      cost: input.cost ?? null,
      currency: input.currency.toUpperCase(),
      capacity: input.capacity ?? null,
      status: input.status,
    },
  };
}

export async function createCourseAction(
  locale: string,
  input: unknown,
): Promise<TrainingActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "training.manage")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const prepared = courseData(parsed.data);
  if (prepared.error) return { ok: false, error: prepared.error };

  const company = await prisma.company.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!company) return { ok: false, error: "notFound" };

  const duplicate = await prisma.trainingCourse.findFirst({
    where: { companyId: company.id, code: prepared.data.code },
  });
  if (duplicate) return { ok: false, error: "duplicate" };

  const course = await prisma.trainingCourse.create({
    data: { companyId: company.id, ...prepared.data },
  });

  await writeAudit({
    userId: user.id,
    action: "CREATE",
    entity: "TrainingCourse",
    entityId: course.id,
    newData: { code: course.code, title: course.title, status: course.status },
  });

  done(locale);
  return { ok: true };
}

export async function updateCourseAction(
  locale: string,
  courseId: string,
  input: unknown,
): Promise<TrainingActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "training.manage")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = courseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const prepared = courseData(parsed.data);
  if (prepared.error) return { ok: false, error: prepared.error };

  const course = await prisma.trainingCourse.findUnique({ where: { id: courseId } });
  if (!course) return { ok: false, error: "notFound" };

  const duplicate = await prisma.trainingCourse.findFirst({
    where: {
      companyId: course.companyId,
      code: prepared.data.code,
      id: { not: courseId },
    },
  });
  if (duplicate) return { ok: false, error: "duplicate" };

  await prisma.trainingCourse.update({
    where: { id: courseId },
    data: prepared.data,
  });

  await writeAudit({
    userId: user.id,
    action: "UPDATE",
    entity: "TrainingCourse",
    entityId: courseId,
    oldData: { code: course.code, title: course.title, status: course.status },
    newData: {
      code: prepared.data.code,
      title: prepared.data.title,
      status: prepared.data.status,
    },
  });

  done(locale);
  return { ok: true };
}

export async function enrollEmployeeAction(
  locale: string,
  courseId: string,
  input: unknown,
): Promise<TrainingActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "training.manage")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = enrollmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const result = await serializable(() =>
    prisma.$transaction(async (tx) => {
      const [course, employee] = await Promise.all([
        tx.trainingCourse.findUnique({
          where: { id: courseId },
          select: {
            id: true,
            title: true,
            titleAr: true,
            code: true,
            capacity: true,
            status: true,
          },
        }),
        tx.employee.findFirst({
          where: { id: parsed.data.employeeId, deletedAt: null },
          select: { id: true, user: { select: { id: true } } },
        }),
      ]);
      if (!course || !employee) return { error: "notFound" as const };

      const existing = await tx.trainingEnrollment.findUnique({
        where: {
          courseId_employeeId: {
            courseId,
            employeeId: employee.id,
          },
        },
        select: { id: true, status: true },
      });
      if (existing && existing.status !== "WITHDRAWN") {
        return { error: "alreadyEnrolled" as const };
      }

      const activeCount = await tx.trainingEnrollment.count({
        where: {
          courseId,
          status: { in: ["ENROLLED", "IN_PROGRESS", "COMPLETED"] },
        },
      });
      if (course.capacity !== null && activeCount >= course.capacity) {
        return { error: "full" as const };
      }

      const enrollment = existing
        ? await tx.trainingEnrollment.update({
            where: { id: existing.id },
            data: {
              status: "ENROLLED",
              score: null,
              feedback: null,
              certificateUrl: null,
              completedAt: null,
            },
            select: { id: true },
          })
        : await tx.trainingEnrollment.create({
            data: { courseId, employeeId: employee.id, status: "ENROLLED" },
            select: { id: true },
          });

      if (employee.user) {
        await tx.notification.create({
          data: {
            userId: employee.user.id,
            type: "TRAINING",
            title: "Training enrollment",
            titleAr: "تسجيل في تدريب",
            message: `You have been enrolled in ${course.title}.`,
            messageAr: `تم تسجيلك في دورة ${course.titleAr ?? course.title}.`,
            link: "/training",
          },
        });
      }

      await writeAudit(
        {
          userId: user.id,
          action: "CREATE",
          entity: "TrainingEnrollment",
          entityId: enrollment.id,
          newData: {
            courseId,
            employeeId: employee.id,
            course: course.code,
          },
        },
        tx,
      );

      return { enrollmentId: enrollment.id };
    }, SERIALIZABLE_TX),
  );

  if ("error" in result) return { ok: false, error: result.error };

  done(locale);
  return { ok: true };
}

export async function updateEnrollmentAction(
  locale: string,
  enrollmentId: string,
  input: unknown,
): Promise<TrainingActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "training.manage")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = enrollmentUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  if (parsed.data.score !== undefined && parsed.data.score > 100) {
    return { ok: false, error: "invalidScore" };
  }

  const enrollment = await prisma.trainingEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { course: true, employee: { include: { user: true } } },
  });
  if (!enrollment) return { ok: false, error: "notFound" };

  const completedAt =
    parsed.data.status === "COMPLETED" ? enrollment.completedAt ?? new Date() : null;

  await prisma.trainingEnrollment.update({
    where: { id: enrollmentId },
    data: {
      status: parsed.data.status,
      score: parsed.data.score ?? null,
      certificateUrl: parsed.data.certificateUrl || null,
      feedback: parsed.data.feedback || null,
      completedAt,
    },
  });

  if (
    parsed.data.status === "COMPLETED" &&
    enrollment.status !== "COMPLETED" &&
    enrollment.employee.user
  ) {
    await prisma.notification.create({
      data: {
        userId: enrollment.employee.user.id,
        type: "TRAINING",
        title: "Training completed",
        titleAr: "اكتمل التدريب",
        message: `Your enrollment in ${enrollment.course.title} is complete.`,
        messageAr: `اكتمل تسجيلك في دورة ${enrollment.course.titleAr ?? enrollment.course.title}.`,
        link: "/training",
      },
    });
  }

  await writeAudit({
    userId: user.id,
    action: "UPDATE",
    entity: "TrainingEnrollment",
    entityId: enrollmentId,
    oldData: { status: enrollment.status, score: enrollment.score },
    newData: {
      status: parsed.data.status,
      score: parsed.data.score ?? null,
    },
  });

  done(locale);
  return { ok: true };
}
