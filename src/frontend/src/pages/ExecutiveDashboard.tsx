import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'motion/react';
import { api } from '../api/client';
import type { Site, Deviation } from '../api/types';
import { EvidencePanel } from '../components';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import {
  RefreshCw, Calculator, ArrowRight, AlertTriangle,
  Building2, Users, Activity, X, ChevronRight, TrendingUp,
} from 'lucide-react';

// ── Light design tokens ───────────────────────────────────────────────────────
const T = {
  bg:          '#f8f9fb',
  surface:     '#ffffff',
  surface2:    '#f3f4f6',
  border:      '#e5e7eb',
  borderLight: '#f3f4f6',
  text:        '#111827',
  sub:         '#6b7280',
  muted:       '#9ca3af',
  dim:         '#d1d5db',
  indigo:      '#6366f1',
  indigoSub:   'rgba(99,102,241,0.08)',
  indigoBorder:'rgba(99,102,241,0.18)',
  green:       '#10b981',
  amber:       '#f59e0b',
  red:         '#ef4444',
};

const ease = [0.22, 1, 0.36, 1];

// ── Animated counter ──────────────────────────────────────────────────────────
const Counter = ({ to, duration = 1.2 }: { to: number; duration?: number }) => {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView) return;
    let cur = 0;
    const step = to / (duration * 60);
    const id = setInterval(() => {
      cur += step;
      if (cur >= to) { setVal(to); clearInterval(id); }
      else setVal(Math.floor(cur));
    }, 1000 / 60);
    return () => clearInterval(id);
  }, [inView, to, duration]);
  return <span ref={ref}>{val}</span>;
};

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard = ({
  icon, iconBg, iconColor, title, value, sub, accentBorder, delay = 0,
}: {
  icon: React.ReactNode; iconBg: string; iconColor: string;
  title: string; value: number; sub: string;
  accentBorder?: string; delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay, ease }}
    whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
    style={{
      background: T.surface,
      border: `1px solid ${accentBorder ?? T.border}`,
      borderRadius: 14,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: T.sub, letterSpacing: '0.01em' }}>{title}</span>
      <div style={{ padding: 8, borderRadius: 9, background: iconBg, color: iconColor }}>{icon}</div>
    </div>
    <div>
      <div style={{ fontSize: '1.9rem', fontWeight: 800, color: T.text, lineHeight: 1, letterSpacing: '-0.03em' }}>
        <Counter to={value} />
      </div>
      <div style={{ fontSize: '0.72rem', color: T.muted, marginTop: 4 }}>{sub}</div>
    </div>
  </motion.div>
);

// ── Card wrapper ──────────────────────────────────────────────────────────────
const Card = ({ children, style = {}, delay = 0 }: { children: React.ReactNode; style?: React.CSSProperties; delay?: number }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 18 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease }}
      style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, ...style }}
    >
      {children}
    </motion.div>
  );
};

// ── Colors by severity / risk ─────────────────────────────────────────────────
const sevColor: Record<string, string> = {
  CRITICAL: T.red, MAJOR: T.amber, MINOR: T.indigo,
};
const riskColor: Record<string, string> = {
  HIGH: T.red, MEDIUM: T.amber, LOW: T.green,
};

// ── Custom chart tooltip ──────────────────────────────────────────────────────
const LightTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '8px 14px', fontSize: '0.78rem', color: T.text, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
      <div style={{ color: T.muted, marginBottom: 3 }}>{label}</div>
      <div style={{ fontWeight: 700, color: T.indigo }}>{payload[0].value} deviations</div>
    </div>
  );
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const ExecutiveDashboard = () => {
  const navigate = useNavigate();
  const [sites, setSites] = useState<Site[]>([]);
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [selectedDeviation, setSelectedDeviation] = useState<Deviation | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [s, d] = await Promise.all([api.getSites(), api.getDeviations()]);
      setSites(s); setDeviations(d);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try { await api.recalculateRisk(); await fetchData(); }
    finally { setIsRecalculating(false); }
  };

  const highRisk  = sites.filter(s => s.risk_level === 'HIGH').length;
  const majorDevs = deviations.filter(d => d.severity === 'MAJOR' || d.severity === 'CRITICAL').length;
  const topSites  = [...sites].sort((a, b) => b.risk_score - a.risk_score).slice(0, 5);

  const riskDist = [
    { name: 'LOW',    value: sites.filter(s => s.risk_level === 'LOW').length,    color: T.green },
    { name: 'MEDIUM', value: sites.filter(s => s.risk_level === 'MEDIUM').length, color: T.amber },
    { name: 'HIGH',   value: sites.filter(s => s.risk_level === 'HIGH').length,   color: T.red   },
  ];

  const trendData = [
    { name: 'Wk 1', deviations: 12 },
    { name: 'Wk 2', deviations: 18 },
    { name: 'Wk 3', deviations: 15 },
    { name: 'Wk 4', deviations: deviations.length || 21 },
  ];

  if (isLoading && sites.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 14 }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
          <RefreshCw size={22} color={T.indigo} />
        </motion.div>
        <span style={{ color: T.muted, fontSize: '0.88rem' }}>Loading dashboard…</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
        style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.025em', color: T.text, margin: 0 }}>
            Executive Dashboard
          </h1>
          <p style={{ fontSize: '0.8rem', color: T.muted, margin: '5px 0 0' }}>
            Clinical trial monitoring overview · CT-801-ONC
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.7rem', color: T.muted }}>Updated 2 min ago</span>
          <motion.button
            onClick={fetchData} disabled={isLoading}
            whileHover={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
            whileTap={{ scale: 0.97 }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 15px', borderRadius: 9, border: `1px solid ${T.border}`, background: T.surface, color: T.sub, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
          >
            <RefreshCw size={13} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </motion.button>
          <motion.button
            onClick={handleRecalculate} disabled={isRecalculating}
            whileHover={{ boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}
            whileTap={{ scale: 0.97 }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
          >
            <Calculator size={13} style={{ animation: isRecalculating ? 'spin 1s linear infinite' : 'none' }} />
            Recalculate Risk
          </motion.button>
        </div>
      </motion.div>

      {/* ── Alert banner ── */}
      <AnimatePresence>
        {highRisk > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease }}
            style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}
          >
            <div style={{ padding: '5px 10px', background: '#fee2e2', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 5, color: T.red, fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>
              <AlertTriangle size={13} /> ATTENTION
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#374151' }}>
              <strong style={{ color: T.text }}>{highRisk} site{highRisk > 1 ? 's' : ''}</strong> require{highRisk === 1 ? 's' : ''} investigation due to elevated risk scores.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <KpiCard icon={<Building2 size={15} />}    iconBg="rgba(99,102,241,0.08)"  iconColor={T.indigo} title="Total Sites"           value={sites.length}       sub="Across the trial"               delay={0}    />
        <KpiCard icon={<Users size={15} />}         iconBg="rgba(16,185,129,0.08)" iconColor={T.green}  title="Active Patients"      value={100}                sub="Currently enrolled"             delay={0.07} />
        <KpiCard icon={<Activity size={15} />}      iconBg="rgba(245,158,11,0.08)" iconColor={T.amber}  title="Protocol Deviations"  value={deviations.length} sub={`${majorDevs} major / critical`}  delay={0.14} />
        <KpiCard icon={<AlertTriangle size={15} />} iconBg="rgba(239,68,68,0.08)"  iconColor={T.red}    title="High-Risk Sites"      value={highRisk}           sub="Requires immediate action"      delay={0.21} accentBorder="#fecaca" />
      </div>

      {/* ── Charts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>

        {/* Donut */}
        <Card style={{ padding: 22 }} delay={0.05}>
          <div style={{ fontSize: '0.83rem', fontWeight: 700, color: T.text, marginBottom: 18 }}>Risk Distribution</div>
          <div style={{ position: 'relative', height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskDist} innerRadius={54} outerRadius={74} dataKey="value" stroke="none" startAngle={90} endAngle={-270}>
                  {riskDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9, fontSize: '0.75rem', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <span style={{ fontSize: '1.7rem', fontWeight: 800, color: T.text, lineHeight: 1 }}>{sites.length}</span>
              <span style={{ fontSize: '0.67rem', color: T.muted, marginTop: 2 }}>Sites</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 10 }}>
            {riskDist.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: d.color }} />
                <span style={{ fontSize: '0.68rem', color: T.sub, fontWeight: 600 }}>{d.name}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Line chart */}
        <Card style={{ padding: 22 }} delay={0.1}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ fontSize: '0.83rem', fontWeight: 700, color: T.text }}>Deviation Trend</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem' }}>
              <TrendingUp size={12} color={T.indigo} />
              <span style={{ color: T.indigo, fontWeight: 600 }}>+24% this week</span>
            </div>
          </div>
          <div style={{ height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 4, right: 8, left: -26, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} />
                <Tooltip content={<LightTooltip />} />
                <defs>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
                <Line
                  type="monotone" dataKey="deviations"
                  stroke="url(#lineGrad)" strokeWidth={2.5}
                  dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, fill: '#6366f1', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

      </div>

      {/* ── Top Risk Sites ── */}
      <Card style={{ padding: '18px 22px' }} delay={0.15}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: '0.83rem', fontWeight: 700, color: T.text }}>Top Risk Sites</div>
          <motion.button
            whileHover={{ color: T.indigo }}
            onClick={() => navigate('/dashboard/sites')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', color: T.muted, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            View all <ChevronRight size={12} />
          </motion.button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {topSites.map((site, i) => (
            <motion.div
              key={site.site_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06, ease }}
              onClick={() => navigate(`/dashboard/sites/${site.site_id}`)}
              whileHover={{ background: T.surface2, x: 2 }}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '9px 10px', borderRadius: 10, cursor: 'pointer' }}
            >
              <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: T.muted, width: 64, flexShrink: 0 }}>{site.site_id}</span>
              <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 500, color: T.text }}>{site.site_name}</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: riskColor[site.risk_level], width: 28, textAlign: 'right', flexShrink: 0 }}>{site.risk_score}</span>
              <div style={{ width: 90, height: 4, background: T.surface2, borderRadius: 99, overflow: 'hidden', flexShrink: 0 }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${site.risk_score}%` }}
                  transition={{ duration: 0.7, delay: i * 0.06 + 0.2, ease }}
                  style={{ height: '100%', background: riskColor[site.risk_level], borderRadius: 99 }}
                />
              </div>
              <span style={{ fontSize: '0.62rem', fontWeight: 700, color: riskColor[site.risk_level], background: `${riskColor[site.risk_level]}15`, padding: '2px 8px', borderRadius: 99, width: 52, textAlign: 'center', flexShrink: 0 }}>
                {site.risk_level}
              </span>
              <ArrowRight size={13} color={T.dim} />
            </motion.div>
          ))}
        </div>
      </Card>

      {/* ── Recent Deviations ── */}
      <Card delay={0.2}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.83rem', fontWeight: 700, color: T.text }}>Recent Protocol Deviations</div>
          <motion.button
            whileHover={{ color: T.indigo }}
            onClick={() => navigate('/dashboard/deviations')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', color: T.muted, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            View all <ChevronRight size={12} />
          </motion.button>
        </div>

        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '150px 86px 96px 1fr 78px 88px', padding: '9px 22px', borderBottom: `1px solid ${T.borderLight}` }}>
          {['Deviation ID', 'Site', 'Patient', 'Category', 'Severity', 'Status'].map(h => (
            <span key={h} style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: T.muted }}>{h}</span>
          ))}
        </div>

        {deviations.slice(0, 6).map((dev, i) => (
          <motion.div
            key={dev.deviation_id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05, ease }}
            onClick={() => setSelectedDeviation(dev)}
            whileHover={{ background: T.surface2 }}
            style={{
              display: 'grid',
              gridTemplateColumns: '150px 86px 96px 1fr 78px 88px',
              padding: '12px 22px',
              borderBottom: i < 5 ? `1px solid ${T.borderLight}` : 'none',
              cursor: 'pointer',
              alignItems: 'center',
            }}
          >
            <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: T.indigo, fontWeight: 600 }}>{dev.deviation_id}</span>
            <span style={{ fontSize: '0.78rem', color: T.sub }}>{dev.site_id}</span>
            <span style={{ fontSize: '0.78rem', color: T.sub }}>{dev.patient_id}</span>
            <span style={{ fontSize: '0.78rem', color: T.text, paddingRight: 10 }}>{dev.category}</span>
            <span style={{ fontSize: '0.67rem', fontWeight: 700, color: sevColor[dev.severity] ?? T.muted, background: `${sevColor[dev.severity] ?? T.muted}15`, padding: '2px 8px', borderRadius: 99, display: 'inline-block' }}>
              {dev.severity}
            </span>
            <span style={{ fontSize: '0.67rem', fontWeight: 600, color: T.sub, background: T.surface2, padding: '2px 8px', borderRadius: 99, display: 'inline-block' }}>
              {dev.status}
            </span>
          </motion.div>
        ))}
      </Card>

      {/* ── Detail Drawer ── */}
      <AnimatePresence>
        {selectedDeviation && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDeviation(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(3px)', zIndex: 40 }}
            />
            <motion.aside
              key="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, width: 460,
                background: T.surface, borderLeft: `1px solid ${T.border}`,
                zIndex: 50, display: 'flex', flexDirection: 'column',
                boxShadow: '-16px 0 48px rgba(0,0,0,0.12)',
              }}
            >
              {/* Header */}
              <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: T.indigo, fontWeight: 700 }}>{selectedDeviation.deviation_id}</span>
                  <span style={{ fontSize: '0.67rem', fontWeight: 700, color: sevColor[selectedDeviation.severity], background: `${sevColor[selectedDeviation.severity]}15`, padding: '3px 10px', borderRadius: 99 }}>
                    {selectedDeviation.severity}
                  </span>
                </div>
                <motion.button
                  onClick={() => setSelectedDeviation(null)}
                  whileHover={{ background: T.surface2, scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', color: T.muted, cursor: 'pointer', display: 'flex' }}
                >
                  <X size={17} />
                </motion.button>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 22 }}>
                <div>
                  <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.muted, marginBottom: 7 }}>Overview</div>
                  <p style={{ fontSize: '0.85rem', lineHeight: 1.65, color: T.sub, margin: 0 }}>{selectedDeviation.description}</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'Site',     value: selectedDeviation.site_id },
                    { label: 'Patient',  value: selectedDeviation.patient_id },
                    { label: 'Rule',     value: selectedDeviation.rule_id, mono: true },
                    { label: 'Category', value: selectedDeviation.category },
                  ].map(m => (
                    <div key={m.label} style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 10, padding: '11px 13px' }}>
                      <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.muted, marginBottom: 4 }}>{m.label}</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: T.text, fontFamily: m.mono ? 'monospace' : 'inherit' }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.muted, marginBottom: 9 }}>Evidence</div>
                  <EvidencePanel expected={selectedDeviation.expected} actual={selectedDeviation.actual} severity={selectedDeviation.severity} />
                </div>

                <motion.button
                  whileHover={{ boxShadow: '0 6px 20px rgba(99,102,241,0.35)', scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setSelectedDeviation(null); navigate('/dashboard/capa'); }}
                  style={{ width: '100%', padding: '12px 0', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: '#fff', fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Generate CAPA →
                </motion.button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
