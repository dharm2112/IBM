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
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px', height: 24, borderRadius: 12, fontSize: '11px', fontWeight: 400, background: '#F2F2F7', color: '#6E6E73' }}>
      <Terminal size={11} color="#6E6E73" /> System
    </span>
  );
  if (actor === 'watsonx.ai') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px', height: 24, borderRadius: 12, fontSize: '11px', fontWeight: 500, background: 'rgba(0,122,255,0.08)', color: '#007AFF' }}>
      <Sparkles size={12} color="#007AFF" /> watsonx.ai
    </span>
  );
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px', height: 24, borderRadius: 12, fontSize: '11px', fontWeight: 400, background: '#F2F2F7', color: '#1D1D1F' }}>
      <User size={11} color="#1D1D1F" /> {actor}
    </span>
  );
};

// ─── Action Dot ───────────────────────────────────────────────────────────────
const actionColor = (action: string) => {
  const l = action.toLowerCase();
  if (l.includes('approved') || l.includes('generated')) return '#34C759';
  if (l.includes('rejected')) return '#FF3B30';
  if (l.includes('detected') || l.includes('recalculated')) return '#FF9500';
  return '#AEAEB2';
};

// ─── Log Row ──────────────────────────────────────────────────────────────────
const LogRow: React.FC<{ log: AuditLog, index: number, isNew: boolean }> = ({ log, index, isNew }) => {
  const ts = new Date(log.timestamp);
  const dateStr = ts.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = ts.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <motion.tr 
      initial={{ opacity: 0, y: 12, backgroundColor: isNew ? 'rgba(0,122,255,0.06)' : '#ffffff' }}
      animate={{ opacity: 1, y: 0, backgroundColor: '#ffffff' }}
      transition={{ 
        opacity: { duration: 0.2, delay: index * 0.035, ease: [0.0, 0.0, 0.2, 1.0] },
        y: { duration: 0.2, delay: index * 0.035, ease: [0.0, 0.0, 0.2, 1.0] },
        backgroundColor: { duration: 0.6, delay: isNew ? 1.2 : 0, ease: 'easeOut' }
      }}
      style={{ borderBottom: '0.5px solid rgba(0,0,0,0.06)', height: 56 }} 
      whileHover={{ backgroundColor: '#F5F5F7', transition: { duration: 0.1 } }}
    >
      <td style={{ padding: '0 12px', verticalAlign: 'middle', width: 140, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', width: 7, height: 7, borderRadius: '50%', background: actionColor(log.action) }} />
        <div style={{ paddingLeft: 12 }}>
          <div style={{ fontSize: '13px', fontWeight: 400, color: '#1D1D1F', marginBottom: 2 }}>{dateStr}</div>
          <div style={{ fontSize: '11px', color: '#AEAEB2' }}>{timeStr}</div>
        </div>
      </td>
      <td style={{ padding: '0 12px', verticalAlign: 'middle', width: 140 }}>
        <ActorBadge actor={log.actor} />
      </td>
      <td style={{ padding: '0 12px', verticalAlign: 'middle', width: 180 }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#1D1D1F' }}>{log.action}</span>
      </td>
      <td style={{ padding: '0 12px', verticalAlign: 'middle', width: 120 }}>
        <div style={{ fontSize: '13px', color: '#1D1D1F', marginBottom: 2 }}>{log.entity_type}</div>
        <div style={{ fontSize: '11px', color: '#AEAEB2' }}>{log.entity_id}</div>
      </td>
      <td style={{ padding: '0 12px', verticalAlign: 'middle' }}>
        <div style={{ fontSize: '13px', color: '#6E6E73', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{log.details}</div>
      </td>
      <td style={{ padding: '0 12px', verticalAlign: 'middle', width: 80, textAlign: 'right' }}>
        <span style={{ fontFamily: 'SF Mono, monospace', fontSize: '11px', color: '#AEAEB2' }}>{log.audit_id}</span>
      </td>
    </motion.tr>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <Shield size={18} color="#6E6E73" />
            <h1 style={{ fontSize: '28px', fontWeight: 300, color: '#1D1D1F', margin: 0 }}>Audit trail</h1>
          </div>
          <p style={{ fontSize: '13px', color: '#6E6E73', margin: 0 }}>
            Immutable, chronological log of all system, AI, and human actions.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: '#AEAEB2' }}>{filtered.length} entries</div>
            <div style={{ fontSize: '11px', color: '#AEAEB2' }}>Auto-refresh every 15s</div>
          </div>
          <button
            onClick={() => fetchLogs(true)}
            disabled={isRefreshing}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: 0, fontSize: '13px', color: '#007AFF', background: 'transparent', border: 'none', cursor: isRefreshing ? 'not-allowed' : 'pointer', opacity: isRefreshing ? 0.5 : 1 }}
          >
            <RefreshCw size={14} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Events',   value: logs.length },
          { label: 'System Actions', value: logs.filter(l => l.actor === 'System').length },
          { label: 'AI Actions',     value: logs.filter(l => l.actor === 'watsonx.ai').length },
          { label: 'Human Actions',  value: logs.filter(l => l.actor !== 'System' && l.actor !== 'watsonx.ai').length },
        ].map((k) => (
          <div key={k.label} style={{ background: '#F5F5F7', borderRadius: 10, padding: 20 }}>
            <span style={{ fontSize: '10px', color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>{k.label}</span>
            <span style={{ fontSize: '32px', fontWeight: 300, color: '#1D1D1F', lineHeight: 1 }}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* Legend & Filters Container */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 48, marginTop: 8 }}>
        
        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: '11px', color: '#AEAEB2' }}>Legend</span>
          {[
            { color: '#34C759', label: 'Approved / Generated' },
            { color: '#FF3B30', label: 'Rejected' },
            { color: '#FF9500', label: 'Detected / Recalculated' },
            { color: '#AEAEB2', label: 'Other' },
          ].map((l) => (
            <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: '#6E6E73' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ position: 'relative', width: 240 }}>
            <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#AEAEB2' }} size={14} />
            <input
              type="text"
              placeholder="Search actions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', height: 36, padding: '0 12px 0 32px', fontSize: '13px', background: '#F2F2F7', border: 'none', borderRadius: 10, color: '#1D1D1F', outline: 'none' }}
            />
          </div>
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            style={{ height: 36, padding: '0 12px', fontSize: '13px', background: '#F2F2F7', border: 'none', borderRadius: 10, color: '#1D1D1F', outline: 'none' }}
          >
            {actors.map((a) => <option key={a}>{a}</option>)}
          </select>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            style={{ height: 36, padding: '0 12px', fontSize: '13px', background: '#F2F2F7', border: 'none', borderRadius: 10, color: '#1D1D1F', outline: 'none' }}
          >
            {entities.map((e) => <option key={e}>{e}</option>)}
          </select>
        </div>
      </div>

      {/* Log Table */}
      <div style={{ marginTop: 8 }}>
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#AEAEB2', fontSize: '13px' }}>Loading audit log...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid rgba(0,0,0,0.08)', height: 32 }}>
                  <th style={{ padding: '0 12px', fontSize: '10px', color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 400, width: 140 }}>Timestamp</th>
                  <th style={{ padding: '0 12px', fontSize: '10px', color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 400, width: 140 }}>Actor</th>
                  <th style={{ padding: '0 12px', fontSize: '10px', color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 400, width: 180 }}>Action</th>
                  <th style={{ padding: '0 12px', fontSize: '10px', color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 400, width: 120 }}>Entity</th>
                  <th style={{ padding: '0 12px', fontSize: '10px', color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 400 }}>Details</th>
                  <th style={{ padding: '0 12px', fontSize: '10px', color: '#AEAEB2', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 400, width: 80, textAlign: 'right' }}>Audit ID</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {filtered.map((log, index) => (
                    <LogRow key={log.audit_id} log={log} index={index} isNew={newLogIds.has(log.audit_id)} />
                  ))}
                </AnimatePresence>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 48, textAlign: 'center', fontSize: '13px', color: '#AEAEB2' }}>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '11px', color: '#AEAEB2', height: 40, borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
        <Shield size={13} />
        <span>This audit log is append-only and tamper-evident. All entries are cryptographically signed in production.</span>
      </div>
      
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </motion.div>
  );
};
