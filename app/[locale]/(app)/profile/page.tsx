import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { revokeSessionFormAction } from "./actions";
import { formatDate, formatDateTime, localizedName } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { KeyRound, Monitor, ShieldCheck, UserRound } from "lucide-react";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sessionUser = await requireAuth(locale);
  const t = await getTranslations({ locale, namespace: "settings" });
  const auth = await getTranslations({ locale, namespace: "auth" });
  const common = await getTranslations({ locale, namespace: "common" });
  const employeesT = await getTranslations({ locale, namespace: "employees" });

  const account = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      name: true,
      nameAr: true,
      email: true,
      username: true,
      employeeId: true,
      lastLoginAt: true,
      roles: {
        select: {
          roleId: true,
          role: { select: { code: true, name: true, nameAr: true } },
        },
      },
      employee: {
        select: {
          employeeNo: true,
          firstName: true,
          lastName: true,
          firstNameAr: true,
          lastNameAr: true,
          employments: {
            where: { isCurrent: true },
            select: {
              department: { select: { name: true, nameAr: true } },
              position: { select: { name: true, nameAr: true } },
            },
            take: 1,
          },
        },
      },
      sessions: {
        where: { revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, userAgent: true, ip: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!account) return null;
  const displayName = localizedName(locale, account.name, account.nameAr);
  const employment = account.employee?.employments[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("profile")}
        description={t("account")}
        actions={
          account.employee ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/employees/${account.employeeId}`}>
                <UserRound className="size-4" /> {employeesT("title")}
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("account")}</CardTitle>
            <CardDescription>{t("profile")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-12">
                <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                  {account.name
                    .split(" ")
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-semibold">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{account.email}</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <Row label={t("username")} value={account.username} />
              <Row
                label={t("role")}
                value={
                  <span className="flex flex-wrap justify-end gap-1">
                    {account.roles.map((userRole) => (
                      <Badge key={userRole.roleId} variant="outline" className="text-[10px]">
                        {localizedName(
                          locale,
                          userRole.role.name,
                          userRole.role.nameAr,
                        )}
                      </Badge>
                    ))}
                  </span>
                }
              />
              <Row label={auth("lastSeen")} value={formatDateTime(account.lastLoginAt, locale)} />
              <Row
                label={t("employeeLinked")}
                value={account.employee ? account.employee.employeeNo : t("notLinked")}
              />
              {employment && (
                <Row
                  label={employeesT("position")}
                  value={localizedName(
                    locale,
                    employment.position.name,
                    employment.position.nameAr,
                  )}
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2" id="password">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4" /> {t("changePassword")}
            </CardTitle>
            <CardDescription>{auth("secureNote")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>

      <Card id="sessions">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="size-4" /> {t("sessions")}
          </CardTitle>
          <CardDescription>{auth("sessionsHint")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{auth("device")}</TableHead>
                <TableHead>{auth("ipAddress")}</TableHead>
                <TableHead>{auth("lastSeen")}</TableHead>
                <TableHead>{common("status")}</TableHead>
                <TableHead className="text-end">{common("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {account.sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="max-w-72 truncate text-xs text-muted-foreground">
                    {session.userAgent ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {session.ip ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(session.createdAt, locale, {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    {session.id === sessionUser.sessionId ? (
                      <Badge variant="secondary" className="gap-1">
                        <ShieldCheck className="size-3" /> {auth("currentSession")}
                      </Badge>
                    ) : (
                      <Badge variant="outline">{common("active")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    {session.id !== sessionUser.sessionId && (
                      <form action={revokeSessionFormAction.bind(null, locale, session.id)}>
                        <Button size="sm" variant="outline" type="submit">
                          {auth("revoke")}
                        </Button>
                      </form>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end text-sm font-medium">{value}</span>
    </div>
  );
}
