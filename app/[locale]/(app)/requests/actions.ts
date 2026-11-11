"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, hasPermission } from "@/lib/auth/session";
import { writeAudit } from "@/lib/auth/audit";

export type RequestActionResult = {
  ok: boolean;
  error?:
    | "unauthorized"
    | "noEmployee"
    | "notFound"
    | "forbidden"
    | "invalid"
    | "commentRequired"
    | "conflict";
};

const requestTypes = [
  "SALARY_CERTIFICATE",
  "EMPLOYMENT_CERTIFICATE",
  "ADVANCE",
  "LOAN",
  "EXPENSE",
  "DOCUMENT",
  "OTHER",
] as const;

const createSchema = z.object({
  type: z.enum(requestTypes),
  subject: z.string().trim().min(3).max(200),
  details: z.string().trim().max(2000).optional(),
  amount: z.string().trim().max(30).optional(),
});

const TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5_000,
  timeout: 15_000,
} as const;

function isRetryable(error: unknown, retryConnection = false) {
  const code = (error as { code?: string }).code;
  if (code === "P2034" || code === "P2002") return true;
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

async function nextRequestNo(
  tx: Prisma.TransactionClient,
  year: number,
) {
  const prefix = `REQ-${year}-`;
  const latest = await tx.employeeRequest.findFirst({
    where: { requestNo: { startsWith: prefix } },
    orderBy: { requestNo: "desc" },
    select: { requestNo: true },
  });
  const sequence = Number(latest?.requestNo.slice(prefix.length)) || 0;
  return `${prefix}${String(sequence + 1).padStart(4, "0")}`;
}

async function activeRoleReviewers(roleId: string, excludeUserId?: string | null) {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      roles: { some: { roleId } },
    },
    select: { id: true },
  });
  if (users.length > 0) return users;

  // A workflow role can be left without any active user (for example when the
  // only HR account is disabled). Fall back to active users who can see every
  // request instead of leaving the request permanently stuck.
  return prisma.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      roles: {
        some: {
          role: {
            permissions: {
              some: { permission: { code: "request.view_all" } },
            },
          },
        },
      },
    },
    select: { id: true },
  });
}

async function notifyStep(step: {
  approverId: string | null;
  roleId: string | null;
} | null, input: { requestNo: string; subject: string; excludeUserId?: string | null }) {
  if (!step) return;
  if (step.approverId) {
    if (step.approverId === input.excludeUserId) return;
    await prisma.notification.create({
      data: {
        userId: step.approverId,
        type: "APPROVAL_REQUIRED",
        title: "Request approval required",
        titleAr: "مطلوب اعتماد طلب",
        message: `Request ${input.requestNo} (${input.subject}) is awaiting your review.`,
        messageAr: `الطلب ${input.requestNo} (${input.subject}) بانتظار مراجعتك.`,
        link: "/requests",
      },
    });
    return;
  }
  if (step.roleId) {
    const users = await activeRoleReviewers(step.roleId, input.excludeUserId);
    if (users.length > 0) {
      await prisma.notification.createMany({
        data: users.map((user) => ({
          userId: user.id,
          type: "APPROVAL_REQUIRED" as const,
          title: "Request approval required",
          titleAr: "مطلوب اعتماد طلب",
          message: `Request ${input.requestNo} (${input.subject}) is awaiting your review.`,
          messageAr: `الطلب ${input.requestNo} (${input.subject}) بانتظار مراجعتك.`,
          link: "/requests",
        })),
      });
    }
  }
}

export async function createRequestAction(
  locale: string,
  formData: FormData,
): Promise<RequestActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "request.create")) {
    return { ok: false, error: "unauthorized" };
  }
  if (!user.employeeId) return { ok: false, error: "noEmployee" };

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "invalid" };

  const amount = parsed.data.amount ? Number(parsed.data.amount) : null;
  if (
    amount !== null &&
    (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000)
  ) {
    return { ok: false, error: "invalid" };
  }
  if (
    ["ADVANCE", "LOAN", "EXPENSE"].includes(parsed.data.type) &&
    amount === null
  ) {
    return { ok: false, error: "invalid" };
  }

  const employee = await prisma.employee.findFirst({
    where: { id: user.employeeId, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      firstNameAr: true,
      lastNameAr: true,
      user: { select: { id: true } },
      employments: {
        where: { isCurrent: true },
        take: 1,
        select: { companyId: true },
      },
      manager: {
        select: {
          user: { select: { id: true, isActive: true } },
        },
      },
    },
  });
  if (!employee) return { ok: false, error: "noEmployee" };

  const companyId = employee.employments[0]?.companyId;
  const workflow = companyId
    ? await prisma.approvalWorkflow.findFirst({
        where: {
          companyId,
          entityType: parsed.data.type,
          isActive: true,
          steps: { some: {} },
        },
        select: {
          steps: {
            select: {
              stepOrder: true,
              approverId: true,
              roleId: true,
              isFinal: true,
            },
            orderBy: { stepOrder: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      })
    : null;

  let steps = workflow?.steps ?? [];
  if (steps.length === 0) {
    if (employee.manager?.user?.isActive) {
      steps = [
        {
          stepOrder: 1,
          approverId: employee.manager.user.id,
          roleId: null,
          isFinal: true,
        },
      ];
    } else {
      const hrRole = await prisma.role.findUnique({
        where: { code: "HR_ADMIN" },
        select: { id: true },
      });
      steps = [
        {
          stepOrder: 1,
          approverId: null,
          roleId: hrRole?.id ?? null,
          isFinal: true,
        },
      ];
    }
  }

  try {
    const result = await serializable(() =>
      prisma.$transaction(async (tx) => {
        const db = tx as unknown as Prisma.TransactionClient;
        const year = new Date().getUTCFullYear();
        const requestNo = await nextRequestNo(db, year);
        const request = await tx.employeeRequest.create({
          data: {
            requestNo,
            employeeId: employee.id,
            type: parsed.data.type,
            subject: parsed.data.subject,
            details: parsed.data.details || null,
            amount,
            createdById: user.id,
            currentStep: steps[0]?.stepOrder ?? 1,
            approvalSteps: {
              create: steps.map((step, index) => ({
                stepOrder: step.stepOrder,
                approverId: step.approverId,
                roleId: step.roleId,
                status: "PENDING",
                ...(index === 0 ? {} : {}),
              })),
            },
          },
          select: { id: true, requestNo: true },
        });

        await writeAudit(
          {
            userId: user.id,
            action: "CREATE",
            entity: "EmployeeRequest",
            entityId: request.id,
            newData: {
              requestNo,
              type: parsed.data.type,
              amount,
              steps: steps.length,
            },
          },
          tx,
        );

        return { request, firstStep: steps[0] ?? null };
      }, TX_OPTIONS),
    );

    try {
      await notifyStep(result.firstStep, {
        requestNo: result.request.requestNo,
        subject: parsed.data.subject,
        excludeUserId: employee.user?.id ?? user.id,
      });
    } catch (error) {
      console.error("Failed to send request notifications", error);
    }

    revalidatePath(`/${locale}/requests`);
    return { ok: true };
  } catch (error) {
    if (isRetryable(error)) return { ok: false, error: "conflict" };
    console.error("Failed to create request", error);
    return { ok: false, error: "invalid" };
  }
}

export async function reviewRequestAction(
  locale: string,
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  comment?: string,
): Promise<RequestActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "request.approve")) {
    return { ok: false, error: "unauthorized" };
  }

  const cleanComment = comment?.trim() || null;
  if (decision === "REJECTED" && (!cleanComment || cleanComment.length < 3)) {
    return { ok: false, error: "commentRequired" };
  }

  try {
    const result = await serializableWithConnection(() =>
      prisma.$transaction(async (tx) => {
        const request = await tx.employeeRequest.findUnique({
          where: { id: requestId },
          select: {
            id: true,
            requestNo: true,
            subject: true,
            status: true,
            employeeId: true,
            employee: {
              select: {
                firstName: true,
                lastName: true,
                firstNameAr: true,
                lastNameAr: true,
                user: { select: { id: true } },
              },
            },
            approvalSteps: {
              select: {
                id: true,
                stepOrder: true,
                approverId: true,
                roleId: true,
                status: true,
              },
              orderBy: { stepOrder: "asc" },
            },
          },
        });
        if (!request) return { ok: false as const, error: "notFound" as const };
        if (request.status !== "PENDING") {
          return { ok: false as const, error: "conflict" as const };
        }
        if (request.employeeId === user.employeeId) {
          return { ok: false as const, error: "forbidden" as const };
        }

        const pendingIndex = request.approvalSteps.findIndex(
          (step) => step.status === "PENDING",
        );
        const pending = request.approvalSteps[pendingIndex];
        if (!pending) return { ok: false as const, error: "conflict" as const };

        const roleIds = user.roles.map((role) => role.id);
        let isApprover = false;
        if (pending.approverId) {
          isApprover = pending.approverId === user.id;
        } else if (pending.roleId) {
          isApprover = roleIds.includes(pending.roleId);
          if (!isApprover) {
            const activeRoleUsers = await tx.user.count({
              where: {
                isActive: true,
                deletedAt: null,
                ...(request.employee.user?.id
                  ? { id: { not: request.employee.user.id } }
                  : {}),
                roles: { some: { roleId: pending.roleId } },
              },
            });
            // Only allow the view-all fallback when the configured workflow
            // role has no active reviewers, not as a way to bypass them.
            isApprover =
              activeRoleUsers === 0 && hasPermission(user, "request.view_all");
          }
        } else {
          isApprover = hasPermission(user, "request.view_all");
        }
        if (!isApprover) return { ok: false as const, error: "forbidden" as const };

        const stepUpdate = await tx.approvalStep.updateMany({
          where: { id: pending.id, status: "PENDING" },
          data: {
            status: decision,
            comment: cleanComment,
            actedAt: new Date(),
          },
        });
        if (stepUpdate.count !== 1) {
          return { ok: false as const, error: "conflict" as const };
        }

        const nextStep =
          request.approvalSteps
            .slice(pendingIndex + 1)
            .find((step) => step.status === "PENDING") ?? null;
        const finalApproval = decision === "APPROVED" && !nextStep;

        if (decision === "REJECTED") {
          const remaining = request.approvalSteps
            .slice(pendingIndex + 1)
            .filter((step) => step.status === "PENDING");
          if (remaining.length > 0) {
            await tx.approvalStep.updateMany({
              where: { id: { in: remaining.map((step) => step.id) } },
              data: { status: "SKIPPED", actedAt: new Date() },
            });
          }
        }

        const requestUpdate = await tx.employeeRequest.updateMany({
          where: { id: request.id, status: "PENDING" },
          data:
            decision === "REJECTED"
              ? { status: "REJECTED", currentStep: pending.stepOrder }
              : finalApproval
                ? { status: "APPROVED", currentStep: pending.stepOrder }
                : { currentStep: nextStep!.stepOrder },
        });
        if (requestUpdate.count !== 1) {
          return { ok: false as const, error: "conflict" as const };
        }

        await writeAudit(
          {
            userId: user.id,
            action: decision === "APPROVED" ? "APPROVE" : "REJECT",
            entity: "EmployeeRequest",
            entityId: request.id,
            oldData: { status: request.status, step: pending.stepOrder },
            newData: {
              status: decision === "REJECTED" ? "REJECTED" : finalApproval ? "APPROVED" : "PENDING",
              comment: cleanComment,
            },
          },
          tx,
        );

        return {
          ok: true as const,
          request,
          decision,
          finalApproval,
          nextStep: decision === "APPROVED" ? nextStep : null,
          comment: cleanComment,
        };
      }, TX_OPTIONS),
    );

    if (!result.ok) return result;

    try {
        if (result.decision === "REJECTED") {
          if (result.request.employee.user) {
          await prisma.notification.create({
            data: {
              userId: result.request.employee.user.id,
              type: "GENERAL",
              title: "Request rejected",
              titleAr: "تم رفض الطلب",
              message: `Your request ${result.request.requestNo} was rejected.${result.comment ? ` Reason: ${result.comment}` : ""}`,
              messageAr: `تم رفض طلبك ${result.request.requestNo}.${result.comment ? ` السبب: ${result.comment}` : ""}`,
              link: "/requests",
            },
          });
        }
      } else if (result.finalApproval) {
        if (result.request.employee.user) {
          await prisma.notification.create({
            data: {
              userId: result.request.employee.user.id,
              type: "GENERAL",
              title: "Request approved",
              titleAr: "تم اعتماد الطلب",
              message: `Your request ${result.request.requestNo} was approved.`,
              messageAr: `تم اعتماد طلبك ${result.request.requestNo}.`,
              link: "/requests",
            },
          });
        }
      } else {
        await notifyStep(result.nextStep, {
          requestNo: result.request.requestNo,
          subject: result.request.subject,
          excludeUserId: user.id,
        });
      }

    } catch (error) {
      console.error("Failed to send request review notifications", error);
    }

    revalidatePath(`/${locale}/requests`);
    return { ok: true };
  } catch (error) {
    if (isRetryable(error)) return { ok: false, error: "conflict" };
    console.error("Failed to review request", error);
    return { ok: false, error: "invalid" };
  }
}
