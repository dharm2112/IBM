import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { api } from '../api/client';
import type { ProtocolRule } from '../api/types';
import { SeverityBadge, AIBanner, ApprovalActions, DetailDrawer, Folder } from '../components';
import { Upload, Search, CheckCircle, Clock, Loader2, Sparkles, X, Plus } from 'lucide-react';

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

// ─── Rule Card ────────────────────────────────────────────────────────────────
const RuleCard: React.FC<{ rule: ProtocolRule; onClick: () => void }> = ({ rule, onClick }) => {
  const statusStyles: Record<string, any> = {
    APPROVED: { bg: T.greenBg, color: '#137333' },
    PENDING:  { bg: T.amberBg, color: '#B26B00' },
    REJECTED: { bg: T.redBg, color: '#C5221F' },
  };

  return (
    <div
      onClick={onClick}
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: 20,
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        transition: 'border-color 0.2s',
      }}
      onMouseOver={(e) => e.currentTarget.style.borderColor = T.muted}
      onMouseOut={(e) => e.currentTarget.style.borderColor = T.border}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontFamily: 'SF Mono, monospace', fontSize: '11px', color: T.muted }}>{rule.rule_id}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SeverityBadge level={rule.severity || 'MINOR'} />
          <span style={{ 
            display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: 10,
            background: statusStyles[rule.approval_status]?.bg || T.surface2,
            color: statusStyles[rule.approval_status]?.color || T.sub,
            textTransform: 'uppercase', letterSpacing: '0.04em'
          }}>
            {rule.approval_status === 'APPROVED' ? (
              <><CheckCircle size={10} /> APPROVED</>
            ) : rule.approval_status === 'PENDING' ? (
              <><Clock size={10} /> PENDING</>
            ) : 'REJECTED'}
          </span>
        </div>
      </div>

      <h3 style={{ fontSize: '13px', fontWeight: 600, color: T.text, margin: '0 0 4px 0', lineHeight: 1.4 }}>{rule.name}</h3>
      <p style={{ fontSize: '11px', color: T.sub, margin: '0 0 16px 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{rule.description}</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', background: T.surface2, color: T.sub, borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{rule.category}</span>
        <span style={{ fontSize: '11px', color: T.muted }}>{rule.protocol_reference}</span>
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
    try {
      setIsUploading(true);
      setLastUploaded(null);
      await onUpload(file);
      setLastUploaded(file.name);
    } catch (err: any) {
      alert(`Extraction Failed:\n\n${err.message || 'An unknown error occurred.'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div style={{ background: T.surface, border: `1px solid rgba(0,122,255,0.3)`, borderRadius: 16, overflow: 'hidden', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', background: T.blueBg, borderBottom: `1px solid rgba(0,122,255,0.1)` }}>
        <Sparkles size={16} color={T.accent} />
        <h3 style={{ fontSize: '13px', fontWeight: 600, color: T.text, margin: 0 }}>Upload Protocol Document</h3>
        <span style={{ fontSize: '11px', color: T.sub }}>— IBM watsonx.ai will auto-extract rules</span>
      </div>

      <motion.div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        animate={isDragging ? { 
          scale: 1.02, 
          boxShadow: ['0 0 0 rgba(0,122,255,0.4)', '0 0 20px rgba(0,122,255,0.8)', '0 0 0 rgba(0,122,255,0.4)']
        } : { scale: 1, boxShadow: '0 0 0 rgba(0,122,255,0)' }}
        transition={isDragging ? { duration: 1.2, ease: 'easeInOut', repeat: Infinity } : { duration: 0.2 }}
        style={{ 
          margin: 20, padding: 32, textAlign: 'center', border: `2px dashed ${isDragging ? T.accent : T.border}`, borderRadius: 12, background: isDragging ? T.blueBg : T.surface, transition: 'background 0.2s, border 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}
      >
        {isUploading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 0' }}>
            <Loader2 size={24} color={T.accent} style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: '13px', fontWeight: 500, color: T.text, margin: 0, animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>watsonx.ai is extracting protocol rules...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ marginBottom: 12, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Folder size="sm" color="black" open={isDragging} />
            </div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: T.text, margin: '0 0 4px 0' }}>Drop your protocol PDF here</p>
            <p style={{ fontSize: '11px', color: T.sub, margin: '0 0 16px 0' }}>or click to browse</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 16px', height: 36, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: '13px', fontWeight: 500, cursor: isUploading ? 'not-allowed' : 'pointer', color: isUploading ? T.muted : T.text }}>
                {isUploading ? <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${T.muted}`, borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
                {isUploading ? 'Extracting...' : 'Upload Protocol PDF'}
                <input type="file" accept=".pdf,.txt" style={{ display: 'none' }} onChange={e => {
                  if (e.target.files?.[0]) handleFile(e.target.files[0]);
                }} disabled={isUploading} />
              </label>
              <button style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 16px', height: 36, background: T.accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                <Plus size={14} /> Add Rule Manually
              </button>
            </div>
            {lastUploaded && (
              <p style={{ marginTop: 16, fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: T.greenBg, padding: '6px 12px', borderRadius: 8, border: `1px solid rgba(52,199,89,0.2)`, color: '#137333', margin: '16px 0 0 0' }}>
                <CheckCircle size={12} /> Rule extracted from <strong style={{ fontWeight: 600, margin: '0 4px' }}>{lastUploaded}</strong> — review below
              </p>
            )}
          </div>
        )}
      </motion.div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
      `}</style>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <SeverityBadge level={rule.severity || 'MINOR'} />
        <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', background: T.surface2, color: T.sub, borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{rule.category}</span>
        <span style={{ fontSize: '11px', color: T.muted }}>{rule.protocol_reference}</span>
      </div>

      {isAiExtracted && (
        <div style={{ padding: 16, background: T.blueBg, border: `1px solid rgba(0,122,255,0.2)`, borderRadius: 12, display: 'flex', gap: 12 }}>
          <Sparkles size={16} color={T.accent} style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: '13px', color: T.text, margin: 0, lineHeight: 1.5 }}>
            This rule was <strong>auto-extracted by IBM watsonx.ai</strong> from your uploaded protocol document. Review the condition and threshold below before approving for use in deviation detection.
          </p>
        </div>
      )}

      <div>
        <h3 style={{ fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px 0' }}>Description</h3>
        <p style={{ fontSize: '13px', color: T.text, lineHeight: 1.5, margin: 0, padding: 16, background: T.surface2, borderRadius: 12 }}>{rule.description}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ padding: 16, background: T.surface2, borderRadius: 12 }}>
          <span style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Condition</span>
          <code style={{ fontSize: '11px', fontFamily: 'SF Mono, monospace', color: T.text, wordBreak: 'break-all' }}>{rule.condition}</code>
        </div>
        <div style={{ padding: 16, background: T.surface2, borderRadius: 12 }}>
          <span style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Threshold</span>
          <code style={{ fontSize: '11px', fontFamily: 'SF Mono, monospace', color: T.text }}>{rule.threshold}</code>
        </div>
      </div>

      <div style={{ padding: 16, background: T.surface2, borderRadius: 12 }}>
        <span style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Protocol Reference</span>
        <p style={{ fontSize: '13px', fontWeight: 500, color: T.text, margin: 0 }}>{rule.protocol_reference}</p>
      </div>

      {rule.approval_status === 'PENDING' && (
        <div style={{ paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
          <p style={{ fontSize: '11px', color: T.muted, margin: '0 0 12px 0' }}>This rule is pending review. Approve to activate it in the deviation detection engine.</p>
          <ApprovalActions
            onApprove={onApprove}
            onReject={onReject}
            status={rule.approval_status}
          />
        </div>
      )}

      {rule.approval_status === 'APPROVED' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, background: T.greenBg, border: `1px solid rgba(52,199,89,0.2)`, borderRadius: 12 }}>
          <CheckCircle size={16} color="#137333" />
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#137333' }}>This rule is active in the deviation detection engine.</span>
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
    await api.approveProtocolRule(ruleId);
    await fetchData();
    setSelectedRule(null);
  };

  const handleReject = async (ruleId: string) => {
    await api.rejectProtocolRule(ruleId);
    await fetchData();
    setSelectedRule(null);
  };

  const categories = ['All', ...Array.from(new Set(rules.map((r) => r.category)))];

  const filtered = rules.filter((r) => {
    const matchesSearch = (r.name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (r.rule_id || '').toLowerCase().includes(search.toLowerCase()) ||
                          (r.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === 'All' || r.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || r.approval_status === statusFilter;
    return matchesSearch && matchesCat && matchesStatus;
  });

  const approvedCount = rules.filter((r) => r.approval_status === 'APPROVED').length;
  const pendingCount  = rules.filter((r) => r.approval_status === 'PENDING').length;

  if (isLoading && rules.length === 0) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 250, color: T.sub, fontSize: '13px' }}>Loading protocol rules...</div>;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: -40 }}
    >
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24, borderBottom: `1px solid ${T.border}` }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: T.text, margin: 0, letterSpacing: '-0.01em' }}>Protocol Rules</h1>
          <p style={{ fontSize: '13px', color: T.sub, margin: '8px 0 0 0' }}>
            <strong style={{ color: T.text, fontWeight: 500 }}>{approvedCount} active</strong> rules · {pendingCount} pending review
          </p>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {[
          { label: 'Total Rules', value: rules.length },
          { label: 'Active',      value: approvedCount },
          { label: 'Pending',     value: pendingCount  },
        ].map((k) => (
          <div key={k.label} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 12 }}>{k.label}</span>
            <span style={{ fontSize: '34px', fontWeight: 300, color: T.text, lineHeight: 1, letterSpacing: '-0.02em' }}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* Upload Panel */}
      <UploadPanel onUpload={handleUpload} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 400 }}>
          <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.muted }} size={16} />
          <input
            type="text"
            placeholder="Search rules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', height: 36, padding: '0 16px 0 36px', fontSize: '13px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ height: 36, padding: '0 32px 0 12px', fontSize: '13px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, outline: 'none', appearance: 'auto' }}
          >
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>

          <div style={{ display: 'flex', alignItems: 'center', background: T.surface2, borderRadius: 8, padding: 2 }}>
            {['All', 'APPROVED', 'PENDING'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  height: 32, padding: '0 12px', fontSize: '11px', fontWeight: 600, border: 'none', borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '0.04em',
                  background: statusFilter === s ? T.surface : 'transparent',
                  color: statusFilter === s ? T.text : T.sub,
                  boxShadow: statusFilter === s ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                {s === 'All' ? 'All' : s === 'APPROVED' ? 'Active' : 'Pending'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Rules Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {filtered.map((rule) => (
          <RuleCard key={rule.rule_id} rule={rule} onClick={() => setSelectedRule(rule)} />
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: 64, textAlign: 'center', fontSize: '13px', color: T.muted }}>No rules match your filters.</div>
        )}
      </div>

      {/* Detail Drawer Side Panel */}
      {selectedRule && (
        <>
          <div 
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)', zIndex: 40 }}
            onClick={() => setSelectedRule(null)} 
          />
          <motion.div 
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 560, background: T.surface, boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', zIndex: 50, display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${T.border}` }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${T.border}`, background: T.surface }}>
              <div>
                <span style={{ fontFamily: 'SF Mono, monospace', fontSize: '11px', color: T.muted, display: 'block', marginBottom: 4 }}>{selectedRule.rule_id}</span>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: T.text, margin: 0, letterSpacing: '-0.01em' }}>{selectedRule.name}</h2>
              </div>
              <button onClick={() => setSelectedRule(null)} style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer', color: T.sub, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              <RuleDetail
                rule={selectedRule}
                onApprove={() => handleApprove(selectedRule.rule_id)}
                onReject={() => handleReject(selectedRule.rule_id)}
              />
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
};
