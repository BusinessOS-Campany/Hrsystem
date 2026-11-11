"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban, Loader2 } from "lucide-react";
import { cancelLeaveAction } from "@/app/[locale]/(app)/leave/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function LeaveCancelDialog({
  locale,
  requestId,
  requestNo,
}: {
  locale: string;
  requestId: string;
  requestNo: string;
}) {
  const t = useTranslations("leave");
  const common = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function cancel() {
    startTransition(async () => {
      const result = await cancelLeaveAction(locale, requestId, reason);
      if (!result.ok) {
        const message =
          result.error === "notCancellable"
            ? t("notCancellable")
            : result.error === "conflict"
              ? t("alreadyReviewed")
              : result.error === "forbidden" || result.error === "unauthorized"
                ? common("error")
                : common("error");
        toast.error(message);
        return;
      }
      toast.success(t("cancelledMsg"));
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="text-muted-foreground"
      >
        <Ban />
        {t("cancel")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("cancelConfirm")}</DialogTitle>
            <DialogDescription>
              {t("cancelRequestHint", { requestNo })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`cancel-${requestId}`}>{t("cancelReason")}</Label>
            <Textarea
              id={`cancel-${requestId}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              maxLength={500}
              placeholder={t("cancelReasonPlaceholder")}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              {common("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={cancel}
              disabled={pending}
            >
              {pending && <Loader2 className="animate-spin" />}
              {t("cancelRequest")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
