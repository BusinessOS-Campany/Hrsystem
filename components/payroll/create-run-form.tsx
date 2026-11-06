"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createRunAction } from "@/app/[locale]/(app)/payroll/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calculator, Loader2 } from "lucide-react";

export function CreateRunForm({
  locale,
  periods,
}: {
  locale: string;
  periods: { id: string; name: string }[];
}) {
  const t = useTranslations("payroll");
  const common = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createRunAction(locale, periodId);
      if (!result.ok) {
        setError(result.error === "invalidStatus" ? t("runExists") : common("error"));
        toast.error(result.error === "invalidStatus" ? t("runExists") : common("error"));
        return;
      }
      toast.success(t("runCreated"));
      router.push(`/${locale}/payroll/${result.runId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label>{t("selectPeriod")}</Label>
        <Select value={periodId} onValueChange={setPeriodId}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {periods.map((period) => (
              <SelectItem key={period.id} value={period.id}>{period.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Alert>
        <AlertDescription className="text-xs">{t("calculateConfirm")}</AlertDescription>
      </Alert>
      <Button type="submit" disabled={pending || !periodId} className="w-full">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
        {t("calculate")}
      </Button>
    </form>
  );
}
