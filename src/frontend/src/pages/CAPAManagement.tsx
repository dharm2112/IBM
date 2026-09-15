import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../api/client';
import type { Capa } from '../api/types';
import { ApprovalActions } from '../components';
import { Sparkles, CheckCircle, Clock, X, ChevronRight, Loader2, FileText } from 'lucide-react';

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

<<<<<<< HEAD
// ── Status config ──────────────────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  approved: { label: 'Approved',      bg: T.greenBg, color: '#137333', icon: <CheckCircle size={10} /> },
  draft:    { label: 'Pending Review', bg: T.amberBg, color: '#B26B00', icon: <Clock size={10} /> },
  rejected: { label: 'Rejected',      bg: T.redBg,   color: '#C5221F', icon: <X size={10} /> },
=======
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
>>>>>>> 495a7266e600bca93a2d0b3cc5eefadb12296214
};
const getStatus = (s: string) => statusConfig[s?.toLowerCase()] ?? statusConfig['draft'];

// ── CAPA Card ─────────────────────────────────────────────────────────────────
const CapaCard: React.FC<{ capa: Capa; onClick: () => void }> = ({ capa, onClick }) => {
  const st = getStatus(capa.status);
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
      onClick={onClick}
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        padding: 20,
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        transition: 'border-color 0.2s',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontFamily: 'SF Mono, monospace', fontSize: '11px', color: T.muted, flexShrink: 0 }}>{capa.capa_id}</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: 10,
          background: st.bg, color: st.color, textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {st.icon}{st.label}
        </span>
      </div>

      {/* AI badge */}
      {capa.ai_generated && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: T.blueBg, borderRadius: 8, width: 'fit-content' }}>
          <Sparkles size={11} color={T.accent} />
          <span style={{ fontSize: '10px', fontWeight: 600, color: T.accent }}>IBM watsonx.ai Generated</span>
        </div>
      )}

      {/* Deviation ref */}
      <div>
        <span style={{ fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Deviation</span>
        <p style={{ fontSize: '13px', fontWeight: 600, color: T.text, margin: '4px 0 0 0', fontFamily: 'SF Mono, monospace' }}>{capa.deviation_id}</p>
      </div>

      {/* Root cause snippet */}
      <div>
        <span style={{ fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Root Cause Hypothesis</span>
        <p style={{
          fontSize: '12px', color: T.sub, margin: '4px 0 0 0', lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{capa.root_cause_hypothesis}</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 }}>
        <span style={{ fontSize: '11px', color: T.accent, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          Review <ChevronRight size={12} />
        </span>
      </div>
    </motion.div>
  );
};

// ── Detail Panel ──────────────────────────────────────────────────────────────
const CapaDetail: React.FC<{
  capa: Capa;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
}> = ({ capa, onApprove, onReject }) => {
  const st = getStatus(capa.status);
  const immediateActions: string[] = typeof capa.immediate_action === 'string'
    ? [capa.immediate_action]
    : (capa.immediate_action as any) || [];
  const preventiveActions: string[] = typeof capa.preventive_action === 'string'
    ? [capa.preventive_action]
    : (capa.preventive_action as any) || [];

  const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <h4 style={{ fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px 0' }}>{label}</h4>
      {children}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Status chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: 12, background: st.bg, color: st.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {st.icon}{st.label}
        </span>
        {capa.ai_generated && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '10px', fontWeight: 600, padding: '4px 10px', borderRadius: 12, background: T.blueBg, color: T.accent }}>
            <Sparkles size={10} /> watsonx.ai
          </span>
        )}
      </div>

      {capa.ai_generated && (
        <div style={{ padding: 16, background: T.blueBg, border: `1px solid rgba(0,122,255,0.2)`, borderRadius: 12, display: 'flex', gap: 12 }}>
          <Sparkles size={16} color={T.accent} style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: '13px', color: T.text, margin: 0, lineHeight: 1.5 }}>
            This CAPA was <strong>auto-drafted by IBM watsonx.ai</strong>. Review all fields carefully before approving for implementation.
          </p>
        </div>
      )}

      <Section label="Root Cause Hypothesis">
        <p style={{ fontSize: '13px', color: T.text, lineHeight: 1.5, margin: 0, padding: 16, background: T.surface2, borderRadius: 12 }}>{capa.root_cause_hypothesis}</p>
      </Section>

      {immediateActions.length > 0 && (
        <Section label="Immediate Actions">
          <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {immediateActions.map((a, i) => (
              <li key={i} style={{ fontSize: '13px', color: T.text, lineHeight: 1.5 }}>{a}</li>
            ))}
          </ul>
        </Section>
      )}

      {preventiveActions.length > 0 && (
        <Section label="Preventive Actions">
          <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {preventiveActions.map((a, i) => (
              <li key={i} style={{ fontSize: '13px', color: T.text, lineHeight: 1.5 }}>{a}</li>
            ))}
          </ul>
        </Section>
      )}

      {capa.verification_method && (
        <Section label="Effectiveness Check">
          <p style={{ fontSize: '13px', color: T.text, lineHeight: 1.5, margin: 0, padding: 16, background: T.surface2, borderRadius: 12 }}>{capa.verification_method}</p>
        </Section>
      )}

      {capa.status?.toLowerCase() === 'draft' && (
        <div style={{ paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
          <p style={{ fontSize: '11px', color: T.muted, margin: '0 0 12px 0' }}>This CAPA requires human approval before implementation.</p>
          <ApprovalActions onApprove={onApprove} onReject={onReject} status="PENDING" />
        </div>
      )}
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────
export const CAPAManagement = () => {
  const navigate = useNavigate();
  const [capas, setCapas] = useState<Capa[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCapa, setSelectedCapa] = useState<Capa | null>(null);
  const [statusFilter, setStatusFilter] = useState('All');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const fetched = await api.getCapas();
      setCapas(fetched);
    } catch (e) {
      console.error('Failed to load CAPAs', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleApprove = async (capa_id: string) => {
    await api.approveCapa(capa_id);
    await fetchData();
    setSelectedCapa(null);
  };

  const handleReject = async (capa_id: string) => {
    await api.rejectCapa(capa_id);
    await fetchData();
    setSelectedCapa(null);
  };

  const filtered = capas.filter(c =>
    statusFilter === 'All' || c.status?.toLowerCase() === statusFilter.toLowerCase()
  );

  const approvedCount = capas.filter(c => c.status?.toLowerCase() === 'approved').length;
  const pendingCount  = capas.filter(c => c.status?.toLowerCase() === 'draft').length;

  if (isLoading && capas.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 14 }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
          <Loader2 size={22} color={T.accent} />
        </motion.div>
        <span style={{ color: T.muted, fontSize: '13px' }}>Loading CAPAs…</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: -40 }}
    >
      {/* Header */}
      <div style={{ paddingBottom: 24, borderBottom: `1px solid ${T.border}` }}>
        <h1 style={{ fontSize: '28px', fontWeight: 600, color: T.text, margin: 0, letterSpacing: '-0.01em' }}>CAPA Management</h1>
        <p style={{ fontSize: '13px', color: T.sub, margin: '8px 0 0 0' }}>
          <strong style={{ color: T.text, fontWeight: 500 }}>{approvedCount} approved</strong> · {pendingCount} pending human review
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          { label: 'Total CAPAs', value: capas.length },
          { label: 'Approved',    value: approvedCount },
          { label: 'Pending',     value: pendingCount  },
        ].map(k => (
          <div key={k.label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 12 }}>{k.label}</span>
            <span style={{ fontSize: '34px', fontWeight: 300, color: T.text, lineHeight: 1, letterSpacing: '-0.02em' }}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* AI Banner */}
      <div style={{ padding: 16, background: T.blueBg, border: `1px solid rgba(0,122,255,0.2)`, borderRadius: 12, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Sparkles size={16} color={T.accent} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ fontSize: '13px', fontWeight: 600, color: T.text, margin: '0 0 4px 0' }}>AI-Assisted CAPA Drafting</p>
          <p style={{ fontSize: '12px', color: T.sub, margin: 0, lineHeight: 1.5 }}>Generate CAPA drafts from the Deviation Center. IBM watsonx.ai drafts root causes and corrective actions — human review is always required before activation.</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '13px', color: T.sub, fontWeight: 500 }}>Filter:</span>
        <div style={{ display: 'flex', alignItems: 'center', background: T.surface2, borderRadius: 8, padding: 2 }}>
          {['All', 'draft', 'approved', 'rejected'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                height: 32, padding: '0 12px', fontSize: '11px', fontWeight: 600, border: 'none', borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s', textTransform: 'capitalize',
                background: statusFilter === s ? T.surface : 'transparent',
                color: statusFilter === s ? T.text : T.sub,
                boxShadow: statusFilter === s ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              {s === 'draft' ? 'Pending' : s}
            </button>
          ))}
        </div>

        <button
          onClick={() => navigate('/dashboard/deviations')}
          style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 16px', height: 36, background: T.accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
        >
          <Sparkles size={14} /> Generate New CAPA
        </button>
      </div>

      {/* CAPA Grid */}
      {filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 12 }}>
          <FileText size={32} color={T.muted} />
          <p style={{ fontSize: '13px', color: T.muted, margin: 0 }}>
            {capas.length === 0
              ? 'No CAPAs yet. Generate one from the Deviation Center.'
              : 'No CAPAs match this filter.'}
          </p>
          {capas.length === 0 && (
            <button
              onClick={() => navigate('/dashboard/deviations')}
              style={{ marginTop: 8, padding: '0 16px', height: 36, background: T.accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
            >
              Go to Deviations
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.map(capa => (
            <CapaCard key={capa.capa_id} capa={capa} onClick={() => setSelectedCapa(capa)} />
          ))}
        </div>
      )}

      {/* Detail Drawer */}
      <AnimatePresence>
        {selectedCapa && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCapa(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)', zIndex: 40 }}
            />
            <motion.aside
              key="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
              style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 560,
                background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(30px)',
                borderLeft: `1px solid ${T.border}`, zIndex: 50,
                display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 30px rgba(0,0,0,0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
                <div>
                  <span style={{ fontFamily: 'SF Mono, monospace', fontSize: '11px', color: T.muted, display: 'block', marginBottom: 4 }}>{selectedCapa.capa_id}</span>
                  <h2 style={{ fontSize: '18px', fontWeight: 600, color: T.text, margin: 0, letterSpacing: '-0.01em' }}>
                    CAPA for {selectedCapa.deviation_id}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedCapa(null)}
                  style={{ padding: 8, borderRadius: '50%', border: 'none', background: T.surface2, color: T.sub, cursor: 'pointer', display: 'flex' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                <CapaDetail
                  capa={selectedCapa}
                  onApprove={() => handleApprove(selectedCapa.capa_id)}
                  onReject={() => handleReject(selectedCapa.capa_id)}
                />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
