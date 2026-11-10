"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, hasPermission } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { writeAudit } from "@/lib/auth/audit";
import { employeeFormSchema } from "@/lib/validations/employee";

export type EmployeeActionResult = {
  ok: boolean;
  error?:
    | "unauthorized"
    | "validation"
    | "duplicateEmail"
    | "duplicateNationalId"
    | "notFound"
    | "invalidOrg"
    | "roleForbidden";
  employeeId?: string;
  tempPassword?: string;
};

export type EmployeeStatusResult = {
  ok: boolean;
  error?:
    | "unauthorized"
    | "notFound"
    | "self"
    | "alreadySuspended"
    | "finalized"
    | "notSuspended";
};

function dateOnly(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function temporaryPassword() {
  return `Hrsys@${randomBytes(4).toString("hex")}!`;
}

async function nextEmployeeNo() {
  const latest = await prisma.employee.findFirst({
    orderBy: { employeeNo: "desc" },
    select: { employeeNo: true },
  });
  const numeric = latest?.employeeNo.match(/(\d+)$/)?.[1];
  const next = numeric ? Number(numeric) + 1 : 1;
  return `EMP-${String(next).padStart(4, "0")}`;
}

async function uniqueUsername(email: string) {
  const base = email
    .split("@")[0]
    .toLowerCase()
    .replaceAll(/[^a-z0-9._-]/g, "")
    .slice(0, 24);
  let username = base || "user";
  let suffix = 1;
  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${base}${suffix}`;
    suffix += 1;
  }
  return username;
}

export async function createEmployeeAction(
  locale: string,
  input: unknown,
): Promise<EmployeeActionResult> {
  const actor = await getCurrentUser();
  if (!actor || !hasPermission(actor, "employee.create")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = employeeFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  if (data.createAccount && data.roleCode && data.roleCode !== "EMPLOYEE") {
    if (!hasPermission(actor, "user.manage")) return { ok: false, error: "roleForbidden" };
  }

  const [company, branch, department, position] = await Promise.all([
    prisma.company.findFirst({ where: { isActive: true } }),
    prisma.branch.findFirst({ where: { id: data.branchId, isActive: true } }),
    prisma.department.findFirst({
      where: { id: data.departmentId, deletedAt: null },
    }),
    prisma.position.findFirst({
      where: { id: data.positionId, deletedAt: null },
    }),
  ]);
  if (
    !company ||
    !branch ||
    !department ||
    !position ||
    position.departmentId !== data.departmentId
  ) {
    return { ok: false, error: "invalidOrg" };
  }

  const email = data.email.toLowerCase();
  if (await prisma.employee.findUnique({ where: { email } })) {
    return { ok: false, error: "duplicateEmail" };
  }
  if (
    data.nationalId &&
    (await prisma.employee.findUnique({ where: { nationalId: data.nationalId } }))
  ) {
    return { ok: false, error: "duplicateNationalId" };
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    return { ok: false, error: "duplicateEmail" };
  }

  const employeeNo = await nextEmployeeNo();
  const hireDate = dateOnly(data.hireDate);
  if (!hireDate) return { ok: false, error: "validation" };

  const tempPassword = data.createAccount ? temporaryPassword() : undefined;
  const passwordHash = tempPassword ? await hashPassword(tempPassword) : null;
  const username = data.createAccount ? await uniqueUsername(email) : null;
  const role = data.createAccount
    ? await prisma.role.findUnique({ where: { code: data.roleCode ?? "EMPLOYEE" } })
    : null;

  try {
    const employee = await prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          employeeNo,
          firstName: data.firstName,
          lastName: data.lastName,
          firstNameAr: data.firstNameAr || null,
          lastNameAr: data.lastNameAr || null,
          gender: data.gender,
          dateOfBirth: dateOnly(data.dateOfBirth),
          nationality: data.nationality || null,
          nationalId: data.nationalId || null,
          maritalStatus: data.maritalStatus,
          phone: data.phone || null,
          email,
          address: data.address || null,
          city: data.city || null,
          country: data.country || company.country,
          emergencyName: data.emergencyName || null,
          emergencyPhone: data.emergencyPhone || null,
          emergencyRelation: data.emergencyRelation || null,
          status: "ACTIVE",
          hireDate,
          managerId: data.managerId || null,
        },
      });

      await tx.employment.create({
        data: {
          employeeId: created.id,
          companyId: company.id,
          branchId: branch.id,
          departmentId: department.id,
          positionId: position.id,
          managerId: data.managerId || null,
          employmentType: data.employmentType,
          status: "ACTIVE",
          hireDate,
          contractStart: hireDate,
          basicSalary: data.basicSalary,
          currency: company.currency,
          isCurrent: true,
        },
      });

      if (data.createAccount && passwordHash && username && role) {
        await tx.user.create({
          data: {
            email,
            username,
            passwordHash,
            name: `${data.firstName} ${data.lastName}`,
            nameAr: `${data.firstNameAr ?? ""} ${data.lastNameAr ?? ""}`.trim() || null,
            employeeId: created.id,
            isActive: true,
            mustChangePassword: true,
            roles: { create: { roleId: role.id } },
          },
        });
      }

      const leaveTypes = await tx.leaveType.findMany({ where: { isActive: true } });
      if (leaveTypes.length > 0) {
        await tx.leaveBalance.createMany({
          data: leaveTypes.map((leaveType) => ({
            employeeId: created.id,
            leaveTypeId: leaveType.id,
            year: hireDate.getUTCFullYear(),
            entitledDays: leaveType.maxDaysPerYear ?? 0,
          })),
        });
      }

      return created;
    });

    await writeAudit({
      userId: actor.id,
      action: "CREATE",
      entity: "Employee",
      entityId: employee.id,
      newData: { employeeNo, email, departmentId: department.id },
    });

    revalidatePath(`/${locale}/employees`);
    revalidatePath(`/${locale}/dashboard`);
    return { ok: true, employeeId: employee.id, tempPassword };
  } catch {
    return { ok: false, error: "validation" };
  }
}

export async function updateEmployeeAction(
  locale: string,
  employeeId: string,
  input: unknown,
): Promise<EmployeeActionResult> {
  const actor = await getCurrentUser();
  if (!actor || !hasPermission(actor, "employee.update")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = employeeFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  const existing = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      employments: { where: { isCurrent: true }, take: 1 },
    },
  });
  if (!existing) return { ok: false, error: "notFound" };

  const [branch, department, position] = await Promise.all([
    prisma.branch.findFirst({ where: { id: data.branchId, isActive: true } }),
    prisma.department.findFirst({
      where: { id: data.departmentId, deletedAt: null },
    }),
    prisma.position.findFirst({
      where: { id: data.positionId, deletedAt: null },
    }),
  ]);
  if (
    !branch ||
    !department ||
    !position ||
    position.departmentId !== data.departmentId
  ) {
    return { ok: false, error: "invalidOrg" };
  }

  const email = data.email.toLowerCase();
  const duplicate = await prisma.employee.findFirst({
    where: { email, id: { not: employeeId } },
  });
  if (duplicate) return { ok: false, error: "duplicateEmail" };

  const hireDate = dateOnly(data.hireDate);
  if (!hireDate) return { ok: false, error: "validation" };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employeeId },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          firstNameAr: data.firstNameAr || null,
          lastNameAr: data.lastNameAr || null,
          gender: data.gender,
          dateOfBirth: dateOnly(data.dateOfBirth),
          nationality: data.nationality || null,
          nationalId: data.nationalId || null,
          maritalStatus: data.maritalStatus,
          phone: data.phone || null,
          email,
          address: data.address || null,
          city: data.city || null,
          country: data.country || null,
          emergencyName: data.emergencyName || null,
          emergencyPhone: data.emergencyPhone || null,
          emergencyRelation: data.emergencyRelation || null,
          hireDate,
          managerId: data.managerId || null,
        },
      });

      const current = existing.employments[0];
      if (current) {
        const changed =
          current.departmentId !== data.departmentId ||
          current.positionId !== data.positionId ||
          Number(current.basicSalary) !== data.basicSalary;

        await tx.employment.update({
          where: { id: current.id },
          data: {
            branchId: data.branchId,
            departmentId: data.departmentId,
            positionId: data.positionId,
            managerId: data.managerId || null,
            employmentType: data.employmentType,
            hireDate,
            basicSalary: data.basicSalary,
          },
        });

        if (changed) {
          await tx.employmentHistory.create({
            data: {
              employeeId,
              employmentId: current.id,
              changeType: "UPDATE",
              effectiveDate: new Date(),
              oldData: {
                departmentId: current.departmentId,
                positionId: current.positionId,
                basicSalary: current.basicSalary.toString(),
              },
              newData: {
                departmentId: data.departmentId,
                positionId: data.positionId,
                basicSalary: data.basicSalary,
              },
              createdById: actor.id,
            },
          });
        }
      }

      const linkedUser = await tx.user.findUnique({ where: { employeeId } });
      if (linkedUser) {
        await tx.user.update({
          where: { id: linkedUser.id },
          data: {
            name: `${data.firstName} ${data.lastName}`,
            nameAr: `${data.firstNameAr ?? ""} ${data.lastNameAr ?? ""}`.trim() || null,
            email,
          },
        });
      }
    });

    await writeAudit({
      userId: actor.id,
      action: "UPDATE",
      entity: "Employee",
      entityId: employeeId,
      oldData: { email: existing.email, hireDate: existing.hireDate },
      newData: { email, hireDate },
    });

    revalidatePath(`/${locale}/employees`);
    revalidatePath(`/${locale}/employees/${employeeId}`);
    return { ok: true, employeeId };
  } catch {
    return { ok: false, error: "validation" };
  }
}

export async function suspendEmployeeAction(
  locale: string,
  employeeId: string,
): Promise<EmployeeStatusResult> {
  const actor = await getCurrentUser();
  if (!actor || !hasPermission(actor, "employee.update")) {
    return { ok: false, error: "unauthorized" };
  }
  if (actor.employeeId === employeeId) {
    return { ok: false, error: "self" };
  }

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: {
      id: true,
      status: true,
      user: { select: { id: true } },
      employments: {
        where: { isCurrent: true },
        select: { id: true, status: true },
      },
    },
  });

  if (!employee) return { ok: false, error: "notFound" };
  if (employee.status === "SUSPENDED") {
    return { ok: false, error: "alreadySuspended" };
  }
  if (["TERMINATED", "RESIGNED", "RETIRED"].includes(employee.status)) {
    return { ok: false, error: "finalized" };
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: employeeId },
      data: { status: "SUSPENDED" },
    });

    await tx.employment.updateMany({
      where: { employeeId, isCurrent: true },
      data: { status: "SUSPENDED" },
    });

    if (employee.employments.length > 0) {
      await tx.employmentHistory.createMany({
        data: employee.employments.map((employment) => ({
          employeeId,
          employmentId: employment.id,
          changeType: "STATUS_CHANGE",
          effectiveDate: now,
          oldData: { status: employment.status },
          newData: { status: "SUSPENDED" },
          reason: "SUSPENDED",
          createdById: actor.id,
        })),
      });
    }

    if (employee.user) {
      await tx.user.update({
        where: { id: employee.user.id },
        data: { isActive: false },
      });
      await tx.session.updateMany({
        where: { userId: employee.user.id, revokedAt: null },
        data: { revokedAt: now },
      });
    }

    await writeAudit(
      {
        userId: actor.id,
        action: "UPDATE",
        entity: "Employee",
        entityId: employeeId,
        oldData: { status: employee.status },
        newData: {
          status: "SUSPENDED",
          accountDeactivated: Boolean(employee.user),
          sessionsRevoked: Boolean(employee.user),
        },
      },
      tx,
    );
  });

  revalidatePath(`/${locale}/employees`);
  revalidatePath(`/${locale}/employees/${employeeId}`);
  revalidatePath(`/${locale}/dashboard`);

  return { ok: true };
}

export async function reactivateEmployeeAction(
  locale: string,
  employeeId: string,
): Promise<EmployeeStatusResult> {
  const actor = await getCurrentUser();
  if (!actor || !hasPermission(actor, "employee.update")) {
    return { ok: false, error: "unauthorized" };
  }

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null },
    select: {
      id: true,
      status: true,
      user: { select: { id: true } },
      employments: {
        where: { isCurrent: true },
        select: { id: true, status: true },
      },
    },
  });

  if (!employee) return { ok: false, error: "notFound" };
  if (employee.status !== "SUSPENDED") {
    return { ok: false, error: "notSuspended" };
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: employeeId },
      data: { status: "ACTIVE" },
    });

    await tx.employment.updateMany({
      where: { employeeId, isCurrent: true },
      data: { status: "ACTIVE" },
    });

    if (employee.employments.length > 0) {
      await tx.employmentHistory.createMany({
        data: employee.employments.map((employment) => ({
          employeeId,
          employmentId: employment.id,
          changeType: "STATUS_CHANGE",
          effectiveDate: now,
          oldData: { status: employment.status },
          newData: { status: "ACTIVE" },
          reason: "REACTIVATED",
          createdById: actor.id,
        })),
      });
    }

    if (employee.user) {
      await tx.user.update({
        where: { id: employee.user.id },
        data: { isActive: true },
      });
    }

    await writeAudit(
      {
        userId: actor.id,
        action: "UPDATE",
        entity: "Employee",
        entityId: employeeId,
        oldData: { status: employee.status },
        newData: {
          status: "ACTIVE",
          accountReactivated: Boolean(employee.user),
        },
      },
      tx,
    );
  });

  revalidatePath(`/${locale}/employees`);
  revalidatePath(`/${locale}/employees/${employeeId}`);
  revalidatePath(`/${locale}/dashboard`);

  return { ok: true };
}
