/**
 * HRSYS development seed.
 *
 * This is intentionally realistic: 50 employees, a reporting hierarchy,
 * attendance history, leave balances, payroll runs, recruitment pipeline,
 * onboarding/offboarding, performance, training, assets and audit records.
 *
 * Development credentials are printed at the end. Never reuse them in production.
 */
import {
  PrismaClient,
  Gender,
  MaritalStatus,
  EmploymentType,
  EmploymentStatus,
  AttendanceStatus,
  LeaveStatus,
  PayrollRunStatus,
  PayrollPeriodStatus,
  SalaryComponentType,
  CalculationType,
  VacancyStatus,
  ApplicationStage,
  ApplicationStatus,
  InterviewStatus,
  OfferStatus,
  LifecycleStatus,
  OffboardingType,
  ReviewStatus,
  GoalStatus,
  CourseStatus,
  EnrollmentStatus,
  AssetStatus,
  AssetCondition,
  RequestType,
  RequestStatus,
  ApprovalStatus,
  NotificationType,
  AuditAction,
  CorrectionStatus,
  LoanStatus,
  InstallmentStatus,
  DocumentType,
  ContactType,
  type Employee,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSIONS, ROLES, permissionSet } from "../lib/permissions/definitions";

const prisma = new PrismaClient();
const PASSWORD = "Hrsys@2026!";
const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD ??
  (process.env.NODE_ENV === "production" ? PASSWORD : "admin");
const TODAY = "2026-11-03";

const d = (value: string) => new Date(`${value}T00:00:00.000Z`);
const at = (day: string, time: string) => new Date(`${day}T${time}:00+03:00`);
const round2 = (n: number) => Math.round(n * 100) / 100;

type SeedEmployee = {
  no: number;
  first: string;
  last: string;
  firstAr: string;
  lastAr: string;
  gender: Gender;
  dept: string;
  pos: string;
  managerNo: number | null;
  hire: string;
  basic: number;
  status?: EmploymentStatus;
  dob?: string;
  contractEnd?: string;
  termination?: string;
  nationality?: string;
  city?: string;
  type?: EmploymentType;
};

const EMPLOYEES: SeedEmployee[] = [
  { no: 1, first: "Khalid", last: "Al-Hadhrami", firstAr: "خالد", lastAr: "الحضرمي", gender: Gender.MALE, dept: "EXEC", pos: "CEO", managerNo: null, hire: "2018-01-15", basic: 3000000, dob: "1978-04-12", nationality: "Yemeni", city: "Sana'a" },
  { no: 2, first: "Sara", last: "Al-Sanaani", firstAr: "سارة", lastAr: "الصنعاني", gender: Gender.FEMALE, dept: "HR", pos: "MGR", managerNo: 1, hire: "2019-03-01", basic: 1400000, dob: "1988-11-05", nationality: "Yemeni", city: "Sana'a" },
  { no: 3, first: "Mohammed", last: "Al-Maqtari", firstAr: "محمد", lastAr: "المقطري", gender: Gender.MALE, dept: "HR", pos: "OFF", managerNo: 2, hire: "2021-06-15", basic: 700000, nationality: "Yemeni", city: "Sana'a" },
  { no: 4, first: "Noura", last: "Al-Ahdal", firstAr: "نورة", lastAr: "الأهدل", gender: Gender.FEMALE, dept: "HR", pos: "REC", managerNo: 2, hire: "2022-09-01", basic: 650000, nationality: "Yemeni", city: "Sana'a" },
  { no: 5, first: "Faisal", last: "Al-Iryani", firstAr: "فيصل", lastAr: "الإرياني", gender: Gender.MALE, dept: "FIN", pos: "MGR", managerNo: 1, hire: "2019-05-10", basic: 1500000, nationality: "Yemeni", city: "Sana'a" },
  { no: 6, first: "Reem", last: "Al-Sharabi", firstAr: "ريم", lastAr: "الشرعبي", gender: Gender.FEMALE, dept: "FIN", pos: "ACC", managerNo: 5, hire: "2021-02-01", basic: 600000, nationality: "Yemeni", city: "Aden" },
  { no: 7, first: "Abdullah", last: "Al-Wasabi", firstAr: "عبدالله", lastAr: "الوصابي", gender: Gender.MALE, dept: "FIN", pos: "PAY", managerNo: 5, hire: "2020-11-01", basic: 750000, nationality: "Yemeni", city: "Sana'a" },
  { no: 8, first: "Omar", last: "Al-Hakimi", firstAr: "عمر", lastAr: "الحكيمي", gender: Gender.MALE, dept: "IT", pos: "MGR", managerNo: 1, hire: "2019-08-20", basic: 1600000, dob: "1985-11-12", nationality: "Yemeni", city: "Sana'a" },
  { no: 9, first: "Lina", last: "Al-Zubairi", firstAr: "لينا", lastAr: "الزبيري", gender: Gender.FEMALE, dept: "DEV", pos: "MGR", managerNo: 8, hire: "2021-04-01", basic: 1200000, nationality: "Yemeni", city: "Sana'a" },
  { no: 10, first: "Yousef", last: "Al-Amri", firstAr: "يوسف", lastAr: "العمري", gender: Gender.MALE, dept: "DEV", pos: "ENG", managerNo: 9, hire: "2023-01-10", basic: 900000, dob: "1993-02-18", nationality: "Yemeni", city: "Sana'a" },
  { no: 11, first: "Huda", last: "Al-Sabri", firstAr: "هدى", lastAr: "الصبري", gender: Gender.FEMALE, dept: "SUP", pos: "SUP", managerNo: 8, hire: "2022-07-15", basic: 550000, status: EmploymentStatus.ON_LEAVE, nationality: "Yemeni", city: "Sana'a" },
  { no: 12, first: "Turki", last: "Al-Aghbari", firstAr: "تركي", lastAr: "الأغبري", gender: Gender.MALE, dept: "SALES", pos: "MGR", managerNo: 1, hire: "2020-02-01", basic: 1300000, nationality: "Yemeni", city: "Aden" },
  { no: 13, first: "Lama", last: "Al-Bakri", firstAr: "لمى", lastAr: "البكري", gender: Gender.FEMALE, dept: "SALES", pos: "EXE", managerNo: 12, hire: "2023-05-01", basic: 600000, nationality: "Yemeni", city: "Aden" },
  { no: 14, first: "Hassan", last: "Al-Jabri", firstAr: "حسن", lastAr: "الجبري", gender: Gender.MALE, dept: "SALES", pos: "EXE", managerNo: 12, hire: "2024-02-01", basic: 575000, nationality: "Yemeni", city: "Aden" },
  { no: 15, first: "Aisha", last: "Al-Najjar", firstAr: "عائشة", lastAr: "النجار", gender: Gender.FEMALE, dept: "OPS", pos: "MGR", managerNo: 1, hire: "2020-06-01", basic: 1250000, dob: "1990-11-20", nationality: "Jordanian", city: "Taiz" },
  { no: 16, first: "Ziad", last: "Al-Rashid", firstAr: "زياد", lastAr: "الراشد", gender: Gender.MALE, dept: "OPS", pos: "COORD", managerNo: 15, hire: "2023-03-15", basic: 500000, status: EmploymentStatus.ON_LEAVE, nationality: "Yemeni", city: "Taiz" },
  { no: 17, first: "Maha", last: "Al-Salem", firstAr: "مها", lastAr: "السالم", gender: Gender.FEMALE, dept: "MKT", pos: "MGR", managerNo: 1, hire: "2021-01-10", basic: 1200000, nationality: "Yemeni", city: "Sana'a" },
  { no: 18, first: "Nasser", last: "Al-Harthy", firstAr: "ناصر", lastAr: "الحارثي", gender: Gender.MALE, dept: "MKT", pos: "SPEC", managerNo: 17, hire: "2023-08-01", basic: 550000, nationality: "Yemeni", city: "Sana'a" },
  { no: 19, first: "Dana", last: "Al-Khalidi", firstAr: "دانة", lastAr: "الخالدي", gender: Gender.FEMALE, dept: "EXEC", pos: "ASST", managerNo: 1, hire: "2021-09-01", basic: 700000, nationality: "Yemeni", city: "Sana'a" },
  { no: 20, first: "Fatimah", last: "Al-Hammadi", firstAr: "فاطمة", lastAr: "الهمداني", gender: Gender.FEMALE, dept: "HR", pos: "OFF", managerNo: 2, hire: "2024-01-15", basic: 600000, nationality: "Yemeni", city: "Sana'a" },
  { no: 21, first: "Rakan", last: "Al-Sulaiman", firstAr: "راكان", lastAr: "السليمان", gender: Gender.MALE, dept: "DEV", pos: "ENG", managerNo: 9, hire: "2024-03-01", basic: 850000, nationality: "Yemeni", city: "Sana'a" },
  { no: 22, first: "Jana", last: "Al-Dhahri", firstAr: "جنى", lastAr: "الظاهري", gender: Gender.FEMALE, dept: "SUP", pos: "SUP", managerNo: 8, hire: "2024-05-10", basic: 525000, dob: "1992-12-01", nationality: "Yemeni", city: "Sana'a" },
  { no: 23, first: "Salem", last: "Al-Kuhlani", firstAr: "سالم", lastAr: "الكحلاني", gender: Gender.MALE, dept: "FIN", pos: "ACC", managerNo: 5, hire: "2023-11-01", basic: 575000, nationality: "Yemeni", city: "Sana'a" },
  { no: 24, first: "Dalal", last: "Al-Radaei", firstAr: "دلال", lastAr: "الرضاعي", gender: Gender.FEMALE, dept: "MKT", pos: "SPEC", managerNo: 17, hire: "2024-07-01", basic: 525000, nationality: "Yemeni", city: "Sana'a" },
  { no: 25, first: "Bader", last: "Al-Baydani", firstAr: "بدر", lastAr: "البيضاني", gender: Gender.MALE, dept: "SALES", pos: "EXE", managerNo: 12, hire: "2024-09-01", basic: 550000, nationality: "Yemeni", city: "Aden" },
  { no: 26, first: "Ghada", last: "Al-Sabri", firstAr: "غادة", lastAr: "الصبري", gender: Gender.FEMALE, dept: "HR", pos: "OFF", managerNo: 2, hire: "2025-01-15", basic: 575000, nationality: "Yemeni", city: "Sana'a" },
  { no: 27, first: "Majed", last: "Al-Qadhi", firstAr: "ماجد", lastAr: "القاضي", gender: Gender.MALE, dept: "DEV", pos: "ENG", managerNo: 9, hire: "2025-02-01", basic: 800000, nationality: "Yemeni", city: "Sana'a" },
  { no: 28, first: "Rania", last: "Al-Absi", firstAr: "رانيا", lastAr: "العبسي", gender: Gender.FEMALE, dept: "OPS", pos: "COORD", managerNo: 15, hire: "2025-03-10", basic: 475000, nationality: "Yemeni", city: "Taiz" },
  { no: 29, first: "Tariq", last: "Al-Hakami", firstAr: "طارق", lastAr: "الحكمي", gender: Gender.MALE, dept: "FIN", pos: "ACC", managerNo: 5, hire: "2025-04-01", basic: 550000, nationality: "Yemeni", city: "Sana'a" },
  { no: 30, first: "Shaden", last: "Al-Rashed", firstAr: "شادن", lastAr: "الراشد", gender: Gender.FEMALE, dept: "HR", pos: "REC", managerNo: 2, hire: "2025-05-15", basic: 550000, dob: "1991-11-25", nationality: "Yemeni", city: "Sana'a" },
  { no: 31, first: "Ibrahim", last: "Al-Marwani", firstAr: "إبراهيم", lastAr: "المرواني", gender: Gender.MALE, dept: "SUP", pos: "SUP", managerNo: 8, hire: "2025-06-01", basic: 500000, nationality: "Yemeni", city: "Sana'a" },
  { no: 32, first: "Wafa", last: "Al-Shami", firstAr: "وفاء", lastAr: "الشامي", gender: Gender.FEMALE, dept: "MKT", pos: "SPEC", managerNo: 17, hire: "2025-07-01", basic: 500000, nationality: "Yemeni", city: "Sana'a" },
  { no: 33, first: "Fahad", last: "Al-Haddad", firstAr: "فهد", lastAr: "الحداد", gender: Gender.MALE, dept: "SALES", pos: "EXE", managerNo: 12, hire: "2025-08-01", basic: 525000, nationality: "Yemeni", city: "Aden" },
  { no: 34, first: "Amal", last: "Al-Mansouri", firstAr: "أمل", lastAr: "المنصوري", gender: Gender.FEMALE, dept: "HR", pos: "OFF", managerNo: 2, hire: "2025-09-01", basic: 550000, nationality: "Yemeni", city: "Sana'a" },
  { no: 35, first: "Nayef", last: "Al-Sabri", firstAr: "نايف", lastAr: "الصبري", gender: Gender.MALE, dept: "DEV", pos: "ENG", managerNo: 9, hire: "2025-10-01", basic: 775000, nationality: "Yemeni", city: "Sana'a" },
  { no: 36, first: "Layla", last: "Al-Ahdal", firstAr: "ليلى", lastAr: "الأهدل", gender: Gender.FEMALE, dept: "EXEC", pos: "ASST", managerNo: 1, hire: "2025-11-01", basic: 600000, nationality: "Yemeni", city: "Sana'a" },
  { no: 37, first: "Sultan", last: "Al-Taizi", firstAr: "سلطان", lastAr: "التعزي", gender: Gender.MALE, dept: "OPS", pos: "COORD", managerNo: 15, hire: "2025-12-01", basic: 475000, nationality: "Yemeni", city: "Taiz" },
  { no: 38, first: "Hessa", last: "Al-Wasabi", firstAr: "حصة", lastAr: "الوصابي", gender: Gender.FEMALE, dept: "FIN", pos: "ACC", managerNo: 5, hire: "2026-01-10", basic: 525000, nationality: "Yemeni", city: "Sana'a" },
  { no: 39, first: "Mishal", last: "Al-Salem", firstAr: "مشعل", lastAr: "السالم", gender: Gender.MALE, dept: "SALES", pos: "EXE", managerNo: 12, hire: "2026-02-01", basic: 525000, nationality: "Yemeni", city: "Aden" },
  { no: 40, first: "Yara", last: "Al-Harthy", firstAr: "يارا", lastAr: "الحارثي", gender: Gender.FEMALE, dept: "MKT", pos: "SPEC", managerNo: 17, hire: "2026-03-01", basic: 500000, nationality: "Yemeni", city: "Sana'a" },
  { no: 41, first: "Adel", last: "Al-Amri", firstAr: "عادل", lastAr: "العمري", gender: Gender.MALE, dept: "SUP", pos: "SUP", managerNo: 8, hire: "2026-04-01", basic: 475000, nationality: "Yemeni", city: "Sana'a" },
  { no: 42, first: "Raghad", last: "Al-Iryani", firstAr: "رغد", lastAr: "الإرياني", gender: Gender.FEMALE, dept: "HR", pos: "OFF", managerNo: 2, hire: "2026-05-01", basic: 525000, nationality: "Yemeni", city: "Sana'a" },
  { no: 43, first: "Saad", last: "Al-Hakimi", firstAr: "سعد", lastAr: "الحكمي", gender: Gender.MALE, dept: "DEV", pos: "ENG", managerNo: 9, hire: "2026-08-15", basic: 750000, nationality: "Yemeni", city: "Sana'a", type: EmploymentType.CONTRACT, contractEnd: "2026-11-15" },
  { no: 44, first: "Leen", last: "Al-Maqtari", firstAr: "لين", lastAr: "المقطري", gender: Gender.FEMALE, dept: "HR", pos: "REC", managerNo: 2, hire: "2026-09-01", basic: 525000, nationality: "Yemeni", city: "Sana'a", type: EmploymentType.CONTRACT, contractEnd: "2026-12-01" },
  { no: 45, first: "Faisal", last: "Al-Sharabi", firstAr: "فيصل", lastAr: "الشرعبي", gender: Gender.MALE, dept: "SALES", pos: "EXE", managerNo: 12, hire: "2026-10-01", basic: 525000, nationality: "Yemeni", city: "Aden", type: EmploymentType.CONTRACT, contractEnd: "2026-12-20" },
  { no: 46, first: "Noor", last: "Al-Sanaani", firstAr: "نور", lastAr: "الصنعاني", gender: Gender.FEMALE, dept: "MKT", pos: "SPEC", managerNo: 17, hire: "2026-10-15", basic: 500000, nationality: "Yemeni", city: "Sana'a" },
  { no: 47, first: "Abdulrahman", last: "Al-Adeni", firstAr: "عبدالرحمن", lastAr: "العدني", gender: Gender.MALE, dept: "OPS", pos: "COORD", managerNo: 15, hire: "2026-11-01", basic: 475000, nationality: "Yemeni", city: "Taiz" },
  { no: 48, first: "Kareem", last: "Hassan", firstAr: "كريم", lastAr: "حسن", gender: Gender.MALE, dept: "FIN", pos: "ACC", managerNo: 5, hire: "2026-10-20", basic: 525000, nationality: "Egyptian", city: "Sana'a" },
  { no: 49, first: "Hana", last: "Al-Hammadi", firstAr: "هناء", lastAr: "الهمداني", gender: Gender.FEMALE, dept: "HR", pos: "OFF", managerNo: 2, hire: "2024-02-01", basic: 575000, status: EmploymentStatus.RESIGNED, termination: "2026-10-15", nationality: "Yemeni", city: "Sana'a" },
  { no: 50, first: "Sami", last: "Al-Taizi", firstAr: "سامي", lastAr: "التعزي", gender: Gender.MALE, dept: "SALES", pos: "EXE", managerNo: 12, hire: "2023-04-01", basic: 550000, status: EmploymentStatus.TERMINATED, termination: "2026-09-30", nationality: "Yemeni", city: "Aden" },
];

function seededRandom(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  console.log("Clearing existing data…");
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.approvalStep.deleteMany();
  await prisma.approvalWorkflowStep.deleteMany();
  await prisma.approvalWorkflow.deleteMany();
  await prisma.employeeRequest.deleteMany();
  await prisma.assetAssignment.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.employeeSkill.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.trainingEnrollment.deleteMany();
  await prisma.trainingCourse.deleteMany();
  await prisma.performanceRating.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.performanceReview.deleteMany();
  await prisma.performanceCycle.deleteMany();
  await prisma.offboardingTask.deleteMany();
  await prisma.offboarding.deleteMany();
  await prisma.onboardingTask.deleteMany();
  await prisma.onboarding.deleteMany();
  await prisma.jobOffer.deleteMany();
  await prisma.interview.deleteMany();
  await prisma.candidateApplication.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.jobVacancy.deleteMany();
  await prisma.salaryAdvance.deleteMany();
  await prisma.loanInstallment.deleteMany();
  await prisma.employeeLoan.deleteMany();
  await prisma.bonus.deleteMany();
  await prisma.deduction.deleteMany();
  await prisma.payrollItem.deleteMany();
  await prisma.payrollRun.deleteMany();
  await prisma.payrollPeriod.deleteMany();
  await prisma.employeeSalary.deleteMany();
  await prisma.salaryComponent.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.leaveBalance.deleteMany();
  await prisma.leaveType.deleteMany();
  await prisma.attendanceCorrection.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.workSchedule.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.employmentHistory.deleteMany();
  await prisma.employment.deleteMany();
  await prisma.employeeDocument.deleteMany();
  await prisma.employeeContact.deleteMany();
  await prisma.employeeBankAccount.deleteMany();
  await prisma.session.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.position.deleteMany();
  await prisma.department.deleteMany();
  await prisma.workLocation.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.company.deleteMany();
  await prisma.systemSetting.deleteMany();

  console.log("Seeding permissions and roles…");
  await prisma.permission.createMany({
    data: PERMISSIONS.map((p) => ({
      code: p.code,
      name: p.name,
      nameAr: p.nameAr,
      module: p.module,
    })),
  });
  const permissions = await prisma.permission.findMany();
  const permissionId = new Map(permissions.map((p) => [p.code, p.id]));

  const roleIds = new Map<string, string>();
  for (const role of ROLES) {
    const created = await prisma.role.create({
      data: {
        code: role.code,
        name: role.name,
        nameAr: role.nameAr,
        description: role.description,
        isSystem: true,
      },
    });
    roleIds.set(role.code, created.id);
    await prisma.rolePermission.createMany({
      data: permissionSet(role.permissions).map((code) => ({
        roleId: created.id,
        permissionId: permissionId.get(code)!,
      })),
    });
  }

  console.log("Seeding company and organization…");
  const company = await prisma.company.create({
    data: {
      name: "YemenTech Solutions",
      nameAr: "يمن تك للحلول",
      legalName: "YemenTech Solutions LLC",
      taxId: "YEM-3101234567",
      email: "info@yementech.ye",
      phone: "+9671234567",
      address: "Hadda Street, Sana'a",
      city: "Sana'a",
      country: "Yemen",
      currency: "YER",
      timezone: "Asia/Aden",
    },
  });

  const sanaa = await prisma.branch.create({
    data: { companyId: company.id, name: "Sana'a HQ", nameAr: "المقر الرئيسي - صنعاء", code: "SAH", address: "Hadda Street, Sana'a", phone: "+9671234567" },
  });
  const aden = await prisma.branch.create({
    data: { companyId: company.id, name: "Aden Office", nameAr: "مكتب عدن", code: "ADE", address: "Al-Mualla District, Aden", phone: "+9672234567" },
  });
  const taiz = await prisma.branch.create({
    data: { companyId: company.id, name: "Taiz Office", nameAr: "مكتب تعز", code: "TAI", address: "Al-Qahira District, Taiz", phone: "+9674234567" },
  });

  const locSanaa = await prisma.workLocation.create({
    data: { companyId: company.id, branchId: sanaa.id, name: "Sana'a Headquarters", nameAr: "المقر الرئيسي بصنعاء", address: "Hadda Street", city: "Sana'a", country: "Yemen" },
  });
  const locAden = await prisma.workLocation.create({
    data: { companyId: company.id, branchId: aden.id, name: "Aden Office", nameAr: "مكتب عدن", address: "Al-Mualla District", city: "Aden", country: "Yemen" },
  });
  const locTaiz = await prisma.workLocation.create({
    data: { companyId: company.id, branchId: taiz.id, name: "Taiz Office", nameAr: "مكتب تعز", address: "Al-Qahira District", city: "Taiz", country: "Yemen" },
  });
  const locRemote = await prisma.workLocation.create({
    data: { companyId: company.id, branchId: sanaa.id, name: "Remote", nameAr: "عن بعد", city: "Sana'a", country: "Yemen" },
  });

  const deptData = [
    { key: "EXEC", name: "Executive", nameAr: "الإدارة التنفيذية", code: "EXEC", parent: null, managerNo: 1 },
    { key: "HR", name: "Human Resources", nameAr: "الموارد البشرية", code: "HR", parent: null, managerNo: 2 },
    { key: "FIN", name: "Finance", nameAr: "المالية", code: "FIN", parent: null, managerNo: 5 },
    { key: "IT", name: "Information Technology", nameAr: "تقنية المعلومات", code: "IT", parent: null, managerNo: 8 },
    { key: "DEV", name: "Development", nameAr: "التطوير", code: "DEV", parent: "IT", managerNo: 9 },
    { key: "SUP", name: "Support", nameAr: "الدعم الفني", code: "SUP", parent: "IT", managerNo: 8 },
    { key: "SALES", name: "Sales", nameAr: "المبيعات", code: "SALES", parent: null, managerNo: 12 },
    { key: "OPS", name: "Operations", nameAr: "العمليات", code: "OPS", parent: null, managerNo: 15 },
    { key: "MKT", name: "Marketing", nameAr: "التسويق", code: "MKT", parent: null, managerNo: 17 },
  ];

  const deptIds = new Map<string, string>();
  for (const dept of deptData) {
    const created = await prisma.department.create({
      data: {
        companyId: company.id,
        branchId: dept.key === "SALES" ? aden.id : dept.key === "OPS" ? taiz.id : sanaa.id,
        name: dept.name,
        nameAr: dept.nameAr,
        code: dept.code,
        parentId: dept.parent ? deptIds.get(dept.parent) : null,
      },
    });
    deptIds.set(dept.key, created.id);
  }

  const positionData = [
    ["EXEC", "CEO", "Chief Executive Officer", "الرئيس التنفيذي", "G1"],
    ["EXEC", "ASST", "Executive Assistant", "مساعد تنفيذي", "G5"],
    ["HR", "MGR", "HR Manager", "مدير الموارد البشرية", "G3"],
    ["HR", "OFF", "HR Officer", "أخصائي موارد بشرية", "G5"],
    ["HR", "REC", "Recruiter", "مسؤول توظيف", "G5"],
    ["FIN", "MGR", "Finance Manager", "مدير المالية", "G3"],
    ["FIN", "ACC", "Accountant", "محاسب", "G5"],
    ["FIN", "PAY", "Payroll Officer", "مسؤول رواتب", "G5"],
    ["IT", "MGR", "IT Manager", "مدير تقنية المعلومات", "G3"],
    ["DEV", "MGR", "Development Manager", "مدير التطوير", "G3"],
    ["DEV", "ENG", "Software Engineer", "مهندس برمجيات", "G5"],
    ["SUP", "SUP", "Support Specialist", "أخصائي دعم فني", "G6"],
    ["SALES", "MGR", "Sales Manager", "مدير المبيعات", "G3"],
    ["SALES", "EXE", "Sales Executive", "تنفيذي مبيعات", "G6"],
    ["OPS", "MGR", "Operations Manager", "مدير العمليات", "G3"],
    ["OPS", "COORD", "Operations Coordinator", "منسق عمليات", "G6"],
    ["MKT", "MGR", "Marketing Manager", "مدير التسويق", "G3"],
    ["MKT", "SPEC", "Marketing Specialist", "أخصائي تسويق", "G6"],
  ] as const;

  const positionIds = new Map<string, string>();
  for (const [deptKey, code, name, nameAr, grade] of positionData) {
    const created = await prisma.position.create({
      data: {
        departmentId: deptIds.get(deptKey)!,
        name,
        nameAr,
        code,
        grade,
        minSalary: grade === "G3" ? 20000 : grade === "G5" ? 10000 : 8000,
        maxSalary: grade === "G3" ? 40000 : grade === "G5" ? 22000 : 16000,
        description: `${name} position in ${deptKey}.`,
      },
    });
    positionIds.set(`${deptKey}:${code}`, created.id);
  }

  console.log("Seeding schedules, holidays and leave types…");
  const standardSchedule = await prisma.workSchedule.create({
    data: {
      companyId: company.id,
      name: "Standard — Sun to Thu",
      nameAr: "الدوام الرسمي — الأحد إلى الخميس",
      startTime: "08:00",
      endTime: "17:00",
      workDays: [0, 1, 2, 3, 4],
      graceMinutes: 10,
      isDefault: true,
    },
  });
  await prisma.workSchedule.create({
    data: {
      companyId: company.id,
      name: "Flexible Remote",
      nameAr: "دوام مرن عن بعد",
      startTime: "09:00",
      endTime: "18:00",
      workDays: [0, 1, 2, 3, 4],
      graceMinutes: 30,
    },
  });
  await prisma.shift.createMany({
    data: [
      { scheduleId: standardSchedule.id, name: "Morning", nameAr: "صباحية", startTime: "08:00", endTime: "17:00" },
      { scheduleId: standardSchedule.id, name: "Evening", nameAr: "مسائية", startTime: "13:00", endTime: "22:00" },
    ],
  });

  await prisma.holiday.createMany({
    data: [
      { companyId: company.id, name: "Labour Day", nameAr: "عيد العمال", date: d("2026-05-01") },
      { companyId: company.id, name: "Unity Day", nameAr: "عيد الوحدة اليمنية", date: d("2026-05-22") },
      { companyId: company.id, name: "Eid Al-Fitr", nameAr: "عيد الفطر", date: d("2026-03-20") },
      { companyId: company.id, name: "Eid Al-Fitr Holiday", nameAr: "إجازة عيد الفطر", date: d("2026-03-23") },
      { companyId: company.id, name: "Eid Al-Adha", nameAr: "عيد الأضحى", date: d("2026-05-27") },
      { companyId: company.id, name: "Islamic New Year", nameAr: "رأس السنة الهجرية", date: d("2026-06-16") },
      { companyId: company.id, name: "Prophet's Birthday", nameAr: "المولد النبوي", date: d("2026-08-25") },
      { companyId: company.id, name: "September Revolution", nameAr: "ثورة 26 سبتمبر", date: d("2026-09-26") },
      { companyId: company.id, name: "Independence Day", nameAr: "عيد الاستقلال", date: d("2026-11-30") },
    ],
  });

  const leaveTypesData = [
    ["ANNUAL", "Annual Leave", "إجازة سنوية", 30, true, false, "#2563eb"],
    ["SICK", "Sick Leave", "إجازة مرضية", 10, true, false, "#dc2626"],
    ["EMERGENCY", "Emergency Leave", "إجازة طارئة", 5, true, false, "#d97706"],
    ["UNPAID", "Unpaid Leave", "إجازة بدون راتب", 30, false, true, "#6b7280"],
    ["MATERNITY", "Maternity Leave", "إجازة أمومة", 70, true, true, "#db2777"],
    ["PATERNITY", "Paternity Leave", "إجازة أبوة", 3, true, false, "#0891b2"],
    ["BEREAVEMENT", "Bereavement Leave", "إجازة وفاة", 5, true, false, "#475569"],
    ["MARRIAGE", "Marriage Leave", "إجازة زواج", 5, true, false, "#7c3aed"],
  ] as const;

  const leaveTypeIds = new Map<string, string>();
  for (const [code, name, nameAr, maxDays, isPaid, requiresHr, color] of leaveTypesData) {
    const created = await prisma.leaveType.create({
      data: {
        companyId: company.id,
        code,
        name,
        nameAr,
        maxDaysPerYear: maxDays,
        isPaid,
        requiresHrApproval: requiresHr,
        color,
        carryOver: code === "ANNUAL",
      },
    });
    leaveTypeIds.set(code, created.id);
  }

  console.log("Seeding salary components…");
  const componentData = [
    ["BASIC", "Basic Salary", "الراتب الأساسي", SalaryComponentType.EARNING, CalculationType.FIXED, null, true, true],
    ["HOUSING", "Housing Allowance", "بدل السكن", SalaryComponentType.EARNING, CalculationType.PERCENTAGE, 25, true, false],
    ["TRANSPORT", "Transport Allowance", "بدل النقل", SalaryComponentType.EARNING, CalculationType.PERCENTAGE, 10, true, false],
    ["MOBILE", "Mobile Allowance", "بدل الهاتف", SalaryComponentType.EARNING, CalculationType.PERCENTAGE, 5, true, false],
    ["COMMISSION", "Sales Commission", "عمولة المبيعات", SalaryComponentType.EARNING, CalculationType.PERCENTAGE, 2, true, false],
    ["OVERTIME", "Overtime", "العمل الإضافي", SalaryComponentType.EARNING, CalculationType.FIXED, null, true, false],
    ["BONUS", "Bonus", "مكافأة", SalaryComponentType.EARNING, CalculationType.FIXED, null, true, false],
    ["SOCIAL_INSURANCE", "Social Insurance", "التأمينات الاجتماعية", SalaryComponentType.DEDUCTION, CalculationType.PERCENTAGE, 6, false, true],
    ["ABSENCE", "Absence Deduction", "خصم الغياب", SalaryComponentType.DEDUCTION, CalculationType.FIXED, null, false, false],
    ["LATE", "Late Deduction", "خصم التأخير", SalaryComponentType.DEDUCTION, CalculationType.FIXED, null, false, false],
    ["LOAN", "Loan Repayment", "قسط السلفة", SalaryComponentType.DEDUCTION, CalculationType.FIXED, null, false, false],
    ["TAX", "Income Tax", "ضريبة الدخل", SalaryComponentType.DEDUCTION, CalculationType.PERCENTAGE, 0, false, false],
  ] as const;

  const componentIds = new Map<string, string>();
  for (const [code, name, nameAr, type, calculationType, percentage, isTaxable, isStatutory] of componentData) {
    const created = await prisma.salaryComponent.create({
      data: {
        companyId: company.id,
        code,
        name,
        nameAr,
        type,
        calculationType,
        percentage: percentage === null ? null : percentage,
        isTaxable,
        isStatutory,
      },
    });
    componentIds.set(code, created.id);
  }

  console.log("Seeding employees…");
  const employees = new Map<number, Employee>();

  for (const e of EMPLOYEES) {
    const manager = e.managerNo ? employees.get(e.managerNo) : null;
    const branchId = e.city === "Aden" ? aden.id : e.city === "Taiz" ? taiz.id : sanaa.id;
    const workLocationId = e.city === "Aden" ? locAden.id : e.city === "Taiz" ? locTaiz.id : e.no >= 43 ? locRemote.id : locSanaa.id;
    const contractEnd = e.contractEnd ?? (e.type === EmploymentType.CONTRACT ? "2027-01-01" : "2027-12-31");
    const status = e.status ?? EmploymentStatus.ACTIVE;
    const dob = e.dob ?? `${1985 + (e.no % 13)}-${String(((e.no * 3) % 12) + 1).padStart(2, "0")}-${String(((e.no * 7) % 27) + 1).padStart(2, "0")}`;

    const employee = await prisma.employee.create({
      data: {
        employeeNo: `EMP-${String(e.no).padStart(4, "0")}`,
        firstName: e.first,
        lastName: e.last,
        firstNameAr: e.firstAr,
        lastNameAr: e.lastAr,
        gender: e.gender,
        dateOfBirth: d(dob),
        nationality: e.nationality ?? "Yemeni",
        nationalId: String(1000000000 + e.no),
        passportNo: e.nationality && e.nationality !== "Yemeni" ? `P${String(2000000 + e.no)}` : null,
        maritalStatus: e.no % 3 === 0 ? MaritalStatus.SINGLE : MaritalStatus.MARRIED,
        phone: `+9677${String(10000000 + e.no * 137).slice(0, 8)}`,
        email: `${e.first.toLowerCase()}.${e.last.toLowerCase().replace(/[^a-z]/g, "")}@yementech.ye`,
        personalEmail: `${e.first.toLowerCase()}${e.no}@gmail.com`,
        address: e.city === "Aden" ? "Al-Mualla District" : e.city === "Taiz" ? "Al-Qahira District" : "Hadda District",
        city: e.city ?? "Sana'a",
        country: "Yemen",
        emergencyName: e.no % 2 === 0 ? "Family Contact" : "Ahmed Al-Salem",
        emergencyPhone: `+9677${String(20000000 + e.no * 211).slice(0, 8)}`,
        emergencyRelation: e.no % 2 === 0 ? "Spouse" : "Sibling",
        status,
        hireDate: d(e.hire),
        terminationDate: e.termination ? d(e.termination) : null,
        managerId: manager?.id ?? null,
      },
    });
    employees.set(e.no, employee);

    const employment = await prisma.employment.create({
      data: {
        employeeId: employee.id,
        companyId: company.id,
        branchId,
        departmentId: deptIds.get(e.dept)!,
        positionId: positionIds.get(`${e.dept}:${e.pos}`)!,
        workLocationId,
        managerId: manager?.id ?? null,
        employmentType: e.type ?? EmploymentType.FULL_TIME,
        status,
        hireDate: d(e.hire),
        contractStart: d(e.hire),
        contractEnd: d(contractEnd),
        probationEnd: new Date(new Date(`${e.hire}T00:00:00.000Z`).getTime() + 90 * 86400000),
        basicSalary: e.basic,
        currency: "YER",
        isCurrent: !e.termination,
        endDate: e.termination ? d(e.termination) : null,
      },
    });
    const salaryRows = [
      { componentId: componentIds.get("BASIC")!, amount: e.basic },
      { componentId: componentIds.get("HOUSING")!, amount: round2(e.basic * 0.25) },
      { componentId: componentIds.get("TRANSPORT")!, amount: round2(e.basic * 0.1) },
      { componentId: componentIds.get("MOBILE")!, amount: round2(e.basic * 0.05) },
    ];
    if (e.dept === "SALES") {
      salaryRows.push({ componentId: componentIds.get("COMMISSION")!, amount: round2(e.basic * 0.02) });
    }
    await prisma.employeeSalary.createMany({
      data: salaryRows.map((row) => ({
        employeeId: employee.id,
        componentId: row.componentId,
        amount: row.amount,
        effectiveFrom: d(e.hire),
      })),
    });

    await prisma.employeeContact.create({
      data: {
        employeeId: employee.id,
        type: ContactType.EMERGENCY,
        name: e.no % 2 === 0 ? "Family Contact" : "Ahmed Al-Salem",
        relation: e.no % 2 === 0 ? "Spouse" : "Sibling",
        phone: `+9677${String(20000000 + e.no * 211).slice(0, 8)}`,
        isPrimary: true,
      },
    });

    if (e.no <= 20) {
      await prisma.employeeDocument.create({
        data: {
          employeeId: employee.id,
          type: DocumentType.CONTRACT,
          title: "Employment Contract",
          fileUrl: `/documents/contract-${employee.employeeNo}.pdf`,
          fileName: `contract-${employee.employeeNo}.pdf`,
          mimeType: "application/pdf",
          size: 240_000,
        },
      });
    }

    await prisma.employmentHistory.create({
      data: {
        employeeId: employee.id,
        employmentId: employment.id,
        changeType: "HIRED",
        effectiveDate: d(e.hire),
        newData: { department: e.dept, position: e.pos, basicSalary: e.basic },
        reason: "Initial employment",
      },
    });
  }

  // Department managers
  for (const dept of deptData) {
    const manager = employees.get(dept.managerNo);
    if (manager) {
      await prisma.department.update({
        where: { id: deptIds.get(dept.key)! },
        data: { managerId: manager.id },
      });
    }
  }

  console.log("Seeding user accounts…");
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const userData = [
    { email: "admin@hrsys.local", username: "admin", name: "System Administrator", nameAr: "مدير النظام", role: "SUPER_ADMIN", employeeNo: null },
    { email: "hr@hrsys.local", username: "hr", name: "Sara Al-Sanaani", nameAr: "سارة الصنعاني", role: "HR_ADMIN", employeeNo: 2 },
    { email: "manager@hrsys.local", username: "manager", name: "Omar Al-Hakimi", nameAr: "عمر الحكيمي", role: "MANAGER", employeeNo: 8 },
    { email: "employee@hrsys.local", username: "employee", name: "Yousef Al-Amri", nameAr: "يوسف العمري", role: "EMPLOYEE", employeeNo: 10 },
    { email: "payroll@hrsys.local", username: "payroll", name: "Abdullah Al-Wasabi", nameAr: "عبدالله الوصابي", role: "PAYROLL_OFFICER", employeeNo: 7 },
    { email: "recruiter@hrsys.local", username: "recruiter", name: "Noura Al-Ahdal", nameAr: "نورة الأهدل", role: "RECRUITER", employeeNo: 4 },
  ];

  const userIds = new Map<string, string>();
  for (const u of userData) {
    const user = await prisma.user.create({
      data: {
        email: u.email,
        username: u.username,
        name: u.name,
        nameAr: u.nameAr,
        passwordHash: u.username === "admin" ? adminPasswordHash : passwordHash,
        employeeId: u.employeeNo ? employees.get(u.employeeNo)!.id : null,
        roles: { create: { roleId: roleIds.get(u.role)! } },
      },
    });
    userIds.set(u.username, user.id);
  }

  const adminId = userIds.get("admin")!;
  const hrId = userIds.get("hr")!;
  const managerId = userIds.get("manager")!;
  const employeeUserId = userIds.get("employee")!;
  const payrollUserId = userIds.get("payroll")!;
  const recruiterId = userIds.get("recruiter")!;

  console.log("Seeding leave balances and requests…");
  const leaveRequestData: Array<{
    no: number;
    type: string;
    start: string;
    end: string;
    days: number;
    status: LeaveStatus;
    reason: string;
    managerReview?: boolean;
    hrReview?: boolean;
  }> = [
    { no: 11, type: "ANNUAL", start: "2026-11-02", end: "2026-11-04", days: 3, status: LeaveStatus.APPROVED, reason: "Family trip", managerReview: true, hrReview: true },
    { no: 16, type: "ANNUAL", start: "2026-11-03", end: "2026-11-05", days: 3, status: LeaveStatus.APPROVED, reason: "Personal matters", managerReview: true, hrReview: true },
    { no: 10, type: "ANNUAL", start: "2026-11-10", end: "2026-11-12", days: 3, status: LeaveStatus.PENDING_MANAGER, reason: "Short vacation" },
    { no: 21, type: "ANNUAL", start: "2026-11-15", end: "2026-11-16", days: 2, status: LeaveStatus.PENDING_MANAGER, reason: "Family event" },
    { no: 13, type: "ANNUAL", start: "2026-11-08", end: "2026-11-12", days: 5, status: LeaveStatus.PENDING_HR, reason: "Travel abroad", managerReview: true },
    { no: 10, type: "ANNUAL", start: "2026-08-10", end: "2026-08-14", days: 5, status: LeaveStatus.APPROVED, reason: "Summer vacation", managerReview: true, hrReview: true },
    { no: 14, type: "ANNUAL", start: "2026-10-01", end: "2026-10-03", days: 3, status: LeaveStatus.REJECTED, reason: "Personal trip", managerReview: true },
    { no: 22, type: "SICK", start: "2026-09-20", end: "2026-09-21", days: 2, status: LeaveStatus.APPROVED, reason: "Medical leave", managerReview: true, hrReview: true },
    { no: 3, type: "ANNUAL", start: "2026-07-01", end: "2026-07-10", days: 8, status: LeaveStatus.APPROVED, reason: "Annual vacation", managerReview: true, hrReview: true },
    { no: 18, type: "EMERGENCY", start: "2026-06-15", end: "2026-06-15", days: 1, status: LeaveStatus.APPROVED, reason: "Family emergency", managerReview: true, hrReview: true },
    { no: 26, type: "MATERNITY", start: "2026-12-01", end: "2027-02-08", days: 70, status: LeaveStatus.PENDING_HR, reason: "Maternity leave", managerReview: true },
    { no: 14, type: "UNPAID", start: "2026-11-20", end: "2026-11-25", days: 6, status: LeaveStatus.PENDING_MANAGER, reason: "Extended personal leave" },
    { no: 15, type: "ANNUAL", start: "2026-11-23", end: "2026-11-26", days: 4, status: LeaveStatus.PENDING_HR, reason: "Family visit", managerReview: true },
    { no: 2, type: "SICK", start: "2026-10-20", end: "2026-10-20", days: 1, status: LeaveStatus.APPROVED, reason: "Medical appointment", managerReview: true, hrReview: true },
  ];

  let lrSeq = 1;
  for (const lr of leaveRequestData) {
    const emp = employees.get(lr.no)!;
    const manager = EMPLOYEES.find((e) => e.no === lr.no)?.managerNo;
    await prisma.leaveRequest.create({
      data: {
        requestNo: `LR-2026-${String(lrSeq++).padStart(4, "0")}`,
        employeeId: emp.id,
        leaveTypeId: leaveTypeIds.get(lr.type)!,
        startDate: d(lr.start),
        endDate: d(lr.end),
        days: lr.days,
        reason: lr.reason,
        status: lr.status,
        managerId: manager ? employees.get(manager)?.id : null,
        managerReviewedAt: lr.managerReview ? at("2026-10-25", "10:00") : null,
        managerComment: lr.managerReview ? "Approved. Please hand over tasks." : null,
        hrReviewedAt: lr.hrReview ? at("2026-10-25", "12:00") : null,
        hrComment: lr.hrReview ? "HR reviewed and approved." : null,
        approvedById: lr.status === LeaveStatus.APPROVED ? hrId : null,
        approvedAt: lr.status === LeaveStatus.APPROVED ? at("2026-10-25", "12:00") : null,
      },
    });
  }

  for (const e of EMPLOYEES) {
    if (e.status === EmploymentStatus.RESIGNED || e.status === EmploymentStatus.TERMINATED) continue;
    const emp = employees.get(e.no)!;
    for (const [code, , , maxDays] of leaveTypesData) {
      if (!maxDays) continue;
      const used = leaveRequestData
        .filter((r) => r.no === e.no && r.type === code && r.status === LeaveStatus.APPROVED)
        .reduce((sum, r) => sum + r.days, 0);
      const pending = leaveRequestData
        .filter((r) => r.no === e.no && r.type === code && ([LeaveStatus.PENDING_MANAGER, LeaveStatus.PENDING_HR] as LeaveStatus[]).includes(r.status))
        .reduce((sum, r) => sum + r.days, 0);
      await prisma.leaveBalance.create({
        data: {
          employeeId: emp.id,
          leaveTypeId: leaveTypeIds.get(code)!,
          year: 2026,
          entitledDays: maxDays,
          usedDays: used,
          pendingDays: pending,
          carriedDays: code === "ANNUAL" ? 5 : 0,
        },
      });
    }
  }

  console.log("Seeding attendance…");
  const workdayDates: string[] = [];
  const cursor = new Date(`${TODAY}T00:00:00.000Z`);
  while (workdayDates.length < 32) {
    const day = cursor.getUTCDay();
    if (day >= 0 && day <= 4) {
      workdayDates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  workdayDates.reverse();

  const onLeaveToday = new Set([11, 16]);
  const attendanceRows: Array<{
    employeeId: string;
    date: Date;
    scheduleId: string;
    status: AttendanceStatus;
    checkIn: Date | null;
    checkOut: Date | null;
    workedMinutes: number;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
    source: string;
  }> = [];

  for (const e of EMPLOYEES) {
    if (e.status === EmploymentStatus.RESIGNED || e.status === EmploymentStatus.TERMINATED) continue;
    const emp = employees.get(e.no)!;
    const rand = seededRandom(e.no * 97);
    for (const day of workdayDates) {
      if (day < e.hire) continue;
      if (e.termination && day > e.termination) continue;
      if (e.no === 10 && day === TODAY) continue;
      if (onLeaveToday.has(e.no) && day === TODAY) {
        attendanceRows.push({
          employeeId: emp.id,
          date: d(day),
          scheduleId: standardSchedule.id,
          status: AttendanceStatus.ON_LEAVE,
          checkIn: null,
          checkOut: null,
          workedMinutes: 0,
          lateMinutes: 0,
          earlyLeaveMinutes: 0,
          overtimeMinutes: 0,
          source: "SYSTEM",
        });
        continue;
      }
      const roll = rand();
      let status: AttendanceStatus = AttendanceStatus.PRESENT;
      let lateMinutes = 0;
      if (roll < 0.04) status = AttendanceStatus.ABSENT;
      else if (roll < 0.14) {
        status = AttendanceStatus.LATE;
        lateMinutes = 5 + Math.floor(rand() * 35);
      }

      if (status === AttendanceStatus.ABSENT) {
        attendanceRows.push({
          employeeId: emp.id,
          date: d(day),
          scheduleId: standardSchedule.id,
          status,
          checkIn: null,
          checkOut: null,
          workedMinutes: 0,
          lateMinutes: 0,
          earlyLeaveMinutes: 0,
          overtimeMinutes: 0,
          source: "SYSTEM",
        });
        continue;
      }

      const inMinutes = 8 * 60 + lateMinutes;
      const overtimeMinutes = rand() < 0.18 ? 15 + Math.floor(rand() * 75) : 0;
      const outMinutes = 17 * 60 + overtimeMinutes;
      const checkIn = new Date(`${day}T00:00:00.000Z`);
      checkIn.setUTCMinutes(inMinutes - 180);
      const checkOut = new Date(`${day}T00:00:00.000Z`);
      checkOut.setUTCMinutes(outMinutes - 180);
      attendanceRows.push({
        employeeId: emp.id,
        date: d(day),
        scheduleId: standardSchedule.id,
        status,
        checkIn,
        checkOut,
        workedMinutes: outMinutes - inMinutes,
        lateMinutes,
        earlyLeaveMinutes: 0,
        overtimeMinutes,
        source: "DEVICE",
      });
    }
  }

  await prisma.attendance.createMany({ data: attendanceRows });

  await prisma.attendanceCorrection.createMany({
    data: [
      {
        employeeId: employees.get(10)!.id,
        date: d("2026-10-28"),
        requestedCheckIn: at("2026-10-28", "08:00"),
        requestedCheckOut: at("2026-10-28", "17:30"),
        reason: "Device did not register my check-in.",
        status: CorrectionStatus.PENDING,
      },
      {
        employeeId: employees.get(21)!.id,
        date: d("2026-10-27"),
        requestedCheckIn: at("2026-10-27", "08:05"),
        requestedCheckOut: at("2026-10-27", "17:00"),
        reason: "Was on client site and forgot to check in.",
        status: CorrectionStatus.PENDING,
      },
      {
        employeeId: employees.get(13)!.id,
        date: d("2026-10-20"),
        requestedCheckIn: at("2026-10-20", "08:00"),
        reason: "Badge reader error.",
        status: CorrectionStatus.APPROVED,
        reviewedById: hrId,
        reviewedAt: at("2026-10-21", "09:00"),
        reviewComment: "Verified with security.",
      },
    ],
  });

  console.log("Seeding loans, payroll and payslips…");
  const loan = await prisma.employeeLoan.create({
    data: {
      loanNo: "LN-2026-0001",
      employeeId: employees.get(10)!.id,
      amount: 500000,
      balance: 400000,
      installments: 5,
      installmentAmount: 100000,
      startDate: d("2026-10-01"),
      status: LoanStatus.ACTIVE,
      reason: "Home furniture",
      approvedById: payrollUserId,
      approvedAt: at("2026-09-28", "11:00"),
    },
  });
  await prisma.loanInstallment.createMany({
    data: [
      { loanId: loan.id, dueDate: d("2026-10-31"), amount: 100000, paidAmount: 100000, status: InstallmentStatus.PAID, paidAt: at("2026-10-28", "10:00") },
      { loanId: loan.id, dueDate: d("2026-11-30"), amount: 100000, status: InstallmentStatus.PENDING },
      { loanId: loan.id, dueDate: d("2026-12-31"), amount: 100000, status: InstallmentStatus.PENDING },
      { loanId: loan.id, dueDate: d("2027-01-31"), amount: 100000, status: InstallmentStatus.PENDING },
      { loanId: loan.id, dueDate: d("2027-02-28"), amount: 100000, status: InstallmentStatus.PENDING },
    ],
  });
  await prisma.salaryAdvance.create({
    data: {
      employeeId: employees.get(13)!.id,
      amount: 150000,
      reason: "Emergency travel",
      requestDate: d("2026-10-25"),
      status: RequestStatus.PENDING,
    },
  });

  const october = await prisma.payrollPeriod.create({
    data: {
      companyId: company.id,
      name: "October 2026",
      year: 2026,
      month: 10,
      startDate: d("2026-10-01"),
      endDate: d("2026-10-31"),
      payDate: d("2026-10-28"),
      status: PayrollPeriodStatus.CLOSED,
    },
  });
  const november = await prisma.payrollPeriod.create({
    data: {
      companyId: company.id,
      name: "November 2026",
      year: 2026,
      month: 11,
      startDate: d("2026-11-01"),
      endDate: d("2026-11-30"),
      payDate: d("2026-11-28"),
      status: PayrollPeriodStatus.OPEN,
    },
  });

  const absenceDaysByEmployee = new Map<string, number>();
  for (const row of attendanceRows) {
    if (row.status === AttendanceStatus.ABSENT) {
      absenceDaysByEmployee.set(row.employeeId, (absenceDaysByEmployee.get(row.employeeId) ?? 0) + 1);
    }
  }

  async function createPayrollRun(
    periodId: string,
    runNo: string,
    status: PayrollRunStatus,
  ) {
    const run = await prisma.payrollRun.create({
      data: { periodId, runNo, status },
    });
    let totalGross = 0;
    let totalDeductions = 0;
    const items: Array<{
      runId: string;
      employeeId: string;
      basicSalary: number;
      grossSalary: number;
      totalDeductions: number;
      netSalary: number;
      currency: string;
      breakdown: object;
    }> = [];

    for (const e of EMPLOYEES) {
      if (e.status === EmploymentStatus.RESIGNED || e.status === EmploymentStatus.TERMINATED) continue;
      const emp = employees.get(e.no)!;
      const housing = round2(e.basic * 0.25);
      const transport = round2(e.basic * 0.1);
      const mobile = round2(e.basic * 0.05);
      const commission = e.dept === "SALES" ? round2(e.basic * 0.02) : 0;
      const gross = round2(e.basic + housing + transport + mobile + commission);
      const socialInsurance = round2(gross * 0.06);
      const absence = round2((absenceDaysByEmployee.get(emp.id) ?? 0) * (e.basic / 30));
      const loanDeduction = e.no === 10 ? 100000 : 0;
      const deductions = round2(socialInsurance + absence + loanDeduction);
      const net = round2(gross - deductions);

      totalGross += gross;
      totalDeductions += deductions;
      items.push({
        runId: run.id,
        employeeId: emp.id,
        basicSalary: e.basic,
        grossSalary: gross,
        totalDeductions: deductions,
        netSalary: net,
        currency: "YER",
        breakdown: {
          earnings: [
            { code: "BASIC", name: "Basic Salary", nameAr: "الراتب الأساسي", amount: e.basic },
            { code: "HOUSING", name: "Housing Allowance", nameAr: "بدل السكن", amount: housing },
            { code: "TRANSPORT", name: "Transport Allowance", nameAr: "بدل النقل", amount: transport },
            { code: "MOBILE", name: "Mobile Allowance", nameAr: "بدل الهاتف", amount: mobile },
            ...(commission ? [{ code: "COMMISSION", name: "Sales Commission", nameAr: "عمولة المبيعات", amount: commission }] : []),
          ],
          deductions: [
            { code: "SOCIAL_INSURANCE", name: "Social Insurance", nameAr: "التأمينات الاجتماعية", amount: socialInsurance },
            ...(absence ? [{ code: "ABSENCE", name: "Absence Deduction", nameAr: "خصم الغياب", amount: absence }] : []),
            ...(loanDeduction ? [{ code: "LOAN", name: "Loan Repayment", nameAr: "قسط السلفة", amount: loanDeduction }] : []),
          ],
        },
      });
    }

    await prisma.payrollItem.createMany({ data: items });
    await prisma.payrollRun.update({
      where: { id: run.id },
      data: {
        totalGross: round2(totalGross),
        totalDeductions: round2(totalDeductions),
        totalNet: round2(totalGross - totalDeductions),
        employeeCount: items.length,
        calculatedAt: at("2026-10-26", "09:00"),
        approvedAt: status === PayrollRunStatus.FINALIZED ? at("2026-10-27", "14:00") : null,
        approvedById: status === PayrollRunStatus.FINALIZED ? payrollUserId : null,
        finalizedAt: status === PayrollRunStatus.FINALIZED ? at("2026-10-28", "09:00") : null,
      },
    });
    return run;
  }

  await createPayrollRun(october.id, "PR-2026-10", PayrollRunStatus.FINALIZED);
  await createPayrollRun(november.id, "PR-2026-11", PayrollRunStatus.CALCULATED);

  console.log("Seeding recruitment…");
  const vacancy1 = await prisma.jobVacancy.create({
    data: {
      companyId: company.id,
      departmentId: deptIds.get("DEV")!,
      positionId: positionIds.get("DEV:ENG")!,
      title: "Senior Software Engineer",
      titleAr: "مهندس برمجيات أول",
      description: "Design and build resilient web platforms for our HR products.",
      requirements: "5+ years with TypeScript, React and PostgreSQL. Experience with Next.js preferred.",
      salaryMin: 900000,
      salaryMax: 1300000,
      openings: 2,
      status: VacancyStatus.OPEN,
      postedAt: at("2026-10-01", "09:00"),
      closingDate: d("2026-11-30"),
      createdById: recruiterId,
    },
  });
  const vacancy2 = await prisma.jobVacancy.create({
    data: {
      companyId: company.id,
      departmentId: deptIds.get("SALES")!,
      positionId: positionIds.get("SALES:EXE")!,
      title: "Sales Executive",
      titleAr: "تنفيذي مبيعات",
      description: "Own the full sales cycle for mid-market clients in the western region.",
      requirements: "3+ years B2B SaaS sales, strong Arabic and English communication.",
      salaryMin: 450000,
      salaryMax: 700000,
      openings: 3,
      status: VacancyStatus.OPEN,
      postedAt: at("2026-10-10", "09:00"),
      closingDate: d("2026-12-15"),
      createdById: recruiterId,
    },
  });
  const vacancy3 = await prisma.jobVacancy.create({
    data: {
      companyId: company.id,
      departmentId: deptIds.get("HR")!,
      positionId: positionIds.get("HR:OFF")!,
      title: "HR Officer",
      titleAr: "أخصائي موارد بشرية",
      description: "Support employee lifecycle operations and HR service delivery.",
      requirements: "2+ years HR operations experience, HRIS familiarity.",
      salaryMin: 500000,
      salaryMax: 700000,
      openings: 1,
      status: VacancyStatus.ON_HOLD,
      postedAt: at("2026-09-15", "09:00"),
      closingDate: d("2026-11-15"),
      createdById: recruiterId,
    },
  });
  const vacancy4 = await prisma.jobVacancy.create({
    data: {
      companyId: company.id,
      departmentId: deptIds.get("FIN")!,
      positionId: positionIds.get("FIN:ACC")!,
      title: "Accountant",
      titleAr: "محاسب",
      description: "Manage AP/AR, reconciliations and monthly close.",
      requirements: "Accounting degree, 3 years experience, ERP knowledge.",
      salaryMin: 450000,
      salaryMax: 650000,
      openings: 1,
      status: VacancyStatus.FILLED,
      postedAt: at("2026-07-01", "09:00"),
      closingDate: d("2026-08-15"),
      createdById: recruiterId,
    },
  });
  await prisma.jobVacancy.create({
    data: {
      companyId: company.id,
      departmentId: deptIds.get("MKT")!,
      positionId: positionIds.get("MKT:SPEC")!,
      title: "Marketing Specialist",
      titleAr: "أخصائي تسويق",
      description: "Plan campaigns and own social channels.",
      requirements: "2 years digital marketing experience.",
      salaryMin: 400000,
      salaryMax: 600000,
      openings: 1,
      status: VacancyStatus.DRAFT,
      createdById: recruiterId,
    },
  });

  const candidateData = [
    ["Omar", "Khaled", "omar.khaled@example.com", 7, "BSc Computer Science", ["TypeScript", "React", "PostgreSQL"], "LinkedIn"],
    ["Sara", "Nabil", "sara.nabil@example.com", 5, "BSc Software Engineering", ["Node.js", "AWS", "Docker"], "Referral"],
    ["Yousef", "Tariq", "yousef.tariq@example.com", 6, "MSc Computer Science", ["Next.js", "GraphQL", "Testing"], "Website"],
    ["Nada", "Fahad", "nada.fahad@example.com", 4, "BBA Marketing", ["B2B Sales", "CRM", "Negotiation"], "LinkedIn"],
    ["Khalid", "Sami", "khalid.sami@example.com", 3, "BBA Business", ["Sales", "Arabic", "English"], "Agency"],
    ["Mona", "Ali", "mona.ali@example.com", 2, "BA Communications", ["Sales", "Customer Success"], "Website"],
    ["Hassan", "Omar", "hassan.omar@example.com", 3, "BSc HRM", ["HR Operations", "Recruiting"], "Referral"],
    ["Abeer", "Saleh", "abeer.saleh@example.com", 6, "BSc Accounting", ["IFRS", "Excel", "SAP"], "LinkedIn"],
    ["Rami", "Nasser", "rami.nasser@example.com", 2, "BSc Marketing", ["Content", "SEO", "Analytics"], "Website"],
    ["Layan", "Saad", "layan.saad@example.com", 4, "BSc Information Systems", ["SQL", "Power BI", "Excel"], "LinkedIn"],
  ] as const;

  const candidateIds: string[] = [];
  for (const [first, last, email, exp, education, skills, source] of candidateData) {
    const c = await prisma.candidate.create({
      data: {
        firstName: first,
        lastName: last,
        email,
        phone: `+9677${String(30000000 + candidateIds.length * 1234).slice(0, 8)}`,
        experienceYears: exp,
        education,
        skills: [...skills],
        source,
        cvUrl: `/cvs/${first.toLowerCase()}-${last.toLowerCase()}.pdf`,
      },
    });
    candidateIds.push(c.id);
  }

  const app1 = await prisma.candidateApplication.create({
    data: { vacancyId: vacancy1.id, candidateId: candidateIds[0], stage: ApplicationStage.INTERVIEW, rating: 4, notes: "Strong technical background." },
  });
  await prisma.candidateApplication.create({
    data: { vacancyId: vacancy1.id, candidateId: candidateIds[1], stage: ApplicationStage.SCREENING, rating: 3 },
  });
  await prisma.candidateApplication.create({
    data: { vacancyId: vacancy1.id, candidateId: candidateIds[2], stage: ApplicationStage.EVALUATION, rating: 4 },
  });
  const app4 = await prisma.candidateApplication.create({
    data: { vacancyId: vacancy2.id, candidateId: candidateIds[3], stage: ApplicationStage.OFFER, rating: 5, notes: "Excellent sales track record." },
  });
  await prisma.candidateApplication.create({
    data: { vacancyId: vacancy2.id, candidateId: candidateIds[4], stage: ApplicationStage.APPLIED },
  });
  await prisma.candidateApplication.create({
    data: { vacancyId: vacancy2.id, candidateId: candidateIds[5], stage: ApplicationStage.REJECTED, status: ApplicationStatus.REJECTED, rejectionReason: "Not enough B2B experience." },
  });
  await prisma.candidateApplication.create({
    data: { vacancyId: vacancy3.id, candidateId: candidateIds[6], stage: ApplicationStage.SCREENING, rating: 3 },
  });
  await prisma.candidateApplication.create({
    data: { vacancyId: vacancy4.id, candidateId: candidateIds[7], stage: ApplicationStage.HIRED, status: ApplicationStatus.HIRED, rating: 5 },
  });
  await prisma.candidateApplication.create({
    data: { vacancyId: vacancy1.id, candidateId: candidateIds[9], stage: ApplicationStage.APPLIED },
  });

  await prisma.interview.create({
    data: {
      applicationId: app1.id,
      round: 1,
      scheduledAt: at("2026-10-29", "11:00"),
      durationMinutes: 60,
      type: "VIDEO",
      interviewerId: managerId,
      meetingUrl: "https://meet.example.com/hrsys-interview",
      feedback: "Strong React and database fundamentals. Recommend a system design round.",
      rating: 4,
      status: InterviewStatus.COMPLETED,
    },
  });
  await prisma.interview.create({
    data: {
      applicationId: app4.id,
      round: 2,
      scheduledAt: at("2026-11-05", "14:00"),
      durationMinutes: 45,
      type: "ONSITE",
      interviewerId: recruiterId,
      location: "Aden Office — Room 2",
      status: InterviewStatus.SCHEDULED,
    },
  });
  await prisma.jobOffer.create({
    data: {
      applicationId: app4.id,
      salary: 625000,
      startDate: d("2026-12-01"),
      status: OfferStatus.SENT,
      expiresAt: d("2026-11-15"),
      createdById: recruiterId,
    },
  });

  console.log("Seeding onboarding and offboarding…");
  const onboardingTasks = [
    ["Sign employment contract", "توقيع عقد العمل", "CONTRACT"],
    ["Submit ID, passport and certificates", "تقديم الهوية وجواز السفر والشهادات", "DOCUMENTS"],
    ["Create email and system accounts", "إنشاء البريد الإلكتروني وحسابات النظام", "ACCOUNT"],
    ["Prepare laptop and equipment", "تجهيز الحاسوب والمعدات", "EQUIPMENT"],
    ["Company orientation session", "جلسة تعريف بالشركة", "ORIENTATION"],
    ["Assign mandatory training", "تعيين التدريب الإلزامي", "TRAINING"],
    ["Confirm reporting manager", "تأكيد المدير المسؤول", "MANAGER"],
  ] as const;

  const onboardingPlan: Array<[number, number, LifecycleStatus]> = [
    [43, 7, LifecycleStatus.COMPLETED],
    [44, 4, LifecycleStatus.IN_PROGRESS],
    [45, 3, LifecycleStatus.IN_PROGRESS],
    [46, 0, LifecycleStatus.NOT_STARTED],
    [47, 0, LifecycleStatus.NOT_STARTED],
    [48, 2, LifecycleStatus.IN_PROGRESS],
  ];
  for (const [no, done, status] of onboardingPlan) {
    const emp = employees.get(no)!;
    const plan = await prisma.onboarding.create({
      data: {
        employeeId: emp.id,
        startDate: d(EMPLOYEES.find((e) => e.no === no)!.hire),
        status,
        progress: Math.round((done / onboardingTasks.length) * 100),
        completedAt: status === LifecycleStatus.COMPLETED ? at("2026-09-01", "16:00") : null,
        templateName: "Standard Onboarding",
      },
    });
    await prisma.onboardingTask.createMany({
      data: onboardingTasks.map(([title, titleAr, category], index) => ({
        onboardingId: plan.id,
        title,
        titleAr,
        category,
        isRequired: true,
        sortOrder: index,
        dueDate: d("2026-11-10"),
        completedAt: index < done ? at("2026-10-20", "10:00") : null,
        assigneeId: index < 2 ? hrId : managerId,
      })),
    });
  }

  const offboardingTasks = [
    ["Conduct exit interview", "EXIT_INTERVIEW"],
    ["Return laptop and access card", "ASSET_RETURN"],
    ["Deactivate system accounts", "ACCOUNT"],
    ["Process final payroll", "PAYROLL"],
    ["Clear outstanding loans", "LOANS"],
    ["Archive employee documents", "DOCUMENTS"],
  ] as const;

  for (const [no, type, lastDay, done, status] of [
    [49, OffboardingType.RESIGNATION, "2026-10-15", 5, LifecycleStatus.IN_PROGRESS],
    [50, OffboardingType.TERMINATION, "2026-09-30", 6, LifecycleStatus.COMPLETED],
  ] as const) {
    const emp = employees.get(no)!;
    const off = await prisma.offboarding.create({
      data: {
        employeeId: emp.id,
        type,
        requestDate: d("2026-09-01"),
        lastWorkingDate: d(lastDay),
        reason: type === OffboardingType.RESIGNATION ? "Better opportunity" : "Performance-related termination",
        status,
        progress: Math.round((done / offboardingTasks.length) * 100),
        completedAt: status === LifecycleStatus.COMPLETED ? d(lastDay) : null,
      },
    });
    await prisma.offboardingTask.createMany({
      data: offboardingTasks.map(([title, category], index) => ({
        offboardingId: off.id,
        title,
        category,
        isRequired: true,
        dueDate: d(lastDay),
        completedAt: index < done ? d(lastDay) : null,
        assigneeId: hrId,
      })),
    });
  }

  console.log("Seeding performance and training…");
  const cycle = await prisma.performanceCycle.create({
    data: {
      companyId: company.id,
      name: "2026 Annual Performance",
      description: "Annual goals, competencies and development review.",
      startDate: d("2026-01-01"),
      endDate: d("2026-12-31"),
      status: LifecycleStatus.IN_PROGRESS,
      createdById: hrId,
    },
  });

  const reviewPairs: Array<[number, number, ReviewStatus, number | null]> = [
    [10, 9, ReviewStatus.COMPLETED, 4.2],
    [11, 8, ReviewStatus.MANAGER_REVIEW, 3.8],
    [13, 12, ReviewStatus.SELF_REVIEW, null],
    [14, 12, ReviewStatus.COMPLETED, 3.5],
    [16, 15, ReviewStatus.MANAGER_REVIEW, 4.0],
    [21, 9, ReviewStatus.SELF_REVIEW, null],
    [22, 8, ReviewStatus.COMPLETED, 4.5],
    [23, 5, ReviewStatus.MANAGER_REVIEW, 3.6],
    [25, 12, ReviewStatus.SELF_REVIEW, null],
  ];

  for (const [empNo, mgrNo, status, finalRating] of reviewPairs) {
    const review = await prisma.performanceReview.create({
      data: {
        cycleId: cycle.id,
        employeeId: employees.get(empNo)!.id,
        managerId: employees.get(mgrNo)!.id,
        selfRating: status === ReviewStatus.SELF_REVIEW ? null : Math.round((finalRating ?? 3.8) * 0.9),
        managerRating: ([ReviewStatus.MANAGER_REVIEW, ReviewStatus.COMPLETED] as ReviewStatus[]).includes(status) ? Math.round(finalRating ?? 3.8) : null,
        finalRating: finalRating,
        selfComment: status === ReviewStatus.SELF_REVIEW ? null : "I delivered my goals and grew across the required competencies.",
        managerComment: status === ReviewStatus.COMPLETED ? "Consistent contributor with strong ownership. Continue developing stakeholder communication." : null,
        status,
        submittedAt: status === ReviewStatus.COMPLETED ? at("2026-10-15", "10:00") : null,
        completedAt: status === ReviewStatus.COMPLETED ? at("2026-10-20", "15:00") : null,
      },
    });
    if (status !== ReviewStatus.SELF_REVIEW) {
      await prisma.performanceRating.createMany({
        data: [
          { reviewId: review.id, competency: "Job Knowledge", rating: 4, comment: "Strong technical depth." },
          { reviewId: review.id, competency: "Quality of Work", rating: 4 },
          { reviewId: review.id, competency: "Collaboration", rating: 3 },
          { reviewId: review.id, competency: "Initiative", rating: 4 },
        ],
      });
    }
  }

  await prisma.goal.createMany({
    data: [
      { employeeId: employees.get(10)!.id, title: "Ship payroll module v1", description: "Deliver payroll calculation and payslip generation.", weight: 30, progress: 80, status: GoalStatus.IN_PROGRESS, dueDate: d("2026-12-15") },
      { employeeId: employees.get(10)!.id, title: "Improve test coverage", description: "Raise critical-path coverage above 80%.", weight: 20, progress: 65, status: GoalStatus.IN_PROGRESS, dueDate: d("2026-12-31") },
      { employeeId: employees.get(13)!.id, title: "Close YER 100M in new business", weight: 40, progress: 55, status: GoalStatus.IN_PROGRESS, dueDate: d("2026-12-31") },
      { employeeId: employees.get(21)!.id, title: "Reduce API latency by 30%", weight: 25, progress: 40, status: GoalStatus.IN_PROGRESS, dueDate: d("2026-12-31") },
    ],
  });

  const courseData = [
    ["LEAD-01", "Leadership Essentials", "أساسيات القيادة", "People & Leadership", "Yemen Management Institute", "Dr. Hala Mansour", 225000, 20, CourseStatus.IN_PROGRESS, "2026-10-15", "2026-11-15"],
    ["TS-01", "Advanced TypeScript", "تايب سكريبت المتقدم", "Engineering", "Udemy Business", "Matt Pocock", 60000, 30, CourseStatus.OPEN, "2026-11-10", "2026-12-10"],
    ["SEC-01", "Data Privacy & Security", "خصوصية البيانات والأمن", "Compliance", "Internal", "Security Team", 0, 100, CourseStatus.OPEN, "2026-11-01", "2026-12-31"],
    ["FA-01", "First Aid at Work", "الإسعافات الأولية في العمل", "Safety", "Red Crescent", "Medic Team", 40000, 15, CourseStatus.COMPLETED, "2026-09-01", "2026-09-02"],
  ] as const;

  const courseIds: string[] = [];
  for (const [code, title, titleAr, category, provider, trainer, cost, capacity, status, start, end] of courseData) {
    const course = await prisma.trainingCourse.create({
      data: {
        companyId: company.id,
        code,
        title,
        titleAr,
        category,
        provider,
        trainer,
        cost,
        capacity,
        status,
        startDate: d(start),
        endDate: d(end),
        description: `${title} delivered by ${provider}.`,
      },
    });
    courseIds.push(course.id);
  }

  await prisma.trainingEnrollment.createMany({
    data: [
      { courseId: courseIds[0], employeeId: employees.get(8)!.id, status: EnrollmentStatus.IN_PROGRESS },
      { courseId: courseIds[0], employeeId: employees.get(9)!.id, status: EnrollmentStatus.IN_PROGRESS },
      { courseId: courseIds[0], employeeId: employees.get(15)!.id, status: EnrollmentStatus.ENROLLED },
      { courseId: courseIds[1], employeeId: employees.get(10)!.id, status: EnrollmentStatus.ENROLLED },
      { courseId: courseIds[1], employeeId: employees.get(21)!.id, status: EnrollmentStatus.IN_PROGRESS },
      { courseId: courseIds[2], employeeId: employees.get(2)!.id, status: EnrollmentStatus.COMPLETED, score: 95, completedAt: at("2026-10-20", "12:00"), certificateUrl: "/certificates/security-sara.pdf" },
      { courseId: courseIds[2], employeeId: employees.get(10)!.id, status: EnrollmentStatus.COMPLETED, score: 92, completedAt: at("2026-10-21", "12:00"), certificateUrl: "/certificates/security-yousef.pdf" },
      { courseId: courseIds[3], employeeId: employees.get(8)!.id, status: EnrollmentStatus.COMPLETED, score: 100, completedAt: at("2026-09-02", "16:00") },
    ],
  });

  const skillData = ["TypeScript", "React", "PostgreSQL", "Leadership", "Salesforce", "Payroll", "Recruiting", "Financial Reporting", "Arabic Communication", "Project Management"];
  const skillIds: string[] = [];
  for (const name of skillData) {
    const skill = await prisma.skill.create({ data: { companyId: company.id, name, nameAr: name } });
    skillIds.push(skill.id);
  }
  await prisma.employeeSkill.createMany({
    data: [
      { employeeId: employees.get(10)!.id, skillId: skillIds[0], level: 4, yearsExperience: 4, certified: true },
      { employeeId: employees.get(10)!.id, skillId: skillIds[1], level: 4, yearsExperience: 4 },
      { employeeId: employees.get(10)!.id, skillId: skillIds[2], level: 3, yearsExperience: 3 },
      { employeeId: employees.get(9)!.id, skillId: skillIds[3], level: 5, yearsExperience: 6 },
      { employeeId: employees.get(13)!.id, skillId: skillIds[4], level: 3, yearsExperience: 3 },
      { employeeId: employees.get(7)!.id, skillId: skillIds[5], level: 5, yearsExperience: 8 },
      { employeeId: employees.get(4)!.id, skillId: skillIds[6], level: 4, yearsExperience: 5 },
      { employeeId: employees.get(5)!.id, skillId: skillIds[7], level: 5, yearsExperience: 10 },
    ],
  });

  console.log("Seeding assets…");
  const assetCategories = [
    ["LAPTOP", "MacBook Pro 14", "Apple", "MacBook Pro", 425000],
    ["LAPTOP", "Dell Latitude 7440", "Dell", "Latitude 7440", 310000],
    ["PHONE", "iPhone 15", "Apple", "iPhone 15", 210000],
    ["MONITOR", "Dell UltraSharp 27", "Dell", "U2723QE", 90000],
    ["EQUIPMENT", "Logitech MX Master 3", "Logitech", "MX Master 3", 22500],
    ["ID_CARD", "Employee Access Card", "YemenTech", "AC-2026", 2500],
  ] as const;

  for (let i = 0; i < 30; i++) {
    const cat = assetCategories[i % assetCategories.length];
    const assignedNo = i < 14 ? EMPLOYEES[i].no : null;
    const emp = assignedNo ? employees.get(assignedNo)! : null;
    const asset = await prisma.asset.create({
      data: {
        companyId: company.id,
        assetTag: `AST-${String(i + 1).padStart(4, "0")}`,
        name: cat[1],
        category: cat[0],
        brand: cat[2],
        model: cat[3],
        serialNumber: `SN-${20260000 + i}`,
        purchaseDate: d("2026-01-15"),
        purchaseCost: cat[4],
        status: emp ? AssetStatus.ASSIGNED : AssetStatus.AVAILABLE,
        condition: AssetCondition.GOOD,
      },
    });
    if (emp) {
      await prisma.assetAssignment.create({
        data: {
          assetId: asset.id,
          employeeId: emp.id,
          assignedAt: at("2026-01-20", "10:00"),
          assignedById: hrId,
        },
      });
    }
  }

  console.log("Seeding requests and approvals…");
  const workflowDefs: Array<{ name: string; type: RequestType; steps: Array<{ role: string; final: boolean }> }> = [
    { name: "Salary Certificate Approval", type: RequestType.SALARY_CERTIFICATE, steps: [{ role: "MANAGER", final: false }, { role: "HR_ADMIN", final: true }] },
    { name: "Expense Approval", type: RequestType.EXPENSE, steps: [{ role: "MANAGER", final: false }, { role: "HR_ADMIN", final: true }] },
    { name: "Document Request Approval", type: RequestType.DOCUMENT, steps: [{ role: "HR_ADMIN", final: true }] },
  ];
  const workflows = new Map<RequestType, string>();
  for (const def of workflowDefs) {
    const workflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        name: def.name,
        entityType: def.type,
        steps: {
          create: def.steps.map((s, index) => ({
            stepOrder: index + 1,
            roleId: roleIds.get(s.role),
            isFinal: s.final,
          })),
        },
      },
    });
    workflows.set(def.type, workflow.id);
  }

  const requestData: Array<{
    no: number;
    type: RequestType;
    subject: string;
    details: string;
    amount?: number;
    status: RequestStatus;
    step: number;
  }> = [
    { no: 10, type: RequestType.SALARY_CERTIFICATE, subject: "Salary certificate for bank", details: "Required for a mortgage application.", status: RequestStatus.PENDING, step: 1 },
    { no: 13, type: RequestType.EXPENSE, subject: "Client visit expenses", details: "Taxi and hospitality for the Aden Port meeting.", amount: 125000, status: RequestStatus.PENDING, step: 1 },
    { no: 11, type: RequestType.DOCUMENT, subject: "Employment certificate", details: "Embassy requirement.", status: RequestStatus.APPROVED, step: 1 },
    { no: 16, type: RequestType.SALARY_CERTIFICATE, subject: "Salary certificate", details: "Visa application.", status: RequestStatus.APPROVED, step: 2 },
    { no: 14, type: RequestType.EXPENSE, subject: "Training materials", details: "Books for certification.", amount: 30000, status: RequestStatus.REJECTED, step: 1 },
    { no: 22, type: RequestType.LOAN, subject: "Personal loan request", details: "Requesting an interest-free salary loan.", amount: 750000, status: RequestStatus.PENDING, step: 1 },
  ];

  let reqSeq = 1;
  for (const r of requestData) {
    const emp = employees.get(r.no)!;
    const workflowType = r.type === RequestType.LOAN ? RequestType.DOCUMENT : r.type;
    const wfId = workflows.get(workflowType);
    const wfSteps = wfId
      ? await prisma.approvalWorkflowStep.findMany({ where: { workflowId: wfId }, orderBy: { stepOrder: "asc" } })
      : [];
    await prisma.employeeRequest.create({
      data: {
        requestNo: `REQ-2026-${String(reqSeq++).padStart(4, "0")}`,
        employeeId: emp.id,
        type: r.type,
        subject: r.subject,
        details: r.details,
        amount: r.amount,
        status: r.status,
        currentStep: r.step,
        createdById: employeeUserId,
        approvalSteps: {
          create:
            wfSteps.length > 0
              ? wfSteps.map((s) => ({
                  stepOrder: s.stepOrder,
                  roleId: s.roleId,
                  approverId: s.stepOrder === 1 ? managerId : hrId,
                  status:
                    r.status === RequestStatus.APPROVED
                      ? ApprovalStatus.APPROVED
                      : r.status === RequestStatus.REJECTED && s.stepOrder === 1
                        ? ApprovalStatus.REJECTED
                        : ApprovalStatus.PENDING,
                  actedAt: r.status === RequestStatus.PENDING ? null : at("2026-10-30", "11:00"),
                }))
              : [
                  {
                    stepOrder: 1,
                    approverId: hrId,
                    status: r.status === RequestStatus.APPROVED ? ApprovalStatus.APPROVED : r.status === RequestStatus.REJECTED ? ApprovalStatus.REJECTED : ApprovalStatus.PENDING,
                  },
                ],
        },
      },
    });
  }

  console.log("Seeding notifications, audit log and settings…");
  await prisma.notification.createMany({
    data: [
      { userId: managerId, type: NotificationType.APPROVAL_REQUIRED, title: "Leave approval required", titleAr: "مطلوب اعتماد إجازة", message: "Yousef Al-Amri requested 3 days of annual leave.", messageAr: "طلب يوسف العمري إجازة سنوية لمدة 3 أيام.", link: "/leave", isRead: false },
      { userId: managerId, type: NotificationType.APPROVAL_REQUIRED, title: "Attendance correction", titleAr: "تصحيح حضور", message: "Yousef Al-Amri submitted an attendance correction.", messageAr: "قدّم يوسف العمري طلب تصحيح حضور.", link: "/attendance", isRead: false },
      { userId: hrId, type: NotificationType.APPROVAL_REQUIRED, title: "HR approval required", titleAr: "مطلوب اعتماد الموارد البشرية", message: "Lama Al-Bakri's leave is awaiting HR review.", messageAr: "إجازة لمى البكري بانتظار مراجعة الموارد البشرية.", link: "/leave", isRead: false },
      { userId: employeeUserId, type: NotificationType.LEAVE_APPROVED, title: "Leave approved", titleAr: "تم اعتماد الإجازة", message: "Your annual leave for 10–12 November was approved.", messageAr: "تم اعتماد إجازتك السنوية من 10 إلى 12 نوفمبر.", link: "/leave", isRead: false },
      { userId: payrollUserId, type: NotificationType.PAYROLL_FINALIZED, title: "October payroll finalized", titleAr: "تم إنهاء رواتب أكتوبر", message: "October 2026 payroll was finalized and payslips are available.", messageAr: "تم إنهاء رواتب أكتوبر 2026 وقسائم الرواتب متاحة.", link: "/payroll", isRead: true },
      { userId: adminId, type: NotificationType.CONTRACT_EXPIRING, title: "Contracts expiring", titleAr: "عقود تنتهي قريبًا", message: "3 employment contracts expire within 60 days.", messageAr: "3 عقود عمل تنتهي خلال 60 يومًا.", link: "/employees", isRead: false },
      { userId: hrId, type: NotificationType.NEW_EMPLOYEE, title: "New employee onboarded", titleAr: "موظف جديد", message: "Abdulrahman Al-Adeni joined Operations on 1 November.", messageAr: "انضم عبدالرحمن العدني إلى العمليات في 1 نوفمبر.", link: "/onboarding", isRead: true },
      { userId: employeeUserId, type: NotificationType.TRAINING, title: "Training enrollment", titleAr: "تسجيل في تدريب", message: "You are enrolled in Advanced TypeScript starting 10 November.", messageAr: "تم تسجيلك في دورة تايب سكريبت المتقدم بدءًا من 10 نوفمبر.", link: "/training", isRead: true },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      { userId: adminId, action: AuditAction.LOGIN, entity: "User", entityId: adminId, ip: "127.0.0.1", userAgent: "Seed", createdAt: at("2026-11-01", "08:00") },
      { userId: hrId, action: AuditAction.CREATE, entity: "Employee", entityId: employees.get(47)!.id, newData: { employeeNo: "EMP-0047", name: "Abdulrahman Al-Adeni" }, ip: "127.0.0.1", createdAt: at("2026-11-01", "09:15") },
      { userId: hrId, action: AuditAction.APPROVE, entity: "LeaveRequest", entityId: "LR-2026-0001", newData: { status: "APPROVED" }, ip: "127.0.0.1", createdAt: at("2026-10-25", "12:00") },
      { userId: payrollUserId, action: AuditAction.FINALIZE, entity: "PayrollRun", entityId: "PR-2026-10", newData: { status: "FINALIZED" }, ip: "127.0.0.1", createdAt: at("2026-10-28", "09:00") },
      { userId: adminId, action: AuditAction.PERMISSION_CHANGE, entity: "Role", entityId: roleIds.get("HR_OFFICER")!, oldData: { permissions: 12 }, newData: { permissions: 22 }, ip: "127.0.0.1", createdAt: at("2026-10-20", "14:30") },
      { userId: hrId, action: AuditAction.UPDATE, entity: "Employee", entityId: employees.get(10)!.id, oldData: { basicSalary: 850000 }, newData: { basicSalary: 900000 }, ip: "127.0.0.1", createdAt: at("2026-10-01", "10:00") },
      { userId: recruiterId, action: AuditAction.CREATE, entity: "JobVacancy", entityId: vacancy1.id, newData: { title: "Senior Software Engineer" }, ip: "127.0.0.1", createdAt: at("2026-10-01", "09:00") },
      { userId: hrId, action: AuditAction.LOGIN, entity: "User", entityId: hrId, ip: "127.0.0.1", userAgent: "Seed", createdAt: at("2026-11-02", "08:05") },
    ],
  });

  await prisma.systemSetting.createMany({
    data: [
      { companyId: company.id, key: "company.profile", description: "Company identity and localization", value: { fiscalYearStart: "01-01", weekStart: "sunday", dateFormat: "dd/MM/yyyy" }, updatedById: adminId },
      { companyId: company.id, key: "payroll.settings", description: "Payroll defaults", value: { currency: "YER", socialInsuranceEmployeeRate: 6, payDay: 28, overtimeRate: 1.5 }, updatedById: payrollUserId },
      { companyId: company.id, key: "attendance.settings", description: "Attendance defaults", value: { graceMinutes: 10, workweek: "sunday-thursday", overtimeEnabled: true }, updatedById: hrId },
    ],
  });

  console.log("\nHRSYS seed complete.");
  console.log(`Admin login: admin / ${ADMIN_PASSWORD}`);
  console.log("Other development accounts (password):", PASSWORD);
  for (const u of userData)
    console.log(
      `  ${u.username.padEnd(10)} ${u.email.padEnd(24)} ${u.role}${
        u.username === "admin" ? "  <- admin/admin" : ""
      }`,
    );
  console.log(`\nEmployees: ${EMPLOYEES.length} | Attendance rows: ${attendanceRows.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
