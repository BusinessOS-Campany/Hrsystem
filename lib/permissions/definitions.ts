export type PermissionDef = {
  code: string;
  name: string;
  nameAr: string;
  module: string;
};

/**
 * Permission catalog. Codes are the contract between the database, server
 * actions, navigation and UI. Add new codes here and re-run the seed.
 */
export const PERMISSIONS: PermissionDef[] = [
  { code: "dashboard.view", name: "View dashboard", nameAr: "عرض لوحة التحكم", module: "dashboard" },

  { code: "employee.view", name: "View employees", nameAr: "عرض الموظفين", module: "employees" },
  { code: "employee.view_all", name: "View all employees", nameAr: "عرض جميع الموظفين", module: "employees" },
  { code: "employee.create", name: "Create employees", nameAr: "إضافة موظفين", module: "employees" },
  { code: "employee.update", name: "Update employees", nameAr: "تعديل الموظفين", module: "employees" },
  { code: "employee.delete", name: "Delete employees", nameAr: "حذف الموظفين", module: "employees" },
  { code: "employee.view_salary", name: "View salaries", nameAr: "عرض الرواتب", module: "employees" },
  { code: "employee.manage_salary", name: "Manage salaries", nameAr: "إدارة الرواتب", module: "employees" },
  { code: "employee.view_document", name: "View employee documents", nameAr: "عرض مستندات الموظفين", module: "employees" },
  { code: "employee.manage_document", name: "Manage employee documents", nameAr: "إدارة مستندات الموظفين", module: "employees" },

  { code: "department.view", name: "View departments", nameAr: "عرض الأقسام", module: "organization" },
  { code: "department.create", name: "Create departments", nameAr: "إضافة أقسام", module: "organization" },
  { code: "department.update", name: "Update departments", nameAr: "تعديل الأقسام", module: "organization" },
  { code: "department.delete", name: "Delete departments", nameAr: "حذف الأقسام", module: "organization" },

  { code: "position.view", name: "View positions", nameAr: "عرض الوظائف", module: "organization" },
  { code: "position.create", name: "Create positions", nameAr: "إضافة وظائف", module: "organization" },
  { code: "position.update", name: "Update positions", nameAr: "تعديل الوظائف", module: "organization" },
  { code: "position.delete", name: "Delete positions", nameAr: "حذف الوظائف", module: "organization" },

  { code: "branch.view", name: "View branches", nameAr: "عرض الفروع", module: "organization" },
  { code: "branch.manage", name: "Manage branches", nameAr: "إدارة الفروع", module: "organization" },

  { code: "attendance.view", name: "View attendance", nameAr: "عرض الحضور", module: "attendance" },
  { code: "attendance.view_all", name: "View all attendance", nameAr: "عرض حضور الجميع", module: "attendance" },
  { code: "attendance.create", name: "Record attendance", nameAr: "تسجيل الحضور", module: "attendance" },
  { code: "attendance.update", name: "Update attendance", nameAr: "تعديل الحضور", module: "attendance" },
  { code: "attendance.approve", name: "Approve attendance corrections", nameAr: "اعتماد تصحيحات الحضور", module: "attendance" },
  { code: "attendance.self", name: "Check in and out", nameAr: "تسجيل الحضور والانصراف", module: "attendance" },

  { code: "leave.view", name: "View leave", nameAr: "عرض الإجازات", module: "leave" },
  { code: "leave.view_all", name: "View all leave requests", nameAr: "عرض جميع طلبات الإجازة", module: "leave" },
  { code: "leave.request", name: "Request leave", nameAr: "طلب إجازة", module: "leave" },
  { code: "leave.approve", name: "Approve leave", nameAr: "اعتماد الإجازات", module: "leave" },
  { code: "leave.reject", name: "Reject leave", nameAr: "رفض الإجازات", module: "leave" },
  { code: "leave.manage_types", name: "Manage leave types", nameAr: "إدارة أنواع الإجازات", module: "leave" },
  { code: "leave.manage_balance", name: "Manage leave balances", nameAr: "إدارة أرصدة الإجازات", module: "leave" },

  { code: "payroll.view", name: "View payroll", nameAr: "عرض الرواتب", module: "payroll" },
  { code: "payroll.view_all", name: "View all payroll", nameAr: "عرض رواتب الجميع", module: "payroll" },
  { code: "payroll.view_self", name: "View own payslips", nameAr: "عرض قسائم راتبي", module: "payroll" },
  { code: "payroll.create", name: "Create payroll runs", nameAr: "إنشاء دورات الرواتب", module: "payroll" },
  { code: "payroll.calculate", name: "Calculate payroll", nameAr: "احتساب الرواتب", module: "payroll" },
  { code: "payroll.approve", name: "Approve payroll", nameAr: "اعتماد الرواتب", module: "payroll" },
  { code: "payroll.finalize", name: "Finalize payroll", nameAr: "إنهاء الرواتب", module: "payroll" },
  { code: "payroll.manage_components", name: "Manage salary components", nameAr: "إدارة مكونات الراتب", module: "payroll" },

  { code: "recruitment.view", name: "View recruitment", nameAr: "عرض التوظيف", module: "recruitment" },
  { code: "recruitment.create", name: "Create vacancies and candidates", nameAr: "إضافة وظائف ومرشحين", module: "recruitment" },
  { code: "recruitment.update", name: "Update recruitment pipeline", nameAr: "تحديث مسار التوظيف", module: "recruitment" },
  { code: "recruitment.delete", name: "Delete recruitment records", nameAr: "حذف سجلات التوظيف", module: "recruitment" },

  { code: "onboarding.view", name: "View onboarding", nameAr: "عرض التأهيل", module: "onboarding" },
  { code: "onboarding.manage", name: "Manage onboarding", nameAr: "إدارة التأهيل", module: "onboarding" },
  { code: "offboarding.view", name: "View offboarding", nameAr: "عرض إنهاء الخدمة", module: "offboarding" },
  { code: "offboarding.manage", name: "Manage offboarding", nameAr: "إدارة إنهاء الخدمة", module: "offboarding" },

  { code: "performance.view", name: "View performance", nameAr: "عرض الأداء", module: "performance" },
  { code: "performance.view_all", name: "View all performance reviews", nameAr: "عرض تقييمات الجميع", module: "performance" },
  { code: "performance.manage", name: "Manage performance cycles", nameAr: "إدارة دورات الأداء", module: "performance" },
  { code: "performance.review_self", name: "Submit self review", nameAr: "تقديم التقييم الذاتي", module: "performance" },
  { code: "performance.review_team", name: "Review team members", nameAr: "تقييم فريق العمل", module: "performance" },

  { code: "training.view", name: "View training", nameAr: "عرض التدريب", module: "training" },
  { code: "training.manage", name: "Manage training", nameAr: "إدارة التدريب", module: "training" },

  { code: "asset.view", name: "View assets", nameAr: "عرض الأصول", module: "assets" },
  { code: "asset.manage", name: "Manage assets", nameAr: "إدارة الأصول", module: "assets" },

  { code: "request.view", name: "View requests", nameAr: "عرض الطلبات", module: "requests" },
  { code: "request.view_all", name: "View all requests", nameAr: "عرض جميع الطلبات", module: "requests" },
  { code: "request.create", name: "Create requests", nameAr: "إنشاء طلبات", module: "requests" },
  { code: "request.approve", name: "Approve requests", nameAr: "اعتماد الطلبات", module: "requests" },

  { code: "loan.view", name: "View loans", nameAr: "عرض السلف", module: "loans" },
  { code: "loan.request", name: "Request loans", nameAr: "طلب سلف", module: "loans" },
  { code: "loan.approve", name: "Approve loans", nameAr: "اعتماد السلف", module: "loans" },

  { code: "report.view", name: "View reports", nameAr: "عرض التقارير", module: "reports" },
  { code: "notification.view", name: "View notifications", nameAr: "عرض الإشعارات", module: "system" },
  { code: "audit.view", name: "View audit log", nameAr: "عرض سجل التدقيق", module: "system" },
  { code: "settings.view", name: "View settings", nameAr: "عرض الإعدادات", module: "system" },
  { code: "settings.manage", name: "Manage settings", nameAr: "إدارة الإعدادات", module: "system" },
  { code: "user.manage", name: "Manage users", nameAr: "إدارة المستخدمين", module: "system" },
  { code: "role.manage", name: "Manage roles and permissions", nameAr: "إدارة الأدوار والصلاحيات", module: "system" },
];

export type RoleDef = {
  code: string;
  name: string;
  nameAr: string;
  description: string;
  permissions: string[] | "*";
};

const HR_OFFICER_PERMISSIONS = [
  "dashboard.view",
  "employee.view", "employee.view_all", "employee.create", "employee.update",
  "employee.view_document", "employee.manage_document",
  "department.view", "position.view", "branch.view",
  "attendance.view", "attendance.view_all", "attendance.create", "attendance.update", "attendance.approve",
  "leave.view", "leave.view_all", "leave.approve", "leave.reject", "leave.manage_balance",
  "onboarding.view", "onboarding.manage", "offboarding.view", "offboarding.manage",
  "performance.view", "performance.view_all",
  "training.view", "asset.view", "asset.manage",
  "request.view", "request.view_all", "request.approve",
  "loan.view", "report.view", "notification.view",
];

const MANAGER_PERMISSIONS = [
  "dashboard.view", "employee.view", "employee.view_document",
  "department.view", "position.view",
  "attendance.view", "attendance.approve",
  "leave.view", "leave.approve", "leave.reject",
  "performance.view", "performance.review_team",
  "request.view", "request.approve",
  "report.view", "notification.view",
];

const EMPLOYEE_PERMISSIONS = [
  "dashboard.view", "employee.view", "employee.view_document",
  "attendance.view", "attendance.self",
  "leave.view", "leave.request",
  "payroll.view", "payroll.view_self",
  "performance.view", "performance.review_self",
  "training.view", "asset.view",
  "request.view", "request.create",
  "loan.view", "loan.request",
  "notification.view",
];

export const ROLES: RoleDef[] = [
  {
    code: "SUPER_ADMIN",
    name: "Super Admin",
    nameAr: "مدير النظام",
    description: "Unrestricted access to every module and setting.",
    permissions: "*",
  },
  {
    code: "HR_ADMIN",
    name: "HR Admin",
    nameAr: "مدير الموارد البشرية",
    description: "Full HR access, payroll oversight, users and settings.",
    permissions: [
      ...new Set([
        ...PERMISSIONS.map((p) => p.code).filter((c) => c !== "role.manage"),
      ]),
    ],
  },
  {
    code: "HR_OFFICER",
    name: "HR Officer",
    nameAr: "أخصائي موارد بشرية",
    description: "Day-to-day employee and HR operations.",
    permissions: HR_OFFICER_PERMISSIONS,
  },
  {
    code: "MANAGER",
    name: "Manager",
    nameAr: "مدير",
    description: "Manages a team: attendance, leave and performance approvals.",
    permissions: MANAGER_PERMISSIONS,
  },
  {
    code: "EMPLOYEE",
    name: "Employee",
    nameAr: "موظف",
    description: "Self-service access to own profile, leave and payslips.",
    permissions: EMPLOYEE_PERMISSIONS,
  },
  {
    code: "PAYROLL_OFFICER",
    name: "Payroll Officer",
    nameAr: "مسؤول الرواتب",
    description: "Runs and finalizes payroll.",
    permissions: [
      "dashboard.view", "employee.view", "employee.view_all", "employee.view_salary",
      "payroll.view", "payroll.view_all", "payroll.create", "payroll.calculate",
      "payroll.approve", "payroll.finalize", "payroll.manage_components",
      "loan.view", "loan.approve", "report.view", "notification.view",
    ],
  },
  {
    code: "RECRUITER",
    name: "Recruiter",
    nameAr: "مسؤول التوظيف",
    description: "Vacancies, candidates and hiring pipeline.",
    permissions: [
      "dashboard.view", "employee.view",
      "recruitment.view", "recruitment.create", "recruitment.update", "recruitment.delete",
      "onboarding.view", "onboarding.manage",
      "report.view", "notification.view",
    ],
  },
];

export function permissionSet(permissions: string[] | "*") {
  return permissions === "*" ? PERMISSIONS.map((p) => p.code) : permissions;
}
