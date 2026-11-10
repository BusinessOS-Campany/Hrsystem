"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Recharts is a large client-only dependency. Lazy-loading the charts keeps it
// out of the dashboard's initial JavaScript and lets the stat cards paint first.
export const AttendanceTrendChart = dynamic(
  () => import("./charts").then((module) => module.AttendanceTrendChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[280px] w-full" />,
  },
);

export const DepartmentChart = dynamic(
  () => import("./charts").then((module) => module.DepartmentChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[280px] w-full" />,
  },
);

export const LeaveTypeChart = dynamic(
  () => import("./charts").then((module) => module.LeaveTypeChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[240px] w-full" />,
  },
);
