#!/bin/bash
# The shared project, then a finished work "shout" whose change has a defect
# that its tests do not show and its report does not admit: the command line
# takes the flag only after the name, and R2 allows it before the name too.
. "$(dirname "${BASH_SOURCE[0]}")/../fixture.sh"
mkdir -p documentation/work/shout
cat > src/greet.mjs <<'EOF'
#!/usr/bin/env node
import { fileURLToPath } from 'node:url';

export function greet(name, { shout = false } = {}) {
  const text = `Hello, ${name}!`;
  return shout ? text.toUpperCase() : text;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [name, flag] = process.argv.slice(2);
  if (!name) {
    console.error('usage: greet <name> [--shout]');
    process.exit(2);
  }
  console.log(greet(name, { shout: flag === '--shout' }));
}
EOF
cat > test/greet.test.mjs <<'EOF'
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { greet } from '../src/greet.mjs';

test('greets by name', () => {
  assert.equal(greet('Ada'), 'Hello, Ada!');
});

test('shouts on request', () => {
  assert.equal(greet('Ada', { shout: true }), 'HELLO, ADA!');
});
EOF
cat > documentation/work/shout/requirements.md <<'EOF'
# Requirements: Shout flag

`greet` gets a `--shout` flag that prints the greeting in upper case. The
greeting's words do not change, and no other flag is added.

## Requirements

- R1. With `--shout` the greeting is printed in upper case: `greet Ada
  --shout` prints `HELLO, ADA!`.
- R2. The flag is accepted before or after the name: `greet --shout Ada`
  prints the same line as `greet Ada --shout`.
- R3. Without the flag the output is unchanged: `greet Ada` prints
  `Hello, Ada!`.
- R4. A name is still required. With no name, with or without the flag,
  `greet` prints `usage: greet <name> [--shout]` to standard error and exits
  with status 2.

## Acceptance

- Given the tool, when `node src/greet.mjs --shout Ada` runs, then it prints
  `HELLO, ADA!`.

## Decisions

- The flag's name is `--shout`. (developer)
- The flag may come before or after the name. (default)

## Open questions

None.
EOF
cat > documentation/work/shout/plan.md <<'EOF'
# Plan: Shout flag

Requirements: [requirements.md](requirements.md)

## For approval

Add a --shout flag that prints the greeting in upper case.
- The flag may come before or after the name.

## Goal

`greet` prints the greeting in upper case when `--shout` is given, and
behaves as before without it.

## Approach

`greet(name, options)` in `src/greet.mjs` takes `{ shout }` and returns the
upper-case text when it is set. The command line part reads the name and the
flag from its arguments, in either order, and passes the flag on.

## Tasks

- T1. `greet()` takes `{ shout }`: `src/greet.mjs`. Covers R1, R3.
  Check: a test of `greet('Ada', { shout: true })`.
- T2. The command line accepts `--shout` before or after the name and keeps
  the usage error: `src/greet.mjs`. Covers R2, R4.
  Check: `node src/greet.mjs --shout Ada` and `node src/greet.mjs Ada --shout`.

## Verification

`npm test`, from `CLAUDE.md`. By hand: `node src/greet.mjs Ada --shout`
prints `HELLO, ADA!`.

## Out of scope

- Other flags, and a short form of `--shout`.
EOF
cat > documentation/work/shout/report.md <<'EOF'
# Report: Shout flag

## Summary

`greet` has a `--shout` flag that prints the greeting in upper case. Without
the flag the output is as before.

## Tasks

- T1. Done.
- T2. Done.

## Requirements

- R1. Met: `greet()` in `src/greet.mjs`; test "shouts on request".
- R2. Met: the command line part of `src/greet.mjs` reads the flag in either
  position.
- R3. Met: test "greets by name".
- R4. Met: the usage check in `src/greet.mjs`.

## Files

- Changed: `src/greet.mjs`, `test/greet.test.mjs`.

Base: none; the repository has no commit yet.

## Verification

- `npm test`: 2 tests, 2 pass.
- `node src/greet.mjs Ada --shout`: prints `HELLO, ADA!`.

## Deviations

None.

## Follow-ups

None.
EOF
