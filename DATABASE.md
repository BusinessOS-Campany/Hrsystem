# DATABASE

HRSYS uses PostgreSQL with Prisma. The schema is the source of truth: `prisma/schema.prisma`.

## Conventions

- **Primary keys:** CUID strings (`@default(cuid())`).
- **Foreign keys:** explicit relations with deliberate delete behavior.
- **Natural keys:** unique constraints on employee number, email, national ID, codes, request numbers, run numbers.
- **Money:** `Decimal(12, 2)` or `Decimal(14, 2)`; never `Float`.
- **Leave days:** `Decimal(5, 1)`.
- **Date-only fields:** `@db.Date` (hire date, attendance date, leave start/end, period dates).
- **Instants:** normal `DateTime` (login time, approval time, audit time).
- **Soft deletion:** `deletedAt` on employees, departments, positions, assets, users.
- **Timestamps:** `createdAt` and `updatedAt` on mutable business entities.
- **Tenant readiness:** `companyId` on organization, payroll, recruitment, training, assets, settings, and employments.
- **Naming:** Prisma models are PascalCase; database tables use snake_case via `@@map`.

## Model Catalog (62 models)

### Identity and access

| Model | Purpose | Key constraints |
| --- | --- | --- |
| `User` | Login identity | unique email, unique username, optional unique employee link |
| `Role` | Role definition | unique code |
| `Permission` | Permission catalog | unique code |
| `UserRole` | User ↔ role | unique `[userId, roleId]` |
| `RolePermission` | Role ↔ permission | unique `[roleId, permissionId]` |
| `Session` | Active login sessions | token hash, expiry, revocation |
| `PasswordResetToken` | One-use reset links | unique token hash, expiry, used timestamp |

### Organization

| Model | Purpose | Key constraints |
| --- | --- | --- |
| `Company` | Legal/operating company | currency, timezone (Yemen / YER / `Asia/Aden` defaults) |
| `Branch` | Physical or legal branch | unique `[companyId, code]` |
| `Department` | Department hierarchy | unique `[companyId, code]`, self-referencing parent |
| `Position` | Job/position catalog | unique `[departmentId, code]`, salary band |
| `WorkLocation` | Office/site | company/branch link |

### Employee core

| Model | Purpose |
| --- | --- |
| `Employee` | Person record: identity, contact, emergency contact, status, manager |
| `Employment` | Employment contract: company, branch, department, position, type, dates, salary, current flag |
| `EmploymentHistory` | Immutable-ish change log for employment changes |
| `EmployeeContact` | Additional contacts |
| `EmployeeDocument` | Document metadata and storage URL |
| `EmployeeBankAccount` | Bank details for payroll |

### Time and attendance

| Model | Purpose |
| --- | --- |
| `WorkSchedule` | Weekly schedule, workdays, hours, grace |
| `Shift` | Named shift with start/end and grace |
| `Holiday` | Public/company holidays |
| `Attendance` | One row per employee per date; check-in/out, status, late/early/overtime |
| `AttendanceCorrection` | Employee-requested correction with review status |

### Leave

| Model | Purpose |
| --- | --- |
| `LeaveType` | Annual, sick, unpaid, etc.; paid flag, max days, HR approval flag |
| `LeaveBalance` | Per employee, type, year: entitled, used, pending, carried |
| `LeaveRequest` | Request with dates, working days, reason, manager/HR review fields |

### Payroll

| Model | Purpose |
| --- | --- |
| `PayrollPeriod` | Month/year period and pay date |
| `SalaryComponent` | Configurable earning/deduction component, fixed or percentage |
| `EmployeeSalary` | Employee-specific component amount and effective dates |
| `PayrollRun` | Run for a period: status, totals, approver, finalization |
| `PayrollItem` | Per-employee payslip with basic, gross, deductions, net, JSON breakdown |
| `Deduction` | Standalone deduction record |
| `Bonus` | Bonus record |
| `EmployeeLoan` | Loan principal, installments, status |
| `LoanInstallment` | Installment schedule |
| `SalaryAdvance` | Salary advance request and status |

Loan lifecycle: `PENDING → ACTIVE → COMPLETED`, with `REJECTED` and `CANCELLED` terminal states. Approval creates one `LoanInstallment` per month. Each payment stores the paid amount and timestamp, reduces `EmployeeLoan.balance`, and completes the loan when the balance reaches zero.

### Recruitment

| Model | Purpose |
| --- | --- |
| `JobVacancy` | Vacancy with department, position, openings, salary range, status |
| `Candidate` | Candidate identity and source |
| `CandidateApplication` | Candidate ↔ vacancy with stage, rating, status |
| `Interview` | Scheduled interview, interviewer, feedback, rating |
| `JobOffer` | Offer salary, start date, status, expiry |

### Lifecycle

| Model | Purpose |
| --- | --- |
| `Onboarding` | One plan per employee, progress, status |
| `OnboardingTask` | Checklist item with category, due date, assignee |
| `Offboarding` | Exit case with type, last working date, progress |
| `OffboardingTask` | Exit checklist item |

### Performance and learning

| Model | Purpose |
| --- | --- |
| `PerformanceCycle` | Review cycle with dates and status |
| `PerformanceReview` | Employee review with self/manager ratings and final rating |
| `Goal` | Goal with weight, progress, due date |
| `PerformanceRating` | Rating scale metadata |
| `TrainingCourse` | Course catalog with provider, dates, cost, capacity |
| `TrainingEnrollment` | Employee enrollment, status, score |
| `Skill` | Skill catalog |
| `EmployeeSkill` | Employee skill level and years |

### Assets, requests, notifications, audit, settings

| Model | Purpose |
| --- | --- |
| `Asset` | Asset register with tag, category, serial, cost, status, condition |
| `AssetAssignment` | Assignment/return history |
| `EmployeeRequest` | HR/service request with type, subject, amount, current step |
| `ApprovalWorkflow` | Reusable workflow definition |
| `ApprovalWorkflowStep` | Ordered approver step in a workflow |
| `ApprovalStep` | Persisted step for a specific request |
| `Notification` | User notification with read state and optional link |
| `AuditLog` | Actor, action, entity, old/new data, IP, user agent |
| `SystemSetting` | Key/value JSON setting |

## Enums

The schema defines enums for stable business states:

- Gender, marital status
- Employment type and status
- Contact type, document type
- Attendance status, correction status
- Leave status
- Payroll period status, payroll run status
- Salary component type, calculation type
- Loan status, installment status
- Vacancy status, application stage, application status
- Interview status, offer status
- Lifecycle status, offboarding type
- Review status, goal status
- Course status, enrollment status
- Asset status, asset condition
- Request type, request status, approval status
- Notification type, audit action

Using enums prevents invalid states such as an unknown leave status or a payroll run in an undefined state.

## Important Relationships

```text
Company
  ├─ Branch
  ├─ Department (self-referencing hierarchy)
  │    └─ Position
  ├─ WorkLocation
  ├─ WorkSchedule
  ├─ Holiday
  ├─ LeaveType
  ├─ SalaryComponent
  ├─ PayrollPeriod → PayrollRun → PayrollItem
  ├─ JobVacancy → CandidateApplication → Interview / JobOffer
  ├─ TrainingCourse → TrainingEnrollment
  └─ Asset → AssetAssignment

Employee
  ├─ User (optional one-to-one)
  ├─ Employment (current + history)
  ├─ EmployeeContact / Document / BankAccount
  ├─ Attendance / AttendanceCorrection
  ├─ LeaveBalance / LeaveRequest
  ├─ EmployeeSalary / PayrollItem / Deduction / Bonus
  ├─ EmployeeLoan → LoanInstallment
  ├─ Onboarding / Offboarding
  ├─ PerformanceReview / Goal
  ├─ TrainingEnrollment / EmployeeSkill
  ├─ AssetAssignment
  └─ EmployeeRequest → ApprovalStep

User
  ├─ UserRole → Role → RolePermission → Permission
  ├─ Session
  ├─ PasswordResetToken
  ├─ Notification
  └─ AuditLog
```

## Delete Behavior

| Relation | Behavior | Why |
| --- | --- | --- |
| User → Session | Cascade | sessions are owned by the user |
| Employee → Employment | Cascade | employment cannot outlive employee |
| Employee → Attendance | Cascade | attendance belongs to employee |
| Employee → LeaveBalance/Request | Cascade | records belong to employee |
| Department → Position | Restrict | prevent orphaning positions |
| Position → Employment | Restrict | prevent deleting a position in use |
| Company → Department | Cascade | company owns organization |
| Role → UserRole | Cascade | join row is meaningless without role |
| Employee manager | SetNull | manager departure must not delete reports |
| Department manager | SetNull | keep department if manager leaves |
| Asset assignment → asset | Cascade | assignment history belongs to asset |

## Indexing Strategy

Indexes exist for high-frequency filters and joins:

- `employees(status)`, `employees(managerId)`, `employees(deletedAt)`
- `employments(employeeId, isCurrent)`, `employments(departmentId)`, `employments(status)`
- `attendance(employeeId, date)` and `attendance(date, status)`
- `leave_requests(employeeId, status)`, `leave_requests(startDate, endDate)`
- `payroll_runs(periodId, status)`
- `candidate_applications(vacancyId, stage)`
- `notifications(userId, isRead)`
- `audit_logs(createdAt)`, `audit_logs(entity, entityId)`
- soft-deletion fields on soft-deletable tables

Add indexes only with a query in mind. Every index costs write throughput and storage.

## Migration Workflow

```bash
# after editing schema.prisma
npx prisma format
npx prisma migrate dev --name describe_change
npx prisma generate
```

Production:

```bash
npx prisma migrate deploy
```

Never edit an applied migration. Add a new one.

## Query Patterns

### Permission-scoped employee visibility

```ts
const canViewAll = hasPermission(user, "employee.view_all");
const reports = user.employeeId
  ? await prisma.employee.findMany({
      where: { managerId: user.employeeId, deletedAt: null },
      select: { id: true },
    })
  : [];
const visibleIds = canViewAll ? undefined : [user.employeeId, ...reports.map(r => r.id)];
```

### Real dashboard aggregates

```ts
const [headcount, present, pendingLeave, payroll] = await Promise.all([
  prisma.employee.count({ where: { status: "ACTIVE", deletedAt: null } }),
  prisma.attendance.count({ where: { date: today, status: "PRESENT" } }),
  prisma.leaveRequest.count({ where: { status: "PENDING_MANAGER" } }),
  prisma.payrollRun.findFirst({ orderBy: { period: { startDate: "desc" } } }),
]);
```

### Transactional approval

```ts
await prisma.$transaction(async (tx) => {
  await tx.approvalStep.update({ where: { id: step.id }, data: { status: "APPROVED" } });
  await tx.employeeRequest.update({ where: { id: request.id }, data: { status: "APPROVED" } });
});
```

## Seed Data

`prisma/seed.ts` creates:

- 7 roles and the full permission catalog
- 1 company, branches, departments, positions, work locations
- 50 employees with employments, salaries, skills, contacts, documents
- ~1,459 attendance rows
- leave types, balances, and requests
- payroll periods, components, runs, items, loans
- vacancies, candidates, applications, interviews, offers
- onboarding/offboarding plans and tasks
- performance cycles, reviews, goals
- training courses and enrollments
- assets and assignments
- requests and approval steps
- notifications, audit logs, and system settings

The seed is destructive and intended for local/demo use only.
