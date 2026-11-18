# Step: test

Show that the work does what the requirements say, with evidence a reader
can repeat.

## What to test

- Each behaviour the requirements promise, at the level where a user or a
  caller sees it.
- Failure paths the requirements name: bad input, a failed dependency, an
  interrupted operation, a denied permission.
- Each protection at a trust boundary. The test tries the forbidden thing
  and expects a refusal.
- A regression that could plausibly happen and would not be noticed.

Do not write a test per function, branch or requirement row. A test earns
its place when breaking the behaviour makes it fail: for an important test,
check that once by breaking the code and watching it fail.

## Rules

- Follow the project's existing test style, helpers and layout. Do not add a
  test framework or a mocking library the project does not use.
- Test behaviour, not implementation details that may change. Mock only what
  the test cannot run for real.
- Never weaken, skip or delete a test to make the suite pass. A test that is
  wrong is fixed, and the report says why it was wrong.
- A flaky test is a defect. Find the cause or report it; do not retry until
  it passes.

## Final verification

1. Run the formatter when the project has one, then the linter and the type
   check.
2. Run the whole test suite once, with the commands from the plan's
   "Verification" section.
3. Go through the requirements and the acceptance items one by one and name
   the code and the check behind each. Go through the plan's tasks and
   confirm that each is done or listed as a gap.
4. Do the plan's manual checks, or list them as not run.

Record every command exactly as you ran it, with its result, for the report.
A check that failed, was skipped or could not run is reported as such. When
neither `CLAUDE.md` nor the project's own scripts (package scripts, a
Makefile, CI) define a command for a check, say so in the report; do not
invent one.
