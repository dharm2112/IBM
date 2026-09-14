import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/mock';
import type { AuditLog } from '../api/types';
import { RefreshCw, Shield, Search, Terminal, User, Sparkles } from 'lucide-react';

// ─── Actor Badge ──────────────────────────────────────────────────────────────
const ActorBadge: React.FC<{ actor: string }> = ({ actor }) => {
  if (actor === 'System') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
      <Terminal size={10} /> System
    </span>
  );
  if (actor === 'watsonx.ai') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-ai-accent text-ai-text border border-ai-border">
      <Sparkles size={10} /> watsonx.ai
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
      <User size={10} /> {actor}
    </span>
  );
};

// ─── Action Dot ───────────────────────────────────────────────────────────────
const actionColor = (action: string) => {
  if (action.toLowerCase().includes('approved') || action.toLowerCase().includes('generated'))
    return 'bg-risk-low';
  if (action.toLowerCase().includes('rejected'))
    return 'bg-risk-high';
  if (action.toLowerCase().includes('detected') || action.toLowerCase().includes('recalculated'))
    return 'bg-risk-medium';
  return 'bg-slate-400';
};

// ─── Log Row ──────────────────────────────────────────────────────────────────
const LogRow: React.FC<{ log: AuditLog; isNew?: boolean }> = ({ log, isNew }) => {
  const ts = new Date(log.timestamp);
  const dateStr = ts.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = ts.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <tr className={`group border-b border-base-border transition-colors ${isNew ? 'animate-in fade-in slide-in-from-top-1 duration-500 bg-amber-50/40' : 'hover:bg-slate-50/60'}`}>
      <td className="px-6 py-4 align-top w-44">
        <div className="text-xs font-medium text-base-ink">{dateStr}</div>
        <div className="text-xs text-base-muted font-mono">{timeStr}</div>
      </td>
      <td className="px-6 py-4 align-top w-8">
        <div className="mt-1 flex flex-col items-center">
          <div className={`w-2 h-2 rounded-full ${actionColor(log.action)} ring-4 ring-white`}></div>
        </div>
      </td>
      <td className="px-4 py-4 align-top">
        <ActorBadge actor={log.actor} />
      </td>
      <td className="px-4 py-4 align-top">
        <span className="text-sm font-semibold text-base-ink">{log.action}</span>
      </td>
      <td className="px-4 py-4 align-top">
        <div className="text-xs font-medium text-base-secondary">{log.entity_type}</div>
        <div className="font-mono text-xs text-base-muted mt-0.5">{log.entity_id}</div>
      </td>
      <td className="px-6 py-4 align-top">
        <p className="text-xs text-base-secondary leading-relaxed">{log.details}</p>
      </td>
      <td className="px-6 py-4 align-top text-right">
        <span className="font-mono text-[10px] text-base-muted">{log.audit_id}</span>
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
    // Poll for new logs every 15 seconds (picks up any CAPA / rule approvals the user did)
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
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-base-border pb-6">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <Shield size={18} className="text-base-secondary" />
            <h1 className="text-3xl font-semibold text-base-ink">Audit Trail</h1>
          </div>
          <p className="text-sm text-base-secondary">
            Immutable, chronological log of all system, AI, and human actions.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-xs text-base-muted text-right">
            <div>{filtered.length} entries</div>
            <div>Auto-refresh every 15s</div>
          </div>
          <button
            onClick={() => fetchLogs(true)}
            disabled={isRefreshing}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-base-ink bg-white border border-base-border hover:bg-slate-50 rounded-md transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Events',   value: logs.length },
          { label: 'System Actions', value: logs.filter(l => l.actor === 'System').length },
          { label: 'AI Actions',     value: logs.filter(l => l.actor === 'watsonx.ai').length },
          { label: 'Human Actions',  value: logs.filter(l => l.actor !== 'System' && l.actor !== 'watsonx.ai').length },
        ].map((k) => (
          <div key={k.label} className="bg-base-card border border-base-border rounded-lg p-4">
            <span className="text-xs text-base-muted block mb-1">{k.label}</span>
            <span className="text-2xl font-semibold text-base-ink">{k.value}</span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center space-x-6 text-xs text-base-secondary">
        <span className="font-semibold uppercase tracking-wider text-base-muted">Legend</span>
        {[
          { color: 'bg-risk-low',    label: 'Approved / Generated' },
          { color: 'bg-risk-high',   label: 'Rejected' },
          { color: 'bg-risk-medium', label: 'Detected / Recalculated' },
          { color: 'bg-slate-400',   label: 'Other' },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${l.color}`}></span>
            {l.label}
          </span>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-base-card border border-base-border rounded-lg p-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-muted" size={16} />
          <input
            type="text"
            placeholder="Search actions, details, entity IDs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-base-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-base-ink/20 focus:border-base-ink transition-shadow"
          />
        </div>
        <div className="flex gap-3">
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="text-sm border border-base-border rounded-md bg-white py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-base-ink/20"
          >
            {actors.map((a) => <option key={a}>{a}</option>)}
          </select>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="text-sm border border-base-border rounded-md bg-white py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-base-ink/20"
          >
            {entities.map((e) => <option key={e}>{e}</option>)}
          </select>
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-base-card border border-base-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-base-secondary text-sm">Loading audit log...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-base-border bg-slate-50/50">
                <tr>
                  {['Timestamp', '', 'Actor', 'Action', 'Entity', 'Details', 'Audit ID'].map((h) => (
                    <th key={h} className="px-6 py-3 text-xs font-semibold text-base-secondary uppercase tracking-wider whitespace-nowrap">
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
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-base-muted">
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
      <div className="flex items-center space-x-2 text-xs text-base-muted pb-4">
        <Shield size={12} />
        <span>This audit log is append-only and tamper-evident. All entries are cryptographically signed in production.</span>
      </div>
    </div>
  );
};
