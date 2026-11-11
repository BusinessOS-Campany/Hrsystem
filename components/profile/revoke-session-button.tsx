"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { revokeSessionFormAction } from "@/app/[locale]/(app)/profile/actions";

export function RevokeSessionButton({
  locale,
  sessionId,
}: {
  locale: string;
  sessionId: string;
}) {
  const auth = useTranslations("auth");
  const common = useTranslations("common");
  const [pending, startTransition] = useTransition();

  function revoke() {
    startTransition(async () => {
      const result = await revokeSessionFormAction(locale, sessionId);
      if (result.ok) {
        toast.success(auth("revoked"));
      } else {
        toast.error(
          result.error === "currentSession"
            ? auth("currentSession")
            : common("error"),
        );
      }
    });
  }

  return (
    <Button
      size="sm"
      variant="outline"
      type="button"
      onClick={revoke}
      disabled={pending}
    >
      {auth("revoke")}
    </Button>
  );
}
