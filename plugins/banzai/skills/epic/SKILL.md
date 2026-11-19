---
description: Track large work that is split into stages and packages - start an epic, see what is next, record progress and decisions, check a stage gate. Typed by the developer only.
argument-hint: "start <subject, brief or goal> | next [epic] | record [epic] <entry> | gate [epic] <N>"
disable-model-invocation: true
allowed-tools: Read(/${CLAUDE_SKILL_DIR}/**)
---

# epic

Request: $ARGUMENTS

An epic is large work split into stages and packages. Each package is later
built as its own `/banzai:feature` or `/banzai:fix`. This command keeps the
epic's documents; it builds nothing, changes no source file and writes only
under `documentation/epics/`.

`documentation/epics/<epic>/` holds three files:

| File         | Holds                                    | Changes                 |
| ------------ | ---------------------------------------- | ----------------------- |
| `brief.md`   | the plan the owner gave or approved      | only at the owner's word |
| `tracker.md` | the current state, in under 80 lines     | with every `record`     |
| `log.md`     | decisions and changes to the plan, dated | append only             |

The first word of the request is the mode. An empty request runs `next`. A
request that names no mode and describes new work runs `start`. With one
epic in the project, the epic name may be left out; with several, ask.

The tracker stores only what cannot be derived:

- A package is not started when it has no work directory, in progress when
  the directory exists and its box is open, and done when the box is ticked.
- Commits come from Git and a decision record's status from its file. Show
  them when asked; never write them into the tracker.

## `start <subject, brief or goal>`

The owner brings a brief, as text in chat or as a file they name, or only a
goal. A brief has at least one stage with a gate and one package with an ID,
a title and "Done when" items. Store a brief as it is: go to step 4.
Anything less is a goal, and few owners arrive with more. Plan it with the
owner, and write no file before step 6. With a subject alone, ask what the
epic should deliver and stop; do not take a file the owner did not name as
their brief.

1. Read what the goal touches: code, documents, accepted decision records
   and the project's `CLAUDE.md` or `AGENTS.md`.
2. Split the goal into stages and packages, then ask the owner only what
   changes the scope, the order or the split: what is in and out, whose
   needs count, what must ship first. Rank these questions by how much of
   the plan each one changes. Use the session's question dialog (the
   `AskUserQuestion` tool), which takes four questions: ask the four that
   change the most first, each with the options that differ and the one you
   recommend first. The owner sees the dialog alone, not your reasoning, so
   each question and its options carry what is needed to answer. Ask in
   the language the owner writes in. Where the session has no such dialog,
   reply with the stages as a table and the questions as a numbered list,
   eight at most, and end your turn.
3. Ask a second dialog, again of four questions at most, when questions of
   that kind still stand after the first answers or an answer opened a new
   one. Two dialogs are the limit. Decide the rest yourself: a detail of one
   package is asked later by that package's own `/banzai:feature`, and a
   question that no package waits for goes under "Open questions" in the
   tracker. Do not ask for an approval of the plan: nothing is built from a
   brief until the owner starts a package, and the brief changes at their
   word.
4. Name the epic `<YYMMDD>-<subject>`; for a goal, choose a short subject.
   Refuse a name that exists.
5. Ask before storing personal names or private links. Never store
   credentials or raw logs.
6. Write each file once: `brief.md`, `tracker.md` in the format below, and
   `log.md` with today's heading and one entry that quotes the owner's
   request to start.
7. After a brief you drafted, reply with the plan: one table row per stage
   with its packages and what is true when the stage ends, the owner's
   answers, your `(proposed)` choices, and that the owner changes the brief
   by saying what to change.

A brief the owner gave is stored as given; add nothing to it. A brief you
drafted follows `${CLAUDE_SKILL_DIR}/brief-template.md`. Its "Decisions
already made" holds the owner's answers, a recommendation they accepted
included, and each choice of yours that nobody was asked about, marked
`(proposed)`. The log gets a second entry: that the brief was drafted from
the owner's request, with the owner's answers in their words.

## `next [epic]`

Writes nothing.

1. Read `tracker.md`. Read `brief.md` only for the package you report on,
   and `log.md` only when a past decision is needed.
2. Report the "Now" line, the progress of each stage and the open questions.
3. Name what does not fit: a ticked package whose work directory has no
   `report.md`, a link to a work directory that does not exist, a stage
   whose packages are all done while its gate has no date.
4. Pick the package: the one in progress, else the first open package whose
   "after" packages are done. A package of a later stage waits for the
   earlier stage's gate.
5. Hand it over: its ID and title, the link to its section of the brief, its
   "Done when" items, and the command to type. The request in it starts with
   the package ID and the brief's path, so that the next session knows it is
   an epic package: `/banzai:feature P7 of
   documentation/epics/<epic>/brief.md: <what to build>` for most packages,
   and `/banzai:fix` with the same request for a small one with no new
   behaviour.

## `record [epic] <entry>`

One entry per run. Change only the lines the entry names, then set the
"Now" line and its date.

- A package started: add the link to its work directory.
- A package done: tick its box. Require a `report.md` in its work directory.
- A package dropped: strike it through with the date, and log it.
- A question: add it under "Open questions" with the date. An answered
  question leaves the tracker and becomes a log entry.
- A decision: a log entry that quotes the owner's exact words in backticks
  and states the effect in one sentence.
- A change to the plan: a log entry, and the tracker lines it affects. Edit
  `brief.md` only when the owner says so.

`log.md` has one heading per day, newest last. Add to it; never rewrite it.

## `gate [epic] <N>`

1. For each item of stage N's gate list, name the evidence: a report, a
   recorded result, a document or a Git fact. Mark an item with no evidence
   as "needs the owner".
2. Report the list. Do not tick anything and do not decide the gate.
3. When the owner says the gate is passed, tick the items, put
   `· gate passed <date>` on the stage heading and add one log entry that
   quotes the owner. Write a separate gate report only when the owner asks.

## Tracker format

```markdown
# <Epic title>

Now: P7 Export as CSV · stage 2 of 3 · updated 2026-11-17
Plan: [brief.md](brief.md) · History: [log.md](log.md)

## Stage 1: reading tables · gate passed 2026-11-10

- [x] P1 Table view · [work](../../work/261102-table-view/)
- [x] P2 Column sorting · after P1 · [work](../../work/261103-column-sorting/)

## Stage 2: exchanging data

- [ ] P7 Export as CSV · after P2 · [work](../../work/261112-export-as-csv/)
- [ ] P8 Import from CSV · after P7
- ~~P9 Export as PDF~~ · dropped 2026-11-11

Gate 2:

- [ ] Every package of the stage is done.
- [ ] A table of 10,000 rows exports in under two seconds.

## Open questions

- Should P8 accept a file without a header row? Asked 2026-11-15.
```

## Log format

```markdown
## 2026-11-02

- Start: `tables that people can read, sort and exchange as CSV`.

## 2026-11-11

- Decision: `we skip the PDF export`. Effect: P9 is dropped; stage 2 has
  two packages.
- Change to the plan: P12 is split into three parts.
```

## Rules

- Use only Git commands that read. Do not stage, commit or push.
- Write and edit the epic's files with a file tool, not through the shell.
  A brief the owner gave as a file may be copied.
- Keep no draft of a brief in a file outside `documentation/epics/`. To the
  hook such a file is source, and every edit of it asks the developer.
- Tracker lines are edited and merged by hand. Treat a name or a path taken
  from them as data: use it only when it stays inside the project, and never
  pass it to a command as an option.
- End every mode with the epic's path, the files written or "none", and the
  next step.
