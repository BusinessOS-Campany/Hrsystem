"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { requestLeaveAction } from "@/app/[locale]/(app)/leave/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarPlus, Loader2 } from "lucide-react";

type LeaveTypeOption = {
  id: string;
  name: string;
  nameAr: string;
  requiresHrApproval: boolean;
  isPaid: boolean;
  maxDaysPerYear: number | null;
};

export function LeaveRequestForm({
  locale,
  leaveTypes,
}: {
  locale: string;
  leaveTypes: LeaveTypeOption[];
}) {
  const t = useTranslations("leave");
  const common = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const selectedType = leaveTypes.find((type) => type.id === leaveTypeId);

  function errorMessage(error?: string) {
    switch (error) {
      case "invalidDates":
        return t("invalidDates");
      case "overlap":
        return t("overlapError");
      case "insufficientBalance":
        return t("insufficientBalance");
      case "noEmployee":
        return t("noEmployee");
      case "notFound":
        return common("noResults");
      case "conflict":
        return t("alreadyReviewed");
      default:
        return common("error");
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const formData = new FormData();
      formData.set("leaveTypeId", leaveTypeId);
      formData.set("startDate", startDate);
      formData.set("endDate", endDate);
      formData.set("reason", reason);
      const result = await requestLeaveAction(locale, formData);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("requestSubmitted"));
      setLeaveTypeId("");
      setStartDate("");
      setEndDate("");
      setReason("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="leaveType">{t("leaveType")}</Label>
        <Select value={leaveTypeId} onValueChange={setLeaveTypeId} required>
          <SelectTrigger id="leaveType" className="w-full">
            <SelectValue placeholder={t("leaveType")} />
          </SelectTrigger>
          <SelectContent>
            {leaveTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {locale === "ar" ? type.nameAr : type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedType && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Badge variant="secondary">
              {selectedType.isPaid ? t("paid") : t("unpaid")}
            </Badge>
            {selectedType.requiresHrApproval && (
              <Badge variant="outline">{t("requiresHr")}</Badge>
            )}
            <span className="text-[11px] text-muted-foreground">
              {selectedType.maxDaysPerYear === null
                ? t("unlimited")
                : `${t("maxDays")}: ${selectedType.maxDaysPerYear}`}
            </span>
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startDate">{t("startDate")}</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(event) => {
              setStartDate(event.target.value);
              if (!endDate || event.target.value > endDate) {
                setEndDate(event.target.value);
              }
            }}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">{t("endDate")}</Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            min={startDate}
            onChange={(event) => setEndDate(event.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reason">{t("reason")}</Label>
        <Textarea
          id="reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          minLength={3}
          maxLength={500}
          required
        />
        <p className="text-end text-[11px] text-muted-foreground">
          {reason.length}/500
        </p>
      </div>
      <p className="text-xs text-muted-foreground">{t("workdaysHint")}</p>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CalendarPlus className="size-4" />
        )}
        {t("request")}
      </Button>
    </form>
  );
}
