---
description: Prepare a project for banzai, once per project. Safe to run again.
argument-hint: ""
disable-model-invocation: true
---

# setup

Prepare this project for the banzai plugin. Every step is safe to repeat:
create what is missing, change nothing that is already right, and never
overwrite a file's other content.

The project root is the Git top level, or the working directory when the
project is not in Git. Change no source file.

## Steps

Create and change files with the file tools, not with shell commands, and in
this order. The plugin's hook starts to guard the project as soon as
`documentation/work/` exists, so that directory comes last.

1. `.gitignore`: add the line `.banzai/` unless a line already ignores that
   directory. The plugin keeps approval records there, and they are local.
2. `.claude/settings.json`: set `enabledPlugins["banzai@parabolic-plugins"]`
   to `true`. Unless `extraKnownMarketplaces` already has an entry named
   `parabolic-plugins`, add this one, so that a teammate's Claude Code knows
   where the plugin comes from:

   ```json
   "extraKnownMarketplaces": {
     "parabolic-plugins": {
       "source": { "source": "github", "repo": "Parabolic-Technologies/banzai-claude-plugin" }
     }
   }
   ```

   Keep every other key as it is. Create the file when it is missing.
3. `documentation/decisions/README.md`: when the directory has no index yet,
   create this file with the heading `# Decisions` and one line that says
   each decision record is listed here with its status.
4. `documentation/work/.gitkeep`: create it empty when the directory is
   missing or empty, so that Git keeps the directory for the whole team.

When the project was already set up, the hook may ask the developer before
a change to `.gitignore` or `.claude/settings.json`, or refuse it. If it
refuses, report the change that is still needed and do nothing else that
its message says.

## Project facts

The project's facts live in its own instructions file, which the developer
owns: `CLAUDE.md`, or `AGENTS.md` when the project has no `CLAUDE.md`. The
plugin has no template for it. Check that file, and the files it loads, for
the facts a model cannot derive from the code:

- the exact commands to build, test, lint and format;
- conventions the team chose, and constraints;
- a size limit for source and test files;
- the rule for adding a dependency;
- a link to `documentation/decisions/README.md`.

For each missing command, look for it in the project: package scripts, a
Makefile, CI configuration, the README. Then show the developer the exact
lines you would add and ask before you write them. Record only a command you
found in the project or the developer gave you; never guess one. When the
file names no size limit, offer one among those lines: the limit the
project's linter sets on the length of a file, or 500 lines for a source or
test file when it sets none, unless the developer names another number. Do
not describe architecture, modules or data flow; those are read from the
code.

Add the lines to the file that already holds the project's facts, which may
be one that `CLAUDE.md` loads, such as `AGENTS.md`. Never create a
`CLAUDE.md` beside an `AGENTS.md`: by default Claude Code loads `AGENTS.md`
only while the project has no `CLAUDE.md`. When the project has neither
file, create `CLAUDE.md`.

## Linter

When the project has no linter (no lint command, no linter configuration
file and no dependency on one), recommend one in the report: a single tool
that is standard for the project's main language and runs with the
toolchain the project already has. Give the command that installs it, a
minimal configuration and the command that runs it.

Where the tool can, that configuration limits the length of a file to the
project's size limit, and the complexity and the length of a function to
the tool's default values. Each limit is an error: one that only warns
does not fail the check, and code grows past it. Test files keep the limit
on a file and have none on the length of a function, because one function
often holds a whole suite. Say that code which already breaks a limit has
to be split, or recorded as an exception, in the work that adds the
linter.

When the project has a linter and its configuration lacks one of these
limits, or sets one as a warning, name what is missing in the report and
show the lines that set it, on the same terms, with one exception: a limit
the configuration already has keeps its value, and only its severity
changes.

Do not install a linter or change its configuration here: that adds a
dependency or changes source files, which is planned work the developer
starts with `/banzai:feature`.

## Report

List what you created, what you changed and what was already in place. Name
any fact that is still missing from the instructions file. Say that the
settings make the marketplace known but install nothing: each teammate opens
the project in Claude Code once, trusts the folder, and then runs
`claude plugin install banzai@parabolic-plugins --scope project`. Then name the
three commands that start work: `/banzai:fix <request>` for a small direct
change, `/banzai:feature <request>` for planned work, and
`/banzai:auto <request>` for planned work that runs with no approval of the
plan. Show these in a `text` code block, not a `bash` one: they go into the
message box, and the shell does not know them. Do not stage or commit.
