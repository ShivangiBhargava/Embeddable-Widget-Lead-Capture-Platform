# Design: Embeddable Widget & Lead-Capture Platform

## Problem

Customers need a one-line embed that collects leads from websites the platform does not control. The public boundary is hostile by default: it needs CORS, strict validation, abuse controls, and graceful degradation.

## Model and isolation

`Tenant -> User`, `Tenant -> Widget`, and `Tenant -> Submission`. Every admin query filters by the tenant ID carried in a signed bearer token; no route accepts a tenant ID from the caller. `migrations/001_initial_schema.sql` documents the production PostgreSQL schema and tenant/index strategy. The free local runtime uses an atomic JSON persistence adapter with the same entities so it needs no external service.

## Request paths

```text
Owner -> signed auth -> /admin/widgets -> tenant-scoped store -> script snippet
Customer page -> /widget.v1.js?id=... -> /public/widgets/:id/config -> rendered form
Visitor -> /public/submissions -> CORS -> validation -> rate/spam -> geo A/B -> store -> queued side effect
Owner -> /admin/submissions and /admin/dashboard/stats -> tenant-scoped analytics
```

## API surface

`POST /auth/login`; authenticated `/admin/widgets` CRUD, `/admin/submissions`, and `/admin/dashboard/stats`; public cacheable `GET /widget.v1.js` and `GET /public/widgets/:id/config`; and CORS-enabled `OPTIONS`/`POST /public/submissions`.

## Explicit non-goal

This is not a visual form-builder or a production authentication provider. The demo has a minimal rendering bundle and local signed-session login so the capstone can focus on hardened backend behavior.
