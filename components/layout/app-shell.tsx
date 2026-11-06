"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { NAV_GROUPS, type NavIcon } from "@/lib/navigation";
import { initials, localizedName } from "@/lib/format";
import { logoutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  GraduationCap,
  HandCoins,
  LayoutDashboard,
  Laptop,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Target,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

const ICONS: Record<NavIcon, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  employees: Users,
  departments: Building2,
  positions: BriefcaseBusiness,
  attendance: CalendarCheck,
  leave: CalendarDays,
  payroll: Wallet,
  loans: HandCoins,
  recruitment: UserRound,
  onboarding: ClipboardList,
  offboarding: LogOut,
  performance: Target,
  training: GraduationCap,
  assets: Laptop,
  requests: ClipboardList,
  reports: BookOpen,
  settings: Settings,
  audit: ShieldCheck,
};

type ShellUser = {
  name: string;
  nameAr: string | null;
  email: string;
  roles: { code: string; name: string; nameAr: string }[];
  permissions: string[];
};

type ShellNotification = {
  id: string;
  title: string;
  titleAr: string | null;
  message: string;
  messageAr: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

export function AppShell({
  user,
  notifications,
  unreadCount,
  children,
}: {
  user: ShellUser;
  notifications: ShellNotification[];
  unreadCount: number;
  children: React.ReactNode;
}) {
  const locale = useLocale();
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isLoggingOut, startLogout] = useTransition();

  const displayName = localizedName(locale, user.name, user.nameAr);
  const roleLabel =
    user.roles.length > 0
      ? localizedName(locale, user.roles[0].name, user.roles[0].nameAr)
      : "";

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => user.permissions.includes(item.permission)),
  })).filter((group) => group.items.length > 0);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `/employees?q=${encodeURIComponent(value)}` : "/employees");
  }

  function logout() {
    startLogout(async () => {
      await logoutAction(locale);
    });
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          H
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">HRSYS</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {t("common.tagline")}
          </p>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav className="space-y-5 px-3 py-4">
          {visibleGroups.map((group) => (
            <div key={group.key} className="space-y-1">
              <p className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t(`nav.${group.key}`)}
              </p>
              {group.items.map((item) => {
                const Icon = ICONS[item.icon];
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{t(`nav.${item.key}`)}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 rounded-md bg-sidebar-accent/60 p-2.5">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {initials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{displayName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{roleLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div data-app-shell className="flex h-dvh overflow-hidden bg-background">
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 border-e border-sidebar-border lg:block">
        {sidebar}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side={locale === "ar" ? "right" : "left"}
          className="w-[min(18rem,calc(100vw-3rem))] p-0"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">HRSYS</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col lg:ps-64">
        <header className="z-20 flex h-16 shrink-0 items-center gap-1 border-b bg-background/85 px-3 backdrop-blur sm:gap-2 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label={t("common.actions")}
          >
            <Menu className="size-5" />
          </Button>

          <form onSubmit={submitSearch} className="relative hidden max-w-sm flex-1 sm:block">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("employees.searchPlaceholder")}
              className="h-9 bg-muted/40 ps-8"
              aria-label={t("common.search")}
            />
          </form>

          <div className="ms-auto flex items-center gap-0.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  aria-label={t("nav.notifications")}
                >
                  <Bell className="size-4" />
                  {unreadCount > 0 && (
                    <Badge className="absolute -end-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full p-0 text-[9px]">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[min(20rem,calc(100vw-2rem))]"
              >
                <div className="flex items-center justify-between px-2 py-1.5">
                  <DropdownMenuLabel className="p-0">
                    {t("nav.notifications")}
                  </DropdownMenuLabel>
                  <Link
                    href="/notifications"
                    className="text-xs text-primary hover:underline"
                  >
                    {t("notifications.viewAll")}
                  </Link>
                </div>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    {t("notifications.noNotifications")}
                  </p>
                ) : (
                  notifications.slice(0, 5).map((notification) => (
                    <DropdownMenuItem key={notification.id} asChild className="items-start gap-2 py-2">
                      <Link href={notification.link ?? "/notifications"}>
                        <span
                          className={cn(
                            "mt-1.5 size-1.5 shrink-0 rounded-full",
                            notification.isRead ? "bg-transparent" : "bg-primary",
                          )}
                        />
                        <span className="min-w-0 space-y-0.5">
                          <span className="block truncate text-xs font-medium">
                            {localizedName(locale, notification.title, notification.titleAr)}
                          </span>
                          <span className="line-clamp-2 block text-[11px] text-muted-foreground">
                            {localizedName(locale, notification.message, notification.messageAr)}
                          </span>
                        </span>
                      </Link>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <LocaleSwitcher compact />
            <ThemeToggle />

            <Separator orientation="vertical" className="mx-0.5 hidden h-6 sm:block" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 gap-2 px-1.5">
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                      {initials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-32 truncate text-xs font-medium sm:inline">
                    {displayName}
                  </span>
                  <ChevronDown className="hidden size-3.5 text-muted-foreground sm:inline" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="space-y-0.5">
                  <span className="block truncate text-sm">{displayName}</span>
                  <span className="block truncate text-[11px] font-normal text-muted-foreground">
                    {user.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <UserRound className="size-4" /> {t("common.profile")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="size-4" /> {t("common.settings")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  disabled={isLoggingOut}
                  variant="destructive"
                >
                  <LogOut className="size-4" /> {t("common.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main
          data-app-scroll
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
        >
          <div className="mx-auto w-full max-w-[1500px] px-3 py-5 sm:px-6 sm:py-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
