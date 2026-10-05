# Kashrut management registry — first implementation

The authority-first specification is implemented as a private management area at
`/he/kashrut-admin`. Regional collection and scheduled scanners remain a later
phase. The existing business evidence and public place-card lookup are unchanged.

## Available now

- 22 seeded authorities/agencies: official identities with recorded source links,
  and candidates clearly kept in a separate verification state.
- 30 classification definitions spanning levels, food, equipment, milk, meat,
  baking, cooking, Passover, produce, supervision scope and other attributes.
- Five registered sources used by the previous manual imports. Publisher and
  agency are separate fields. All are marked `manual_import`, not active scanners.
- A review queue automatically created when an agency/source is added or changed
  to `candidate` or `needs_review`. Initially 12 open reviews.
- Create and edit forms, text search, state/category filters, inactive states,
  decision notes and a history of the last 50 changes.
- Verified identities/sources require documented evidence and an official URL.
  Review completion requires a decision and is attributed to the current manager.
  Resolving a review does not silently mark the subject verified.

## Access and safeguards

Management requires a Supabase Auth user verified by `auth.getUser()` and an
explicit row in `weig_kashrut_managers`. Anonymous accounts are denied. Membership
can only be provisioned by the project owner/backend; users cannot enroll
 themselves. The user selected the existing sole project account for management.
No account identifiers or emails are committed in the migration.

The HTTP route and all database tables enforce authorization independently.
Signed-out users cannot read the registry. Ordinary signed-in users see no rows
and cannot write. Managers may create/edit records; hard deletion and client audit
writes are denied. Audit triggers run in the private schema with a fixed search
path and no API execution privileges. Record versions reject stale HTTP updates.
Mutation requests require the same Origin as the application and JSON input.
No service-role credentials were added to the application.

## Validation

- API/validation tests cover sign-in, membership, untrusted metadata, cross-origin
  writes, evidence requirements, unsafe URLs, country code shapes and decisions.
- UI flow tests cover login gates, source creation linked to an agency, and
  preserving edits on a version conflict.
- `supabase/tests/kashrut-management-access.sql` exercises actual PostgreSQL RLS,
  non-manager/anonymous denial, self-provisioning denial, manager edits, automatic
  review creation, attribution, immutable audit access and version conflicts.
  All test changes are rolled back.
- Supabase advisors reported no new management-registry warnings; preexisting
  project notices are outside this change.

## Remaining phases

Agency relationships and scoped recognition, source adapters, ingestion runs,
change/bancellation tracking, certificate processing and regional coverage are
not implemented by this first registry milestone. Classification definitions are
not themselves business-level claims. Seed country lists are partial known
activity, not exhaustive operating footprints. The management UI currently uses
Hebrew labels, including when its route is opened under the English locale.
