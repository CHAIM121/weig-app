# Official kashrut coverage — 6 October 2026

The live evidence database contains 1,661 source records: 1,577 active and 84
inactive. The table below counts active records:

| Official source | Records | Coverage |
| --- | ---: | --- |
| Beit Shemesh religious council | 225 | Beit Shemesh |
| Petah Tikva religious council | 576 | Petah Tikva |
| Netanya religious council | 605 | Netanya |
| Ministry of Religious Services / data.gov.il | 63 | Yokneam Illit council |
| OU public restaurant directory | 108 | Primarily US, also Israel and London |

Counts are source records, not unique Google businesses or verified certificates.
Two Petah Tikva inspector-report categories are excluded. Records without a
published address/locality are retained but cannot be automatically matched.
Supervisor contact information is never used as a business phone or imported.
No certificate expiry dates are published by these directory inputs. A source
claim such as "בתוקף" stays a source label; it never becomes a verified certificate.
Partial supervision scope (e.g. bakery department only) is displayed in the row.

## Identity and access

Stable WEIG identities live in `weig_place_identities`; manually approved Google
IDs remain in `weig_place_provider_links`. Imports reuse identities by source/key.
Only approved links and their evidence are directly readable through table RLS.
A restricted read-only RPC returns public official evidence candidates for one
city/country from the five allowlisted sources. There are no public writes,
service-role credentials, or automatic approval mutations in the web application.

For every unlinked Google place, the server fetches its canonical Google name,
city, country, street, house number and phone. A match requires the same locality
and branch address, plus normalized business name or exact business phone.
When an official address has no house number, name, phone and street must all
agree. A shared phone cannot decide between different business names. Name-only
or chain-wide propagation is prohibited. An English Google identity supports
English OU and council business names. Google display content is never persisted.
Automatic matches are resolved on opening a place; source evidence stays durable
in Supabase. Matching does not certify that a certificate is currently valid.

## Presentation and status

The place card shows one standard, uncolored kashrut row, with expandable details.
Details preserve source labels, limitations, retrieval date and official links.
Statuses distinguish directory listing, freshly verified dated certificate,
expired certificate, explicit withdrawal, stale data after seven days, missing
information and lookup outages. Missing does not mean non-kosher.

## Import workflow

`scripts/prepare-kashrut-sources.py` accepts complete source snapshots. It validates
headers, row counts, stable identifiers, allowed URLs, unique Netanya pagination,
and a complete OU/API response. It produces a single transactional, idempotent
SQL import. Existing identities survive refreshes. Entries missing from a complete
snapshot become inactive; old evidence is retained rather than called revoked.
It must never be run with partial snapshots. Dependencies: Python + beautifulsoup4.
Raw source snapshots and generated import SQL are temporary, not committed.

Sources:
- https://www.rabanutbs.co.il/53/
- https://mpt.org.il/directory-kashrut/?num=200 (pages 1–3)
- https://mdn.org.il/directory-kashrut/?num=200 (pages 1–4)
- https://data.gov.il/api/3/action/datastore_search?resource_id=c54032cb-5306-4be9-a20d-a0be0ba49cc1&limit=1000
- https://oukosher.org/wp-json/kosher-api/v1/restaurants/posts?page=1 (pages 1–11)

Refreshes are manual; no background scheduler was enabled in this change.
Shirat Hayam, Jerusalem, Tel Aviv and STAR-K rejected automated access or timed
out. No national integration is operational, and no data was imported from those
blocked sources. The schema/adapter workflow supports adding further official
councils and certifiers without replacing Google discovery or building a separate
kashrut application.
