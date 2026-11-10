"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

// The command palette (cmdk + dialog) is only needed after the user opens it.
// Keeping it out of the app-shell bundle makes every page lighter.
const GlobalSearchDialog = dynamic(
  () =>
    import("@/components/layout/global-search-dialog").then(
      (module) => module.GlobalSearchDialog,
    ),
  { ssr: false },
);

export function GlobalSearch({ permissions }: { permissions: string[] }) {
  const t = useTranslations("search");
  const [open, setOpen] = useState(false);

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

      {open && (
        <GlobalSearchDialog
          open={open}
          onOpenChange={setOpen}
          permissions={permissions}
        />
      )}
    </>
  );
}
