# CareBridge

Platformă web pentru gestionarea îngrijirii persoanelor vârstnice și facilitarea comunicării dintre familie și îngrijitori.

**Stack:** React 19 + TypeScript + Vite · Tailwind CSS 4 · Supabase (PostgreSQL, Auth, Realtime, Row Level Security) · interfață în **română / engleză / rusă**.

## Funcționalități

| Modul | Ce face |
|---|---|
| Autentificare și roluri | Conturi cu rol de **administrator**, **îngrijitor** sau **membru al familiei**. Primul cont creat devine administrator. Accesul la date se acordă pe echipe de îngrijire. |
| Panou principal | „Arcul zilei": activitățile de azi desenate pe traseul soarelui (06–22), colorate după stare; indicatori pe 7 zile; planul zilei; evenimente și observații recente. Actualizare în timp real. |
| Persoane asistate | Profil medical, contact de urgență, alergii, echipa de îngrijire, evoluția semnelor vitale (14 zile). |
| Planificare | Activități pe categorii (medicație, igienă, alimentație, mișcare, monitorizare, socializare), cu recurență zilnică / zile lucrătoare / săptămânală, responsabil și durată. Vedere pe zi și pe săptămână. |
| Evidența activităților | Marcare realizată / nerealizată / anulată, cu note vizibile familiei. Activitățile neefectuate sunt marcate automat „nerealizate". |
| Jurnal de observații | Stare generală, durere 0–10, tensiune, puls, temperatură, SpO₂, glicemie, apetit, somn, note. Valorile anormale sunt detectate automat și declanșează alerte. |
| Evenimente | Programări medicale, vizite, incidente, căderi, spitalizări, schimbări de medicație, cu nivel de importanță. |
| Comunicare | O conversație comună pentru fiecare persoană asistată (familie + îngrijitori), în timp real, cu indicator de mesaje necitite. |
| Notificări | Generate în baza de date (triggere): mesaje noi, alerte de sănătate, evenimente importante, activități atribuite / realizate / ratate, mementouri cu 30 min înainte. În aplicație, ca toast și, opțional, ca notificare desktop. |
| Administrare | Roluri, activare/dezactivare conturi, echipe, generare de date demonstrative. |

## Instalare

### 1. Baza de date (o singură dată)

1. Deschideți proiectul în [Supabase Dashboard](https://supabase.com/dashboard) → **SQL Editor** → *New query*.
2. Lipiți conținutul fișierului [`supabase/setup.sql`](supabase/setup.sql) și apăsați **Run**.
3. *(Opțional)* Activați extensia **pg_cron** (Database → Extensions) și rulați [`supabase/migrations/004_cron.sql`](supabase/migrations/004_cron.sql) pentru mementouri automate și când nimeni nu este conectat. Fără pg_cron, aplicația rulează aceeași procedură din browser la fiecare 5 minute.
4. *(Recomandat pentru testare)* Authentication → Sign In / Providers → Email → dezactivați **Confirm email**, ca să vă puteți autentifica imediat după înregistrare.

### 2. Aplicația

```bash
npm install
cp .env.example .env.local   # completați URL-ul și cheia anon din Project Settings → API
npm run dev                  # http://localhost:5173
```

### 3. Primii pași

1. Creați un cont — **primul cont devine administrator**.
2. Administrare → **Generează date demonstrative** (creează o persoană asistată cu 2 săptămâni de activități, observații, evenimente și un mesaj), sau adăugați manual o persoană.
3. Creați conturi pentru un îngrijitor și un membru al familiei (în altă fereastră / browser privat), apoi, ca administrator: persoana asistată → Prezentare → Echipa de îngrijire → **Adaugă membru**.

## Comenzi

| Comandă | Descriere |
|---|---|
| `npm run dev` | Server de dezvoltare |
| `npm run build` | Verificare tipuri + build de producție în `dist/` |
| `npm test` | Teste automate (Vitest) |
| `npm run typecheck` | Doar verificarea tipurilor TypeScript |

## Structura proiectului

```
supabase/
  migrations/001_schema.sql     tabele, tipuri, indecși
  migrations/002_policies.sql   funcții de autorizare + politici RLS
  migrations/003_triggers.sql   profil la înregistrare, notificări, alerte, RPC, realtime
  migrations/004_cron.sql       programare automată (opțional)
  setup.sql                     001+002+003 într-un singur fișier
src/
  components/                   UI comun + module (activități, observații, evenimente, chat, arcul zilei)
  context/                      autentificare, notificări (realtime), toast
  i18n/                         dicționare ro / en / ru
  lib/                          client Supabase, interogări, recurență, praguri vitale, date demo
  pages/                        ecranele aplicației
docs/                           documentația proiectului
```

## Documentație

1. [Analiza platformelor existente](docs/01-analiza-platformelor.md)
2. [Cerințe și arhitectura sistemului](docs/02-cerinte-si-arhitectura.md)
3. [Baza de date](docs/03-baza-de-date.md)
4. [Manual de utilizare](docs/04-manual-utilizare.md)
5. [Testare și evaluare](docs/05-testare-evaluare.md)
