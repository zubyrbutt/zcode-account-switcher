'use strict';
/**
 * Wake-up Automation — Scheduler
 *
 * Periodically calls quota API for selected accounts to keep sessions active
 * and refresh quota data. Runs on a configurable interval using recursive setTimeout.
 */

const quota = require('./quota');

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const MIN_INTERVAL_MS = 5 * 60 * 1000;      // 5 minutes minimum

class WakeUpScheduler {
  constructor() {
    this._running = false;
    this._timer = null;
    this._config = null;
    this._cycleCount = 0;
    this._lastRunTimestamps = {};
    this._lastResults = {};
    this._listeners = [];
  }

  start(config = {}) {
    if (this._running) this.stop();
    const accountIds = Array.isArray(config.accountIds) ? config.accountIds : [];
    const intervalMs = Math.max(MIN_INTERVAL_MS, config.intervalMs || DEFAULT_INTERVAL_MS);

    this._config = { accountIds, intervalMs };
    this._running = true;
    this._cycleCount = 0;
    this._emit('started', { accountIds: accountIds.length, intervalMs });

    this._scheduleNext();
  }

  stop() {
    this._running = false;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._emit('stopped', {});
  }

  status() {
    return {
      running: this._running,
      config: this._config ? { ...this._config } : null,
      cycleCount: this._cycleCount,
      lastRunTimestamps: { ...this._lastRunTimestamps },
      lastResults: { ...this._lastResults },
    };
  }

  on(event, callback) {
    this._listeners.push({ event, callback });
  }

  _emit(event, data) {
    for (const l of this._listeners) {
      if (l.event === event) l.callback({ type: event, ...data, timestamp: Date.now() });
    }
  }

  _scheduleNext() {
    if (!this._running) return;
    this._timer = setTimeout(() => this._runCycle(), this._config.intervalMs);
  }

  async _runCycle() {
    if (!this._running) return;
    this._cycleCount++;
    const { accountIds } = this._config;

    this._emit('cycle-start', { cycleCount: this._cycleCount, accountIds });

    for (const id of accountIds) {
      if (!this._running) break;
      try {
        const result = await quota.getAccountQuota(id);
        this._lastRunTimestamps[id] = Date.now();
        this._lastResults[id] = { ok: true, refreshedAt: result.refreshedAt };
        this._emit('account-success', { accountId: id, result });
      } catch (e) {
        this._lastRunTimestamps[id] = Date.now();
        this._lastResults[id] = { ok: false, error: e.message || String(e) };
        this._emit('account-error', { accountId: id, error: e.message || String(e) });
      }
    }

    this._emit('cycle-end', { cycleCount: this._cycleCount });
    this._scheduleNext();
  }
}

module.exports = { WakeUpScheduler, DEFAULT_INTERVAL_MS, MIN_INTERVAL_MS };
