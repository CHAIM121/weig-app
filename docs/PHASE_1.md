# Phase 1 — Retention design for review

Status: design only; implementation paused on the unresolved retention conflict below. PR #11 remains open and draft. No runtime changes, migrations, scheduled jobs or new environment variables have been introduced. No lint/typecheck/test/build was run for this documentation-only update.

## Requested revision (2026-10-22)
The owner selected a compliant design separating permanent WEIG content from Google content:
- Permanent places records: Google place ID, independently assigned category, WEIG-owned Hebrew name override and independently contributed community, kashrut, minyan/mikveh and business-owner content.
- Separate google_place_cache: Google coordinates for at most 30 days; other Google fields and photo resource names for at most 7 days.
- Search ID cache: 7-day lifetime, revalidate only while still within that lifetime.
- No stored Google image bytes; detail-only photo proxy.
- Retain original field masks, autocomplete session tokens, list views without Google photos, metrics endpoint and existing Google Maps attribution.

The 7-day payload/photo-name proposal is recorded as requested, NOT described as permitted or implemented.

## Verified policy conflict
The standard Places policy does not grant a general 7-day storage exception for Google names, addresses, phone, website, opening hours, ratings or counts. A shorter TTL does not create permission. Place IDs are exempt. Non-EEA service-specific terms section 14.3 permits coordinate caching for at most 30 consecutive calendar days, then requires deletion. Photo documentation expressly prohibits caching photo names and notes that they can expire. Confirm the billing-account jurisdiction and applicable agreement before relying on exceptions.

Sources reviewed 2026-10-22:
- https://developers.google.com/maps/documentation/places/web-service/policies
- https://cloud.google.com/maps-platform/terms/maps-service-terms (section 14.3)
- https://developers.google.com/maps/documentation/places/web-service/place-photos (Get a photo name)

## Proposed corrected retention rules — pending owner decision
| Data | Storage and lifetime | Read/deletion rule |
| --- | --- | --- |
| Google place ID | Permanent | Stable external identifier; never treat this as permission to store other Google fields. |
| Independently authored WEIG data | Permanent, subject to WEIG content/privacy rules | Keep provenance; copied or translated Google content does not become independently authored data. Existing community/business features are not newly implemented by this document. |
| Google lat/lng | Separate google_place_cache, hard expiry no later than 30 days from acquisition | Return coordinates only if expires_at > database time. Delete expired rows with scheduled cleanup; scheduler does not replace read-time enforcement. Do not extend TTL on a cache hit. |
| Google name/address/contact/hours/rating/count | No persistent shared cache under the standard terms reviewed | Retrieve for the current request as needed; no database, CDN, object storage, persistent logs or offline copies of these payloads. An applicable written permission must explicitly change this rule. |
| Google photo resource name | No persistent cache | Obtain from a fresh detail response, use for the immediate photo request; keep author attribution and source link. |
| Google photo bytes | No stored copies | At most one detail photo, requested on opening details through server handling with no-store. No Google photo requests for list cards. |
| Search cache | Proposed 7-day cache containing permitted place IDs only plus WEIG request metadata | No Google payloads or expiring photo names. Expired ID sets are not served by this application even though IDs themselves may be retained. Cache hits cannot reconstruct names/details from IDs: retrieve permitted live Google data or use independently sourced WEIG data. |
| Operational metrics | SKU, request time, status, cache outcome and aggregate counts | No Google response bodies, photo names or credentials in logs. |

Stale-while-revalidate is limited to a refresh threshold strictly BEFORE hard expiry. At or after hard expiry, do not serve expired coordinates or search results; fetch fresh permitted data, return independently sourced content, or report temporary unavailability. Concurrent refreshes must be deduplicated. Cache keys must include category, radius, locale, normalized query and geographic/search semantics.

## Remaining scope
Preserve existing endpoint/category/Google-ID compatibility and the current visual language. Preserve the existing “מקומות ותמונות מ-Google Maps” attribution; also retain all required author/provider attributions and source links. Do not infer community verification or kosher status from Google data.

Keep the requested field masks unless the owner changes them. Their rating/userRatingCount fields trigger Enterprise search billing; they are not the cheapest SKU. See https://developers.google.com/maps/documentation/places/web-service/text-search

Autocomplete: 400 ms debounce, minimum 3 characters, local search of independently sourced WEIG names first, Google fallback below 3 local results, one session token per typing session, terminated/discarded on selection as required by the API workflow. Metrics: protected /api/admin/metrics/google with daily outbound counts per SKU. Keep PLACES_LEGACY_MODE rollback routing and test both paths.

The original 80–90% savings and “detail fetch once per window” assertions are not established for this corrected design; measure real usage. An ID-only hit can still require live Google details. Do not promise zero Google calls on repeat searches whose display relies on Google content.

## Decision required
May Phase 1 replace the requested 7-day Google payload/photo-name cache with the corrected no-persistent-cache rules above, retaining only permitted IDs and expiring coordinates? Otherwise provide the applicable written Google permission for the requested retention.

Delivery rule 5 in the supplied WEIG_SPEC_FOR_CODEX.md requires stopping on conflicts and recording the question in the PR instead of guessing. After resolution, implement migrations/server/UI/tests in the same phase PR, run typecheck/tests/build (no existing lint script), document actual env vars and cleanup scheduling, and leave the PR open for owner review without merging or deploying.
