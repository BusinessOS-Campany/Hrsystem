"use client";

import { useTranslations } from "next-intl";
import { Eye } from "lucide-react";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type LeaveDetails = {
  requestNo: string;
  employeeName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  managerComment: string | null;
  hrComment: string | null;
  managerReviewedAt: string | null;
  hrReviewedAt: string | null;
  approvedAt: string | null;
};

export function LeaveDetailsDialog({
  locale,
  details,
}: {
  locale: string;
  details: LeaveDetails;
}) {
  const t = useTranslations("leave");
  const common = useTranslations("common");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost">
          <Eye />
          {common("details")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("requestDetails")}</DialogTitle>
          <DialogDescription>{details.requestNo}</DialogDescription>
        </DialogHeader>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{t("requestedBy")}</dt>
            <dd className="font-medium">{details.employeeName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("leaveType")}</dt>
            <dd className="font-medium">{details.leaveTypeName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("startDate")}</dt>
            <dd>{formatDate(details.startDate, locale)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("endDate")}</dt>
            <dd>{formatDate(details.endDate, locale)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("days")}</dt>
            <dd>{formatNumber(details.days, locale)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{common("status")}</dt>
            <dd>
              <StatusBadge value={details.status} group="leaveStatus" />
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">{t("reason")}</dt>
            <dd className="break-words rounded-md border bg-muted/40 p-2">
              {details.reason}
            </dd>
          </div>
        </dl>

        <div className="space-y-3 rounded-lg border p-3">
          <h3 className="text-sm font-semibold">{t("approvalHistory")}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
              <span className="font-medium">{t("managerReview")}</span>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(details.managerReviewedAt, locale)}
              </span>
            </div>
            {details.managerComment && (
              <p className="break-words rounded-md bg-muted/50 p-2 text-xs">
                {details.managerComment}
              </p>
            )}
            <div className="flex flex-col gap-0.5 border-t pt-2 sm:flex-row sm:justify-between">
              <span className="font-medium">{t("hrReview")}</span>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(details.hrReviewedAt ?? details.approvedAt, locale)}
              </span>
            </div>
            {details.hrComment && (
              <p className="break-words rounded-md bg-muted/50 p-2 text-xs">
                {details.hrComment}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
