# LIKHA-SIS — Living Project Specification

**Project:** LIKHA-SIS  
**Full Name:** Learner Information & Knowledge Hub Administrative System  
**School:** Tingub National High School  
**Location:** Philippines  
**Current School Year:** 2026–2027  
**Document Status:** Living Specification  
**Last Updated:** August 11, 2026

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

Parent access is planned for a later phase.

Potential capabilities include:

- Viewing learner information
- Viewing grades
- Viewing attendance
- Viewing selected school announcements/reports
- Other parent-facing services

Parent access must use strict authorization and must never expose unrelated learner records.

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

Anecdotal Records are part of Phase 5.

They are considered a good candidate for digitization because they have a defined structure.

Expected future functionality:

- Create anecdotal record
- Associate record with learner
- Record date
- Record observation/event
- Record action/intervention
- Record follow-up
- View learner history
- Search/filter records

The exact fields must be based on the official/reference DepEd format rather than invented fields.

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

Attendance should eventually become a dedicated domain or integrated learner-record domain.

Potential information:

- School Year
- Term
- Learner
- Days present
- Days absent
- Tardy/other required attendance information

Attendance data may eventually feed:

- SMEA
- learner profiles
- school reports
- intervention monitoring

Exact fields must follow applicable DepEd requirements.

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

Because the system is intended for actual school use, unreliable internet connectivity must be considered.

Firebase Firestore's offline capabilities should be used where appropriate.

The application should eventually:

- Cache relevant records
- Allow supported data entry while offline
- Synchronize when connectivity returns
- Clearly communicate synchronization status

Offline conflict handling must be considered before implementing highly collaborative workflows.

---

# 29. PWA Roadmap

PWA packaging is planned for a later phase.

Expected capabilities:

- Installable application
- Mobile-friendly interface
- Desktop-friendly interface
- Offline support
- Application icon
- Service worker
- Cached application shell

Do not prioritize PWA packaging before core data and reporting workflows are stable.

---

# 30. Parent Portal

Parent access is planned for Phase 7.

It should be implemented only after the core teacher/admin workflows are stable.

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
| Firestore Authentication Rules | ✅ Complete |
| Git Checkpoints | ✅ Complete |
| Edit Learner | ⏳ Planned |
| Enrollment Report | 🔜 Next |
| Anecdotal Records | 🔜 Planned |
| SF2 | 🔜 Planned |
| Academic/Grade Data | 🔜 Planned |
| Attendance | 🔜 Planned |
| Nutrition/LPN | 🔜 Planned |
| Additional SMEA Indicators | 🔜 Planned |
| PWA Packaging | 🔜 Later |
| Parent Portal | 🔜 Phase 7 |

---

# 47. Immediate Next Action

The next development action is **NOT yet to code the Enrollment Report**.

First:

> Inspect the existing learner database and application structure.

Confirm that the current SF1 implementation contains the required fields for automatic enrollment reporting.

After confirmation:

> Implement the Enrollment Report using the current **three-term academic structure**.

The report must derive its data from existing learner records.

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

# END OF LIKHA-SIS SPECIFICATION