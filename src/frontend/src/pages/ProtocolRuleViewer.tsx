import React, { useEffect, useState } from 'react';
import { api } from '../api/mock';
import type { ProtocolRule } from '../api/types';
import { SeverityBadge, AIBanner, ApprovalActions, DetailDrawer } from '../components';
import { Upload, Search, FileText, CheckCircle, Clock, Loader2, Sparkles } from 'lucide-react';

// ─── Rule Card ────────────────────────────────────────────────────────────────
const RuleCard: React.FC<{ rule: ProtocolRule; onClick: () => void }> = ({ rule, onClick }) => {
  const statusStyles: Record<string, string> = {
    APPROVED: 'bg-green-50 text-green-700 border-green-200',
    PENDING:  'bg-amber-50 text-amber-700 border-amber-200',
    REJECTED: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <div
      onClick={onClick}
      className="bg-base-card border border-base-border rounded-lg p-5 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-3">
        <span className="font-mono text-xs text-base-muted">{rule.rule_id}</span>
        <div className="flex items-center space-x-2">
          <SeverityBadge level={rule.severity} />
          <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${statusStyles[rule.approval_status]}`}>
            {rule.approval_status === 'APPROVED' ? (
              <span className="flex items-center gap-1"><CheckCircle size={10} /> Approved</span>
            ) : rule.approval_status === 'PENDING' ? (
              <span className="flex items-center gap-1"><Clock size={10} /> Pending</span>
            ) : 'Rejected'}
          </span>
        </div>
      </div>

      <h3 className="text-base font-semibold text-base-ink mb-1 group-hover:text-black transition-colors">{rule.name}</h3>
      <p className="text-sm text-base-secondary mb-4 line-clamp-2">{rule.description}</p>

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-600 rounded border border-slate-200">{rule.category}</span>
        <span className="text-xs text-base-muted">{rule.protocol_reference}</span>
      </div>
    </div>
  );
};

// ─── Upload Panel ─────────────────────────────────────────────────────────────
const UploadPanel: React.FC<{ onUpload: (file: File) => Promise<void> }> = ({ onUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lastUploaded, setLastUploaded] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setIsUploading(true);
    await onUpload(file);
    setLastUploaded(file.name);
    setIsUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="bg-ai-accent border border-ai-border rounded-lg p-6">
      <div className="flex items-center space-x-3 mb-4">
        <Sparkles size={16} className="text-ai-text" />
        <h3 className="font-semibold text-base-ink">Upload Protocol Document</h3>
        <span className="text-xs text-base-muted">— IBM watsonx.ai will auto-extract rules</span>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${
          isDragging ? 'border-base-ink bg-white/60' : 'border-ai-border bg-white/30 hover:bg-white/50'
        }`}
      >
        {isUploading ? (
          <div className="flex flex-col items-center space-y-3">
            <Loader2 size={28} className="text-ai-text animate-spin" />
            <p className="text-sm font-medium text-base-ink animate-pulse">watsonx.ai is extracting protocol rules...</p>
          </div>
        ) : (
          <>
            <FileText size={28} className="mx-auto mb-3 text-ai-text" />
            <p className="text-sm font-medium text-base-ink mb-1">Drop your protocol PDF here</p>
            <p className="text-xs text-base-muted mb-4">or click to browse</p>
            <label className="cursor-pointer inline-flex items-center space-x-2 px-4 py-2 bg-base-ink text-white text-sm font-medium rounded-md hover:bg-black transition-colors">
              <Upload size={14} />
              <span>Browse File</span>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </label>
            {lastUploaded && (
              <p className="mt-4 text-xs text-risk-low flex items-center justify-center gap-1">
                <CheckCircle size={12} /> Rule extracted from <strong>{lastUploaded}</strong> — review below
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Rule Detail Drawer ───────────────────────────────────────────────────────
const RuleDetail: React.FC<{
  rule: ProtocolRule;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
}> = ({ rule, onApprove, onReject }) => {
  const isAiExtracted = rule.category === 'Extracted';

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <SeverityBadge level={rule.severity} />
        <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-600 rounded border border-slate-200">{rule.category}</span>
        <span className="text-xs text-base-muted">{rule.protocol_reference}</span>
      </div>

      {isAiExtracted && (
        <AIBanner>
          <p className="text-sm text-base-ink">
            This rule was <strong>auto-extracted by IBM watsonx.ai</strong> from your uploaded protocol document. Review the condition and threshold below before approving for use in deviation detection.
          </p>
        </AIBanner>
      )}

      <div>
        <h3 className="text-xs font-semibold text-base-muted uppercase tracking-wider mb-2">Description</h3>
        <p className="text-sm text-base-ink leading-relaxed bg-slate-50 p-4 rounded-lg border border-base-border">{rule.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 rounded-lg border border-base-border">
          <span className="text-xs text-base-muted uppercase tracking-wider block mb-2">Condition</span>
          <code className="text-sm font-mono text-base-ink break-all">{rule.condition}</code>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg border border-base-border">
          <span className="text-xs text-base-muted uppercase tracking-wider block mb-2">Threshold</span>
          <code className="text-sm font-mono text-base-ink">{rule.threshold}</code>
        </div>
      </div>

      <div className="p-4 bg-slate-50 rounded-lg border border-base-border">
        <span className="text-xs text-base-muted uppercase tracking-wider block mb-2">Protocol Reference</span>
        <p className="text-sm font-medium text-base-ink">{rule.protocol_reference}</p>
      </div>

      {rule.approval_status === 'PENDING' && (
        <div className="pt-4 border-t border-base-border">
          <p className="text-xs text-base-muted mb-3">This rule is pending review. Approve to activate it in the deviation detection engine.</p>
          <ApprovalActions
            onApprove={onApprove}
            onReject={onReject}
            status={rule.approval_status}
          />
        </div>
      )}

      {rule.approval_status === 'APPROVED' && (
        <div className="flex items-center space-x-2 text-sm font-medium text-risk-low p-4 bg-green-50 rounded-lg border border-green-200">
          <CheckCircle size={16} />
          <span>This rule is active in the deviation detection engine.</span>
        </div>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export const ProtocolRuleViewer = () => {
  const [rules, setRules] = useState<ProtocolRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRule, setSelectedRule] = useState<ProtocolRule | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const fetched = await api.getProtocolRules();
      setRules(fetched);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleUpload = async (file: File) => {
    await api.uploadProtocol(file);
    await fetchData();
  };

  const handleApprove = async (ruleId: string) => {
    await api.approveRule(ruleId);
    await fetchData();
    setSelectedRule(null);
  };

  const handleReject = async (ruleId: string) => {
    await api.rejectRule(ruleId);
    await fetchData();
    setSelectedRule(null);
  };

  const categories = ['All', ...Array.from(new Set(rules.map((r) => r.category)))];

  const filtered = rules.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
                          r.rule_id.toLowerCase().includes(search.toLowerCase()) ||
                          r.description.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === 'All' || r.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || r.approval_status === statusFilter;
    return matchesSearch && matchesCat && matchesStatus;
  });

  const approvedCount = rules.filter((r) => r.approval_status === 'APPROVED').length;
  const pendingCount  = rules.filter((r) => r.approval_status === 'PENDING').length;

  if (isLoading && rules.length === 0) {
    return <div className="flex items-center justify-center h-64 text-base-secondary">Loading protocol rules...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-base-border pb-6">
        <div>
          <h1 className="text-3xl font-semibold text-base-ink">Protocol Rules</h1>
          <p className="text-sm text-base-secondary mt-2">
            <strong className="text-base-ink font-medium">{approvedCount} active</strong> rules · {pendingCount} pending review
          </p>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Rules', value: rules.length },
          { label: 'Active',      value: approvedCount },
          { label: 'Pending',     value: pendingCount  },
        ].map((k) => (
          <div key={k.label} className="bg-base-card border border-base-border rounded-lg p-4">
            <span className="text-xs text-base-muted block mb-1">{k.label}</span>
            <span className="text-2xl font-semibold text-base-ink">{k.value}</span>
          </div>
        ))}
      </div>

      {/* Upload Panel */}
      <UploadPanel onUpload={handleUpload} />

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-muted" size={16} />
          <input
            type="text"
            placeholder="Search rules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-base-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-base-ink/20 focus:border-base-ink transition-shadow"
          />
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-sm border border-base-border rounded-md bg-white py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-base-ink/20"
          >
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>

          <div className="flex items-center bg-white border border-base-border rounded-md p-1">
            {['All', 'APPROVED', 'PENDING'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  statusFilter === s ? 'bg-slate-100 text-base-ink shadow-sm' : 'text-base-secondary hover:text-base-ink'
                }`}
              >
                {s === 'All' ? 'All' : s === 'APPROVED' ? 'Active' : 'Pending'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((rule) => (
          <RuleCard key={rule.rule_id} rule={rule} onClick={() => setSelectedRule(rule)} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 py-16 text-center text-base-muted text-sm">No rules match your filters.</div>
        )}
      </div>

      {/* Detail Drawer */}
      <DetailDrawer
        isOpen={!!selectedRule}
        onClose={() => setSelectedRule(null)}
        title={
          selectedRule && (
            <div>
              <span className="font-mono text-xs text-base-muted block mb-1">{selectedRule.rule_id}</span>
              <h2 className="text-base font-semibold text-base-ink">{selectedRule.name}</h2>
            </div>
          )
        }
        footer={undefined}
      >
        {selectedRule && (
          <RuleDetail
            rule={selectedRule}
            onApprove={() => handleApprove(selectedRule.rule_id)}
            onReject={() => handleReject(selectedRule.rule_id)}
          />
        )}
      </DetailDrawer>
    </div>
  );
};
