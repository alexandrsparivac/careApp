// Date de identificare ale tezei. Valorile între [ ] sunt de completat de autor
// (în document apar evidențiate cu galben).
export const META = {
  title: 'Dezvoltarea unei platforme web pentru gestionarea îngrijirii persoanelor vârstnice și facilitarea comunicării dintre familie și îngrijitori',
  student: '[Nume Prenume]',
  group: '[grupa]',
  coordinator: '[Nume Prenume]',
  coordinatorTitle: '[titlul științifico-didactic, titlul științific]',
  headOfDepartment: '[Nume Prenume, titlul științifico-didactic, titlul științific]',
  faculty: 'Facultatea Calculatoare, Informatică și Microelectronică',
  department: 'Departamentul [denumirea departamentului]',
  program: 'Programul de studii [denumirea programului]',
  year: '2027',
  yearStart: '2026',

  initialData:
    'aplicație web multi-rol (administrator, îngrijitor, membru al familiei); sistem de gestiune a bazelor de date PostgreSQL în platforma Supabase; interfață în limbile română, engleză și rusă; notificări în timp real; publicare pe platforma Vercel.',
  chapters: [
    'Introducere',
    '1. Analiza și determinarea domeniului de interes',
    '2. Cercetarea sistemelor informaționale existente',
    '3. Concepția și arhitectura noului sistem',
    '4. Specificațiile tehnice (caietul de sarcini)',
    '5. Testarea și evaluarea sistemului',
    'Concluzii, bibliografie, anexe',
  ],
  graphics:
    'diagrama cazurilor de utilizare, arhitectura sistemului, diagrama de implementare, diagrama entitate–relație, diagrama de stări, diagrama de secvență, diagrama fluxurilor de date, capturi de ecran ale interfeței.',
  plan: [
    'Analiza domeniului și a sistemelor existente',
    'Elaborarea cerințelor și a arhitecturii sistemului',
    'Proiectarea și implementarea bazei de date și a securității',
    'Implementarea modulelor aplicației',
    'Testarea, evaluarea și publicarea aplicației',
    'Redactarea memoriului explicativ',
    'Susținerea preliminară',
  ],

  keywordsRo: 'îngrijirea vârstnicilor, aplicație web, Supabase, notificări în timp real, securitate la nivel de rând',
  keywordsEn: 'elderly care, web application, Supabase, real-time notifications, row-level security',

  annotationRo: (x) => [
    `{{${'[Nume Prenume]'}}}. „Dezvoltarea unei platforme web pentru gestionarea îngrijirii persoanelor vârstnice și facilitarea comunicării dintre familie și îngrijitori”. Teză de licență. Chișinău, {{2027}}.`,
    `Teza este structurată în introducere, cinci capitole, concluzii, bibliografie din ${x.refs} de titluri și ${x.annexes} anexe. Textul de bază cuprinde ${x.pages} de pagini, ${x.figures} de figuri și ${x.tables} de tabele.`,
    'Scopul lucrării constă în elaborarea unei platforme web care organizează și monitorizează activitățile de îngrijire a persoanelor vârstnice, îmbunătățește calitatea serviciilor de îngrijire și crește gradul de informare a familiei privind starea și activitățile zilnice ale persoanei asistate. Tema este actuală în contextul îmbătrânirii accelerate a populației și al situației frecvente în care membrii familiei locuiesc la distanță de persoana vârstnică, iar îngrijirea este realizată de alte persoane.',
    'Obiectivele generale ale lucrării au fost: analiza platformelor existente pe plan internațional; analiza cerințelor și proiectarea arhitecturii sistemului; dezvoltarea unui sistem de autentificare și gestionare a utilizatorilor pe roluri (administrator, îngrijitor, membru al familiei); implementarea planificării și monitorizării activităților zilnice; crearea unui modul de evidență a activităților realizate și a observațiilor privind starea persoanei; dezvoltarea unui sistem de comunicare între familie și îngrijitori; crearea bazei de date pentru evenimente; implementarea unui sistem de notificări; testarea și evaluarea platformei.',
    'Pentru realizarea lucrării au fost aplicate analiza comparativă a soluțiilor existente, modelarea sistemului prin diagrame UML și diagrame ale fluxurilor de date, proiectarea bazei de date relaționale și o metodologie de dezvoltare iterativă și incrementală. Aplicația client a fost realizată cu React și TypeScript, iar partea de server se bazează pe platforma Supabase (PostgreSQL, autentificare, API REST și canale în timp real). Regulile de acces sunt impuse direct în baza de date prin politici de securitate la nivel de rând, iar notificările și detecția valorilor anormale ale semnelor vitale sunt realizate prin triggere.',
    'Rezultatul lucrării este o aplicație web funcțională, publicată în mediul cloud, care include planificarea activităților cu recurență, evidența realizării lor, jurnalul de observații cu tendințele semnelor vitale, gestionarea evenimentelor, conversații comune pentru fiecare persoană asistată, notificări în timp real și o interfață disponibilă în trei limbi. Corectitudinea logicii principale a fost verificată prin 60 de teste automate, iar regulile de securitate au fost verificate prin cereri directe către interfața de programare a bazei de date. Pentru evaluarea utilizabilității a fost elaborat un protocol bazat pe scenarii de utilizare și pe chestionarul SUS.',
  ],
  annotationEn: (x) => [
    `{{${'[Name Surname]'}}}. “Development of a web platform for managing the care of elderly people and facilitating communication between family and caregivers”. Bachelor thesis. Chișinău, {{2027}}.`,
    `The thesis consists of an introduction, five chapters, conclusions, a bibliography of ${x.refs} sources and ${x.annexes} appendices. The main text contains ${x.pages} pages, ${x.figures} figures and ${x.tables} tables.`,
    'The aim of the work is to develop a web platform that organises and monitors care activities for elderly people, improves the quality of care services and keeps the family informed about the condition and daily activities of the person being cared for. The topic is relevant given the rapid ageing of the population and the frequent situation in which family members live far from the elderly person while the care is provided by other people.',
    'The general objectives were: to analyse existing platforms internationally; to analyse the requirements and design the system architecture; to develop authentication and role-based user management (administrator, caregiver, family member); to implement the planning and monitoring of daily care activities; to create a module for recording completed activities and observations about the person’s condition; to develop a communication system between family and caregivers; to create the events database; to implement a notification system; and to test and evaluate the platform.',
    'The work applies a comparative analysis of existing solutions, system modelling with UML and data-flow diagrams, relational database design and an iterative, incremental development methodology. The client application is built with React and TypeScript, while the server side relies on the Supabase platform (PostgreSQL, authentication, a REST API and real-time channels). Access rules are enforced directly in the database through row-level security policies, and notifications and the detection of abnormal vital signs are implemented with database triggers.',
    'The result is a working web application deployed to the cloud. It provides recurring activity planning, completion tracking, an observation journal with vital-sign trends, event management, a shared conversation for each care recipient, real-time notifications and a user interface available in three languages. The core logic is verified by 60 automated tests, and the security rules were checked with direct requests to the database API. A usability evaluation protocol based on task scenarios and the SUS questionnaire was also prepared.',
  ],
}
