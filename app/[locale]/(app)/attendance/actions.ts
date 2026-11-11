"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, hasPermission } from "@/lib/auth/session";
import { writeAudit } from "@/lib/auth/audit";

export type AttendanceActionResult = {
  ok: boolean;
  error?:
    | "unauthorized"
    | "noEmployee"
    | "alreadyCheckedIn"
    | "notCheckedIn"
    | "alreadyCheckedOut"
    | "invalid"
    | "duplicate"
    | "notFound"
    | "forbidden"
    | "commentRequired"
    | "conflict";
};

const correctionSchema = z.object({
  date: z.string().min(10).max(10),
  checkIn: z.string().max(5).optional(),
  checkOut: z.string().max(5).optional(),
  reason: z.string().trim().min(3).max(500),
});

function todayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function yemenMinutes(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Aden",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function combineYemen(date: Date, time: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return null;
  const dateKey = date.toISOString().slice(0, 10);
  const combined = new Date(`${dateKey}T${time}:00+03:00`);
  return Number.isNaN(combined.getTime()) ? null : combined;
}

function recalculate(
  checkIn: Date | null,
  checkOut: Date | null,
  schedule: { startTime: string; endTime: string; graceMinutes: number } | null,
) {
  const [startHour, startMinute] = (schedule?.startTime ?? "08:00").split(":").map(Number);
  const [endHour, endMinute] = (schedule?.endTime ?? "17:00").split(":").map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;
  const inMinutes = checkIn ? yemenMinutes(checkIn) : null;
  const outMinutes = checkOut ? yemenMinutes(checkOut) : null;
  const lateMinutes =
    inMinutes === null
      ? 0
      : Math.max(0, inMinutes - startMinutes - (schedule?.graceMinutes ?? 10));
  const earlyLeaveMinutes =
    outMinutes === null ? 0 : Math.max(0, endMinutes - outMinutes);
  const overtimeMinutes = outMinutes === null ? 0 : Math.max(0, outMinutes - endMinutes);
  const workedMinutes =
    checkIn && checkOut
      ? Math.max(0, Math.round((checkOut.getTime() - checkIn.getTime()) / 60_000))
      : 0;
  const status: "LATE" | "PRESENT" | "ABSENT" = checkIn
    ? lateMinutes > 0
      ? "LATE"
      : "PRESENT"
    : "ABSENT";
  return { lateMinutes, earlyLeaveMinutes, overtimeMinutes, workedMinutes, status };
}

async function notifyCorrectionReviewer(input: {
  employeeId: string;
  managerId: string | null;
  excludeUserId?: string | null;
  dateLabel: string;
}) {
  if (input.managerId) {
    const manager = await prisma.employee.findUnique({
      where: { id: input.managerId },
      select: { user: { select: { id: true, isActive: true } } },
    });
    if (
      manager?.user?.isActive &&
      manager.user.id !== input.excludeUserId
    ) {
      await prisma.notification.create({
        data: {
          userId: manager.user.id,
          type: "APPROVAL_REQUIRED",
          title: "Attendance correction required",
          titleAr: "مطلوب اعتماد تصحيح حضور",
          message: `An attendance correction for ${input.dateLabel} is awaiting review.`,
          messageAr: `تصحيح حضور بتاريخ ${input.dateLabel} بانتظار المراجعة.`,
          link: "/attendance",
        },
      });
      return;
    }
  }

  const approvers = await prisma.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      ...(input.excludeUserId ? { id: { not: input.excludeUserId } } : {}),
      roles: {
        some: {
          role: {
            permissions: {
              some: { permission: { code: "attendance.approve" } },
            },
          },
        },
      },
    },
    select: { id: true },
  });
  if (approvers.length > 0) {
    await prisma.notification.createMany({
      data: approvers.map((user) => ({
        userId: user.id,
        type: "APPROVAL_REQUIRED" as const,
        title: "Attendance correction required",
        titleAr: "مطلوب اعتماد تصحيح حضور",
        message: `An attendance correction for ${input.dateLabel} is awaiting review.`,
        messageAr: `تصحيح حضور بتاريخ ${input.dateLabel} بانتظار المراجعة.`,
        link: "/attendance",
      })),
    });
  }
}

export async function checkInAction(locale: string): Promise<AttendanceActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "attendance.self")) return { ok: false, error: "unauthorized" };
  if (!user.employeeId) return { ok: false, error: "noEmployee" };

  const date = todayUtc();
  const existing = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId: user.employeeId, date } },
  });
  if (existing?.checkIn) return { ok: false, error: "alreadyCheckedIn" };

  const schedule = await prisma.workSchedule.findFirst({
    where: { isDefault: true, isActive: true },
  });
  const now = new Date();
  const currentMinutes = yemenMinutes(now);
  const [startHour, startMinute] = (schedule?.startTime ?? "08:00").split(":").map(Number);
  const grace = schedule?.graceMinutes ?? 10;
  const startMinutes = startHour * 60 + startMinute;
  const lateMinutes = Math.max(0, currentMinutes - startMinutes - grace);
  const status = lateMinutes > 0 ? "LATE" : "PRESENT";

  if (existing) {
    await prisma.attendance.update({
      where: { id: existing.id },
      data: { checkIn: now, status, lateMinutes, source: "WEB" },
    });
  } else {
    await prisma.attendance.create({
      data: {
        employeeId: user.employeeId,
        date,
        scheduleId: schedule?.id ?? null,
        checkIn: now,
        status,
        lateMinutes,
        source: "WEB",
      },
    });
  }

  await writeAudit({
    userId: user.id,
    action: "UPDATE",
    entity: "Attendance",
    entityId: user.employeeId,
    newData: { date: date.toISOString(), checkIn: now.toISOString(), status },
  });

  revalidatePath(`/${locale}/attendance`);
  return { ok: true };
}

export async function checkOutAction(locale: string): Promise<AttendanceActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "attendance.self")) return { ok: false, error: "unauthorized" };
  if (!user.employeeId) return { ok: false, error: "noEmployee" };

  const date = todayUtc();
  const record = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId: user.employeeId, date } },
  });
  if (!record?.checkIn) return { ok: false, error: "notCheckedIn" };
  if (record.checkOut) return { ok: false, error: "alreadyCheckedOut" };

  const now = new Date();
  const schedule = record.scheduleId
    ? await prisma.workSchedule.findUnique({ where: { id: record.scheduleId } })
    : null;
  const calculated = recalculate(record.checkIn, now, schedule);

  await prisma.attendance.update({
    where: { id: record.id },
    data: {
      checkOut: now,
      workedMinutes: calculated.workedMinutes,
      overtimeMinutes: calculated.overtimeMinutes,
      earlyLeaveMinutes: calculated.earlyLeaveMinutes,
      source: "WEB",
    },
  });

  await writeAudit({
    userId: user.id,
    action: "UPDATE",
    entity: "Attendance",
    entityId: user.employeeId,
    newData: {
      date: date.toISOString(),
      checkOut: now.toISOString(),
      workedMinutes: calculated.workedMinutes,
    },
  });

  revalidatePath(`/${locale}/attendance`);
  return { ok: true };
}

export async function requestCorrectionAction(
  locale: string,
  input: unknown,
): Promise<AttendanceActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "attendance.self")) {
    return { ok: false, error: "unauthorized" };
  }
  if (!user.employeeId) return { ok: false, error: "noEmployee" };

  const parsed = correctionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const date = parseDateKey(parsed.data.date);
  if (!date) return { ok: false, error: "invalid" };
  const today = todayUtc();
  if (date > today) return { ok: false, error: "invalid" };

  const checkInTime = parsed.data.checkIn?.trim() || null;
  const checkOutTime = parsed.data.checkOut?.trim() || null;
  if (!checkInTime && !checkOutTime) return { ok: false, error: "invalid" };
  const checkIn = checkInTime ? combineYemen(date, checkInTime) : null;
  const checkOut = checkOutTime ? combineYemen(date, checkOutTime) : null;
  if (
    (checkInTime && !checkIn) ||
    (checkOutTime && !checkOut) ||
    (checkIn && checkOut && checkOut <= checkIn)
  ) {
    return { ok: false, error: "invalid" };
  }

  const employee = await prisma.employee.findFirst({
    where: { id: user.employeeId, deletedAt: null },
    select: {
      id: true,
      hireDate: true,
      managerId: true,
      user: { select: { id: true } },
    },
  });
  if (!employee) return { ok: false, error: "noEmployee" };
  if (date < employee.hireDate) return { ok: false, error: "invalid" };

  const duplicate = await prisma.attendanceCorrection.findFirst({
    where: {
      employeeId: employee.id,
      date,
      status: "PENDING",
    },
    select: { id: true },
  });
  if (duplicate) return { ok: false, error: "duplicate" };

  try {
    await prisma.$transaction(async (tx) => {
      const attendance = await tx.attendance.findUnique({
        where: { employeeId_date: { employeeId: employee.id, date } },
        select: { id: true },
      });
      const row = await tx.attendanceCorrection.create({
        data: {
          employeeId: employee.id,
          attendanceId: attendance?.id ?? null,
          date,
          requestedCheckIn: checkIn,
          requestedCheckOut: checkOut,
          reason: parsed.data.reason,
        },
        select: { id: true },
      });
      await writeAudit(
        {
          userId: user.id,
          action: "CREATE",
          entity: "AttendanceCorrection",
          entityId: row.id,
          newData: {
            date: parsed.data.date,
            checkIn: checkIn?.toISOString() ?? null,
            checkOut: checkOut?.toISOString() ?? null,
          },
        },
        tx,
      );
      return row;
    });

    try {
      await notifyCorrectionReviewer({
        employeeId: employee.id,
        managerId: employee.managerId,
        excludeUserId: employee.user?.id ?? user.id,
        dateLabel: parsed.data.date,
      });
    } catch (error) {
      console.error("Failed to send attendance correction notification", error);
    }

    revalidatePath(`/${locale}/attendance`);
    return { ok: true };
  } catch (error) {
    console.error("Failed to request attendance correction", error);
    return { ok: false, error: "invalid" };
  }
}

export async function reviewCorrectionAction(
  locale: string,
  correctionId: string,
  decision: "APPROVED" | "REJECTED",
  comment?: string,
): Promise<AttendanceActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "attendance.approve")) {
    return { ok: false, error: "unauthorized" };
  }

  const cleanComment = comment?.trim() || null;
  if (decision === "REJECTED" && (!cleanComment || cleanComment.length < 3)) {
    return { ok: false, error: "commentRequired" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const correction = await tx.attendanceCorrection.findUnique({
        where: { id: correctionId },
        select: {
          id: true,
          employeeId: true,
          date: true,
          requestedCheckIn: true,
          requestedCheckOut: true,
          status: true,
          employee: {
            select: {
              managerId: true,
              firstName: true,
              lastName: true,
              firstNameAr: true,
              lastNameAr: true,
              user: { select: { id: true } },
            },
          },
        },
      });
      if (!correction) return { ok: false as const, error: "notFound" as const };
      if (correction.status !== "PENDING") {
        return { ok: false as const, error: "conflict" as const };
      }
      if (correction.employeeId === user.employeeId) {
        return { ok: false as const, error: "forbidden" as const };
      }
      const canViewAll = hasPermission(user, "attendance.view_all");
      if (!canViewAll && correction.employee.managerId !== user.employeeId) {
        return { ok: false as const, error: "forbidden" as const };
      }

      const updated = await tx.attendanceCorrection.updateMany({
        where: { id: correction.id, status: "PENDING" },
        data: {
          status: decision,
          reviewedById: user.id,
          reviewedAt: new Date(),
          reviewComment: cleanComment,
        },
      });
      if (updated.count !== 1) {
        return { ok: false as const, error: "conflict" as const };
      }

      if (decision === "APPROVED") {
        const existing = await tx.attendance.findUnique({
          where: {
            employeeId_date: {
              employeeId: correction.employeeId,
              date: correction.date,
            },
          },
        });
        const scheduleId = existing?.scheduleId ?? null;
        const schedule = scheduleId
          ? await tx.workSchedule.findUnique({
              where: { id: scheduleId },
              select: { id: true, startTime: true, endTime: true, graceMinutes: true },
            })
          : await tx.workSchedule.findFirst({
              where: { isDefault: true, isActive: true },
              select: { id: true, startTime: true, endTime: true, graceMinutes: true },
            });
        const checkIn = correction.requestedCheckIn ?? existing?.checkIn ?? null;
        const checkOut = correction.requestedCheckOut ?? existing?.checkOut ?? null;
        const calculated = recalculate(checkIn, checkOut, schedule);

        await tx.attendance.upsert({
          where: {
            employeeId_date: {
              employeeId: correction.employeeId,
              date: correction.date,
            },
          },
          update: {
            checkIn: correction.requestedCheckIn ?? undefined,
            checkOut: correction.requestedCheckOut ?? undefined,
            scheduleId: schedule?.id ?? scheduleId,
            source: "CORRECTION",
            ...calculated,
          },
          create: {
            employeeId: correction.employeeId,
            date: correction.date,
            scheduleId: schedule?.id ?? null,
            checkIn,
            checkOut,
            source: "CORRECTION",
            ...calculated,
          },
        });
      }

      await writeAudit(
        {
          userId: user.id,
          action: decision === "APPROVED" ? "APPROVE" : "REJECT",
          entity: "AttendanceCorrection",
          entityId: correction.id,
          oldData: { status: correction.status },
          newData: { status: decision, comment: cleanComment },
        },
        tx,
      );

      return { ok: true as const, correction };
    });

    if (!result.ok) return result;

    try {
      if (result.correction.employee.user) {
        await prisma.notification.create({
          data: {
            userId: result.correction.employee.user.id,
            type: "GENERAL",
            title:
              decision === "APPROVED"
                ? "Attendance correction approved"
                : "Attendance correction rejected",
            titleAr:
              decision === "APPROVED"
                ? "تم اعتماد تصحيح الحضور"
                : "تم رفض تصحيح الحضور",
            message: `Your correction request for ${result.correction.date.toISOString().slice(0, 10)} was ${decision === "APPROVED" ? "approved" : "rejected"}.${decision === "REJECTED" && cleanComment ? ` Reason: ${cleanComment}` : ""}`,
            messageAr: `تم ${decision === "APPROVED" ? "اعتماد" : "رفض"} طلب تصحيح الحضور ليوم ${result.correction.date.toISOString().slice(0, 10)}.${decision === "REJECTED" && cleanComment ? ` السبب: ${cleanComment}` : ""}`,
            link: "/attendance",
          },
        });
      }
    } catch (error) {
      console.error("Failed to send attendance review notification", error);
    }

    revalidatePath(`/${locale}/attendance`);
    return { ok: true };
  } catch (error) {
    console.error("Failed to review attendance correction", error);
    return { ok: false, error: "invalid" };
  }
}
