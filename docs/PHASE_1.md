# Phase 1 — Google request reduction and content retention

Implemented for review in PR #11. No merge, production migration or deployment has been performed. Phases 2–3 forms/business workflows are not part of this PR; their independently authored data fields and read path are prepared here.

## Permanent WEIG data

`public.places` stores a UUID, Google place ID, independently assigned category, and independently contributed WEIG fields: `name_he`, `address_he`, `phone`, website, opening hours, description, photos/menu, minyan/mikveh times, kashrut attributes, optional independently entered coordinates and timestamps. It contains no Google response payload. Do not populate these columns by copying, translating or summarizing Google content.

Future trusted Phase 2/3 writers maintain `verification_count` and `business_claimed`. Anonymous/authenticated clients have SELECT only under RLS, and can only see rows with a name and either `verification_count >= 1` or a claimed business. They cannot change eligibility or submit data directly to this table. Claim moderation and verification evidence/recency rules belong to those phases. No new kosher-verification badge is introduced here.

The historical `weig_places` catalog and its IDs remain separate and unchanged. Existing Google IDs in saved places, links and feedback continue to work.

## Retention rules

| Content | Actual implementation |
| --- | --- |
| Google place ID | May be retained permanently. |
| WEIG-owned fields | Permanent independently contributed content, subject to WEIG's own content/privacy policy. |
| Google coordinates | Only `google_place_cache(google_place_id,lat,lng,acquired_at,expires_at)`. Expire after **29 days**, leaving one day of margin below the 30-day contractual maximum. Acquisition time is captured before the Google request. Reads require `expires_at > now()` and do not extend retention. |
| Google names, addresses, phone, website, hours, ratings/counts, reviews and attributions | Live requests only. No database, object-storage, CDN or completed-response memory cache. API and outbound fetch use `no-store`. Attribution is displayed with the current response. |
| Google photo resource names | Only the immediate request/render flow in volatile memory. Never saved in a table, Web Storage, metrics, or a completed-response cache. The gallery is cleared when details close. |
| Google photo bytes | No stored copies. The proxy requests the media URL live and redirects without caching. |
| Search results | No Google payload/search-result cache, including no 7-day payload TTL or stale serving. IDs alone cannot render a Google-backed card. Local WEIG queries provide the reusable feed path instead. |
| Operational metrics | Daily UTC aggregate counts/failures by SKU label only; no response content, photo names, request bodies, API keys or user identifiers. |
| Browser restore/feedback snapshots | Retain IDs and UI preferences, not Google cards. Feedback/visit snapshots use the ID in place of a Google name and omit the address/URL. Existing user reviews/scores and IDs are preserved; the migration scrubs historical Google-backed snapshot names/areas/URLs. Legacy browser feedback snapshot keys are removed. |

The migration installs `pg_cron` and schedules `weig-google-coordinate-expiry` every minute to delete rows past their earlier 29-day expiry. Deployment fails rather than silently omitting an unavailable scheduler. Read-time RLS is enforced independently of the scheduler. Before rollout, verify the job actually runs and include replicas, backups and exports in the retention configuration; overdue cleanup must not allow coordinates to remain beyond the 30-day maximum. No scheduler or production backup configuration was changed in this session.

## Transient de-duplication (addition B adjusted)

`googleFetch` coalesces **overlapping, identical requests only**, keyed by a SHA-256 digest of the exact URL, HTTP method, normalized headers (including mask/key) and request body (including locale/session). Up to 500 pending operations are tracked per server process. Each operation has a 10-second upstream timeout; its entry is removed on success or failure, and state disappears when the process restarts/deploys. Response bodies are shared only while the original request is in progress and each caller gets its own Response clone.

**There is no 10-minute LRU of completed Google responses.** That would still cache Google content, even in RAM, and conflicts with the approved live-only rule. Sequential requests for Google-backed content fetch live again; concurrent requests share one outbound call. Client typing no longer starts parallel full Text Searches: it uses debounced autocomplete, with full text search on Enter/search-button/voice submission.

## Read flow and UI

- `GET /api/places/search` and the existing `GET /api/places` first query eligible independently authored places. A nonempty local result set is served from WEIG only with zero Google API calls. Local pagination stays local (`local=1`) and does not silently switch to paid Google discovery when exhausted. Nearby matching uses independent coordinates or unexpired cached coordinates without an outbound call. If neither exists, a place can still be found using its own name/address and city; it is not guessed into a nearby result set.
- Empty local results fall back to live Google Text Search. `q` and canonical category IDs are adapted to existing `query`/category conventions; radius input is validated. The existing Israel discovery/feed logic and relevance/pagination behavior remain in place. No wider geographic coverage is claimed.
- List masks omit photos, reviews, hours, phone and website; retain the requested ratings and required attribution/pagination fields. **Ratings/counts mean Enterprise search billing**, not the cheapest tier. Savings must be measured and are not guaranteed to be 80–90%.
- List/feed cards never request a Google photo. Locally contributed business photos can render. Map-card focus no longer fetches Place Details automatically; WEIG list/feed rows do not start Google route-matrix requests. Google Maps itself remains an external map service when the user opens map view.
- `/api/places/:id` and the existing `/api/places/details?id=…` fetch missing details only after opening a place. Own name/address/phone/website/hours/photos/coordinates suppress those corresponding Google fields, and Google cannot overwrite own values. Reviews remain an explicit user action. At most one detail photo is returned; photo resource names are never persisted.
- Existing photo URL compatibility remains; `/api/places/:id/photo` also obtains a fresh photo name and immediately requests Google media. Author/source attribution from the detail response must remain visible wherever that photo is rendered.
- `/api/places/summary` uses own data first; Google summary responses omit photos. Kashrut lookup uses existing approved evidence for local places and does not probe their Google identity.
- Existing Hebrew/English styling and Google attribution remain for Google content. Local-only results have a separate WEIG attribution. New autocomplete copy is in the i18n dictionaries.

## Autocomplete

`GET /api/places/autocomplete`: minimum 3 characters, 400ms debounce, local WEIG names/addresses first. Google fallback only below 3 local results. A UUID session token is reused while typing, passed to Place Details on Google selection, and discarded on selection/abandonment. Suggestions live in current UI state only. The combobox supports arrow keys, Enter, Escape and explicit search submission.

## Metrics and environment

Every server Google call (including legacy search, details, photos, kashrut identity, route matrix and existing AI Places tools) uses the shared wrapper. Each actual outbound call logs a SKU label, `cache_hit=false` and status, and atomically increments `google_call_daily`. Deduplicated waiters do not increment it. Browser Maps JS loads are outside this server metric. Labels describe requested API field tiers; they are not a billing invoice or an accurate final autocomplete session-price calculation.

`GET /api/admin/metrics/google` returns 30 days of daily UTC calls/failures. It uses the existing authenticated `weig_kashrut_managers` admin gate; it is not publicly readable. There is no place-view denominator yet, so the original <10% view target is not established by these counters.

Required runtime configuration:
- Existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Existing server-only `GOOGLE_PLACES_API_KEY`; keep it separate from browser Maps JS keys.
- `SUPABASE_SERVICE_ROLE_KEY` is now used by the application server for coordinate writes and aggregate metrics. Never expose it to client code. It was previously used only by import tooling.
- `PLACES_LEGACY_MODE=true` switches search routing to the preserved original Google provider. Default false enables this phase. This flag does not revert the UI, snapshot safeguards or SQL retention rules.

Rollout order after owner review: apply the migration in a test database, configure the server-only key, verify cron/RLS/metrics, then deploy the new path. Missing service configuration skips optional coordinate/metric writes; metrics endpoint reports unavailability. A configured but failing local database returns an explicit error rather than silently issuing paid Google searches. Missing database config retains live Google fallback for compatibility.

## Validation

- `npm run typecheck`, `npm test` (**151 tests across 28 files**), `npm run build`; no lint script exists. Production build retains the existing Supabase realtime Edge Runtime warning. Server modules are guarded by `server-only`; the marker is stubbed only in Vitest.
- SQL integration runs in PGlite: real table/function/trigger creation, RLS visibility, denied public writes/RPCs, local geographic search, aggregate counter increments, historical snapshot scrubbing and expiry deletion. PGlite cannot run pg_cron: its scheduling API is stubbed, the job definition is checked and its deletion SQL executed. A real Supabase cron run remains a rollout check.
- Mock-Google tests cover overlapping-request sharing, sequential live fetches, rejected-request eviction, key separation, local zero-Google serving for verification/claim eligibility, local-only pagination, missing-field detail masks, input validation, local autocomplete fallback and session forwarding.
- UI tests cover 400ms debounce, minimum length, keyboard selection/token lifecycle and restoring an ID with a live summary instead of a stored Google snapshot. Metrics tests cover authorization and credential-safe output.
- Production HTTP smoke test with a local mocked Data API: `/he/places` 200; local `/api/places/search` 200 with `weig_owned` and one place; detail 200 from own data with Google unconfigured; metrics rejects unauthenticated access with 401. This is server/API smoke evidence, not a browser check or a live Supabase deployment.
- A production browser run was attempted but unavailable: the environment's Chromium download returned truncated archives. No visual/browser end-to-end success is claimed. Live paid Google requests and production Supabase migrations were not executed.

## Policy references

Reviewed 2026-10-22:
- https://developers.google.com/maps/documentation/places/web-service/policies
- https://cloud.google.com/maps-platform/terms/maps-service-terms (non-EEA Places API §14.3)
- https://developers.google.com/maps/documentation/places/web-service/place-photos (photo-name caching prohibition)
- https://developers.google.com/maps/documentation/places/web-service/text-search (field tiers)
