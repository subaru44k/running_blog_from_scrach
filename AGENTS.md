# AGENTS.md — Design & Docs Sync Rules

Codex: You MUST read and follow this file for every task in this repository.

---

## Single Source of Truth (SSOT)

- **Design SSOT:** `docs/architecture.yaml`
- Human-readable docs (`docs/architecture.md`, `docs/components/*`, `README.md`) must stay consistent with the SSOT.

---

## Mandatory rule (non-negotiable)

**If your change introduces or modifies a DESIGN DECISION, you MUST update
`docs/architecture.yaml` and any related docs in the same change.**

You are NOT allowed to change code first and “leave docs for later”.

---

## What counts as a DESIGN DECISION

A change is considered a design decision if it affects **how the system behaves or is structured**, including (but not limited to):

- URL routing rules or HTTP status behavior (e.g. 404 handling, rewrites, redirects)
- SEO / indexing policy (canonical, robots, sitemap behavior)
- External integrations (OAuth flows, callbacks, APIs, data contracts)
- Data flow or processing pipelines (e.g. PDF upload → process → download)
- AWS / infrastructure responsibilities or boundaries
- Build, deploy, or runtime assumptions

---

## What does NOT count as a design decision

The following usually do NOT require SSOT updates:

- Text copy changes (titles, descriptions)
- Styling / CSS / visual-only changes
- Adding or editing blog content
- Refactors with no behavior change

If unsure, **treat it as a design decision** and update the docs.

---

## Required workflow for Codex

For every task:

1. Decide whether the change affects a design decision.
2. If **YES**:
   - Update `docs/architecture.yaml` first or alongside code.
   - Update any related docs needed to stay consistent.
3. If **NO**:
   - Proceed with code changes only.
4. At the end, explicitly state:
   - “Design decision affected: YES/NO”
   - If YES, list the docs you updated.

---

## Failure condition

If you modify code in a way that affects design decisions **without updating the SSOT**, the task is considered **incorrect and incomplete**.

