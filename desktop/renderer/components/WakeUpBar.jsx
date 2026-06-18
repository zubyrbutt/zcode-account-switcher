import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, Play, Square, RefreshCw } from 'lucide-react';
import { useI18n } from '../i18n.js';

const INTERVAL_OPTIONS = [
  { label: '15', labelKey: 'wakeup.minutes', value: 15 * 60 * 1000 },
  { label: '30', labelKey: 'wakeup.minutes', value: 30 * 60 * 1000 },
  { label: '60', labelKey: 'wakeup.hour', value: 60 * 60 * 1000 },
];

function fmtTime(ts, locale) {
  if (!ts) return '—';
  try {
    return new Intl.DateTimeFormat(locale === 'zh-CN' ? 'zh-CN' : locale === 'ru' ? 'ru' : 'en', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(new Date(ts));
  } catch { return '—'; }
}

function fmtInterval(ms, locale, t) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} ${t('wakeup.minutes')}`;
  return `${Math.round(min / 60)} ${t('wakeup.hour')}`;
}

export default function WakeUpBar({ accountCount, onWakeupEvent }) {
  const { locale, t } = useI18n();
  const [running, setRunning] = useState(false);
  const [intervalMs, setIntervalMs] = useState(30 * 60 * 1000);
  const [cycleCount, setCycleCount] = useState(0);
  const [lastResults, setLastResults] = useState({});
  const [lastRunTimestamps, setLastRunTimestamps] = useState({});
  const [lastEventTime, setLastEventTime] = useState(null);
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    const wakeupCleanup = onWakeupEvent((event) => {
      setLastEventTime(event.timestamp || Date.now());
      if (event.type === 'started') {
        setRunning(true);
        setCycleCount(0);
        setLastResults({});
        setLastRunTimestamps({});
      } else if (event.type === 'stopped') {
        setRunning(false);
      } else if (event.type === 'cycle-start') {
        setCycleCount(event.cycleCount);
      } else if (event.type === 'account-success') {
        setLastResults((prev) => ({ ...prev, [event.accountId]: { ok: true } }));
        setLastRunTimestamps((prev) => ({ ...prev, [event.accountId]: event.timestamp }));
      } else if (event.type === 'account-error') {
        setLastResults((prev) => ({ ...prev, [event.accountId]: { ok: false, error: event.error } }));
        setLastRunTimestamps((prev) => ({ ...prev, [event.accountId]: event.timestamp }));
      }
    });
    return wakeupCleanup;
  }, [onWakeupEvent]);

  useEffect(() => {
    (async () => {
      const r = await window.api.wakeupStatus();
      if (r.ok && r.data) {
        setRunning(r.data.running);
        setIntervalMs(r.data.config?.intervalMs || 30 * 60 * 1000);
        setCycleCount(r.data.cycleCount || 0);
        if (r.data.lastResults) setLastResults(r.data.lastResults);
        if (r.data.lastRunTimestamps) setLastRunTimestamps(r.data.lastRunTimestamps);
      }
    })();
  }, []);

  const handleToggle = useCallback(async () => {
    if (running) {
      await window.api.wakeupStop();
    } else {
      const ids = [];
      const s = await window.api.list();
      if (s.ok && Array.isArray(s.data)) {
        for (const acc of s.data) ids.push(acc.id);
      }
      await window.api.wakeupStart({ accountIds: ids, intervalMs });
    }
  }, [running, intervalMs]);

  const okCount = Object.values(lastResults).filter((r) => r.ok).length;
  const failCount = Object.values(lastResults).filter((r) => !r.ok).length;
  const timestamps = Object.values(lastRunTimestamps);
  const lastRun = timestamps.length ? Math.max(...timestamps) : null;
  const nextRun = running && lastRun ? lastRun + intervalMs : null;

  return (
    <div className="wakeup-bar">
      <div className="wakeup-bar-left">
        <Clock size={14} className={`wakeup-icon ${running ? 'active' : ''}`} />
        <span className="wakeup-label">{t('wakeup.title')}</span>
        {running && (
          <span className="wakeup-badge">{t('wakeup.running')}</span>
        )}
      </div>

      <div className="wakeup-bar-center">
        {running ? (
          <>
            <span className="wakeup-stat">
              {t('wakeup.cycle')} #{cycleCount}
            </span>
            <span className="wakeup-sep">·</span>
            <span className="wakeup-stat">
              {okCount + failCount > 0
                ? t('wakeup.lastResults', { ok: okCount, fail: failCount })
                : t('wakeup.waitingFirst')}
            </span>
            {lastRun && (
              <>
                <span className="wakeup-sep">·</span>
                <span className="wakeup-stat">{t('wakeup.lastRun')} {fmtTime(lastRun, locale)}</span>
              </>
            )}
            {nextRun && (
              <>
                <span className="wakeup-sep">·</span>
                <span className="wakeup-stat wakeup-next">{t('wakeup.nextRun')} {fmtTime(nextRun, locale)}</span>
              </>
            )}
          </>
        ) : (
          <span className="wakeup-stat wakeup-off">{t('wakeup.off')}</span>
        )}
      </div>

      <div className="wakeup-bar-right">
        <select
          className="wakeup-select"
          value={intervalMs}
          onChange={(e) => setIntervalMs(Number(e.target.value))}
          disabled={running}
          aria-label={t('wakeup.interval')}
        >
          {INTERVAL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label} {t(opt.labelKey)}
            </option>
          ))}
        </select>
        <button
          className={`btn btn-sm ${running ? 'btn-danger' : 'btn-primary'}`}
          onClick={handleToggle}
          title={running ? t('wakeup.stop') : t('wakeup.start')}
          disabled={accountCount === 0}
        >
          {running ? <Square size={13} /> : <Play size={13} />}
          {running ? t('wakeup.stop') : t('wakeup.start')}
        </button>
      </div>
    </div>
  );
}
