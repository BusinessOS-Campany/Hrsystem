import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { Link } from "@/i18n/navigation";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ArrowLeft, Mail } from "lucide-react";

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  if (user) redirect(`/${locale}/dashboard`);

  const t = await getTranslations({ locale, namespace: "auth" });
  const common = await getTranslations({ locale, namespace: "common" });

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
              <Mail className="size-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("resetTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("resetSubtitle")}</p>
          </div>
          <ForgotPasswordForm locale={locale} />
          <Link
            href="/login"
            className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> {t("backToLogin")}
          </Link>
          <p className="text-center text-[11px] text-muted-foreground">{common("tagline")}</p>
        </div>
      </div>
    </div>
  );
}
