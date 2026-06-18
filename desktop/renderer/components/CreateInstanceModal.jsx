import React, { useState, useEffect, useRef } from 'react';
import { Plus, Loader2, Cpu } from 'lucide-react';
import { useI18n } from '../i18n.js';

export default function CreateInstanceModal({ onClose, onConfirm, busy }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => onConfirm(name.trim() || undefined);

  const handleKey = (e) => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          <Cpu size={18} />
          {t('instances.createModalTitle')}
        </h2>
        <p>{t('instances.createModalDesc')}</p>
        <input
          ref={inputRef}
          className="modal-input"
          placeholder={t('instances.createModalPlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKey}
          disabled={busy}
        />
        <div className="modal-actions">
          <button className="btn" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
            {t('instances.createInstance')}
          </button>
        </div>
      </div>
    </div>
  );
}
