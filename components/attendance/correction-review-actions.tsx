"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { reviewCorrectionAction } from "@/app/[locale]/(app)/attendance/actions";
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

export function CorrectionReviewActions({
  locale,
  correctionId,
}: {
  locale: string;
  correctionId: string;
}) {
  const t = useTranslations("attendance");
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
      case "forbidden":
      case "unauthorized":
        return common("error");
      default:
        return common("error");
    }
  }

  function review(decision: "APPROVED" | "REJECTED", reviewComment?: string) {
    startTransition(async () => {
      const result = await reviewCorrectionAction(
        locale,
        correctionId,
        decision,
        reviewComment,
      );
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(
        decision === "APPROVED" ? t("correctionApproved") : t("correctionRejected"),
      );
      setRejectOpen(false);
      setComment("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        type="button"
        disabled={pending}
        onClick={() => review("APPROVED")}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Check />}
        {t("approveCorrection")}
      </Button>
      <Button
        size="sm"
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => setRejectOpen(true)}
      >
        <X />
        {t("rejectCorrection")}
      </Button>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("rejectCorrection")}</DialogTitle>
            <DialogDescription>{t("rejectReasonHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`correction-reject-${correctionId}`}>
              {t("correctionComment")}
            </Label>
            <Textarea
              id={`correction-reject-${correctionId}`}
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
              {common("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
