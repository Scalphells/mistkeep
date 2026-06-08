# Contributing

## Before you start

- Open an issue to discuss non-trivial changes.
- Keep pull requests focused: one topic per PR.

## Quality

- `npm test` and `npm run build` must pass.
- Match the existing style: plain ES modules, no framework.
- Put business logic in `src/lib/` (pure, testable) and add Vitest tests.

## Tools, not content

Do not add proprietary content (text, rules, art, or data from commercial
modules or settings). Only open content (SRD 5.1) or original work is accepted.
Features should be engine, not material.

## Security

Sensitive writes must stay protected by Supabase row-level security. Never move
a permission decision to the client.
