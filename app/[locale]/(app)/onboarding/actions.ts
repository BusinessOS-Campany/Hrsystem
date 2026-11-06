"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, hasPermission } from "@/lib/auth/session";
import { writeAudit } from "@/lib/auth/audit";

export type OnboardingActionResult = {
  ok: boolean;
  error?: "unauthorized" | "validation" | "notFound" | "duplicate" | "invalidDate";
};

const createSchema = z.object({
  employeeId: z.string().min(1),
  startDate: z.string().min(10),
  templateName: z.string().trim().max(120).optional().or(z.literal("")),
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

const defaultTasks = [
  { title: "Employment contract signed", titleAr: "توقيع عقد العمل", category: "CONTRACT", offset: 0, required: true },
  { title: "Employee documents collected", titleAr: "جمع مستندات الموظف", category: "DOCUMENTS", offset: 0, required: true },
  { title: "System accounts and email created", titleAr: "إنشاء حسابات النظام والبريد", category: "ACCOUNT", offset: 0, required: true },
  { title: "Workstation and equipment prepared", titleAr: "تجهيز محطة العمل والمعدات", category: "EQUIPMENT", offset: 0, required: true },
  { title: "Orientation session", titleAr: "جلسة تعريفية", category: "ORIENTATION", offset: 1, required: true },
  { title: "Manager and team introduction", titleAr: "تعريف المدير والفريق", category: "MANAGER", offset: 1, required: true },
  { title: "Payroll and bank details activated", titleAr: "تفعيل بيانات الرواتب والبنك", category: "PAYROLL", offset: 3, required: true },
  { title: "30-day check-in", titleAr: "متابعة بعد 30 يومًا", category: "CHECK_IN", offset: 30, required: false },
];

export async function createOnboardingAction(
  locale: string,
  input: unknown,
): Promise<OnboardingActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "onboarding.manage")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const startDate = dateOnly(parsed.data.startDate);
  if (!startDate) return { ok: false, error: "invalidDate" };

  const employee = await prisma.employee.findFirst({
    where: {
      id: parsed.data.employeeId,
      deletedAt: null,
      status: { in: ["ACTIVE", "PROBATION"] },
    },
    include: { onboarding: true, user: true },
  });
  if (!employee) return { ok: false, error: "notFound" };
  if (employee.onboarding) return { ok: false, error: "duplicate" };

  const onboarding = await prisma.onboarding.create({
    data: {
      employeeId: employee.id,
      startDate,
      templateName: parsed.data.templateName || "STANDARD",
      status: "NOT_STARTED",
      progress: 0,
      tasks: {
        create: defaultTasks.map((task, index) => ({
          title: task.title,
          titleAr: task.titleAr,
          category: task.category,
          dueDate: addDays(startDate, task.offset),
          isRequired: task.required,
          sortOrder: index,
        })),
      },
    },
  });

  if (employee.user) {
    await prisma.notification.create({
      data: {
        userId: employee.user.id,
        type: "GENERAL",
        title: "Onboarding plan created",
        titleAr: "تم إنشاء خطة التأهيل",
        message: `Your onboarding plan starts on ${parsed.data.startDate}.`,
        messageAr: `تبدأ خطة التأهيل الخاصة بك في ${parsed.data.startDate}.`,
        link: "/onboarding",
      },
    });
  }

  await writeAudit({
    userId: user.id,
    action: "CREATE",
    entity: "Onboarding",
    entityId: onboarding.id,
    newData: { employeeId: employee.id, startDate: parsed.data.startDate },
  });

  revalidatePath(`/${locale}/onboarding`);
  revalidatePath(`/${locale}/employees/${employee.id}`);
  return { ok: true };
}

export async function toggleOnboardingTaskAction(
  locale: string,
  taskId: string,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "onboarding.manage")) return;

  const task = await prisma.onboardingTask.findUnique({
    where: { id: taskId },
    include: { onboarding: { include: { tasks: true } } },
  });
  if (!task) return;

  const completed = !task.completedAt;
  await prisma.onboardingTask.update({
    where: { id: taskId },
    data: { completedAt: completed ? new Date() : null },
  });

  const tasks = task.onboarding.tasks.map((item) =>
    item.id === taskId ? { ...item, completedAt: completed ? new Date() : null } : item,
  );
  const required = tasks.filter((item) => item.isRequired);
  const completedRequired = required.filter((item) => item.completedAt).length;
  const progress = required.length > 0 ? Math.round((completedRequired / required.length) * 100) : 0;
  const allDone = required.length > 0 && completedRequired === required.length;

  await prisma.onboarding.update({
    where: { id: task.onboardingId },
    data: {
      progress,
      status: allDone ? "COMPLETED" : progress > 0 ? "IN_PROGRESS" : "NOT_STARTED",
      completedAt: allDone ? new Date() : null,
    },
  });

  await writeAudit({
    userId: user.id,
    action: "UPDATE",
    entity: "OnboardingTask",
    entityId: taskId,
    newData: { completed },
  });

  revalidatePath(`/${locale}/onboarding`);
  revalidatePath(`/${locale}/employees/${task.onboarding.employeeId}`);
}
