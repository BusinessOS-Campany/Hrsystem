import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PageSkeletonVariant = "table" | "dashboard" | "search" | "detail";

function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="w-full space-y-2">
        <Skeleton className="h-7 w-52 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-9 w-28 shrink-0" />
    </div>
  );
}

function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className={cn(
        "grid gap-4",
        count === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4",
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-32 max-w-full" />
            </div>
            <Skeleton className="size-10 shrink-0 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SearchBarSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-3">
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

function TableSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center gap-4 border-b px-4 py-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="ms-auto h-3 w-16" />
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/5 max-w-56" />
              <Skeleton className="h-3 w-1/4 max-w-36" />
            </div>
            <Skeleton className="hidden h-3 w-20 sm:block" />
            <Skeleton className="hidden h-5 w-16 rounded-full md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10 lg:col-span-2">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56 max-w-full" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-56 w-full" />
      </div>
      <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="mb-6 space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex h-56 items-center justify-center">
          <Skeleton className="size-40 rounded-full" />
        </div>
      </div>
      <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="mb-5 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="mt-4 h-px w-full" />
        <div className="mt-4 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
      <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="mb-5 space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-44" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="size-7 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="mb-5 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="size-7 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <div className="mb-5 flex items-center gap-4">
            <Skeleton className="size-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3.5 w-32" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <Skeleton className="mb-5 h-4 w-40" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            <Skeleton className="mb-4 h-4 w-32" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton({
  variant = "table",
}: {
  variant?: PageSkeletonVariant;
}) {
  return (
    <div className="space-y-6" aria-busy="true">
      <HeaderSkeleton />

      {variant === "table" && (
        <>
          <SearchBarSkeleton />
          <StatGridSkeleton />
          <TableSkeleton />
        </>
      )}

      {variant === "search" && (
        <>
          <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, group) => (
              <div
                key={group}
                className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
              >
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <div className="divide-y">
                  {Array.from({ length: 3 }).map((_, row) => (
                    <div key={row} className="flex items-center gap-3 px-4 py-3">
                      <Skeleton className="size-8 shrink-0 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-2/5 max-w-56" />
                        <Skeleton className="h-3 w-1/3 max-w-40" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {variant === "dashboard" && (
        <>
          <StatGridSkeleton />
          <StatGridSkeleton />
          <DashboardSkeleton />
        </>
      )}

      {variant === "detail" && <DetailSkeleton />}
    </div>
  );
}
