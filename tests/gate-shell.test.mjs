// Changes made through the shell and other tools.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  COMMAND, SUMMARY, dataOf, repo, put, hook, pre, write, shell, post, entry, recordExists,
  approve, plannedRepo, git, gitRepo, call, nothing
} from './helpers.mjs';

test('a shell change to source without approval is remembered, and the next call asks', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  const first = call(root, () => { put(root, 'src/new.js', 'x\n'); put(root, 'src/base.js', 'changed\n'); });
  assert.equal(first.before.decision, null);
  assert.match(first.note, /changed source files without the developer's approval: src\/base\.js, src\/new\.js/);

  const asked = shell(root, 'ls');
  assert.equal(asked.decision, 'ask');
  assert.match(asked.reason, /\n {2}• src\/base\.js\n {2}• src\/new\.js\n/);
  assert.equal(shell(root, 'ls').decision, 'ask', 'no answer yet');

  const accepted = call(root, nothing);
  assert.equal(accepted.before.decision, 'ask');
  assert.equal(accepted.note, '');
  assert.equal(shell(root, 'ls').decision, null, '"Yes" accepted the changes');
});

test('changes to documentation, ignored files and the gate state are not source changes', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  const out = call(root, () => {
    put(root, 'documentation/notes.md', 'x\n');
    put(root, 'CLAUDE.md', 'x\n');
    put(root, 'build/out.js', 'x\n');
    put(root, '.banzai/other.txt', 'x\n');
  });
  assert.equal(out.note, '');
  assert.equal(shell(root, 'ls').decision, null);
});

test('a session that may change source is not asked about shell changes', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:fix', 'typo');
  assert.equal(call(root, () => put(root, 'src/base.js', 'fixed\n')).note, '');

  entry(root, 'banzai:feature', 'demo');
  approve(root, 'demo');
  assert.equal(call(root, () => put(root, 'src/base.js', 'planned\n')).note, '');
  assert.equal(shell(root, 'ls').decision, null);
});

test('without an entry command a shell change is asked about', () => {
  const root = gitRepo();
  assert.match(call(root, () => put(root, 'src/base.js', 'x\n')).note, /src\/base\.js/);
  assert.equal(shell(root, 'ls').decision, 'ask');
});

test('a failed or stopped command is compared too', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  assert.match(call(root, () => put(root, 'src/a.js', 'x\n'), { event: 'PostToolUseFailure' }).note, /src\/a\.js/);
  const stopped = call(root, () => put(root, 'src/b.js', 'x\n'), { event: 'PostToolUseFailure', fields: { is_interrupt: true } });
  assert.equal(stopped.before.decision, 'ask');
  assert.match(stopped.note, /src\/b\.js/);
  assert.match(shell(root, 'ls').reason, /src\/a\.js\n {2}• src\/b\.js/, 'a stopped call accepted nothing');
});

test('a change committed by the same command is still seen', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  const out = call(root, () => {
    put(root, 'src/base.js', 'committed\n');
    git(root, 'commit', '-q', '-am', 'sneak');
  });
  assert.match(out.note, /src\/base\.js/);
});

test('committing or reverting files changes nothing by itself', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:fix', 'typo');
  put(root, 'src/base.js', 'edited with approval\n');
  put(root, 'src/new.js', 'new\n');
  entry(root, 'banzai:feature', 'demo');
  const committed = call(root, () => { git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', 'work'); });
  assert.equal(committed.note, '');
  put(root, 'src/base.js', 'dirty\n');
  const reverted = call(root, () => git(root, 'checkout', '--', 'src/base.js'));
  assert.match(reverted.note, /src\/base\.js/, 'a revert is a change to source');
});

test('earlier unapproved changes are accepted in their own dialog, before the approval dialog', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  call(root, () => { for (let i = 1; i <= 9; i += 1) put(root, `src/early-${i}.js`, 'x\n'); });
  const refused = shell(root, `${COMMAND} demo`);
  assert.equal(refused.decision, 'deny', 'their list would fold the plan out of the dialog');
  assert.match(refused.reason, /changed before this approval: src\/early-1\.js, .* and more\. The developer accepts them first/);
  assert.equal(recordExists(root), false);
  const accept = shell(root, 'git status');
  assert.equal(accept.decision, 'ask');
  assert.match(accept.reason, /src\/early-9\.js/);
  post(root, 'Bash', {}, accept.id);
  const asked = shell(root, `${COMMAND} demo`);
  assert.equal(asked.decision, 'ask');
  assert.match(asked.reason, /^Build the demo\.\nApproval requested for work "demo"\.\n/);
  assert.doesNotMatch(asked.reason, /early/);
  post(root, 'Bash', {}, asked.id);
  assert.equal(shell(root, 'ls').decision, null);
  assert.equal(write(root, 'src/a.js').decision, null);
});

test('a typed entry command starts over', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  call(root, () => put(root, 'src/early.js', 'x\n'));
  entry(root, 'banzai:fix', 'keep going');
  assert.equal(shell(root, 'ls').decision, null);
});

test('MCP tools are compared, and the shell takes the question', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  const tool = 'mcp__editor__replace_content';
  assert.match(call(root, () => put(root, 'src/base.js', 'via mcp\n'), { tool }).note, /src\/base\.js/);
  const denied = pre(root, 'mcp__docs__search', { query: 'x' });
  assert.equal(denied.decision, 'deny');
  assert.match(denied.reason, /src\/base\.js.*Run one, for example: git status$/);
  assert.equal(shell(root, 'git status').decision, 'ask');
});

test('the hook is registered for the tools that can change files, and no others', () => {
  const config = JSON.parse(fs.readFileSync(new URL('../plugins/banzai/hooks/hooks.json', import.meta.url), 'utf8')).hooks;
  for (const event of ['PreToolUse', 'PostToolUse', 'PostToolUseFailure']) {
    const matcher = new RegExp(config[event][0].matcher);
    for (const tool of ['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Bash', 'Monitor', 'PowerShell', 'mcp__a__b', 'mcp__ccd_session__start_session']) assert.equal(matcher.test(tool), true, tool);
    // The desktop app draws its task list and its summary with these two.
    for (const tool of ['TodoWrite', 'Read', 'BashOutput', 'Agent', 'mcp__ccd_turn__update_plan', 'mcp__ccd_turn__wrap_up']) assert.equal(matcher.test(tool), false, tool);
  }
  assert.ok(config.SessionStart && config.UserPromptExpansion);
});

test('a work typed as a path or with punctuation is the same work', () => {
  for (const typed of ['documentation/work/alpha continue', './documentation/work/alpha/ continue', 'alpha, then add JSON', '`alpha` continue']) {
    const root = plannedRepo('alpha');
    approve(root, 'alpha', { session_id: 's0' });
    entry(root, 'banzai:feature', typed);
    assert.equal(write(root, 'src/a.js').decision, null, typed);
  }
  // Another path that only ends in the name is not the work.
  const root = plannedRepo('alpha');
  approve(root, 'alpha', { session_id: 's0' });
  entry(root, 'banzai:feature', 'src/alpha continue');
  assert.equal(write(root, 'src/a.js').decision, 'deny');
  // The exact word wins over its trimmed form.
  const both = plannedRepo('alpha');
  put(both, 'documentation/work/alpha./plan.md', '# Other\n' + SUMMARY);
  approve(both, 'alpha', { session_id: 's0' });
  entry(both, 'banzai:feature', 'alpha. continue');
  assert.match(write(both, 'src/a.js').reason, /alpha\./);
});

test('every skill is typed by the developer only, and the skill text stays within its budget', () => {
  const skills = fileURLToPath(new URL('../plugins/banzai/skills/', import.meta.url));
  const files = fs.readdirSync(skills, { recursive: true }).filter((name) => name.endsWith('.md'));
  const read = (name) => fs.readFileSync(path.join(skills, name), 'utf8');
  for (const name of ['setup', 'fix', 'feature', 'review', 'epic']) {
    assert.match(read(`${name}/SKILL.md`), /^---\n[\s\S]*?\ndisable-model-invocation: true\n[\s\S]*?---\n/, name);
  }
  // The hook answers this exact command with the approval dialog.
  assert.match(read('feature/SKILL.md'), /```bash\n: banzai-request-approval <work>\n```/);
  const lines = files.reduce((sum, name) => sum + read(name).split('\n').length - 1, 0);
  assert.ok(lines <= 1500, `${lines} lines of skill text`);
  // `setup` writes the install id into a project, so it must match the manifests.
  const manifest = (rel) => JSON.parse(fs.readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
  const id = `${manifest('../plugins/banzai/.claude-plugin/plugin.json').name}@${manifest('../.claude-plugin/marketplace.json').name}`;
  assert.equal(id, 'banzai@parabolic-plugins');
  assert.ok(read('setup/SKILL.md').includes(`enabledPlugins["${id}"]`) && read('setup/SKILL.md').includes(`claude plugin install ${id}`));
  // An installed plugin is a copy of its own directory alone, so the licence travels in it.
  const top = (rel) => fs.readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');
  for (const name of ['LICENSE', 'NOTICE']) assert.equal(top(`plugins/banzai/${name}`), top(name), name);
  assert.ok(top('README.md').includes(`claude plugin install ${id}`));
});

test('outside a Git repository shell changes are not seen', () => {
  const root = plannedRepo();
  entry(root, 'banzai:feature', 'demo');
  assert.equal(call(root, () => put(root, 'src/a.js', 'x\n')).note, '');
});

test('a lock left by a dead hook process is broken', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:fix', 'typo');
  const lock = path.join(dataOf(root), 'sessions/s1.lock');
  fs.mkdirSync(lock);
  const old = new Date(Date.now() - 60000);
  fs.utimesSync(lock, old, old);
  entry(root, 'banzai:feature', 'demo');
  assert.equal(write(root, 'src/a.js').decision, 'deny');
  assert.equal(fs.existsSync(lock), false);
});

test('session start tells the model where the session stands', () => {
  const root = plannedRepo('alpha');
  put(root, 'documentation/work/beta/plan.md', '# Beta\n' + SUMMARY);
  fs.mkdirSync(path.join(root, 'documentation/work/no-plan'));
  approve(root, 'alpha', { session_id: 's0' });
  approve(root, 'beta', { session_id: 's0' });
  put(root, 'documentation/work/beta/plan.md', '# Beta, changed\n' + SUMMARY);
  const start = (fields = {}) => hook(root, { hook_event_name: 'SessionStart', source: 'startup', ...fields }).additionalContext;

  const fresh = start();
  assert.match(fresh, /\/banzai:fix/);
  assert.match(fresh, /\/banzai:review <work>/);
  assert.match(fresh, /: banzai-request-approval <work>/);
  assert.match(fresh, /alpha \(approved\)/);
  assert.match(fresh, /beta \(approval ended, documentation\/work\/beta\/plan\.md changed\)/);
  assert.doesNotMatch(fresh, /no-plan/);
  assert.match(fresh, /This session: no entry command typed yet\./);

  entry(root, 'banzai:feature', 'alpha');
  assert.match(start({ source: 'resume' }), /This session: attached to work "alpha"\./);
  entry(root, 'banzai:fix', 'typo');
  assert.match(start({ source: 'compact' }), /This session: started with \/banzai:fix\./);

  const elsewhere = repo({ adopted: false });
  assert.equal(hook(elsewhere, { hook_event_name: 'SessionStart', source: 'startup' }), null);
});
