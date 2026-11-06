"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SettingsValue = string | boolean;

export type SettingsField = {
  name: string;
  label: string;
  type?:
    | "text"
    | "email"
    | "tel"
    | "url"
    | "number"
    | "date"
    | "time"
    | "datetime-local"
    | "textarea"
    | "select"
    | "switch"
    | "checkboxes";
  required?: boolean;
  options?: { value: string; label: string; group?: string }[];
  placeholder?: string;
  help?: string;
  dir?: "ltr" | "rtl";
  min?: string;
  max?: string;
  step?: string;
  colSpan?: 1 | 2;
};

export type SettingsActionResult = {
  ok: boolean;
  error?: string;
};

export function SettingsDialog({
  title,
  description,
  triggerLabel,
  triggerIcon = "edit",
  triggerVariant = "outline",
  triggerSize = "sm",
  submitLabel,
  successMessage,
  fields,
  initial,
  action,
  errorMessages,
  wide = false,
}: {
  title: string;
  description?: string;
  triggerLabel?: string;
  triggerIcon?: "plus" | "edit";
  triggerVariant?: "default" | "outline" | "secondary" | "ghost";
  triggerSize?: "default" | "sm" | "xs" | "icon-sm";
  submitLabel?: string;
  successMessage: string;
  fields: SettingsField[];
  initial: Record<string, SettingsValue>;
  action: (values: Record<string, SettingsValue>) => Promise<SettingsActionResult>;
  errorMessages?: Record<string, string>;
  wide?: boolean;
}) {
  const common = useTranslations("common");
  const settings = useTranslations("settings");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, SettingsValue>>(initial);

  function set(name: string, value: SettingsValue) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function toggleList(name: string, value: string, checked: boolean) {
    const current = String(values[name] ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const next = checked
      ? [...new Set([...current, value])]
      : current.filter((item) => item !== value);
    set(name, next.join(","));
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) setValues(initial);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await action(values);
      if (!result.ok) {
        const message =
          (result.error ? errorMessages?.[result.error] : undefined) ??
          (result.error === "duplicate"
            ? settings("duplicateCode")
            : result.error === "selfEdit"
              ? settings("selfEdit")
              : result.error === "lastAdmin"
                ? settings("lastAdmin")
                : result.error === "systemRole"
                  ? settings("systemRole")
                  : result.error === "invalidRole"
                    ? settings("invalidRole")
                    : result.error === "validation"
                      ? common("requiredField")
                      : common("error"));
        toast.error(message);
        return;
      }
      toast.success(successMessage);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize}>
          {triggerIcon === "plus" ? <Plus /> : <Pencil />}
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent
        className={`flex flex-col gap-0 overflow-hidden p-0 ${wide ? "sm:max-w-3xl" : "sm:max-w-2xl"}`}
      >
        <DialogHeader className="shrink-0 border-b px-4 py-3 pe-12">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <div
                  key={field.name}
                  className={field.colSpan === 2 ? "space-y-2 sm:col-span-2" : "space-y-2"}
                >
                {field.type !== "switch" && <Label>{field.label}</Label>}
                {field.type === "textarea" ? (
                  <Textarea
                    value={String(values[field.name] ?? "")}
                    onChange={(event) => set(field.name, event.target.value)}
                    required={field.required}
                    placeholder={field.placeholder}
                    dir={field.dir}
                    rows={3}
                  />
                ) : field.type === "select" ? (
                  <Select
                    value={String(values[field.name] ?? "")}
                    onValueChange={(value) => set(field.name, value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options?.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === "switch" ? (
                  <label className="flex min-h-9 items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                    <span>{field.label}</span>
                    <Switch
                      checked={Boolean(values[field.name])}
                      onCheckedChange={(checked) => set(field.name, checked)}
                    />
                  </label>
                ) : field.type === "checkboxes" ? (
                  <div className="max-h-56 space-y-3 overflow-y-auto rounded-md border p-3">
                    {field.options?.map((option, index) => {
                      const previous = field.options?.[index - 1];
                      const showGroup = option.group && option.group !== previous?.group;
                      const selected = String(values[field.name] ?? "")
                        .split(",")
                        .map((item) => item.trim())
                        .includes(option.value);
                      return (
                        <div key={option.value} className="space-y-2">
                          {showGroup && (
                            <p className="text-xs font-semibold text-muted-foreground">
                              {option.group}
                            </p>
                          )}
                          <label className="flex items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(event) =>
                                toggleList(field.name, option.value, event.target.checked)
                              }
                              className="mt-0.5 size-4 rounded border"
                            />
                            <span>{option.label}</span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Input
                    type={field.type ?? "text"}
                    value={String(values[field.name] ?? "")}
                    onChange={(event) => set(field.name, event.target.value)}
                    required={field.required}
                    placeholder={field.placeholder}
                    dir={field.dir}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                  />
                )}
                {field.help && (
                  <p className="text-xs text-muted-foreground">{field.help}</p>
                )}
              </div>
              ))}
            </div>
          </div>
          <DialogFooter className="m-0 shrink-0 rounded-b-xl border-t p-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              {common("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {submitLabel ?? common("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


export const FormDialog = SettingsDialog;
export type FormValue = SettingsValue;
export type FormField = SettingsField;
export type FormActionResult = SettingsActionResult;
