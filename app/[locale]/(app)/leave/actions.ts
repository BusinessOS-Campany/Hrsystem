"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, hasPermission } from "@/lib/auth/session";
import { writeAudit } from "@/lib/auth/audit";

export type LeaveActionResult = {
  ok: boolean;
  error?:
    | "unauthorized"
    | "noEmployee"
    | "invalidDates"
    | "overlap"
    | "insufficientBalance"
    | "notFound"
    | "forbidden";
};

const requestSchema = z.object({
  leaveTypeId: z.string().min(1),
  startDate: z.string().min(10),
  endDate: z.string().min(10),
  reason: z.string().trim().min(3).max(500),
});

function utcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function countWorkingDays(start: Date, end: Date, holidays: Set<string>) {
  let days = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const weekday = cursor.getUTCDay();
    const key = cursor.toISOString().slice(0, 10);
    if (weekday !== 5 && weekday !== 6 && !holidays.has(key)) days += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export async function requestLeaveAction(
  locale: string,
  formData: FormData,
): Promise<LeaveActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "leave.request")) return { ok: false, error: "unauthorized" };
  if (!user.employeeId) return { ok: false, error: "noEmployee" };

  const parsed = requestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "invalidDates" };

  const start = utcDate(parsed.data.startDate);
  const end = utcDate(parsed.data.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return { ok: false, error: "invalidDates" };
  }

  const employee = await prisma.employee.findUnique({
    where: { id: user.employeeId },
    include: { user: true },
  });
  if (!employee) return { ok: false, error: "noEmployee" };

  const leaveType = await prisma.leaveType.findUnique({
    where: { id: parsed.data.leaveTypeId },
  });
  if (!leaveType || !leaveType.isActive) return { ok: false, error: "notFound" };

  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: employee.id,
      status: { in: ["PENDING_MANAGER", "PENDING_HR", "APPROVED"] },
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });
  if (overlap) return { ok: false, error: "overlap" };

  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: start, lte: end } },
    select: { date: true },
  });
  const holidayKeys = new Set(holidays.map((holiday) => holiday.date.toISOString().slice(0, 10)));
  const workingDays = countWorkingDays(start, end, holidayKeys);
  if (workingDays <= 0) return { ok: false, error: "invalidDates" };

  const year = start.getUTCFullYear();
  const balance = await prisma.leaveBalance.findUnique({
    where: {
      employeeId_leaveTypeId_year: {
        employeeId: employee.id,
        leaveTypeId: leaveType.id,
        year,
      },
    },
  });
  const available = balance
    ? Number(balance.entitledDays) + Number(balance.carriedDays) - Number(balance.usedDays) - Number(balance.pendingDays)
    : leaveType.maxDaysPerYear ?? 0;
  if (leaveType.code !== "UNPAID" && workingDays > available) {
    return { ok: false, error: "insufficientBalance" };
  }

  const sequence = await prisma.leaveRequest.count();
  const requestNo = `LR-${year}-${String(sequence + 1).padStart(4, "0")}`;
  const status = employee.managerId ? "PENDING_MANAGER" : "PENDING_HR";

  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.leaveRequest.create({
      data: {
        requestNo,
        employeeId: employee.id,
        leaveTypeId: leaveType.id,
        startDate: start,
        endDate: end,
        days: workingDays,
        reason: parsed.data.reason,
        status,
        managerId: employee.managerId,
      },
    });

    if (balance) {
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { pendingDays: { increment: workingDays } },
      });
    } else {
      await tx.leaveBalance.create({
        data: {
          employeeId: employee.id,
          leaveTypeId: leaveType.id,
          year,
          entitledDays: leaveType.maxDaysPerYear ?? workingDays,
          pendingDays: workingDays,
        },
      });
    }
    return created;
  });

  if (employee.managerId) {
    const manager = await prisma.employee.findUnique({
      where: { id: employee.managerId },
      include: { user: true },
    });
    if (manager?.user) {
      await prisma.notification.create({
        data: {
          userId: manager.user.id,
          type: "APPROVAL_REQUIRED",
          title: "Leave approval required",
          titleAr: "مطلوب اعتماد إجازة",
          message: `${employee.firstName} ${employee.lastName} requested ${workingDays} day(s) of ${leaveType.name}.`,
          messageAr: `طلب ${employee.firstNameAr ?? employee.firstName} ${employee.lastNameAr ?? employee.lastName} إجازة ${leaveType.nameAr} لمدة ${workingDays} يوم.`,
          link: "/leave",
        },
      });
    }
  }

  await writeAudit({
    userId: user.id,
    action: "CREATE",
    entity: "LeaveRequest",
    entityId: request.id,
    newData: { requestNo, days: workingDays, leaveType: leaveType.code },
  });

  revalidatePath(`/${locale}/leave`);
  return { ok: true };
}

export async function reviewLeaveAction(
  locale: string,
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  comment?: string,
): Promise<LeaveActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "leave.approve")) return { ok: false, error: "unauthorized" };

  const request = await prisma.leaveRequest.findUnique({
    where: { id: requestId },
    include: { leaveType: true, employee: { include: { user: true } } },
  });
  if (!request) return { ok: false, error: "notFound" };
  if (request.status !== "PENDING_MANAGER" && request.status !== "PENDING_HR") {
    return { ok: false, error: "notFound" };
  }

  const canViewAll = hasPermission(user, "leave.view_all");
  if (request.status === "PENDING_MANAGER" && !canViewAll && user.employeeId !== request.managerId) {
    return { ok: false, error: "forbidden" };
  }
  if (request.status === "PENDING_HR" && !canViewAll) {
    return { ok: false, error: "forbidden" };
  }

  const year = request.startDate.getUTCFullYear();
  const days = Number(request.days);

  if (decision === "REJECTED") {
    await prisma.$transaction(async (tx) => {
      await tx.leaveRequest.update({
        where: { id: request.id },
        data: {
          status: "REJECTED",
          ...(request.status === "PENDING_MANAGER"
            ? { managerReviewedAt: new Date(), managerComment: comment ?? null }
            : { hrReviewedAt: new Date(), hrComment: comment ?? null }),
        },
      });
      await tx.leaveBalance.updateMany({
        where: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year },
        data: { pendingDays: { decrement: days } },
      });
    });
  } else if (request.status === "PENDING_MANAGER" && request.leaveType.requiresHrApproval) {
    await prisma.leaveRequest.update({
      where: { id: request.id },
      data: {
        status: "PENDING_HR",
        managerReviewedAt: new Date(),
        managerComment: comment ?? null,
      },
    });
    const hrUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        roles: { some: { role: { code: { in: ["HR_ADMIN", "HR_OFFICER"] } } } },
      },
      select: { id: true },
    });
    if (hrUsers.length > 0) {
      await prisma.notification.createMany({
        data: hrUsers.map((hrUser) => ({
          userId: hrUser.id,
          type: "APPROVAL_REQUIRED" as const,
          title: "HR leave approval required",
          titleAr: "مطلوب اعتماد إجازة من الموارد البشرية",
          message: `${request.employee.firstName} ${request.employee.lastName}'s ${request.leaveType.name} request is awaiting HR review.`,
          messageAr: `طلب ${request.employee.firstNameAr ?? request.employee.firstName} ${request.employee.lastNameAr ?? request.employee.lastName} (${request.leaveType.nameAr}) بانتظار مراجعة الموارد البشرية.`,
          link: "/leave",
        })),
      });
    }
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.leaveRequest.update({
        where: { id: request.id },
        data: {
          status: "APPROVED",
          approvedById: user.id,
          approvedAt: new Date(),
          ...(request.status === "PENDING_MANAGER"
            ? { managerReviewedAt: new Date(), managerComment: comment ?? null }
            : { hrReviewedAt: new Date(), hrComment: comment ?? null }),
        },
      });
      await tx.leaveBalance.updateMany({
        where: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year },
        data: { pendingDays: { decrement: days }, usedDays: { increment: days } },
      });
    });
  }

  if (request.employee.user) {
    await prisma.notification.create({
      data: {
        userId: request.employee.user.id,
        type: decision === "APPROVED" ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
        title: decision === "APPROVED" ? "Leave approved" : "Leave rejected",
        titleAr: decision === "APPROVED" ? "تم اعتماد الإجازة" : "تم رفض الإجازة",
        message: `Your ${request.leaveType.name} request (${request.requestNo}) was ${decision.toLowerCase()}.`,
        messageAr: `تم ${decision === "APPROVED" ? "اعتماد" : "رفض"} طلب ${request.leaveType.nameAr} (${request.requestNo}).`,
        link: "/leave",
      },
    });
  }

  await writeAudit({
    userId: user.id,
    action: decision === "APPROVED" ? "APPROVE" : "REJECT",
    entity: "LeaveRequest",
    entityId: request.id,
    oldData: { status: request.status },
    newData: { status: decision },
  });

  revalidatePath(`/${locale}/leave`);
  return { ok: true };
}

export async function reviewLeaveFormAction(
  locale: string,
  requestId: string,
  decision: "APPROVED" | "REJECTED",
): Promise<void> {
  await reviewLeaveAction(locale, requestId, decision);
}
