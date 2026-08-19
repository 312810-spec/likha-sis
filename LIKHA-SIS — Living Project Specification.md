# LIKHA-SIS — Living Project Specification

**Project:** LIKHA-SIS  
**Full Name:** Learner Information & Knowledge Hub Administrative System  
**School:** Tingub National High School  
**Location:** Philippines  
**Current School Year:** 2026–2027  
**Document Status:** Living Specification  
**Last Updated:** August 19, 2026

---

# 1. Project Overview

LIKHA-SIS is a Progressive Web Application designed to serve as a unified digital school management and administrative system for Tingub National High School.

The system aims to digitize and centralize:

- DepEd school forms
- Learner records
- Enrollment information
- School monitoring and evaluation data
- Anecdotal records
- Academic/grade information
- Attendance information
- Administrative reports
- Future parent-facing services

The primary goal is:

> **Enter school data once, then automatically generate the reports and records that depend on it.**

LIKHA-SIS should reduce duplicate encoding, manual spreadsheet work, calculation errors, and fragmented school records.

---

# 2. Target Users

## 2.1 Teachers

Primary daily users.

Teachers should be able to:

- Manage assigned learner records
- Encode required school-form information
- View learner information
- Maintain anecdotal records
- Access relevant reports
- Eventually enter or manage academic/assessment data
- Work with the system even when internet connectivity is temporarily unavailable

## 2.2 School Principal / School Administrator

The administrator should eventually be able to:

- View school-wide learner data
- Monitor enrollment
- View SMEA indicators
- Review reports
- Monitor academic and attendance indicators
- Manage system-level settings
- Manage user access

## 2.3 Parents

Parent access shipped in Phase 5.8 (`src/pages/ParentPortal.jsx`, `pageAccess.js`'s `parent` role) — read-only, gated to verified parent-learner relationships, with a separate parent login flow.

Status of the potential capabilities below:

- Viewing learner information — implemented
- Viewing grades — placeholder in the UI, pending the academic/grade-data domain
- Viewing attendance — placeholder in the UI, pending wiring to the new attendance domain (Section 22)
- Viewing selected school announcements/reports — not yet implemented
- Other parent-facing services

Parent access must use strict authorization and must never expose unrelated learner records.

## 2.4 Actual Role System

The three broad categories above (Teachers / Administrator / Parents) predate the role-based access control that actually shipped. The real, canonical role list — defined once in `src/utils/roles.js` and consumed by `pageAccess.js`, `firestore.rules`, `UserManagement.jsx`, and `AccountSettings.jsx` — is:

| Role id | Label | Roughly maps to |
|---|---|---|
| `principal` | Principal | 2.2 Administrator |
| `masterTeacher` | Master Teacher | 2.2 Administrator (academic oversight) |
| `adviser` | Adviser | 2.1 Teacher (section-owning) |
| `subjectTeacher` | Subject Teacher | 2.1 Teacher (grading-only) |
| `stakeholder` | Stakeholder | read-only external viewer, not in the original 2.1–2.3 list |
| `ictCoordinator` | ICT Coordinator | system/settings owner (Section 4D of `CLAUDE.md`), not in the original list |
| `smeaCoordinator` | SMEA Coordinator | 2.2 Administrator (SMEA/LRP focus) |
| `guidance` | Guidance Counselor | 2.2 Administrator (DO 006 discipline records) |
| `clinicTeacher` | Clinic Teacher | 2.1 Teacher (nutrition/clinic focus) |
| `parent` | Parent | 2.3 Parents |

A user account can hold more than one role simultaneously (e.g., an ICT Coordinator who is also an adviser). Access decisions everywhere in the app go through `canAccessPage()`/`pageAccess.js` on the client and matching role checks in `firestore.rules` on the server — never through the three-category framing in 2.1–2.3, which remains useful only as a plain-language summary of intent.

---

# 3. Core Design Principle

## Enter Once → Use Everywhere

The same learner information should not be encoded repeatedly for different reports.

Example:

```text
Teacher enters learner in SF1
        ↓
Learner stored in Firestore
        ↓
Enrollment Report automatically uses learner
        ↓
SMEA uses enrollment data
        ↓
Future reports use the same learner
        ↓
Future certificates/forms use the same learner
```

SF1 should therefore act as one of the primary sources of truth for learner identity and basic enrollment information.

---

# 4. Technology Stack

## Frontend

- React
- Vite
- JavaScript
- Progressive Web App architecture

## Backend

Firebase

### Authentication

Firebase Authentication

Current authentication model:

- Teacher login
- Protected application routes
- Logout

Future:

- Administrator roles
- Parent accounts
- Role-based access control

### Database

Firebase Firestore

Current major collection:

```text
learners
```

Firestore is also expected to provide offline synchronization capabilities for the PWA.

### Hosting

Firebase Hosting

## Version Control

Git

Git commits should be made after every stable feature or meaningful milestone.

---

# 5. Development Environment

Primary development environment:

- Visual Studio Code
- Cline VS Code extension

Cline is used for code generation and implementation.

Current free OpenRouter model used through Cline:

```text
nvidia/nemotron-3-ultra-550b-a55b:free
```

Development workflow:

```text
Claude
  ↓
Product / architecture decision
  ↓
Claude creates precise Cline prompt
  ↓
Cline inspects/changes code
  ↓
Developer reviews diff
  ↓
Developer tests application
  ↓
Claude reviews result if necessary
  ↓
Git commit
```

Claude acts as:

- Product Manager
- System Architect
- Coding mentor
- Reviewer

The developer is a beginner, so instructions must remain understandable and incremental.

---

# 6. Beginner Developer Rules

The developer has no prior professional coding background.

Therefore:

1. Do not overwhelm with unnecessary technical terminology.
2. Explain new concepts using simple analogies.
3. Build one feature at a time.
4. Prefer complete runnable code.
5. Avoid vague placeholders.
6. Include basic validation and error handling.
7. Do not modify unrelated working features.
8. Inspect existing code before making architectural assumptions.
9. Always test before committing.
10. Maintain Git checkpoints.

---

# 7. Architecture

LIKHA-SIS uses a PWA architecture instead of separate native applications.

## Why PWA?

Instead of maintaining:

```text
Windows App
Android App
Web App
```

LIKHA-SIS maintains:

```text
One React Application
        ↓
PWA
        ↓
Desktop Browser
Mobile Browser
Tablet
Installed PWA
```

Benefits:

- One codebase
- Lower development cost
- Easier maintenance
- Easier deployment
- Cross-platform compatibility
- Offline capability

PWA packaging is part of the later roadmap.

---

# 8. Current Application Status

The following features are already implemented and tested.

## Authentication

- Teacher login
- Teacher logout
- Firebase Authentication
- Protected dashboard

## Dashboard

- Protected dashboard
- Navigation between application areas

## SF1

Current SF1 functionality includes:

- Learner entry
- LRN
- Learner name
- Sex
- Birthdate
- Automatically calculated age
- Learning modality
- Expandable learner details
- Address
- Parent/guardian information
- Remarks

## Saved Learners

Implemented:

- View saved learners
- Grade/section filtering
- Delete learner
- Learner record display

## Firestore Security

Firestore rules have been secured.

Authenticated users are required to access the learner collection.

The basic security principle is:

```text
request.auth != null
```

Unknown/unhandled collections should default to denied access.

The database must remain secure by default.

---

# 9. Security Principle

Security is non-negotiable.

The system must never rely solely on frontend hiding.

Firestore security rules must enforce authorization at the database level.

Current principle:

```text
Unauthenticated user
        ↓
DENIED

Authenticated user
        ↓
Allowed according to Firestore rules
```

Future role-based authorization should distinguish at minimum:

```text
Teacher
Administrator
Parent
```

Parents must only be able to access records explicitly associated with their child/children.

---

# 10. IMPORTANT: Current School Calendar

## SY 2026–2027 uses the Three-Term School Calendar

LIKHA-SIS must NOT be architected around the old four-quarter school calendar.

The system must support the current DepEd three-term structure for SY 2026–2027.

Current structure:

```text
School Year 2026–2027

Term 1
Term 2
Term 3
```

The application must avoid hard-coding assumptions such as:

```text
Quarter 1
Quarter 2
Quarter 3
Quarter 4
```

for current-school-year workflows.

The DepEd Learning Systems Guide and current DepEd issuances are the references for the updated structure.

Reference:

https://sites.google.com/deped.gov.ph/lsguide/home

---

# 11. Academic Calendar Architecture

The application should eventually treat the academic calendar as configurable data rather than hard-coded logic.

Conceptually:

```text
School Year
    ↓
Academic Calendar
    ↓
Terms
    ↓
Reporting periods
    ↓
Reports / assessments / records
```

Example:

```text
SY 2026–2027
    ├── Term 1
    ├── Term 2
    └── Term 3
```

This design allows future DepEd calendar changes without requiring major application rewrites.

Historical records should remain interpretable even if future school years use different calendar structures.

---

# 12. Current SMEA Direction

Phase 5 of LIKHA-SIS includes:

- School Monitoring
- Evaluation
- Assessment
- Anecdotal Records

SMEA should primarily be a reporting and analysis layer.

The system should avoid unnecessary duplicate data entry.

---

# 13. SMEA Enrollment

## First SMEA Feature

The first SMEA feature to implement is:

> **Auto-generated Enrollment Report**

The report should derive its information from existing SF1 learner records.

No new learner data-entry form should be created solely for enrollment reporting if the existing learner records already contain the required information.

---

# 14. Enrollment Report Concept

The report should summarize:

```text
Grade Level
    ↓
Section
    ↓
Sex
    ↓
Count
```

For the current school calendar, reporting should be term-aware.

Conceptually:

```text
School Year: 2026–2027

Term 1

Grade 7
    Section A
        Male
        Female
        Total

    Section B
        Male
        Female
        Total

Grade 8
    ...

Term 2
    ...

Term 3
    ...
```

The exact report layout must be confirmed against the relevant official DepEd SMEA/enrollment templates before finalizing the UI.

---

# 15. Enrollment Source of Truth

The existing learner records should be the primary source for enrollment calculations.

Concept:

```text
SF1 learner records
        ↓
Filter active/relevant learners
        ↓
Group by grade
        ↓
Group by section
        ↓
Group by sex
        ↓
Count learners
        ↓
Enrollment Report
```

The Enrollment Report must not duplicate learner records unnecessarily.

---

# 16. Important Enrollment Architecture Question

Before implementing the Enrollment Report, inspect the existing codebase and database structure.

Confirm that the learner records contain:

- LRN
- Name
- Sex
- Grade Level
- Section
- School Year
- Enrollment status/date if applicable

Do not assume field names.

Cline must inspect the actual implementation before modifying code.

---

# 17. Enrollment Historical Data

The system should eventually distinguish enrollment by:

```text
School Year
Term
Grade Level
Section
Sex
```

This allows reports such as:

```text
SY 2026–2027
Term 1
Grade 7
Section A
Male = 15
Female = 17
Total = 32
```

Historical school years should remain available for reporting and comparison.

---

# 18. SMEA Data Architecture

SMEA should not become a second independent learner database.

Preferred architecture:

```text
Core Learner Data
        ↓
SF1 / Enrollment
        ↓
SMEA reporting
```

Other domains may later feed SMEA:

```text
Learner Data
     ├── Enrollment
     ├── Attendance
     ├── Grades
     ├── Assessment
     ├── Nutrition
     ├── Anecdotal Records
     └── Other indicators
```

SMEA should aggregate these domains rather than duplicate them.

---

# 19. Anecdotal Records

**Status: Implemented.** `src/AnecdotalRecords.jsx`, field constants in `src/anecdotalConstants.js`, stored in the `anecdotalRecords` Firestore collection with a role-gated rule block.

Implemented functionality:

- Create anecdotal record, associated with a learner from the `learners` collection
- Incident type (`ANECDOTAL_INCIDENT_TYPES`) and status (`ANECDOTAL_STATUS_OPTIONS`) drawn from `src/anecdotalConstants.js`
- Date, observation/event narrative, action/intervention, follow-up fields
- View learner history, search/filter records
- Page access restricted to `adviser`, `guidance`, `principal`, `masterTeacher` (`pageAccess.js`)

The original placeholder fields below were superseded once the official DepEd format was confirmed; this section documents what actually shipped rather than the original expectation.

---

# 20. ECR / Grade Data

The Electronic Class Record (ECR) is considered primarily part of a later academic/grade-data domain.

It should not be incorrectly forced into Phase 5 SMEA architecture.

ECR-related information may eventually provide:

- Subject grades
- MPS
- Passing rate
- Other academic indicators
- Attendance-related information where applicable

However:

> **ECR belongs primarily to the Grade Data / Academic domain, while SMEA consumes relevant summary indicators.**

---

# 21. Future Academic Data Domain

LIKHA-SIS currently does not fully collect subject grades.

A future domain is required for:

```text
Academic / Grade Data
```

Potential structure:

```text
School Year
    ↓
Term
    ↓
Grade
    ↓
Section
    ↓
Learner
    ↓
Subject
    ↓
Assessment / Grade
```

The exact structure must be aligned with the current DepEd grading and assessment policies before implementation.

Do not simply copy an old four-quarter ECR structure into the new application.

---

# 22. Attendance

**Status: Partially implemented.** Attendance lives in SF2 (`src/SF2.jsx`) and the `attendance` Firestore collection, keyed by school year, learner, grade/section — not yet a fully separate top-level domain. SF2 also has a Year Overview tab (per-learner and class-wide monthly attendance-rate trend across the school year), readable by `principal`, `masterTeacher`, `smeaCoordinator`, `guidance`, `ictCoordinator` in addition to the owning `adviser`.

Attendance data currently feeds:

- LARDO risk flags (attendance < 80% auto-triggers a risk flag per `src/utils/autoFlagTriggers.js`)
- SF2's own Year Overview trend

**Still pending:** a consolidated "Academic hub" rollup view that presents Grades (from `classRecords`/Consolidated Grades) and Attendance (from SF2/`attendance`) together in one place — this is the last disabled "(Soon)" stub in the sidebar (`src/components/Sidebar.jsx`, `const future`). See `roadmap.md` for the current scope decision on this.

Exact fields must follow applicable DepEd requirements.

---

## 22a. Class Program & Teacher's Load

**Status: Implemented**, not originally scoped in this spec. `src/ClassProgramGenerator.jsx` builds section timetables via a paintable schedule grid (`src/components/schedule/ScheduleGrid.jsx`) with conflict detection (`src/utils/scheduleConflicts.js`). Per-teacher load is derived automatically from the same schedule data (`src/utils/teacherLoadDerivation.js`) — including advisory and ancillary-duty assignments, per the project's weekly-load-hours rule — and both a printable Class Program sheet and a printable Teacher's Load sheet (`src/components/schedule/ClassProgramSheet.jsx`, `TeacherLoadSheet.jsx`) are generated from it. This is a schedule-authoring domain, not attendance tracking; it doesn't feed the Attendance rollup above.

---

# 23. Nutrition / LPN

Nutrition data requires a separate domain.

Current understanding:

```text
Nutrition / LPN
```

is not adequately represented by the current SF1 structure.

A dedicated data model and interface will therefore be required.

This domain may eventually provide indicators for SMEA.

Official DepEd requirements must be referenced before implementation.

---

# 24. Reporting Architecture

Reports should be generated from source data rather than manually encoded.

Preferred model:

```text
Source Data
    ↓
Validated Data
    ↓
Calculation / Aggregation
    ↓
Report
```

Examples:

```text
SF1
 ↓
Enrollment Report

Grades
 ↓
MPS / Passing Rate

Attendance
 ↓
Attendance Rate

Nutrition
 ↓
Nutrition Indicators

Anecdotal Records
 ↓
Learner Intervention History
```

---

# 25. DepEd Authenticity Requirement

All digitized forms must follow official DepEd templates and requirements.

This is non-negotiable.

Do not invent field names simply because they are convenient for programming.

Before implementing a school form:

1. Obtain the official/reference template.
2. Inspect all fields.
3. Identify required/optional fields.
4. Match labels and terminology.
5. Confirm the current school-year policy.
6. Only then implement the UI and database model.

The official SF1 Excel template has already been used as a reference.

---

# 26. Forms Roadmap

Future school forms may include:

- SF1
- SF2
- Certificates
- Other official school forms
- Additional administrative forms

The exact order may change depending on school priorities.

The guiding rule remains:

> Official template first → data model second → UI third → report/export last.

---

# 27. Data Model Philosophy

Data should be normalized where practical but kept understandable for a beginner developer.

Avoid unnecessary duplication.

Prefer relationships such as:

```text
Learner
    ↓
School Year
    ↓
Term
    ↓
Grade / Section
```

rather than creating completely separate copies of the same learner for every report.

However, historical enrollment snapshots may be appropriate when needed for accurate historical reporting.

---

# 28. Offline-First Requirement

**Status: Implemented.** `src/firebase.js` calls `initializeFirestore` with `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`, backing Firestore's offline cache with IndexedDB (instead of memory-only) and coordinating cache ownership across browser tabs.

- Cache relevant records — implemented (IndexedDB via `persistentLocalCache`)
- Allow supported data entry while offline — implemented: Firestore's SDK queues writes locally against the persistent cache and replays them on reconnect, which is what `persistentLocalCache` (vs. the in-memory default) is for
- Synchronize when connectivity returns — implemented, handled by the Firestore SDK itself once `persistentLocalCache` is active
- Clearly communicate synchronization status — implemented via `src/components/SyncStatusBanner.jsx`

Offline conflict handling must still be considered before implementing highly collaborative workflows (e.g., two advisers editing the same section's roster while both offline) — this has not been specifically exercised yet.

---

# 29. PWA Roadmap

PWA packaging shipped (`vite-plugin-pwa` in `vite.config.js`; manifest + service worker generated on every build).

Status of the expected capabilities below:

- Installable application — implemented
- Mobile-friendly interface — implemented
- Desktop-friendly interface — implemented
- Offline support — implemented: the app shell/static assets are precached by the service worker, and offline data entry with deferred sync is handled by Firestore's `persistentLocalCache` (see Section 28); `SyncStatusBanner.jsx` surfaces connection state
- Application icon — implemented
- Service worker — implemented
- Cached application shell — implemented

---

# 30. Parent Portal

Parent access shipped in Phase 5.8, after the core teacher/admin workflows stabilized (see Section 2.3 for capability status).

Parent access must use strong authorization.

A parent should never be able to query arbitrary learner records.

Preferred concept:

```text
Parent Account
      ↓
Verified Parent-Learner Relationship
      ↓
Authorized Learner Record
```

---

# 31. Firestore Security

Current security principle:

```text
deny by default
```

Unknown collections should not automatically become publicly readable/writable.

Current learner access requires authentication.

Future security rules should enforce role- and relationship-based access.

Security rules must be tested for:

- Logged-out access
- Teacher access
- Administrator access
- Parent access
- Unauthorized learner access
- Unauthorized writes
- Unauthorized deletes

---

# 32. Git Workflow

Every completed feature should receive a Git commit.

Recommended pattern:

```text
feat: add enrollment report
fix: correct learner age calculation
security: secure learner firestore rules
refactor: simplify learner filtering
```

Never make large unrelated changes in one commit.

Before moving to the next feature:

```text
Implement
 ↓
Test
 ↓
Review
 ↓
Commit
```

---

# 33. Development Rules

When using Cline:

1. Give Cline one focused task.
2. Ask it to inspect before modifying when architecture is uncertain.
3. Explicitly state files/components it should avoid changing.
4. Review the diff before approval.
5. Test manually.
6. Fix errors before adding another feature.
7. Commit stable changes.

Do not ask Cline to rewrite the entire application for a small feature.

---

# 34. Current Development Strategy

The current strategy is:

```text
Phase 1
Authentication + Dashboard
        ↓
Phase 2
SF1
        ↓
Phase 5 / SMEA
Enrollment
        ↓
Anecdotal Records
        ↓
Other SMEA indicators
        ↓
Academic / Grade Data
        ↓
Other forms
        ↓
PWA packaging
        ↓
Parent Portal
```

The exact phase numbering may be refined as the project evolves.

The important principle is to prioritize useful working features instead of rigidly following an arbitrary sequence.

---

# 35. Current Immediate Task

Before implementing the Enrollment Report:

## Step 1

Inspect the current application.

Determine:

- Current learner component
- Firestore learner collection
- Actual learner document structure
- Actual field names
- Grade Level field
- Section field
- Sex field
- School Year field
- Enrollment-related fields
- Existing routing/navigation

## Step 2

Confirm whether the existing SF1 data can produce:

```text
Grade × Section × Sex
```

without new data entry.

## Step 3

If sufficient:

Build the Enrollment Report.

## Step 4

Test calculations with fake data.

## Step 5

Commit to Git.

---

# 36. Testing Requirements

Until backup/export functionality and Firebase usage limits are fully addressed:

> **Use fake/test learner data only.**

Test cases should include:

### Sex

- Male
- Female

### Grade

- Grade 7
- Grade 8
- Grade 9
- Grade 10

### Sections

- Multiple sections
- Empty sections
- Learners distributed unevenly

### Edge cases

- Missing section
- Missing sex
- Duplicate learner
- Deleted learner
- Invalid grade
- Learner from another school year

The report must not silently produce misleading totals.

---

# 37. Validation Requirements

User input should be validated before saving.

Examples:

- LRN format validation
- Required learner name
- Valid sex value
- Valid birthdate
- Valid grade level
- Valid section
- Appropriate school year

Validation should occur at the UI level and, where appropriate, be reinforced through database/security logic.

---

# 38. Error Handling

All new features should have basic error handling.

The user should receive understandable messages such as:

```text
Unable to load learners.
Please check your internet connection and try again.
```

Avoid exposing raw Firebase errors to normal users unless necessary for debugging.

---

# 39. UI/UX Principles

The system is intended for real teachers.

Therefore:

- Keep screens simple.
- Minimize unnecessary clicks.
- Use familiar terminology.
- Prefer tables for school-form data.
- Make important actions obvious.
- Avoid excessive animations.
- Provide loading states.
- Provide empty states.
- Provide confirmation before destructive actions.
- Make mobile use practical.

---

# 40. Reporting Principle

Reports should be:

- Readable
- Printable
- Filterable
- School-year aware
- Term-aware
- Based on validated source data

Future export options may include:

- Excel
- PDF
- Print
- CSV

Do not implement exports until the underlying report calculations are correct.

---

# 41. Historical Compatibility

Although the current system follows the SY 2026–2027 three-term structure, historical data may originate from previous DepEd systems using four quarters.

Therefore:

```text
Current calendar
    → 3-term model

Historical calendar
    → may use previous structure
```

Do not blindly convert historical quarter data into terms.

Historical data must preserve its original academic-period meaning.

---

# 42. Policy Update Principle

DepEd policies may change.

LIKHA-SIS should therefore avoid hard-coded policy assumptions whenever practical.

Examples of configuration candidates:

- School year
- Academic terms
- Grade levels
- Sections
- Subjects
- Assessment periods
- Report types
- Calendar dates

The system should make policy-dependent settings configurable where reasonable.

---

# 43. Reference Materials

Primary reference:

**DepEd Learning Systems Guide**

https://sites.google.com/deped.gov.ph/lsguide/home

Important DepEd issuances identified for current architecture:

- DO 009, s. 2026 — Three-Term School Calendar
- DO 015, s. 2026 — Classroom Assessment and Grading
- DO 016, s. 2026 — Lesson Planning
- DO 014, s. 2026 — Flexible Learning Programs
- DO 017, s. 2026 — Strengthened Senior High School

Official DepEd sources should always take precedence over secondary summaries.

Other reference materials:

- Official DepEd SF1 Excel template
- SMEA raw data
- SMEA presentation
- ECR reference files
- Other uploaded DepEd school-form references

---

# 44. Important Existing Project Context

The project previously encountered SharePoint access limitations.

Some DepEd reference files were behind DepEd authentication and could not be automatically fetched.

When official files cannot be accessed through a public URL:

1. Download the official file manually.
2. Upload it to the project/chat.
3. Use the uploaded copy as the implementation reference.

Never invent official form structures from memory when the actual template can be obtained.

---

# 45. Architectural Rules That Must Not Be Violated

## Rule 1 — One Source of Truth

Do not create duplicate learner databases for individual reports.

## Rule 2 — Official Forms First

Match actual DepEd templates.

## Rule 3 — Current Policy Matters

Do not blindly reuse old four-quarter assumptions.

## Rule 4 — Secure by Default

Unauthenticated access must be denied.

## Rule 5 — Small Changes

One feature at a time.

## Rule 6 — Test Before Commit

Never commit untested major functionality.

## Rule 7 — Preserve Working Features

New features must not break existing SF1/authentication functionality.

## Rule 8 — No Unnecessary Data Entry

If information already exists, calculate the report automatically.

## Rule 9 — Configuration Over Hard-Coding

School-year and policy-dependent structures should eventually be configurable.

## Rule 10 — Beginner-Friendly Development

Every implementation should be understandable and maintainable by the developer.

---

# 46. Current Feature Status

| Feature | Status |
|---|---|
| Firebase Authentication | ✅ Complete |
| Teacher Login | ✅ Complete |
| Teacher Logout | ✅ Complete |
| Protected Dashboard | ✅ Complete |
| SF1 Learner Entry | ✅ Complete |
| Learner Details | ✅ Complete |
| Auto Age Calculation | ✅ Complete |
| Saved Learners | ✅ Complete |
| Grade/Section Filtering | ✅ Complete |
| Delete Learner | ✅ Complete |
| Edit Learner | ✅ Complete |
| Firestore Authentication Rules | ✅ Complete |
| Git Checkpoints | ✅ Complete |
| SF2 Daily Attendance Grid | ✅ Complete |
| SF4 Monthly Learner Movement Report | ✅ Complete |
| SF10 Generator (Permanent Record) | ✅ Complete |
| SF1 Bulk Importer | ✅ Complete |
| SF10 Bulk Importer | ✅ Complete |
| Import Center | ✅ Complete |
| SMEA — Enrollment Report (3-term) | ✅ Complete |
| Anecdotal Records | ✅ Complete |
| LARDO Tracking | ✅ Complete |
| Nutrition Status (BMI-for-Age, HFA) | ✅ Complete |
| Nutrition Status Consolidator (SF8-style) | ✅ Complete |
| Class Record (ECR) | ✅ Complete |
| Consolidated Grades | ✅ Complete |
| Report Card (SF9) | ✅ Complete |
| Transfers Log | ✅ Complete |
| Certificate Generator | ✅ Complete |
| ID Generator | ✅ Complete |
| User Management (RBAC) | ✅ Complete |
| Role-Based Page Access (pageAccess.js) | ✅ Complete |
| School Settings (setup wizard, branding) | ✅ Complete |
| Account Settings | ✅ Complete |
| Dark Mode | ✅ Complete |
| Branding / Theme Engine | ✅ Complete |
| PWA Support (manifest, service worker) | ✅ Complete |
| Offline / Sync Status Banner | ✅ Complete |
| Parent Portal (read-only, linked learners) | ✅ Complete |
| Parent Login (separate flow) | ✅ Complete |
| Academic Calendar (3-term, configurable) | ✅ Complete |
| Settings Lock (school year lock) | ✅ Complete |
| Transmutation Table | ✅ Complete |
| SHS Subject Weights | ✅ Complete |
| Key Stages Config | ✅ Complete |
| Additional SMEA Indicators | ✅ Complete (attendance/nutrition/LARDO; academic performance deferred) |
| Attendance (dedicated domain) | ✅ Complete (SF2 Year Overview tab) |
| Class Program & Teacher's Load | ✅ Complete (Section 22a) |
| Offline-First Firestore Persistence | ✅ Complete (Section 28) |
| Academic Hub (combined Grades + Attendance rollup) | 🔜 Sidebar "Soon" stub — see `roadmap.md` |

---

# 47. Immediate Next Action (historical — superseded)

This section originally preceded the SMEA Enrollment Report build; that work is long since complete (see Section 46's feature table). Kept for history rather than deleted.

As of this update, Phase 7 (Attendance dedicated domain, Additional SMEA Indicators) is also complete:

- Attendance: SF2 gained a Year Overview tab (per-learner and class-wide monthly attendance-rate trend across the school year), and `sf2` page access opened to principal/masterTeacher/smeaCoordinator/guidance/ictCoordinator as read-only viewers.
- Additional SMEA Indicators: the Enrollment Report gained an "Other SMEA Indicators" table aggregating attendance rate, nutrition status distribution, and LARDO monitoring count per grade. Academic performance (MPS/passing rate) remains deferred — it needs the full per-subject/term grade transmutation that `ConsolidatedGrades` resolves per-class, not a cheap school-wide aggregate.

**Important distinction:** "Attendance (dedicated domain) complete" above means SF2 gained its own Year Overview trend tab — it does **not** mean the sidebar's "Academic" hub (`src/components/Sidebar.jsx`, `const future`, children "Grades" and "Attendance") is built. That sidebar entry is a *combined* Grades+Attendance rollup view and is still a disabled "(Soon)" stub — see `roadmap.md` for its current status and the scope decision it's blocked on.

Remaining known gaps, not yet scheduled:
- Parent Portal's grades/attendance/nutrition panels are still UI placeholders (Section 2.3).
- Academic hub (combined Grades + Attendance rollup) — sidebar stub, see above.
- SMEA academic performance indicator (above).

Offline data entry with deferred sync (Section 28) is implemented via Firestore's `persistentLocalCache` — no longer a gap.

---

# 48. Master Product Principle

LIKHA-SIS should evolve into:

```text
                    LIKHA-SIS
                        │
        ┌───────────────┼────────────────┐
        │               │                │
     Learners        Academic         School
        │              Data          Monitoring
        │               │                │
       SF1           Grades          SMEA
        │           Assessment          │
        │               │               │
        └───────────────┼───────────────┘
                        │
                  Unified Reports
                        │
              ┌─────────┴─────────┐
              │                   │
           Teachers            Admin
                                  │
                              Future
                               Parent
```

The long-term goal is not merely to digitize individual DepEd forms.

The goal is to create a **connected school information system where the same validated data powers multiple forms, reports, monitoring tools, and administrative workflows.**

---

# 49. Session Restoration Instructions

When starting a new development session, paste this entire file into the conversation.

The AI assistant should first understand:

1. LIKHA-SIS is a real school management system.
2. The developer is a beginner.
3. React + Vite + Firebase is the established stack.
4. Existing features must be preserved.
5. DepEd authenticity is mandatory.
6. SY 2026–2027 uses the three-term calendar.
7. SMEA should consume existing source data rather than duplicate it.
8. Enrollment is the current SMEA priority.
9. Cline is the implementation assistant.
10. Claude is the Product Manager/System Architect.
11. Work must proceed one feature at a time.
12. Every stable feature must be tested and committed to Git.

Before making architectural changes, inspect the current codebase and compare proposed changes against this specification.

---

# 50. Phase 6 — System Audit & Documentation Sync (August 19, 2026)

## Regression Test Results

Performed a full regression pass using Vitest across all implemented modules.

```
Test Files: 38 passed (38)
Tests:      382 passed (382)
Duration:   ~5s
```

All 382 unit and integration tests passed with zero failures.

## Code Hygiene Fixes Applied

| File | Issue | Fix |
|---|---|---|
| `src/App.jsx` | Duplicate `PARENT_ONLY_ROLES` import from `pageAccess.js` | Consolidated into single named import |
| `src/pages/ParentPortal.jsx` | `linkDoc` state assigned but never consumed in JSX | Removed dead state variable |
| `src/components/SyncStatusBanner.jsx` | Synchronous `setState` inside `useEffect` (lint violation) | Replaced with `useRef` + async `setTimeout` pattern |

## Implementation Phase Summary

| Phase | Description | Status |
|---|---|---|
| Phase 1 | Authentication + Dashboard | ✅ Complete |
| Phase 2 | SF1 Learner Management | ✅ Complete |
| Phase 3 | Academic Data (ECR, Grades, SF4, SF9, SF10) | ✅ Complete |
| Phase 4 | Nutrition, LARDO, Transfers, Certificates, IDs | ✅ Complete |
| Phase 5 | SMEA Enrollment, Anecdotal Records, SF2 | ✅ Complete |
| Phase 5.5 | Import Center (SF1/SF10), User Management, RBAC | ✅ Complete |
| Phase 5.6 | School Settings, Branding, Dark Mode, Setup Wizard | ✅ Complete |
| Phase 5.7 | PWA Support, Offline Banner, Sync Status | ✅ Complete |
| Phase 5.8 | Parent Portal + Parent Login | ✅ Complete |
| Phase 6 | Full System Audit, Regression Pass, Documentation Sync | ✅ Complete |
| Phase 7 | Attendance (dedicated domain), Additional SMEA Indicators | ✅ Complete |
| Phase 8 | Academic Hub (combined Grades + Attendance rollup) | 🔜 Pending — see `roadmap.md` |

---

# END OF LIKHA-SIS SPECIFICATION