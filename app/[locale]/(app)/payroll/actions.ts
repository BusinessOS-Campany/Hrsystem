"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, hasPermission } from "@/lib/auth/session";
import { writeAudit } from "@/lib/auth/audit";

export type PayrollActionResult = {
  ok: boolean;
  error?: "unauthorized" | "notFound" | "invalidStatus";
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export async function finalizeRunAction(
  locale: string,
  runId: string,
): Promise<PayrollActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "payroll.finalize")) {
    return { ok: false, error: "unauthorized" };
  }

  const run = await prisma.payrollRun.findUnique({
    where: { id: runId },
    include: { period: true, items: { include: { employee: { include: { user: true } } } } },
  });
  if (!run) return { ok: false, error: "notFound" };
  if (run.status !== "APPROVED") return { ok: false, error: "invalidStatus" };

  await prisma.$transaction(async (tx) => {
    await tx.payrollRun.update({
      where: { id: runId },
      data: { status: "FINALIZED", finalizedAt: new Date() },
    });
    await tx.payrollPeriod.update({
      where: { id: run.periodId },
      data: { status: "CLOSED" },
    });
  });

  const recipients = run.items
    .map((item) => item.employee.user)
    .filter((employeeUser): employeeUser is NonNullable<typeof employeeUser> =>
      Boolean(employeeUser),
    );

  if (recipients.length > 0) {
    await prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        userId: recipient.id,
        type: "PAYROLL_FINALIZED" as const,
        title: "Payslip available",
        titleAr: "كشف الراتب متاح",
        message: `Your payslip for ${run.period.name} is now available.`,
        messageAr: `كشف راتبك لشهر ${run.period.name} أصبح متاحًا.`,
        link: "/payroll",
      })),
    });
  }

  await writeAudit({
    userId: user.id,
    action: "FINALIZE",
    entity: "PayrollRun",
    entityId: runId,
    oldData: { status: run.status },
    newData: { status: "FINALIZED" },
  });

  revalidatePath(`/${locale}/payroll`);
  revalidatePath(`/${locale}/payroll/${runId}`);
  return { ok: true };
}

export async function finalizeRunFormAction(
  locale: string,
  runId: string,
): Promise<void> {
  await finalizeRunAction(locale, runId);
}

export async function approveRunAction(
  locale: string,
  runId: string,
): Promise<PayrollActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "payroll.approve")) {
    return { ok: false, error: "unauthorized" };
  }
  const run = await prisma.payrollRun.findUnique({ where: { id: runId } });
  if (!run) return { ok: false, error: "notFound" };
  if (!["CALCULATED", "REVIEW"].includes(run.status)) {
    return { ok: false, error: "invalidStatus" };
  }

  await prisma.payrollRun.update({
    where: { id: runId },
    data: { status: "APPROVED", approvedAt: new Date(), approvedById: user.id },
  });

  await writeAudit({
    userId: user.id,
    action: "APPROVE",
    entity: "PayrollRun",
    entityId: runId,
    oldData: { status: run.status },
    newData: { status: "APPROVED" },
  });

  revalidatePath(`/${locale}/payroll`);
  revalidatePath(`/${locale}/payroll/${runId}`);
  return { ok: true };
}

export async function createRunAction(
  locale: string,
  periodId: string,
): Promise<PayrollActionResult & { runId?: string }> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "payroll.create")) {
    return { ok: false, error: "unauthorized" };
  }

  const period = await prisma.payrollPeriod.findUnique({ where: { id: periodId } });
  if (!period) return { ok: false, error: "notFound" };
  if (period.status !== "OPEN") return { ok: false, error: "invalidStatus" };

  const existing = await prisma.payrollRun.findFirst({ where: { periodId } });
  if (existing) return { ok: false, error: "invalidStatus" };

  const [employees, statutoryDeductions] = await Promise.all([
    prisma.employee.findMany({
      where: {
        deletedAt: null,
        status: { in: ["ACTIVE", "PROBATION", "ON_LEAVE"] },
      },
      include: {
        employments: { where: { isCurrent: true }, take: 1 },
        salaries: {
          where: {
            effectiveFrom: { lte: new Date() },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
          },
          include: { component: true },
        },
      },
      orderBy: { employeeNo: "asc" },
    }),
    prisma.salaryComponent.findMany({
      where: {
        companyId: period.companyId,
        isActive: true,
        isStatutory: true,
        type: "DEDUCTION",
        calculationType: "PERCENTAGE",
      },
    }),
  ]);

  const rows = employees
    .filter((employee) => employee.employments[0])
    .map((employee) => {
      const employment = employee.employments[0];
      const basic = Number(employment.basicSalary);
      const earnings = employee.salaries
        .filter(
          (salary) =>
            salary.component.type === "EARNING" &&
            salary.component.code !== "BASIC",
        )
        .map((salary) => ({
          code: salary.component.code,
          name: salary.component.name,
          nameAr: salary.component.nameAr,
          amount: Number(salary.amount),
        }));
      const assignedDeductions = employee.salaries
        .filter((salary) => salary.component.type === "DEDUCTION")
        .map((salary) => ({
          code: salary.component.code,
          name: salary.component.name,
          nameAr: salary.component.nameAr,
          amount: Number(salary.amount),
        }));
      const gross = basic + earnings.reduce((sum, item) => sum + item.amount, 0);
      const assignedComponentIds = new Set(
        employee.salaries.map((salary) => salary.componentId),
      );
      const statutory = statutoryDeductions
        .filter(
          (component) =>
            !assignedComponentIds.has(component.id) && component.percentage !== null,
        )
        .map((component) => ({
          code: component.code,
          name: component.name,
          nameAr: component.nameAr,
          amount: round2(gross * (Number(component.percentage) / 100)),
        }));
      const deductions = [...assignedDeductions, ...statutory];
      const totalDeductions = round2(
        deductions.reduce((sum, item) => sum + item.amount, 0),
      );
      return {
        employeeId: employee.id,
        basicSalary: basic,
        grossSalary: gross,
        totalDeductions,
        netSalary: gross - totalDeductions,
        currency: employment.currency,
        breakdown: { basic, earnings, deductions },
      };
    });

  const runNo = `PR-${period.year}${String(period.month).padStart(2, "0")}-${String(
    (await prisma.payrollRun.count({ where: { periodId } })) + 1,
  ).padStart(2, "0")}`;

  const run = await prisma.payrollRun.create({
    data: {
      periodId,
      runNo,
      status: "REVIEW",
      calculatedAt: new Date(),
      totalGross: rows.reduce((sum, row) => sum + row.grossSalary, 0),
      totalDeductions: rows.reduce((sum, row) => sum + row.totalDeductions, 0),
      totalNet: rows.reduce((sum, row) => sum + row.netSalary, 0),
      employeeCount: rows.length,
      items: {
        create: rows.map((row) => ({
          employeeId: row.employeeId,
          basicSalary: row.basicSalary,
          grossSalary: row.grossSalary,
          totalDeductions: row.totalDeductions,
          netSalary: row.netSalary,
          currency: row.currency,
          breakdown: row.breakdown,
        })),
      },
    },
  });

  await writeAudit({
    userId: user.id,
    action: "CALCULATE",
    entity: "PayrollRun",
    entityId: run.id,
    newData: { runNo, employeeCount: rows.length, totalNet: run.totalNet.toString() },
  });

  revalidatePath(`/${locale}/payroll`);
  return { ok: true, runId: run.id };
}

export async function approveRunFormAction(
  locale: string,
  runId: string,
): Promise<void> {
  await approveRunAction(locale, runId);
}
