"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, hasPermission } from "@/lib/auth/session";
import { writeAudit } from "@/lib/auth/audit";

export type RequestActionResult = {
  ok: boolean;
  error?: "unauthorized" | "noEmployee" | "notFound" | "forbidden" | "invalid";
};

const createSchema = z.object({
  type: z.enum([
    "SALARY_CERTIFICATE",
    "EMPLOYMENT_CERTIFICATE",
    "ADVANCE",
    "LOAN",
    "EXPENSE",
    "DOCUMENT",
    "OTHER",
  ]),
  subject: z.string().trim().min(3).max(200),
  details: z.string().trim().max(2000).optional(),
  amount: z.string().optional(),
});

export async function createRequestAction(
  locale: string,
  formData: FormData,
): Promise<RequestActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "request.create")) {
    return { ok: false, error: "unauthorized" };
  }
  if (!user.employeeId) return { ok: false, error: "noEmployee" };

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "invalid" };

  const employee = await prisma.employee.findUnique({
    where: { id: user.employeeId },
    include: { manager: { include: { user: true } } },
  });
  if (!employee) return { ok: false, error: "noEmployee" };

  const sequence = await prisma.employeeRequest.count();
  const requestNo = `REQ-${new Date().getUTCFullYear()}-${String(sequence + 1).padStart(4, "0")}`;
  const amount = parsed.data.amount ? Number(parsed.data.amount) : null;

  const request = await prisma.employeeRequest.create({
    data: {
      requestNo,
      employeeId: employee.id,
      type: parsed.data.type,
      subject: parsed.data.subject,
      details: parsed.data.details || null,
      amount: amount && !Number.isNaN(amount) ? amount : null,
      createdById: user.id,
      currentStep: 1,
      approvalSteps: {
        create: {
          stepOrder: 1,
          approverId: employee.manager?.user?.id ?? null,
          status: "PENDING",
        },
      },
    },
  });

  if (employee.manager?.user) {
    await prisma.notification.create({
      data: {
        userId: employee.manager.user.id,
        type: "APPROVAL_REQUIRED",
        title: "Request approval required",
        titleAr: "مطلوب اعتماد طلب",
        message: `${employee.firstName} ${employee.lastName} submitted request ${requestNo}.`,
        messageAr: `قدّم ${employee.firstNameAr ?? employee.firstName} ${employee.lastNameAr ?? employee.lastName} الطلب ${requestNo}.`,
        link: "/requests",
      },
    });
  }

  await writeAudit({
    userId: user.id,
    action: "CREATE",
    entity: "EmployeeRequest",
    entityId: request.id,
    newData: { requestNo, type: parsed.data.type },
  });

  revalidatePath(`/${locale}/requests`);
  return { ok: true };
}

export async function reviewRequestAction(
  locale: string,
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  comment?: string,
): Promise<RequestActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "request.approve")) {
    return { ok: false, error: "unauthorized" };
  }

  const request = await prisma.employeeRequest.findUnique({
    where: { id: requestId },
    include: {
      employee: { include: { user: true } },
      approvalSteps: { orderBy: { stepOrder: "asc" } },
    },
  });
  if (!request) return { ok: false, error: "notFound" };
  if (request.status !== "PENDING") return { ok: false, error: "invalid" };

  const pending = request.approvalSteps.find((step) => step.status === "PENDING");
  if (!pending) return { ok: false, error: "invalid" };

  const canViewAll = hasPermission(user, "request.view_all");
  const roleIds = await prisma.userRole.findMany({
    where: { userId: user.id },
    select: { roleId: true },
  });
  const hasRole = pending.roleId
    ? roleIds.some((role) => role.roleId === pending.roleId)
    : false;
  const isApprover = pending.approverId === user.id || hasRole || canViewAll;
  if (!isApprover) return { ok: false, error: "forbidden" };

  const remaining = request.approvalSteps.filter(
    (step) => step.id !== pending.id && step.status === "PENDING",
  );
  const finalApproval = remaining.length === 0;

  await prisma.$transaction(async (tx) => {
    await tx.approvalStep.update({
      where: { id: pending.id },
      data: {
        status: decision,
        comment: comment ?? null,
        actedAt: new Date(),
      },
    });

    if (decision === "REJECTED") {
      await tx.employeeRequest.update({
        where: { id: request.id },
        data: { status: "REJECTED" },
      });
      return;
    }

    if (finalApproval) {
      await tx.employeeRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED", currentStep: pending.stepOrder },
      });
    } else {
      await tx.employeeRequest.update({
        where: { id: request.id },
        data: { currentStep: pending.stepOrder + 1 },
      });
    }
  });

  if (request.employee.user) {
    await prisma.notification.create({
      data: {
        userId: request.employee.user.id,
        type: decision === "APPROVED" ? "GENERAL" : "APPROVAL_REQUIRED",
        title: decision === "APPROVED" ? "Request approved" : "Request rejected",
        titleAr: decision === "APPROVED" ? "تم اعتماد الطلب" : "تم رفض الطلب",
        message: `Your request ${request.requestNo} was ${decision === "APPROVED" ? "approved" : "rejected"}.`,
        messageAr: `تم ${decision === "APPROVED" ? "اعتماد" : "رفض"} طلبك ${request.requestNo}.`,
        link: "/requests",
      },
    });
  }

  await writeAudit({
    userId: user.id,
    action: decision === "APPROVED" ? "APPROVE" : "REJECT",
    entity: "EmployeeRequest",
    entityId: request.id,
    oldData: { status: request.status },
    newData: { status: decision },
  });

  revalidatePath(`/${locale}/requests`);
  return { ok: true };
}

export async function reviewRequestFormAction(
  locale: string,
  requestId: string,
  decision: "APPROVED" | "REJECTED",
): Promise<void> {
  await reviewRequestAction(locale, requestId, decision);
}
