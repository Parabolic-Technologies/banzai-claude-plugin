---
description: Make a small, direct change with no plan - a bug fix, a refactor, hardening or review cleanup. Typed by the developer only.
argument-hint: "<what to change>"
disable-model-invocation: true
---

# fix

Request: $ARGUMENTS

The developer typed this command, and that is the go-ahead to change source
files in this session without a plan. It covers this request, not whatever
else you notice on the way.

## When a fix is the wrong tool

Stop before you change anything, say why, and suggest
`/banzai:feature <request>` when the request:

- adds or changes behaviour that users or other systems rely on, beyond
  correcting a defect;
- changes a data model, a public API or a security boundary;
- adds a dependency;
- makes a choice that many parts of the code will have to follow;
- cannot be described in a few sentences before you start.

Never write a `plan.md` here. A plan belongs to `/banzai:feature`, and the
hook treats a session that wrote one as planned work.

## Work

1. Read the code, the tests and the project's `CLAUDE.md` before you change
   anything. A review finding named by its ID is read from the work's
   `review.md`. For a defect, find the cause; do not patch the symptom.
2. Ask only a question whose answer changes what you build. Otherwise take
   the default that the existing code implies and name it in the report.
3. Make the smallest change that is correct and fits the code around it.
   Add no unrelated refactoring. Before you add a helper, search for code
   that already owns the behaviour, and say in one line what you found.
4. For a defect that could come back, write the test that fails without the
   fix first. Do not add a test that protects nothing.
5. Run the project's checks that cover the change, with the commands from
   `CLAUDE.md` or, where it names none, from the project's own scripts.
   Never turn a failure into success: do not weaken or skip a test, swallow
   an error or change an expected value to make a check pass. A check that
   fails for another reason is reported, not hidden.
6. Update a document or a `CLAUDE.md` fact only when the change made it
   wrong.

Do not edit an accepted decision record. If the fix conflicts with one, stop
and say so.

## Report

Report in chat: what changed and why, the files, each check you ran with its
exact command and result, and anything you left undone.

Write the same as `documentation/work/<YYMMDD>-<subject>/report.md` only
when the change alters documented behaviour, is an epic package, applies
review findings, or the developer asks for a record. Review findings for
planned work go into that work's own `report.md`. Only the developer rejects
a finding: record a rejection there with their words, and never reject one
yourself. An epic's tracker and log are written by `/banzai:epic record`,
not here.

Do not stage, commit or push unless the developer asks.
