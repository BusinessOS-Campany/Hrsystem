"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createPositionAction } from "@/app/[locale]/(app)/positions/actions";
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
import { Loader2, Plus } from "lucide-react";

type Option = { id: string; name: string; nameAr?: string | null };

export function PositionForm({
  locale,
  departments,
}: {
  locale: string;
  departments: Option[];
}) {
  const t = useTranslations("positions");
  const common = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    nameAr: "",
    code: "",
    departmentId: departments[0]?.id ?? "",
    grade: "",
    description: "",
    minSalary: "",
    maxSalary: "",
  });

  function set(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createPositionAction(locale, {
        ...form,
        minSalary: form.minSalary ? Number(form.minSalary) : undefined,
        maxSalary: form.maxSalary ? Number(form.maxSalary) : undefined,
        grade: form.grade || undefined,
        description: form.description || undefined,
      });
      if (!result.ok) {
        toast.error(
          result.error === "salaryBand"
            ? t("salaryBandError")
            : result.error === "duplicate"
              ? common("error")
              : common("requiredField"),
        );
        return;
      }
      toast.success(t("created"));
      router.push(`/${locale}/positions`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-2xl space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("name")}>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </Field>
        <Field label={`${t("name")} (AR)`}>
          <Input value={form.nameAr} onChange={(e) => set("nameAr", e.target.value)} dir="rtl" required />
        </Field>
        <Field label={common("code")}>
          <Input value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} required />
        </Field>
        <Field label={t("department")}>
          <Select value={form.departmentId} onValueChange={(value) => set("departmentId", value)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {locale === "ar" && department.nameAr ? department.nameAr : department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("grade")}>
          <Input value={form.grade} onChange={(e) => set("grade", e.target.value)} />
        </Field>
        <Field label={t("minSalary")}>
          <Input type="number" min="0" step="0.01" value={form.minSalary} onChange={(e) => set("minSalary", e.target.value)} />
        </Field>
        <Field label={t("maxSalary")}>
          <Input type="number" min="0" step="0.01" value={form.maxSalary} onChange={(e) => set("maxSalary", e.target.value)} />
        </Field>
      </div>
      <Field label={common("description")}>
        <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          {common("cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {common("create")}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
