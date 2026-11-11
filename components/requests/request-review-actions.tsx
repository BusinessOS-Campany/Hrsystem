"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { reviewRequestAction } from "@/app/[locale]/(app)/requests/actions";
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

export function RequestReviewActions({
  locale,
  requestId,
}: {
  locale: string;
  requestId: string;
}) {
  const t = useTranslations("requests");
  const common = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [comment, setComment] = useState("");

  function errorMessage(error?: string) {
    switch (error) {
      case "commentRequired":
        return t("rejectReasonRequired");
      case "conflict":
        return t("alreadyReviewed");
      case "notFound":
        return common("noResults");
      case "forbidden":
      case "unauthorized":
        return common("error");
      default:
        return common("error");
    }
  }

  function review(decision: "APPROVED" | "REJECTED", reviewComment?: string) {
    startTransition(async () => {
      const result = await reviewRequestAction(
        locale,
        requestId,
        decision,
        reviewComment,
      );
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(decision === "APPROVED" ? t("approvedMsg") : t("rejectedMsg"));
      setRejectOpen(false);
      setComment("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        size="sm"
        type="button"
        disabled={pending}
        onClick={() => review("APPROVED")}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Check />}
        {t("approve")}
      </Button>
      <Button
        size="sm"
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => setRejectOpen(true)}
      >
        <X />
        {t("reject")}
      </Button>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("rejectConfirm")}</DialogTitle>
            <DialogDescription>{t("rejectReasonHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`request-reject-${requestId}`}>{t("comment")}</Label>
            <Textarea
              id={`request-reject-${requestId}`}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              maxLength={500}
              required
              autoFocus
              placeholder={t("rejectReasonPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("rejectReasonRequired")}
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectOpen(false)}
              disabled={pending}
            >
              {common("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || comment.trim().length < 3}
              onClick={() => review("REJECTED", comment)}
            >
              {pending && <Loader2 className="animate-spin" />}
              {t("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
