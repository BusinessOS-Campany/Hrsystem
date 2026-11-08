import type { ComponentType } from "react";
import {
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  HandCoins,
  Laptop,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Target,
  UserCog,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import type { NavIcon } from "@/lib/navigation";

export const NAV_ICONS: Record<
  NavIcon,
  ComponentType<{ className?: string }>
> = {
  dashboard: LayoutDashboard,
  employees: Users,
  departments: Building2,
  positions: BriefcaseBusiness,
  attendance: CalendarCheck,
  leave: CalendarDays,
  payroll: Wallet,
  loans: HandCoins,
  recruitment: UserRound,
  onboarding: ClipboardList,
  offboarding: LogOut,
  performance: Target,
  training: GraduationCap,
  assets: Laptop,
  requests: ClipboardList,
  reports: BookOpen,
  users: UserCog,
  settings: Settings,
  audit: ShieldCheck,
};
