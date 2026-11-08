import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { LiveSearch } from "@/components/shared/live-search";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  FormDialog,
  type FormField,
  type FormValue,
} from "@/components/settings/settings-dialog";
import { formatDate, formatMoney, formatNumber, localizedName } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Laptop, PackageCheck, ShieldCheck, Wrench } from "lucide-react";
import {
  assignAssetAction,
  createAssetAction,
  returnAssetAction,
  updateAssetAction,
} from "./actions";

export default async function AssetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const user = await requirePermission("asset.view", locale);
  const t = await getTranslations({ locale, namespace: "assets" });
  const common = await getTranslations({ locale, namespace: "common" });
  const employeesT = await getTranslations({ locale, namespace: "employees" });
  const enums = await getTranslations({ locale, namespace: "enums" });
  const canManage = hasPermission(user, "asset.manage");
  const canViewAll = canManage || hasPermission(user, "employee.view_all");
  const search = query.q?.trim();

  const [assets, employees] = await Promise.all([
    prisma.asset.findMany({
    where: {
      deletedAt: null,
      ...(canViewAll
        ? {}
        : { assignments: { some: { employeeId: user.employeeId ?? "__none__", returnedAt: null } } }),
      ...(search
        ? {
            OR: [
              { assetTag: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
              { category: { contains: search, mode: "insensitive" as const } },
              { brand: { contains: search, mode: "insensitive" as const } },
              { model: { contains: search, mode: "insensitive" as const } },
              { serialNumber: { contains: search, mode: "insensitive" as const } },
              { notes: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    include: {
      assignments: {
        where: { returnedAt: null },
        include: { employee: true },
        take: 1,
      },
    },
    orderBy: [{ status: "asc" }, { assetTag: "asc" }],
    }),
    prisma.employee.findMany({
      where: { deletedAt: null, status: { in: ["ACTIVE", "PROBATION"] } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        firstNameAr: true,
        lastNameAr: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
  ]);

  const assigned = assets.filter((asset) => asset.status === "ASSIGNED").length;
  const available = assets.filter((asset) => asset.status === "AVAILABLE").length;
  const maintenance = assets.filter((asset) => asset.status === "MAINTENANCE").length;
  const totalValue = assets.reduce((sum, asset) => sum + Number(asset.purchaseCost ?? 0), 0);

  const employeeOptions = employees.map((employee) => ({
    value: employee.id,
    label: localizedName(
      locale,
      `${employee.firstName} ${employee.lastName}`,
      `${employee.firstNameAr ?? ""} ${employee.lastNameAr ?? ""}`.trim(),
    ),
  }));
  const categoryOptions = [
    { value: "LAPTOP", label: t("laptop") },
    { value: "PHONE", label: t("phone") },
    { value: "VEHICLE", label: t("vehicle") },
    { value: "MONITOR", label: t("monitor") },
    { value: "EQUIPMENT", label: t("equipment") },
    { value: "ID_CARD", label: t("idCard") },
  ];
  const assetStatusOptions = ["AVAILABLE", "ASSIGNED", "MAINTENANCE", "RETIRED", "LOST"].map(
    (value) => ({ value, label: enums(`assetStatus.${value}` as never) }),
  );
  const conditionOptions = ["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"].map((value) => ({
    value,
    label: enums(`assetCondition.${value}` as never),
  }));
  const errorMessages = {
    duplicate: t("duplicateAsset"),
    notAvailable: t("notAvailable"),
    notAssigned: t("notAssigned"),
    invalidDate: t("invalidDate"),
    notFound: common("noResults"),
    unauthorized: common("error"),
    validation: common("requiredField"),
  };

  function assetFields(): FormField[] {
    return [
      { name: "assetTag", label: t("assetTag"), required: true, dir: "ltr" },
      { name: "name", label: common("name"), required: true },
      {
        name: "category",
        label: t("category"),
        type: "select",
        options: categoryOptions,
        required: true,
      },
      { name: "brand", label: t("brand") },
      { name: "model", label: t("model") },
      { name: "serialNumber", label: t("serialNumber"), dir: "ltr" },
      { name: "purchaseDate", label: t("purchaseDate"), type: "date" },
      {
        name: "purchaseCost",
        label: t("cost"),
        type: "number",
        min: "0",
        step: "0.01",
      },
      {
        name: "status",
        label: common("status"),
        type: "select",
        options: assetStatusOptions,
      },
      {
        name: "condition",
        label: t("condition"),
        type: "select",
        options: conditionOptions,
      },
      {
        name: "notes",
        label: common("notes"),
        type: "textarea",
        colSpan: 2,
      },
    ];
  }

  function assetInitial(asset?: (typeof assets)[number]): Record<string, FormValue> {
    return {
      assetTag: asset?.assetTag ?? "",
      name: asset?.name ?? "",
      category: asset?.category ?? "LAPTOP",
      brand: asset?.brand ?? "",
      model: asset?.model ?? "",
      serialNumber: asset?.serialNumber ?? "",
      purchaseDate: asset?.purchaseDate
        ? asset.purchaseDate.toISOString().slice(0, 10)
        : "",
      purchaseCost: asset?.purchaseCost != null ? String(asset.purchaseCost) : "",
      status: asset?.status ?? "AVAILABLE",
      condition: asset?.condition ?? "NEW",
      notes: asset?.notes ?? "",
    };
  }

  function assignFields(): FormField[] {
    return [
      {
        name: "employeeId",
        label: t("selectEmployee"),
        type: "select",
        options: employeeOptions,
        required: true,
        placeholder: common("none"),
        colSpan: 2,
      },
      {
        name: "notes",
        label: common("notes"),
        type: "textarea",
        colSpan: 2,
      },
    ];
  }

  function returnFields(): FormField[] {
    return [
      {
        name: "returnCondition",
        label: t("returnCondition"),
        type: "select",
        options: conditionOptions,
        required: true,
      },
      {
        name: "notes",
        label: common("notes"),
        type: "textarea",
        colSpan: 2,
      },
    ];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          canManage ? (
            <FormDialog
              title={t("addAsset")}
              description={t("subtitle")}
              triggerLabel={t("addAsset")}
              triggerIcon="plus"
              successMessage={t("assetCreated")}
              fields={assetFields()}
              initial={assetInitial()}
              action={createAssetAction.bind(null, locale)}
              errorMessages={errorMessages}
              wide
            />
          ) : undefined
        }
      />

      <div className="rounded-lg border bg-card p-3">
        <LiveSearch
          initialValue={search}
          placeholder={t("searchPlaceholder")}
          ariaLabel={t("searchPlaceholder")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("totalAssets")}
          value={formatNumber(assets.length, locale)}
          hint={formatMoney(totalValue, locale, "YER")}
          icon={<Laptop className="size-5" />}
          tone="info"
        />
        <StatCard
          label={t("assignedAssets")}
          value={formatNumber(assigned, locale)}
          hint={t("assigned")}
          icon={<PackageCheck className="size-5" />}
          tone="positive"
        />
        <StatCard
          label={t("availableAssets")}
          value={formatNumber(available, locale)}
          hint={t("available")}
          icon={<ShieldCheck className="size-5" />}
          tone="warning"
        />
        <StatCard
          label={t("maintenance")}
          value={formatNumber(maintenance, locale)}
          hint={t("condition")}
          icon={<Wrench className="size-5" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{canViewAll ? t("title") : t("myAssets")}</CardTitle>
          <CardDescription>{t("assignmentHistory")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {assets.length === 0 ? (
            <div className="p-6">
              <EmptyState title={t("noAssets")} />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("assetTag")}</TableHead>
                  <TableHead>{common("details")}</TableHead>
                  <TableHead>{t("category")}</TableHead>
                  <TableHead>{t("assignedTo")}</TableHead>
                  <TableHead>{t("condition")}</TableHead>
                  <TableHead>{common("status")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("cost")}</TableHead>
                  {canManage && <TableHead>{common("actions")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => {
                  const assignment = asset.assignments[0];
                  return (
                    <TableRow key={asset.id}>
                      <TableCell className="font-mono text-xs">{asset.assetTag}</TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{asset.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {asset.brand ?? ""} {asset.model ?? ""} · {asset.serialNumber ?? "—"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{asset.category}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {assignment ? (
                          <Link
                            href={`/employees/${assignment.employeeId}`}
                            className="hover:underline"
                          >
                            {localizedName(
                              locale,
                              `${assignment.employee.firstName} ${assignment.employee.lastName}`,
                              `${assignment.employee.firstNameAr ?? ""} ${assignment.employee.lastNameAr ?? ""}`.trim(),
                            )}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">{t("available")}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={asset.condition} group="assetCondition" />
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={asset.status} group="assetStatus" />
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {formatMoney(asset.purchaseCost, locale, "YER")}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            <FormDialog
                              title={t("editAsset")}
                              description={`${asset.name} · ${asset.assetTag}`}
                              triggerLabel={common("edit")}
                              successMessage={t("assetUpdated")}
                              fields={assetFields()}
                              initial={assetInitial(asset)}
                              action={updateAssetAction.bind(null, locale, asset.id)}
                              errorMessages={errorMessages}
                              triggerSize="xs"
                              triggerVariant="ghost"
                              wide
                            />
                            {asset.status === "AVAILABLE" && (
                              <FormDialog
                                title={t("assignTo")}
                                description={`${asset.name} · ${asset.assetTag}`}
                                triggerLabel={t("assign")}
                                triggerIcon="plus"
                                successMessage={t("assignedMsg")}
                                fields={assignFields()}
                                initial={{ employeeId: "", notes: "" }}
                                action={assignAssetAction.bind(null, locale, asset.id)}
                                errorMessages={errorMessages}
                                triggerSize="xs"
                                triggerVariant="ghost"
                              />
                            )}
                            {asset.status === "ASSIGNED" && assignment && (
                              <FormDialog
                                title={t("returnAsset")}
                                description={`${asset.name} · ${asset.assetTag}`}
                                triggerLabel={t("returnAsset")}
                                successMessage={t("returnedMsg")}
                                fields={returnFields()}
                                initial={{
                                  returnCondition: asset.condition,
                                  notes: "",
                                }}
                                action={returnAssetAction.bind(null, locale, asset.id)}
                                errorMessages={errorMessages}
                                triggerSize="xs"
                                triggerVariant="ghost"
                              />
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {employeesT("title")} · {t("purchaseDate")}:{" "}
        {formatDate(assets[0]?.purchaseDate, locale)}
      </p>
    </div>
  );
}
