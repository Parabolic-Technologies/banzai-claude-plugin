# Step: implement

Build what the approved plan says. The plan and the requirements are fixed
now; the code is where the work happens.

## Rules

- Follow the tasks in order. Stay within the approved tasks and add no
  unrelated refactoring, even where the code invites it. Note what you would
  change as a follow-up for the report.
- Before you add a helper, search for code that already owns the behaviour,
  and say in one line what you found. Reuse it, or say why it does not fit.
- Add an abstraction or a dependency only for a concrete benefit the plan
  names. A dependency the plan does not name is not added.
- Never turn a failure into success. Do not swallow an error, return a
  default in place of a failed result, weaken or skip a test, or change an
  expected value so that a check passes. A failure you cannot fix is
  reported as a failure.
- Keep source and test files within the project's size limit: the one its
  `CLAUDE.md` or `AGENTS.md` names, or 500 lines when neither names one.
  Files that a tool generates and data files are exempt. Count the lines of
  a file before you change it. When a task as written would take a file
  past the limit, or leave a file that is already past it longer than it
  was before the work, put the new code in another file, keep every public
  contract the plan fixes, and go on. When the plan named the file, record
  that under "Deviations" in the report.
- Follow every decision record the plan links to. Its "Decision" and
  "Consequences" sections bind the code.
- Match the code around the change: naming, error handling, structure and
  the conventions in the project's `CLAUDE.md` or `AGENTS.md`.
- Before the first source change, note the commit the work starts from
  (`git rev-parse --short HEAD`) as `Base:` in `report.md`.
- Write a comment only to explain why: a constraint, a trade-off or
  behaviour that is not obvious. Do not describe what the code visibly does.
- Write code and its tests together, task by task. After each task, run the
  checks that cover it, so that a failure points at one change, and mark the
  task done under "Tasks" in `report.md`.

## When the plan does not fit

The freedom the plan leaves is yours: private names, internal structure, the
order of work inside a task. Using it is not a deviation.

A deviation is a task that cannot be done as written, a requirement that
cannot be met, a different public contract, or work the plan does not cover.

- A different public contract, work the plan does not cover and a conflict
  with an accepted decision record always change what the developer
  approved. Stop before the change. Explain it, change the plan (and write a
  superseding record through the design step when a decision changes), and
  run the approval command again.
- Any other deviation, while the requirements still hold: go on and record
  it under "Deviations" in the report, with the reason.

Do not edit the plan to match what you built without asking for approval
again. The hook ends the approval when an approved file changes, and it then
denies source changes.

## The shell

In a Git repository the hook compares the project's source before and after
every shell command and reports a change it would not have allowed to the
developer. After `/banzai:auto` it does not compare, because every change
passes there. Either way, change source files with the file tools. Use the
shell for what it is needed for: running checks, formatters, generators and
package managers.
