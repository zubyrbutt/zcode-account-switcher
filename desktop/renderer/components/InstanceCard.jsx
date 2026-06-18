import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Trash2, Pencil, Check, Cpu, User, X } from 'lucide-react';
import { useI18n } from '../i18n.js';

function fmtDate(ts, locale) {
  if (!ts) return '-';
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  if (locale === 'zh-CN') {
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function InstanceCard({
  instance,
  accounts,
  busy,
  onLaunch,
  onStop,
  onRemove,
  onRename,
  onAssignAccount,
  onUnassignAccount,
}) {
  const { locale, t } = useI18n();
  const [renaming, setRenaming] = useState(false);
  const [editName, setEditName] = useState(instance.label);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const inputRef = useRef(null);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (renaming) {
      setEditName(instance.label);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [renaming, instance.label]);

  useEffect(() => {
    function handleClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowAccountPicker(false);
      }
    }
    if (showAccountPicker) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showAccountPicker]);

  const isRunning = instance.status === 'running';
  const pid = instance.pid;
  const instanceId = instance.id ? instance.id.slice(0, 8) : '??';
  const hasAccount = !!(instance.accountId && instance.accountLabel);

  const handleRenameKey = (e) => {
    if (e.key === 'Enter') {
      onRename(instance.id, editName.trim());
      setRenaming(false);
    }
    if (e.key === 'Escape') {
      setEditName(instance.label);
      setRenaming(false);
    }
  };

  const handleSelectAccount = (accountId) => {
    onAssignAccount(instance.id, accountId);
    setShowAccountPicker(false);
  };

  const handleUnassign = () => {
    onUnassignAccount(instance.id);
  };

  const otherAccounts = (accounts || []).filter((a) => a.id !== instance.accountId);

  return (
    <div className={`instance-card ${isRunning ? 'running' : ''}`}>
      <div className="instance-icon">
        <Cpu size={20} />
      </div>
      <div className="instance-info">
        <div className="instance-name-row">
          {renaming ? (
            <input
              ref={inputRef}
              className="modal-input"
              style={{ height: 30, marginBottom: 0, width: 200, fontSize: 14 }}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleRenameKey}
              onBlur={() => {
                onRename(instance.id, editName.trim());
                setRenaming(false);
              }}
            />
          ) : (
            <span className="instance-name">{instance.label}</span>
          )}
          <span className={`instance-status-badge ${isRunning ? 'running' : 'stopped'}`}>
            <span className="status-dot-sm" />
            {isRunning ? t('instances.statusRunning') : t('instances.statusStopped')}
          </span>
        </div>
        <div className="instance-meta">
          <span>{t('instances.id')}: <code>{instanceId}</code></span>
          <span>{t('instances.createdAt', { date: fmtDate(instance.createdAt, locale) })}</span>
          <span>
            {instance.lastUsed
              ? t('instances.lastUsed', { date: fmtDate(instance.lastUsed, locale) })
              : t('instances.neverUsed')}
          </span>
          {pid && <span>{t('instances.pid')}: <code>{pid}</code></span>}
        </div>
        <div className="instance-account-row">
          {hasAccount ? (
            <div className="assigned-account">
              <User size={12} />
              <span className="assigned-account-label" title={instance.accountId}>{instance.accountLabel}</span>
              <button
                className="btn-account-unassign"
                onClick={handleUnassign}
                disabled={busy || isRunning}
                title={t('instances.unassignAccount')}
              >
                <X size={10} />
              </button>
            </div>
          ) : (
            <div className="account-picker-wrapper" ref={pickerRef}>
              <button
                className="btn btn-ghost btn-sm btn-assign-account"
                onClick={() => setShowAccountPicker(!showAccountPicker)}
                disabled={busy || (accounts || []).length === 0}
              >
                <User size={12} />
                {t('instances.assignAccount')}
              </button>
              {showAccountPicker && (
                <div className="account-picker-dropdown">
                  {otherAccounts.length === 0 ? (
                    <div className="account-picker-empty">{t('instances.noAccountsToAssign')}</div>
                  ) : (
                    otherAccounts.map((acc) => (
                      <button
                        key={acc.id}
                        className="account-picker-item"
                        onClick={() => handleSelectAccount(acc.id)}
                      >
                        <span className="account-picker-label">{acc.label || acc.email || acc.id}</span>
                        <span className="account-picker-email">{acc.email || ''}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="instance-actions">
        <button
          className="btn btn-ghost btn-icon"
          title={t('instances.rename')}
          onClick={() => setRenaming(true)}
          disabled={busy}
        >
          <Pencil size={14} />
        </button>
        {isRunning ? (
          <button
            className="btn btn-sm"
            style={{ color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)' }}
            onClick={() => onStop(instance.id)}
            disabled={busy}
            title={t('instances.stop')}
          >
            <Square size={13} />
            {t('instances.stop')}
          </button>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onLaunch(instance.id)}
            disabled={busy}
            title={t('instances.launch')}
          >
            <Play size={13} />
            {t('instances.launch')}
          </button>
        )}
        <button
          className="btn btn-ghost btn-icon"
          title={t('instances.remove')}
          onClick={() => onRemove(instance)}
          disabled={busy}
          style={{ color: '#ef4444' }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
