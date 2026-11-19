# Step: requirements

`requirements.md` says what must be true when the work is done. It does not
say how to build it.

## Before writing

- Read what the request touches: code, tests, documents, accepted decision
  records and the project's `CLAUDE.md` or `AGENTS.md`.
- Ask the developer only about substance: what the feature covers and for
  whom. Substance is open when the request names a kind of thing but not
  which ones (which languages, which formats, which users), or can be read
  in ways that give users different things. Only the request, the code or a
  project convention settles such a question; your own preference does not.
  Ask these questions together, three at most, each with the answer you
  recommend, then end your turn and write the file after the developer has
  answered. When nobody can answer, stop and say what waits for the
  developer.
- Decide the form yourself: names of options and fields, codes, formats,
  messages, error behaviour. Record each under "Decisions" with the tag
  `default`.
- For an epic package, each "Done when" item of the brief becomes a
  requirement, and the document links the brief's section.

## Document

```markdown
# Requirements: <Title>

<What the change does, the main flow, and what it does not do.>

## Requirements

- R1. <One statement that a test or a person can check.>
- R2. ...

## Acceptance

- Given <state>, when <action>, then <result a user or caller can see>.

## Decisions

- <A choice made while writing this.> (developer | existing behaviour |
  project convention | default)

## Decision records needed

- <A question the design step must settle, and the requirements it affects.>

## Open questions

None.
```

## Rules

- Use exact names for commands, APIs, fields, files, formats, states and the
  order of results. Quote user-facing text exactly.
- State what happens on an error, on empty input and when an operation is
  interrupted, wherever the change has such a case.
- When the change crosses a trust boundary (input from outside,
  authentication, permissions, secrets, files or commands built from data),
  write the protection as an ordinary numbered requirement.
- Tag each decision by where it comes from, with one tag from the list.
  `developer` is for the developer's own words, a recommendation of yours
  that they accepted included. `existing behaviour` and `project convention`
  name the code or the document that shows it. `default` is your own choice
  that nobody was asked about; never give it another tag.
- Write no file layout, class design or other implementation detail, and
  choose no technical solution here.
- A requirement that cannot be checked is rewritten until it can.
- Leave out a section that would be empty, except "Open questions". It must
  read `None.` before the plan is written.
