import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ArrowLeft, KeyRound } from "lucide-react";

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const { token } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "auth" });

  return (
    <div className="flex min-h-svh flex-col">
      <div className="flex items-center justify-between p-4 sm:px-8">
        <Link href="/login" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            H
          </div>
          <span className="font-semibold">HRSYS</span>
        </Link>
        <div className="flex items-center gap-1">
          <LocaleSwitcher compact />
          <ThemeToggle />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <KeyRound className="size-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("resetTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("resetSubtitle")}</p>
          </div>
          {token ? (
            <ResetPasswordForm locale={locale} token={token} />
          ) : (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertDescription>{t("resetInvalid")}</AlertDescription>
              </Alert>
              <Button asChild className="w-full">
                <Link href="/forgot-password">{t("forgotPassword")}</Link>
              </Button>
            </div>
          )}
          <Link
            href="/login"
            className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> {t("backToLogin")}
          </Link>
        </div>
      </div>
    </div>
  );
}
