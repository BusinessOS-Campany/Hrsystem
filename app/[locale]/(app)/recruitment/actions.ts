"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, hasPermission } from "@/lib/auth/session";
import { writeAudit } from "@/lib/auth/audit";

export type RecruitmentActionResult = {
  ok: boolean;
  error?:
    | "unauthorized"
    | "validation"
    | "notFound"
    | "invalidPosition"
    | "invalidSalary"
    | "closedVacancy"
    | "duplicateApplication"
    | "invalidDate";
};

const optionalText = (max = 500) =>
  z.string().trim().max(max).optional().or(z.literal(""));

const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
  z.number().min(0).optional(),
);

const optionalInt = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
  z.number().int().min(0).optional(),
);

const vacancySchema = z.object({
  title: z.string().trim().min(2).max(160),
  titleAr: optionalText(160),
  departmentId: z.string().min(1),
  positionId: z.string().min(1),
  description: z.string().trim().min(10).max(5000),
  requirements: z.string().trim().min(10).max(5000),
  salaryMin: optionalNumber,
  salaryMax: optionalNumber,
  openings: z.coerce.number().int().min(1).max(100).default(1),
  status: z.enum(["DRAFT", "OPEN", "ON_HOLD", "CLOSED", "FILLED"]).default("DRAFT"),
  closingDate: optionalText(10),
});

const applicationSchema = z.object({
  vacancyId: z.string().min(1),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(160),
  phone: optionalText(30),
  cvUrl: optionalText(500),
  experienceYears: optionalInt,
  education: optionalText(200),
  skills: optionalText(500),
  source: optionalText(80),
  notes: optionalText(1000),
});

const stageSchema = z.object({
  stage: z.enum([
    "APPLIED",
    "SCREENING",
    "INTERVIEW",
    "EVALUATION",
    "OFFER",
    "HIRED",
    "REJECTED",
    "WITHDRAWN",
  ]),
  rating: optionalInt,
  notes: optionalText(1000),
});

const interviewSchema = z.object({
  round: z.coerce.number().int().min(1).max(20).default(1),
  scheduledAt: z.string().min(10),
  durationMinutes: z.coerce.number().int().min(15).max(480).default(60),
  type: z.string().trim().min(2).max(40).default("VIDEO"),
  interviewerId: optionalText(40),
  location: optionalText(200),
  meetingUrl: optionalText(500),
});

const offerSchema = z.object({
  salary: z.coerce.number().positive().max(100_000_000),
  currency: z.string().trim().min(3).max(3).default("YER"),
  startDate: z.string().min(10),
  expiresAt: optionalText(10),
  status: z.enum(["DRAFT", "SENT", "ACCEPTED", "DECLINED", "EXPIRED"]).default("DRAFT"),
});

const STAGE_ORDER = [
  "APPLIED",
  "SCREENING",
  "INTERVIEW",
  "EVALUATION",
  "OFFER",
  "HIRED",
] as const;

function dateOnly(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function yemenDateTime(value: string) {
  const normalized = value.length === 16 ? `${value}:00` : value;
  const date = new Date(`${normalized}+03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseSkills(value: string | undefined) {
  return [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((skill) => skill.trim())
        .filter(Boolean),
    ),
  ];
}

function stageIndex(stage: string) {
  return STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
}

function done(locale: string) {
  revalidatePath(`/${locale}/recruitment`);
  revalidatePath(`/${locale}/dashboard`);
}

export async function createVacancyAction(
  locale: string,
  input: unknown,
): Promise<RecruitmentActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "recruitment.create")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = vacancySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  const [company, department, position] = await Promise.all([
    prisma.company.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.department.findFirst({ where: { id: data.departmentId, deletedAt: null } }),
    prisma.position.findFirst({ where: { id: data.positionId, deletedAt: null, isActive: true } }),
  ]);
  if (!company || !department || !position) return { ok: false, error: "notFound" };
  if (position.departmentId !== department.id) return { ok: false, error: "invalidPosition" };
  if (
    data.salaryMin !== undefined &&
    data.salaryMax !== undefined &&
    data.salaryMin > data.salaryMax
  ) {
    return { ok: false, error: "invalidSalary" };
  }

  const closingDate = data.closingDate ? dateOnly(data.closingDate) : null;
  if (data.closingDate && !closingDate) return { ok: false, error: "invalidDate" };

  const vacancy = await prisma.jobVacancy.create({
    data: {
      companyId: company.id,
      departmentId: department.id,
      positionId: position.id,
      title: data.title,
      titleAr: data.titleAr || null,
      description: data.description,
      requirements: data.requirements,
      salaryMin: data.salaryMin ?? null,
      salaryMax: data.salaryMax ?? null,
      openings: data.openings,
      status: data.status,
      closingDate,
      postedAt: data.status === "OPEN" ? new Date() : null,
      createdById: user.id,
    },
  });

  await writeAudit({
    userId: user.id,
    action: "CREATE",
    entity: "JobVacancy",
    entityId: vacancy.id,
    newData: { title: vacancy.title, status: vacancy.status, openings: vacancy.openings },
  });

  done(locale);
  return { ok: true };
}

export async function updateVacancyAction(
  locale: string,
  vacancyId: string,
  input: unknown,
): Promise<RecruitmentActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "recruitment.update")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = vacancySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  const vacancy = await prisma.jobVacancy.findUnique({ where: { id: vacancyId } });
  if (!vacancy) return { ok: false, error: "notFound" };

  const [department, position] = await Promise.all([
    prisma.department.findFirst({ where: { id: data.departmentId, deletedAt: null } }),
    prisma.position.findFirst({ where: { id: data.positionId, deletedAt: null, isActive: true } }),
  ]);
  if (!department || !position) return { ok: false, error: "notFound" };
  if (position.departmentId !== department.id) return { ok: false, error: "invalidPosition" };
  if (
    data.salaryMin !== undefined &&
    data.salaryMax !== undefined &&
    data.salaryMin > data.salaryMax
  ) {
    return { ok: false, error: "invalidSalary" };
  }

  const closingDate = data.closingDate ? dateOnly(data.closingDate) : null;
  if (data.closingDate && !closingDate) return { ok: false, error: "invalidDate" };

  await prisma.jobVacancy.update({
    where: { id: vacancyId },
    data: {
      departmentId: department.id,
      positionId: position.id,
      title: data.title,
      titleAr: data.titleAr || null,
      description: data.description,
      requirements: data.requirements,
      salaryMin: data.salaryMin ?? null,
      salaryMax: data.salaryMax ?? null,
      openings: data.openings,
      status: data.status,
      closingDate,
      postedAt:
        data.status === "OPEN" && !vacancy.postedAt ? new Date() : vacancy.postedAt,
    },
  });

  await writeAudit({
    userId: user.id,
    action: "UPDATE",
    entity: "JobVacancy",
    entityId: vacancyId,
    oldData: { title: vacancy.title, status: vacancy.status, openings: vacancy.openings },
    newData: { title: data.title, status: data.status, openings: data.openings },
  });

  done(locale);
  return { ok: true };
}

export async function createApplicationAction(
  locale: string,
  input: unknown,
): Promise<RecruitmentActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "recruitment.create")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = applicationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  const vacancy = await prisma.jobVacancy.findUnique({ where: { id: data.vacancyId } });
  if (!vacancy) return { ok: false, error: "notFound" };
  if (vacancy.status === "CLOSED" || vacancy.status === "FILLED") {
    return { ok: false, error: "closedVacancy" };
  }

  const email = data.email.toLowerCase();
  const existingCandidate = await prisma.candidate.findUnique({ where: { email } });
  if (existingCandidate) {
    const duplicate = await prisma.candidateApplication.findUnique({
      where: {
        vacancyId_candidateId: {
          vacancyId: vacancy.id,
          candidateId: existingCandidate.id,
        },
      },
    });
    if (duplicate) return { ok: false, error: "duplicateApplication" };
  }

  const application = await prisma.$transaction(async (tx) => {
    const candidate =
      existingCandidate ??
      (await tx.candidate.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email,
          phone: data.phone || null,
          cvUrl: data.cvUrl || null,
          experienceYears: data.experienceYears ?? null,
          education: data.education || null,
          skills: parseSkills(data.skills),
          source: data.source || null,
          notes: data.notes || null,
        },
      }));

    return tx.candidateApplication.create({
      data: {
        vacancyId: vacancy.id,
        candidateId: candidate.id,
        stage: "APPLIED",
        status: "ACTIVE",
        notes: data.notes || null,
      },
      include: { candidate: true },
    });
  });

  await writeAudit({
    userId: user.id,
    action: "CREATE",
    entity: "CandidateApplication",
    entityId: application.id,
    newData: {
      vacancyId: vacancy.id,
      candidate: `${application.candidate.firstName} ${application.candidate.lastName}`,
      stage: application.stage,
    },
  });

  done(locale);
  return { ok: true };
}

export async function updateApplicationStageAction(
  locale: string,
  applicationId: string,
  input: unknown,
): Promise<RecruitmentActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "recruitment.update")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = stageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  const application = await prisma.candidateApplication.findUnique({
    where: { id: applicationId },
    include: { vacancy: true },
  });
  if (!application) return { ok: false, error: "notFound" };

  const status =
    data.stage === "HIRED"
      ? "HIRED"
      : data.stage === "REJECTED"
        ? "REJECTED"
        : data.stage === "WITHDRAWN"
          ? "WITHDRAWN"
          : "ACTIVE";

  await prisma.$transaction(async (tx) => {
    await tx.candidateApplication.update({
      where: { id: applicationId },
      data: {
        stage: data.stage,
        status,
        rating: data.rating ?? null,
        notes: data.notes || null,
        rejectionReason: data.stage === "REJECTED" ? data.notes || null : null,
      },
    });

    if (data.stage === "HIRED") {
      const hired = await tx.candidateApplication.count({
        where: { vacancyId: application.vacancyId, status: "HIRED" },
      });
      if (hired >= application.vacancy.openings) {
        await tx.jobVacancy.update({
          where: { id: application.vacancyId },
          data: { status: "FILLED" },
        });
      }
    } else if (application.vacancy.status === "FILLED") {
      const hired = await tx.candidateApplication.count({
        where: { vacancyId: application.vacancyId, status: "HIRED" },
      });
      if (hired < application.vacancy.openings) {
        await tx.jobVacancy.update({
          where: { id: application.vacancyId },
          data: { status: "OPEN" },
        });
      }
    }
  });

  await writeAudit({
    userId: user.id,
    action: "UPDATE",
    entity: "CandidateApplication",
    entityId: applicationId,
    oldData: { stage: application.stage, status: application.status },
    newData: { stage: data.stage, status, rating: data.rating ?? null },
  });

  done(locale);
  return { ok: true };
}

export async function scheduleInterviewAction(
  locale: string,
  applicationId: string,
  input: unknown,
): Promise<RecruitmentActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "recruitment.update")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = interviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  const scheduledAt = yemenDateTime(data.scheduledAt);
  if (!scheduledAt) return { ok: false, error: "invalidDate" };

  const application = await prisma.candidateApplication.findUnique({
    where: { id: applicationId },
    include: { candidate: true, vacancy: true },
  });
  if (!application) return { ok: false, error: "notFound" };
  if (application.status !== "ACTIVE") return { ok: false, error: "closedVacancy" };

  const interviewerId = data.interviewerId || null;
  if (interviewerId) {
    const interviewer = await prisma.user.findFirst({
      where: { id: interviewerId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!interviewer) return { ok: false, error: "notFound" };
  }

  const interview = await prisma.$transaction(async (tx) => {
    const created = await tx.interview.create({
      data: {
        applicationId,
        round: data.round,
        scheduledAt,
        durationMinutes: data.durationMinutes,
        type: data.type.toUpperCase(),
        interviewerId,
        location: data.location || null,
        meetingUrl: data.meetingUrl || null,
      },
    });

    if (stageIndex(application.stage) < stageIndex("INTERVIEW")) {
      await tx.candidateApplication.update({
        where: { id: applicationId },
        data: { stage: "INTERVIEW", status: "ACTIVE" },
      });
    }

    if (interviewerId) {
      await tx.notification.create({
        data: {
          userId: interviewerId,
          type: "GENERAL",
          title: "Interview scheduled",
          titleAr: "تمت جدولة مقابلة",
          message: `${application.candidate.firstName} ${application.candidate.lastName} — ${application.vacancy.title} on ${scheduledAt.toISOString()}.`,
          messageAr: `مقابلة ${application.candidate.firstName} ${application.candidate.lastName} لوظيفة ${application.vacancy.titleAr ?? application.vacancy.title}.`,
          link: "/recruitment",
        },
      });
    }

    return created;
  });

  await writeAudit({
    userId: user.id,
    action: "CREATE",
    entity: "Interview",
    entityId: interview.id,
    newData: {
      applicationId,
      round: data.round,
      scheduledAt: scheduledAt.toISOString(),
      interviewerId,
    },
  });

  done(locale);
  return { ok: true };
}

export async function saveOfferAction(
  locale: string,
  applicationId: string,
  input: unknown,
): Promise<RecruitmentActionResult> {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "recruitment.update")) {
    return { ok: false, error: "unauthorized" };
  }

  const parsed = offerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const data = parsed.data;

  const startDate = dateOnly(data.startDate);
  const expiresAt = data.expiresAt ? dateOnly(data.expiresAt) : null;
  if (!startDate || (data.expiresAt && !expiresAt)) {
    return { ok: false, error: "invalidDate" };
  }

  const application = await prisma.candidateApplication.findUnique({
    where: { id: applicationId },
    include: { vacancy: true, offer: true },
  });
  if (!application) return { ok: false, error: "notFound" };
  if (application.status !== "ACTIVE") return { ok: false, error: "closedVacancy" };

  const offer = await prisma.$transaction(async (tx) => {
    const saved = application.offer
      ? await tx.jobOffer.update({
          where: { id: application.offer.id },
          data: {
            salary: data.salary,
            currency: data.currency.toUpperCase(),
            startDate,
            expiresAt,
            status: data.status,
          },
        })
      : await tx.jobOffer.create({
          data: {
            applicationId,
            salary: data.salary,
            currency: data.currency.toUpperCase(),
            startDate,
            expiresAt,
            status: data.status,
            createdById: user.id,
          },
        });

    if (stageIndex(application.stage) < stageIndex("OFFER")) {
      await tx.candidateApplication.update({
        where: { id: applicationId },
        data: { stage: "OFFER", status: "ACTIVE" },
      });
    }

    return saved;
  });

  await writeAudit({
    userId: user.id,
    action: application.offer ? "UPDATE" : "CREATE",
    entity: "JobOffer",
    entityId: offer.id,
    oldData: application.offer
      ? { salary: application.offer.salary, status: application.offer.status }
      : undefined,
    newData: {
      applicationId,
      salary: data.salary,
      currency: data.currency.toUpperCase(),
      status: data.status,
    },
  });

  done(locale);
  return { ok: true };
}
