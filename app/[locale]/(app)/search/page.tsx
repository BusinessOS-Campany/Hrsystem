import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireAuth } from "@/lib/auth/session";
import { NAV_GROUPS } from "@/lib/navigation";
import { searchAll } from "@/lib/search/search";
import { NAV_ICONS } from "@/components/layout/nav-icons";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LiveSearch } from "@/components/shared/live-search";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChevronRight, Search } from "lucide-react";

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);

  const user = await requireAuth(locale);
  const t = await getTranslations({ locale, namespace: "search" });
  const nav = await getTranslations({ locale, namespace: "nav" });

  const search = query.q?.trim() ?? "";
  const groups = search
    ? await searchAll({ user, locale, query: search, limit: 20 })
    : [];

  const needle = search.toLowerCase();
  const pages = search
    ? NAV_GROUPS.flatMap((group) => group.items)
        .filter((item) => user.permissions.includes(item.permission))
        .map((item) => ({
          ...item,
          label: nav(item.key as never),
        }))
        .filter(
          (item) =>
            item.label.toLowerCase().includes(needle) ||
            item.key.toLowerCase().includes(needle) ||
            item.href.toLowerCase().includes(needle),
        )
    : [];

  const total = groups.reduce((sum, group) => sum + group.results.length, 0) + pages.length;
  const arrowClass = locale === "ar" ? "rotate-180" : "";

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />

      <Card>
        <CardContent className="pt-4">
          <LiveSearch
            initialValue={search}
            placeholder={t("placeholder")}
            ariaLabel={t("placeholder")}
            inputClassName="h-9 ps-9"
            autoFocus
          />
        </CardContent>
      </Card>

      {!search ? (
        <EmptyState
          title={t("startTyping")}
          description={t("startTypingHint")}
          icon={<Search className="size-5" />}
        />
      ) : total === 0 ? (
        <EmptyState
          title={t("noResults", { query: search })}
          description={t("noResultsHint")}
          icon={<Search className="size-5" />}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("resultsFor", { query: search })} · {t("resultCount", { count: total })}
          </p>

          {pages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="size-4 text-muted-foreground" />
                  {t("pages")}
                </CardTitle>
                <CardDescription>
                  {t("resultCount", { count: pages.length })}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {pages.map((page) => {
                    const Icon = NAV_ICONS[page.icon];
                    return (
                      <Link
                        key={`page-${page.href}`}
                        href={page.href}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {page.label}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {page.href}
                          </span>
                        </span>
                        <ChevronRight
                          className={`size-4 shrink-0 text-muted-foreground ${arrowClass}`}
                        />
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {groups.map((group) => {
            const Icon = NAV_ICONS[group.key];
            return (
              <Card key={group.key}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="size-4 text-muted-foreground" />
                    {t(group.key)}
                  </CardTitle>
                  <CardDescription>
                    {t("resultCount", { count: group.results.length })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {group.results.map((result) => (
                      <Link
                        key={`${group.key}-${result.id}`}
                        href={result.href}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {result.title}
                          </span>
                          {result.subtitle && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {result.subtitle}
                            </span>
                          )}
                        </span>
                        <ChevronRight
                          className={`size-4 shrink-0 text-muted-foreground ${arrowClass}`}
                        />
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
