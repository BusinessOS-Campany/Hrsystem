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

  const duplicate = await prisma.department.findFirst({
    where: { companyId: company.id, code: parsed.data.code },
  });
  if (duplicate) return { ok: false, error: "duplicate" };

  const department = await prisma.department.create({
    data: {
      companyId: company.id,
      branchId: parsed.data.branchId || null,
      parentId: parsed.data.parentId || null,
      managerId: parsed.data.managerId || null,
      name: parsed.data.name,
      nameAr: parsed.data.nameAr,
      code: parsed.data.code,
      description: parsed.data.description || null,
    },
  });

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
