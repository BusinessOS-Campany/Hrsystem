# HR WORKFLOWS

This document explains the HR concepts implemented in HRSYS and the exact business rules enforced by the server.

## 1. Employee Lifecycle

```text
Candidate → Hired → Onboarding → Active Employee
                                  ├─ Probation
                                  ├─ On Leave
                                  ├─ Active
                                  └─ Offboarding → Resigned / Terminated / Retired
```

### Employee creation

- HR creates the employee record and the first employment.
- The employee number is generated as `EMP-####`.
- The first employment is marked `isCurrent = true`.
- Leave balances are created for the hire year from active leave types.
- A login account is optional. When created, a temporary password is generated and must be changed at first login.
- Role assignment above `EMPLOYEE` requires `user.manage`.
- Creating an employee writes an audit entry.

### Employment changes

- Changing department, position, or salary updates the current employment and writes an `EmploymentHistory` row with old/new values.
- Historical employments are never overwritten by deleting the current one; new employment rows represent transfers/rehires.

## 2. Onboarding

Onboarding is a checklist-driven plan:

- One onboarding plan per employee.
- HR can create a plan for any active or probation employee who does not already have one.
- Creating a plan generates a standard checklist: contract, documents, accounts, equipment, orientation, manager introduction, payroll, and a 30-day check-in.
- Tasks have category, optional due date, assignee, and required flag.
- Progress = completed required tasks / total required tasks.
- Status transitions: `NOT_STARTED` → `IN_PROGRESS` → `COMPLETED`.
- Completing the final required task marks the plan complete.
- Every task toggle is audited.

Typical categories: contract, documents, account, equipment, orientation, training, manager assignment.

## 3. Offboarding

Offboarding is an exit case with a checklist:

- Types: resignation, termination, retirement, contract expiry.
- Required fields: request date, last working date, reason.
- HR can open a case for an employee who does not already have an active case.
- Tasks cover asset return, access removal, final settlement, knowledge transfer, exit interview, and final clearance.
- Progress and completion follow the same rule as onboarding.
- When the final required task is completed, the employee status becomes `RESIGNED`, `TERMINATED`, or `RETIRED` according to the case type.
- A linked login account is deactivated and its sessions are revoked when offboarding completes.

## 4. Attendance

### Daily record

One `Attendance` row per employee per date. The unique key is `[employeeId, date]`.

Fields include check-in, check-out, status, late minutes, early-leave minutes, overtime minutes, source, and notes.

### Check-in / check-out

- Check-in is allowed once per day.
- Check-out requires an existing check-in.
- The UI displays Yemen wall-clock time (`Asia/Aden`).
- The stored attendance date is a UTC date-only value.
- Check-in after the schedule start plus grace is `LATE`.
- A missing check-out can be corrected through a correction request.

### Monthly summary

- Present days = `PRESENT` + `LATE` + `REMOTE`.
- Overtime is summed from `overtimeMinutes` and displayed in hours.
- Absence and leave are counted from their respective statuses.

### Corrections

Employees can request a correction with a reason. A manager/HR user with `attendance.approve` reviews it:

- Approved: the attendance record is updated with requested times.
- Rejected: the correction is closed without changing attendance.
- Both decisions are audited.

## 5. Leave

### Working-day calculation

Leave days are not calendar days. HRSYS counts working days as:

- Sunday through Thursday
- excluding public/company holidays stored in `Holiday`

Friday and Saturday are weekend days in this configuration.

### Request validation

A leave request is rejected if:

- the employee has no linked employee record
- dates are invalid or end before start
- the range contains no working days
- it overlaps an existing pending or approved request
- the leave type is not active
- the employee lacks sufficient balance (except unpaid leave)

### Balance accounting

`LeaveBalance` tracks:

- `entitledDays` — annual entitlement
- `carriedDays` — carried forward
- `usedDays` — approved and consumed
- `pendingDays` — awaiting approval

Available = entitled + carried − used − pending.

Lifecycle:

1. Request created → `pendingDays += workingDays`
2. Manager rejects → `pendingDays -= workingDays`
3. Manager approves and HR approval is required → stays pending, status `PENDING_HR`
4. HR rejects → `pendingDays -= workingDays`
5. Final approval → `pendingDays -= workingDays`, `usedDays += workingDays`

### Approval routing

```text
Employee submits
  ├─ no manager → PENDING_HR
  └─ manager exists → PENDING_MANAGER
        ├─ leave type does not require HR → APPROVED
        └─ leave type requires HR → PENDING_HR → APPROVED / REJECTED
```

Authorization:

- Manager can review a `PENDING_MANAGER` request only if they are the assigned manager, unless they have `leave.view_all`.
- HR can review `PENDING_HR` only with `leave.view_all`.
- Every decision writes an audit entry and notifies the employee.

## 6. Payroll

### Configuration

Salary components are configurable and typed as earning or deduction. Calculation can be fixed or percentage-based. The seeded Yemen configuration uses `YER` and a 6% employee social-insurance contribution.

Employee salary components have effective dates, so historical payroll remains explainable.

### Periods and runs

```text
OPEN period → DRAFT run → CALCULATED/REVIEW → APPROVED → FINALIZED → PAID
```

Implemented run behavior:

1. HR/Payroll creates a run for an open period with no existing run.
2. The system reads current employments and effective salary components.
3. Gross = basic salary + earnings.
4. Deductions = configured deductions.
5. Net = gross − deductions.
6. Per-employee breakdown is stored as JSON in `PayrollItem`.
7. Run totals and employee count are persisted.
8. A payroll approver moves the run to `APPROVED`.
9. A finalizer moves it to `FINALIZED`, closes the period, and notifies employees.
10. Payroll calculation, approval, and finalization are audited.

### Payslips

Employees with `payroll.view_self` see their own payslip history. Payroll/HR with `payroll.view_all` see all runs and items. Salary visibility is separate from employee-profile visibility.

## 7. Recruitment

Pipeline:

```text
APPLIED → SCREENING → INTERVIEW → EVALUATION → OFFER → HIRED
                                                   └─ REJECTED / WITHDRAWN
```

- Vacancies belong to a department and position, with openings and salary range.
- Candidates apply to a vacancy through `CandidateApplication`.
- Interviews store schedule, interviewer, feedback, rating, and status.
- Offers store salary, start date, expiry, and status.
- A hired application can feed onboarding.
- Recruitment managers can create/edit vacancies, add candidates, move applications through stages, schedule interviews, and create offers.
- Moving an application to `HIRED` can fill the vacancy; moving it back can reopen the vacancy when openings remain.
- Interview scheduling and offer creation write audit entries and notify the interviewer or candidate owner.

## 8. Performance

- A performance cycle defines a review period and status.
- A review links employee, manager, and cycle.
- Self rating and manager rating are captured separately.
- Final rating is stored on the review.
- Goals have weight, progress, due date, and status.
- Managers with `performance.review_team` see their team; employees with `performance.review_self` see their own.
- Cycle creation can generate draft reviews for active and probation employees.
- Employees submit self reviews; managers submit manager reviews and the final rating is the average of self and manager ratings when both exist.
- Goal progress can be updated by the employee, their manager, or HR.

## 9. Training

- Courses have provider, category, dates, capacity, cost, and status.
- Enrollments link employees to courses with status and score.
- Completion rate = completed enrollments / total enrollments.
- Employees see their own training history unless they have organization-wide visibility.
- Training managers can create/edit courses and enroll employees.
- Enrollment is rejected when the course is at capacity or the employee is already enrolled.
- Completing an enrollment records the score, certificate, and feedback and can notify the employee.

## 10. Assets

- Assets have tag, category, brand/model, serial number, purchase data, cost, status, and condition.
- Assignment history is preserved with assigned date, return date, and return condition.
- An asset is `ASSIGNED` while an active assignment exists and `AVAILABLE` after return.
- Employees see their own assigned assets; asset managers see the register.
- Only `AVAILABLE` assets with no active assignment can be assigned.
- Returning an asset records the return condition. `POOR` or `DAMAGED` returns move the asset to `MAINTENANCE`; otherwise it returns to `AVAILABLE`.
- Assignment and return notify the employee when a linked login account exists.

## 11. Loans and Advances

Loans are a dedicated payroll-adjacent workflow:

```text
Employee request → PENDING → APPROVED / REJECTED
                         └─ ACTIVE → installments → COMPLETED
```

- An employee can request one loan while another request is pending.
- A request stores principal, number of installments, first installment date, reason, and computed installment amount.
- Approval generates an installment schedule with one row per month; the final installment absorbs rounding so the schedule equals the principal.
- Only `loan.approve` users can approve, reject, or record installment payments.
- Recording a payment reduces the outstanding balance. When the balance reaches zero, the loan becomes `COMPLETED`.
- Approval, rejection, and payment recording notify the employee and write audit entries.
- Salary advances remain available as an employee request type and can reuse the approval engine.

## 12. Requests and Approvals

`EmployeeRequest` is a reusable request system for certificates, advances, loans, expenses, documents, and other HR services.

Approval model:

- A request has ordered `ApprovalStep` rows.
- The current step is tracked by `currentStep`.
- A step can target a specific approver, a role, or a workflow step.
- Approval moves to the next pending step; the final approval sets the request to `APPROVED`.
- Rejection closes the request as `REJECTED`.
- Request creation and decisions notify the relevant users and write audit entries.

This model is intentionally reusable: new request types can reuse the same approval engine.

## 13. Notifications

Notifications are persisted per user with:

- type
- bilingual title and message
- optional deep link
- read state and read timestamp

Triggers include leave submission/decision, request submission/decision, payroll finalization, and approval requirements.

## 14. Audit Log

Audited actions include:

- login, logout, failed login, lockout
- password change and reset
- employee create/update
- leave request create/approve/reject
- attendance correction review
- employee request create/approve/reject
- payroll calculate/approve/finalize
- onboarding/offboarding task changes
- recruitment, performance, training, asset, and loan workflow changes
- permission and settings changes

Each entry stores actor, action, entity, entity ID, old/new data where useful, IP, user agent, and timestamp.

## 15. Reports

Reports use SQL aggregates, not hardcoded values:

- headcount by department
- turnover for the year
- attendance rate for the current month
- leave days by type
- payroll cost from the latest run
- recruitment pipeline counts
- training enrollments
- asset counts
- employee directory CSV export

## 16. Data Scope Rules

| Permission | Scope |
| --- | --- |
| `employee.view_all` | all employees |
| no `employee.view_all` | self + direct reports |
| `attendance.view_all` | all attendance |
| no `attendance.view_all` | self + direct reports |
| `leave.view_all` | all leave requests |
| no `leave.view_all` | self + direct reports |
| `payroll.view_all` | all payroll runs/items |
| `payroll.view_self` | own payslips only |
| `performance.view_all` | all reviews |
| `performance.review_team` | own + team reviews |
| `request.view_all` | all requests |
| no `request.view_all` | self + direct reports |
| `loan.approve` | all loans and installments |
| no `loan.approve` | own loans only |

Never rely on a hidden button as authorization. The same rule is enforced in the query or action.
