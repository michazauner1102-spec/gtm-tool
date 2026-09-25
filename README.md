# gtm-tool · Quiver für smartConsulting Zauner

Dieses Repository ist die Quiver-Instanz von [smartConsulting Zauner](https://www.smartconsultingzauner.com): ein selbst gehostetes KI-Marketing-Cockpit, in dem jede KI-Session mit Positionierung, Zielgruppe, Messaging und bisherigen Ergebnissen von smartConsulting startet. Basis ist das Open-Source-Projekt [Quiver](https://www.quivergtm.dev) ([tessak22/quiver](https://github.com/tessak22/quiver), MIT-Lizenz).

## Was für smartConsulting eingerichtet ist

- **Marketing-Kontext** in [`seed/smartconsulting-zauner.json`](seed/smartconsulting-zauner.json): Positionierung (KI-Automatisierung für inhabergeführte Makler im DACH-Raum), ICP mit Kaufsignalen, sechs Messaging-Säulen, Wettbewerb, Proof Points, Hypothesen, Tonalität (Du-Form, keine erfundenen Zahlen, UWG-Hinweis) und Standard-CTAs.
- **Start-Kampagnen:** Sichtbarkeits-Audits (Türöffner), Outreach KI-Vorqualifizierung, Instagram, Skool-Community, Website News & Trends.
- **Seed-Skript** `npm run seed:smartconsulting`: legt Kontext, Kampagnen und optional den Admin-Login an, ohne das Onboarding-Formular.
- **Zusätzliche Kanäle** für Content-Distribution: Instagram, Facebook, Skool.
- **KI-Modell** `claude-sonnet-5` (das ursprüngliche `claude-sonnet-4-20250514` ist seit 15.06.2026 abgeschaltet).

## Einrichtung (ca. 30 Minuten)

1. **Neon-Datenbank anlegen**, am einfachsten in Vercel unter *Storage → Neon*. Daraus kommen `DATABASE_URL` (pooled) und `DIRECT_URL` (direkt). Quiver braucht Neon, weil die Middleware über Neons HTTP-Treiber prüft, wer Zugriff hat.
2. **Supabase-Projekt anlegen** (nur für den Login): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. **Anthropic-API-Key** unter [console.anthropic.com](https://console.anthropic.com/settings/keys) erzeugen: `ANTHROPIC_API_KEY`.
4. **Secrets erzeugen** (jeweils `openssl rand -base64 32`): `QUIVER_SHARE_SECRET`, `MCP_AUTH_SECRET`, `CRON_SECRET`. `MCP_AUTH_SECRET` ist Pflicht, sonst ist `/api/mcp` samt Schreibzugriff offen im Netz.
5. **Vercel-Projekt** aus diesem Repo importieren, alle Variablen aus [`.env.example`](.env.example) eintragen, `NEXT_PUBLIC_APP_URL` auf die spätere Adresse setzen (z. B. `https://gtm.smartconsultingzauner.com` als CNAME auf Vercel).
6. **Lokal Datenbank einrichten** (Werte in `.env.local`):
   ```bash
   npm ci
   npx prisma migrate deploy
   npm run seed:smartconsulting -- --admin-email michazauner@smartconsultingzauner.com --admin-name "Micha Zauner"
   ```
   Das Skript gibt für einen neu angelegten Login einmalig ein Passwort aus. Mit `--dry-run` zeigt es vorher nur an, was passieren würde. Ein erneuter Lauf ändert nichts Bestehendes; `--force` legt den Kontext als neue Version an (alte Versionen bleiben wiederherstellbar).
7. **Einloggen** und unter *Context* den Kontext prüfen und nachschärfen. Jede Änderung wird versioniert.

## Arbeiten mit Quiver

- **Sessions:** *Strategy* für Positionierung und Kampagnen, *Create* für Texte (Kaltakquise-Mail, Social Posts, Landingpage …), *Feedback* für Gesprächsnotizen, *Analyze* und *Optimize* für Ergebnisse und bestehende Texte. Die Ausgaben sind deutsch, weil der Kontext es so vorgibt.
- **Research:** Notizen aus Erstgesprächen und Audits einfügen. Quiver extrahiert Zitate und schlägt Kontext-Updates vor; die Kundenstimmen fehlen im Kontext bisher bewusst.
- **Performance:** Ergebnisse loggen (Antwortquoten, gebuchte Gespräche, Reichweite). Erst belegte Zahlen dürfen in Texte.
- **Website:** Veröffentlichte Inhalte liefert `GET /api/public/content` aus, z. B. für die Seite *News & Trends* auf smartconsultingzauner.com.
- **Claude-Anbindung:** `https://<deine-domain>/api/mcp` als Connector mit `Authorization: Bearer <MCP_AUTH_SECRET>` eintragen.

## Updates aus dem Original-Projekt holen

```bash
git fetch upstream && git merge upstream/main
```

(`upstream` zeigt auf `https://github.com/tessak22/quiver.git`; in einem frischen Klon vorher `git remote add upstream https://github.com/tessak22/quiver.git`.)

---

*Die ursprüngliche Quiver-Dokumentation folgt unverändert.*

# Quiver

Quiver is an open-source, self-hosted, AI-powered marketing command center for product teams. Every session starts with your actual positioning, ICP, messaging, and past results, so outputs improve as your team logs more work.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftessak22%2Fquiver&env=DATABASE_URL,DIRECT_URL,NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,ANTHROPIC_API_KEY,NEXT_PUBLIC_APP_URL,QUIVER_SHARE_SECRET)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Feature Overview

Quiver includes:

- **Marketing context system** with version history and proposal review workflow
- **Five AI session modes** (Strategy, Create, Feedback, Analyze, Optimize) with skill loading
- **Artifact library** with versioning, status workflow, and campaign linking
- **Campaign workspace** tying sessions, artifacts, content, research, and performance together
- **Performance log** with close-the-loop queue and context update proposals
- **Content layer** with markdown body, SEO/OG metadata, distribution tracking, and metric snapshots
- **Customer research layer** with async AI processing, quote extraction, and VoC quote library
- **MCP server access** over stdio (`mcp/`) and HTTP (`/api/mcp`) for external AI clients
- **Public Content API** for website pulls from Quiver as source of truth
- **Light/dark mode** with persisted user preference

---

## Self-Hosting (30 minutes)

1. **Fork** this repo
2. **Create a [Supabase](https://supabase.com) project**
3. **Get an [Anthropic API key](https://console.anthropic.com/settings/keys)**
4. **Deploy to Vercel** with the button above
5. **Run Prisma migration** against your database:
   ```bash
   npx prisma migrate deploy
   ```
6. **Visit your deployment URL** and complete onboarding

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string (pooled) |
| `DIRECT_URL` | Yes | Direct DB connection for Prisma migrations |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only Supabase service role key |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key |
| `NEXT_PUBLIC_APP_URL` | Yes | App URL (`https://...` or `http://localhost:3000`) |
| `QUIVER_SHARE_SECRET` | Yes | Secret for session share links (`openssl rand -base64 32`) |
| `MCP_AUTH_SECRET` | No | Optional Bearer auth for `/api/mcp` |
| `TABSTACK_API_KEY` | No | Reserved for Issue #50 content import (not implemented in this checkout) |

---

## Content API

Published content is available from Quiver via a public, unauthenticated API:

```txt
GET /api/public/content/[slug]   # single published piece with markdown body + SEO/OG
GET /api/public/content          # paginated list of published pieces
```

Query params for list endpoint:

- `contentType` (optional)
- `limit` (default `20`, max `50`)
- `offset` (default `0`)

Both endpoints are rate-limited to `60` requests/minute per IP (in-memory limiter per app instance).

Use this API at build time or runtime in your website. Quiver stays the source of truth.

---

## MCP Server

Quiver ships with an MCP server that exposes the full product surface as tools for Claude Desktop, Cursor, Windsurf, and other MCP-compatible clients.

### Why this matters

A better-informed Claude instance (project memory + connected services + Quiver MCP tools) can log performance, save research, update context, and manage content directly, while Quiver remains the storage and tracking system.

### Build (stdio server)

```bash
cd mcp
npm install
npx prisma generate
npm run build
```

### Claude Desktop config (stdio)

```json
{
  "mcpServers": {
    "quiver": {
      "command": "node",
      "args": ["/absolute/path/to/quiver/mcp/dist/index.js"],
      "env": {
        "DATABASE_URL": "your-supabase-connection-string"
      }
    }
  }
}
```

> **Note:** `ANTHROPIC_API_KEY` is optional for the stdio server. The only tool that uses it is `log_performance` — it runs AI synthesis after logging results to propose context updates. Without the key, `log_performance` still works but skips synthesis.

### Cursor config (stdio)

```json
{
  "mcpServers": {
    "quiver": {
      "command": "node",
      "args": ["/absolute/path/to/quiver/mcp/dist/index.js"],
      "env": {
        "DATABASE_URL": "your-supabase-connection-string"
      }
    }
  }
}
```

### Remote HTTP connector (`/api/mcp`)

Quiver also includes a Streamable HTTP MCP endpoint in the Next.js app:

```txt
https://<your-domain>/api/mcp
```

- Set `MCP_AUTH_SECRET` to require `Authorization: Bearer <secret>`
- Without `MCP_AUTH_SECRET`, endpoint allows requests (safe only for private/internal deployments)

### Tool domains

Context:
- `get_context`, `get_context_history`, `propose_context_update`, `apply_context_update`, `restore_context_version`

Campaigns:
- `list_campaigns`, `get_campaign`, `create_campaign`, `update_campaign`, `update_campaign_status`

Artifacts:
- `list_artifacts`, `get_artifact`, `save_artifact`, `update_artifact`, `update_artifact_status`

Performance:
- `log_performance`, `get_performance_log`, `get_close_the_loop_queue`, `list_proposals`, `action_proposal`

Content:
- `list_content`, `get_content`, `save_content`, `update_content`, `add_distribution`, `log_content_metrics`, `get_content_metrics`, `get_content_calendar`

Research:
- `list_research_entries`, `get_research_entry`, `save_research_entry`, `list_quotes`, `get_linear_payload`

Sessions:
- `list_sessions`, `get_session`

Workspace:
- `get_dashboard_summary`

### `propose_context_update` vs `apply_context_update`

- **`propose_context_update`**: creates a pending proposal for human review
- **`apply_context_update`**: applies changes immediately and creates a new context version

Use `apply_context_update` only when the user explicitly asks for immediate change.

---

## Skills System

Quiver loads static markdown skills from `/skills` (pinned from `coreyhaines31/marketingskills`).

- Skills are loaded at session start from disk
- Feedback mode uses `customer-research`
- Create mode skill selection depends on artifact type
- Admins can update to newer pinned skill versions from Settings

See `lib/ai/skills.ts` for exact mapping.

---

## System Prompt Assembly

Each session prompt is assembled from:

1. Role definition
2. Active product context
3. Loaded skill content
4. Performance history (create mode)
5. Featured customer quotes (create + strategy)
6. Published content context (create + strategy)
7. Mode instructions
8. Output instructions

See `lib/ai/session.ts`.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14, App Router |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS |
| Components | shadcn/ui + Radix UI |
| Database | Supabase (Postgres) |
| ORM | Prisma |
| Auth | Supabase Auth |
| AI | Anthropic SDK |
| Testing | Vitest |
| Deployment | Vercel |

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for local setup, branch naming, and PR checklist.

Good first contributions:

1. Rich text editing experience for Content body
2. Additional MCP tool domains
3. New session modes and mode-specific UX
4. Expanded artifact-type to skill routing
5. Content import implementation for Issue #50 (`TABSTACK_API_KEY`, import endpoint, UI)

---

## Documentation

- Product specification: [`SPEC.md`](SPEC.md)
- Agent instructions: [`CLAUDE.md`](CLAUDE.md), [`AGENTS.md`](AGENTS.md)
- Build prompt context: [`PROMPT.md`](PROMPT.md)

---

## License

[MIT](LICENSE)

---

Built with the [marketingskills](https://github.com/coreyhaines31/marketingskills) framework.
