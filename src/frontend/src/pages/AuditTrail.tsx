import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { api } from '../api/client';
import type { AuditLog } from '../api/types';
import { RefreshCw, Shield, Search, Terminal, User, Sparkles } from 'lucide-react';

// ── Apple HIG Tokens ────────────────────────────────────────────────────────
const T = {
  bg:       '#F5F5F7',
  surface:  '#ffffff',
  surface2: '#F2F2F7',
  border:   'rgba(0,0,0,0.07)',
  borderLight: 'rgba(0,0,0,0.04)',
  text:     '#1D1D1F',
  sub:      '#6E6E73',
  muted:    '#AEAEB2',
  accent:   '#007AFF',
  green:    '#34C759',
  amber:    '#FF9500',
  red:      '#FF3B30',
  blueBg:   '#F0F8FF',
  greenBg:  '#E6F4EA',
  redBg:    '#FCE8E6',
  amberBg:  '#FFF8E6',
};

// ─── Actor Badge ──────────────────────────────────────────────────────────────
const ActorBadge: React.FC<{ actor: string }> = ({ actor }) => {
  if (actor === 'System') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, fontSize: '10px', fontWeight: 600, background: T.surface2, color: T.sub, border: `1px solid ${T.border}` }}>
      <Terminal size={10} /> SYSTEM
    </span>
  );
  if (actor === 'watsonx.ai') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, fontSize: '10px', fontWeight: 600, background: T.blueBg, color: T.accent, border: `1px solid rgba(0,122,255,0.2)` }}>
      <Sparkles size={10} /> WATSONX.AI
    </span>
  );
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, fontSize: '10px', fontWeight: 600, background: '#F0F5FF', color: '#0040DD', border: `1px solid rgba(0,64,221,0.15)`, textTransform: 'uppercase' }}>
      <User size={10} /> {actor}
    </span>
  );
};

// ─── Action Dot ───────────────────────────────────────────────────────────────
const actionColor = (action: string) => {
  const l = action.toLowerCase();
  if (l.includes('approved') || l.includes('generated')) return T.green;
  if (l.includes('rejected')) return T.red;
  if (l.includes('detected') || l.includes('recalculated')) return T.amber;
  return T.muted;
};

// ─── Log Row ──────────────────────────────────────────────────────────────────
const LogRow: React.FC<{ log: AuditLog; isNew?: boolean }> = ({ log, isNew }) => {
  const ts = new Date(log.timestamp);
  const dateStr = ts.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = ts.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <tr style={{ borderBottom: `1px solid ${T.borderLight}`, transition: 'background-color 0.2s', background: isNew ? T.amberBg : 'transparent' }} onMouseOver={(e) => e.currentTarget.style.background = T.surface2} onMouseOut={(e) => e.currentTarget.style.background = isNew ? T.amberBg : 'transparent'}>
      <td style={{ padding: '16px 24px', verticalAlign: 'top', width: 140 }}>
        <div style={{ fontSize: '11px', fontWeight: 500, color: T.text, marginBottom: 2 }}>{dateStr}</div>
        <div style={{ fontSize: '11px', color: T.muted, fontFamily: 'SF Mono, monospace' }}>{timeStr}</div>
      </td>
      <td style={{ padding: '16px 0', verticalAlign: 'top', width: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: actionColor(log.action), boxShadow: `0 0 0 4px ${T.surface}` }} />
        </div>
      </td>
      <td style={{ padding: '16px 16px', verticalAlign: 'top' }}>
        <ActorBadge actor={log.actor} />
      </td>
      <td style={{ padding: '16px 16px', verticalAlign: 'top' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: T.text }}>{log.action}</span>
      </td>
      <td style={{ padding: '16px 16px', verticalAlign: 'top' }}>
        <div style={{ fontSize: '11px', fontWeight: 500, color: T.sub, marginBottom: 2 }}>{log.entity_type}</div>
        <div style={{ fontFamily: 'SF Mono, monospace', fontSize: '11px', color: T.muted }}>{log.entity_id}</div>
      </td>
      <td style={{ padding: '16px 24px', verticalAlign: 'top' }}>
        <p style={{ fontSize: '11px', color: T.sub, margin: 0, lineHeight: 1.5 }}>{log.details}</p>
      </td>
      <td style={{ padding: '16px 24px', verticalAlign: 'top', textAlign: 'right' }}>
        <span style={{ fontFamily: 'SF Mono, monospace', fontSize: '10px', color: T.muted }}>{log.audit_id}</span>
      </td>
    </tr>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export const AuditTrail = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [actorFilter, setActorFilter] = useState('All');
  const [entityFilter, setEntityFilter] = useState('All');
  const [newLogIds, setNewLogIds] = useState<Set<string>>(new Set());

  const fetchLogs = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const fetched = await api.getAuditLogs();
      setLogs((prev) => {
        const prevIds = new Set(prev.map((l) => l.audit_id));
        const newIds = new Set(fetched.filter((l) => !prevIds.has(l.audit_id)).map((l) => l.audit_id));
        if (newIds.size > 0) {
          setNewLogIds(newIds);
          setTimeout(() => setNewLogIds(new Set()), 3000);
        }
        return fetched;
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(() => fetchLogs(), 15000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const actors = ['All', ...Array.from(new Set(logs.map((l) => l.actor)))];
  const entities = ['All', ...Array.from(new Set(logs.map((l) => l.entity_type)))];

  const filtered = logs.filter((l) => {
    const matchSearch =
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.details.toLowerCase().includes(search.toLowerCase()) ||
      l.entity_id.toLowerCase().includes(search.toLowerCase()) ||
      l.audit_id.toLowerCase().includes(search.toLowerCase());
    const matchActor = actorFilter === 'All' || l.actor === actorFilter;
    const matchEntity = entityFilter === 'All' || l.entity_type === entityFilter;
    return matchSearch && matchActor && matchEntity;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: -40 }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 24, borderBottom: `1px solid ${T.border}` }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Shield size={20} color={T.sub} />
            <h1 style={{ fontSize: '28px', fontWeight: 600, color: T.text, margin: 0, letterSpacing: '-0.01em' }}>Audit Trail</h1>
          </div>
          <p style={{ fontSize: '13px', color: T.sub, margin: 0 }}>
            Immutable, chronological log of all system, AI, and human actions.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: T.text }}>{filtered.length} entries</div>
            <div style={{ fontSize: '10px', color: T.muted }}>Auto-refresh every 15s</div>
          </div>
          <button
            onClick={() => fetchLogs(true)}
            disabled={isRefreshing}
            style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 16px', fontSize: '13px', fontWeight: 500, color: T.text, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, cursor: isRefreshing ? 'not-allowed' : 'pointer', opacity: isRefreshing ? 0.5 : 1, transition: 'background 0.2s' }}
          >
            <RefreshCw size={14} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { label: 'Total Events',   value: logs.length },
          { label: 'System Actions', value: logs.filter(l => l.actor === 'System').length },
          { label: 'AI Actions',     value: logs.filter(l => l.actor === 'watsonx.ai').length },
          { label: 'Human Actions',  value: logs.filter(l => l.actor !== 'System' && l.actor !== 'watsonx.ai').length },
        ].map((k) => (
          <div key={k.label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 12 }}>{k.label}</span>
            <span style={{ fontSize: '34px', fontWeight: 300, color: T.text, lineHeight: 1, letterSpacing: '-0.02em' }}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* Legend & Filters Container */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        
        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: '11px', color: T.sub }}>
          <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.muted }}>Legend</span>
          {[
            { color: T.green,  label: 'Approved / Generated' },
            { color: T.red,    label: 'Rejected' },
            { color: T.amber,  label: 'Detected / Recalculated' },
            { color: T.muted,  label: 'Other' },
          ].map((l) => (
            <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.muted }} size={16} />
            <input
              type="text"
              placeholder="Search actions, details, entity IDs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', height: 36, padding: '0 16px 0 36px', fontSize: '13px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              style={{ height: 36, padding: '0 32px 0 12px', fontSize: '13px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, outline: 'none', appearance: 'auto' }}
            >
              {actors.map((a) => <option key={a}>{a}</option>)}
            </select>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              style={{ height: 36, padding: '0 32px 0 12px', fontSize: '13px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, outline: 'none', appearance: 'auto' }}
            >
              {entities.map((e) => <option key={e}>{e}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Log Table */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: T.sub, fontSize: '13px' }}>Loading audit log...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead style={{ background: T.surface2, borderBottom: `1px solid ${T.borderLight}` }}>
                <tr>
                  {['Timestamp', '', 'Actor', 'Action', 'Entity', 'Details', 'Audit ID'].map((h, i) => (
                    <th key={i} style={{ padding: '12px 24px', fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <LogRow key={log.audit_id} log={log} isNew={newLogIds.has(log.audit_id)} />
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 48, textAlign: 'center', fontSize: '13px', color: T.muted }}>
                      No audit events match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '11px', color: T.muted, paddingBottom: 24 }}>
        <Shield size={12} />
        <span>This audit log is append-only and tamper-evident. All entries are cryptographically signed in production.</span>
      </div>
      
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </motion.div>
  );
};
