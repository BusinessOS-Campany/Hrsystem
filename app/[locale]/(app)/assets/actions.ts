"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, hasPermission } from "@/lib/auth/session";
import { writeAudit } from "@/lib/auth/audit";
import { serializable, SERIALIZABLE_TX } from "@/lib/db/transaction";

export type AssetActionResult = {
  ok: boolean;
  error?:
    | "unauthorized"
    | "validation"
    | "notFound"
    | "duplicate"
    | "notAvailable"
    | "notAssigned"
    | "invalidDate";
};

const optionalText = (max = 1000) =>
  z.string().trim().max(max).optional().or(z.literal(""));

const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
  z.number().min(0).optional(),
);

const assetSchema = z.object({
  assetTag: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(160),
  category: z.string().trim().min(2).max(60),
  brand: optionalText(80),
  model: optionalText(80),
  serialNumber: optionalText(80),
  purchaseDate: optionalText(10),
  purchaseCost: optionalNumber,
  status: z.enum(["AVAILABLE", "ASSIGNED", "MAINTENANCE", "RETIRED", "LOST"]).default("AVAILABLE"),
  condition: z.enum(["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"]).default("NEW"),
  notes: optionalText(1000),
});

const assignSchema = z.object({
  employeeId: z.string().min(1),
  notes: optionalText(1000),
});

const returnSchema = z.object({
  returnCondition: z.enum(["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"]),
  notes: optionalText(1000),
});

function dateOnly(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function done(locale: string) {
  revalidatePath(`/${locale}/assets`);
  revalidatePath(`/${locale}/dashboard`);
}

export async function createAssetAction(
  locale: string,
  input: unknown,
): Promise<AssetActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "asset.manage")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = assetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  const company = await prisma.company.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!company) return { ok: false, error: "notFound" };

  const purchaseDate = data.purchaseDate ? dateOnly(data.purchaseDate) : null;
  if (data.purchaseDate && !purchaseDate) return { ok: false, error: "invalidDate" };

  const assetTag = data.assetTag.toUpperCase();
  const duplicate = await prisma.asset.findFirst({
    where: {
      OR: [
        { assetTag },
        ...(data.serialNumber ? [{ serialNumber: data.serialNumber }] : []),
      ],
    },
  });
  if (duplicate) return { ok: false, error: "duplicate" };

  const asset = await prisma.asset.create({
    data: {
      companyId: company.id,
      assetTag,
      name: data.name,
      category: data.category.toUpperCase(),
      brand: data.brand || null,
      model: data.model || null,
      serialNumber: data.serialNumber || null,
      purchaseDate,
      purchaseCost: data.purchaseCost ?? null,
      status: data.status,
      condition: data.condition,
      notes: data.notes || null,
    },
  });

  await writeAudit({
    userId: user.id,
    action: "CREATE",
    entity: "Asset",
    entityId: asset.id,
    newData: { assetTag: asset.assetTag, name: asset.name, status: asset.status },
  });

  done(locale);
  return { ok: true };
}

export async function updateAssetAction(
  locale: string,
  assetId: string,
  input: unknown,
): Promise<AssetActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "asset.manage")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = assetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) return { ok: false, error: "notFound" };

  const purchaseDate = data.purchaseDate ? dateOnly(data.purchaseDate) : null;
  if (data.purchaseDate && !purchaseDate) return { ok: false, error: "invalidDate" };

  const assetTag = data.assetTag.toUpperCase();
  const duplicate = await prisma.asset.findFirst({
    where: {
      id: { not: assetId },
      OR: [
        { assetTag },
        ...(data.serialNumber ? [{ serialNumber: data.serialNumber }] : []),
      ],
    },
  });
  if (duplicate) return { ok: false, error: "duplicate" };

  await prisma.asset.update({
    where: { id: assetId },
    data: {
      assetTag,
      name: data.name,
      category: data.category.toUpperCase(),
      brand: data.brand || null,
      model: data.model || null,
      serialNumber: data.serialNumber || null,
      purchaseDate,
      purchaseCost: data.purchaseCost ?? null,
      status: data.status,
      condition: data.condition,
      notes: data.notes || null,
    },
  });

  await writeAudit({
    userId: user.id,
    action: "UPDATE",
    entity: "Asset",
    entityId: assetId,
    oldData: { assetTag: asset.assetTag, name: asset.name, status: asset.status },
    newData: { assetTag: data.assetTag, name: data.name, status: data.status },
  });

  done(locale);
  return { ok: true };
}

export async function assignAssetAction(
  locale: string,
  assetId: string,
  input: unknown,
): Promise<AssetActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "asset.manage")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const result = await serializable(() =>
    prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({
        where: { id: assetId },
        select: {
          id: true,
          name: true,
          assetTag: true,
          status: true,
          assignments: {
            where: { returnedAt: null },
            take: 1,
            select: { id: true },
          },
        },
      });
      if (!asset) return { error: "notFound" as const };
      if (asset.status !== "AVAILABLE" || asset.assignments.length > 0) {
        return { error: "notAvailable" as const };
      }

      const employee = await tx.employee.findFirst({
        where: {
          id: parsed.data.employeeId,
          deletedAt: null,
          status: { in: ["ACTIVE", "PROBATION"] },
        },
        select: { id: true, user: { select: { id: true } } },
      });
      if (!employee) return { error: "notFound" as const };

      const claimed = await tx.asset.updateMany({
        where: { id: assetId, status: "AVAILABLE" },
        data: { status: "ASSIGNED" },
      });
      if (claimed.count !== 1) return { error: "notAvailable" as const };

      const assignment = await tx.assetAssignment.create({
        data: {
          assetId,
          employeeId: employee.id,
          assignedById: user.id,
          notes: parsed.data.notes || null,
        },
        select: { id: true },
      });

      if (employee.user) {
        await tx.notification.create({
          data: {
            userId: employee.user.id,
            type: "GENERAL",
            title: "Asset assigned",
            titleAr: "تم تعيين أصل",
            message: `${asset.name} (${asset.assetTag}) has been assigned to you.`,
            messageAr: `تم تعيين ${asset.name} (${asset.assetTag}) لك.`,
            link: "/assets",
          },
        });
      }

      await writeAudit(
        {
          userId: user.id,
          action: "UPDATE",
          entity: "AssetAssignment",
          entityId: assignment.id,
          newData: { assetId, employeeId: employee.id, assetTag: asset.assetTag },
        },
        tx,
      );

      return { assignmentId: assignment.id };
    }, SERIALIZABLE_TX),
  );

  if ("error" in result) return { ok: false, error: result.error };

  done(locale);
  return { ok: true };
}

export async function returnAssetAction(
  locale: string,
  assetId: string,
  input: unknown,
): Promise<AssetActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "asset.manage")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = returnSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };

  const nextStatus =
    parsed.data.returnCondition === "POOR" ||
    parsed.data.returnCondition === "DAMAGED"
      ? "MAINTENANCE"
      : "AVAILABLE";

  const result = await serializable(() =>
    prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({
        where: { id: assetId },
        select: {
          id: true,
          name: true,
          assetTag: true,
          assignments: {
            where: { returnedAt: null },
            take: 1,
            select: {
              id: true,
              employeeId: true,
              notes: true,
              employee: {
                select: { user: { select: { id: true } } },
              },
            },
          },
        },
      });
      if (!asset) return { error: "notFound" as const };
      const assignment = asset.assignments[0];
      if (!assignment) return { error: "notAssigned" as const };

      const notes =
        [assignment.notes, parsed.data.notes].filter(Boolean).join("\n") || null;
      const returned = await tx.assetAssignment.updateMany({
        where: { id: assignment.id, returnedAt: null },
        data: {
          returnedAt: new Date(),
          returnCondition: parsed.data.returnCondition,
          notes,
        },
      });
      if (returned.count !== 1) return { error: "notAssigned" as const };

      await tx.asset.update({
        where: { id: assetId },
        data: { status: nextStatus, condition: parsed.data.returnCondition },
      });

      if (assignment.employee.user) {
        await tx.notification.create({
          data: {
            userId: assignment.employee.user.id,
            type: "GENERAL",
            title: "Asset returned",
            titleAr: "تمت إعادة أصل",
            message: `${asset.name} (${asset.assetTag}) has been returned.`,
            messageAr: `تمت إعادة ${asset.name} (${asset.assetTag}).`,
            link: "/assets",
          },
        });
      }

      await writeAudit(
        {
          userId: user.id,
          action: "UPDATE",
          entity: "AssetAssignment",
          entityId: assignment.id,
          oldData: {
            assetId,
            employeeId: assignment.employeeId,
            returnedAt: null,
          },
          newData: {
            assetId,
            employeeId: assignment.employeeId,
            returnCondition: parsed.data.returnCondition,
            nextStatus,
          },
        },
        tx,
      );

      return { assignmentId: assignment.id };
    }, SERIALIZABLE_TX),
  );

  if ("error" in result) return { ok: false, error: result.error };

  done(locale);
  return { ok: true };
}
