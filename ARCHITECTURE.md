# ARCHITECTURE

## 1. Starting Point and What Changed

The workspace started empty: no application, database, schema, authentication, UI system, or localization. HRSYS was created from scratch.

The initial architecture report identified these required foundations:

1. A real relational database and migration workflow.
2. A normalized HR schema with constraints and indexes.
3. Server-side authentication and session management.
4. Granular RBAC with a permission catalog.
5. A locale-aware App Router structure.
6. RTL-safe layouts and bilingual content.
7. A theme system with persistence.
8. A reusable authenticated application shell.
9. Real-data dashboards and reports.
10. Business rules implemented in server actions, not forms.
11. Auditability for sensitive actions.
12. Incremental module delivery without breaking the app.

All foundations are now implemented. The production build passes and every module route renders with real seeded data in both English and Arabic.

## 2. High-Level Architecture

```text
Browser
  │
  ├─ /en or /ar locale routing (next-intl)
  ├─ RSC pages: read data through Prisma
  ├─ Client components: forms, theme, charts, filters
  └─ Server Actions: validate, authorize, mutate, audit, revalidate
        │
        ├─ lib/auth/session.ts     authentication + permission checks
        ├─ lib/permissions/        catalog + role presets
        ├─ lib/validations/        Zod input contracts
        ├─ lib/db/prisma.ts        singleton Prisma client
        └─ PostgreSQL
```

The application uses **Server Components for reads** and **Server Actions for writes**. Client components are used only where interaction is required: forms, selects, charts, theme controls, and local UI state.

## 3. Request and Authorization Flow

```text
Request
  → proxy.ts checks locale and session cookie presence
  → app/[locale]/layout.tsx sets locale, dir, theme provider
  → app/[locale]/(app)/layout.tsx calls requireAuth()
  → page calls requirePermission("module.view")
  → server action calls getCurrentUser() + hasPermission(...)
  → Prisma query scoped by employee/direct-report/organization rules
  → audit write for sensitive mutations
  → revalidatePath for affected pages
```

Important: `proxy.ts` is a coarse gate. It does not replace page or action authorization. A user with a valid cookie can still be blocked from a module they do not have permission to view.

## 4. Folder Structure

```text
app/[locale]/(app)/          authenticated shell
  <module>/page.tsx          server-rendered module page
  <module>/actions.ts        server actions for that module
  <module>/[id]/page.tsx     detail pages
  <module>/new/page.tsx      create forms
app/[locale]/                public auth pages
app/api/reports/employees/   authenticated CSV route
components/                  shared UI, layout, and module forms
lib/auth/                    session, password, tokens, audit
lib/permissions/             permission catalog and role definitions
lib/validations/             Zod schemas
lib/format.ts                locale-aware date/number/money/name formatting
i18n/                        next-intl routing and navigation
messages/en.json, ar.json    translation catalogs
prisma/schema.prisma         source of truth for the data model
prisma/seed.ts               realistic demo dataset
```

## 5. Database and Prisma Strategy

- PostgreSQL is the only application database.
- Prisma 6.19 is pinned for stable, well-understood APIs.
- The schema contains **62 models** covering users, organization, employees, time, payroll, recruitment, lifecycle, performance, training, assets, requests, notifications, audit, and settings.
- Primary keys are CUID strings.
- Foreign keys use explicit `onDelete` behavior (`Cascade`, `Restrict`, `SetNull`) according to ownership.
- Unique constraints protect natural keys: employee number, email, national ID, role code, department code per company, position code per department, payroll run number, request number.
- Indexes cover common filters: status, employee, department, date, manager, company, and soft-deletion fields.
- Date-only values use `@db.Date`.
- Money and leave days use `Decimal`, never floating point.
- Soft deletion is used for employees, departments, positions, assets, and users.
- Multi-company readiness is present through `companyId` fields, even though the seed is single-company.

See [DATABASE.md](DATABASE.md) for the model catalog.

## 6. Authentication

Authentication is intentionally custom and database-backed:

- Passwords are hashed with bcrypt (12 rounds).
- Login accepts email or username.
- After 5 failed attempts, the account is locked for 15 minutes.
- A random session token is generated; only its HMAC hash is stored in `sessions`.
- The browser receives the raw token in an httpOnly, sameSite, secure-in-production cookie named `hrsys_session`.
- Sessions have expiry and revocation timestamps.
- Changing a password revokes all sessions.
- Password reset uses one-hour, single-use tokens stored as hashes.
- Login, logout, failed login, lockout, password change, and reset are audited.

Why not Auth.js: the project needs explicit control over HR-specific lockout, audit, session revocation, and role assignment. The custom implementation keeps the security model visible and teachable.

## 7. RBAC

The permission catalog is defined in `lib/permissions/definitions.ts`. Roles are seeded from `ROLES`:

| Role | Scope |
| --- | --- |
| `SUPER_ADMIN` | All permissions |
| `HR_ADMIN` | All permissions except `role.manage` |
| `HR_OFFICER` | Day-to-day HR operations |
| `MANAGER` | Team attendance, leave, performance, requests |
| `EMPLOYEE` | Self-service |
| `PAYROLL_OFFICER` | Payroll, salary visibility, loans, reports |
| `RECRUITER` | Recruitment and onboarding |

The database stores roles, permissions, and the join tables `user_roles`, `role_permissions`. The session layer loads permissions into a set for fast checks.

Enforcement points:

- navigation filtering
- authenticated layout
- page-level `requirePermission`
- server actions
- API route handlers
- sensitive field visibility (salary, documents)
- data scoping (self, direct reports, organization-wide)

## 8. i18n Strategy

- `next-intl` provides routing, message loading, and navigation helpers.
- Locales are `en` and `ar`.
- All UI strings live in `messages/en.json` and `messages/ar.json`.
- Namespaces map to modules: `common`, `auth`, `nav`, `dashboard`, `employees`, etc.
- Locale-aware formatting is centralized in `lib/format.ts`:
  - date-only values are formatted in UTC
  - instants are formatted in `Asia/Aden` (Yemen time)
  - money uses `Intl.NumberFormat`
  - Arabic names fall back to English when needed
- Server pages use `setRequestLocale` and `getTranslations`.
- Client components use `useTranslations`.

Rule: do not add hardcoded user-facing strings. Add both English and Arabic keys.

## 9. RTL Strategy

- The locale layout sets `lang` and `dir` (`rtl` for Arabic, `ltr` for English).
- Layout uses logical CSS properties: `ms-*`, `me-*`, `start-*`, `end-*`, `text-start`, `text-end`.
- Navigation and tables are direction-aware.
- Inputs for Arabic content can opt into `dir="rtl"` without flipping the whole page.
- Icons that imply direction use logical placement or are chosen per locale where necessary.
- Fonts: Inter for Latin, IBM Plex Sans Arabic for Arabic.

## 10. Theme Strategy

- `next-themes` handles light, dark, and system modes.
- The provider is mounted at the locale layout.
- The toggle persists the user choice in local storage.
- Theme tokens are CSS variables in `app/globals.css`, so RTL and LTR share the same palette.
- The primary palette is an enterprise blue with semantic success, warning, and danger tokens.

## 11. Module Map

| Module | Main capabilities |
| --- | --- |
| Dashboard | Headcount, attendance, leave, approvals, payroll, departments, birthdays, contracts, audit, quick actions |
| Employees | Search, filters, pagination, profile, salary visibility, create, edit, direct reports, documents, assets, skills |
| Departments | Hierarchy, headcount, manager, parent, positions, create |
| Positions | Department, grade, salary band, incumbents, create |
| Attendance | Daily records, stats, check-in/out, monthly summary, corrections and review |
| Leave | Balances, request form, overlap/balance validation, manager → HR approval, request list |
| Payroll | Periods, runs, calculation, review, approval, finalization, payslips, components |
| Recruitment | Vacancies, pipeline stages, candidates, interviews, offers |
| Onboarding | Plan creation, task checklists, progress, completion |
| Offboarding | Case creation, checklists, progress, completion, account deactivation |
| Performance | Cycles, reviews, ratings, goals, progress |
| Training | Courses, enrollments, completion, cost |
| Assets | Register, create/edit, assignment, return, condition, status, value |
| Loans | Employee requests, approval/rejection, installment schedule, repayment recording |
| Requests | Employee requests, approval steps, approve/reject |
| Reports | Headcount, turnover, attendance, leave, payroll, recruitment, training, CSV export |
| Settings | Company, branches, users, roles, leave types, salary components, schedules, holidays, role permissions and system settings, with server-authorized editing |
| Audit | Filterable audit log |
| Notifications | Inbox, unread filter, mark read |
| Profile | Account, roles, employee link, password change, session revocation |

## 12. Roadmap and Lessons

### Implemented phases

1. Foundation: Next.js, TypeScript, Tailwind, shadcn/ui, PostgreSQL, Prisma.
2. Data model: 62 models, enums, constraints, indexes, migration, seed.
3. Authentication: login, logout, sessions, lockout, password reset, change password.
4. Authorization: permission catalog, roles, navigation filtering, server enforcement.
5. Localization and theme: `/en`, `/ar`, RTL, light/dark/system.
6. Application shell: sidebar, header, search, notifications, user menu.
7. Dashboard and reporting: real SQL aggregates and charts.
8. People modules: employees, departments, positions, profiles, create/edit.
9. Time modules: attendance, corrections, leave, approvals.
10. Talent and operations: payroll, recruitment, onboarding, offboarding, performance, training, assets, loans, requests.
11. System modules: settings administration, audit, notifications, profile, security.
12. Hardening: typecheck, lint, production build, bilingual route verification, documentation.
13. Workflow completion: recruitment, performance, training, assets, and loans mutations with notifications and audit.

### Recommended next phases

1. Document uploads to S3-compatible object storage.
2. Email and background jobs.
3. Automated tests and CI.
4. Observability, rate limiting, and backup automation.
5. Accessibility and performance audits.

### Lessons embedded in the design

- Start with the schema and permission model; UI is cheaper to change than data contracts.
- Keep authorization checks next to data access, not only in navigation.
- Use server actions for mutations so validation and business rules cannot be bypassed.
- Treat dates as two different concepts: date-only HR records and timezone-bound instants.
- Use `Decimal` for money and leave balances.
- Make every user-facing string translatable from the first screen.
- Design RTL with logical properties from the start; retrofitting RTL is expensive.
- Audit sensitive actions, especially approvals, payroll, and permission changes.
