import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle2, Globe2, ShieldCheck, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LoginForm } from "./login-form";

const DEMO_PASSWORD = "Hrsys@2026!";
const DEMO_ADMIN_PASSWORD = "admin";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  setRequestLocale(locale);

  const user = await getCurrentUser();
  if (user) redirect(`/${locale}/dashboard`);

  const t = await getTranslations({ locale, namespace: "auth" });
  const nav = await getTranslations({ locale, namespace: "nav" });
  const common = await getTranslations({ locale, namespace: "common" });

  const demoAccounts =
    process.env.NODE_ENV !== "production"
      ? [
          { role: t("demoAdmin"), identifier: "admin", password: DEMO_ADMIN_PASSWORD },
          { role: t("demoHr"), identifier: "hr@hrsys.local", password: DEMO_PASSWORD },
          { role: t("demoManager"), identifier: "manager@hrsys.local", password: DEMO_PASSWORD },
          { role: t("demoEmployee"), identifier: "employee@hrsys.local", password: DEMO_PASSWORD },
        ]
      : undefined;

  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="absolute -end-24 -top-24 size-[28rem] rounded-full border border-white/15"
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -start-20 size-[32rem] rounded-full border border-white/10"
        />

        <div className="relative flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-white/15 text-lg font-bold">
            H
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">HRSYS</p>
            <p className="text-xs text-primary-foreground/70">{common("tagline")}</p>
          </div>
        </div>

        <div className="relative max-w-md space-y-6">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            {t("heroTitle")}
          </h2>
          <p className="text-base leading-relaxed text-primary-foreground/80">
            {t("heroSubtitle")}
          </p>
          <ul className="space-y-3 text-sm">
            {[t("heroPoint1"), t("heroPoint2"), t("heroPoint3")].map((point) => (
              <li key={point} className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary-foreground/80" />
                <span className="text-primary-foreground/90">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative grid grid-cols-3 gap-3 text-xs text-primary-foreground/75">
          <div className="flex items-center gap-2">
            <Users className="size-4" /> {nav("employees")}
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4" /> {nav("payroll")}
          </div>
          <div className="flex items-center gap-2">
            <Globe2 className="size-4" /> {common("arabic")}
          </div>
        </div>
      </aside>

      <main className="flex min-h-svh flex-col">
        <div className="flex items-center justify-between p-4 sm:px-8">
          <div className="flex items-center gap-2 lg:invisible">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              H
            </div>
            <span className="font-semibold">HRSYS</span>
          </div>
          <div className="flex items-center gap-1">
            <LocaleSwitcher compact />
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-8">
          <div className="w-full max-w-sm">
            <LoginForm
              locale={locale as "en" | "ar"}
              next={next}
              demoAccounts={demoAccounts}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
