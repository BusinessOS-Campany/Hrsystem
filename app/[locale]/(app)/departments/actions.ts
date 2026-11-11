"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, hasPermission } from "@/lib/auth/session";
import { writeAudit } from "@/lib/auth/audit";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  nameAr: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(30),
  branchId: z.string().optional(),
  parentId: z.string().optional(),
  managerId: z.string().optional(),
  description: z.string().trim().max(500).optional(),
});

export type DepartmentActionResult = {
  ok: boolean;
  error?: "unauthorized" | "validation" | "duplicate" | "notFound";
  id?: string;
};

export async function createDepartmentAction(
  locale: string,
  input: unknown,
): Promise<DepartmentActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "department.create")) {
    return { ok: false, error: "unauthorized" };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const company = await prisma.company.findFirst({ where: { isActive: true } });
  if (!company) return { ok: false, error: "notFound" };

  const branchId = parsed.data.branchId || null;
  const parentId = parsed.data.parentId || null;
  const managerId = parsed.data.managerId || null;
  const [branch, parent, manager] = await Promise.all([
    branchId
      ? prisma.branch.findFirst({
          where: { id: branchId, companyId: company.id, isActive: true },
          select: { id: true },
        })
      : Promise.resolve(null),
    parentId
      ? prisma.department.findFirst({
          where: {
            id: parentId,
            companyId: company.id,
            deletedAt: null,
          },
          select: { id: true },
        })
      : Promise.resolve(null),
    managerId
      ? prisma.employee.findFirst({
          where: {
            id: managerId,
            deletedAt: null,
            status: { in: ["ACTIVE", "PROBATION"] },
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  if (
    (branchId && !branch) ||
    (parentId && !parent) ||
    (managerId && !manager)
  ) {
    return { ok: false, error: "notFound" };
  }

  const code = parsed.data.code.toUpperCase();
  const duplicate = await prisma.department.findFirst({
    where: { companyId: company.id, code },
  });
  if (duplicate) return { ok: false, error: "duplicate" };

  let department: { id: string; code: string; name: string };
  try {
    department = await prisma.department.create({
      data: {
        companyId: company.id,
        branchId,
        parentId,
        managerId,
        name: parsed.data.name,
        nameAr: parsed.data.nameAr,
        code,
        description: parsed.data.description || null,
      },
      select: { id: true, code: true, name: true },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return { ok: false, error: "duplicate" };
    }
    throw error;
  }

  await writeAudit({
    userId: user.id,
    action: "CREATE",
    entity: "Department",
    entityId: department.id,
    newData: { code: department.code, name: department.name },
  });

  revalidatePath(`/${locale}/departments`);
  revalidatePath(`/${locale}/employees`);
  return { ok: true, id: department.id };
}
