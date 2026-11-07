export type NavIcon =
  | "dashboard"
  | "employees"
  | "departments"
  | "positions"
  | "attendance"
  | "leave"
  | "payroll"
  | "loans"
  | "recruitment"
  | "onboarding"
  | "offboarding"
  | "performance"
  | "training"
  | "assets"
  | "requests"
  | "reports"
  | "users"
  | "settings"
  | "audit";

export type NavItem = {
  key: string;
  href: string;
  icon: NavIcon;
  permission: string;
};

export type NavGroup = {
  key: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "main",
    items: [
      { key: "dashboard", href: "/dashboard", icon: "dashboard", permission: "dashboard.view" },
    ],
  },
  {
    key: "people",
    items: [
      { key: "employees", href: "/employees", icon: "employees", permission: "employee.view" },
      { key: "departments", href: "/departments", icon: "departments", permission: "department.view" },
      { key: "positions", href: "/positions", icon: "positions", permission: "position.view" },
    ],
  },
  {
    key: "time",
    items: [
      { key: "attendance", href: "/attendance", icon: "attendance", permission: "attendance.view" },
      { key: "leave", href: "/leave", icon: "leave", permission: "leave.view" },
    ],
  },
  {
    key: "talent",
    items: [
      { key: "recruitment", href: "/recruitment", icon: "recruitment", permission: "recruitment.view" },
      { key: "onboarding", href: "/onboarding", icon: "onboarding", permission: "onboarding.view" },
      { key: "offboarding", href: "/offboarding", icon: "offboarding", permission: "offboarding.view" },
      { key: "performance", href: "/performance", icon: "performance", permission: "performance.view" },
      { key: "training", href: "/training", icon: "training", permission: "training.view" },
    ],
  },
  {
    key: "operations",
    items: [
      { key: "payroll", href: "/payroll", icon: "payroll", permission: "payroll.view" },
      { key: "loans", href: "/loans", icon: "loans", permission: "loan.view" },
      { key: "assets", href: "/assets", icon: "assets", permission: "asset.view" },
      { key: "requests", href: "/requests", icon: "requests", permission: "request.view" },
    ],
  },
  {
    key: "insights",
    items: [
      { key: "reports", href: "/reports", icon: "reports", permission: "report.view" },
    ],
  },
  {
    key: "system",
    items: [
      { key: "users", href: "/users", icon: "users", permission: "user.manage" },
      { key: "settings", href: "/settings", icon: "settings", permission: "settings.view" },
      { key: "audit", href: "/audit", icon: "audit", permission: "audit.view" },
    ],
  },
];
