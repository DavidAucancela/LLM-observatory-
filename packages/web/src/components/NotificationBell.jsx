import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApi } from '../hooks/useApi';
import { fmtRelative, formatCost } from '../utils/fmt';

function IconBell() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function TypeIcon({ type }) {
  if (type === 'team_joined') {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (type === 'reconciliation') {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line x1="12" y1="2" x2="12" y2="12" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4" /><circle cx="12" cy="12" r="9" /><path d="M12 16h.01" />
    </svg>
  );
}

function severityColor(n) {
  if (n.type === 'team_joined') return 'var(--success)';
  if (n.type === 'reconciliation') return n.data.status === 'error' ? 'var(--error)' : 'var(--warning)';
  return 'var(--warning)'; // budget_alert
}

function messageFor(t, n) {
  switch (n.type) {
    case 'budget_alert': {
      const provider = n.data.provider === 'all' ? t('notifications.allProviders') : n.data.provider;
      const base = t('notifications.budgetAlertMsg', {
        provider, current: formatCost(n.data.currentValue), threshold: formatCost(n.data.thresholdUsd),
      });
      return n.data.success ? base : `${base} ${t('notifications.deliveryFailed')}`;
    }
    case 'reconciliation':
      return t('notifications.reconciliationMsg', { provider: n.data.provider, pct: n.data.deviationPct.toFixed(1) });
    case 'team_joined':
      return t('notifications.teamJoinedMsg', { email: n.data.email });
    default:
      return '';
  }
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const ref = useRef(null);
  const { apiFetch } = useApi();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const fetchNotifications = () => {
    apiFetch('/api/notifications')
      .then(r => r.json())
      .then(d => {
        setNotifications(d.notifications || []);
        setUnreadCount(d.unread_count || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchNotifications(); }, []);

  useEffect(() => {
    if (!open) return;
    fetchNotifications();
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const handleMarkAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    try { await apiFetch('/api/notifications/read-all', { method: 'POST' }); } catch {}
  };

  return (
    <div className="obs-notif-bell-wrap" ref={ref}>
      <button
        type="button"
        className="obs-notif-bell"
        onClick={() => setOpen(o => !o)}
        aria-label={t('notifications.title')}
        title={t('notifications.title')}
      >
        <IconBell />
        {unreadCount > 0 && <span className="obs-notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="obs-notif-panel">
          <div className="obs-notif-panel-head">
            <span>{t('notifications.title')}</span>
            {unreadCount > 0 && (
              <button type="button" className="obs-notif-markread" onClick={handleMarkAllRead}>
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          <div className="obs-notif-list">
            {loading ? (
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="obs-skeleton" style={{ height: 40, borderRadius: 6 }} />
                <div className="obs-skeleton" style={{ height: 40, borderRadius: 6 }} />
              </div>
            ) : notifications.length === 0 ? (
              <div className="obs-notif-empty">{t('notifications.empty')}</div>
            ) : notifications.map(n => (
              <div key={n.id} className={`obs-notif-item${n.read ? ' read' : ''}`}>
                <span className="obs-notif-icon" style={{ color: severityColor(n) }}>
                  <TypeIcon type={n.type} />
                </span>
                <div className="obs-notif-body">
                  <div className="obs-notif-text">{messageFor(t, n)}</div>
                  <div className="obs-notif-time">{fmtRelative(n.occurred_at, t)}</div>
                </div>
                {!n.read && <span className="obs-notif-dot" />}
              </div>
            ))}
          </div>

          <button
            type="button"
            className="obs-notif-panel-foot"
            onClick={() => { setOpen(false); navigate('/settings?tab=alerts'); }}
          >
            {t('notifications.viewAll')}
          </button>
        </div>
      )}
    </div>
  );
}
