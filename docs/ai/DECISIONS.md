# LIKHA-SIS — Architecture Decisions

Lightweight ADR log. Add a new entry when a major architectural decision is
made in future work; don't edit past entries except to update `Status`.

---

## Decision: Single-page `currentPage` routing

Status: Accepted

Decision:
Use the existing `currentPage` state architecture in `App.jsx` for all
navigation.

Reason:
Preserve the existing application navigation architecture and avoid the
migration cost and added dependency surface of a router library the app
was never designed around.

Do not:
Introduce React Router, or any other routing library, without explicit
architectural approval.

---

## Decision: Claude Code CLI as the sole AI development environment

Status: Accepted

Decision:
Claude Code CLI is the primary and authoritative development environment
for LIKHA-SIS. `CLAUDE.md` is the entry point; `AGENTS.md` sets general
agent operating behavior; `.claude/agents/` holds specialists;
`.claude/skills/` holds reusable procedures; `.claude/settings.json` /
`.claude/settings.local.json` hold permissions, hooks, and MCP activation;
`.mcp.json` holds approved external tools; `docs/ai/` holds long-term
project memory and decisions.

Reason:
The project previously used a Strategist/Cline dual-agent handoff loop
(documented historically in `LIKHA-SIS — Living Project Specification.md`).
That loop is superseded — Claude Code CLI now acts as the autonomous lead
architect and full-stack engineer directly in the terminal, eliminating the
external prompt-generation handoff.

Do not:
Reintroduce a Cline-specific configuration path (`.clinerules/` or
equivalent) as a parallel or replacement authority to `CLAUDE.md`.

---

## Decision: Firestore security rules are additive, not overriding

Status: Accepted

Decision:
A narrower `match` block on a specific document does not by itself hide
that document from a broader parent `match` block. Where a document under
a broad path needs stricter restriction than its siblings (e.g.
`settings/security` under `settings/{document}`), the parent rule itself
must carry the exclusion guard (e.g. `document != 'security'`).

Reason:
Firestore security rules evaluate every matching rule and allow if any one
grants access — rules cannot "override" a broader grant with a narrower
deny. This was verified against real School Settings key behavior.

Do not:
Assume adding a narrow, stricter `match` block for a sensitive document
is sufficient on its own without auditing the broader parent rule it sits
under.

---

## Decision: No new Firestore collection without a matching rules block

Status: Accepted

Decision:
Any new top-level Firestore collection must get a matching security rule
block in `firestore.rules` before the change implementing it is considered
done. This is automated via the `firestore-schema-sync` skill and the
`schema-guardian` agent.

Reason:
LIKHA-SIS stores learner PII and DO 006 behavioral records; an
undocumented or unrestricted collection is a direct Data Privacy Act
exposure risk, not just a hygiene issue.

Do not:
Ship a new collection's application code before its rules block exists and
has been deployed.

---

## Decision: Free-first infrastructure mandate

Status: Accepted

Decision:
Prefer solutions that require no payment, no paid API key, and no
billing-enabled cloud service whenever a reasonable free alternative
exists — free/keyless official APIs, existing Firebase Spark/free-quota
capabilities, GitHub Actions or client-side/background mechanisms that fit
free quotas, and free/open-source libraries. Never enable billing
automatically. If something genuinely cannot be implemented reliably for
free, stop and report the limitation before adding a paid dependency. See
CLAUDE.md §4G for the full rule.

Reason:
LIKHA-SIS runs on a public school's ICT budget; a design that quietly
depends on billing-enabled infrastructure (Cloud Run, Cloud Functions,
Cloud Scheduler, paid APIs) creates ongoing cost exposure the school did
not sign up for. The `syncPagasaAdvisories`/`syncDepedCalendar` Cloud
Run + scheduled-Functions architecture (see the next decision) was the
first concrete case this mandate was written to replace.

Do not:
Introduce a paid SaaS/API, or a Cloud Run/Cloud Functions/Cloud
Scheduler dependency, when a GitHub Actions workflow or free-tier
mechanism can reasonably solve the same problem.

---

## Decision: GitHub Actions replaces Cloud Run/scheduled Functions for the external calendar sync

Status: Accepted

Decision:
`scripts/external-calendar/` (plain Node scripts, run by
`.github/workflows/sync-official-calendar.yml` on a schedule) is now the
sole sync path for the `depedCalendarEvents` and `weatherAdvisories`
Firestore collections, authenticating to Firestore via the Admin SDK using
the `FIREBASE_SERVICE_ACCOUNT_JSON` GitHub Actions secret. The DepEd source
is discovered at sync time (`depedSourceDiscovery.mjs`) rather than
hard-coded — DepEd has already retired the once-hard-coded
`deped.gov.ph/school-calendar/` URL (it 404s as of August 2026), and a
future school year's calendar will be published under a different DepEd
Order/Memorandum number the discovery ranking picks up automatically.
PAGASA parsing (`pagasaParser.mjs`) reads official HTML first and only
falls back to a linked bulletin PDF when the HTML page doesn't carry the
bulletin content inline, scoped strictly to the live "Tropical Cyclone
Bulletin" section (never the page's separate "Archive" section — the prior
Cloud Run implementation picked the highest-numbered bulletin PDF from the
whole page, which could pick up an archived/inactive cyclone as if it were
current).

Reason:
The previous architecture (`functions/syncDepedCalendar.js` as a scheduled
Cloud Function, `functions/pagasa-sync/` as a Cloud Run service requiring a
JRE for `@pagasa-parser/source-pdf`) required Blaze-plan billing and a
manually-deployed Cloud Run service/Cloud Scheduler job outside Firebase's
free Spark quota — exactly what the free-first mandate now prohibits absent
a genuine need. GitHub Actions' scheduled workflows cover the same
"fetch periodically, parse, upsert" job for free on public/open-source
repos.

Do not:
Reintroduce a scheduled Cloud Function or Cloud Run service for this sync
without first establishing that GitHub Actions genuinely cannot do the job
(e.g. a hard requirement for sub-minute latency, which this sync does not
have).

---

## Decision: OCR fallback for a scanned DepEd calendar PDF -- Tesseract, never an AI API

Status: Accepted

Decision:
When DepEd's official calendar PDF has no extractable text layer (confirmed
the case for DO 009, s. 2026 -- a 58-page scanned document; `pdf-parse`
returns under 60 bytes for it), `syncDepedCalendar.mjs` falls back to OCR
via `lib/ocrPdf.mjs`: Poppler's `pdftoppm` rasterizes each page (cropped to
its left ~65% to exclude a mini-calendar thumbnail image that otherwise
pollutes the recognized text), and Tesseract OCRs each page image. Both are
free, open-source, locally-run system binaries (`apt-get install
poppler-utils tesseract-ocr` on the GitHub Actions runner) -- not a hosted
AI/vision API of any kind, paid or free. The actual interpretation of the
recognized text -- finding dates, splitting bulleted activities, classifying
categories -- stays 100% deterministic regex/state-machine code in
`depedCalendarParser.mjs`'s `parseDepedAnnexCalendarText()`; OCR only
substitutes for "read the text off the page image", the same role
`pdf-parse` plays for a text-layer PDF.

Reason:
The original spec for this sync explicitly allows OCR "when the official
PDF genuinely contains no extractable text" (true here) while explicitly
prohibiting AI APIs for parsing and mandating deterministic code -- Tesseract
satisfies the first without touching the second. A full 58-page OCR run
took about a minute in local testing, acceptable for a once-daily job. This
was validated against the real DO_s2026_009r.pdf, not synthetic fixtures:
109 calendar events extracted end-to-end (school opening, term boundaries,
examinations, INSET, Brigada Eskwela, holidays, etc.) matching the source
document.

Do not:
Add an AI/LLM API (vision or otherwise) to parse the calendar PDF, even a
free-tier one -- Tesseract already solves the "no text layer" problem
without one. If Tesseract's accuracy on some future document proves
insufficient, the fix is a better crop/parse heuristic in
`depedCalendarParser.mjs`, not a model call.
