-- Quiver on Supabase Postgres (instead of Neon)
--
-- Run once in the Supabase SQL editor of the project that should hold Quiver.
-- The app data lives in its own schema `quiver`, owned by a dedicated login role,
-- so it cannot touch other tables in the same project and is not exposed through
-- the Supabase Data API.
--
-- Steps:
--   1. Part 1 below (replace <PASSWORD> with a long random alphanumeric value).
--   2. Apply the Prisma migrations as quiver_app, e.g. locally with
--        DIRECT_URL="postgresql://quiver_app.<ref>:<PASSWORD>@<pooler-host>:5432/postgres?schema=quiver" \
--        npx prisma migrate deploy
--   3. Part 2 below (needs the tables from step 2).
--
-- App connection strings (Project Settings -> Database -> Connection pooling
-- shows the pooler host):
--   DATABASE_URL = postgresql://quiver_app.<ref>:<PASSWORD>@<pooler-host>:6543/postgres?schema=quiver&pgbouncer=true&connection_limit=1
--   DIRECT_URL   = postgresql://quiver_app.<ref>:<PASSWORD>@<pooler-host>:5432/postgres?schema=quiver
-- lib/middleware-db.ts detects the Supabase host and uses the functions from Part 2.

-- ---------------------------------------------------------------------------
-- Part 1: role and schema
-- ---------------------------------------------------------------------------
create role quiver_app login password '<PASSWORD>';
grant quiver_app to postgres;
create schema if not exists quiver authorization quiver_app;
alter role quiver_app set search_path = quiver;

-- ---------------------------------------------------------------------------
-- Part 2: membership checks for the Edge middleware
-- ---------------------------------------------------------------------------
-- The middleware calls these over PostgREST with the signed-in user's session.
-- They only reveal whether the caller is a team member and whether a context
-- exists, never table contents.
create or replace function public.quiver_is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from quiver.team_members where id = auth.uid()::text);
$$;

create or replace function public.quiver_has_active_context()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from quiver.context_versions where "isActive");
$$;

revoke all on function public.quiver_is_member() from public, anon;
revoke all on function public.quiver_has_active_context() from public, anon;
grant execute on function public.quiver_is_member() to authenticated;
grant execute on function public.quiver_has_active_context() to authenticated;
