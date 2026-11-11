"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, hasPermission, type AuthUser } from "@/lib/auth/session";
import { writeAudit } from "@/lib/auth/audit";

const MAX_REQUEST_DAYS = 366;
const MAX_BALANCE_DAYS = 999;

export type LeaveActionResult = {
  ok: boolean;
  error?:
    | "unauthorized"
    | "noEmployee"
    | "invalidDates"
    | "overlap"
    | "insufficientBalance"
    | "notFound"
    | "forbidden"
    | "commentRequired"
    | "notCancellable"
    | "conflict"
    | "validation";
};

export type LeaveBalanceResult = {
  ok: boolean;
  error?: "unauthorized" | "validation" | "notFound" | "balanceExceeded";
};

const requestSchema = z.object({
  leaveTypeId: z.string().min(1).max(64),
  startDate: z.string().min(10).max(10),
  endDate: z.string().min(10).max(10),
  reason: z.string().trim().min(3).max(500),
});

const balanceSchema = z.object({
  employeeId: z.string().min(1).max(64),
  leaveTypeId: z.string().min(1).max(64),
  year: z.coerce.number().int().min(2000).max(2100),
  entitledDays: z.coerce.number().min(0).max(MAX_BALANCE_DAYS),
  carriedDays: z.coerce.number().min(0).max(MAX_BALANCE_DAYS),
  usedAdjustment: z.coerce.number().min(-MAX_BALANCE_DAYS).max(MAX_BALANCE_DAYS),
});

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function countWorkingDays(start: Date, end: Date, holidays: Set<string>) {
  let days = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const weekday = cursor.getUTCDay();
    const key = cursor.toISOString().slice(0, 10);
    // Company week is Sunday–Thursday; Friday and Saturday are the weekend.
    if (weekday !== 5 && weekday !== 6 && !holidays.has(key)) days += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

async function holidayKeys(
  client: Prisma.TransactionClient,
  start: Date,
  end: Date,
) {
  const holidays = await client.holiday.findMany({
    where: { date: { gte: start, lte: end } },
    select: { date: true },
  });
  return new Set(holidays.map((holiday) => holiday.date.toISOString().slice(0, 10)));
}

function balanceTotal(balance: {
  entitledDays: Prisma.Decimal;
  carriedDays: Prisma.Decimal;
}) {
  return Number(balance.entitledDays) + Number(balance.carriedDays);
}

function balanceAvailable(balance: {
  entitledDays: Prisma.Decimal;
  carriedDays: Prisma.Decimal;
  usedDays: Prisma.Decimal;
  pendingDays: Prisma.Decimal;
}) {
  return (
    balanceTotal(balance) -
    Number(balance.usedDays) -
    Number(balance.pendingDays)
  );
}

function isUnlimited(leaveType: { maxDaysPerYear: number | null }) {
  return leaveType.maxDaysPerYear === null;
}

function isRetryable(error: unknown, retryConnection = false) {
  const code = (error as { code?: string }).code;
  if (code === "P2034" || code === "P2002") return true;
  return (
    retryConnection &&
    (code === "P1017" ||
      code === "P1001" ||
      code === "P1002" ||
      code === "P2024")
  );
}

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5_000,
  timeout: 15_000,
} as const;

async function serializable<T>(
  run: () => Promise<T>,
  retryConnection = false,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isRetryable(error, retryConnection) || attempt === 7) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(1_000, 100 * 2 ** attempt)),
      );
    }
  }
  throw lastError;
}

async function serializableWithConnection<T>(run: () => Promise<T>) {
  return serializable(run, true);
}

async function nextRequestNo(
  tx: Prisma.TransactionClient,
  year: number,
) {
  const prefix = `LR-${year}-`;
  const latest = await tx.leaveRequest.findFirst({
    where: { requestNo: { startsWith: prefix } },
    orderBy: { requestNo: "desc" },
    select: { requestNo: true },
  });
  const sequence = Number(latest?.requestNo.slice(prefix.length)) || 0;
  return `${prefix}${String(sequence + 1).padStart(4, "0")}`;
}

async function releaseBalance(
  tx: Prisma.TransactionClient,
  request: {
    employeeId: string;
    leaveTypeId: string;
    startDate: Date;
    days: Prisma.Decimal;
  },
  from: "pending" | "used",
) {
  const days = Number(request.days);
  const year = request.startDate.getUTCFullYear();

  if (from === "pending") {
    await tx.$executeRaw`
      UPDATE "leave_balances"
      SET "pendingDays" = GREATEST(0, "pendingDays" - ${days}::numeric)
      WHERE "employeeId" = ${request.employeeId}
        AND "leaveTypeId" = ${request.leaveTypeId}
        AND "year" = ${year}
    `;
  } else {
    await tx.$executeRaw`
      UPDATE "leave_balances"
      SET "usedDays" = GREATEST(0, "usedDays" - ${days}::numeric)
      WHERE "employeeId" = ${request.employeeId}
        AND "leaveTypeId" = ${request.leaveTypeId}
        AND "year" = ${year}
    `;
  }
}

async function consumePending(
  tx: Prisma.TransactionClient,
  request: {
    employeeId: string;
    leaveTypeId: string;
    startDate: Date;
    days: Prisma.Decimal;
  },
) {
  const days = Number(request.days);
  const year = request.startDate.getUTCFullYear();
  await tx.$executeRaw`
    UPDATE "leave_balances"
    SET "pendingDays" = GREATEST(0, "pendingDays" - ${days}::numeric),
        "usedDays" = "usedDays" + ${days}::numeric
    WHERE "employeeId" = ${request.employeeId}
      AND "leaveTypeId" = ${request.leaveTypeId}
      AND "year" = ${year}
  `;
}

async function activeHrUserIds() {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      roles: {
        some: {
          role: {
            permissions: {
              some: { permission: { code: "leave.view_all" } },
            },
          },
        },
      },
    },
    select: { id: true },
  });
  return users.map((user) => user.id);
}

function canManageAll(user: AuthUser) {
  return hasPermission(user, "leave.view_all") || hasPermission(user, "leave.manage_balance");
}

export async function requestLeaveAction(
  locale: string,
  formData: FormData,
): Promise<LeaveActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "leave.request")) {
    return { ok: false, error: "unauthorized" };
  }
  if (!user.employeeId) return { ok: false, error: "noEmployee" };

  const parsed = requestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "invalidDates" };

  const start = parseDateOnly(parsed.data.startDate);
  const end = parseDateOnly(parsed.data.endDate);
  if (!start || !end || end < start) {
    return { ok: false, error: "invalidDates" };
  }
  const calendarDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (calendarDays > MAX_REQUEST_DAYS) {
    return { ok: false, error: "invalidDates" };
  }

  const employee = await prisma.employee.findFirst({
    where: { id: user.employeeId, deletedAt: null },
    select: {
      id: true,
      managerId: true,
      firstName: true,
      lastName: true,
      firstNameAr: true,
      lastNameAr: true,
      user: { select: { id: true } },
    },
  });
  if (!employee) return { ok: false, error: "noEmployee" };

  const leaveType = await prisma.leaveType.findFirst({
    where: { id: parsed.data.leaveTypeId, isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      nameAr: true,
      maxDaysPerYear: true,
      requiresApproval: true,
      requiresHrApproval: true,
    },
  });
  if (!leaveType) return { ok: false, error: "notFound" };

  const year = start.getUTCFullYear();
  const managerId = employee.managerId;
  const status = !leaveType.requiresApproval
    ? "APPROVED"
    : managerId
      ? "PENDING_MANAGER"
      : "PENDING_HR";

  try {
    const result = await serializable(() =>
      prisma.$transaction(async (tx) => {
      const db = tx as unknown as Prisma.TransactionClient;
      const [overlap, holidays] = await Promise.all([
        tx.leaveRequest.findFirst({
          where: {
            employeeId: employee.id,
            status: { in: ["PENDING_MANAGER", "PENDING_HR", "APPROVED"] },
            startDate: { lte: end },
            endDate: { gte: start },
          },
          select: { id: true },
        }),
        holidayKeys(db, start, end),
      ]);

      if (overlap) return { ok: false as const, error: "overlap" as const };

      const workingDays = countWorkingDays(start, end, holidays);
      if (workingDays <= 0) {
        return { ok: false as const, error: "invalidDates" as const };
      }

      const balance = await tx.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: employee.id,
            leaveTypeId: leaveType.id,
            year,
          },
        },
        select: {
          id: true,
          entitledDays: true,
          carriedDays: true,
          usedDays: true,
          pendingDays: true,
        },
      });

      if (!isUnlimited(leaveType)) {
        const available = balance
          ? balanceAvailable(balance)
          : (leaveType.maxDaysPerYear ?? 0);
        if (workingDays > available) {
          return { ok: false as const, error: "insufficientBalance" as const };
        }
      }

      const requestNo = await nextRequestNo(db, year);
      const row = await tx.leaveRequest.create({
        data: {
          requestNo,
          employeeId: employee.id,
          leaveTypeId: leaveType.id,
          startDate: start,
          endDate: end,
          days: workingDays,
          reason: parsed.data.reason,
          status,
          managerId,
          ...(status === "APPROVED"
            ? { approvedById: user.id, approvedAt: new Date() }
            : {}),
        },
        select: { id: true, requestNo: true, status: true },
      });

      if (!isUnlimited(leaveType)) {
        if (balance) {
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data:
              status === "APPROVED"
                ? { usedDays: { increment: workingDays } }
                : { pendingDays: { increment: workingDays } },
          });
        } else {
          await tx.leaveBalance.create({
            data: {
              employeeId: employee.id,
              leaveTypeId: leaveType.id,
              year,
              entitledDays: leaveType.maxDaysPerYear ?? 0,
              usedDays: status === "APPROVED" ? workingDays : 0,
              pendingDays:
                status === "PENDING_MANAGER" || status === "PENDING_HR"
                  ? workingDays
                  : 0,
            },
          });
        }
      }

      await writeAudit(
        {
          userId: user.id,
          action: "CREATE",
          entity: "LeaveRequest",
          entityId: row.id,
          newData: {
            requestNo,
            days: workingDays,
            leaveType: leaveType.code,
            status,
          },
        },
        tx,
      );

      return { ok: true as const, created: row, workingDays, status };
      }, TRANSACTION_OPTIONS),
    );

    if (!result.ok) return result;

    try {
      const employeeName = `${employee.firstName} ${employee.lastName}`;
      const employeeNameAr =
        `${employee.firstNameAr ?? employee.firstName} ${employee.lastNameAr ?? employee.lastName}`;
      const requestLink = "/leave";

      const employeeUserId = employee.user?.id;
      const actorUserId = user.id;
      const leaveTypeName = leaveType.name;
      const leaveTypeNameAr = leaveType.nameAr;

      async function notifyHrReview() {
        const hrIds = (await activeHrUserIds()).filter(
          (id) => id !== employeeUserId && id !== actorUserId,
        );
        if (hrIds.length === 0) return;
        await prisma.notification.createMany({
          data: hrIds.map((userId) => ({
            userId,
            type: "APPROVAL_REQUIRED" as const,
            title: "HR leave approval required",
            titleAr: "مطلوب اعتماد إجازة من الموارد البشرية",
            message: `${employeeName}'s ${leaveTypeName} request is awaiting HR review.`,
            messageAr: `طلب ${employeeNameAr} (${leaveTypeNameAr}) بانتظار مراجعة الموارد البشرية.`,
            link: requestLink,
          })),
        });
      }

      if (result.status === "PENDING_MANAGER" && managerId) {
        const manager = await prisma.employee.findUnique({
          where: { id: managerId },
          select: { user: { select: { id: true, isActive: true } } },
        });
        if (manager?.user?.isActive) {
          await prisma.notification.create({
            data: {
              userId: manager.user.id,
              type: "APPROVAL_REQUIRED",
              title: "Leave approval required",
              titleAr: "مطلوب اعتماد إجازة",
              message: `${employeeName} requested ${result.workingDays} working day(s) of ${leaveType.name}.`,
              messageAr: `طلب ${employeeNameAr} إجازة ${leaveType.nameAr} لمدة ${result.workingDays} يوم عمل.`,
              link: requestLink,
            },
          });
        } else {
          // A manager without a login can never action the request, so route it
          // to HR immediately instead of leaving it stuck in the manager queue.
          await notifyHrReview();
        }
      } else if (result.status === "PENDING_HR") {
        await notifyHrReview();
      }

    } catch (error) {
      console.error("Failed to send leave request notifications", error);
    }

    revalidatePath(`/${locale}/leave`);
    return { ok: true };
  } catch (error) {
    if (isRetryable(error)) return { ok: false, error: "conflict" };
    console.error("Failed to create leave request", error);
    return { ok: false, error: "validation" };
  }
}

export async function reviewLeaveAction(
  locale: string,
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  comment?: string,
): Promise<LeaveActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const requiredPermission = decision === "REJECTED" ? "leave.reject" : "leave.approve";
  if (!hasPermission(user, requiredPermission)) {
    return { ok: false, error: "unauthorized" };
  }

  const cleanComment = comment?.trim() || null;
  if (decision === "REJECTED" && (!cleanComment || cleanComment.length < 3)) {
    return { ok: false, error: "commentRequired" };
  }

  try {
    const result = await serializableWithConnection(() =>
      prisma.$transaction(async (tx) => {
      const db = tx as unknown as Prisma.TransactionClient;
      const request = await tx.leaveRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          requestNo: true,
          employeeId: true,
          leaveTypeId: true,
          managerId: true,
          startDate: true,
          days: true,
          status: true,
          leaveType: {
            select: {
              name: true,
              nameAr: true,
              maxDaysPerYear: true,
              requiresHrApproval: true,
            },
          },
          employee: {
            select: {
              firstName: true,
              lastName: true,
              firstNameAr: true,
              lastNameAr: true,
              user: { select: { id: true } },
            },
          },
        },
      });

      if (!request) return { ok: false as const, error: "notFound" as const };
      if (request.status !== "PENDING_MANAGER" && request.status !== "PENDING_HR") {
        return { ok: false as const, error: "conflict" as const };
      }
      if (user.employeeId === request.employeeId) {
        return { ok: false as const, error: "forbidden" as const };
      }
      if (request.status === "PENDING_MANAGER") {
        if (!canManageAll(user) && user.employeeId !== request.managerId) {
          return { ok: false as const, error: "forbidden" as const };
        }
      } else if (!canManageAll(user)) {
        return { ok: false as const, error: "forbidden" as const };
      }

      const reviewData =
        request.status === "PENDING_MANAGER"
          ? { managerReviewedAt: new Date(), managerComment: cleanComment }
          : { hrReviewedAt: new Date(), hrComment: cleanComment };

      if (decision === "REJECTED") {
        const updated = await tx.leaveRequest.updateMany({
          where: { id: request.id, status: request.status },
          data: { status: "REJECTED", ...reviewData },
        });
        if (updated.count !== 1) {
          return { ok: false as const, error: "conflict" as const };
        }
        if (!isUnlimited(request.leaveType)) {
          await releaseBalance(db, request, "pending");
        }
        await writeAudit(
          {
            userId: user.id,
            action: "REJECT",
            entity: "LeaveRequest",
            entityId: request.id,
            oldData: { status: request.status },
            newData: { status: "REJECTED", comment: cleanComment },
          },
          tx,
        );
        return {
          ok: true as const,
          final: true,
          status: "REJECTED" as const,
          request,
          comment: cleanComment,
        };
      }

      if (request.status === "PENDING_MANAGER" && request.leaveType.requiresHrApproval) {
        const updated = await tx.leaveRequest.updateMany({
          where: { id: request.id, status: "PENDING_MANAGER" },
          data: { status: "PENDING_HR", ...reviewData },
        });
        if (updated.count !== 1) {
          return { ok: false as const, error: "conflict" as const };
        }
        await writeAudit(
          {
            userId: user.id,
            action: "APPROVE",
            entity: "LeaveRequest",
            entityId: request.id,
            oldData: { status: "PENDING_MANAGER" },
            newData: { status: "PENDING_HR", comment: cleanComment },
          },
          tx,
        );
        return {
          ok: true as const,
          final: false,
          status: "PENDING_HR" as const,
          request,
          comment: cleanComment,
        };
      }

      const updated = await tx.leaveRequest.updateMany({
        where: { id: request.id, status: request.status },
        data: {
          status: "APPROVED",
          approvedById: user.id,
          approvedAt: new Date(),
          ...reviewData,
        },
      });
      if (updated.count !== 1) {
        return { ok: false as const, error: "conflict" as const };
      }
      if (!isUnlimited(request.leaveType)) {
        await consumePending(db, request);
      }
      await writeAudit(
        {
          userId: user.id,
          action: "APPROVE",
          entity: "LeaveRequest",
          entityId: request.id,
          oldData: { status: request.status },
          newData: { status: "APPROVED", comment: cleanComment },
        },
        tx,
      );
      return {
        ok: true as const,
        final: true,
        status: "APPROVED" as const,
        request,
        comment: cleanComment,
      };
      }, TRANSACTION_OPTIONS),
    );

    if (!result.ok) return result;

    const { request } = result;
    try {
      const employeeName = `${request.employee.firstName} ${request.employee.lastName}`;
      const employeeNameAr =
        `${request.employee.firstNameAr ?? request.employee.firstName} ${request.employee.lastNameAr ?? request.employee.lastName}`;

      if (result.status === "PENDING_HR") {
        const hrIds = (await activeHrUserIds()).filter(
          (id) => id !== request.employee.user?.id && id !== user.id,
        );
        if (hrIds.length > 0) {
          await prisma.notification.createMany({
            data: hrIds.map((userId) => ({
              userId,
              type: "APPROVAL_REQUIRED" as const,
              title: "HR leave approval required",
              titleAr: "مطلوب اعتماد إجازة من الموارد البشرية",
              message: `${employeeName}'s ${request.leaveType.name} request was approved by the manager and is awaiting HR review.`,
              messageAr: `تم اعتماد طلب ${employeeNameAr} (${request.leaveType.nameAr}) من المدير وهو بانتظار مراجعة الموارد البشرية.`,
              link: "/leave",
            })),
          });
        }
      } else if (request.employee.user) {
        const approved = result.status === "APPROVED";
        await prisma.notification.create({
          data: {
            userId: request.employee.user.id,
            type: approved ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
            title: approved ? "Leave approved" : "Leave rejected",
            titleAr: approved ? "تم اعتماد الإجازة" : "تم رفض الإجازة",
            message: `Your ${request.leaveType.name} request (${request.requestNo}) was ${approved ? "approved" : "rejected"}.${!approved && result.comment ? ` Reason: ${result.comment}` : ""}`,
            messageAr: `تم ${approved ? "اعتماد" : "رفض"} طلب ${request.leaveType.nameAr} (${request.requestNo}).${!approved && result.comment ? ` السبب: ${result.comment}` : ""}`,
            link: "/leave",
          },
        });
      }

    } catch (error) {
      console.error("Failed to send leave review notifications", error);
    }

    revalidatePath(`/${locale}/leave`);
    return { ok: true };
  } catch (error) {
    if (isRetryable(error)) return { ok: false, error: "conflict" };
    console.error("Failed to review leave request", error);
    return { ok: false, error: "validation" };
  }
}

export async function cancelLeaveAction(
  locale: string,
  requestId: string,
  reason?: string,
): Promise<LeaveActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "leave.view")) {
    return { ok: false, error: "unauthorized" };
  }

  const cleanReason = reason?.trim().slice(0, 500) || null;
  const today = new Date();
  const todayOnly = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );

  try {
    const result = await serializableWithConnection(() =>
      prisma.$transaction(async (tx) => {
      const db = tx as unknown as Prisma.TransactionClient;
      const request = await tx.leaveRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          requestNo: true,
          employeeId: true,
          leaveTypeId: true,
          managerId: true,
          startDate: true,
          days: true,
          status: true,
          leaveType: { select: { name: true, nameAr: true, maxDaysPerYear: true } },
          employee: {
            select: {
              firstName: true,
              lastName: true,
              firstNameAr: true,
              lastNameAr: true,
              user: { select: { id: true } },
            },
          },
        },
      });
      if (!request) return { ok: false as const, error: "notFound" as const };

      const isOwner = user.employeeId === request.employeeId;
      const isManager = user.employeeId === request.managerId;
      const canManage = canManageAll(user);

      if (!isOwner && !canManage && !isManager) {
        return { ok: false as const, error: "forbidden" as const };
      }
      if (request.status === "CANCELLED" || request.status === "REJECTED") {
        return { ok: false as const, error: "notCancellable" as const };
      }
      if (request.status === "APPROVED") {
        const alreadyStarted = request.startDate <= todayOnly;
        if (isOwner && alreadyStarted) {
          return { ok: false as const, error: "notCancellable" as const };
        }
        if (!isOwner && !canManage && alreadyStarted) {
          return { ok: false as const, error: "forbidden" as const };
        }
      }

      const updated = await tx.leaveRequest.updateMany({
        where: { id: request.id, status: request.status },
        data: { status: "CANCELLED" },
      });
      if (updated.count !== 1) {
        return { ok: false as const, error: "conflict" as const };
      }

      if (!isUnlimited(request.leaveType)) {
        await releaseBalance(
          db,
          request,
          request.status === "APPROVED" ? "used" : "pending",
        );
      }

      await writeAudit(
        {
          userId: user.id,
          action: "UPDATE",
          entity: "LeaveRequest",
          entityId: request.id,
          oldData: { status: request.status },
          newData: {
            status: "CANCELLED",
            reason: cleanReason,
            cancelledBy: isOwner ? "EMPLOYEE" : "MANAGER_OR_HR",
          },
        },
        tx,
      );

      return {
        ok: true as const,
        request,
        wasApproved: request.status === "APPROVED",
        isOwner,
      };
      }, TRANSACTION_OPTIONS),
    );

    if (!result.ok) return result;

    const { request } = result;
    try {
      const employeeName = `${request.employee.firstName} ${request.employee.lastName}`;
      const employeeNameAr =
        `${request.employee.firstNameAr ?? request.employee.firstName} ${request.employee.lastNameAr ?? request.employee.lastName}`;

      if (!result.isOwner && request.employee.user) {
        await prisma.notification.create({
          data: {
            userId: request.employee.user.id,
            type: "GENERAL",
            title: "Leave request cancelled",
            titleAr: "تم إلغاء طلب الإجازة",
            message: `Your ${request.leaveType.name} request (${request.requestNo}) was cancelled.${cleanReason ? ` Reason: ${cleanReason}` : ""}`,
            messageAr: `تم إلغاء طلب ${request.leaveType.nameAr} (${request.requestNo}).${cleanReason ? ` السبب: ${cleanReason}` : ""}`,
            link: "/leave",
          },
        });
      } else if (request.managerId) {
        const manager = await prisma.employee.findUnique({
          where: { id: request.managerId },
          select: { user: { select: { id: true } } },
        });
        if (manager?.user) {
          await prisma.notification.create({
            data: {
              userId: manager.user.id,
              type: "GENERAL",
              title: "Leave request cancelled",
              titleAr: "تم إلغاء طلب إجازة",
              message: `${employeeName} cancelled ${request.requestNo}.${cleanReason ? ` Reason: ${cleanReason}` : ""}`,
              messageAr: `ألغى ${employeeNameAr} الطلب ${request.requestNo}.${cleanReason ? ` السبب: ${cleanReason}` : ""}`,
              link: "/leave",
            },
          });
        }
      }

    } catch (error) {
      console.error("Failed to send leave cancellation notifications", error);
    }

    revalidatePath(`/${locale}/leave`);
    return { ok: true };
  } catch (error) {
    if (isRetryable(error)) return { ok: false, error: "conflict" };
    console.error("Failed to cancel leave request", error);
    return { ok: false, error: "validation" };
  }
}

export async function adjustLeaveBalanceAction(
  locale: string,
  input: unknown,
): Promise<LeaveBalanceResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "leave.manage_balance")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = balanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  const [employee, leaveType] = await Promise.all([
    prisma.employee.findFirst({
      where: { id: data.employeeId, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.leaveType.findFirst({
      where: { id: data.leaveTypeId, isActive: true },
      select: { id: true, code: true, name: true },
    }),
  ]);
  if (!employee || !leaveType) return { ok: false, error: "notFound" };

  try {
    await serializableWithConnection(() =>
      prisma.$transaction(async (tx) => {
      const existing = await tx.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: employee.id,
            leaveTypeId: leaveType.id,
            year: data.year,
          },
        },
      });
      const currentUsed = Number(existing?.usedDays ?? 0);
      const currentPending = Number(existing?.pendingDays ?? 0);
      const nextUsed = Math.max(0, currentUsed + data.usedAdjustment);
      const total = data.entitledDays + data.carriedDays;
      if (nextUsed + currentPending > total) {
        throw new BalanceError();
      }

      await tx.leaveBalance.upsert({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: employee.id,
            leaveTypeId: leaveType.id,
            year: data.year,
          },
        },
        create: {
          employeeId: employee.id,
          leaveTypeId: leaveType.id,
          year: data.year,
          entitledDays: data.entitledDays,
          carriedDays: data.carriedDays,
          usedDays: nextUsed,
        },
        update: {
          entitledDays: data.entitledDays,
          carriedDays: data.carriedDays,
          usedDays: nextUsed,
        },
      });

      await writeAudit(
        {
          userId: user.id,
          action: "UPDATE",
          entity: "LeaveBalance",
          entityId: existing?.id ?? `${employee.id}:${leaveType.id}:${data.year}`,
          oldData: existing
            ? {
                entitledDays: Number(existing.entitledDays),
                carriedDays: Number(existing.carriedDays),
                usedDays: currentUsed,
                pendingDays: currentPending,
              }
            : null,
          newData: {
            employeeId: employee.id,
            leaveType: leaveType.code,
            year: data.year,
            entitledDays: data.entitledDays,
            carriedDays: data.carriedDays,
            usedDays: nextUsed,
          },
        },
        tx,
      );
      }, TRANSACTION_OPTIONS),
    );

    revalidatePath(`/${locale}/leave`);
    revalidatePath(`/${locale}/employees/${employee.id}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof BalanceError) {
      return { ok: false, error: "balanceExceeded" };
    }
    if (isRetryable(error)) return { ok: false, error: "validation" };
    console.error("Failed to adjust leave balance", error);
    return { ok: false, error: "validation" };
  }
}

class BalanceError extends Error {}
