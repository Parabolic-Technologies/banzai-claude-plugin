# Step: design

A decision record states one technical decision that is costly to reverse:
a data model, a public API, a new dependency, a security boundary, or a
choice that many parts of the code will have to follow. It records the
decision. It does not authorize work; only the developer's approval of the
plan does.

Skip this step when an accepted record already covers the question: the plan
links that record.

## Before writing

- Read `documentation/decisions/README.md` and the records that touch the
  same area. A new decision that contradicts an accepted one supersedes it
  openly; it never ignores it.
- Compare at least two real options against the requirements and the code as
  it is. If you cannot name what would make each option the better one, you
  do not know enough yet: read more or ask the developer.

## Document

Write `documentation/decisions/<NNNN>-<subject>.md`. `NNNN` is the next free
four-digit number in that directory.

```markdown
# <NNNN> <Title>

Status: Proposed · <YYYY-MM-DD>

## Context

<The question, what forces it now, and the constraints.>

## Decision

<What is chosen, stated so that code can be checked against it.>

## Options considered

- <Option>: <why it was not chosen>.

## Consequences

<What becomes easier, what becomes harder, and what must now stay true.>
```

Keep it to one page. A record holds one decision.

## Acceptance

Show the developer the decision and the options you rejected, and ask
whether they accept it. Do not answer for them. A request that leaves the
choice to you asks for your proposal; it does not accept it. The status
becomes Accepted only after the developer has seen this record and said yes.
When nobody can answer, leave the record Proposed, stop before the plan and
say that the record waits for the developer.

- Accepted: change the status line to `Status: Accepted · <date>` and add
  the record to `documentation/decisions/README.md` as
  `- [<NNNN> <Title>](<file>) · Accepted <date>`.
- Changed: rewrite the record and ask again.
- Rejected: delete the record. A status is one of Proposed, Accepted and
  Superseded.

Do this before the plan is written. The approval of the plan covers the
content of every record the plan links to, so a record edited after the
approval ends it.

## Lifecycle

- A plan links only records with status Accepted.
- The body of an accepted record is never rewritten. To change a decision,
  write a new record that names the old one, then set the old record's
  status line to `Status: Superseded by <NNNN> · <date>` and update the
  index.
