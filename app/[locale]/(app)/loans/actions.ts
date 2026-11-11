"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
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
    | "selfApproval"
    | "conflict";
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

const TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5_000,
  timeout: 15_000,
} as const;

function isRetryable(error: unknown, retryConnection = false) {
  const code = (error as { code?: string }).code;
  if (code === "P2034") return true;
  return (
    retryConnection &&
    (code === "P1017" ||
      code === "P1001" ||
      code === "P1002" ||
      code === "P2024")
  );
}

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

async function nextLoanNo(db: Prisma.TransactionClient) {
  const prefix = `LN-${new Date().getUTCFullYear()}-`;
  const latest = await db.employeeLoan.findFirst({
    where: { loanNo: { startsWith: prefix } },
    orderBy: { loanNo: "desc" },
    select: { loanNo: true },
  });
  const sequence = Number(latest?.loanNo.slice(prefix.length)) || 0;
  return `${prefix}${String(sequence + 1).padStart(4, "0")}`;
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
    select: { user: { select: { id: true } } },
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

async function notifyApprovers(input: {
  managerId: string | null;
  loanNo: string;
  amount: number;
  excludeUserId?: string | null;
}) {
  let managerUserId: string | null = null;
  if (input.managerId) {
    const manager = await prisma.employee.findUnique({
      where: { id: input.managerId },
      select: { user: { select: { id: true, isActive: true } } },
    });
    managerUserId = manager?.user?.isActive ? manager.user.id : null;
  }

  if (managerUserId && managerUserId !== input.excludeUserId) {
    await prisma.notification.create({
      data: {
        userId: managerUserId,
        type: "APPROVAL_REQUIRED",
        title: "Loan request awaiting review",
        titleAr: "طلب سلفة بانتظار المراجعة",
        message: `Loan ${input.loanNo} for ${input.amount.toFixed(2)} is awaiting your review.`,
        messageAr: `طلب السلفة ${input.loanNo} بقيمة ${input.amount.toFixed(2)} بانتظار مراجعتك.`,
        link: "/loans",
      },
    });
    return;
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
              some: { permission: { code: "loan.approve" } },
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
        title: "Loan request awaiting review",
        titleAr: "طلب سلفة بانتظار المراجعة",
        message: `Loan ${input.loanNo} for ${input.amount.toFixed(2)} is awaiting your review.`,
        messageAr: `طلب السلفة ${input.loanNo} بقيمة ${input.amount.toFixed(2)} بانتظار مراجعتك.`,
        link: "/loans",
      })),
    });
  }
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

  const employee = await prisma.employee.findFirst({
    where: { id: user.employeeId, deletedAt: null },
    select: {
      id: true,
      managerId: true,
      user: { select: { id: true } },
    },
  });
  if (!employee) return { ok: false, error: "noEmployee" };

  const installmentAmount = roundMoney(
    parsed.data.amount / parsed.data.installments,
  );

  try {
    const result = await serializable(() =>
      prisma.$transaction(async (tx) => {
        const db = tx as unknown as Prisma.TransactionClient;
        const pending = await tx.employeeLoan.findFirst({
          where: { employeeId: employee.id, status: "PENDING" },
          select: { id: true },
        });
        if (pending) {
          return { ok: false as const, error: "pendingExists" as const };
        }

        const loanNo = await nextLoanNo(db);
        const loan = await tx.employeeLoan.create({
          data: {
            loanNo,
            employeeId: employee.id,
            amount: parsed.data.amount,
            balance: parsed.data.amount,
            installments: parsed.data.installments,
            installmentAmount,
            startDate,
            status: "PENDING",
            reason: parsed.data.reason,
          },
          select: { id: true, loanNo: true },
        });

        await writeAudit(
          {
            userId: user.id,
            action: "CREATE",
            entity: "EmployeeLoan",
            entityId: loan.id,
            newData: {
              loanNo,
              amount: parsed.data.amount,
              installments: parsed.data.installments,
            },
          },
          tx,
        );

        return { ok: true as const, loan };
      }, TX_OPTIONS),
    );

    if (!result.ok) return result;

    try {
      await notifyApprovers({
        managerId: employee.managerId,
        loanNo: result.loan.loanNo,
        amount: parsed.data.amount,
        excludeUserId: employee.user?.id ?? user.id,
      });
    } catch (error) {
      console.error("Failed to send loan request notification", error);
    }

    done(locale);
    return { ok: true };
  } catch (error) {
    console.error("Failed to create loan request", error);
    return { ok: false, error: "validation" };
  }
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

  try {
    const result = await serializableWithConnection(() =>
      prisma.$transaction(async (tx) => {
        const loan = await tx.employeeLoan.findUnique({
          where: { id: loanId },
          select: {
            id: true,
            loanNo: true,
            employeeId: true,
            amount: true,
            installments: true,
            startDate: true,
            status: true,
          },
        });
        if (!loan) return { ok: false as const, error: "notFound" as const };
        if (user.employeeId && loan.employeeId === user.employeeId) {
          return { ok: false as const, error: "selfApproval" as const };
        }
        if (loan.status !== "PENDING") {
          return { ok: false as const, error: "notPending" as const };
        }

        const updated = await tx.employeeLoan.updateMany({
          where: { id: loan.id, status: "PENDING" },
          data: {
            status: decision === "APPROVED" ? "ACTIVE" : "REJECTED",
            approvedById: user.id,
            approvedAt: new Date(),
          },
        });
        if (updated.count !== 1) {
          return { ok: false as const, error: "conflict" as const };
        }

        if (decision === "APPROVED") {
          const base = roundMoney(Number(loan.amount) / loan.installments);
          const installments = Array.from(
            { length: loan.installments },
            (_, index) => {
              const isLast = index === loan.installments - 1;
              const amount = isLast
                ? roundMoney(
                    Number(loan.amount) - base * (loan.installments - 1),
                  )
                : base;
              return {
                loanId: loan.id,
                dueDate: addMonths(loan.startDate, index),
                amount,
                status: "PENDING" as const,
              };
            },
          );
          await tx.loanInstallment.createMany({ data: installments });
        }

        await writeAudit(
          {
            userId: user.id,
            action: decision === "APPROVED" ? "APPROVE" : "REJECT",
            entity: "EmployeeLoan",
            entityId: loan.id,
            oldData: { status: loan.status },
            newData: {
              status: decision === "APPROVED" ? "ACTIVE" : "REJECTED",
              comment: parsed.data.reason || null,
            },
          },
          tx,
        );

        return {
          ok: true as const,
          loan,
          decision,
          comment: parsed.data.reason || null,
        };
      }, TX_OPTIONS),
    );

    if (!result.ok) return result;

    try {
      if (result.decision === "REJECTED") {
        await notifyEmployee(
          result.loan.employeeId,
          "Loan request rejected",
          "تم رفض طلب السلفة",
          `Your loan request ${result.loan.loanNo} was rejected.${result.comment ? ` Reason: ${result.comment}` : ""}`,
          `تم رفض طلب السلفة ${result.loan.loanNo}.${result.comment ? ` السبب: ${result.comment}` : ""}`,
        );
      } else {
        await notifyEmployee(
          result.loan.employeeId,
          "Loan approved",
          "تم اعتماد السلفة",
          `Your loan ${result.loan.loanNo} was approved. Installments: ${result.loan.installments}.`,
          `تم اعتماد سلفتك ${result.loan.loanNo}. عدد الأقساط: ${result.loan.installments}.`,
        );
      }
    } catch (error) {
      console.error("Failed to send loan review notification", error);
    }

    done(locale);
    return { ok: true };
  } catch (error) {
    console.error("Failed to review loan", error);
    return { ok: false, error: "validation" };
  }
}

export async function payInstallmentAction(
  locale: string,
  installmentId: string,
): Promise<LoanActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "loan.approve")) {
    return { ok: false, error: "unauthorized" };
  }

  try {
    const result = await serializableWithConnection(() =>
      prisma.$transaction(async (tx) => {
        const installment = await tx.loanInstallment.findUnique({
          where: { id: installmentId },
          select: {
            id: true,
            status: true,
            amount: true,
            loan: {
              select: {
                id: true,
                loanNo: true,
                employeeId: true,
                balance: true,
                status: true,
              },
            },
          },
        });
        if (!installment) {
          return { ok: false as const, error: "notFound" as const };
        }
        if (user.employeeId && installment.loan.employeeId === user.employeeId) {
          return { ok: false as const, error: "selfApproval" as const };
        }
        if (installment.status === "PAID") {
          return { ok: false as const, error: "alreadyPaid" as const };
        }
        if (installment.status !== "PENDING") {
          return { ok: false as const, error: "notPending" as const };
        }
        if (installment.loan.status !== "ACTIVE") {
          return { ok: false as const, error: "notActive" as const };
        }

        const nextBalance = Math.max(
          0,
          roundMoney(
            Number(installment.loan.balance) - Number(installment.amount),
          ),
        );

        const paid = await tx.loanInstallment.updateMany({
          where: { id: installment.id, status: "PENDING" },
          data: {
            status: "PAID",
            paidAmount: installment.amount,
            paidAt: new Date(),
          },
        });
        if (paid.count !== 1) {
          return { ok: false as const, error: "conflict" as const };
        }

        await tx.employeeLoan.update({
          where: { id: installment.loan.id },
          data: {
            balance: nextBalance,
            status: nextBalance <= 0 ? "COMPLETED" : "ACTIVE",
          },
        });

        await writeAudit(
          {
            userId: user.id,
            action: "UPDATE",
            entity: "LoanInstallment",
            entityId: installment.id,
            oldData: { status: installment.status },
            newData: { status: "PAID", loanBalance: nextBalance },
          },
          tx,
        );

        return { ok: true as const, loan: installment.loan, nextBalance };
      }, TX_OPTIONS),
    );

    if (!result.ok) return result;

    try {
      await notifyEmployee(
        result.loan.employeeId,
        "Loan installment paid",
        "تم سداد قسط السلفة",
        `An installment for loan ${result.loan.loanNo} was recorded. Remaining balance: ${result.nextBalance.toFixed(2)}.`,
        `تم تسجيل سداد قسط للسلفة ${result.loan.loanNo}. الرصيد المتبقي: ${result.nextBalance.toFixed(2)}.`,
      );
    } catch (error) {
      console.error("Failed to send loan installment notification", error);
    }

    done(locale);
    return { ok: true };
  } catch (error) {
    console.error("Failed to record loan installment", error);
    return { ok: false, error: "validation" };
  }
}
