---
name: firestore-schema-sync
description: >-
  Implements the Data-Safety Loop from CLAUDE.md Section 4B.4: any new
  Firestore collection introduced in app code gets a matching security rule
  block in firestore.rules before the change is done, then deploys it. Use
  whenever code adds a new top-level Firestore collection, a new
  db.collection("...") call to a name not already covered in firestore.rules,
  or when asked to add/review Firestore security rules.
metadata:
  category: LIKHA-SIS Domain
---

# Firestore Schema-to-Rules Sync

Firestore has no schema enforcement of its own — `firestore.rules` is the
only thing standing between a new collection and an open read/write hole.
This skill keeps them in sync.

## 1. Detect the new collection
Grep the changed code for `collection(db, "...")` / `collection(firestore,
"...")` calls. Cross-reference each collection name against the `match
/{collection}/{docId}` blocks already present in `firestore.rules`.

## 2. Match the existing rule style
Read `firestore.rules` top to bottom first — it already defines helpers
(`isSignedIn()`, `myRoles()`, `hasAnyRole([...])`, `isSetupComplete()`) that
every collection's rules build on. Do not duplicate this logic; call the
existing helpers.

For the new collection, work out read/create/update/delete rules from how
the collection is actually used in the app (which roles read it, which roles
write it, whether it should be gated by `isSetupComplete()`), the same way
the `learners` block documents its access with a comment tying each rule
back to the UI screen that relies on it (e.g. "Read: everyone signed in
except stakeholder (matches ViewLearners access)").

If the collection stores DO 006 behavioral/LARDO data, access must be
restricted to `smeaCoordinator`, `principal`, `guidance` only — see
`lardo-safety-audit`.

## 3. Write the rule block
Add a new `match /{newCollection}/{docId} { ... }` block, placed near
related collections for readability, with a short comment block above it
(same convention as the rest of the file) explaining the read/create/update/
delete rationale.

## 4. Deploy
Per the saved memory `firestore-rules-deploy`: deploy the updated rules
directly via Bash — do not ask the user to run the deploy command
themselves. Use the Firebase CLI deploy command scoped to Firestore rules
only (do not deploy functions/hosting as a side effect).

## 5. Report
State the collection name, the rule block added, and confirm deploy
succeeded (or report the deploy error verbatim if it failed).
