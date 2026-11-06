# PHASES

This project was built in incremental phases. Each phase left the application in a working state.

## Phase 1 — Foundation and Architecture

**Goal:** choose the stack and create a foundation that can support real HR data.

Delivered:

- Next.js 16 App Router, TypeScript, Tailwind CSS v4
- shadcn/ui and Lucide icons
- PostgreSQL 16 and Prisma 6.19
- environment template and local database
- locale-based routing with `/en` and `/ar`
- theme provider with light/dark/system
- shared formatting utilities

Key lesson: choose the database, date model, and permission model before building screens. Retrofitting these later is expensive.

## Phase 2 — Data Model

**Goal:** model the HR domain correctly.

Delivered:

- 62 Prisma models
- 30+ enums
- organization, employee, time, payroll, recruitment, lifecycle, performance, training, assets, requests, notifications, audit, and settings
- constraints, indexes, cascading rules, soft deletion
- initial migration
- realistic seed with 50 employees and ~1,459 attendance rows

Key lesson: normalize identity, employment, and payroll separately. An employee is not the same thing as a login account or a contract.

## Phase 3 — Authentication

**Goal:** make access real and auditable.

Delivered:

- email/username login
- bcrypt password hashing
- HMAC-hashed session tokens
- httpOnly cookie sessions
- lockout after five failures
- forgot/reset password flow
- change password
- session listing and revocation
- login/logout/password audit events

Key lesson: store session hashes, not raw tokens. Treat password reset tokens like passwords.

## Phase 4 — Authorization

**Goal:** enforce HR permissions on the server.

Delivered:

- permission catalog
- seven role presets
- role/permission join tables
- permission-filtered navigation
- `requireAuth` and `requirePermission`
- server-action checks
- self / direct-report / organization-wide data scopes
- salary and document visibility rules

Key lesson: authorization must be enforced at the data boundary. Hiding a link is not security.

## Phase 5 — Localization and RTL

**Goal:** make Arabic and English first-class.

Delivered:

- next-intl routing
- complete `en.json` and `ar.json` catalogs
- translated navigation, forms, tables, errors, empty states, HR terms, and reports
- RTL layout with logical CSS properties
- locale-aware dates, numbers, money, and names
- Arabic font support

Key lesson: design with logical properties (`ms-`, `me-`, `start-`, `end-`) from day one. RTL is a layout concern, not a translation toggle.

## Phase 6 — Application Shell and Dashboard

**Goal:** create the working environment and a real data overview.

Delivered:

- responsive sidebar and mobile sheet
- header search, notifications, locale switcher, theme toggle, user menu
- dashboard aggregates from PostgreSQL
- charts for headcount, attendance, leave, and payroll
- quick actions, birthdays, contract expiries, audit activity

Key lesson: dashboard numbers should be queries, not static arrays. If a number cannot be traced to SQL, it is decoration.

## Phase 7 — People Modules

**Goal:** manage the employee lifecycle and organization.

Delivered:

- employee list with search, filters, pagination
- employee profile with overview, employment, attendance, leave, payroll, assets, performance, training, documents, skills
- employee create/edit with optional login account
- department hierarchy and create
- position catalog with salary bands and incumbents
- organization-wide and manager-scoped visibility

Key lesson: employee creation spans several tables. Use a transaction and generate the first employment and leave balances together.

## Phase 8 — Time and Leave

**Goal:** implement real attendance and leave rules.

Delivered:

- daily attendance records
- Yemen check-in/check-out (`Asia/Aden`)
- monthly summary
- correction requests and review
- leave balances
- working-day calculation (Sunday–Thursday, excluding holidays)
- overlap and balance validation
- manager → HR approval routing
- notifications and audit entries

Key lesson: leave is not “end date − start date.” It is working days, holidays, balances, overlap, and approval policy.

## Phase 9 — Payroll

**Goal:** make payroll explainable.

Delivered:

- configurable salary components
- employee salary components with effective dates
- payroll periods and runs
- calculation from current employment and effective components
- stored per-employee breakdown
- review, approval, finalization
- payslip history
- payroll audit events

Key lesson: store the breakdown used at calculation time. Salary configuration changes later must not rewrite history.

## Phase 10 — Talent and Operations

**Goal:** cover the wider HR operating model.

Delivered:

- recruitment vacancies, pipeline, interviews, offers
- onboarding plans and checklists
- offboarding cases and checklists
- performance cycles, reviews, goals, ratings
- training courses and enrollments
- asset register, assignment, and return
- employee loans, approvals, and installment schedules
- reusable employee requests with approval steps

Key lesson: many HR processes share the same shape: a case, a checklist or approval chain, notifications, and an audit trail. Build reusable primitives.

## Phase 11 — System Modules

**Goal:** make the system operable.

Delivered:

- editable settings for company, branches, users, roles, leave types, salary components, schedules, holidays, role permissions, and system settings
- audit log with filters and pagination
- notification inbox
- profile page with account, roles, employee link, password change, and sessions
- reports and CSV export

Key lesson: administrative visibility is part of the product. Without settings, audit, and notifications, an HR system is only a set of forms.

## Phase 12 — Hardening

**Goal:** prove the application runs as a whole.

Delivered:

- TypeScript check passes
- production build passes
- all module routes render in English and Arabic with seeded data
- missing translation keys and serialization issues fixed
- documentation added
- direct server-action verification for recruitment, performance, training, assets, and loans

Key lesson: route-by-route verification catches integration errors that typechecking cannot: missing messages, Decimal serialization, permission redirects, and runtime query mistakes.

## Phase 13 — Workflow Completion

**Goal:** turn every read-oriented module into a working HR workflow.

Delivered:

- recruitment vacancy create/edit, candidate intake, pipeline stage updates, interview scheduling, and offers
- onboarding plan creation with generated checklists and offboarding case creation with account deactivation
- performance cycle creation with review generation, self reviews, manager reviews, and goal progress
- training course create/edit, enrollment with capacity checks, and completion tracking
- asset create/edit, employee assignment, and return with condition tracking
- loans with employee requests, approval/rejection, generated installment schedules, and repayment recording
- bilingual forms, notifications, audit entries, and server-side permission checks for every new mutation

Key lesson: a module is not complete when it renders. It is complete when the business event can be created, approved, recorded, notified, and audited without bypassing the server.

## Suggested Next Phases

1. Document uploads with private object storage.
2. Email delivery and background jobs.
3. Automated unit, integration, and end-to-end tests.
4. Observability, rate limiting, and backup automation.
5. Accessibility and performance audits.
