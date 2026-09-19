# Evidence

Run `npm test` to regenerate the deterministic proof below.

| Requirement | Proof |
| --- | --- |
| Authenticated widget CRUD and tenant isolation | `tenant B cannot inspect tenant A widget or submissions` passes; it receives `404` for Alpha's widget and an empty submissions list. |
| Embed/config delivery and caching | `public config and versioned bundle are cacheable` checks `max-age=300` for config and `immutable` for `widget.v1.js`. |
| Cross-origin public API | `CORS preflight and malformed submissions return clean errors` receives `204` and `Access-Control-Allow-Origin: *`. |
| Boundary validation | The same test receives `422 {"error":"validation failed"}` for an invalid email. |
| Idempotency and safe side effects | `submission is idempotent...` gets `201`, then `200` with `idempotentReplay: true`, while a forced side-effect failure still stores the lead. |
| Spam/rate protection | `honeypot blocks spam...` proves honeypot `422` and burst `429`. |
| Geo provider fallback | The submission test sets provider A down and asserts stored geo provider `mock-ipapi` (provider B). Set both `GEO_PROVIDER_*_MODE=down` to prove storage with `geo: null`. |
