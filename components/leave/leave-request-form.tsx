"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { requestLeaveAction } from "@/app/[locale]/(app)/leave/actions";
import { Button } from "@/components/ui/button";
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

export function LeaveRequestForm({
  locale,
  leaveTypes,
}: {
  locale: string;
  leaveTypes: { id: string; name: string; nameAr: string }[];
}) {
  const t = useTranslations("leave");
  const common = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

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
        const message = {
          invalidDates: t("invalidDates"),
          overlap: t("overlapError"),
          insufficientBalance: t("insufficientBalance"),
          noEmployee: common("error"),
          unauthorized: common("error"),
          notFound: common("error"),
          forbidden: common("error"),
        }[result.error ?? "unauthorized"];
        toast.error(message);
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
        <Label>{t("leaveType")}</Label>
        <Select value={leaveTypeId} onValueChange={setLeaveTypeId} required>
          <SelectTrigger className="w-full">
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
              if (!endDate || event.target.value > endDate) setEndDate(event.target.value);
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
          rows={2}
          required
        />
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
