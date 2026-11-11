import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate, intlLocale } from "@/lib/format";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type CalendarLeave = {
  id: string;
  requestNo: string;
  employeeName: string;
  typeName: string;
  color: string;
  startDate: string;
  endDate: string;
  status: string;
};

export async function LeaveCalendar({
  locale,
  month,
  prevHref,
  nextHref,
  requests,
}: {
  locale: string;
  month: string;
  prevHref: string;
  nextHref: string;
  requests: CalendarLeave[];
}) {
  const t = await getTranslations({ locale, namespace: "leave" });
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const leading = first.getUTCDay();
  const monthLabel = new Intl.DateTimeFormat(intlLocale(locale), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(first);
  const weekdayFormatter = new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "short",
    timeZone: "UTC",
  });
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    weekdayFormatter.format(new Date(Date.UTC(2024, 0, 7 + index))),
  );

  const events = requests.map((request) => ({
    ...request,
    startKey: request.startDate.slice(0, 10),
    endKey: request.endDate.slice(0, 10),
  }));

  const cells = Array.from({ length: leading + daysInMonth }, (_, index) => {
    if (index < leading) return null;
    const day = index - leading + 1;
    const date = new Date(Date.UTC(year, monthIndex, day));
    const key = date.toISOString().slice(0, 10);
    return {
      day,
      key,
      events: events.filter(
        (event) => event.startKey <= key && event.endKey >= key,
      ),
    };
  });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>{t("calendar")}</CardTitle>
          <CardDescription>{monthLabel}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="icon-sm" variant="outline">
            <Link href={prevHref} aria-label={t("calendarPrev")}>
              <ChevronLeft className="rtl:rotate-180" />
            </Link>
          </Button>
          <Button asChild size="icon-sm" variant="outline">
            <Link href={nextHref} aria-label={t("calendarNext")}>
              <ChevronRight className="rtl:rotate-180" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground sm:text-xs">
          {weekdays.map((weekday) => (
            <div key={weekday} className="py-1">
              {weekday}
            </div>
          ))}
          {cells.map((cell, index) => {
            if (!cell) {
              return <div key={`empty-${index}`} className="min-h-11 rounded-md" />;
            }
            return (
              <div
                key={cell.key}
                className="min-h-11 min-w-0 rounded-md border p-1 text-start sm:min-h-16 sm:p-1.5"
                aria-label={`${cell.day}: ${cell.events.length}`}
              >
                <span className="text-[10px] font-medium text-muted-foreground sm:text-xs">
                  {cell.day}
                </span>
                <div className="mt-0.5 flex flex-wrap gap-0.5 sm:hidden">
                  {cell.events.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: event.color }}
                    />
                  ))}
                  {cell.events.length > 3 && (
                    <span className="text-[9px] text-muted-foreground">
                      +{cell.events.length - 3}
                    </span>
                  )}
                </div>
                <div className="mt-1 hidden space-y-0.5 sm:block">
                  {cell.events.slice(0, 2).map((event) => (
                    <p
                      key={event.id}
                      className="truncate rounded px-1 py-0.5 text-[10px]"
                      style={{ backgroundColor: `${event.color}1a`, color: event.color }}
                      title={`${event.employeeName} · ${event.typeName}`}
                    >
                      {event.employeeName}
                    </p>
                  ))}
                  {cell.events.length > 2 && (
                    <p className="text-[10px] text-muted-foreground">
                      +{cell.events.length - 2}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {events.length === 0 ? (
          <EmptyState title={t("noCalendar")} />
        ) : (
          <div className="divide-y rounded-lg border">
            {events.slice(0, 10).map((event) => (
              <div
                key={event.id}
                className="flex flex-col gap-1 p-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{event.employeeName}</p>
                  <p className="truncate text-muted-foreground">
                    {event.typeName} · {formatDate(event.startDate, locale)} –{" "}
                    {formatDate(event.endDate, locale)}
                  </p>
                </div>
                <StatusBadge value={event.status} group="leaveStatus" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
