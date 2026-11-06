import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export default async function ForbiddenPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common" });

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="max-w-md space-y-4 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="size-7" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">403</p>
        <h1 className="text-2xl font-semibold tracking-tight">{t("forbiddenTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("forbiddenDescription")}</p>
        <Button asChild>
          <Link href="/dashboard">{t("back")}</Link>
        </Button>
      </div>
    </div>
  );
}
