"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, hasPermission } from "@/lib/auth/session";
import { writeAudit } from "@/lib/auth/audit";

export type OffboardingActionResult = {
  ok: boolean;
  error?:
    | "unauthorized"
    | "validation"
    | "notFound"
    | "activeCaseExists"
    | "invalidDate";
};

const createSchema = z.object({
  employeeId: z.string().min(1),
  type: z.enum(["RESIGNATION", "TERMINATION", "RETIREMENT", "CONTRACT_EXPIRY"]),
  requestDate: z.string().min(10),
  lastWorkingDate: z.string().min(10),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

function dateOnly(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function employeeStatusFor(type: string): "RESIGNED" | "TERMINATED" | "RETIRED" {
  if (type === "RESIGNATION") return "RESIGNED";
  if (type === "RETIREMENT") return "RETIRED";
  return "TERMINATED";
}

const defaultTasks = [
  { title: "Return company assets", category: "ASSETS", offset: -5 },
  { title: "Remove system access", category: "ACCESS", offset: 0 },
  { title: "Process final payroll and settlement", category: "PAYROLL", offset: 0 },
  { title: "Complete knowledge transfer", category: "KNOWLEDGE", offset: -5 },
  { title: "Conduct exit interview", category: "EXIT", offset: -3 },
  { title: "Obtain final clearance", category: "CLEARANCE", offset: 0 },
];

export async function createOffboardingAction(
  locale: string,
  input: unknown,
): Promise<OffboardingActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "offboarding.manage")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const requestDate = dateOnly(parsed.data.requestDate);
  const lastWorkingDate = dateOnly(parsed.data.lastWorkingDate);
  if (!requestDate || !lastWorkingDate || lastWorkingDate < requestDate) {
    return { ok: false, error: "invalidDate" };
  }

  const employee = await prisma.employee.findFirst({
    where: {
      id: parsed.data.employeeId,
      deletedAt: null,
      status: { notIn: ["TERMINATED", "RESIGNED", "RETIRED"] },
    },
    include: {
      user: true,
      offboardings: {
        where: { status: { in: ["NOT_STARTED", "IN_PROGRESS"] } },
        take: 1,
      },
    },
  });
  if (!employee) return { ok: false, error: "notFound" };
  if (employee.offboardings.length > 0) return { ok: false, error: "activeCaseExists" };

  const offboarding = await prisma.offboarding.create({
    data: {
      employeeId: employee.id,
      type: parsed.data.type,
      requestDate,
      lastWorkingDate,
      reason: parsed.data.reason || null,
      status: "NOT_STARTED",
      progress: 0,
      tasks: {
        create: defaultTasks.map((task) => ({
          title: task.title,
          category: task.category,
          dueDate: addDays(lastWorkingDate, task.offset),
          isRequired: true,
        })),
      },
    },
  });

  if (employee.user) {
    await prisma.notification.create({
      data: {
        userId: employee.user.id,
        type: "GENERAL",
        title: "Offboarding started",
        titleAr: "تم بدء إنهاء الخدمة",
        message: `Your offboarding process has started. Last working day: ${parsed.data.lastWorkingDate}.`,
        messageAr: `بدأت عملية إنهاء الخدمة الخاصة بك. آخر يوم عمل: ${parsed.data.lastWorkingDate}.`,
        link: "/offboarding",
      },
    });
  }

  await writeAudit({
    userId: user.id,
    action: "CREATE",
    entity: "Offboarding",
    entityId: offboarding.id,
    newData: {
      employeeId: employee.id,
      type: parsed.data.type,
      lastWorkingDate: parsed.data.lastWorkingDate,
    },
  });

  revalidatePath(`/${locale}/offboarding`);
  revalidatePath(`/${locale}/employees/${employee.id}`);
  revalidatePath(`/${locale}/dashboard`);
  return { ok: true };
}

export async function toggleOffboardingTaskAction(
  locale: string,
  taskId: string,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "offboarding.manage")) return;

  const task = await prisma.offboardingTask.findUnique({
    where: { id: taskId },
    include: {
      offboarding: {
        include: {
          tasks: true,
          employee: { include: { user: true } },
        },
      },
    },
  });
  if (!task) return;
  if (task.offboarding.status === "COMPLETED") return;

  const completed = !task.completedAt;
  await prisma.offboardingTask.update({
    where: { id: taskId },
    data: { completedAt: completed ? new Date() : null },
  });

  const tasks = task.offboarding.tasks.map((item) =>
    item.id === taskId ? { ...item, completedAt: completed ? new Date() : null } : item,
  );
  const required = tasks.filter((item) => item.isRequired);
  const completedRequired = required.filter((item) => item.completedAt).length;
  const progress = required.length > 0 ? Math.round((completedRequired / required.length) * 100) : 0;
  const allDone = required.length > 0 && completedRequired === required.length;
  const employee = task.offboarding.employee;

  await prisma.$transaction(async (tx) => {
    await tx.offboarding.update({
      where: { id: task.offboardingId },
      data: {
        progress,
        status: allDone ? "COMPLETED" : progress > 0 ? "IN_PROGRESS" : "NOT_STARTED",
        completedAt: allDone ? new Date() : null,
      },
    });

    if (allDone) {
      await tx.employee.update({
        where: { id: employee.id },
        data: { status: employeeStatusFor(task.offboarding.type) },
      });
      if (employee.user) {
        await tx.user.update({
          where: { id: employee.user.id },
          data: { isActive: false },
        });
        await tx.session.deleteMany({ where: { userId: employee.user.id } });
      }
    }
  });

  await writeAudit({
    userId: user.id,
    action: "UPDATE",
    entity: "OffboardingTask",
    entityId: taskId,
    newData: {
      completed,
      progress,
      ...(allDone
        ? { employeeStatus: employeeStatusFor(task.offboarding.type), accountDeactivated: Boolean(employee.user) }
        : {}),
    },
  });

  revalidatePath(`/${locale}/offboarding`);
  revalidatePath(`/${locale}/employees/${employee.id}`);
  revalidatePath(`/${locale}/dashboard`);
}
