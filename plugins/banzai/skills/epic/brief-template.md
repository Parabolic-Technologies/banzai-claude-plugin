# Brief template

The brief is the owner's plan. `start` saves the owner's text and writes no
brief content of its own. Show these headings when the owner has no brief
yet. Only the stages with their gates, the packages and their "Done when"
items are required.

```markdown
# <Epic title>

<Date> · <owner's role>

<One paragraph: what the epic delivers and why.>

## Context

<The problem, the evidence and the constraints.>

## Decisions already made

- <Decision and its reason.>

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
