"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Loader2, LockKeyhole, UserRound } from "lucide-react";
import { loginAction } from "@/app/[locale]/login/actions";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type DemoAccount = {
  role: string;
  identifier: string;
  password: string;
};

export function LoginForm({
  locale,
  next,
  demoAccounts,
}: {
  locale: "en" | "ar";
  next?: string;
  demoAccounts?: DemoAccount[];
}) {
  const t = useTranslations();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "", locale, next },
  });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    const result = await loginAction({ ...values, locale, next });
    if (result?.error) {
      setServerError(
        ["invalid", "locked", "inactive"].includes(result.error)
          ? t(`auth.${result.error}`)
          : t("errors.generic"),
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("auth.loginTitle")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("auth.loginSubtitle")}
        </p>
      </div>

      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="identifier">{t("auth.emailOrUsername")}</Label>
          <div className="relative">
            <UserRound className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="identifier"
              autoComplete="username"
              className="ps-9"
              placeholder="name@company.com"
              aria-invalid={Boolean(errors.identifier)}
              {...register("identifier")}
            />
          </div>
          {errors.identifier && (
            <p className="text-xs text-destructive">
              {t("common.requiredField")}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="px-9"
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">
              {t("common.requiredField")}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
        </Button>
      </form>

      {demoAccounts && demoAccounts.length > 0 && (
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {t("auth.demoAccounts")} — {t("auth.demoHint")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {demoAccounts.map((account) => (
              <button
                key={account.identifier}
                type="button"
                onClick={() => {
                  setValue("identifier", account.identifier, { shouldValidate: true });
                  setValue("password", account.password, { shouldValidate: true });
                }}
                className="rounded-md border bg-background px-2.5 py-2 text-start text-xs transition-colors hover:border-primary/50 hover:bg-accent"
              >
                <span className="block font-medium">{account.role}</span>
                <span className="block truncate text-muted-foreground">
                  {account.identifier} · {account.password}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">
        {t("auth.secureNote")}
      </p>
    </div>
  );
}
