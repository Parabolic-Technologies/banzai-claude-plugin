---
description: Independent audit of a plan or of a finished change, run by /banzai:auto in a fresh context. It is not a command; start it for no other reason.
argument-hint: "plan <work> | change <work>"
context: fork
agent: banzai:reviewer
user-invocable: false
background: false
---

# audit

Request: $ARGUMENTS

The first word of the request is the kind of audit, `plan` or `change`. The
second is a work directory under `documentation/work/`. Ignore anything
after them: you reach your own conclusions.

Read the intent first: the work's `requirements.md`, which opens with the
developer's request, its `plan.md`, the decision records the plan links to,
and the project's `CLAUDE.md` or `AGENTS.md`.

## `plan`

Nothing is built yet. Audit the plan against the request and the code as it
is. Check its claims by reading the code and by running what the project
already has. Do not build the planned change to try it, in the project or in
a copy: that is the next step's work, and the change audit checks it.

1. Request: the requirements cover what the developer asked for, in the
   developer's own words, and add nothing they did not ask for.
2. Coverage: every requirement and acceptance item maps to a task, every
   task serves a requirement, and each requirement can be checked.
3. Code: what the plan builds on exists and behaves as the plan says. The
   plan reuses what the project already has, and the names, signatures and
   formats it fixes collide with nothing.
4. Choices: each decision tagged `default`, and each choice the plan itself
   makes, is named in the plan's "For approval" section and contradicts
   neither the request, the code nor an accepted decision record.
5. Checks: each task has a check that would fail if the behaviour broke, and
   the commands under "Verification" exist in the project.
6. Limits: the work decides nothing that is costly to reverse without an
   accepted decision record or an answer that `requirements.md` tags
   `developer`: a data model (the format or the place of data kept between
   runs included), a public API, a new dependency, a security boundary, or a
   choice that many parts of the code will have to follow. Report such a
   decision as a `blocker` whose summary starts with "Needs the
   developer:".
7. Size: no task takes a source or test file past the project's size limit
   (the one in `CLAUDE.md` or `AGENTS.md`, or 500 lines when neither names
   one), and none leaves a file that is already past it longer than it was
   before the work. Files that a tool generates and data files are exempt.

For a finding about the plan, the evidence is the quoted lines of the plan
next to the quoted request, requirement or code they conflict with.

## `change`

The work is built. Collect the change from the files that `report.md` lists
and the Git commands that show them: `git diff <base>` with the base commit
that `report.md` names, and `git status --short`. `report.md` holds claims:
check them, do not trust them.

1. Requirements: each one is met, and nothing was built beyond them.
2. Plan: each task is done as planned, and each deviation is reported.
3. Decisions: each linked record is Accepted and the code follows it.
4. Correctness: failure paths, limits, empty and hostile input, concurrent
   use, and what happens when an operation is interrupted.
5. Security: every trust boundary the change touches. Try the forbidden
   thing in a test or a scratch copy.
6. Tests: they fail when the behaviour breaks, they cover what matters, and
   none was weakened or skipped.
7. Report: its file list and verification claims match what you see. Run
   the local checks again.
8. Fit: the change reuses what the project already has, adds no unused
   generality and leaves no fact stale in a document, `CLAUDE.md` or
   `AGENTS.md`.
9. Size: the change took no source or test file past the project's size
   limit, as the plan audit defines it, and left no file that was already
   past it longer than it was before the work. Report either as `major`.

When the work directory has a `review.md`, check the findings of its change
reviews first: say for each one whether it is closed or still open, with the
evidence. Its plan audit is background.

## Reply

List the findings, worst first, then what you did not check and why.
