# Domain Docs

How the engineering skills read this repo's domain docs. Single context.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root: the canonical domain terms.
- **`docs/ubiquitous-language.md`**: the second glossary, until it is merged into `GLOSSARY.md`. Where the two disagree, `GLOSSARY.md` wins; flag the conflict.
- **`docs/adr/`**: ADRs that touch the area you're about to work in.

## Use the glossary's vocabulary

When your output names a domain concept (an issue title, a spec, a refactor proposal, a test name), use the term as `GLOSSARY.md` defines it. Don't drift to synonyms it avoids.

A concept missing from the glossary is a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`). New terms are agreed with the owner before they're used.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0005 (JSONB vs column vs child table), but worth reopening because…_
