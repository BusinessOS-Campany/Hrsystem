"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  createEmployeeAction,
  updateEmployeeAction,
  type EmployeeActionResult,
} from "@/app/[locale]/(app)/employees/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Save, UserRoundPlus } from "lucide-react";

type Option = { id: string; name: string; nameAr?: string | null };

type PositionOption = Option & { departmentId: string };

type InitialEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  firstNameAr: string | null;
  lastNameAr: string | null;
  email: string;
  phone: string | null;
  gender: string;
  dateOfBirth: string | null;
  nationality: string | null;
  nationalId: string | null;
  maritalStatus: string;
  address: string | null;
  city: string | null;
  country: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  emergencyRelation: string | null;
  branchId: string;
  departmentId: string;
  positionId: string;
  managerId: string | null;
  employmentType: string;
  hireDate: string;
  basicSalary: string;
};

type Props = {
  locale: string;
  mode: "create" | "edit";
  initial?: InitialEmployee;
  branches: Option[];
  departments: Option[];
  positions: PositionOption[];
  managers: Option[];
  roles: { code: string; name: string; nameAr: string | null }[];
};

const EMPTY = {
  firstName: "",
  lastName: "",
  firstNameAr: "",
  lastNameAr: "",
  email: "",
  phone: "",
  gender: "MALE",
  dateOfBirth: "",
  nationality: "Yemeni",
  nationalId: "",
  maritalStatus: "SINGLE",
  address: "",
  city: "",
  country: "Yemen",
  emergencyName: "",
  emergencyPhone: "",
  emergencyRelation: "",
  branchId: "",
  departmentId: "",
  positionId: "",
  managerId: "",
  employmentType: "FULL_TIME",
  hireDate: new Date().toISOString().slice(0, 10),
  basicSalary: "0",
  createAccount: false,
  roleCode: "EMPLOYEE",
};

export function EmployeeForm({
  locale,
  mode,
  initial,
  branches,
  departments,
  positions,
  managers,
  roles,
}: Props) {
  const t = useTranslations("employees");
  const common = useTranslations("common");
  const genderT = useTranslations("enums.gender");
  const maritalT = useTranslations("enums.maritalStatus");
  const employmentT = useTranslations("enums.employmentType");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initialDepartmentId = initial?.departmentId ?? departments[0]?.id ?? "";
  const initialPositionId =
    initial &&
    positions.some(
      (position) =>
        position.id === initial.positionId &&
        position.departmentId === initial.departmentId,
    )
      ? initial.positionId
      : "";
  const [form, setForm] = useState(
    initial
      ? {
          ...EMPTY,
          ...initial,
          positionId: initialPositionId,
          firstNameAr: initial.firstNameAr ?? "",
          lastNameAr: initial.lastNameAr ?? "",
          phone: initial.phone ?? "",
          dateOfBirth: initial.dateOfBirth ?? "",
          nationality: initial.nationality ?? "",
          nationalId: initial.nationalId ?? "",
          address: initial.address ?? "",
          city: initial.city ?? "",
          country: initial.country ?? "",
          emergencyName: initial.emergencyName ?? "",
          emergencyPhone: initial.emergencyPhone ?? "",
          emergencyRelation: initial.emergencyRelation ?? "",
          managerId: initial.managerId ?? "",
        }
      : {
          ...EMPTY,
          branchId: branches[0]?.id ?? "",
          departmentId: initialDepartmentId,
          positionId: initialPositionId,
        },
  );
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const positionsForDepartment = positions.filter(
    (position) => position.departmentId === form.departmentId,
  );

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function changeDepartment(departmentId: string) {
    setForm((current) => {
      const currentPosition = positions.find(
        (position) => position.id === current.positionId,
      );
      return {
        ...current,
        departmentId,
        positionId:
          currentPosition?.departmentId === departmentId
            ? current.positionId
            : "",
      };
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload = {
        ...form,
        dateOfBirth: form.dateOfBirth || undefined,
        managerId: form.managerId || undefined,
      };
      const result: EmployeeActionResult =
        mode === "create"
          ? await createEmployeeAction(locale, payload)
          : await updateEmployeeAction(locale, initial?.id ?? "", payload);

      if (!result.ok) {
        const message =
          result.error === "invalidOrg"
            ? t("invalidOrg")
            : result.error === "duplicateEmail"
              ? common("error")
              : result.error === "roleForbidden"
                ? common("error")
                : result.error === "validation"
                  ? common("requiredField")
                  : common("error");
        setError(message);
        toast.error(message);
        return;
      }

      toast.success(mode === "create" ? t("employeeCreated") : t("employeeUpdated"));
      if (result.tempPassword) {
        setCreatedId(result.employeeId ?? null);
        setTempPassword(result.tempPassword);
        return;
      }
      router.push(`/${locale}/employees/${result.employeeId ?? initial?.id ?? ""}`);
      router.refresh();
    });
  }

  if (tempPassword) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Alert>
          <AlertDescription className="space-y-2">
            <p>{t("employeeCreated")}</p>
            <p className="text-xs text-muted-foreground">{common("notes")}</p>
            <code className="block rounded-md bg-muted px-3 py-2 font-mono text-sm">
              {tempPassword}
            </code>
          </AlertDescription>
        </Alert>
        <Button
          onClick={() => {
            router.push(`/${locale}/employees/${createdId ?? initial?.id ?? ""}`);
            router.refresh();
          }}
        >
          {common("next")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("personalInfo")}</CardTitle>
          <CardDescription>{t("nameFieldsHint")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label={t("firstName")}>
            <Input
              dir="ltr"
              lang="en"
              autoComplete="given-name"
              placeholder={t("firstNamePlaceholder")}
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              required
            />
          </Field>
          <Field label={t("lastName")}>
            <Input
              dir="ltr"
              lang="en"
              autoComplete="family-name"
              placeholder={t("lastNamePlaceholder")}
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              required
            />
          </Field>
          <Field label={t("firstNameAr")}>
            <Input
              dir="rtl"
              lang="ar"
              autoComplete="off"
              placeholder={t("firstNameArPlaceholder")}
              value={form.firstNameAr}
              onChange={(e) => set("firstNameAr", e.target.value)}
            />
          </Field>
          <Field label={t("lastNameAr")}>
            <Input
              dir="rtl"
              lang="ar"
              autoComplete="off"
              placeholder={t("lastNameArPlaceholder")}
              value={form.lastNameAr}
              onChange={(e) => set("lastNameAr", e.target.value)}
            />
          </Field>
          <Field label={t("email")}>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
          </Field>
          <Field label={t("phone")}>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label={t("gender")}>
            <Select value={form.gender} onValueChange={(value) => set("gender", value)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">{genderT("MALE")}</SelectItem>
                <SelectItem value="FEMALE">{genderT("FEMALE")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("dob")}>
            <Input type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
          </Field>
          <Field label={t("nationality")}>
            <Input value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
          </Field>
          <Field label={t("nationalId")}>
            <Input value={form.nationalId} onChange={(e) => set("nationalId", e.target.value)} />
          </Field>
          <Field label={t("maritalStatus")}>
            <Select value={form.maritalStatus} onValueChange={(value) => set("maritalStatus", value)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"].map((value) => (
                  <SelectItem key={value} value={value}>{maritalT(value)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("address")}>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
          <Field label={t("city")}>
            <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label={t("country")}>
            <Input value={form.country} onChange={(e) => set("country", e.target.value)} />
          </Field>
          <Field label={t("emergencyName")}>
            <Input value={form.emergencyName} onChange={(e) => set("emergencyName", e.target.value)} />
          </Field>
          <Field label={t("emergencyPhone")}>
            <Input value={form.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value)} />
          </Field>
          <Field label={t("emergencyRelation")}>
            <Input value={form.emergencyRelation} onChange={(e) => set("emergencyRelation", e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("employmentInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label={t("branch")}>
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
          <Field label={t("department")}>
            <Select value={form.departmentId} onValueChange={changeDepartment}>
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
          <Field label={t("position")}>
            <Select
              value={form.positionId || undefined}
              onValueChange={(value) => set("positionId", value)}
              disabled={positionsForDepartment.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("selectPosition")} />
              </SelectTrigger>
              <SelectContent>
                {positionsForDepartment.map((position) => (
                  <SelectItem key={position.id} value={position.id}>
                    {locale === "ar" && position.nameAr ? position.nameAr : position.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {positionsForDepartment.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {t("noPositionsForDepartment")}
              </p>
            )}
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
          <Field label={t("employmentType")}>
            <Select value={form.employmentType} onValueChange={(value) => set("employmentType", value)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "INTERN"].map((value) => (
                  <SelectItem key={value} value={value}>{employmentT(value)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("hireDate")}>
            <Input type="date" value={form.hireDate} onChange={(e) => set("hireDate", e.target.value)} required />
          </Field>
          <Field label={t("basicSalary")}>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.basicSalary}
              onChange={(e) => set("basicSalary", e.target.value)}
              required
            />
          </Field>
        </CardContent>
      </Card>

      {mode === "create" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("userAccount")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.createAccount}
                onChange={(e) => set("createAccount", e.target.checked)}
                className="size-4 rounded border"
              />
              {t("createAccount")}
            </label>
            {form.createAccount && (
              <Field label={t("role")}>
                <Select value={form.roleCode} onValueChange={(value) => set("roleCode", value)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.code} value={role.code}>
                        {locale === "ar" && role.nameAr ? role.nameAr : role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          {common("cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : mode === "create" ? <UserRoundPlus className="size-4" /> : <Save className="size-4" />}
          {mode === "create" ? common("create") : common("save")}
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
