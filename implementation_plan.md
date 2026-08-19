# SF1 Import → SF1 Page: Data-Fidelity Fix Plan

## Goal
End-to-end: import the real SF1 Excel (`public/SF1_2026_Grade 7 (Year I) - FAITH.xls`) and have the
SF1 page's **printable School Register (SF1PrintView) be a 1:1 visual replica of the Excel**, with all
19 columns + header block + legend + signature/tally block + BoSY/EoSY rendering populated by the
imported data. Also: the section list must reflect a section created by an SF1 bulk import.

## Status of pre-existing fixes (already applied in the working tree — VERIFY, do not redo)
- `src/hooks/useAvailableSections.js` — already uses a whole-collection client-side filter (no compound
  Firestore `where` query). This is THE fix for "section not updated after import". Tests
  (`src/hooks/__tests__/useAvailableSections.test.js`) PASS.
- `SF1.jsx` already wires `useAvailableSections` (line 174) + `loadClass` + `reloadKey` (line 185/331).
- `SF1PrintView.jsx` already mirrors the full Excel layout (parent/guardian fields at lines 63–66,
  BoSY/EoSY labels at lines 309–314).

## Root cause (exact, confirmed)
`src/importers/sf1/normalizeSF1.js` — the normalizer writes to field names that **do not exist on the
canonical learner object**, so the values are silently dropped:

| Line | Current (BROKEN) | Canonical (correct) |
|---|---|---|
| 113 | `learner.mothersMaidenName = text(raw.mothersName \|\| raw.mothersMaidenName);` | `learner.mothersName = text(raw.mothersName \|\| raw.mothersMaidenName);` |
| 114 | `learner.guardianName = text(raw.guardian \|\| raw.guardianName);` | `learner.guardian = text(raw.guardian \|\| raw.guardianName);` |

`emptyLearner()` (lines 14–51) declares `mothersName` and `guardian` only. `firestoreImport.js`
(the import writer, line 71–72) reads **exactly** `learner.mothersName` → Firestore `mothersMaidenName`
and `learner.guardian` → Firestore `guardianName`. Because the normalizer writes to the non-canonical
keys `mothersMaidenName`/`guardianName`, `learner.mothersName`/`learner.guardian` stay `""` and Firestore
receives empty mother/guardian names. This is also the single failure in `realSamples.test.js`
("reads the remaining learner fields" asserts `l.mothersName`).

> NOTE: do NOT replace `normalizeSF1.js` with the worktree version. The worktree version lacks
> `motherTongue`/`ipEthnicGroup` handling that the committed `realSamples.test.js` asserts — swapping
> it in would trade one failing branch for another. The minimal two-line rename is the correct fix.

## Scope decisions (resolved from evidence)
1. **Importer-internal learner fields = `mothersName` / `guardian`** (matches `emptyLearner`,
   `firestoreImport.js`, and the committed `realSamples.test.js`). Firestore/doc fields stay
   `mothersMaidenName` / `guardianName` (page layer) — HEAD's intended split; only the normalizer drifted.
2. **Fidelity target = the printable SF1 School Register** (`SF1PrintView.jsx`), which already mirrors
   all 19 Excel columns + metadata + legend + signatures + tallies + BoSY/EoSY. The data-entry table stays
   an 8-column summary with an expando for the full demographic set.
3. **pageAccess.js is in scope** (user listed it): align to the reference-worktree canonical version,
   which is exactly what `src/__tests__/pageAccess.test.js` imports/asserts.
4. **Region**: NOT extracted by the importer (and must NOT be — `realSamples.test.js` asserts
   `result.school` equals an object with no `region` key). `SF1PrintView` renders `region` from
   `schoolConfig`. Out of scope for import-fidelity.
5. **BoSY/EoSY date values**: the FAITH Excel footer carries "BoSY Date:" / "EoSY Date:" labels with
   BLANK values; `SF1PrintView` already renders those labels blank (matches the file). Real dates from
   the academic calendar are a P2 usability enhancement, not a fidelity requirement.
## Files to change

| File | Change |
|---|---|
| `src/importers/sf1/normalizeSF1.js` | **CORE (30 min, high confidence):** lines 113–114 rename the assignment targets to `mothersName`/`guardian` (keep the `raw.mothersMaidenName`/`raw.guardianName` fallback so either column-keying convention works). |
| `src/pageAccess.js` | **Reconcile (30–45 min):** replace main version with the canonical worktree version (`.claude/worktrees/fix-sf1-sf10-import/src/pageAccess.js`). |
| `src/hooks/useAvailableSections.js` | **P2 (optional hardening):** add an optional `refreshKey` 3rd param into the `useEffect` deps so an already-open SF1 page can force a refetch after an import. Backward compatible (existing 2-arg tests unaffected). |
| `src/SF1.jsx` | **P2:** listen for `storage` event `"sf1:rosterChanged"` and bump `reloadKey` (+ optional `refreshKey`) so an open SF1 page updates immediately after an import in another tab. |
| `src/pages/SF1Importer.jsx` | **P2:** on successful SF1 import completion, dispatch `localStorage.setItem("sf1:rosterChanged", String(Date.now()))` to trigger the cross-tab refresh. |
| `src/components/SF1PrintView.jsx` | **P2 (optional):** accept `bosyDate`/`eosyDate` props sourced from the school academic calendar (`academicCalendar.schoolYears[sy].startDate/EndDate` via `useAcademicCalendar`) so the footer dates are filled rather than blank. |

### Field-name mapping (whole chain, for the record)
```
Excel col AF ("Mother's Maiden Name…") → raw.mothersName (columnMap key, sf1Layout.js)
    → normalizeSF1.js: learner.mothersName   [FIX]
    → firestoreImport.js toFirestoreLearner: mothersMaidenName  (Firestore doc)
    → SF1PrintView / SF1.jsx editable table: l.mothersMaidenName  (read Firestore)
Excel col AB ("Father's Name…")       → raw.fathersName  → learner.fathersName  → fathersName        → l.fathersName
Excel col AK ("GUARDIAN (if Not Parent)") → raw.guardian → learner.guardian    [FIX]
    → guardianName           → l.guardianName
```
All other 16 columns already flow end-to-end unchanged (verified: the only broken links were the two
renamed assignments above).

### pageAccess.js consumer safety check (why the replacement is safe)
- `src/ViewLearners.jsx` imports **the function** `canEditLearners` (line 9, used line 105) — not the
  `"editLearners"` PAGE_ACCESS key. The worktree `canEditLearners` is adviser-only (the API the test asserts).
  No consumer queries the removed `"editLearners"` key.
- `src/App.jsx` routes by page-key (`userManagement`, `viewLearners`, `lardoTracking`, `certificates`,
  `idGenerator`, `importCenter`, `sf1Import`, `schoolSettings`) via `canAccessPage`. The worktree keeps all
  of these keys; it only **removes** `editLearners` and `smeaAcademicHub` — neither is referenced by
  `App.jsx` (grep-confirmed).
- `canAccessDisciplineRecords`: no in-app consumer (grep empty). Safe to keep the worktree's
  `DISCIPLINE_STAFF`-based definition.
- **Intended role deltas** (canonical vs main) to surface at hand-off: `principal` loses
  `schoolSettings`/`importCenter`/`SF1-import`/`IDGen`/`certGen`; `principal` GAINS `userManagement`;
  `subjectTeacher` loses cert/ID gen; `adviser`/`ictCoordinator` unchanged. These are the behavior the
  committed `pageAccess.test.js` encodes, so aligning is correct by spec.

## Implementation order
1. **CORE fix** — `normalizeSF1.js` lines 113–114 (the two-line rename).
2. **Verify** — `vitest -t "real DepEd SF1 sample"` → expect "reads the remaining learner fields" to pass;
   confirm `result.records[0].learner.mothersName === "BERDIN,ELMA,ALIVADO"`.
3. **pageAccess** — replace `src/pageAccess.js` with the worktree canonical version; grep-confirm no
   consumer references the removed keys.
4. **P2** — `useAvailableSections` `refreshKey` + `SF1.jsx` storage-listener + `SF1Importer` dispatch
   (only if "section not updated" must also cover an already-open page).
5. **P2** — wire `bosyDate`/`eosyDate` from the academic calendar into `SF1PrintView` (optional polish).
6. **Full test run** — `vitest run` → expect all green.

## Testing / validation matrix
| Test file | Expected | Notes |
|---|---|---|
| `src/importers/realSamples.test.js` | ✅ green | FAITH file; the 1 failure (`reads the remaining`) resolves via step 1. Asserts `sex:"Male"`, `motherTongue`, `fathersName`, `mothersName==="BERDIN,ELMA,ALIVADO"`, gender tally M11/F9. |
| `src/hooks/__tests__/useAvailableSections.test.js` | ✅ green | Already passes; regression guard for step 4. |
| `src/__tests__/pageAccess.test.js` | ✅ green | Resolves via step 3 (canonical role arrays + `VIEW_LEARNERS_*` exports). |
| `src/importers/sf1/importSF1.test.js` | ✅ green | Synthetic SF1 fixtures; unaffected (assert shapes, not renamed importer keys). |
| `src/importers/sf1/officialLayout.test.js` | ✅ green | Unaffected. |
| `src/importers/sf10/...` | ✅ green | Unaffected. |

## Out of scope (explicit)
- Any SF10 parsing changes.
- Region extraction from the workbook (forbidden by `realSamples.test.js`'s `result.school` equality).
- Role-semantics debate beyond "align to the committed `pageAccess.test.js` + worktree canonical".

## Assumptions / risks
- The two-line `normalizeSF1.js` rename is the minimal, test-aligned fix; the rest of the SF1 pipeline
  (`parseSF1` → `firestoreImport` → `SF1.jsx`/`SF1PrintView`) is already consistent on the Firestore
  field names `mothersMaidenName`/`guardianName`.
- `pageAccess.js` replacement changes live role assignments (listed above); intentional, matches the committed spec.
- P2 items (open-page refresh, BoSY/EoSY dates) are optional polish; the user's "100% match" target is met
  by step 1 (mother's name) + the already-rebuilt print register + the already-fixed sections hook.

