/**
 * Tests for lib/middleware-db.ts — Edge-compatible Neon queries used
 * by middleware.ts for membership + active-context checks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture the tag function the module creates per-call.
const sqlMock = vi.fn();

vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => sqlMock),
}));

// Import AFTER the mock is registered.
import { isTeamMember, hasActiveContext } from '@/lib/middleware-db';

beforeEach(() => {
  sqlMock.mockReset();
  process.env.DATABASE_URL = 'postgres://test';
});

describe('isTeamMember', () => {
  it('returns true when Neon returns a row', async () => {
    sqlMock.mockResolvedValueOnce([{ id: 'u1' }]);
    await expect(isTeamMember('u1')).resolves.toBe(true);
  });

  it('returns false when Neon returns no rows', async () => {
    sqlMock.mockResolvedValueOnce([]);
    await expect(isTeamMember('u1')).resolves.toBe(false);
  });

  it('returns false on query error (fails closed, not open)', async () => {
    sqlMock.mockRejectedValueOnce(new Error('connection refused'));
    await expect(isTeamMember('u1')).resolves.toBe(false);
  });
});

describe('hasActiveContext', () => {
  it('reports exists=true when active context row returned', async () => {
    sqlMock.mockResolvedValueOnce([{ id: 'ctx1' }]);
    await expect(hasActiveContext()).resolves.toEqual({ exists: true, failed: false });
  });

  it('reports exists=false, failed=false on empty result (legit first-run)', async () => {
    sqlMock.mockResolvedValueOnce([]);
    await expect(hasActiveContext()).resolves.toEqual({ exists: false, failed: false });
  });

  it('reports failed=true on query error so middleware does not send user to /setup', async () => {
    sqlMock.mockRejectedValueOnce(new Error('timeout'));
    await expect(hasActiveContext()).resolves.toEqual({ exists: false, failed: true });
  });
});

describe('Supabase backend (DATABASE_URL on supabase.com)', () => {
  const rpc = vi.fn();
  const client = { rpc };

  beforeEach(() => {
    rpc.mockReset();
    process.env.DATABASE_URL =
      'postgresql://quiver_app.ref:pw@aws-1-eu-west-1.pooler.supabase.com:6543/postgres';
  });

  it('asks quiver_is_member() instead of querying Neon', async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    await expect(isTeamMember('u1', client)).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('quiver_is_member');
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('fails closed on an RPC error or a missing client', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'permission denied' } });
    await expect(isTeamMember('u1', client)).resolves.toBe(false);
    await expect(isTeamMember('u1')).resolves.toBe(false);
  });

  it('reports the active context from quiver_has_active_context()', async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(hasActiveContext(client)).resolves.toEqual({ exists: false, failed: false });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    await expect(hasActiveContext(client)).resolves.toEqual({ exists: false, failed: true });
  });
});
