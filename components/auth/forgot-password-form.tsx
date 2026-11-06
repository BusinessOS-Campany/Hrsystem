"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { forgotPasswordAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail } from "lucide-react";

export function ForgotPasswordForm({ locale }: { locale: string }) {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await forgotPasswordAction({ email, locale });
      if (!result.ok) {
        toast.error(common("error"));
        return;
      }
      setSent(true);
      setResetUrl(result.data?.resetUrl ?? null);
    });
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <Alert>
          <Mail className="size-4" />
          <AlertDescription>{t("resetSent")}</AlertDescription>
        </Alert>
        {resetUrl && (
          <Alert>
            <AlertDescription className="break-all text-xs">
              <a href={resetUrl} className="text-primary underline">
                {resetUrl}
              </a>
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t("emailOrUsername")}</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
        {t("resetPassword")}
      </Button>
    </form>
  );
}
