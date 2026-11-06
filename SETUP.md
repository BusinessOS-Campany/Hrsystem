# SETUP

This guide covers local development, database initialization, seeding, production builds, and common problems.

## 1. Prerequisites

| Tool | Version |
| --- | --- |
| Node.js | 20 or newer |
| npm | 10 or newer |
| PostgreSQL | 14 or newer (16 recommended) |

Check:

```bash
node --version
npm --version
psql --version
```

## 2. Install dependencies

```bash
npm install
```

## 3. Create the PostgreSQL database

Create a dedicated role and database. Do not use the `postgres` superuser for the application.

```sql
CREATE ROLE hrsys WITH LOGIN PASSWORD 'replace-with-a-strong-password';
CREATE DATABASE "HRSYS" OWNER hrsys;
```

PostgreSQL identifiers are case-sensitive when quoted. Keep `HRSYS` quoted in SQL and in the connection URL.

### Local PostgreSQL without a service manager

If PostgreSQL is installed but not managed by systemd, initialize and start it manually:

```bash
sudo -u postgres initdb -D /var/lib/postgresql/16/main
sudo -u postgres pg_ctl -D /var/lib/postgresql/16/main \
  -l /tmp/opencode/pg.log \
  -o "-k /tmp/opencode/pgsock -p 5432" start
```

Create the role/database through the socket:

```bash
sudo -u postgres psql -h /tmp/opencode/pgsock -p 5432
```

Check readiness:

```bash
pg_isready -h /tmp/opencode/pgsock -p 5432
```

## 4. Configure `.env`

```bash
cp .env.example .env
```

Generate a real auth secret:

```bash
openssl rand -base64 32
```

`.env`:

```env
DATABASE_URL="postgresql://hrsys:your-password@localhost:5432/HRSYS?schema=public"
AUTH_SECRET="paste-the-generated-secret"
APP_URL="http://localhost:3000"
```

`AUTH_SECRET` signs session-token hashes. Changing it invalidates existing sessions, which is desirable after a suspected secret leak.

## 5. Prisma: generate, migrate, seed

```bash
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
```

For schema development:

```bash
npx prisma migrate dev --name describe_your_change
```

The seed **deletes existing rows** before inserting demo data. Never run it against production.

The local admin login is `admin` / `admin`. Override it before seeding with `ADMIN_PASSWORD=... npx prisma db seed`. When `NODE_ENV=production`, the seed falls back to the stronger shared demo password instead of `admin`.

## 6. Run the app

```bash
PORT=3000 npm run dev
```

The default port in some hosted environments may already be occupied. Set `PORT` explicitly if needed.

- English: <http://localhost:3000/en>
- Arabic: <http://localhost:3000/ar>
- Login: <http://localhost:3000/en/login>

## 7. Verify the installation

```bash
npm run typecheck
npm run build
```

Expected build result: compiled successfully, TypeScript passed, all routes generated or marked dynamic.

Optional database check:

```bash
npx prisma studio
```

## 8. Production deployment

### Build

```bash
npm ci
npx prisma generate
npm run build
```

### Start

```bash
NODE_ENV=production PORT=3000 npm run start
```

### Migrations

Run migrations as a release step, not from every application instance:

```bash
npx prisma migrate deploy
```

### Required production changes

1. Set a strong, unique `DATABASE_URL`.
2. Set a long random `AUTH_SECRET`.
3. Set `APP_URL` to the public HTTPS origin.
4. Serve over HTTPS and set secure cookies at the reverse proxy.
5. Replace the seed with a controlled bootstrap process.
6. Disable demo credentials. The login page only renders demo accounts when `NODE_ENV !== "production"`.
7. Configure email delivery for password reset and notifications.
8. Back up PostgreSQL and test restore procedures.
9. Add rate limiting at the edge or reverse proxy.
10. Review [SECURITY.md](SECURITY.md).

## 9. Useful commands

```bash
# Reset local data and reseed
npx prisma db seed

# Open Prisma Studio
npx prisma studio

# Create a migration
npx prisma migrate dev --name change_name

# Apply committed migrations
npx prisma migrate deploy

# Check TypeScript
npm run typecheck

# Lint
npm run lint

# Format Prisma schema
npx prisma format
```

## 10. Troubleshooting

### `P1001: Can't reach database server`

- Confirm PostgreSQL is running: `pg_isready`.
- Check host, port, username, password, and the quoted database name.
- If using a Unix socket, use the correct socket directory in the host parameter.

### `Environment variable not found: DATABASE_URL`

Prisma reads `.env` from the project root. Confirm the file exists and the key is spelled correctly.

### `AUTH_SECRET is not set`

Add `AUTH_SECRET` to `.env` and restart the server. Sessions created with another secret will no longer validate.

### Login redirects immediately or returns to login

- Confirm the `hrsys_session` cookie exists.
- Check that `APP_URL` matches the origin used in the browser.
- Confirm the session row has not expired or been revoked.
- Look at the server log for `[HRSYS]` errors.

### Seed fails with permission or enum errors

- Run `npx prisma generate` after schema changes.
- Confirm every role permission code exists in `lib/permissions/definitions.ts`.
- The seed deletes rows in dependency order. A partially failed seed may require a clean reset:

```bash
npx prisma migrate reset
npx prisma db seed
```

### Build or dev server runs out of memory

Use a larger Node heap:

```bash
NODE_OPTIONS=--max-old-space-size=6144 npm run build
```

### Port already in use

```bash
PORT=3001 npm run dev
```

Then open `http://localhost:3001/en`.

### Arabic text appears but layout is still LTR

The locale layout sets `dir` from the locale. Confirm you are under `/ar`, and do not hardcode `dir="ltr"` in shared layout components.
