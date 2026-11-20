// Paths, session state, approval records and source snapshots for the banzai
// gate. Everything here is plain file work and Git: no dependencies, no build.
//
// Approval records live in the project, under `.banzai/approvals/`. Session
// state lives in the plugin's data directory, outside the project, so that a
// command which cleans or moves the project cannot remove it.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const WORK_DIR = 'documentation/work';
export const DECISIONS_DIR = 'documentation/decisions';
export const RECORDS_DIR = '.banzai/approvals';
export const NOT_COMPARED = '(a tool call could not be compared)';
export const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const FREE_FILES = new Set(['CLAUDE.md', 'AGENTS.md']);
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LOCK_STALE_MS = 5000;
const MAX_LINKS = 40;
const BIG_FILE = 8 * 1024 * 1024;
const MAX_HASHED_UNTRACKED = 1000;

export const dataDir = () => process.env.CLAUDE_PLUGIN_DATA || path.join(os.homedir(), '.claude', 'banzai');

export const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

// The real location of a path that may not exist yet: symlinks are resolved
// for the part that exists, and a dangling link is followed to its target.
export function realish(target) {
  let current = path.resolve(target);
  const tail = [];
  let links = 0;
  for (;;) {
    try {
      return path.join(fs.realpathSync.native(current), ...tail);
    } catch {}
    let dangling = false;
    try {
      dangling = fs.lstatSync(current).isSymbolicLink();
    } catch {}
    if (dangling) {
      if (++links > MAX_LINKS) throw new Error(`too many symbolic links in ${target}`);
      current = path.resolve(path.dirname(current), fs.readlinkSync(current));
      continue;
    }
    const parent = path.dirname(current);
    if (parent === current) return path.join(current, ...tail);
    tail.unshift(path.basename(current));
    current = parent;
  }
}

// A project has adopted banzai when it has a `documentation/work/` directory.
// The nearest such ancestor of `start` is the project.
export function findRoot(start) {
  if (!start) return null;
  let current = realish(start);
  for (;;) {
    if (isDir(path.join(current, WORK_DIR))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

// Path of `target` inside the project, with forward slashes, or null when the
// real target is outside the project.
export function relativeTo(root, target) {
  const rel = path.relative(root, realish(target));
  if (!rel || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

// The records directory exists before any path is classified, so the file
// system itself maps every spelling it treats as equal onto the real name.
export function ensureState(root) {
  fs.mkdirSync(path.join(root, RECORDS_DIR), { recursive: true });
}

// Whether a write target is the gate's own state: a record in the project,
// or anything in the plugin's data directory.
export function isState(root, target) {
  const real = realish(target);
  const data = realish(dataDir());
  if (real === data || real.startsWith(`${data}${path.sep}`)) return true;
  const folded = (relativeTo(root, real) || '').normalize('NFKC').toLowerCase();
  return folded === RECORDS_DIR || folded.startsWith(`${RECORDS_DIR}/`);
}

export function isFree(rel) {
  return rel.startsWith('documentation/') || FREE_FILES.has(rel);
}

// Source, for the comparison around a tool call: not free and not under .banzai/.
const isSource = (rel) => !isFree(rel) && !rel.normalize('NFKC').toLowerCase().startsWith('.banzai/');

// The work name when `rel` is that work's plan file.
export function planOwner(rel) {
  const match = /^documentation\/work\/([^/]+)\/plan\.md$/.exec(rel);
  return match && SLUG.test(match[1]) ? match[1] : null;
}

// True when `work` names a real directory directly under `documentation/work/`.
export function isWork(root, work) {
  if (!SLUG.test(work || '')) return false;
  const dir = path.join(root, WORK_DIR, work);
  return isDir(dir) && relativeTo(root, dir) === `${WORK_DIR}/${work}`;
}

function hashFile(root, rel) {
  try {
    const file = path.join(root, rel);
    if (!fs.statSync(file).isFile()) return null;
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  } catch {
    return null;
  }
}

// The files one approval covers: requirements.md when present, plan.md, and
// the decision records the plan links to. Null when the work has no plan.
export function bundle(root, work) {
  const planPath = `${WORK_DIR}/${work}/plan.md`;
  const planHash = hashFile(root, planPath);
  if (!planHash) return null;
  const files = [];
  const requirementsPath = `${WORK_DIR}/${work}/requirements.md`;
  const requirementsHash = hashFile(root, requirementsPath);
  if (requirementsHash) files.push({ path: requirementsPath, sha256: requirementsHash });
  files.push({ path: planPath, sha256: planHash });
  const plan = fs.readFileSync(path.join(root, planPath), 'utf8');
  const linked = new Set();
  for (const match of plan.matchAll(/decisions\/([\w./-]+\.md)/gi)) {
    if (match[1].split('/').every((part) => part && part !== '.' && part !== '..')) linked.add(match[1]);
  }
  for (const name of [...linked].sort()) {
    const sha256 = hashFile(root, `${DECISIONS_DIR}/${name}`);
    if (sha256) files.push({ path: `${DECISIONS_DIR}/${name}`, sha256 });
  }
  return files;
}

export const sameFiles = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// The first file that differs between an approved bundle and the current one.
export function changedFile(approved, current) {
  const now = new Map((current || []).map((file) => [file.path, file.sha256]));
  for (const file of approved || []) if (now.get(file.path) !== file.sha256) return file.path;
  const before = new Set((approved || []).map((file) => file.path));
  for (const file of current || []) if (!before.has(file.path)) return file.path;
  return null;
}

// State files carry a seal: an HMAC of their name and content under a key
// kept in the plugin's data directory. A file with no valid seal is read as
// absent, so a state file written by anything but the hook approves nothing.
// A process that reads the key can still forge one.
let cachedKey = null;
function key() {
  if (cachedKey) return cachedKey;
  const file = path.join(dataDir(), 'state-key');
  if (!fs.existsSync(file)) {
    fs.mkdirSync(dataDir(), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
    try {
      fs.linkSync(tmp, file);
    } catch {}
    fs.unlinkSync(tmp);
  }
  cachedKey = fs.readFileSync(file, 'utf8');
  if (cachedKey.length < 32) throw new Error('the state key is unreadable');
  return cachedKey;
}

const seal = (name, value) => crypto.createHmac('sha256', key()).update(`${name}\n${JSON.stringify(value)}`).digest('hex');

function readState(file, name) {
  try {
    const { seal: stored, ...value } = JSON.parse(fs.readFileSync(file, 'utf8'));
    return stored === seal(name, value) ? value : null;
  } catch {
    return null;
  }
}

function writeState(file, name, value, flag) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const text = `${JSON.stringify({ ...value, seal: seal(name, value) }, null, 2)}\n`;
  if (flag) return fs.writeFileSync(file, text, { flag });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

// A record is sealed with the project's path, so a copy in another checkout
// is not valid there.
const recordFile = (root, work) => path.join(root, RECORDS_DIR, `${work}.json`);
const recordName = (root, work) => `${root}\n${RECORDS_DIR}/${work}.json`;

export function readRecord(root, work) {
  const record = readState(recordFile(root, work), recordName(root, work));
  return record && record.work === work && Array.isArray(record.files) ? record : null;
}

export function writeRecord(root, work, files, session) {
  writeState(recordFile(root, work), recordName(root, work), { work, files, approvedAt: new Date().toISOString(), session });
}

function safeName(value) {
  const id = String(value);
  return /^[\w-]{1,80}$/.test(id) ? id : crypto.createHash('sha256').update(id).digest('hex');
}

const sessionName = (sessionId) => `sessions/${safeName(sessionId || 'no-session')}`;
const sessionPath = (sessionId, suffix) => path.join(dataDir(), `${sessionName(sessionId)}${suffix}`);

// Session state:
//   root       the project, fixed at the session's first event
//   entry      'fix', 'feature' or 'auto', from the entry command the developer typed
//   work       the work this session is attached to
//   cleared    the work the developer named or approved in this session
//   unapproved source files that tool calls changed without approval
export function readSession(sessionId) {
  const stored = readState(sessionPath(sessionId, '.json'), `${sessionName(sessionId)}.json`) || {};
  const text = (value) => (typeof value === 'string' && value ? value : null);
  return {
    root: text(stored.root),
    entry: ['fix', 'feature', 'auto'].includes(stored.entry) ? stored.entry : null,
    work: text(stored.work),
    cleared: text(stored.cleared),
    unapproved: Array.isArray(stored.unapproved) ? stored.unapproved.filter((item) => typeof item === 'string') : []
  };
}

// Reads, changes and writes the session under a lock, so hook processes that
// run at the same time do not lose each other's changes.
export function updateSession(sessionId, change) {
  const lock = sessionPath(sessionId, '.lock');
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  for (;;) {
    try {
      fs.mkdirSync(lock);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let age = 0;
      try {
        age = Date.now() - fs.statSync(lock).mtimeMs;
      } catch {}
      if (age <= LOCK_STALE_MS) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
        continue;
      }
      // An old lock belongs to a hook process that died. Renaming it first
      // means only one waiter removes it.
      try {
        fs.renameSync(lock, `${lock}.${process.pid}`);
        fs.rmdirSync(`${lock}.${process.pid}`);
      } catch {}
    }
  }
  try {
    const session = readSession(sessionId);
    change(session);
    writeState(sessionPath(sessionId, '.json'), `${sessionName(sessionId)}.json`, session);
    return session;
  } finally {
    fs.rmSync(lock, { recursive: true, force: true });
  }
}

function sweep(dir, ttl) {
  const now = Date.now();
  try {
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (now - fs.statSync(file).mtimeMs > ttl) fs.rmSync(file, { recursive: true, force: true });
    }
  } catch {}
}

export const sweepSessions = () => sweep(path.join(dataDir(), 'sessions'), SESSION_TTL_MS);

// What the hook remembers about one tool call is one file per call, so hook
// processes that run at the same time cannot lose each other's entries.
const pendingName = (sessionId, toolUseId) => `${sessionName(sessionId)}/${safeName(toolUseId)}.json`;

export function putPending(sessionId, toolUseId, item) {
  const name = pendingName(sessionId, toolUseId);
  sweep(sessionPath(sessionId, ''), PENDING_TTL_MS);
  writeState(path.join(dataDir(), name), name, item, 'wx');
}

// Returns the entry once: the process that removes the file owns it.
export function takePending(sessionId, toolUseId) {
  const name = pendingName(sessionId, toolUseId);
  const item = readState(path.join(dataDir(), name), name);
  try {
    fs.unlinkSync(path.join(dataDir(), name));
  } catch {
    return null;
  }
  return item;
}

const sha1 = (text) => crypto.createHash('sha1').update(text).digest('hex');

// What a path holds, in two parts: content, then "x" for an executable. The
// content of a regular file is its Git blob id, so it can be compared with
// what the index and the commit hold. A directory here is a nested
// repository and stands for its own snapshot.
function stamp(file, algo, cheap, depth = 0) {
  try {
    const stat = fs.lstatSync(file);
    const mode = stat.mode & 0o111 ? 'x' : '';
    if (stat.isSymbolicLink()) return `link:${sha1(fs.readlinkSync(file))}|`;
    if (stat.isDirectory()) return `dir:${depth < 3 ? sha1(JSON.stringify(snapshot(file, null, depth + 1))) : ''}|`;
    if (!stat.isFile()) return 'other|';
    if (cheap || stat.size > BIG_FILE) return `stat:${stat.size}:${stat.mtimeMs}:${stat.ino}|${mode}`;
    const content = fs.readFileSync(file);
    return `${crypto.createHash(algo).update(`blob ${content.length}\0`).update(content).digest('hex')}|${mode}`;
  } catch {
    return 'absent|';
  }
}

// Git is asked to look at the files themselves, whatever the repository's
// own settings say about trusting cached file state.
const GIT_OPTIONS = ['-c', 'core.fsmonitor=', '-c', 'core.checkStat=default', '-c', 'core.trustctime=true', '-c', 'core.ignoreStat=false'];

// In a partial clone Git would otherwise fetch missing objects from the remote.
function git(top, args) {
  return execFileSync('git', [...GIT_OPTIONS, ...args], {
    cwd: top, encoding: 'utf8', maxBuffer: 1 << 28, timeout: 20000,
    stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1' }
  });
}

const isOid = (value) => /^[0-9a-f]{40,64}$/.test(value || '');
const blob = (value) => (/^0+$/.test(value) ? '' : value);

function sourceRel(root, top, name) {
  const rel = name && path.relative(root, path.join(top, name.replace(/\/$/, ''))).split(path.sep).join('/');
  return rel && rel !== '..' && !rel.startsWith('../') && isSource(rel) ? rel : null;
}

// The source files Git calls changed or untracked, and those it was told not
// to look at. Each value is "content|x|index|commit": what the work tree, the
// index and the commit hold. Null when the project is not in a Git
// repository; `failed` when Git could not answer.
export function snapshot(root, like, depth = 0) {
  let top = root;
  while (!fs.existsSync(path.join(top, '.git'))) {
    if (path.dirname(top) === top) return null;
    top = path.dirname(top);
  }
  try {
    const entries = [];
    let head = null;
    let algo = like ? like.algo : 'sha1';
    let untracked = 0;
    for (const entry of git(top, ['status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all', '--no-renames', '--', root]).split('\0')) {
      const parts = entry.split(' ');
      if (entry.startsWith('# branch.oid ')) head = entry.slice(13);
      else if (parts[0] === '1') {
        if (parts[7].length === 64) algo = 'sha256';
        entries.push([parts.slice(8).join(' '), `${blob(parts[7])}|${blob(parts[6])}`]);
      } else if (parts[0] === 'u') entries.push([parts.slice(10).join(' '), 'unmerged|']);
      else if (parts[0] === '?') untracked = entries.push([entry.slice(2), '|', true]) && untracked + 1;
    }
    for (const entry of git(top, ['ls-files', '-v', '-z', '--', root]).split('\0')) {
      if (/^[a-zS] /.test(entry)) entries.push([entry.slice(2), 'hidden|']);
    }
    const cheap = like ? like.cheap : untracked > MAX_HASHED_UNTRACKED;
    const files = {};
    for (const [name, held, isUntracked] of entries) {
      const rel = sourceRel(root, top, name);
      if (rel && !(rel in files)) files[rel] = `${stamp(path.join(root, rel), algo, cheap && isUntracked, depth)}|${held}`;
    }
    return { top, head, algo, cheap, files };
  } catch {
    return { failed: true };
  }
}

// One file changed if its content or mode differs, or if the index or the
// commit now holds content that was not there before and is not what the
// work tree holds. Staging, unstaging or committing the same content is no
// change.
function differs(before, after) {
  if (before === undefined) return true;
  const [content, mode, index, commit] = before.split('|');
  const [content2, mode2, index2, commit2] = after.split('|');
  if (content !== content2 || mode !== mode2) return true;
  const known = [content, index, commit, ''];
  return isOid(content) && !(known.includes(index2) && known.includes(commit2));
}

// The source files that differ from a snapshot taken before a tool call.
export function changedSource(root, before) {
  const after = snapshot(root, before && !before.failed ? before : null);
  if (!before && !after) return [];
  if (!before || !after || before.failed || after.failed) return [NOT_COMPARED];
  const changed = new Set();
  for (const [rel, value] of Object.entries(after.files)) if (differs(before.files[rel], value)) changed.add(rel);
  for (const [rel, value] of Object.entries(before.files)) {
    if (rel in after.files) continue;
    const now = stamp(path.join(root, rel), before.algo, before.cheap && value.endsWith('||'));
    if (now !== value.split('|').slice(0, 2).join('|')) changed.add(rel);
  }
  // A file that was clean before and is clean now changed if a commit, a
  // checkout or a pull moved the branch in between.
  if (before.head !== after.head) {
    if (!isOid(after.head)) return [NOT_COMPARED];
    try {
      const args = isOid(before.head) ? ['diff', '--name-only', '-z', '--no-renames', before.head, after.head] : ['ls-tree', '-r', '--name-only', '-z', after.head];
      for (const name of git(after.top, args).split('\0')) {
        const rel = sourceRel(root, after.top, name);
        if (rel && !(rel in before.files)) changed.add(rel);
      }
    } catch {
      return [NOT_COMPARED];
    }
  }
  return [...changed].sort();
}

// The newest works that have a plan, each with its approval state.
export function listWorks(root, limit) {
  const works = [];
  let names = [];
  try {
    names = fs.readdirSync(path.join(root, WORK_DIR));
  } catch {}
  for (const work of names) {
    if (!isWork(root, work)) continue;
    try {
      works.push({ work, at: fs.statSync(path.join(root, WORK_DIR, work, 'plan.md')).mtimeMs });
    } catch {}
  }
  works.sort((a, b) => b.at - a.at);
  return works.slice(0, limit).map(({ work }) => {
    const files = bundle(root, work);
    const record = readRecord(root, work);
    const state = !record ? 'not approved' : sameFiles(record.files, files) ? 'approved' : `approval ended, ${changedFile(record.files, files)} changed`;
    return `${work} (${state})`;
  });
}
