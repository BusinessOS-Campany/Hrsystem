# SECURITY

HRSYS handles identity, salaries, bank details, documents, and approval decisions. Security is therefore a product requirement, not a final checklist.

## Security Model at a Glance

| Layer | Control |
| --- | --- |
| Transport | HTTPS in production; secure cookies |
| Password storage | bcrypt, 12 rounds |
| Session storage | random token in httpOnly cookie; HMAC-SHA-256 hash in database |
| Session lifetime | 7 days, revocable, invalidated on password change/reset |
| Brute force | 5 failed attempts → 15-minute account lock |
| Authorization | database-backed RBAC, enforced on the server |
| Input validation | Zod schemas in server actions |
| SQL injection | Prisma parameterized queries |
| XSS | React escaping; no untrusted HTML rendering |
| CSRF | SameSite=Lax cookie + Server Actions origin checks |
| Sensitive data | permission-gated salary and documents |
| Audit | authentication, approvals, payroll, and employee changes |
| Secrets | environment variables; no secrets in source |

## Authentication

### Login

- The user can log in with email or username.
- Email lookup is case-insensitive by normalizing to lowercase.
- Passwords are verified with bcrypt.
- On success:
  - failed-attempt counters reset
  - `lastLoginAt` is updated
  - a new session is created
  - a `LOGIN` audit entry is written
- On failure:
  - the failed-attempt counter increments
  - the fifth failure locks the account for 15 minutes
  - no audit row is written for unknown users (avoids user enumeration through logs)
- The login page does not reveal whether an email exists.
- Password reset always returns success, whether or not the account exists.

### Session token design

```text
Browser cookie: hrsys_session = <32 random bytes, base64url>
Database:       sessions.tokenHash = HMAC-SHA-256(AUTH_SECRET, token)
```

Only the hash is persisted. A database leak does not directly yield usable session cookies. `AUTH_SECRET` must be long, random, and secret. Rotating it invalidates every session.

Cookie flags:

```ts
{
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  expires: expiresAt,
}
```

### Session validation

A session is valid only if all of these are true:

- the HMAC hash exists
- `revokedAt` is null
- `expiresAt` is in the future
- the user is active
- the user is not soft-deleted

`getCurrentUser()` is wrapped in React `cache` so one request does not repeatedly hit the database.

### Logout and revocation

- Logout revokes the current session and deletes the cookie.
- The profile page lists active sessions and allows revoking other sessions.
- Changing a password revokes every other session.
- Resetting a password revokes all sessions.

### Password policy

Minimum 10 characters, with at least:

- one uppercase letter
- one lowercase letter
- one number
- one symbol

The same policy applies to reset and change-password flows. The temporary password generated for a new employee account satisfies this policy and sets `mustChangePassword = true`.

### Password reset

1. User submits an email.
2. A random token is generated.
3. Only its HMAC hash is stored, with a one-hour expiry.
4. In development, the reset URL is logged and returned to the UI.
5. In production, the token must be delivered by a transactional email provider.
6. The token is single-use and is marked `usedAt` when consumed.
7. All sessions are revoked after a reset.

Do not log reset tokens in production.

## Authorization (RBAC)

Authorization is not based on the UI. It is enforced at every server boundary:

1. `proxy.ts` performs a coarse session-cookie check for protected paths.
2. The authenticated layout calls `requireAuth(locale)`.
3. Pages call `requirePermission("module.action", locale)`.
4. Server actions call `getCurrentUser()` and `hasPermission(...)`.
5. API route handlers validate the session and permission.
6. Queries apply data scope (self, direct reports, organization-wide).
7. Sensitive fields are conditionally selected/rendered.

A hidden button is a usability feature, never a security control.

### Permission catalog

Permissions are stable codes such as:

```text
employee.view
employee.view_all
employee.create
employee.update
employee.view_salary
leave.approve
payroll.finalize
request.approve
user.manage
role.manage
audit.view
```

Roles are presets over that catalog. The database stores the final role → permission mapping. Changing a role takes effect on the next request because permissions are loaded from the database into the session user object.

### Data scoping

- `employee.view_all` grants organization-wide employee visibility.
- Without it, a user sees self plus direct reports.
- `attendance.view_all`, `leave.view_all`, and `request.view_all` apply the same principle.
- `payroll.view_all` is required for all payslips; `payroll.view_self` only allows the linked employee's payslips.
- `employee.view_salary` controls salary display independently from employee visibility.
- `loan.approve` grants all-loan visibility; otherwise users see only their own loans.
- Users cannot approve or record repayment for their own loan.
- Completing offboarding deactivates the linked login and revokes its sessions.

Never infer scope from a role name. Check the permission code.

## Input Validation and Injection

- Every server action validates its input with Zod.
- Prisma uses parameterized queries; string concatenation is not used for SQL.
- JSON columns (`breakdown`, `oldData`, `newData`, `settings`) are written from validated structures.
- File uploads are not implemented yet. When added, validate MIME type, size, extension, and store outside the web root or in object storage.

## XSS and Content Security

- React escapes rendered values by default.
- The app does not use `dangerouslySetInnerHTML` for user content.
- Rich text, if added later, must be sanitized server-side.
- Add a Content-Security-Policy at the reverse proxy or through headers. A reasonable starting point:

```text
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

`unsafe-inline` for styles is often needed by component libraries. Tighten it when possible.

## CSRF

- The session cookie is `SameSite=Lax`.
- Server Actions are POST requests and are checked by Next.js against the request origin.
- State-changing operations are never exposed as GET routes.
- If a separate API is added for third-party clients, use an explicit CSRF token or a bearer-token design.

## Audit Logging

`audit_logs` records:

- actor user ID
- action (`LOGIN`, `LOGOUT`, `CREATE`, `UPDATE`, `APPROVE`, `REJECT`, `CALCULATE`, `FINALIZE`, `PASSWORD_CHANGE`, etc.)
- entity and entity ID
- old and new data snapshots where appropriate
- IP and user agent when available
- timestamp

Audited flows include authentication, employee creation/update, leave decisions, attendance correction review, request approvals, payroll calculation/approval/finalization, lifecycle checklist changes, recruitment, performance, training, asset assignment/return, and loan decisions/repayments.

Audit rows are append-only in normal application behavior. Do not expose a delete action in the UI.

## Sensitive HR Data

- Salary fields are only selected when the user has salary permission.
- Bank account and document data must be treated as highly sensitive.
- Documents are currently metadata/URL records; production storage should use private object storage with short-lived signed URLs.
- Exports must apply the same permission and scope rules as screens.
- Logs must not contain passwords, tokens, bank numbers, or full national IDs.

## Secrets Management

Required secrets:

```env
DATABASE_URL=...
AUTH_SECRET=...
APP_URL=...
```

Rules:

- never commit `.env`
- use a secret manager in production
- use different secrets per environment
- rotate `AUTH_SECRET` after suspected compromise (all sessions are invalidated)
- rotate database credentials on a schedule
- do not print secrets in build logs

## Production Checklist

- [ ] HTTPS enforced at the proxy/load balancer
- [ ] `NODE_ENV=production`
- [ ] `secure` cookies verified in the browser
- [ ] strong `AUTH_SECRET`
- [ ] dedicated least-privilege database user
- [ ] migrations run as a release step
- [ ] seed disabled and demo users removed
- [ ] password reset email configured
- [ ] rate limiting on login, reset, and public endpoints
- [ ] security headers and CSP configured
- [ ] PostgreSQL backups and restore test
- [ ] audit log retention policy
- [ ] monitoring and alerting for failed-login spikes
- [ ] dependency audit (`npm audit`) and update policy
- [ ] object storage private by default
- [ ] no sensitive data in logs
- [ ] admin accounts protected with strong unique passwords
- [ ] least-privilege review of `SUPER_ADMIN` and `HR_ADMIN`
- [ ] automated tests for authorization boundaries

## Known Gaps and Next Security Work

- No built-in rate limiter; add one at the edge or application layer.
- No MFA yet.
- No email verification or email delivery yet.
- No password history or forced periodic rotation (rotation is optional; modern guidance favors length and breach checks).
- No field-level encryption for bank/national ID data.
- No malware scanning for future uploads.
- No automated authorization regression tests yet.

These are explicit next steps, not hidden assumptions.
