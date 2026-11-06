"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type EnumGroup =
  | "employmentStatus"
  | "attendanceStatus"
  | "leaveStatus"
  | "payrollStatus"
  | "requestStatus"
  | "requestType"
  | "applicationStage"
  | "vacancyStatus"
  | "assetStatus"
  | "assetCondition"
  | "lifecycleStatus"
  | "reviewStatus"
  | "goalStatus"
  | "courseStatus"
  | "enrollmentStatus"
  | "offerStatus"
  | "interviewStatus"
  | "installmentStatus"
  | "loanStatus"
  | "offboardingType"
  | "documentType"
  | "employmentType"
  | "auditAction"
  | "gender"
  | "maritalStatus";

const POSITIVE = new Set([
  "ACTIVE", "PRESENT", "APPROVED", "PAID", "COMPLETED", "HIRED", "OPEN",
  "AVAILABLE", "GOOD", "NEW", "ACHIEVED", "ENROLLED", "FINALIZED", "FILLED",
]);
const WARNING = new Set([
  "PROBATION", "LATE", "PENDING_MANAGER", "PENDING_HR", "PENDING", "DRAFT",
  "CALCULATED", "REVIEW", "ON_HOLD", "MAINTENANCE", "FAIR", "IN_PROGRESS",
  "SELF_REVIEW", "MANAGER_REVIEW", "NOT_STARTED", "PLANNED", "RESIGNATION",
  "CONTRACT_EXPIRY", "ADVANCE",
]);
const DANGER = new Set([
  "ABSENT", "REJECTED", "TERMINATED", "LOST", "DAMAGED", "POOR", "MISSED",
  "FAILED", "WITHDRAWN", "CANCELLED", "SUSPENDED", "RETIRED",
]);
const INFO = new Set([
  "ON_LEAVE", "HALF_DAY", "REMOTE", "HOLIDAY", "SCREENING", "INTERVIEW",
  "EVALUATION", "OFFER", "APPLIED", "ASSIGNED", "RESIGNED",
]);

export function StatusBadge({
  value,
  group,
  className,
}: {
  value: string | null | undefined;
  group: EnumGroup;
  className?: string;
}) {
  const t = useTranslations("enums");
  if (!value) return <span className="text-muted-foreground">—</span>;

  const tone = POSITIVE.has(value)
    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    : WARNING.has(value)
      ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      : DANGER.has(value)
        ? "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-400"
        : INFO.has(value)
          ? "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-400"
          : "border-border bg-muted text-muted-foreground";

  return (
    <Badge variant="outline" className={cn("font-medium", tone, className)}>
      {t(`${group}.${value}` as never)}
    </Badge>
  );
}
