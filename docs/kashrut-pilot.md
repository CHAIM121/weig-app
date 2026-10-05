# Kashrut pilot — 5 October 2026

225 unique official directory rows were imported from the Beit Shemesh religious
council, https://www.rabanutbs.co.il/53/. This source does not publish certificate
expiry dates or a directory update date. Records are official_listing evidence,
not verified certificates. fetched_at is retrieval time, never certification time.

Stable WEIG identities live in weig_place_identities, with external IDs in
weig_place_provider_links. Links default to pending; only approved links and
linked evidence can be read by public clients. Import and approval are privileged
operations, with no public write route. Evidence preserves certifier, source
label, food type, level, source URL, expiry and verification timestamps when known.
Google names, addresses, photos and reviews are not persisted in this subsystem.

Initial manually reviewed links:
- Burgers Bar, council name בורגר בר, דרך רבין 19: name, branch address and
  identical business phone were cross-checked. Approved link identifies the
  business, not the validity of its certification.
- 110 בורגר בית שמש, קניון שער העיר: exact business name and shopping-center branch.

Same-name businesses with a different branch or address are not approved.
Phone conflicts require further review. Do not propagate certification across a chain.

Statuses: official directory listing; freshly verified certificate with expiry;
expired certificate; explicit withdrawal; stale information after seven days;
missing evidence; service outage. Neither a listing nor a name containing כשר is
proof of a current certificate. Missing evidence does not mean non-kosher.

Refresh workflow (manual for this pilot):
1. Fetch the official source to a local HTML file.
2. Run python scripts/prepare-kashrut-council.py council.html import.sql.
3. Review the reported source timestamp/row count and SQL; execute against WEIG App.
4. Review candidate identities separately; approve only proven branch matches.
Re-import preserves IDs for the same source name/address. Renames/relocations
require review. Partial directories never delete evidence or revoke certification.
There is no scheduled refresh or automatic matching in this pilot.

Shirat Hayam portal returned Request Rejected from the execution environment;
browser navigation also timed out. No national endpoint, national count or
certificate import was verified. A future connector requires accessible documented
access and confirmation of reuse terms. Never label this connector operational.
