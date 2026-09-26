/**
 * Edge-compatible DB helpers for middleware.
 *
 * What it does: Runs the two read-only checks the middleware needs
 *   (membership check, active-context check). Prisma's standard engine doesn't
 *   run on the Next.js Edge runtime, so middleware can't import `lib/db/*`.
 *   Two backends are supported, chosen from the DATABASE_URL host:
 *   - Neon: queries `team_members` / `context_versions` through Neon's
 *     HTTP-based serverless driver.
 *   - Supabase: calls the SECURITY DEFINER functions `quiver_is_member()` and
 *     `quiver_has_active_context()` over PostgREST with the signed-in user's
 *     session (see supabase/quiver-supabase.sql). Supabase Postgres has no
 *     HTTP SQL endpoint, and the app tables are not exposed through the API.
 *
 * What it reads from: `team_members.id`, `context_versions."isActive"`.
 *
 * Edge cases:
 *   - Connection pool: `@neondatabase/serverless` uses HTTP, so every query
 *     is an independent request — no pool, no long-lived connection.
 *   - `contextQueryFailed`: callers should treat a thrown error from
 *     `hasActiveContext` as query-failure (do not lock the user out).
 *     `isTeamMember` returns `false` on any error, matching prior behavior.
 *   - Supabase mode without a client (should not happen in middleware) fails
 *     closed the same way as a query error.
 */

import { neon } from '@neondatabase/serverless';

type SqlClient = ReturnType<typeof neon>;

/** The slice of a Supabase client the Supabase backend needs. */
export interface RpcClient {
  rpc(fn: string): PromiseLike<{ data: unknown; error: unknown }>;
}

let cached: SqlClient | null = null;

function getClient(): SqlClient {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  cached = neon(url);
  return cached;
}

/** True when DATABASE_URL points at a Supabase-hosted Postgres. */
export function usesSupabaseDatabase(url = process.env.DATABASE_URL): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host.endsWith('.supabase.com') || host.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

async function callRpc(supabase: RpcClient | undefined, fn: string): Promise<boolean> {
  if (!supabase) throw new Error(`Supabase client required for ${fn}`);
  const { data, error } = await supabase.rpc(fn);
  if (error) throw new Error(`${fn} failed: ${JSON.stringify(error)}`);
  return data === true;
}

export async function isTeamMember(userId: string, supabase?: RpcClient): Promise<boolean> {
  try {
    if (usesSupabaseDatabase()) {
      // The function checks auth.uid(), i.e. the user behind the session.
      return await callRpc(supabase, 'quiver_is_member');
    }
    const sql = getClient();
    const rows = (await sql`SELECT id FROM team_members WHERE id = ${userId} LIMIT 1`) as Array<{ id: string }>;
    return rows.length > 0;
  } catch (err) {
    // Match the failure mode the previous Supabase query had: log and fail
    // closed (non-member), so the user lands on /access-denied or /setup
    // rather than silently bypassing auth.
    console.error('[middleware-db] isTeamMember query failed', err);
    return false;
  }
}

/**
 * Returns `{ exists, failed }`. `failed=true` signals the query errored so
 * the caller can distinguish "no active context" (legit first-run) from
 * "database unreachable" (don't redirect to /setup on a transient failure).
 */
export async function hasActiveContext(
  supabase?: RpcClient
): Promise<{ exists: boolean; failed: boolean }> {
  try {
    if (usesSupabaseDatabase()) {
      return { exists: await callRpc(supabase, 'quiver_has_active_context'), failed: false };
    }
    const sql = getClient();
    const rows = (await sql`SELECT id FROM context_versions WHERE "isActive" = true LIMIT 1`) as Array<{ id: string }>;
    return { exists: rows.length > 0, failed: false };
  } catch (err) {
    console.error('[middleware-db] hasActiveContext query failed', err);
    return { exists: false, failed: true };
  }
}
