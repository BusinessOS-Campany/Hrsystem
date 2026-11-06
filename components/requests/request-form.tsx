"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createRequestAction } from "@/app/[locale]/(app)/requests/actions";
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
import { Loader2, Send } from "lucide-react";

const TYPES = [
  "SALARY_CERTIFICATE",
  "EMPLOYMENT_CERTIFICATE",
  "ADVANCE",
  "LOAN",
  "EXPENSE",
  "DOCUMENT",
  "OTHER",
] as const;

export function RequestForm({ locale }: { locale: string }) {
  const t = useTranslations("requests");
  const common = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [amount, setAmount] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const formData = new FormData();
      formData.set("type", type);
      formData.set("subject", subject);
      formData.set("details", details);
      formData.set("amount", amount);
      const result = await createRequestAction(locale, formData);
      if (!result.ok) {
        toast.error(common("error"));
        return;
      }
      toast.success(t("requestSubmitted"));
      setType("");
      setSubject("");
      setDetails("");
      setAmount("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label>{t("type")}</Label>
        <Select value={type} onValueChange={setType} required>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("type")} />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((item) => (
              <SelectItem key={item} value={item}>
                {item.toLowerCase().replaceAll("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="subject">{t("subject")}</Label>
        <Input
          id="subject"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="details">{t("details")}</Label>
        <Textarea
          id="details"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          rows={2}
        />
      </div>
      {(type === "ADVANCE" || type === "LOAN" || type === "EXPENSE") && (
        <div className="space-y-2">
          <Label htmlFor="amount">{t("amount")}</Label>
          <Input
            id="amount"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        {t("newRequest")}
      </Button>
    </form>
  );
}
