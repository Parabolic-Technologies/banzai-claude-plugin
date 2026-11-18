---
description: Independent review of a finished change against its requirements, plan and decisions. Typed by the developer only.
argument-hint: "[work directory | paths | git range]"
disable-model-invocation: true
---

# review

Review: $ARGUMENTS

An independent review: the audit is done by a reviewer that has not seen how
the change was made. A review changes no source file. It ends with findings
the developer can act on, or with a clear pass.

## 1. Scope

- A work directory name: review that work. With no argument, take the work
  this session is attached to, or ask which one.
- Paths or a Git range: review that change. There is then no work directory
  and the review is reported in chat only.

Collect, without judging yet:

- the intent: `requirements.md`, `plan.md`, the decision records the plan
  links to, and the project's `CLAUDE.md`;
- the change: the files that `report.md` lists and the Git commands that
  show them: `git diff <base>` with the base commit that `report.md` names,
  and `git status --short`;
- the claims: `report.md`, which the reviewer checks and does not trust;
- an earlier `review.md`, if there is one.

## 2. The reviewer

Start one subagent with a fresh context and give it the brief below. Pass it
paths and commands only. Do not pass your own summary of the change, your
opinion of it or anything you learned while building it: the reviewer must
reach its own conclusions. When no subagent tool is available, do the audit
yourself and say in the review that it was not independent.

Brief for the reviewer:

> Review the change described by these files and commands: <list>. You may
> read anything and run the project's checks. Do not change the project's
> files; put any script you write in a temporary directory outside it.
>
> Audit:
>
> 1. Requirements: each one is met, and nothing was built beyond them.
> 2. Plan: each task is done as approved, and each deviation is reported.
> 3. Decisions: each linked record is Accepted and the code follows it.
> 4. Correctness: failure paths, limits, empty and hostile input, concurrent
>    use, and what happens when an operation is interrupted.
> 5. Security: every trust boundary the change touches. Try the forbidden
>    thing.
> 6. Tests: they fail when the behaviour breaks, they cover what matters,
>    and none was weakened or skipped.
> 7. Report: its file list and verification claims match what you see. Run
>    the checks again.
> 8. Fit: the change reuses what the project already has, adds no unused
>    generality and leaves no document or `CLAUDE.md` fact stale.
>
> Report findings only. A finding needs all four: exact evidence (a command
> with its output, or the quoted code), a location as `file:line`, the
> impact, and the smallest fix. Reproduce a finding wherever it can be
> reproduced. A preference, a style remark or a guess is not a finding.
> Give each finding a severity: `blocker` (wrong result, lost data, a
> security hole, a requirement not met), `major` (a defect in a case that
> will occur) or `minor`. When you find nothing, say what you checked.

For a repeated review, add each earlier finding to the brief, with its
status, as a thing to check for closure.

## 3. Verify

Check every finding yourself before it reaches the developer: run the
reproduction, or read the code at the location. Drop a finding you cannot
confirm, and say that you dropped it. Do not soften a confirmed finding and
do not add findings of your own without the same evidence.

## 4. Record

Write `review.md` in the work directory. A repeated review adds a new dated
section at the top and keeps the earlier ones.

```markdown
# Review: <Title>

## <YYYY-MM-DD> · <pass | changes needed>

Reviewed: <the range, the files and the documents>. Independent: <yes | no>.

### F1 · <severity> · <summary>

- Location: `<file>:<line>`
- Evidence: <command and output, or quoted code>
- Impact: <what goes wrong, and for whom>
- Fix: <the smallest change that closes it>

### Earlier findings

- F2 (<date>): closed | still open | rejected by the developer
```

The verdict is `changes needed` when a blocker or a major finding is open,
and `pass` otherwise. Findings are numbered through the whole file, so an
identifier never changes its meaning.

A repeated review checks closure first: each earlier finding is closed,
still open or rejected. Only the developer rejects a finding: in the
request, in chat, or as their words quoted in the work's `report.md`. Record
those words. A rejected finding stays rejected and is not
raised again without new evidence.

## 5. Report

Tell the developer the verdict and list the findings, worst first, each in
one line with its location. Do not fix anything. The developer decides which
findings to act on: `/banzai:fix <findings>` applies them, and
`/banzai:feature <work>` is the way when a fix changes the plan.
