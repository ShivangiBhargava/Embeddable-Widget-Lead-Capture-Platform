# Embeddable Widget & Lead-Capture Platform

A backend-focused, multi-tenant platform for customer-owned lead widgets. An owner creates a widget, places one versioned script on any page, and receives validated, protected, enriched submissions in a tenant-isolated dashboard API.

## Architecture

```text
Authenticated owner ──> admin CRUD ──> persistent tenant-scoped widgets
                                       └──> <script src="/widget.v1.js?id=...">
Customer site (port 5500) ──> public config (CORS + 5 min cache) ──> widget form
Visitor ──> public submission (CORS) ──> validate ──> rate limit + honeypot
                                              └──> geo A -> geo B -> store anyway
                                                       └──> queued notification (safe failure)
Owner ──> submissions + per-widget/country/day stats
```

## Run locally

Requires Node 18+; there are no packages to install.

```bash
cp .env.example .env
npm run seed
npm start
```

In another terminal, serve the intentional second-origin customer page:

```bash
cd demo && python3 -m http.server 5500
```

Visit `http://localhost:5500/customer-site.html`. Demo credentials are `owner@alpha.test` / `demo-password`. `npm test` exercises the acceptance flow end-to-end without network calls.

## Core API

- `POST /auth/login` - `{ "email", "password" }` to receive a bearer token.
- `GET|POST /admin/widgets`, `GET|PUT|DELETE /admin/widgets/:id` - authenticated widget management.
- `GET /admin/submissions`, `GET /admin/dashboard/stats` - authenticated tenant-scoped reporting.
- `GET /widget.v1.js?id=widget_welcome` - immutable, versioned embed bundle.
- `GET /public/widgets/:id/config` - public CORS config, cached for five minutes.
- `POST /public/submissions` - public CORS submission. Send `{ "widgetId", "data", "honeypot" }`; use `Idempotency-Key` for retry-safe submission.

## Security and resilience decisions

- Signed expiring bearer sessions; tenant ID is derived only from the token.
- Strict field allow-list, required/email/length checks, 16 KB body cap, JSON errors, and no user-controlled schema.
- Per-IP-and-widget in-memory 8/minute limit and hidden honeypot.
- Deterministic geo fallback: A -> B -> `null`; no provider failure blocks persistence.
- A queued confirmation job is processed after the lead writes. Its failure becomes `failed_safe`, never a failed lead request.
- Idempotency keys return the original submission on retry.

## Useful failure demonstrations

Start with `GEO_PROVIDER_A_MODE=down` to force provider B. Set both geo modes to `down` and leads still return `201`. Set `SIDE_EFFECT_MODE=fail` (or header `X-Force-Side-Effect-Fail: true`) and the lead still persists.

## Limitations

The local runtime is purposefully dependency-free and stores data in `data/platform.json`; the included migration is the PostgreSQL production schema. Rate-limit buckets are process-local, geo and notification providers are deterministic mocks, and demo login is not a full identity system. A production deployment should replace these with Postgres, Redis, real provider clients, an email/webhook worker, and managed authentication.

See [DESIGN.md](DESIGN.md), [EVIDENCE.md](EVIDENCE.md), and [BUILDLOG.md](BUILDLOG.md) for the capstone submission pack.
