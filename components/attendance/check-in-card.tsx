"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { checkInAction, checkOutAction } from "@/app/[locale]/(app)/attendance/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock3, LogIn, LogOut } from "lucide-react";

function time(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Aden",
  }).format(new Date(value));
}

export function CheckInCard({
  locale,
  checkIn,
  checkOut,
  status,
}: {
  locale: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string | null;
}) {
  const t = useTranslations("attendance");
  const common = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(kind: "in" | "out") {
    startTransition(async () => {
      const result = kind === "in" ? await checkInAction(locale) : await checkOutAction(locale);
      if (!result.ok) {
        toast.error(
          result.error === "alreadyCheckedIn"
            ? t("alreadyCheckedIn")
            : result.error === "notCheckedIn"
              ? t("notCheckedIn")
              : common("error"),
        );
        return;
      }
      toast.success(kind === "in" ? t("checkInSuccess") : t("checkOutSuccess"));
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Clock3 className="size-5" />
          </div>
          <div>
            <p className="text-sm font-medium">{t("today")}</p>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {t("checkInTime")}: {time(checkIn)}
              </span>
              <span>·</span>
              <span>
                {t("checkOutTime")}: {time(checkOut)}
              </span>
              {status && (
                <Badge variant="outline" className="text-[10px]">
                  {status.toLowerCase().replaceAll("_", " ")}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => run("in")}
            disabled={pending || Boolean(checkIn)}
          >
            <LogIn className="size-4" /> {t("checkIn")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => run("out")}
            disabled={pending || !checkIn || Boolean(checkOut)}
          >
            <LogOut className="size-4" /> {t("checkOut")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
