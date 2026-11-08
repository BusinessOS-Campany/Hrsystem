"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  reactivateEmployeeAction,
  suspendEmployeeAction,
} from "@/app/[locale]/(app)/employees/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, UserCheck, UserX } from "lucide-react";

type Mode = "suspend" | "reactivate";

function EmployeeStatusButton({
  locale,
  employeeId,
  mode,
}: {
  locale: string;
  employeeId: string;
  mode: Mode;
}) {
  const t = useTranslations("employees");
  const common = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const isSuspend = mode === "suspend";
  const Icon = isSuspend ? UserX : UserCheck;

  function run() {
    startTransition(async () => {
      const result = isSuspend
        ? await suspendEmployeeAction(locale, employeeId)
        : await reactivateEmployeeAction(locale, employeeId);

      if (!result.ok) {
        toast.error(
          result.error === "self"
            ? isSuspend
              ? t("cannotSuspendSelf")
              : t("cannotReactivateSelf")
            : result.error === "alreadySuspended"
              ? t("alreadySuspended")
              : result.error === "finalized"
                ? t("cannotSuspendFinalized")
                : result.error === "notSuspended"
                  ? t("notSuspended")
                  : common("error"),
        );
        return;
      }

      setOpen(false);
      toast.success(isSuspend ? t("employeeSuspended") : t("employeeReactivated"));
      router.refresh();
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!pending) setOpen(nextOpen);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant={isSuspend ? "destructive" : "default"} size="sm">
          <Icon className="size-4" />
          {isSuspend ? t("suspend") : t("reactivate")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia
            className={
              isSuspend
                ? "bg-destructive/10 text-destructive"
                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            }
          >
            <Icon className="size-5" />
          </AlertDialogMedia>
          <AlertDialogTitle>
            {isSuspend ? t("suspendTitle") : t("reactivateTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isSuspend ? t("suspendDescription") : t("reactivateDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{common("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant={isSuspend ? "destructive" : "default"}
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              run();
            }}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Icon className="size-4" />
            )}
            {pending
              ? common("saving")
              : isSuspend
                ? t("confirmSuspend")
                : t("confirmReactivate")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function SuspendEmployeeButton({
  locale,
  employeeId,
}: {
  locale: string;
  employeeId: string;
}) {
  return (
    <EmployeeStatusButton locale={locale} employeeId={employeeId} mode="suspend" />
  );
}

export function ReactivateEmployeeButton({
  locale,
  employeeId,
}: {
  locale: string;
  employeeId: string;
}) {
  return (
    <EmployeeStatusButton
      locale={locale}
      employeeId={employeeId}
      mode="reactivate"
    />
  );
}
