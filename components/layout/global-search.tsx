"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { NAV_GROUPS } from "@/lib/navigation";
import { NAV_ICONS } from "@/components/layout/nav-icons";
import type { SearchGroup, SearchResponse } from "@/lib/search/types";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Loader2, Search } from "lucide-react";

const DEBOUNCE_MS = 220;

export function GlobalSearch({ permissions }: { permissions: string[] }) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("search");
  const nav = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const trimmedQuery = query.trim();
  const pages = useMemo(() => {
    const needle = trimmedQuery.toLowerCase();
    return NAV_GROUPS.flatMap((group) => group.items)
      .filter((item) => permissions.includes(item.permission))
      .map((item) => ({
        ...item,
        label: nav(item.key as never),
      }))
      .filter((item) => {
        if (!needle) return true;
        return (
          item.label.toLowerCase().includes(needle) ||
          item.key.toLowerCase().includes(needle) ||
          item.href.toLowerCase().includes(needle)
        );
      });
  }, [nav, permissions, trimmedQuery]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open || trimmedQuery.length === 0) {
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setGroups([]);
      setLoading(true);
      setError(false);

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmedQuery)}&locale=${locale}`,
          { signal: controller.signal, cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error("Search request failed");
        }

        const data = (await response.json()) as SearchResponse;
        setGroups(data.groups.slice(0, 10));
      } catch (requestError) {
        if (!controller.signal.aborted) {
          console.error(requestError);
          setError(true);
          setGroups([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [locale, open, trimmedQuery]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery("");
      setGroups([]);
      setLoading(false);
      setError(false);
    }
  }

  function navigate(href: string) {
    handleOpenChange(false);
    router.push(href);
  }

  const visibleGroups = trimmedQuery ? groups : [];
  const isLoading = trimmedQuery.length > 0 && loading;
  const hasError = trimmedQuery.length > 0 && error;
  const hasResults = pages.length > 0 || visibleGroups.length > 0;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="relative hidden h-9 max-w-md flex-1 justify-start gap-2 bg-muted/40 ps-2.5 text-muted-foreground hover:bg-muted/60 sm:flex"
        aria-label={t("open")}
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">{t("placeholder")}</span>
        <kbd className="ms-auto hidden h-5 shrink-0 items-center rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground md:inline-flex">
          ⌘K
        </kbd>
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="sm:hidden"
        aria-label={t("open")}
      >
        <Search className="size-4" />
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={t("title")}
        description={t("subtitle")}
        className="top-[10%] sm:max-w-2xl"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t("placeholder")}
            aria-label={t("placeholder")}
            autoFocus
          />

          <CommandList className="max-h-[min(65vh,34rem)]">
            {hasError ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                {t("error")}
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t("searching")}
              </div>
            ) : !hasResults ? (
              <div className="space-y-1 px-3 py-8 text-center">
                <p className="text-sm font-medium">
                  {trimmedQuery
                    ? t("noResults", { query: trimmedQuery })
                    : t("startTyping")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {trimmedQuery ? t("noResultsHint") : t("startTypingHint")}
                </p>
              </div>
            ) : (
              <>
                {pages.length > 0 && (
                  <CommandGroup heading={t("pages")}>
                    {pages.map((page) => {
                      const Icon = NAV_ICONS[page.icon];
                      return (
                        <CommandItem
                          key={`page-${page.href}`}
                          value={`page-${page.href}`}
                          onSelect={() => navigate(page.href)}
                          className="gap-3 py-2"
                        >
                          <Icon className="size-4 text-muted-foreground" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {page.label}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {page.href}
                            </span>
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}

                {visibleGroups.map((group) => {
                  const Icon = NAV_ICONS[group.key];
                  return (
                    <CommandGroup key={group.key} heading={t(group.key)}>
                      {group.results.map((result) => (
                        <CommandItem
                          key={`${group.key}-${result.id}`}
                          value={`${group.key}-${result.id}`}
                          onSelect={() => navigate(result.href)}
                          className="gap-3 py-2"
                        >
                          <Icon className="size-4 text-muted-foreground" />
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
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}

                {trimmedQuery && (
                  <CommandGroup>
                    <CommandItem
                      value="view-all-search-results"
                      onSelect={() =>
                        navigate(`/search?q=${encodeURIComponent(trimmedQuery)}`)
                      }
                      className="gap-3 py-2"
                    >
                      <Search className="size-4 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {t("viewAll", { query: trimmedQuery })}
                      </span>
                    </CommandItem>
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>

          <div className="flex items-center justify-between border-t px-3 py-2 text-[10px] text-muted-foreground">
            <span className="truncate">{t("hint")}</span>
            <span className="hidden items-center gap-1 sm:flex">
              <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">
                ↑
              </kbd>
              <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">
                ↓
              </kbd>
              <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono">
                ↵
              </kbd>
            </span>
          </div>
        </Command>
      </CommandDialog>
    </>
  );
}
