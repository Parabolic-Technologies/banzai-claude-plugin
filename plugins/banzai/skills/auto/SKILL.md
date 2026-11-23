---
description: Plan, build, review and fix a change in one run, with no approval of the plan. Questions come once, at the start. Typed by the developer only.
argument-hint: "<what to build> | <work name> [what to do next]"
disable-model-invocation: true
allowed-tools: Read(/${CLAUDE_PLUGIN_ROOT}/skills/**), Skill(banzai:audit)
---

# auto

Request: $ARGUMENTS

Planned work that runs to its end without a stop. The developer typed this
command, and that is the go-ahead to plan, build, review and fix this
request with no approval of the plan. It covers this request, not whatever
else you notice on the way.

The developer may not be watching. After step 2, ask nothing and wait for
nothing: decide, record the decision and go on. What the developer is sure
to read is your last message, so step 9 puts everything they need there.

The work's documents live in `documentation/work/<work>/`: `requirements.md`,
`plan.md`, `report.md` and `review.md`. Steps 3, 4, 6, 7 and 8 have guides in
`${CLAUDE_PLUGIN_ROOT}/skills/feature/steps/`. Read a guide when you reach
its step. The guides are written for `/banzai:feature`: where one tells you
to ask the developer, to wait for an answer or to run the approval command,
do what this file says in its place.

## 1. Start or continue

If the project has no `documentation/work/` directory, stop and ask the
developer to type `/banzai:setup` first.

If the request's first word names a directory in `documentation/work/`, by
its name or its path, continue that work: read its documents and go on from
the first step that is not finished. The rest of the request says what to do
next.

Otherwise start new work. Name it `<YYMMDD>-<subject>`: today's date and two
to five lowercase words joined by hyphens, such as `261118-export-as-csv`.
Use ASCII letters and digits only, whatever language the request is in: the
hook does not recognise a work under another name. Read the code, the tests
and the project's `CLAUDE.md` or `AGENTS.md` that the request touches before
you write anything. Note the commit the work starts from
(`git rev-parse --short HEAD`) and whether the working tree already has
changes of its own (`git status --short`).

## 2. Fit and questions

Do this before you write any file or change anything in the project,
installed packages included. It is the only point where the developer is
asked.

Stop, say why and suggest `/banzai:feature <request>` when the work decides
something that is costly to reverse and no accepted decision record covers
it: a data model (the format or the place of data kept between runs
included), a public API, a new dependency, a security boundary, or a choice
that many parts of the code will have to follow. Name the decision.

One such decision goes into the dialog below instead of a stop, when a
single question settles it: you can lay out the real options in a few lines,
and the developer can choose without reading the code. Whether to add one
new endpoint, and what it returns, is such a question. The answer is the
developer's decision: go on with it. A request that names the choice, a
package for example, has not settled it: ask all the same, and say what the
project already has in its place or says against it. Stop when the work
holds several such decisions, when one needs options compared in more depth
than a question holds, or when the session has no dialog or nobody answers
it. Such a decision is never your own choice.

Then decide what else to ask. Substance is what the change covers and for
whom. It is open when the request names a kind of thing but not which ones
(which language, which formats, which users), when it can be read in ways
that give users different things, or when it would change what users get
today and does not say so. Only the request, the code or a project
convention settles such a question; your own preference does not. When
substance is open, ask: this is the developer's one chance to decide it, and
a question you do not ask becomes your guess in their product. Decide the
form yourself: names of options and fields, codes, formats, messages, error
behaviour. Ask nothing more when the substance is settled.

Use the session's question dialog (the `AskUserQuestion` tool), once: four
questions at most, the ones that change the most, each with the options that
differ and the one you recommend first. The developer sees the dialog alone,
so each question and its options carry what is needed to answer. Ask in the
language the developer writes in.

Where the session has no such dialog, or nobody answers it, take the answer
you would have recommended and treat it as your own choice, except for a
decision that is costly to reverse: there, stop.

## 3. Requirements

Always write `requirements.md`: the reviewer checks the plan and the code
against it. Guide: `requirements.md`. Open the document with the developer's
request, quoted exactly. Tag the answers of step 2 `developer` and every
choice of yours `default`.

## 4. Plan

Write `plan.md` with a file tool. Guide: `plan.md`. Write its "For approval"
section as the guide says: your last message quotes it, and it is what the
developer approves if they later type `/banzai:feature <work>`. Do not run
the approval command: this work needs none.

## 5. Plan review

Call the Skill tool with the skill `banzai:audit` and the args
`plan <work>`, with nothing added: it starts a reviewer that has not seen
this conversation. Wait for its findings before you do anything else.

Check every finding yourself: read the lines it cites. Drop a finding you
cannot confirm, and keep it for your last message. Correct `requirements.md`
and `plan.md` for each confirmed finding, a `minor` one included: before the
code exists, a correction costs a line of the plan, and a finding left open
here comes back in the built change. Review the plan once; do not call the
audit for it again.

Start `review.md` in the work directory with the heading `# Review: <Title>`
and a section `## <YYYY-MM-DD> · plan audit`: each finding in one line, with
its severity and what you did with it (corrected, left open or dropped), or
that there were none. No other file holds the reviewer's findings.

A confirmed finding that the work decides something costly to reverse, which
the developer did not decide in step 2, ends the run: stop as in step 2,
before any source change.

## 6. Implement

Guide: `implement.md`. When the work needs a different public contract or
work the plan does not cover, change `requirements.md` and `plan.md` first,
record the change under "Deviations" in `report.md` and go on.

## 7. Test

Guide: `test.md`.

## 8. Review and fix

Complete `report.md`. Guide: `report.md`. Then call the Skill tool with
`banzai:audit` and the args `change <work>`, and wait for its findings.

Check every finding yourself, inside the working copy: run the reproduction,
or read the code at the location. Drop a finding you cannot confirm.

Before you record the review, read section 4, "Record", of
`${CLAUDE_PLUGIN_ROOT}/skills/review/SKILL.md`, and add a dated section in
exactly that format to `review.md`, above the plan audit. Read that section
only; the rest of that file is for another command. When the Skill call
fails, do the audit yourself and write `Independent: no`.

Fix each confirmed `blocker` and `major` finding with the smallest change
that closes it, and run the checks that cover it. For a defect that could
come back, write the test that fails without the fix first. Leave a `minor`
finding open. A fix that needs a different design is not made: the finding
stays open. Never reject a finding; only the developer does.

After fixes, call the audit with `change <work>` once more. Add a dated
section to `review.md`: each earlier finding closed or still open, and any
new finding. Do not fix the new ones: one round of fixes is the limit. Then
bring `report.md` up to date with what the fixes changed.

## 9. The last message

Write it in the language the developer writes in, short, in this order.
When the run stopped early, start with the step it stopped at and why.

1. **Built**: the lines of the plan's "For approval" section, and whether
   the work is complete.
2. **You decided**: the answers of step 2, or that nothing was asked.
3. **Decided for you**: each choice tagged `default`, one line each.
4. **Review**: the verdict; each finding that was fixed, each one still
   open with its location, and each one you dropped; what the reviewer did
   not check.
5. **Checks**: each command with its result, failures first.
6. **The change**: `git diff <base>` shows it, and the files it created are
   listed. When the working tree had changes of its own at the start, say
   that the diff shows those too. Revert nothing yourself.
7. **Next**: `/banzai:fix <findings>` for open findings,
   `/banzai:feature <work>` when one needs a different plan, and
   `/banzai:review <work>` for another independent review.

Show a command the developer is to type in a `text` code block, not a `bash`
one: it goes into the message box, and the shell does not know it. For an
epic package, leave the epic's tracker and log alone and name
`/banzai:epic record <package> done` as the next step. Do not stage, commit
or push unless the developer asks.
