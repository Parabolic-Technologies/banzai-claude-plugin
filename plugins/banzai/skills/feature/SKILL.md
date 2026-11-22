---
description: Plan a change, get the developer's approval of the plan, then implement, test and report it. Typed by the developer only.
argument-hint: "<what to build> | <work name> [what to do next]"
disable-model-invocation: true
allowed-tools: Read(/${CLAUDE_SKILL_DIR}/**)
---

# feature

Request: $ARGUMENTS

Planned work. Its documents live in `documentation/work/<work>/`:

| File              | Written                 | Holds                              |
| ----------------- | ----------------------- | ---------------------------------- |
| `requirements.md` | when step 2 calls for it | what must be true when it is done |
| `plan.md`         | always                  | how it will be built               |
| `report.md`       | from the first finished task | what was built and how it was checked |

A hook guards the project's source files. Until the developer approves the
plan, it denies every file-tool write to them and reports a change made
through the shell to the developer. Files under `documentation/` are never
guarded. The approval covers the exact content of `requirements.md`,
`plan.md` and the decision records the plan links to: changing any of them
ends the approval.

Each step below has a guide in `${CLAUDE_SKILL_DIR}/steps/`. Read a step's
guide when you reach that step, not before.

## 1. Start or continue

If the project has no `documentation/work/` directory, stop and ask the
developer to type `/banzai:setup` first.

If the request's first word names a directory in `documentation/work/`, by
its name or its path, continue that work: read its documents and go on from the first step that is
not finished; `report.md` says which tasks are done. The rest of the request
says what to do next. When it asks for work the approved plan does not
cover, change the plan (step 4) and ask for approval again (step 5) before
you change source.

Otherwise start new work. Name it `<YYMMDD>-<subject>`: today's date and two
to five lowercase words joined by hyphens, such as `261118-export-as-csv`.
Read the code, the tests and the project's `CLAUDE.md` or `AGENTS.md` that
the request touches before you write anything.

## 2. Requirements

Write `requirements.md` when the request leaves behaviour open, covers
several behaviours a user can see, or belongs to an epic package. Guide:
`steps/requirements.md`. A request leaves behaviour open when it names a
kind of thing but not which ones ("a language", "some formats",
"notifications"), or when you would have to pick what users get. Skip the
file only for a narrow request with one clear result; the plan's Goal
section then states the requirements.

## 3. Design

Take this step only when the work decides something that is costly to
reverse: a data model (the format or the place of data kept between runs
included), a public API, a new dependency, a security boundary, or a choice
that many parts of the code will have to follow. A choice of these kinds
that is cheap to undo needs no record; the plan's "For approval" section
names it. Guide: `steps/design.md`. The developer accepts the decision
record before the plan is written.

## 4. Plan

Write `plan.md` with a file tool. Guide: `steps/plan.md`.

## 5. Approval

The approval dialog shows the developer the plan's "For approval" section
and the names of the files, nothing else. Before you ask, check that the
section says what will be built and names every choice you made that the
developer did not make: the decisions tagged `default` in `requirements.md`,
or, in a plan without that file, each part of Goal that the request did not
state.

Then show the approval dialog. The hook reads `plan.md` at the moment the
command starts, so the plan's write must have returned before you send the
command: never put it in the same message as a write. Run exactly this shell
command, with nothing added:

```bash
: banzai-request-approval <work>
```

The command does nothing by itself. A hook answers it with that dialog, and
only the developer can answer it.
Give the tool call a description that says what the developer approves, in
the language they write in, such as "Approve the plan: export orders as
CSV". The desktop app shows that line in full and only the first rows of the
hook's text, which are hard to read there.
Do not change source files before the developer has answered "Yes".

- "Yes": the command returns and the hook says the work is approved. Go on.
- "No": your turn ends there. The developer's next message says what to
  change; change the plan and run the command again. When that message does
  not say what to change, ask; do not show the dialog again for a plan that
  has not changed.
- The command comes back refused: read the hook's message. "Approval
  requested" means that nobody answered the dialog. The work is not
  approved, so stop and say that the plan waits for the developer's
  approval; do not run the command again. Any other message says what to
  correct first.
- The command returns and no hook message follows: the hook is not running
  in this session. Nothing guards the source files, and nothing was
  approved or recorded. Say so in one line. Then ask for the approval in
  the session's question dialog (the `AskUserQuestion` tool): the developer
  sees the dialog alone, so put the lines of "For approval" and the plan's
  path into the question itself, and offer "Approve" and "Change the plan".
  Go on only after "Approve", and ask again whenever the plan changes.
  Where the session has no such dialog, or nobody answers it, stop and say
  that the plan waits for the developer's approval.

After the approval, do not edit `requirements.md`, `plan.md` or a linked
decision record, not even to tick a task: progress goes into `report.md`.
When the work turns out to need a different plan, stop, change the plan, say
what changed and run the approval command again.

When the hook denies a source change, its message says why. Do what the
message says; do not look for another way to make the change.

## 6. Implement

Guide: `steps/implement.md`.

## 7. Test

Guide: `steps/test.md`.

## 8. Report

Complete `report.md` in the work directory. Guide: `steps/report.md`.

Then tell the developer in a few lines what was built and what the checks
showed, and suggest `/banzai:review <work>` for an independent review. For
an epic package, leave the epic's tracker and
log alone and name `/banzai:epic record <package> done` as the next step.
Show a command the developer is to type in a `text` code block, not a `bash`
one: it goes into the message box, and the shell does not know it. Do not
stage, commit or push unless the developer asks.
