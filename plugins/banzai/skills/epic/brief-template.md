# Brief template

The brief is the owner's plan. `start` stores the owner's text as it is, or
drafts a brief under these headings from the owner's goal and answers; the
owner then changes it by saying what to change. Only the stages with their
gates, the packages and their "Done when" items are required.

```markdown
# <Epic title>

<Date> · <owner's role>

<One paragraph: what the epic delivers and why.>

## Context

<The problem, the evidence and the constraints.>

## Decisions already made

- <Decision and its reason. In a drafted brief: the owner's answer, or a
  choice nobody was asked about, marked `(proposed)`.>

## Stage 1: <name>

Goal: <what is true when the stage ends>.

### P1 · <Package title>

**Where.** <Files, modules or documents.>

**Change.** <What changes.>

**Done when.** <Results that can be observed, one per item. They become the
package's requirements.>

**After.** <The packages that must be done first, or none.>

### Gate 1

- [ ] <Evidence the owner checks before the next stage starts.>

## Out of scope

- <What this epic does not do.>
```
