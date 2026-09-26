# 5. Testare și evaluare

Testarea are trei niveluri: **teste automate** (logica aplicației), **testare funcțională manuală** (scenarii end-to-end pe roluri, inclusiv securitatea RLS) și **evaluarea utilizabilității** (cu utilizatori reali).

## 5.1 Teste automate

Rulare: `npm test` (Vitest). Verificarea tipurilor: `npm run typecheck`.

| Fișier | Ce verifică | Teste |
|---|---|---:|
| `src/lib/recurrence.test.ts` | generarea aparițiilor: o dată, zilnic, zile lucrătoare (inclusiv start în weekend), săptămânal, limita maximă, data de sfârșit inclusivă, nemodificarea datei de start | 8 |
| `src/lib/vitals.test.ts` | detecția fiecărui tip de valoare anormală, valorile la limită, alerte multiple; **sincronizarea pragurilor cu funcția SQL** `observation_flags` | 37 |
| `src/i18n/i18n.test.ts` | interpolarea; dicționarele EN și RU au exact aceleași chei ca RO, nicio traducere goală, aceleași variabile `{…}` în fiecare text; **orice cheie folosită în cod există** | 10 |
| `src/lib/notificationText.test.ts` | compunerea textului notificărilor în limbi diferite, traducerea tipurilor și a semnalelor, contorul mesajelor grupate, valori lipsă | 5 |
| **Total** | | **60** |

Rezultat la ultima rulare: **4 fișiere, 60 de teste, toate trecute.** Verificarea tipurilor TypeScript (mod strict) și build-ul de producție trec fără erori.

În plus, compilatorul TypeScript garantează că dicționarele `en.ts` și `ru.ts` nu pot omite o cheie din `ro.ts` (tipul `Dictionary`).

## 5.2 Testare funcțională manuală

Pregătire: 3 conturi în ferestre separate (A = administrator, primul cont; C = îngrijitor; F = familie); A generează datele demonstrative și îi adaugă pe C și F în echipa „Maria Popescu".

| ID | Scenariu | Pași | Rezultat așteptat |
|---|---|---|---|
| TF-01 | Primul cont devine administrator | Înregistrare A | A are meniul *Administrare* |
| TF-02 | Rol limitat la înregistrare | Înregistrare C cu rol *Îngrijitor* | C are rolul Îngrijitor; nu vede nicio persoană până la adăugarea în echipă |
| TF-03 | Izolarea datelor | C (fără echipă) deschide `/elders/<id>` | „Persoana nu a fost găsită sau nu aveți acces" |
| TF-04 | Acordarea accesului | A adaugă C și F în echipă | C și F văd persoana, planul, jurnalul |
| TF-05 | Familia nu modifică planul | F deschide o activitate | nu apar butoanele de bifare/editare; un `update` direct prin API este respins de RLS |
| TF-06 | Activitate recurentă | C planifică „Plimbare", zilnic, 7 zile | 7 apariții în planificator; A primește **o singură** notificare de atribuire dacă este responsabil |
| TF-07 | Evidența realizării | C bifează o activitate cu notă | status „Realizată", autor și oră; F primește `activity_done` în timp real; arcul zilei se actualizează la F fără reîncărcare |
| TF-08 | Activitate ratată automat | activitate planificată cu 3 ore în urmă; așteptați ≤ 5 min | status „Nerealizată"; echipa este notificată |
| TF-09 | Memento | activitate peste 20 min | responsabilul primește „Memento" |
| TF-10 | Alertă de sănătate | C adaugă observație cu temperatura 38.5 | formularul avertizează înainte de salvare; F primește „Alertă de sănătate — febră" |
| TF-11 | Eveniment important | F adaugă „Cădere" | importanța devine implicit *Ridicată*; C și A primesc notificare urgentă |
| TF-12 | Comunicare în timp real | F scrie un mesaj | apare instant la C; badge-ul *Mesaje* crește; la deschiderea firului, notificarea devine citită |
| TF-13 | Grupare mesaje | F trimite 3 mesaje la rând | C are o singură notificare necitită „(3)" |
| TF-14 | Schimbarea limbii | comutați RO → RU | toată interfața, datele calendaristice și notificările existente apar în rusă; limba se păstrează după relogare |
| TF-15 | Dezactivare cont | A dezactivează F | F vede ecranul „Cont dezactivat"; accesul la date este blocat |
| TF-16 | Protecția rolului | F încearcă `update profiles set role='admin'` prin API | eroare `42501` |
| TF-17 | Responsivitate | lățime 375 px | meniu mobil; planificatorul pe o coloană; formularele se deschid ca foi de jos |

Pentru TF-05 și TF-16, testul prin API se poate face din consola browserului, autentificat ca F:

```js
// în consola browserului, pe pagina aplicației
const { supabase } = await import('/src/lib/supabase.ts')
await supabase.from('profiles').update({ role: 'admin' }).eq('id', (await supabase.auth.getUser()).data.user.id)
// → error.code === '42501'
```

Completați coloana „Rezultat obținut" în timpul testării și atașați capturi de ecran în anexa lucrării.

## 5.3 Evaluarea utilizabilității

### Metodă

- **Participanți:** 5–8 persoane (recomandare uzuală pentru identificarea majorității problemelor de utilizabilitate): 2–3 îngrijitori, 3–5 membri ai familiei, de preferință și persoane peste 55 de ani.
- **Procedură:** fiecare participant rezolvă sarcinile de mai jos, gândind cu voce tare (*think-aloud*); observatorul notează timpul, erorile și cererile de ajutor. La final completează chestionarul SUS.
- **Metrici:** rata de finalizare a sarcinilor, timpul pe sarcină, numărul de erori, scorul SUS.

### Sarcini

| # | Rol | Sarcină | Criteriu de succes |
|---|---|---|---|
| S1 | Familie | „Aflați dacă mama și-a luat medicamentele de dimineață." | găsește activitatea și starea ei în < 1 min |
| S2 | Familie | „Care a fost tensiunea ei în ultimele zile? A fost vreo problemă?" | deschide fișa → tendințe / jurnal filtrat pe alerte |
| S3 | Familie | „Întrebați îngrijitorul dacă are nevoie de ceva pentru mâine." | trimite un mesaj în firul corect |
| S4 | Îngrijitor | „Planificați medicamentele de seară la 20:00, zilnic, până la sfârșitul lunii." | seria creată corect |
| S5 | Îngrijitor | „Bifați micul dejun de azi și notați că a mâncat jumătate." | activitate realizată cu notă |
| S6 | Îngrijitor | „Înregistrați: temperatură 38.2, puls 96, stare proastă." | observație salvată, alerta înțeleasă |
| S7 | Oricine | „Schimbați limba în rusă." | < 15 s |

### Chestionarul SUS (System Usability Scale)

Scală 1 (dezacord total) – 5 (acord total):

1. Cred că aș folosi frecvent această aplicație.
2. Am găsit aplicația inutil de complexă.
3. Aplicația a fost ușor de folosit.
4. Cred că aș avea nevoie de ajutorul unei persoane tehnice pentru a o folosi.
5. Funcțiile aplicației sunt bine integrate.
6. Aplicația are prea multe inconsecvențe.
7. Cred că majoritatea oamenilor ar învăța repede să o folosească.
8. Aplicația a fost greoaie de folosit.
9. M-am simțit încrezător(oare) folosind aplicația.
10. A trebuit să învăț multe lucruri înainte de a o putea folosi.

**Calcul:** pentru itemii impari scor − 1, pentru cei pari 5 − scor; suma × 2,5 → 0–100. Un scor peste ~68 este considerat în mod obișnuit peste medie.

### Tabel de rezultate (de completat)

| Participant | Rol | Vârstă | S1 | S2 | S3 | S4 | S5 | S6 | S7 | Erori | SUS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P1 | | | | | | | | | | | |
| P2 | | | | | | | | | | | |
| P3 | | | | | | | | | | | |
| P4 | | | | | | | | | | | |
| P5 | | | | | | | | | | | |
| **Medie** | | | | | | | | | | | |

## 5.4 Evaluare față de obiective

| Obiectiv | Status | Unde |
|---|---|---|
| Analiza platformelor existente | realizat | `docs/01-analiza-platformelor.md` |
| Analiza cerințelor și arhitectura | realizat | `docs/02-cerinte-si-arhitectura.md` |
| Autentificare și roluri | realizat | Supabase Auth, `profiles`, RLS |
| Planificare și monitorizare zilnică | realizat | Planificare, Panou principal, Plan zilnic |
| Evidența activităților și a observațiilor | realizat | statusuri + note, Jurnal, tendințe |
| Comunicare familie ↔ îngrijitori | realizat | Mesaje (realtime) |
| BD pentru evenimente | realizat | tabel `events`, pagina Evenimente |
| Sistem de notificări | realizat | triggere + `process_due_activities` + realtime |
| Testare și evaluare | teste automate realizate; testare manuală și SUS — protocol pregătit, de efectuat cu participanți | acest document |
| Documentație | realizat | `README.md`, `docs/` |

## 5.5 Limitări cunoscute și dezvoltări viitoare

- Notificările sunt livrate în aplicație și ca notificări desktop cât timp aplicația este deschisă; notificările push pe telefon (Web Push / aplicație mobilă) și e-mail/SMS nu sunt implementate.
- Nu există atașamente (fotografii, documente medicale) — se pot adăuga cu Supabase Storage.
- Pragurile pentru alerte sunt globale; o extindere utilă ar fi praguri personalizate per persoană, stabilite de medic.
- Fără pg_cron, mementourile și marcarea activităților ratate rulează doar cât timp cel puțin un utilizator are aplicația deschisă.
- Invitarea utilizatorilor prin e-mail de către administrator ar necesita o funcție pe server (Edge Function) cu cheia de serviciu.
