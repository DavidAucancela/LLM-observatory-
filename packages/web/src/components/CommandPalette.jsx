import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { useApi } from '../hooks/useApi';
import i18n from '../i18n';

function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

// "Resumen"/Dashboard isn't in Sidebar's own nav list (it's reached via the
// brand logo there) — added back here since a global palette should be able
// to jump anywhere. Reuses the same i18n keys Sidebar.jsx uses for the rest.
const PAGES = [
  { to: '/dashboard', labelKey: 'dashboard.title' },
  { to: '/activity',  labelKey: 'nav.requests' },
  { to: '/models',    labelKey: 'nav.models' },
  { to: '/finance',   labelKey: 'nav.finance' },
  { to: '/keys',      labelKey: 'nav.keys' },
  { to: '/sync',      labelKey: 'nav.sync' },
  { to: '/settings',  labelKey: 'nav.settings' },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [models, setModels] = useState(null); // null = not fetched yet, [] = fetched empty
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { logout } = useAuth();
  const { apiFetch } = useApi();

  const fetchModelsOnce = useCallback(() => {
    if (models !== null) return;
    apiFetch('/api/metrics/summary?range=7d')
      .then(r => r.json())
      .then(d => setModels((d.all_models || []).map(m => m.model)))
      .catch(() => setModels([]));
  }, [models, apiFetch]);

  useEffect(() => {
    const onKeyDown = (e) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => {
          const next = !o;
          if (next) fetchModelsOnce();
          return next;
        });
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [fetchModelsOnce]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [open]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  if (!open) return null;

  const actions = [
    { id: 'action-logout',   label: t('palette.actionLogout'),   run: () => logout() },
    { id: 'action-language', label: t('palette.actionLanguage'), run: () => {
      const next = i18n.language === 'en' ? 'es' : 'en';
      i18n.changeLanguage(next);
      localStorage.setItem('lang', next);
    } },
    { id: 'action-alerts',   label: t('palette.actionAlerts'),   run: () => navigate('/settings?tab=alerts') },
    { id: 'action-webhooks', label: t('palette.actionWebhooks'), run: () => navigate('/settings?tab=webhooks') },
    { id: 'action-team',     label: t('palette.actionTeam'),     run: () => navigate('/settings?tab=team') },
  ];

  const q = query.trim().toLowerCase();
  const matches = (label) => !q || label.toLowerCase().includes(q);

  const pageItems = PAGES
    .map(p => ({ id: `page-${p.to}`, label: t(p.labelKey), run: () => navigate(p.to) }))
    .filter(p => matches(p.label));

  // Deep-links to /activity?model=... using the same query param RequestsTab
  // already reads (added for the dashboard insights panel).
  const modelItems = (models || [])
    .filter(matches)
    .slice(0, 8)
    .map(m => ({ id: `model-${m}`, label: m, run: () => navigate(`/activity?model=${encodeURIComponent(m)}`) }));

  const actionItems = actions.filter(a => matches(a.label));

  const groups = [
    { labelKey: 'palette.groupPages',   items: pageItems },
    { labelKey: 'palette.groupModels',  items: modelItems },
    { labelKey: 'palette.groupActions', items: actionItems },
  ].filter(g => g.items.length > 0);

  const flatItems = groups.flatMap(g => g.items);

  const execute = (item) => { setOpen(false); item.run(); };

  const onInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, flatItems.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (flatItems[activeIndex]) execute(flatItems[activeIndex]); }
  };

  let runningIndex = -1;

  return (
    <div className="obs-palette-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="obs-palette">
        <div className="obs-palette-input-row">
          <IconSearch />
          <input
            ref={inputRef}
            className="obs-palette-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={t('palette.placeholder')}
          />
          <kbd>Esc</kbd>
        </div>

        <div className="obs-palette-results">
          {flatItems.length === 0 ? (
            <div className="obs-palette-empty">{t('palette.noResults')}</div>
          ) : groups.map(group => (
            <div key={group.labelKey}>
              <div className="obs-palette-group-label">{t(group.labelKey)}</div>
              {group.items.map(item => {
                runningIndex += 1;
                const idx = runningIndex;
                return (
                  <div
                    key={item.id}
                    className={`obs-palette-row${idx === activeIndex ? ' active' : ''}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => { e.preventDefault(); execute(item); }}
                  >
                    {item.label}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
