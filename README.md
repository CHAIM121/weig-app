# WEIG — Milestone 1 foundation

A clean Next.js App Router foundation created for this repository. No code, configuration, credentials, database connection, or assets were copied from an earlier project.

## Milestone 1 scope

- Strict TypeScript, Tailwind CSS, mobile-first Hebrew (`he`, default/RTL) and English (`en`, LTR) shells.
- Typed translations; four real entry routes: `places`, `expenses`, `calls`, and `ai`.
- Accessible loading, empty, error, offline, and unavailable-provider presentations (preview with `?state=loading|empty|error|offline|provider`).
- Independent module boundaries and provider contracts. Places, telephony, and AI adapters are deliberately **unavailable** until approved providers are configured. Expenses has no external provider.
- Browser/server Supabase clients use only public environment configuration. Google and email OTP UI/flow boundaries remain deliberately disabled until Hayim supplies a new project URL and public anon key.
- A new, unapplied initial schema with deny-by-default RLS. It must only be run against a new local/test project after review.

Milestone 1 is **not declared complete** until build, unit tests, RTL/LTR, responsive behavior, auth/RLS integration, and browser/server console errors are verified in the approved target environment.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run test:rls
```

Open `/` to redirect to the Hebrew places screen, or use `/en/places`. Resize through mobile and desktop widths when reviewing responsive behavior.

## Environment

Copy `.env.example` to `.env.local`. Variables prefixed `NEXT_PUBLIC_` are public and may be bundled into browser code; only the project URL and public anon key belong there. `SUPABASE_TEST_*` variables are server-only and reserved for local/test RLS automation. Never add a service-role key to client code or commit real values.

No Supabase project is connected and the migration has not been applied. Auth stays in configuration-missing mode until a newly approved URL and public key are available.

## Architecture boundaries

Feature code lives under `src/modules/<feature>`. UI imports contracts or module public APIs only; provider/database implementation details stay behind those boundaries. `src/lib/supabase/browser.ts` and `server.ts` intentionally separate browser and server creation. Disabled adapters return the explicit `PROVIDER_UNAVAILABLE` result and never fabricate records.

## Preview deployment on Vercel

The current UI can be deployed and viewed without Supabase or provider credentials. It is a runnable Milestone 1 foundation rather than a connected product: navigation, localization, directionality, responsive layout, and every system-state preview work, while real data, sign-in, and provider operations remain intentionally unavailable.

1. Import this repository into Vercel and keep the detected **Next.js** framework preset.
2. Use `npm run build` as the build command; no environment variables are required for the UI-only preview.
3. Do **not** add old Supabase values. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` only after the new project is approved.
4. Visit `/he/places` for Hebrew or `/en/places` for English. Add `?state=loading`, `empty`, `error`, `offline`, or `provider` to review each state.

A successful Vercel build is still required before treating the preview as verified. Provider-backed features and authentication are not expected to work in this preview.

## Milestone 2 interface preview

The four product modules now have complete local, interactive UI previews. Authentication opens first at `/he/auth`; after a future successful authentication the intended landing route is `/he/places`. For design review without a connected auth provider, module URLs can be opened directly.

- **Places:** natural-language search, current-location/destination distinction, categories, clearly labelled demo result cards, and place detail dialog.
- **Expenses:** total and item views, personal/shared distinction, locally interactive add-expense flow, participant split calculation, and settlement presentation.
- **Calls:** phone input, interactive keypad, recent-calls empty state, and explicit disconnected-provider messaging without invented telephony behavior.
- **AI:** full-height conversation workspace, new/history architecture, local conversation continuation, permission and personalization explanations, and explicit disconnected behavior.

All demonstration records are presentation fixtures in the translation dictionaries and are explicitly labelled as demo content. They are never represented as provider results or production records.
