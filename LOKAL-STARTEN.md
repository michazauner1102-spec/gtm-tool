# Quiver lokal starten (localhost)

Anleitung, um das smartConsulting-Quiver auf deinem eigenen Rechner unter
http://localhost:3000 laufen zu lassen. Dauer: etwa 20 Minuten, das meiste
davon für die drei Konten.

## Was du brauchst

- **Node.js 20 oder neuer** (am besten die LTS-Version von https://nodejs.org) und **Git**
- Ein kostenloses **Neon**-Konto (Datenbank): https://neon.tech
- Ein **Supabase**-Projekt (nur für den Login): https://supabase.com
- Einen **Anthropic-API-Key** (für die KI): https://console.anthropic.com/settings/keys

Die App braucht Neon auch lokal: Die Zugriffsprüfung läuft über Neons
HTTP-Treiber, eine normale lokale Postgres-Datenbank funktioniert dafür nicht.

## 1. Code holen

```bash
git clone https://github.com/michazauner1102-spec/gtm-tool.git
cd gtm-tool
git checkout claude/kind-wozniak-4dzpca
npm ci
```

## 2. Neon-Datenbank anlegen

1. In Neon **New Project** anlegen, Region **Frankfurt (eu-central-1)**.
2. Im Projekt auf **Connect** klicken.
3. Den Connection String **mit** „Connection pooling“ kopieren, er wird `DATABASE_URL`.
4. „Connection pooling“ ausschalten und den zweiten String kopieren, er wird `DIRECT_URL`.

## 3. Supabase-Projekt für den Login

1. In Supabase **New project** anlegen (Region Frankfurt). Im Free-Plan sind
   zwei aktive Projekte erlaubt; ist das Limit erreicht, ein altes Projekt pausieren.
2. Unter **Project Settings → API** kopieren:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (geheim halten)
3. Unter **Authentication → URL Configuration** die Site URL auf
   `http://localhost:3000` setzen.

## 4. Konfigurationsdatei `.env` anlegen

Die Datei heißt bewusst `.env` (nicht `.env.local`), weil auch die
Datenbank-Befehle von Prisma nur `.env` lesen. Sie wird nicht mit hochgeladen.

```bash
cp .env.example .env        # Windows: copy .env.example .env
```

Dann `.env` im Editor öffnen und ausfüllen:

```ini
DATABASE_URL=postgresql://...-pooler...neon.tech/neondb?sslmode=require
DIRECT_URL=postgresql://...neon.tech/neondb?sslmode=require
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
QUIVER_SHARE_SECRET=<zufälliger Wert>
```

Einen zufälligen Wert erzeugst du auf jedem System mit:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`MCP_AUTH_SECRET` und `CRON_SECRET` können lokal leer bleiben.

## 5. Datenbank einrichten und smartConsulting-Daten laden

```bash
npx prisma migrate deploy
npm run seed:smartconsulting -- --admin-email michazauner@smartconsultingzauner.com --admin-name "Micha Zauner"
```

Das Skript legt deinen Login, den Marketing-Kontext und die Start-Kampagnen an.
Für einen neuen Login gibt es **einmalig ein Passwort** aus, das du dir
notierst. Gab es den Login in Supabase schon, bleibt dein bisheriges Passwort.

## 6. Starten

```bash
npm run dev
```

Dann http://localhost:3000 öffnen und mit E-Mail und Passwort aus Schritt 5
einloggen. Unter **Context** siehst du den smartConsulting-Kontext, unter
**Sessions** startest du die erste KI-Session.

## Wenn etwas nicht klappt

| Problem | Lösung |
|---|---|
| Nach dem Login „Access denied“ | Schritt 5 mit `--admin-email` ausführen (gleiche E-Mail wie beim Login), dann neu einloggen. |
| `DATABASE_URL ist nicht gesetzt` | Die Datei muss `.env` heißen und im Ordner `gtm-tool` liegen. |
| Seite leitet ständig auf `/setup` | Der Kontext fehlt: `npm run seed:smartconsulting` ausführen. |
| KI antwortet mit „Invalid Anthropic API key“ | `ANTHROPIC_API_KEY` in `.env` prüfen und `npm run dev` neu starten. |
| Login schlägt fehl | Supabase-URL und Keys prüfen; Passwort ggf. in Supabase unter Authentication → Users zurücksetzen. |

Beenden mit `Strg + C` im Terminal. Nächstes Mal reicht `npm run dev`.
