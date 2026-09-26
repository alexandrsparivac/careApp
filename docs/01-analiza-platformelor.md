# 1. Analiza platformelor existente

> Informațiile despre produsele terțe provin din descrierile lor publice. Funcționalitățile și disponibilitatea se schimbă frecvent — verificați-le la data redactării finale a lucrării.

## 1.1 Contextul problemei

Îngrijirea unei persoane vârstnice implică de regulă mai mulți actori: unul sau mai mulți îngrijitori (profesioniști sau informali), membri ai familiei aflați adesea în alt oraș sau altă țară, medicul de familie. Problemele tipice:

- **informația este fragmentată** — caiete pe hârtie, apeluri telefonice, mesaje în grupuri de chat generale;
- **familia nu are vizibilitate** asupra a ceea ce s-a făcut efectiv (medicație, alimentație, igienă) și a stării de sănătate;
- **abaterile nu sunt semnalate la timp** (tensiune mare, febră, o doză ratată, o cădere);
- **coordonarea** între mai mulți îngrijitori (tură de zi / noapte) este informală.

## 1.2 Categorii de soluții existente

| Categorie | Exemple (internațional) | Public-țintă | Ce acoperă bine | Ce lipsește pentru problema noastră |
|---|---|---|---|---|
| Jurnale de informare a familiei | **CaringBridge** (SUA, organizație non-profit) | Familie și prieteni | Publicarea de actualizări despre starea unei persoane | Nu are planificare de activități și nici evidența îngrijirii |
| Calendare de coordonare a ajutorului | **Lotsa Helping Hands** | Voluntari, familie | Calendar comun de sarcini, anunțuri | Fără monitorizare medicală, fără alerte |
| Aplicații pentru îngrijitori familiali | **Caring Village**, **Jointly** (Carers UK) | Îngrijitori informali | Calendar, liste de medicamente, notițe comune, mesaje | Detecția automată a valorilor anormale este limitată sau lipsește; fără roluri distincte îngrijitor / familie |
| Software pentru agenții de îngrijire la domiciliu | **Birdie** (Marea Britanie), soluții de tip „home-care management" | Agenții profesionale | Planificarea vizitelor, eMAR (evidența administrării medicației), portal pentru familie, rapoarte | Orientat spre agenții mari, cu costuri de licențiere; configurare complexă |
| Platforme de tip marketplace / servicii | **Honor** (SUA), **Homage** (Asia de Sud-Est) | Familii care angajează îngrijitori | Găsirea și programarea îngrijitorilor, aplicații proprii | Legate de serviciul propriu; nu sunt instrumente independente |
| Aplicații de aderență la medicație | **Medisafe** | Pacient / familie | Mementouri de medicamente, alerte către un apropiat | Doar medicația, nu întreaga îngrijire |

**Pe plan regional (Republica Moldova, România):** nu am identificat o platformă larg răspândită, în limba română, care să combine planificarea îngrijirii, jurnalul medical și comunicarea cu familia. În practică se folosesc fișe pe hârtie în centrele de îngrijire și grupuri de mesagerie generale (Viber, WhatsApp) pentru familie.

## 1.3 Comparație funcțională

| Funcționalitate | Jurnale (CaringBridge) | Calendare (Lotsa) | Aplicații familiale (Caring Village, Jointly) | Software pentru agenții (Birdie) | **CareBridge** |
|---|:-:|:-:|:-:|:-:|:-:|
| Roluri distincte (admin / îngrijitor / familie) | parțial | parțial | parțial | da | **da** |
| Planificarea activităților, cu recurență | nu | da | da | da | **da** |
| Evidența „realizat / nerealizat" cu note | nu | parțial | parțial | da | **da** |
| Jurnal de semne vitale și stare | text liber | nu | parțial | da | **da** |
| Detecția automată a valorilor anormale + alertă | nu | nu | nu / limitat | variază | **da** |
| Comunicare familie ↔ îngrijitori | comentarii | mesaje | da | portal familie | **da, în timp real** |
| Notificări pentru evenimente importante | da | da | da | da | **da** |
| Interfață în română și rusă | nu | nu | nu | nu | **da** |
| Cost pentru o familie / un centru mic | gratuit | gratuit | freemium | licență | **open-source, găzduire proprie** |

## 1.4 Concluzii pentru proiectare

Din analiză rezultă direcțiile pe care CareBridge le urmează:

1. **Un singur loc pentru plan, evidență, stare și comunicare** — în loc de patru instrumente separate.
2. **Roluri clare**: îngrijitorul modifică planul și bifează activitățile; familia vede tot și poate scrie, adăuga observații și evenimente, dar nu modifică planul.
3. **Securitate la nivel de bază de date** (Row Level Security): fiecare utilizator vede doar persoanele din echipa lui, indiferent de interfață.
4. **Alertele sunt calculate pe server**, nu în browser — o valoare anormală notifică echipa chiar dacă observația a fost introdusă dintr-un alt client.
5. **Informarea familiei este pasivă și continuă**: notificări la activitățile realizate, la cele ratate și la evenimentele importante, plus un rezumat vizual al zilei („arcul zilei").
6. **Interfață accesibilă**: text de bază mai mare, contrast ridicat, limbile folosite local (română, rusă) plus engleză.

> Notă: numele „CareBridge" este apropiat de cel al platformei CaringBridge. Pentru o eventuală publicare, luați în considerare un nume distinct.
