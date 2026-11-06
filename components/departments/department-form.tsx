"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createDepartmentAction } from "@/app/[locale]/(app)/departments/actions";
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

export function DepartmentForm({
  locale,
  branches,
  parents,
  managers,
}: {
  locale: string;
  branches: Option[];
  parents: Option[];
  managers: Option[];
}) {
  const t = useTranslations("departments");
  const common = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    nameAr: "",
    code: "",
    branchId: branches[0]?.id ?? "",
    parentId: "",
    managerId: "",
    description: "",
  });

  function set(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createDepartmentAction(locale, {
        ...form,
        branchId: form.branchId || undefined,
        parentId: form.parentId || undefined,
        managerId: form.managerId || undefined,
      });
      if (!result.ok) {
        toast.error(result.error === "duplicate" ? common("error") : common("requiredField"));
        return;
      }
      toast.success(t("created"));
      router.push(`/${locale}/departments`);
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
        <Field label={t("code")}>
          <Input value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} required />
        </Field>
        <Field label={common("branch")}>
          <Select value={form.branchId} onValueChange={(value) => set("branchId", value)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {locale === "ar" && branch.nameAr ? branch.nameAr : branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("parent")}>
          <Select value={form.parentId || "none"} onValueChange={(value) => set("parentId", value === "none" ? "" : value)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{common("none")}</SelectItem>
              {parents.map((parent) => (
                <SelectItem key={parent.id} value={parent.id}>
                  {locale === "ar" && parent.nameAr ? parent.nameAr : parent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("manager")}>
          <Select value={form.managerId || "none"} onValueChange={(value) => set("managerId", value === "none" ? "" : value)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{common("none")}</SelectItem>
              {managers.map((manager) => (
                <SelectItem key={manager.id} value={manager.id}>
                  {locale === "ar" && manager.nameAr ? manager.nameAr : manager.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
