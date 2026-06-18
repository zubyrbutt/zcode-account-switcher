'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');
const { INSTANCES_DIR, STORE_DIR, findZCodeExe } = require('./paths');

const INSTANCES_FILE = path.join(INSTANCES_DIR, 'instances.json');
const _processes = {};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readStore() {
  ensureDir(INSTANCES_DIR);
  try {
    return JSON.parse(fs.readFileSync(INSTANCES_FILE, 'utf8'));
  } catch {
    return { version: 1, instances: {} };
  }
}

function writeStore(store) {
  ensureDir(INSTANCES_DIR);
  const tmp = INSTANCES_FILE + '.tmp-' + process.pid + '-' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, INSTANCES_FILE);
}

function instanceDataDir(id) {
  return path.join(INSTANCES_DIR, id);
}

function instanceZcodeV2Dir(id) {
  return path.join(instanceDataDir(id), '.zcode', 'v2');
}

function instanceUserDataDir(id) {
  return path.join(instanceDataDir(id), 'Library', 'Application Support', 'ZCode');
}

function isPidAlive(pid) {
  if (!pid) return false;
  try {
    if (process.platform === 'win32') {
      execSync('tasklist /FI "PID eq ' + pid + '" /NH /FO CSV', { encoding: 'utf8', windowsHide: true, stdio: 'pipe' });
      return true;
    }
    execSync('ps -p ' + pid, { encoding: 'utf8', stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function refreshInstanceStatuses(store) {
  const instances = store.instances || {};
  for (const inst of Object.values(instances)) {
    const child = _processes[inst.id];
    if (child) {
      inst.pid = child.pid;
      inst.status = isPidAlive(child.pid) ? 'running' : 'stopped';
      if (inst.status === 'stopped') {
        delete _processes[inst.id];
        inst.pid = null;
      }
    } else if (inst.pid) {
      inst.status = isPidAlive(inst.pid) ? 'running' : 'stopped';
      if (inst.status === 'stopped') inst.pid = null;
    } else {
      inst.status = 'stopped';
    }
  }
  writeStore(store);
  return store;
}

function create(opts = {}) {
  const { label } = opts;
  const id = crypto.randomUUID();
  const now = Date.now();
  const label_ = label || 'Instance-' + id.slice(0, 8);
  const dataDir = instanceDataDir(id);
  const zcodeDir = instanceZcodeV2Dir(id);
  const udd = instanceUserDataDir(id);
  ensureDir(zcodeDir);
  ensureDir(udd);
  const meta = { id, label: label_, createdAt: now, lastUsed: null, pid: null, status: 'stopped', dataDir };
  const store = readStore();
  store.instances[id] = meta;
  writeStore(store);
  return meta;
}

function list() {
  const store = readStore();
  const refreshed = refreshInstanceStatuses(store);
  return Object.values(refreshed.instances);
}

function get(id) {
  const store = readStore();
  const meta = store.instances[id];
  if (!meta) return null;
  const child = _processes[id];
  if (child) {
    meta.pid = child.pid;
    meta.status = isPidAlive(child.pid) ? 'running' : 'stopped';
    if (meta.status === 'stopped') { delete _processes[id]; meta.pid = null; }
  } else if (meta.pid) {
    meta.status = isPidAlive(meta.pid) ? 'running' : 'stopped';
    if (meta.status === 'stopped') meta.pid = null;
  } else {
    meta.status = 'stopped';
  }
  return meta;
}

function launch(id) {
  const store = readStore();
  const meta = store.instances[id];
  if (!meta) throw new Error('Instance not found: ' + id);
  const exe = findZCodeExe();
  if (!exe) throw new Error('ZCode not found');
  const zcodeDir = instanceZcodeV2Dir(id);
  const udd = instanceUserDataDir(id);
  ensureDir(zcodeDir);
  ensureDir(udd);
  const env = Object.assign({}, process.env, { HOME: instanceDataDir(id) });
  let bin, args;
  if (process.platform === 'darwin' && exe.endsWith('.app')) {
    bin = path.join(exe, 'Contents', 'MacOS', 'ZCode');
    args = ['--user-data-dir', udd];
  } else {
    bin = exe;
    args = ['--user-data-dir', udd];
  }
  const child = spawn(bin, args, { env, detached: true, stdio: 'ignore' });
  child.unref();
  _processes[id] = child;
  meta.pid = child.pid;
  meta.status = 'running';
  meta.lastUsed = Date.now();
  store.instances[id] = meta;
  writeStore(store);
  return { pid: child.pid };
}

function stop(id) {
  const child = _processes[id];
  const store = readStore();
  const meta = store.instances[id];
  try {
    if (child) {
      try { process.kill(child.pid, 'SIGTERM'); } catch (_) {}
      delete _processes[id];
    } else if (meta && meta.pid) {
      try { process.kill(meta.pid, 'SIGTERM'); } catch (_) {}
    }
  } catch (_) {}
  if (meta) {
    meta.pid = null;
    meta.status = 'stopped';
    store.instances[id] = meta;
    writeStore(store);
  }
  return true;
}

function remove(id) {
  stop(id);
  const store = readStore();
  delete store.instances[id];
  writeStore(store);
  const dir = instanceDataDir(id);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  return true;
}

function update(id, changes) {
  const store = readStore();
  const meta = store.instances[id];
  if (!meta) throw new Error('Instance not found');
  if (changes.label !== undefined) meta.label = changes.label;
  writeStore(store);
  return meta;
}

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  let entries;
  try {
    entries = fs.readdirSync(src, { withFileTypes: true });
  } catch (_) { return; }
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    try {
      if (entry.isDirectory()) {
        copyDirSync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    } catch (_) {}
  }
}

function assignAccount(instanceId, accountId) {
  const store = readStore();
  const meta = store.instances[instanceId];
  if (!meta) throw new Error('Instance not found: ' + instanceId);

  const snapFile = path.join(STORE_DIR, accountId + '.snap.json');
  const metaFile = path.join(STORE_DIR, accountId + '.meta.json');
  if (!fs.existsSync(snapFile)) throw new Error('Account snapshot not found: ' + accountId);

  const snap = JSON.parse(fs.readFileSync(snapFile, 'utf8'));
  const zcodeDir = instanceZcodeV2Dir(instanceId);
  ensureDir(zcodeDir);
  fs.writeFileSync(path.join(zcodeDir, 'credentials.json'), snap.credentials, 'utf8');
  fs.writeFileSync(path.join(zcodeDir, 'config.json'), snap.config, 'utf8');

  // Copy real ZCode user data (session cookies, local storage, prefs, etc.)
  const realUserData = path.join(os.homedir(), 'Library', 'Application Support', 'ZCode');
  const instUserData = instanceUserDataDir(instanceId);
  ensureDir(instUserData);
  // Copy the Chromium session profile (Cookies, Local Storage, Session Storage, etc.)
  const realSession = path.join(realUserData, 'session');
  const instSession = path.join(instUserData, 'session');
  if (fs.existsSync(realSession)) {
    copyDirSync(realSession, instSession);
  }

  // Copy ZCode v2 extras: certs (MITM CA) and setting.json
  const realV2 = path.join(os.homedir(), '.zcode', 'v2');
  const realCerts = path.join(realV2, 'certs');
  const instCerts = path.join(zcodeDir, 'certs');
  if (fs.existsSync(realCerts)) {
    copyDirSync(realCerts, instCerts);
  }
  const realSetting = path.join(realV2, 'setting.json');
  const instSetting = path.join(zcodeDir, 'setting.json');
  try {
    if (fs.existsSync(realSetting)) fs.copyFileSync(realSetting, instSetting);
  } catch (_) {}

  let accountLabel = accountId;
  try {
    const accMeta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
    accountLabel = accMeta.label || accMeta.email || accountId;
  } catch (_) {}

  meta.accountId = accountId;
  meta.accountLabel = accountLabel;
  writeStore(store);
  return { accountId, accountLabel };
}

function unassignAccount(instanceId) {
  const store = readStore();
  const meta = store.instances[instanceId];
  if (!meta) throw new Error('Instance not found: ' + instanceId);
  delete meta.accountId;
  delete meta.accountLabel;
  writeStore(store);
  return true;
}

module.exports = { create, list, get, launch, stop, remove, update, assignAccount, unassignAccount };
