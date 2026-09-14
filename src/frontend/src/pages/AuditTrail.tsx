import { useEffect, useState, useMemo } from 'react';
import { api } from '../api/client';
import type { AuditLog } from '../api/types';
import type { Column } from '../components/DataTable';
import { DataTable, DetailDrawer, AIBanner } from '../components';
import { Shield, AlertTriangle, ArrowRight, Clock, FileText, Sparkles, User } from 'lucide-react';

export const AuditTrail = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  // Detail Drawer state
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedLogs = await api.getAuditLogs();
      setLogs(fetchedLogs);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = searchQuery === '' || 
        log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.entity_id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesEntity = entityFilter === '' || log.entity_type === entityFilter;

      return matchesSearch && matchesEntity;
    });
  }, [logs, searchQuery, entityFilter]);

  const uniqueEntities = useMemo(() => {
    return Array.from(new Set(logs.map(l => l.entity_type))).sort();
  }, [logs]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(undefined, { 
      year: 'numeric', month: 'short', day: 'numeric', 
      hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
  };

  const columns: Column<AuditLog>[] = [
    { key: 'timestamp', header: 'Timestamp', render: (l: AuditLog) => (
      <span className="text-xs font-mono text-base-secondary whitespace-nowrap">{formatDate(l.timestamp)}</span>
    )},
    { key: 'action', header: 'Action/Event', render: (l: AuditLog) => (
      <div className="flex items-center space-x-2">
        {l.source === 'watsonx.ai' ? <Sparkles size={14} className="text-purple-500" /> : <Clock size={14} className="text-blue-500" />}
        <span className="font-medium text-sm text-base-ink">{l.action}</span>
      </div>
    )},
    { key: 'entity', header: 'Entity', render: (l: AuditLog) => (
      <div>
        <span className="text-xs uppercase bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">{l.entity_type}</span>
        <span className="ml-2 font-mono text-xs">{l.entity_id}</span>
      </div>
    )},
    { key: 'actor', header: 'User/Actor', render: (l: AuditLog) => (
      <span className="text-sm">{l.actor}</span>
    )},
    { key: 'source', header: 'Source', render: (l: AuditLog) => (
      <span className="text-sm text-base-secondary">{l.source || 'System'}</span>
    )},
    { key: 'details', header: 'Details', render: (l: AuditLog) => (
      <div className="truncate max-w-[200px] text-sm" title={l.details}>
        {l.details}
      </div>
    )},
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-base-ink">Audit Trail</h1>
          <p className="text-sm text-base-secondary mt-2">Comprehensive log of system events, human actions, and AI inferences.</p>
        </div>
      </div>

      <AIBanner>
        <div className="space-y-1">
          <h3 className="font-semibold text-sm text-ai-text flex items-center">
            <Shield size={16} className="mr-2" /> AI Governance & Traceability
          </h3>
          <p className="text-sm text-ai-text/80">
            Events originating from IBM watsonx.ai (e.g., protocol extraction, CAPA generation) are marked with an AI indicator. 
            All AI outputs are advisory and require human approval. The deterministic rule engine remains strictly responsible for deviation detection and risk scoring.
          </p>
        </div>
      </AIBanner>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center space-x-3">
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-lg border border-base-border shadow-sm">
        <div className="flex-1">
          <label className="block text-xs font-medium text-base-muted uppercase tracking-wider mb-1">Search</label>
          <input 
            type="text" 
            placeholder="Search details, actions, or IDs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-base-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-base-ink/20"
          />
        </div>
        <div className="w-full md:w-64">
          <label className="block text-xs font-medium text-base-muted uppercase tracking-wider mb-1">Entity Type</label>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="w-full border border-base-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-base-ink/20"
          >
            <option value="">All Entities</option>
            {uniqueEntities.map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-base-secondary">Loading audit logs...</div>
      ) : (
        <DataTable 
          data={filteredLogs} 
          columns={columns} 
          keyField="audit_id"
          onRowClick={(l: AuditLog) => setSelectedLog(l)}
        />
      )}

      {/* Audit Log Detail Drawer */}
      <DetailDrawer 
        isOpen={!!selectedLog} 
        onClose={() => setSelectedLog(null)}
        title={
          <div className="flex items-center space-x-3">
            <span className="font-mono text-sm">{selectedLog?.audit_id}</span>
          </div>
        }
      >
        {selectedLog && (
          <div className="space-y-6">
            {selectedLog.source === 'watsonx.ai' && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start space-x-3">
                <Sparkles className="text-purple-600 mt-0.5 flex-shrink-0" size={18} />
                <div>
                  <h4 className="text-sm font-medium text-purple-900">AI-Generated Event</h4>
                  <p className="text-xs text-purple-700 mt-1">
                    This event was originated by IBM watsonx.ai. AI-generated entities (like CAPAs or extracted rules) are created as drafts and require explicit human approval to become active.
                  </p>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-xl font-semibold text-base-ink mb-1">{selectedLog.action}</h3>
              <p className="text-sm font-mono text-base-secondary">{formatDate(selectedLog.timestamp)}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-base-border">
                <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Entity</span>
                <span className="font-medium text-sm block">{selectedLog.entity_type}</span>
                <span className="font-mono text-xs text-base-secondary mt-1 block">{selectedLog.entity_id}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-base-border flex flex-col justify-center">
                <div className="flex items-center space-x-2">
                  <User size={16} className="text-base-secondary" />
                  <span className="font-medium text-sm block">{selectedLog.actor}</span>
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <FileText size={16} className="text-base-secondary" />
                  <span className="text-sm text-base-secondary block">Source: {selectedLog.source || 'System'}</span>
                </div>
              </div>
            </div>

            {(selectedLog.previous_status || selectedLog.new_status) && (
              <div className="border-t border-base-border pt-6">
                <h3 className="text-sm font-semibold text-base-muted uppercase tracking-wider mb-4">State Change</h3>
                <div className="flex items-center space-x-4 bg-slate-50 p-4 rounded-lg border border-base-border">
                  <div className="flex-1">
                    <span className="text-xs text-base-secondary block mb-1">Previous Status</span>
                    <span className="font-medium text-sm">{selectedLog.previous_status || 'None'}</span>
                  </div>
                  <ArrowRight className="text-base-muted flex-shrink-0" size={20} />
                  <div className="flex-1 text-right">
                    <span className="text-xs text-base-secondary block mb-1">New Status</span>
                    <span className="font-medium text-sm">{selectedLog.new_status || 'None'}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-base-border pt-6">
              <h3 className="text-sm font-semibold text-base-muted uppercase tracking-wider mb-4">Event Details</h3>
              <p className="text-sm text-base-secondary bg-white p-4 rounded-lg border border-base-border shadow-sm leading-relaxed">
                {selectedLog.details}
              </p>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};
