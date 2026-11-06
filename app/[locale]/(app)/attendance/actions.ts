"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, hasPermission } from "@/lib/auth/session";
import { writeAudit } from "@/lib/auth/audit";

export type AttendanceActionResult = {
  ok: boolean;
  error?: "unauthorized" | "noEmployee" | "alreadyCheckedIn" | "notCheckedIn" | "alreadyCheckedOut";
};

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
  const workedMinutes = Math.max(
    0,
    Math.round((now.getTime() - record.checkIn.getTime()) / 60_000),
  );
  const schedule = record.scheduleId
    ? await prisma.workSchedule.findUnique({ where: { id: record.scheduleId } })
    : null;
  const [endHour, endMinute] = (schedule?.endTime ?? "17:00").split(":").map(Number);
  const endMinutes = endHour * 60 + endMinute;
  const currentMinutes = yemenMinutes(now);
  const overtimeMinutes = Math.max(0, currentMinutes - endMinutes);

  await prisma.attendance.update({
    where: { id: record.id },
    data: { checkOut: now, workedMinutes, overtimeMinutes, source: "WEB" },
  });

  await writeAudit({
    userId: user.id,
    action: "UPDATE",
    entity: "Attendance",
    entityId: user.employeeId,
    newData: { date: date.toISOString(), checkOut: now.toISOString(), workedMinutes },
  });

  revalidatePath(`/${locale}/attendance`);
  return { ok: true };
}

export async function reviewCorrectionAction(
  locale: string,
  correctionId: string,
  decision: "APPROVED" | "REJECTED",
): Promise<AttendanceActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "attendance.approve")) {
    return { ok: false, error: "unauthorized" };
  }

  const correction = await prisma.attendanceCorrection.findUnique({
    where: { id: correctionId },
  });
  if (!correction) return { ok: false, error: "notCheckedIn" };

  await prisma.$transaction(async (tx) => {
    await tx.attendanceCorrection.update({
      where: { id: correctionId },
      data: {
        status: decision,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });
    if (decision === "APPROVED") {
      await tx.attendance.upsert({
        where: { employeeId_date: { employeeId: correction.employeeId, date: correction.date } },
        update: {
          checkIn: correction.requestedCheckIn ?? undefined,
          checkOut: correction.requestedCheckOut ?? undefined,
          source: "CORRECTION",
        },
        create: {
          employeeId: correction.employeeId,
          date: correction.date,
          checkIn: correction.requestedCheckIn,
          checkOut: correction.requestedCheckOut,
          source: "CORRECTION",
        },
      });
    }
  });

  await writeAudit({
    userId: user.id,
    action: decision === "APPROVED" ? "APPROVE" : "REJECT",
    entity: "AttendanceCorrection",
    entityId: correctionId,
    newData: { status: decision },
  });

  revalidatePath(`/${locale}/attendance`);
  return { ok: true };
}

export async function reviewCorrectionFormAction(
  locale: string,
  correctionId: string,
  decision: "APPROVED" | "REJECTED",
): Promise<void> {
  await reviewCorrectionAction(locale, correctionId, decision);
}
