"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, hasPermission } from "@/lib/auth/session";
import { writeAudit } from "@/lib/auth/audit";

export type SettingsActionResult = {
  ok: boolean;
  error?:
    | "unauthorized"
    | "validation"
    | "duplicate"
    | "notFound"
    | "systemRole"
    | "lastAdmin"
    | "selfEdit"
    | "invalidRole";
};

const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
  z.number().min(0).optional(),
);

const optionalInt = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
  z.number().int().min(0).optional(),
);

const optionalYear = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
  z.number().int().min(2000).max(2100).optional(),
);

const companySchema = z.object({
  name: z.string().trim().min(2).max(160),
  nameAr: z.string().trim().min(2).max(160),
  legalName: z.string().trim().max(200).optional(),
  taxId: z.string().trim().max(60).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(),
  currency: z.string().trim().min(3).max(3),
  timezone: z.string().trim().min(3).max(80),
});

const branchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  nameAr: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(30),
  address: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(30).optional(),
  isActive: z.boolean().default(true),
});

const leaveTypeSchema = z.object({
  code: z.string().trim().min(2).max(30),
  name: z.string().trim().min(2).max(120),
  nameAr: z.string().trim().min(2).max(120),
  isPaid: z.boolean().default(true),
  requiresApproval: z.boolean().default(true),
  requiresHrApproval: z.boolean().default(false),
  maxDaysPerYear: optionalInt,
  carryOver: z.boolean().default(false),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).default("#2563eb"),
  isActive: z.boolean().default(true),
});

const salaryComponentSchema = z.object({
  code: z.string().trim().min(2).max(30),
  name: z.string().trim().min(2).max(120),
  nameAr: z.string().trim().min(2).max(120),
  type: z.enum(["EARNING", "DEDUCTION"]),
  calculationType: z.enum(["FIXED", "PERCENTAGE"]),
  percentage: optionalNumber,
  isTaxable: z.boolean().default(true),
  isStatutory: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

const scheduleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  nameAr: z.string().trim().min(2).max(120),
  startTime: z.string().trim().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().trim().regex(/^\d{2}:\d{2}$/),
  workDays: z.string().default("0,1,2,3,4"),
  graceMinutes: z.coerce.number().int().min(0).max(180).default(10),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

const holidaySchema = z.object({
  name: z.string().trim().min(2).max(120),
  nameAr: z.string().trim().min(2).max(120),
  date: z.string().min(10),
  isRecurring: z.boolean().default(false),
  year: optionalYear,
});

const userSchema = z.object({
  name: z.string().trim().min(2).max(120),
  nameAr: z.string().trim().max(120).optional(),
  isActive: z.boolean().default(true),
  roleCodes: z.string().min(1),
});

const rolePermissionsSchema = z.object({
  permissions: z.string().default(""),
});

function dateOnly(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseWorkDays(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((day) => Number(day.trim()))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    ),
  ].sort((a, b) => a - b);
}

async function audit(
  userId: string,
  action: "CREATE" | "UPDATE",
  entity: string,
  entityId: string,
  oldData?: unknown,
  newData?: unknown,
) {
  await writeAudit({
    userId,
    action,
    entity,
    entityId,
    oldData: oldData as Record<string, unknown> | undefined,
    newData: newData as Record<string, unknown> | undefined,
  });
}

function done(locale: string) {
  revalidatePath(`/${locale}/settings`);
  revalidatePath(`/${locale}/dashboard`);
}

export async function updateCompanyAction(
  locale: string,
  companyId: string,
  input: unknown,
): Promise<SettingsActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "settings.manage")) {
    return { ok: false, error: "unauthorized" };
  }
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return { ok: false, error: "notFound" };

  const data = parsed.data;
  await prisma.company.update({
    where: { id: companyId },
    data: {
      name: data.name,
      nameAr: data.nameAr,
      legalName: data.legalName || null,
      taxId: data.taxId || null,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      city: data.city || null,
      country: data.country || company.country,
      currency: data.currency.toUpperCase(),
      timezone: data.timezone,
    },
  });

  await audit(user.id, "UPDATE", "Company", companyId, { name: company.name }, { name: data.name });
  done(locale);
  return { ok: true };
}

export async function createBranchAction(
  locale: string,
  companyId: string,
  input: unknown,
): Promise<SettingsActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "settings.manage")) {
    return { ok: false, error: "unauthorized" };
  }
  const parsed = branchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return { ok: false, error: "notFound" };

  const duplicate = await prisma.branch.findFirst({
    where: { companyId, code: parsed.data.code },
  });
  if (duplicate) return { ok: false, error: "duplicate" };

  const branch = await prisma.branch.create({
    data: {
      companyId,
      name: parsed.data.name,
      nameAr: parsed.data.nameAr,
      code: parsed.data.code,
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
      isActive: parsed.data.isActive,
    },
  });

  await audit(user.id, "CREATE", "Branch", branch.id, undefined, {
    code: branch.code,
    name: branch.name,
  });
  done(locale);
  return { ok: true };
}

export async function updateBranchAction(
  locale: string,
  branchId: string,
  input: unknown,
): Promise<SettingsActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "settings.manage")) {
    return { ok: false, error: "unauthorized" };
  }
  const parsed = branchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) return { ok: false, error: "notFound" };

  const duplicate = await prisma.branch.findFirst({
    where: { companyId: branch.companyId, code: parsed.data.code, id: { not: branchId } },
  });
  if (duplicate) return { ok: false, error: "duplicate" };

  await prisma.branch.update({
    where: { id: branchId },
    data: {
      name: parsed.data.name,
      nameAr: parsed.data.nameAr,
      code: parsed.data.code,
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
      isActive: parsed.data.isActive,
    },
  });

  await audit(user.id, "UPDATE", "Branch", branchId, { code: branch.code }, { code: parsed.data.code });
  done(locale);
  return { ok: true };
}

export async function createLeaveTypeAction(
  locale: string,
  companyId: string,
  input: unknown,
): Promise<SettingsActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "settings.manage")) {
    return { ok: false, error: "unauthorized" };
  }
  const parsed = leaveTypeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return { ok: false, error: "notFound" };
  const duplicate = await prisma.leaveType.findFirst({
    where: { companyId, code: parsed.data.code },
  });
  if (duplicate) return { ok: false, error: "duplicate" };

  const data = parsed.data;
  const leaveType = await prisma.$transaction(async (tx) => {
    const created = await tx.leaveType.create({
      data: {
        companyId,
        code: data.code,
        name: data.name,
        nameAr: data.nameAr,
        isPaid: data.isPaid,
        requiresApproval: data.requiresApproval,
        requiresHrApproval: data.requiresHrApproval,
        maxDaysPerYear: data.maxDaysPerYear ?? null,
        carryOver: data.carryOver,
        color: data.color,
        isActive: data.isActive,
      },
    });

    if (data.isActive) {
      const employees = await tx.employee.findMany({
        where: { deletedAt: null, status: { in: ["ACTIVE", "PROBATION", "ON_LEAVE"] } },
        select: { id: true },
      });
      if (employees.length > 0) {
        await tx.leaveBalance.createMany({
          data: employees.map((employee) => ({
            employeeId: employee.id,
            leaveTypeId: created.id,
            year: new Date().getUTCFullYear(),
            entitledDays: data.maxDaysPerYear ?? 0,
          })),
          skipDuplicates: true,
        });
      }
    }

    return created;
  });

  await audit(user.id, "CREATE", "LeaveType", leaveType.id, undefined, {
    code: leaveType.code,
    name: leaveType.name,
  });
  done(locale);
  revalidatePath(`/${locale}/leave`);
  return { ok: true };
}

export async function updateLeaveTypeAction(
  locale: string,
  leaveTypeId: string,
  input: unknown,
): Promise<SettingsActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "settings.manage")) {
    return { ok: false, error: "unauthorized" };
  }
  const parsed = leaveTypeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
  if (!leaveType) return { ok: false, error: "notFound" };
  const duplicate = await prisma.leaveType.findFirst({
    where: { companyId: leaveType.companyId, code: parsed.data.code, id: { not: leaveTypeId } },
  });
  if (duplicate) return { ok: false, error: "duplicate" };

  const data = parsed.data;
  await prisma.leaveType.update({
    where: { id: leaveTypeId },
    data: {
      code: data.code,
      name: data.name,
      nameAr: data.nameAr,
      isPaid: data.isPaid,
      requiresApproval: data.requiresApproval,
      requiresHrApproval: data.requiresHrApproval,
      maxDaysPerYear: data.maxDaysPerYear ?? null,
      carryOver: data.carryOver,
      color: data.color,
      isActive: data.isActive,
    },
  });

  await audit(user.id, "UPDATE", "LeaveType", leaveTypeId, { code: leaveType.code }, { code: data.code });
  done(locale);
  revalidatePath(`/${locale}/leave`);
  return { ok: true };
}

export async function createSalaryComponentAction(
  locale: string,
  companyId: string,
  input: unknown,
): Promise<SettingsActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "settings.manage")) {
    return { ok: false, error: "unauthorized" };
  }
  const parsed = salaryComponentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return { ok: false, error: "notFound" };
  const duplicate = await prisma.salaryComponent.findFirst({
    where: { companyId, code: parsed.data.code },
  });
  if (duplicate) return { ok: false, error: "duplicate" };
  const data = parsed.data;
  if (data.calculationType === "PERCENTAGE" && data.percentage === undefined) {
    return { ok: false, error: "validation" };
  }

  const component = await prisma.salaryComponent.create({
    data: {
      companyId,
      code: data.code,
      name: data.name,
      nameAr: data.nameAr,
      type: data.type,
      calculationType: data.calculationType,
      percentage: data.calculationType === "PERCENTAGE" ? data.percentage ?? null : null,
      isTaxable: data.isTaxable,
      isStatutory: data.isStatutory,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
    },
  });

  await audit(user.id, "CREATE", "SalaryComponent", component.id, undefined, {
    code: component.code,
    name: component.name,
  });
  done(locale);
  revalidatePath(`/${locale}/payroll`);
  return { ok: true };
}

export async function updateSalaryComponentAction(
  locale: string,
  componentId: string,
  input: unknown,
): Promise<SettingsActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "settings.manage")) {
    return { ok: false, error: "unauthorized" };
  }
  const parsed = salaryComponentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const component = await prisma.salaryComponent.findUnique({ where: { id: componentId } });
  if (!component) return { ok: false, error: "notFound" };
  const duplicate = await prisma.salaryComponent.findFirst({
    where: { companyId: component.companyId, code: parsed.data.code, id: { not: componentId } },
  });
  if (duplicate) return { ok: false, error: "duplicate" };
  const data = parsed.data;
  if (data.calculationType === "PERCENTAGE" && data.percentage === undefined) {
    return { ok: false, error: "validation" };
  }

  await prisma.salaryComponent.update({
    where: { id: componentId },
    data: {
      code: data.code,
      name: data.name,
      nameAr: data.nameAr,
      type: data.type,
      calculationType: data.calculationType,
      percentage: data.calculationType === "PERCENTAGE" ? data.percentage ?? null : null,
      isTaxable: data.isTaxable,
      isStatutory: data.isStatutory,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
    },
  });

  await audit(user.id, "UPDATE", "SalaryComponent", componentId, { code: component.code }, { code: data.code });
  done(locale);
  revalidatePath(`/${locale}/payroll`);
  return { ok: true };
}

export async function createScheduleAction(
  locale: string,
  companyId: string,
  input: unknown,
): Promise<SettingsActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "settings.manage")) {
    return { ok: false, error: "unauthorized" };
  }
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return { ok: false, error: "notFound" };
  const workDays = parseWorkDays(parsed.data.workDays);
  if (workDays.length === 0) return { ok: false, error: "validation" };

  const data = parsed.data;
  const schedule = await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.workSchedule.updateMany({ where: { companyId }, data: { isDefault: false } });
    }
    return tx.workSchedule.create({
      data: {
        companyId,
        name: data.name,
        nameAr: data.nameAr,
        startTime: data.startTime,
        endTime: data.endTime,
        workDays,
        graceMinutes: data.graceMinutes,
        isDefault: data.isDefault,
        isActive: data.isActive,
      },
    });
  });

  await audit(user.id, "CREATE", "WorkSchedule", schedule.id, undefined, {
    name: schedule.name,
    workDays,
  });
  done(locale);
  revalidatePath(`/${locale}/attendance`);
  return { ok: true };
}

export async function updateScheduleAction(
  locale: string,
  scheduleId: string,
  input: unknown,
): Promise<SettingsActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "settings.manage")) {
    return { ok: false, error: "unauthorized" };
  }
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const schedule = await prisma.workSchedule.findUnique({ where: { id: scheduleId } });
  if (!schedule) return { ok: false, error: "notFound" };
  const workDays = parseWorkDays(parsed.data.workDays);
  if (workDays.length === 0) return { ok: false, error: "validation" };
  const data = parsed.data;

  await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.workSchedule.updateMany({
        where: { companyId: schedule.companyId, id: { not: scheduleId } },
        data: { isDefault: false },
      });
    }
    await tx.workSchedule.update({
      where: { id: scheduleId },
      data: {
        name: data.name,
        nameAr: data.nameAr,
        startTime: data.startTime,
        endTime: data.endTime,
        workDays,
        graceMinutes: data.graceMinutes,
        isDefault: data.isDefault,
        isActive: data.isActive,
      },
    });
  });

  await audit(user.id, "UPDATE", "WorkSchedule", scheduleId, { name: schedule.name }, { name: data.name });
  done(locale);
  revalidatePath(`/${locale}/attendance`);
  return { ok: true };
}

export async function createHolidayAction(
  locale: string,
  companyId: string,
  input: unknown,
): Promise<SettingsActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "settings.manage")) {
    return { ok: false, error: "unauthorized" };
  }
  const parsed = holidaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return { ok: false, error: "notFound" };
  const date = dateOnly(parsed.data.date);
  if (!date) return { ok: false, error: "validation" };

  const holiday = await prisma.holiday.create({
    data: {
      companyId,
      name: parsed.data.name,
      nameAr: parsed.data.nameAr,
      date,
      isRecurring: parsed.data.isRecurring,
      year: parsed.data.isRecurring ? null : parsed.data.year ?? date.getUTCFullYear(),
    },
  });

  await audit(user.id, "CREATE", "Holiday", holiday.id, undefined, {
    name: holiday.name,
    date: holiday.date,
  });
  done(locale);
  revalidatePath(`/${locale}/attendance`);
  revalidatePath(`/${locale}/leave`);
  return { ok: true };
}

export async function updateHolidayAction(
  locale: string,
  holidayId: string,
  input: unknown,
): Promise<SettingsActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "settings.manage")) {
    return { ok: false, error: "unauthorized" };
  }
  const parsed = holidaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const holiday = await prisma.holiday.findUnique({ where: { id: holidayId } });
  if (!holiday) return { ok: false, error: "notFound" };
  const date = dateOnly(parsed.data.date);
  if (!date) return { ok: false, error: "validation" };

  await prisma.holiday.update({
    where: { id: holidayId },
    data: {
      name: parsed.data.name,
      nameAr: parsed.data.nameAr,
      date,
      isRecurring: parsed.data.isRecurring,
      year: parsed.data.isRecurring ? null : parsed.data.year ?? date.getUTCFullYear(),
    },
  });

  await audit(user.id, "UPDATE", "Holiday", holidayId, { name: holiday.name }, { name: parsed.data.name });
  done(locale);
  revalidatePath(`/${locale}/attendance`);
  revalidatePath(`/${locale}/leave`);
  return { ok: true };
}

export async function updateUserAction(
  locale: string,
  userId: string,
  input: unknown,
): Promise<SettingsActionResult> {
  const actor = await getCurrentUser();
  if (!actor || !hasPermission(actor, "user.manage")) {
    return { ok: false, error: "unauthorized" };
  }
  const parsed = userSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });
  if (!target) return { ok: false, error: "notFound" };
  if (target.id === actor.id) return { ok: false, error: "selfEdit" };

  const roleCodes = [
    ...new Set(
      parsed.data.roleCodes
        .split(",")
        .map((code) => code.trim())
        .filter(Boolean),
    ),
  ];
  if (roleCodes.length === 0) return { ok: false, error: "invalidRole" };

  const roles = await prisma.role.findMany({ where: { code: { in: roleCodes } } });
  if (roles.length !== roleCodes.length) return { ok: false, error: "invalidRole" };

  const actorIsSuper = actor.roles.some((role) => role.code === "SUPER_ADMIN");
  if (!actorIsSuper && roleCodes.includes("SUPER_ADMIN")) {
    return { ok: false, error: "invalidRole" };
  }

  const targetWasSuper = target.roles.some((userRole) => userRole.role.code === "SUPER_ADMIN");
  if (targetWasSuper && !roleCodes.includes("SUPER_ADMIN")) {
    const superCount = await prisma.userRole.count({
      where: { role: { code: "SUPER_ADMIN" }, user: { isActive: true, deletedAt: null } },
    });
    if (superCount <= 1) return { ok: false, error: "lastAdmin" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        name: parsed.data.name,
        nameAr: parsed.data.nameAr || null,
        isActive: parsed.data.isActive,
      },
    });
    await tx.userRole.deleteMany({ where: { userId } });
    await tx.userRole.createMany({
      data: roles.map((role) => ({ userId, roleId: role.id })),
      skipDuplicates: true,
    });
  });

  await audit(
    actor.id,
    "UPDATE",
    "User",
    userId,
    {
      roles: target.roles.map((userRole) => userRole.role.code),
      isActive: target.isActive,
    },
    { roles: roleCodes, isActive: parsed.data.isActive },
  );
  done(locale);
  return { ok: true };
}

export async function updateRolePermissionsAction(
  locale: string,
  roleId: string,
  input: unknown,
): Promise<SettingsActionResult> {
  const actor = await getCurrentUser();
  if (!actor || !hasPermission(actor, "role.manage")) {
    return { ok: false, error: "unauthorized" };
  }
  const parsed = rolePermissionsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: { permissions: { include: { permission: true } } },
  });
  if (!role) return { ok: false, error: "notFound" };
  if (role.code === "SUPER_ADMIN") return { ok: false, error: "systemRole" };

  const codes = [
    ...new Set(
      parsed.data.permissions
        .split(",")
        .map((code) => code.trim())
        .filter(Boolean),
    ),
  ];
  const permissions = await prisma.permission.findMany({ where: { code: { in: codes } } });
  if (permissions.length !== codes.length) return { ok: false, error: "validation" };

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId } });
    await tx.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  });

  await audit(
    actor.id,
    "UPDATE",
    "Role",
    roleId,
    { permissions: role.permissions.map((rp) => rp.permission.code) },
    { permissions: codes },
  );
  done(locale);
  return { ok: true };
}
