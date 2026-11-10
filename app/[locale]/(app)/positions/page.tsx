import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { LiveSearch } from "@/components/shared/live-search";
import { formatMoney, formatNumber, localizedName } from "@/lib/format";
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
import { BriefcaseBusiness, Layers, Plus, Wallet } from "lucide-react";

export default async function PositionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const user = await requirePermission("position.view", locale);
  const t = await getTranslations({ locale, namespace: "positions" });
  const nav = await getTranslations({ locale, namespace: "nav" });
  const search = query.q?.trim();

  const positions = await prisma.position.findMany({
    where: {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { nameAr: { contains: search, mode: "insensitive" as const } },
              { code: { contains: search, mode: "insensitive" as const } },
              { grade: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      nameAr: true,
      code: true,
      grade: true,
      minSalary: true,
      maxSalary: true,
      department: { select: { name: true, nameAr: true } },
      _count: { select: { employments: { where: { isCurrent: true } } } },
    },
    orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
  });

  const grades = new Set(positions.map((position) => position.grade).filter(Boolean));
  const filled = positions.reduce((sum, position) => sum + position._count.employments, 0);
  const avgMin =
    positions.filter((position) => position.minSalary).reduce((sum, position) => sum + Number(position.minSalary), 0) /
    Math.max(1, positions.filter((position) => position.minSalary).length);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          hasPermission(user, "position.create") ? (
            <Button asChild>
              <Link href="/positions/new">
                <Plus className="size-4" /> {t("add")}
              </Link>
            </Button>
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

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t("title")}
          value={formatNumber(positions.length, locale)}
          hint={nav("departments")}
          icon={<BriefcaseBusiness className="size-5" />}
          tone="info"
        />
        <StatCard
          label={t("incumbents")}
          value={formatNumber(filled, locale)}
          hint={t("title")}
          icon={<Layers className="size-5" />}
          tone="positive"
        />
        <StatCard
          label={t("salaryBand")}
          value={formatMoney(avgMin, locale, "YER")}
          hint={`${formatNumber(grades.size, locale)} ${t("grade")}`}
          icon={<Wallet className="size-5" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("salaryBand")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {positions.length === 0 ? (
            <div className="p-6">
              <EmptyState title={t("noPositions")} />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("department")}</TableHead>
                  <TableHead>{t("grade")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("minSalary")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("maxSalary")}</TableHead>
                  <TableHead>{t("incumbents")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((position) => (
                  <TableRow key={position.id}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-medium">
                          {localizedName(locale, position.name, position.nameAr)}
                        </p>
                        <p className="text-xs text-muted-foreground">{position.code}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {localizedName(locale, position.department.name, position.department.nameAr)}
                    </TableCell>
                    <TableCell>
                      {position.grade ? <Badge variant="outline">{position.grade}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {formatMoney(position.minSalary, locale, "YER")}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {formatMoney(position.maxSalary, locale, "YER")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{position._count.employments}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
