import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Capa, Deviation } from '../api/types';
import { SeverityBadge, AIBanner, ApprovalActions } from '../components';
import { Sparkles, Loader2, Plus, ChevronDown, ChevronRight } from 'lucide-react';

// ─── Kanban Column ────────────────────────────────────────────────────────────
const STAGES: Capa['status'][] = ['Draft', 'Pending Review', 'Approved', 'Rejected', 'Closed'];

const stageColor: Record<string, string> = {
  'Draft':          'bg-slate-100 text-slate-600 border-slate-200',
  'Pending Review': 'bg-amber-50 text-amber-700 border-amber-200',
  'Approved':       'bg-green-50 text-green-700 border-green-200',
  'Rejected':       'bg-red-50 text-red-700 border-red-200',
  'Closed':         'bg-slate-50 text-slate-500 border-slate-200',
};

interface CapaCardProps {
  capa: Capa;
  deviation?: Deviation;
  onSelect: (capa: Capa) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

const CapaCard: React.FC<CapaCardProps> = ({ capa, deviation, onSelect, onApprove, onReject }) => (
  <div
    className="bg-white border border-base-border rounded-lg p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer group"
    onClick={() => onSelect(capa)}
  >
    <div className="flex items-start justify-between mb-3">
      <span className="font-mono text-xs text-base-muted">{capa.capa_id}</span>
      {capa.ai_generated && (
        <span className="flex items-center space-x-1 text-xs font-medium text-ai-text bg-ai-accent px-2 py-0.5 rounded-full border border-ai-border">
          <Sparkles size={10} />
          <span>AI</span>
        </span>
      )}
    </div>

    <h4 className="text-sm font-semibold text-base-ink mb-1 leading-snug group-hover:text-black">{capa.title}</h4>
    <p className="text-xs text-base-secondary mb-3 line-clamp-2">{capa.root_cause_hypothesis}</p>

    {deviation && (
      <div className="flex items-center space-x-2 mb-3">
        <span className="font-mono text-xs text-base-muted">{capa.deviation_id}</span>
        <SeverityBadge level={deviation.severity} />
      </div>
    )}

    <div className="text-xs text-base-muted mb-3">
      Owner: <span className="font-medium text-base-ink">{capa.owner_role}</span>
    </div>

    {capa.requires_human_approval && capa.status === 'Pending Review' && (
      <div className="pt-3 border-t border-base-border" onClick={(e) => e.stopPropagation()}>
        <ApprovalActions
          onApprove={async () => onApprove(capa.capa_id)}
          onReject={async () => onReject(capa.capa_id)}
          status={capa.status}
        />
      </div>
    )}
  </div>
);

// ─── CAPA Detail Panel ────────────────────────────────────────────────────────
const CapaDetail: React.FC<{ capa: Capa; onClose: () => void }> = ({ capa, onClose }) => {
  const sections: { label: string; value: string }[] = [
    { label: 'Root Cause Hypothesis', value: capa.root_cause_hypothesis },
    { label: 'Immediate Action',       value: capa.immediate_action },
    { label: 'Corrective Action',      value: capa.corrective_action },
    { label: 'Preventive Action',      value: capa.preventive_action },
    { label: 'Verification Method',    value: capa.verification_method },
  ];

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-base-card shadow-2xl z-50 flex flex-col border-l border-base-border animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between px-6 py-4 border-b border-base-border bg-slate-50/50">
        <div>
          <span className="font-mono text-xs text-base-muted block mb-1">{capa.capa_id}</span>
          <h2 className="text-lg font-semibold text-base-ink">{capa.title}</h2>
        </div>
        <div className="flex items-center space-x-3">
          <span className={`text-xs font-semibold px-2 py-1 rounded border ${stageColor[capa.status]}`}>{capa.status}</span>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-base-secondary hover:text-base-ink">✕</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg border border-base-border">
            <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Deviation</span>
            <span className="font-mono text-sm font-medium">{capa.deviation_id}</span>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-base-border">
            <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Owner</span>
            <span className="font-medium text-sm">{capa.owner_role}</span>
          </div>
        </div>

        {capa.ai_generated && (
          <AIBanner>
            <p className="text-sm text-base-ink">This CAPA was generated by <strong>IBM watsonx.ai</strong> based on deviation evidence, clinical context, and historical CAPA outcomes from similar trials. It requires human review before approval.</p>
          </AIBanner>
        )}

        {sections.map((s) => (
          <div key={s.label}>
            <h3 className="text-xs font-semibold text-base-muted uppercase tracking-wider mb-2">{s.label}</h3>
            <p className="text-sm text-base-ink leading-relaxed bg-slate-50 p-4 rounded-lg border border-base-border">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── AI Generator Panel ───────────────────────────────────────────────────────
const AIGeneratorPanel: React.FC<{ deviations: Deviation[]; onGenerate: (devId: string) => Promise<void> }> = ({ deviations, onGenerate }) => {
  const [selectedDev, setSelectedDev] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleGenerate = async () => {
    if (!selectedDev) return;
    setIsGenerating(true);
    await onGenerate(selectedDev);
    setIsGenerating(false);
    setExpanded(false);
    setSelectedDev('');
  };

  return (
    <div className="bg-ai-accent border border-ai-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/30 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <Sparkles size={16} className="text-ai-text" />
          <span className="font-semibold text-base-ink">Generate CAPA with IBM watsonx.ai</span>
        </div>
        {expanded ? <ChevronDown size={18} className="text-base-secondary" /> : <ChevronRight size={18} className="text-base-secondary" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-ai-border bg-white/20">
          <p className="text-sm text-base-secondary pt-4">Select a deviation to generate an AI-powered CAPA draft.</p>
          <select
            value={selectedDev}
            onChange={(e) => setSelectedDev(e.target.value)}
            className="w-full text-sm border border-base-border rounded-md bg-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-base-ink/20"
          >
            <option value="">Select a deviation...</option>
            {deviations.map((d) => (
              <option key={d.deviation_id} value={d.deviation_id}>
                {d.deviation_id} — {d.description.substring(0, 50)}...
              </option>
            ))}
          </select>
          <button
            onClick={handleGenerate}
            disabled={!selectedDev || isGenerating}
            className="w-full py-2.5 bg-base-ink hover:bg-black text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Generating CAPA draft...</span>
              </>
            ) : (
              <>
                <Plus size={16} />
                <span>Generate CAPA</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export const CAPAManagement = () => {
  const [capas, setCapas] = useState<Capa[]>([]);
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCapa, setSelectedCapa] = useState<Capa | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [c, d] = await Promise.all([api.getCapas(), api.getDeviations()]);
      setCapas(c);
      setDeviations(d);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleApprove = async (capaId: string) => {
    await api.approveCapa(capaId);
    await fetchData();
  };

  const handleReject = async (capaId: string) => {
    await api.rejectCapa(capaId);
    await fetchData();
  };

  const handleGenerate = async (deviationId: string) => {
    await api.generateCapa(deviationId);
    await fetchData();
  };

  const getDeviation = (devId: string) => deviations.find((d) => d.deviation_id === devId);

  if (isLoading && capas.length === 0) {
    return <div className="flex items-center justify-center h-64 text-base-secondary">Loading CAPA data...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="border-b border-base-border pb-6">
        <h1 className="text-3xl font-semibold text-base-ink">CAPA Management</h1>
        <p className="text-sm text-base-secondary mt-2">
          Corrective and Preventive Actions generated by IBM watsonx.ai and reviewed by clinical staff.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {STAGES.map((stage) => (
          <div key={stage} className="bg-base-card border border-base-border rounded-lg p-4">
            <span className="text-xs text-base-muted block mb-2">{stage}</span>
            <span className="text-2xl font-semibold text-base-ink">
              {capas.filter((c) => c.status === stage).length}
            </span>
          </div>
        ))}
      </div>

      {/* AI Generator */}
      <AIGeneratorPanel deviations={deviations} onGenerate={handleGenerate} />

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto">
        {STAGES.map((stage) => {
          const stageCaps = capas.filter((c) => c.status === stage);
          return (
            <div key={stage} className="flex flex-col min-w-[220px]">
              <div className={`flex items-center justify-between px-3 py-2 rounded-lg border mb-3 ${stageColor[stage]}`}>
                <span className="text-xs font-semibold uppercase tracking-wider">{stage}</span>
                <span className="text-xs font-bold tabular-nums">{stageCaps.length}</span>
              </div>
              <div className="space-y-3 flex-1">
                {stageCaps.length === 0 && (
                  <div className="border-2 border-dashed border-base-border rounded-lg p-4 text-center text-xs text-base-muted">
                    No CAPAs
                  </div>
                )}
                {stageCaps.map((capa) => (
                  <CapaCard
                    key={capa.capa_id}
                    capa={capa}
                    deviation={getDeviation(capa.deviation_id)}
                    onSelect={setSelectedCapa}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Side Panel */}
      {selectedCapa && (
        <>
          <div className="fixed inset-0 bg-base-ink/20 backdrop-blur-sm z-40" onClick={() => setSelectedCapa(null)} />
          <CapaDetail capa={selectedCapa} onClose={() => setSelectedCapa(null)} />
        </>
      )}
    </div>
  );
};
