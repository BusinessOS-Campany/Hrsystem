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
  departmentId: z.string().min(1),
  grade: z.string().trim().max(30).optional(),
  description: z.string().trim().max(500).optional(),
  minSalary: z.coerce.number().min(0).optional(),
  maxSalary: z.coerce.number().min(0).optional(),
});

export type PositionActionResult = {
  ok: boolean;
  error?: "unauthorized" | "validation" | "duplicate" | "salaryBand" | "notFound";
  id?: string;
};

export async function createPositionAction(
  locale: string,
  input: unknown,
): Promise<PositionActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "position.create")) {
    return { ok: false, error: "unauthorized" };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  if (
    data.minSalary !== undefined &&
    data.maxSalary !== undefined &&
    data.maxSalary < data.minSalary
  ) {
    return { ok: false, error: "salaryBand" };
  }

  const department = await prisma.department.findUnique({
    where: { id: data.departmentId },
  });
  if (!department) return { ok: false, error: "notFound" };

  const duplicate = await prisma.position.findFirst({
    where: { departmentId: data.departmentId, code: data.code },
  });
  if (duplicate) return { ok: false, error: "duplicate" };

  const position = await prisma.position.create({
    data: {
      departmentId: data.departmentId,
      name: data.name,
      nameAr: data.nameAr,
      code: data.code,
      grade: data.grade || null,
      description: data.description || null,
      minSalary: data.minSalary ?? null,
      maxSalary: data.maxSalary ?? null,
    },
  });

  await writeAudit({
    userId: user.id,
    action: "CREATE",
    entity: "Position",
    entityId: position.id,
    newData: { code: position.code, name: position.name },
  });

  revalidatePath(`/${locale}/positions`);
  revalidatePath(`/${locale}/employees`);
  return { ok: true, id: position.id };
}
