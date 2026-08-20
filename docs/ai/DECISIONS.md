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
