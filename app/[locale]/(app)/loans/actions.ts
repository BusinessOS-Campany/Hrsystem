"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, hasPermission } from "@/lib/auth/session";
import { writeAudit } from "@/lib/auth/audit";

export type LoanActionResult = {
  ok: boolean;
  error?:
    | "unauthorized"
    | "validation"
    | "notFound"
    | "noEmployee"
    | "invalidDate"
    | "notPending"
    | "pendingExists"
    | "notActive"
    | "alreadyPaid"
    | "selfApproval";
};

const requestSchema = z.object({
  amount: z.coerce.number().positive().max(1_000_000),
  installments: z.coerce.number().int().min(1).max(60),
  startDate: z.string().min(10),
  reason: z.string().trim().min(3).max(500),
});

const reviewSchema = z.object({
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

function dateOnly(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function done(locale: string) {
  revalidatePath(`/${locale}/loans`);
  revalidatePath(`/${locale}/dashboard`);
}

async function notifyEmployee(
  employeeId: string,
  title: string,
  titleAr: string,
  message: string,
  messageAr: string,
) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: true },
  });
  if (!employee?.user) return;
  await prisma.notification.create({
    data: {
      userId: employee.user.id,
      type: "GENERAL",
      title,
      titleAr,
      message,
      messageAr,
      link: "/loans",
    },
  });
}

export async function requestLoanAction(
  locale: string,
  input: unknown,
): Promise<LoanActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "loan.request")) {
    return { ok: false, error: "unauthorized" };
  }
  if (!user.employeeId) return { ok: false, error: "noEmployee" };

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const startDate = dateOnly(parsed.data.startDate);
  if (!startDate) return { ok: false, error: "invalidDate" };

  const pending = await prisma.employeeLoan.findFirst({
    where: { employeeId: user.employeeId, status: "PENDING" },
  });
  if (pending) return { ok: false, error: "pendingExists" };

  const sequence = await prisma.employeeLoan.count();
  const loanNo = `LN-${new Date().getUTCFullYear()}-${String(sequence + 1).padStart(4, "0")}`;
  const installmentAmount = roundMoney(parsed.data.amount / parsed.data.installments);

  const loan = await prisma.employeeLoan.create({
    data: {
      loanNo,
      employeeId: user.employeeId,
      amount: parsed.data.amount,
      balance: parsed.data.amount,
      installments: parsed.data.installments,
      installmentAmount,
      startDate,
      status: "PENDING",
      reason: parsed.data.reason,
    },
  });

  await writeAudit({
    userId: user.id,
    action: "CREATE",
    entity: "EmployeeLoan",
    entityId: loan.id,
    newData: { loanNo, amount: parsed.data.amount, installments: parsed.data.installments },
  });

  done(locale);
  return { ok: true };
}

export async function reviewLoanAction(
  locale: string,
  loanId: string,
  decision: "APPROVED" | "REJECTED",
  input: unknown,
): Promise<LoanActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "loan.approve")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const loan = await prisma.employeeLoan.findUnique({ where: { id: loanId } });
  if (!loan) return { ok: false, error: "notFound" };
  if (user.employeeId && loan.employeeId === user.employeeId) {
    return { ok: false, error: "selfApproval" };
  }
  if (loan.status !== "PENDING") return { ok: false, error: "notPending" };

  if (decision === "REJECTED") {
    await prisma.employeeLoan.update({
      where: { id: loanId },
      data: { status: "REJECTED", approvedById: user.id, approvedAt: new Date() },
    });
    await notifyEmployee(
      loan.employeeId,
      "Loan request rejected",
      "تم رفض طلب السلفة",
      `Your loan request ${loan.loanNo} was rejected.${parsed.data.reason ? ` Reason: ${parsed.data.reason}` : ""}`,
      `تم رفض طلب السلفة ${loan.loanNo}.${parsed.data.reason ? ` السبب: ${parsed.data.reason}` : ""}`,
    );
  } else {
    const base = roundMoney(Number(loan.amount) / loan.installments);
    const installments = Array.from({ length: loan.installments }, (_, index) => {
      const isLast = index === loan.installments - 1;
      const amount = isLast
        ? roundMoney(Number(loan.amount) - base * (loan.installments - 1))
        : base;
      return {
        loanId: loan.id,
        dueDate: addMonths(loan.startDate, index),
        amount,
        status: "PENDING" as const,
      };
    });

    await prisma.$transaction(async (tx) => {
      await tx.employeeLoan.update({
        where: { id: loanId },
        data: { status: "ACTIVE", approvedById: user.id, approvedAt: new Date() },
      });
      await tx.loanInstallment.createMany({ data: installments });
    });

    await notifyEmployee(
      loan.employeeId,
      "Loan approved",
      "تم اعتماد السلفة",
      `Your loan ${loan.loanNo} was approved. Installments: ${loan.installments}.`,
      `تم اعتماد سلفتك ${loan.loanNo}. عدد الأقساط: ${loan.installments}.`,
    );
  }

  await writeAudit({
    userId: user.id,
    action: decision === "APPROVED" ? "APPROVE" : "REJECT",
    entity: "EmployeeLoan",
    entityId: loanId,
    oldData: { status: loan.status },
    newData: { status: decision === "APPROVED" ? "ACTIVE" : "REJECTED" },
  });

  done(locale);
  return { ok: true };
}

export async function payInstallmentAction(
  locale: string,
  installmentId: string,
): Promise<LoanActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "loan.approve")) {
    return { ok: false, error: "unauthorized" };
  }

  const installment = await prisma.loanInstallment.findUnique({
    where: { id: installmentId },
    include: { loan: true },
  });
  if (!installment) return { ok: false, error: "notFound" };
  if (user.employeeId && installment.loan.employeeId === user.employeeId) {
    return { ok: false, error: "selfApproval" };
  }
  if (installment.status === "PAID") return { ok: false, error: "alreadyPaid" };
  if (installment.status !== "PENDING") return { ok: false, error: "notPending" };
  if (installment.loan.status !== "ACTIVE") return { ok: false, error: "notActive" };

  const nextBalance = Math.max(0, roundMoney(Number(installment.loan.balance) - Number(installment.amount)));

  await prisma.$transaction(async (tx) => {
    await tx.loanInstallment.update({
      where: { id: installmentId },
      data: { status: "PAID", paidAmount: installment.amount, paidAt: new Date() },
    });
    await tx.employeeLoan.update({
      where: { id: installment.loanId },
      data: {
        balance: nextBalance,
        status: nextBalance <= 0 ? "COMPLETED" : "ACTIVE",
      },
    });
  });

  await notifyEmployee(
    installment.loan.employeeId,
    "Loan installment paid",
    "تم سداد قسط السلفة",
    `Installment of ${Number(installment.amount).toFixed(2)} for loan ${installment.loan.loanNo} was recorded.`,
    `تم تسجيل سداد قسط بقيمة ${Number(installment.amount).toFixed(2)} للسلفة ${installment.loan.loanNo}.`,
  );

  await writeAudit({
    userId: user.id,
    action: "UPDATE",
    entity: "LoanInstallment",
    entityId: installmentId,
    oldData: { status: installment.status },
    newData: { status: "PAID", loanBalance: nextBalance },
  });

  done(locale);
  return { ok: true };
}
