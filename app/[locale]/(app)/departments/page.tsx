import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatNumber, localizedName } from "@/lib/format";
import { Button } from "@/components/ui/button";
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
import { Building2, Network, Plus, Users } from "lucide-react";

export default async function DepartmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requirePermission("department.view", locale);
  const t = await getTranslations({ locale, namespace: "departments" });
  const common = await getTranslations({ locale, namespace: "common" });
  const employeesT = await getTranslations({ locale, namespace: "employees" });

  const departments = await prisma.department.findMany({
    where: { deletedAt: null },
    include: {
      manager: true,
      parent: true,
      children: { where: { deletedAt: null } },
      positions: { where: { deletedAt: null } },
      _count: { select: { employments: { where: { isCurrent: true } } } },
    },
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
  });

  const headcount = departments.reduce(
    (sum, department) => sum + department._count.employments,
    0,
  );
  const topLevel = departments.filter((department) => !department.parentId).length;
  const positions = departments.reduce((sum, department) => sum + department.positions.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          hasPermission(user, "department.create") ? (
            <Button asChild>
              <Link href="/departments/new">
                <Plus className="size-4" /> {t("add")}
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t("title")}
          value={formatNumber(departments.length, locale)}
          hint={`${formatNumber(topLevel, locale)} ${t("topLevel")}`}
          icon={<Building2 className="size-5" />}
          tone="info"
        />
        <StatCard
          label={employeesT("title")}
          value={formatNumber(headcount, locale)}
          hint={t("headcount")}
          icon={<Users className="size-5" />}
          tone="positive"
        />
        <StatCard
          label={t("positions")}
          value={formatNumber(positions, locale)}
          hint={t("structure")}
          icon={<Network className="size-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("hierarchy")}</CardTitle>
            <CardDescription>{t("structure")}</CardDescription>
          </CardHeader>
          <CardContent>
            {departments.length === 0 ? (
              <EmptyState title={t("noDepartments")} />
            ) : (
              <div className="space-y-1.5">
                {departments.map((department) => (
                  <div
                    key={department.id}
                    className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm"
                    style={{ marginInlineStart: department.parentId ? 20 : 0 }}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {localizedName(locale, department.name, department.nameAr)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {department.code} · {formatNumber(department._count.employments, locale)}{" "}
                        {employeesT("title")}
                      </p>
                    </div>
                    {department.children.length > 0 && (
                      <Badge variant="outline">{department.children.length}</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {departments.length === 0 ? (
              <div className="p-6">
                <EmptyState title={t("noDepartments")} />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead>{t("code")}</TableHead>
                    <TableHead>{t("manager")}</TableHead>
                    <TableHead className="hidden md:table-cell">{t("parent")}</TableHead>
                    <TableHead>{t("headcount")}</TableHead>
                    <TableHead>{t("positions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((department) => (
                    <TableRow key={department.id}>
                      <TableCell className="font-medium">
                        {localizedName(locale, department.name, department.nameAr)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{department.code}</TableCell>
                      <TableCell>
                        {department.manager
                          ? localizedName(
                              locale,
                              `${department.manager.firstName} ${department.manager.lastName}`,
                              `${department.manager.firstNameAr ?? ""} ${department.manager.lastNameAr ?? ""}`.trim(),
                            )
                          : "—"}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {department.parent
                          ? localizedName(locale, department.parent.name, department.parent.nameAr)
                          : t("topLevel")}
                      </TableCell>
                      <TableCell>{formatNumber(department._count.employments, locale)}</TableCell>
                      <TableCell>{formatNumber(department.positions.length, locale)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">{common("noResultsHint")}</p>
    </div>
  );
}
