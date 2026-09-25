#!/usr/bin/env node
/**
 * smartConsulting Zauner workspace seed — scripts/seed-smartconsulting.mjs
 *
 * What it does: Bootstraps a fresh Quiver deployment for smartConsulting
 *   Zauner without clicking through /setup:
 *     1. (optional) creates or finds the admin's Supabase Auth user and gives
 *        it an admin row in team_members
 *     2. writes the marketing context from seed/smartconsulting-zauner.json as
 *        a new active context version (same versioning as createContextVersion
 *        in lib/db/context.ts, so the in-app history and restore keep working)
 *     3. creates the default "Unassigned" campaign plus the start campaigns
 *
 * What it reads from: seed/smartconsulting-zauner.json, DATABASE_URL, and for
 *   --admin-email also NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 *   Values are taken from the environment, then .env.local, then .env.
 *
 * Usage:
 *   npm run seed:smartconsulting -- [--dry-run] [--force]
 *     [--admin-email <email>] [--admin-name <name>] [--file <path>]
 *
 * Edge cases:
 *   - Idempotent: an existing active context is left alone unless --force is
 *     given (then a new version is added on top; older versions stay
 *     restorable). Campaigns are matched by name and never duplicated.
 *   - A newly created admin gets a random password that is printed exactly
 *     once. An existing Supabase user keeps its password.
 *   - --dry-run performs lookups only and writes nothing.
 */

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as util from 'node:util';

const DEFAULT_CAMPAIGN_NAME = 'Unassigned'; // mirrors DEFAULT_CAMPAIGN_NAME in types/index.ts
const DEFAULT_SEED_FILE = 'seed/smartconsulting-zauner.json';

// ---------------------------------------------------------------------------
// Environment and arguments
// ---------------------------------------------------------------------------

function loadEnvFiles(files) {
  for (const file of files) {
    if (!existsSync(file)) continue;
    const parsed = util.parseEnv(readFileSync(file, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      // Real environment variables win over file values, like Next.js does.
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const { values } = util.parseArgs({
    args: argv,
    options: {
      'dry-run': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      'admin-email': { type: 'string' },
      'admin-name': { type: 'string' },
      file: { type: 'string', default: DEFAULT_SEED_FILE },
    },
    strict: true,
  });
  return {
    dryRun: values['dry-run'],
    force: values.force,
    adminEmail: values['admin-email']?.trim().toLowerCase(),
    adminName: values['admin-name']?.trim(),
    file: values.file,
  };
}

function readSeedFile(path) {
  const seed = JSON.parse(readFileSync(resolve(path), 'utf8'));
  if (!seed.context || typeof seed.context.positioningStatement !== 'string') {
    throw new Error(`${path}: "context.positioningStatement" fehlt`);
  }
  if (!seed.context.changeSummary) {
    throw new Error(`${path}: "context.changeSummary" fehlt`);
  }
  return seed;
}

// ---------------------------------------------------------------------------
// Admin user (Supabase Auth + team_members)
// ---------------------------------------------------------------------------

async function findAuthUserByEmail(admin, email) {
  const perPage = 200;
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Supabase listUsers fehlgeschlagen: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < perPage) return null;
  }
}

async function ensureAdmin(prisma, { email, name, dryRun }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      '--admin-email braucht NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const displayName = name || email.split('@')[0];
  let user = await findAuthUserByEmail(admin, email);
  let password = null;

  if (!user) {
    if (dryRun) {
      console.log(`[dry-run] Würde Supabase-Login für ${email} anlegen (Rolle admin).`);
      return null;
    }
    password = randomBytes(18).toString('base64url');
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: displayName, role: 'admin' },
    });
    if (error || !data.user) {
      throw new Error(`Supabase-Login konnte nicht angelegt werden: ${error?.message ?? 'kein User'}`);
    }
    user = data.user;
  }

  const existingByEmail = await prisma.teamMember.findUnique({ where: { email } });
  if (existingByEmail && existingByEmail.id !== user.id) {
    throw new Error(
      `team_members enthält ${email} bereits mit einer anderen ID (${existingByEmail.id}). Bitte in den Einstellungen bereinigen.`
    );
  }

  if (dryRun) {
    console.log(`[dry-run] Würde ${email} (${user.id}) als admin in team_members eintragen.`);
    return user.id;
  }

  await prisma.teamMember.upsert({
    where: { id: user.id },
    update: { role: 'admin', email },
    create: { id: user.id, email, name: displayName, role: 'admin' },
  });

  console.log(`✓ Admin: ${email} (${user.id})`);
  if (password) {
    console.log('  Neuer Login angelegt. Passwort (wird nur jetzt angezeigt, sicher ablegen):');
    console.log(`  ${password}`);
  }
  return user.id;
}

// ---------------------------------------------------------------------------
// Context version
// ---------------------------------------------------------------------------

async function seedContext(prisma, context, { updatedBy, force, dryRun }) {
  const active = await prisma.contextVersion.findFirst({
    where: { isActive: true },
    select: { id: true, version: true },
  });

  if (active && !force) {
    console.log(
      `• Aktiver Kontext v${active.version} existiert bereits, nichts geändert (mit --force als neue Version anlegen).`
    );
    return active.id;
  }

  const latest = await prisma.contextVersion.findFirst({
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  if (dryRun) {
    console.log(`[dry-run] Würde Kontext v${nextVersion} anlegen und aktivieren.`);
    return active?.id ?? null;
  }

  // Same transaction shape as createContextVersion() in lib/db/context.ts.
  const created = await prisma.$transaction(async (tx) => {
    await tx.contextVersion.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    return tx.contextVersion.create({
      data: {
        version: nextVersion,
        isActive: true,
        positioningStatement: context.positioningStatement,
        icpDefinition: context.icpDefinition ?? undefined,
        messagingPillars: context.messagingPillars ?? undefined,
        competitiveLandscape: context.competitiveLandscape ?? undefined,
        customerLanguage: context.customerLanguage ?? undefined,
        proofPoints: context.proofPoints ?? undefined,
        activeHypotheses: context.activeHypotheses ?? undefined,
        brandVoice: context.brandVoice ?? null,
        wordsToUse: context.wordsToUse ?? [],
        wordsToAvoid: context.wordsToAvoid ?? [],
        updatedBy,
        updateSource: 'manual',
        changeSummary: context.changeSummary,
      },
    });
  });

  console.log(`✓ Kontext v${created.version} angelegt und aktiviert.`);
  return created.id;
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

async function seedCampaigns(prisma, campaigns, { contextVersionId, ownerId, dryRun }) {
  const all = [
    {
      name: DEFAULT_CAMPAIGN_NAME,
      description:
        'Default campaign for sessions and artifacts not yet assigned to a campaign.',
      status: 'active',
      priority: 'low',
      channels: [],
      isDefault: true,
    },
    ...campaigns,
  ];

  for (const campaign of all) {
    const existing = await prisma.campaign.findFirst({
      where: { name: campaign.name },
      select: { id: true },
    });
    if (existing) {
      console.log(`• Kampagne „${campaign.name}“ existiert bereits.`);
      continue;
    }
    if (dryRun) {
      console.log(`[dry-run] Würde Kampagne „${campaign.name}“ anlegen.`);
      continue;
    }
    await prisma.campaign.create({
      data: {
        name: campaign.name,
        description: campaign.description ?? null,
        goal: campaign.goal ?? null,
        channels: campaign.channels ?? [],
        status: campaign.status ?? 'planning',
        priority: campaign.priority ?? 'medium',
        links: campaign.links ?? undefined,
        ownerId: campaign.isDefault ? null : ownerId,
        contextVersionId: campaign.isDefault ? null : contextVersionId,
      },
    });
    console.log(`✓ Kampagne „${campaign.name}“ angelegt.`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  loadEnvFiles(['.env.local', '.env']);
  const args = parseArgs(process.argv.slice(2));
  const seed = readSeedFile(args.file);

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL ist nicht gesetzt (Umgebung, .env.local oder .env).');
  }

  const { default: prismaPkg } = await import('@prisma/client');
  const prisma = new prismaPkg.PrismaClient();

  try {
    console.log(
      `Seed für ${seed.workspace?.name ?? 'Workspace'}${args.dryRun ? ' (dry-run, es wird nichts geschrieben)' : ''}\n`
    );

    const adminId = args.adminEmail
      ? await ensureAdmin(prisma, {
          email: args.adminEmail,
          name: args.adminName,
          dryRun: args.dryRun,
        })
      : null;

    const contextVersionId = await seedContext(prisma, seed.context, {
      updatedBy: adminId ?? 'seed:smartconsulting',
      force: args.force,
      dryRun: args.dryRun,
    });

    await seedCampaigns(prisma, seed.campaigns ?? [], {
      contextVersionId,
      ownerId: adminId,
      dryRun: args.dryRun,
    });

    if (!args.adminEmail) {
      const admins = await prisma.teamMember.count({ where: { role: 'admin' } });
      if (admins === 0) {
        console.log(
          '\nHinweis: Es gibt noch keinen Admin. Erneut ausführen mit --admin-email <deine@adresse>, sonst landet der erste Login auf /access-denied.'
        );
      }
    }

    console.log('\nFertig.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
