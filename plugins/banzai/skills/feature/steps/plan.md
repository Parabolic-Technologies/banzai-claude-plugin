# Step: plan

`plan.md` says how the work will be built. The developer approves exactly
this file, so it must stand on its own: a reader who has only the plan, the
requirements and the code knows what will change and how it will be checked.

## Document

```markdown
# Plan: <Title>

Requirements: [requirements.md](requirements.md)
Decisions: [0007 Title](../../decisions/0007-title.md)

## For approval

<What will be built, in one line.>
- <A choice you made that the developer did not make.>

## Goal

<What will be true when the work is done. Without a requirements file, list
the requirements here as R1, R2 ... in a form that can be checked.>

## Approach

<The design in a few paragraphs: what changes where, in order of
dependency, and why this way. Name the existing code the change builds on.>

## Tasks

- T1. <Title>: <what changes, in which files or modules>. Covers R1, R2.
  Check: <the test or command that shows it works>.
- T2. ...

## Verification

<The exact commands that will be run at the end, and any manual check with
its expected result. Take the commands from the project's `CLAUDE.md` or
`AGENTS.md`; where neither names one, take it from the project's own
scripts. Name the source.>

## Out of scope

- <What this work does not do, where a reader could expect it.>

## Needs the developer

- <What only the developer can do or supply: credentials, an external
  setting, a manual step.>
```

The approval dialog shows the developer exactly the lines of "For approval",
so write them for a reader who sees nothing else. A plan has exactly one
such section, and it holds one to five lines of at most 72 characters each,
because the dialog folds a longer text; the hook refuses the approval
request otherwise. Put related choices on one line when there are more than
four, and write "No choices of my own." when there are none.

Leave out the "Requirements" or "Decisions" line and any other section that
would be empty. Link a decision record by its path under `decisions/`, as above:
the approval then covers that record too.

## Rules

- Every requirement and acceptance item maps to at least one task, and every
  task serves a requirement. If one does not, change the plan or ask.
- Tasks are in dependency order. Each is small enough to check on its own.
- Fix the things other code or people will depend on: public names,
  signatures, formats, config keys, error behaviour, migration order. Leave
  private mechanics to the implementation.
- Write no function bodies, no full file tree and no list of every function.
- Plan a check for each behaviour that matters and each regression that
  could plausibly happen. Do not plan one test per requirement, branch or
  helper.
- Use the simplest design that satisfies the requirements and the accepted
  decisions. Add an abstraction or a dependency only for a benefit you can
  name.
- A new dependency, or a choice listed in the design step, needs an accepted
  decision record before the plan relies on it. Do not repeat a record's
  reasoning in the plan; link it.
- When the plan finds a choice that belongs to the developer, or conflicts
  with an accepted record, stop and ask before you finish it.
- Do not write task checkboxes. The plan must not change after approval, so
  progress is recorded in `report.md`.
