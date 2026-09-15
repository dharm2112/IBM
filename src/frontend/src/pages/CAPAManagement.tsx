import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../api/client';
import type { Capa, Deviation } from '../api/types';
import { SeverityBadge, AIBanner, ApprovalActions } from '../components';
import { Sparkles, Loader2, Plus, ChevronDown, ChevronRight, X } from 'lucide-react';

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

// ─── Badge Animator ────────────────────────────────────────────────────────────
// ─── Badge Animator ────────────────────────────────────────────────────────────
const AnimatedBadge: React.FC<{ count: number; bg: string; color: string }> = ({ count, bg, color }) => {
  return (
    <motion.span
      key={count}
      initial={{ scale: 1.3 }}
      animate={{ scale: 1.0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      style={{ width: 18, height: 18, borderRadius: '50%', background: bg, color: color, fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {count}
    </motion.span>
  );
};

// ─── Kanban Column ────────────────────────────────────────────────────────────
const STAGES: Capa['status'][] = ['Draft', 'Pending Review', 'Approved', 'Rejected', 'Closed'];

const stageColor: Record<string, any> = {
  'Draft':          { bg: T.surface2, color: T.sub },
  'Pending Review': { bg: T.amberBg, color: '#B26B00' },
  'Approved':       { bg: T.greenBg, color: '#137333' },
  'Rejected':       { bg: T.redBg, color: '#C5221F' },
  'Closed':         { bg: T.surface2, color: T.muted },
};

interface CapaCardProps {
  capa: Capa;
  deviation?: Deviation;
  onSelect: (capa: Capa) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

const CapaCard: React.FC<CapaCardProps> = ({ capa, deviation, onSelect, onApprove, onReject }) => {
  const isApproved = capa.status === 'Approved';
  const [actionState, setActionState] = useState<'idle' | 'approving' | 'rejecting'>('idle');

  const handleApprove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActionState('approving');
    await new Promise(r => setTimeout(r, 450)); // 200ms flash + 250ms slide up
    onApprove(capa.capa_id);
  };

  const handleReject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActionState('rejecting');
    await new Promise(r => setTimeout(r, 600)); // 400ms shake + 200ms fade out
    onReject(capa.capa_id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ 
        opacity: actionState === 'rejecting' ? 0 : actionState === 'approving' ? 0 : 1, 
        scale: actionState === 'rejecting' ? 0.95 : 1,
        y: actionState === 'approving' ? -8 : 0,
        x: actionState === 'rejecting' ? [0, -6, 6, -4, 4, 0] : 0,
        borderColor: actionState === 'approving' ? '#34C759' : 'rgba(0,0,0,0.08)'
      }}
      transition={{ 
        layout: { type: 'spring', stiffness: 500, damping: 35 },
        opacity: { duration: 0.2 },
        scale: { duration: 0.3, ease: [0.175, 0.885, 0.32, 1.275] }, // --ease-overshoot for enter
        y: { duration: 0.25, ease: [0.4, 0.0, 1.0, 1.0] }, // --ease-accelerate
        x: { duration: 0.4 }, // shake
        borderColor: { duration: 0.2 }
      }}
      onClick={() => onSelect(capa)}
      style={{
        background: '#ffffff',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 12,
        padding: 16,
        cursor: 'pointer',
        marginBottom: 12,
        position: 'relative'
      }}
    >
      {isApproved && (
        <div style={{ position: 'absolute', top: 12, right: 12, width: 20, height: 20, borderRadius: '50%', background: 'rgba(52,199,89,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1A7A35' }}>
          ✓
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#AEAEB2' }}>{capa.capa_id}</span>
        {capa.ai_generated && !isApproved && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '10px', color: '#007AFF', background: 'rgba(0,122,255,0.10)', padding: '2px 8px', borderRadius: 20 }}>
            <Sparkles size={10} />
            AI
          </span>
        )}
      </div>

      <h4 style={{ fontSize: '15px', fontWeight: 500, color: '#1D1D1F', margin: '0 0 4px 0' }}>{capa.title}</h4>
      <p style={{ fontSize: '13px', color: '#6E6E73', margin: '0 0 12px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{capa.root_cause_hypothesis}</p>

      {deviation && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: '11px', color: '#6E6E73', background: '#F2F2F7', padding: '2px 8px', borderRadius: 999 }}>{capa.deviation_id}</span>
          <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#C0291F', background: 'rgba(255,59,48,0.10)', padding: '2px 8px', borderRadius: 999 }}>Critical</span>
        </div>
      )}

      <div style={{ fontSize: '12px', color: '#AEAEB2' }}>
        Owner <span style={{ color: '#1D1D1F', marginLeft: 4 }}>{capa.owner_role}</span>
      </div>

      {capa.requires_human_approval && capa.status === 'Pending Review' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
          <button onClick={handleReject} style={{ flex: 1, height: 32, background: 'rgba(255,59,48,0.08)', color: '#FF3B30', border: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '13px', cursor: 'pointer' }}>
            <X size={14} /> Reject
          </button>
          <button onClick={handleApprove} style={{ flex: 1, height: 32, background: '#34C759', color: '#fff', fontWeight: 500, border: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '13px', cursor: 'pointer' }}>
            <motion.div
              animate={{ rotate: actionState === 'approving' ? 360 : 0 }}
              transition={{ duration: 0.3 }}
              style={{ display: 'flex' }}
            >
              ✓
            </motion.div>
             Approve
          </button>
        </div>
      )}
    </motion.div>
  );
};

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
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 560, background: T.surface, boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', zIndex: 50, display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${T.border}` }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${T.border}`, background: T.surface }}>
        <div>
          <span style={{ fontFamily: 'SF Mono, monospace', fontSize: '11px', color: T.muted, display: 'block', marginBottom: 4 }}>{capa.capa_id}</span>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: T.text, margin: 0, letterSpacing: '-0.01em' }}>{capa.title}</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: stageColor[capa.status].bg, color: stageColor[capa.status].color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {capa.status}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer', color: T.sub, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ padding: '12px 16px', background: T.surface2, borderRadius: 12 }}>
            <span style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Deviation</span>
            <span style={{ fontFamily: 'SF Mono, monospace', fontSize: '13px', fontWeight: 500, color: T.text }}>{capa.deviation_id}</span>
          </div>
          <div style={{ padding: '12px 16px', background: T.surface2, borderRadius: 12 }}>
            <span style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Owner</span>
            <span style={{ fontSize: '13px', fontWeight: 500, color: T.text }}>{capa.owner_role}</span>
          </div>
        </div>

        {capa.ai_generated && (
          <div style={{ padding: 16, background: T.blueBg, border: `1px solid rgba(0,122,255,0.2)`, borderRadius: 12, display: 'flex', gap: 12 }}>
            <Sparkles size={16} color={T.accent} style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: '13px', color: T.text, margin: 0, lineHeight: 1.5 }}>
              This CAPA was generated by <strong>IBM watsonx.ai</strong> based on deviation evidence, clinical context, and historical CAPA outcomes from similar trials. It requires human review before approval.
            </p>
          </div>
        )}

        {sections.map((s) => (
          <div key={s.label}>
            <h3 style={{ fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px 0' }}>{s.label}</h3>
            <p style={{ fontSize: '13px', color: T.text, lineHeight: 1.5, margin: 0, padding: 16, background: T.surface2, borderRadius: 12 }}>{s.value}</p>
          </div>
        ))}
      </div>
    </motion.div>
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
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{ width: '100%', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: '#F5F5F7', border: 'none', borderRadius: 12, cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Sparkles size={16} color="#007AFF" />
          <span style={{ fontSize: '13px', fontWeight: 400, color: '#1D1D1F' }}>Generate CAPA with IBM watsonx.ai</span>
        </div>
        {expanded ? <ChevronDown size={14} color="#AEAEB2" /> : <ChevronRight size={14} color="#AEAEB2" />}
      </button>

      {expanded && (
        <div style={{ padding: '20px', borderTop: `1px solid rgba(0,122,255,0.1)`, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: '13px', color: T.sub, margin: 0 }}>Select a deviation to generate an AI-powered CAPA draft.</p>
          <select
            value={selectedDev}
            onChange={(e) => setSelectedDev(e.target.value)}
            style={{ width: '100%', height: 36, padding: '0 12px', fontSize: '13px', background: T.surface2, border: 'none', borderRadius: 8, color: T.text, outline: 'none' }}
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
            style={{
              width: '100%', height: 36, background: T.accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: '13px', fontWeight: 500, cursor: (!selectedDev || isGenerating) ? 'not-allowed' : 'pointer', opacity: (!selectedDev || isGenerating) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}
          >
            {isGenerating ? (
              <>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Generating CAPA draft...</span>
              </>
            ) : (
              <>
                <Plus size={14} />
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
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 250, color: T.sub, fontSize: '13px' }}>Loading CAPA data...</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: -40 }} // Pull up to match layout
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 300, color: '#1D1D1F', margin: 0 }}>CAPA Management</h1>
          <p style={{ fontSize: '13px', color: '#6E6E73', margin: '4px 0 0 0' }}>
            Corrective and Preventive Actions generated by IBM watsonx.ai and reviewed by clinical staff.
          </p>
        </div>
        <button style={{ height: 36, padding: '0 16px', background: '#007AFF', color: '#fff', border: 'none', borderRadius: 10, fontSize: '13px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <Sparkles size={16} />
          <span>Generate CAPA</span>
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
        {STAGES.map((stage) => {
          let numColor = '#1D1D1F';
          if (stage === 'Pending Review') numColor = '#FF9500';
          if (stage === 'Approved') numColor = '#34C759';
          if (stage === 'Rejected') numColor = '#FF3B30';
          return (
            <div key={stage} style={{ background: '#F5F5F7', borderRadius: 10, padding: 20 }}>
              <span style={{ fontSize: '10px', color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>{stage}</span>
              <span style={{ fontSize: '28px', fontWeight: 300, color: numColor, lineHeight: 1 }}>
                {capas.filter((c) => c.status === stage).length}
              </span>
            </div>
          );
        })}
      </div>

      {/* AI Generator */}
      <AIGeneratorPanel deviations={deviations} onGenerate={handleGenerate} />

      {/* Kanban Board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
        {STAGES.map((stage) => {
          const stageCaps = capas.filter((c) => c.status === stage);
          let badgeBg = '#EEEEEE';
          let badgeColor = '#6E6E73';
          if (stage === 'Pending Review') { badgeBg = 'rgba(255,149,0,0.12)'; badgeColor = '#C07000'; }
          if (stage === 'Approved') { badgeBg = 'rgba(52,199,89,0.12)'; badgeColor = '#1A7A35'; }
          if (stage === 'Rejected') { badgeBg = 'rgba(255,59,48,0.10)'; badgeColor = '#C0291F'; }

          return (
            <div key={stage} style={{ display: 'flex', flexDirection: 'column', minWidth: 260 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6E6E73' }}>{stage}</span>
                <AnimatedBadge count={stageCaps.length} bg={badgeBg} color={badgeColor} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <AnimatePresence mode="popLayout">
                  {stageCaps.length === 0 && (
                    <motion.div 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={{ background: '#ffffff', border: '1px dashed rgba(0,0,0,0.12)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120, fontSize: '13px', color: '#AEAEB2' }}
                    >
                      No CAPAs
                    </motion.div>
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
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Side Panel */}
      {selectedCapa && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)', zIndex: 40 }}
            onClick={() => setSelectedCapa(null)}
          />
          <CapaDetail capa={selectedCapa} onClose={() => setSelectedCapa(null)} />
        </>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </motion.div>
  );
};
