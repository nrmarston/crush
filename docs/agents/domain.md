# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the
codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root.
- **`docs/adr/`** for ADRs that touch the area you're about to work in.

If any of these files don't exist, proceed silently. The producer skill (`/grill-with-docs`)
creates them lazily when terms or decisions get resolved.

## Layout

This is a single-context repo:

- Root `CONTEXT.md` contains project vocabulary and domain language.
- Root `docs/adr/` contains architectural decisions.

## Use the glossary's vocabulary

When output names a domain concept, use the term as defined in `CONTEXT.md`.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly rather than silently overriding.
