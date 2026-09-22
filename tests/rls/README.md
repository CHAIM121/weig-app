# RLS checks

`npm run test:rls` always performs static deny-by-default/policy guards. For integration verification, start a clean local Supabase instance, apply migrations with `supabase db reset`, and execute the same suite after setting `SUPABASE_TEST_URL` and `SUPABASE_TEST_ANON_KEY`. Never point these checks at an existing production project.
