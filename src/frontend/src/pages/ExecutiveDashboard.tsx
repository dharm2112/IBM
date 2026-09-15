import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useInView, animate } from 'motion/react';
import { api } from '../api/client';
import type { Site, Deviation } from '../api/types';
import { EvidencePanel, AnimatedList } from '../components';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  LineChart, Line, XAxis, Tooltip, ReferenceLine
} from 'recharts';
import {
  RefreshCw, Calculator, ArrowRight, AlertTriangle,
  Building2, Users, Activity, X, ChevronRight, TrendingUp,
} from 'lucide-react';

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
};

const ease = [0.22, 1, 0.36, 1] as any;

// ── Animated counter ──────────────────────────────────────────────────────────
const Counter = ({ to, duration = 0.6 }: { to: number; duration?: number }) => {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, {
      duration,
      ease: [0.0, 0.0, 0.2, 1.0], // --ease-decelerate
      onUpdate(value) {
        setVal(Math.floor(value));
      }
    });
    return () => controls.stop();
  }, [inView, to, duration]);
  return <span ref={ref}>{val}</span>;
};

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard = ({
  icon, iconColor, title, value, sub, accentBorder, delay = 0,
}: {
  icon: React.ReactNode; iconColor: string;
  title: string; value: number; sub: string;
  accentBorder?: string; delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.35, delay, ease: [0.175, 0.885, 0.32, 1.275] }} // --ease-overshoot
    whileHover={{ y: -2, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
    style={{
      background: T.surface,
      border: `1px solid ${accentBorder ?? T.border}`,
      borderRadius: 16,
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      transition: 'box-shadow 150ms cubic-bezier(0.34, 1.56, 0.64, 1.0)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: '11px', fontWeight: 600, color: T.sub, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</span>
      <div style={{ color: iconColor }}>{icon}</div>
    </div>
    <div>
      <div style={{ fontSize: '34px', fontWeight: 300, color: T.text, lineHeight: 1, letterSpacing: '-0.02em' }}>
        <Counter to={value} />
      </div>
      <div style={{ fontSize: '12px', color: T.sub, marginTop: 6 }}>{sub}</div>
    </div>
  </motion.div>
);

// ── Card wrapper ──────────────────────────────────────────────────────────────
const Card = ({ children, style = {}, delay = 0 }: { children: React.ReactNode; style?: React.CSSProperties; delay?: number }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-20px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 15 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay, ease }}
      style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', ...style }}
    >
      {children}
    </motion.div>
  );
};

// ── Colors by severity / risk ─────────────────────────────────────────────────
const sevColor: Record<string, string> = {
  CRITICAL: T.red, MAJOR: T.amber, MINOR: T.accent,
};
const riskColor: Record<string, string> = {
  HIGH: T.red, MEDIUM: T.amber, LOW: T.green,
};

// ── Custom chart tooltip ──────────────────────────────────────────────────────
const LightTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(10px)', border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 12px', fontSize: '12px', color: T.text, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ color: T.sub, marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600, color: T.accent }}>{payload[0].value} deviations</div>
    </div>
  );
};

// ── Recalculate Risk Button ───────────────────────────────────────────────────
const RecalculateRiskButton = ({ isRecalculating, onClick }: { isRecalculating: boolean; onClick: () => Promise<void> }) => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleClick = async () => {
    if (status !== 'idle') return;
    setStatus('loading');
    await onClick();
    setStatus('success');
    setTimeout(() => setStatus('idle'), 400); // 400ms flash
  };

  return (
    <motion.button
      onClick={handleClick}
      disabled={status !== 'idle'}
      whileTap={{ scale: 0.96, transition: { duration: 0.08 } }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '0 16px', height: 36, minWidth: 140, borderRadius: 10, border: 'none',
        background: status === 'success' ? T.green : T.accent,
        color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
        transition: 'background-color 400ms ease',
      }}
    >
      <motion.div
        animate={status === 'loading' ? { rotate: 360 } : { rotate: 0 }}
        transition={status === 'loading' ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : { duration: 0 }}
        style={{ display: 'flex' }}
      >
        <Calculator size={14} />
      </motion.div>
      <AnimatePresence mode="popLayout">
        {status !== 'loading' && (
          <motion.span
            key="label"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 4 }}
            transition={{ duration: 0.2 }}
          >
            {status === 'success' ? 'Updated' : 'Recalculate Risk'}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const ExecutiveDashboard = () => {
  const navigate = useNavigate();
  const [sites, setSites] = useState<Site[]>([]);
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [patientCount, setPatientCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [selectedDeviation, setSelectedDeviation] = useState<Deviation | null>(null);
  const [protocolOptions, setProtocolOptions] = useState<{id: string, name: string}[]>([{id: '', name: 'Default Demo Protocol'}]);
  const [selectedProtocol, setSelectedProtocol] = useState<string>('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [s, d, p, rules] = await Promise.all([api.getSites(), api.getDeviations(), api.getPatients(), api.getProtocolRules()]);
      setSites(s); setDeviations(d); setPatientCount(p.length);
      
      const uniqueProtocols = Array.from(new Set(rules.map((r: any) => r.protocol_id).filter(Boolean)));
      if (uniqueProtocols.length > 0) {
        setProtocolOptions([
          {id: '', name: 'Default Demo Protocol'},
          ...uniqueProtocols.map(pid => ({id: pid as string, name: `Uploaded Protocol: ${pid}`}))
        ]);
        if (!selectedProtocol && uniqueProtocols.length > 0) {
            setSelectedProtocol(uniqueProtocols[0] as string);
        }
      }
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try { await api.recalculateRisk(selectedProtocol || undefined); await fetchData(); }
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
    { name: 'Wk 1', deviations: Math.max(1, Math.floor(deviations.length * 0.4)) },
    { name: 'Wk 2', deviations: Math.max(1, Math.floor(deviations.length * 0.6)) },
    { name: 'Wk 3', deviations: Math.max(1, Math.floor(deviations.length * 0.8)) },
    { name: 'Wk 4', deviations: deviations.length || 0 },
  ];

  if (isLoading && sites.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 14 }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
          <RefreshCw size={22} color={T.accent} />
        </motion.div>
        <span style={{ color: T.muted, fontSize: '13px' }}>Loading dashboard…</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease }}
        style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 14, marginTop: -40 }} // Pull up since layout has h1
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '12px', color: T.muted }}>Updated 2 min ago</span>
          <button
            onClick={fetchData} disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: 36, borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
          >
            <RefreshCw size={14} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
          
          <select 
            value={selectedProtocol} 
            onChange={e => setSelectedProtocol(e.target.value)}
            style={{ padding: '0 12px', height: 36, borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface, color: T.text, fontSize: '13px', outline: 'none' }}
          >
            {protocolOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <RecalculateRiskButton 
            isRecalculating={isRecalculating} 
            onClick={handleRecalculate} 
          />
        </div>
      </motion.div>

      {/* ── Alert banner ── */}
      <AnimatePresence>
        {selectedProtocol && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease }}
            style={{ background: '#E6F4FF', border: '1px solid rgba(24,144,255,0.2)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1890FF', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>
              <AlertTriangle size={16} strokeWidth={2} /> INFO
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: T.text }}>
              Prototype execution uses the validated default deterministic rule set for AI-extracted rules.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── High Risk banner ── */}
      <AnimatePresence>
        {highRisk > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease }}
            style={{ background: '#FFF2F2', border: '1px solid rgba(255,59,48,0.2)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.red, fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>
              <AlertTriangle size={16} strokeWidth={2} /> ATTENTION
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: T.text }}>
              <strong>{highRisk} site{highRisk > 1 ? 's' : ''}</strong> require{highRisk === 1 ? 's' : ''} investigation due to elevated risk scores.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
        <KpiCard icon={<Building2 size={18} />}    iconColor={T.accent} title="Total Sites"           value={sites.length}       sub="Across the trial"               delay={0}    />
        <KpiCard icon={<Users size={18} />}        iconColor={T.green}  title="Active Patients"      value={patientCount}       sub="Currently enrolled"             delay={0.05} />
        <KpiCard icon={<Activity size={18} />}     iconColor={T.amber}  title="Protocol Deviations"  value={deviations.length}  sub={`${majorDevs} major / critical`}  delay={0.1} />
        <KpiCard icon={<AlertTriangle size={18} />} iconColor={T.red}   title="High-Risk Sites"      value={highRisk}           sub="Requires immediate action"      delay={0.15} accentBorder="rgba(255,59,48,0.3)" />
      </div>

      {/* ── Charts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
        
        {/* Ring Chart */}
        <Card style={{ padding: 24 }} delay={0.05}>
          <div style={{ fontSize: '22px', fontWeight: 400, color: T.text, marginBottom: 20, letterSpacing: '-0.01em' }}>Risk Distribution</div>
          <div style={{ position: 'relative', height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[{ value: 1 }]} innerRadius={70} outerRadius={85} dataKey="value" stroke="none" fill={T.surface2} isAnimationActive={false} />
                <Pie 
                  data={riskDist} innerRadius={70} outerRadius={85} dataKey="value" 
                  stroke={T.surface} strokeWidth={2} cornerRadius={4} startAngle={90} endAngle={-270}
                  isAnimationActive={true}
                  animationBegin={200}
                  animationDuration={700}
                  animationEasing="ease-out"
                >
                  {riskDist.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ display: 'none' }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <span style={{ fontSize: '34px', fontWeight: 300, color: T.text, lineHeight: 1 }}>{sites.length}</span>
              <span style={{ fontSize: '13px', color: T.sub, marginTop: 4 }}>Sites</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12 }}>
            {riskDist.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                <span style={{ fontSize: '11px', color: T.sub, fontWeight: 500, letterSpacing: '0.04em' }}>{d.name}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Sparkline chart */}
        <Card style={{ padding: 24 }} delay={0.1}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ fontSize: '22px', fontWeight: 400, color: T.text, letterSpacing: '-0.01em' }}>Deviation Trend</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px' }}>
              <TrendingUp size={14} color={T.accent} />
              <span style={{ color: T.accent, fontWeight: 500 }}>+24% this week</span>
            </div>
          </div>
          <div style={{ height: 200, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} dy={10} />
                <ReferenceLine y={0} stroke={T.border} />
                <Tooltip content={<LightTooltip />} cursor={{ stroke: T.borderLight, strokeWidth: 32 }} />
                <Line
                  type="monotone" dataKey="deviations"
                  stroke={T.accent} strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: T.surface }}
                  activeDot={{ r: 6, strokeWidth: 0, fill: T.accent }}
                  isAnimationActive={true}
                  animationBegin={300}
                  animationDuration={800}
                  animationEasing="ease-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* ── Top Risk Sites ── */}
      <Card style={{ padding: '20px 24px' }} delay={0.15}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: '22px', fontWeight: 400, color: T.text, letterSpacing: '-0.01em' }}>Top Risk Sites</div>
          <button
            onClick={() => navigate('/dashboard/sites')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '13px', color: T.accent, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
          >
            View all <ChevronRight size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <AnimatedList delay={150}>
            {topSites.map((site, i) => (
              <motion.div
              key={site.site_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05, ease }}
              onClick={() => navigate(`/dashboard/sites/${site.site_id}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0', borderBottom: i < topSites.length - 1 ? `1px solid ${T.borderLight}` : 'none', cursor: 'pointer' }}
            >
              <span style={{ fontFamily: 'SF Mono, monospace', fontSize: '11px', color: T.muted, width: 70, flexShrink: 0 }}>{site.site_id}</span>
              <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: T.text }}>{site.site_name}</span>
              <span style={{ fontSize: '13px', fontWeight: 500, color: riskColor[site.risk_level], width: 32, textAlign: 'right', flexShrink: 0 }}>{site.risk_score}</span>
              <div style={{ width: 100, height: 4, background: T.surface2, borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${site.risk_score}%` }}
                  transition={{ duration: 0.8, delay: i * 0.05 + 0.2, ease }}
                  style={{ height: '100%', background: riskColor[site.risk_level], borderRadius: 4 }}
                />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 600, color: riskColor[site.risk_level], padding: '2px 8px', borderRadius: 10, width: 60, textAlign: 'center', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {site.risk_level}
              </span>
              <ArrowRight size={14} color={T.muted} />
            </motion.div>
          ))}
          </AnimatedList>
        </div>
      </Card>

      {/* ── Recent Deviations ── */}
      <Card delay={0.2}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '22px', fontWeight: 400, color: T.text, letterSpacing: '-0.01em' }}>Recent Protocol Deviations</div>
          <button
            onClick={() => navigate('/dashboard/deviations')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '13px', color: T.accent, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
          >
            View all <ChevronRight size={14} />
          </button>
        </div>

        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '150px 90px 100px 1fr 80px 90px', padding: '12px 24px', borderBottom: `1px solid ${T.borderLight}` }}>
          {['Deviation ID', 'Site', 'Patient', 'Category', 'Severity', 'Status'].map(h => (
            <span key={h} style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.sub }}>{h}</span>
          ))}
        </div>

        <AnimatedList delay={150}>
          {deviations.slice(0, 6).map((dev, i) => (
            <div
            key={dev.deviation_id}
            onClick={() => setSelectedDeviation(dev)}
            style={{
              display: 'grid',
              gridTemplateColumns: '150px 90px 100px 1fr 80px 90px',
              padding: '14px 24px',
              borderBottom: i < 5 ? `1px solid ${T.borderLight}` : 'none',
              cursor: 'pointer',
              alignItems: 'center',
            }}
          >
            <span style={{ fontFamily: 'SF Mono, monospace', fontSize: '12px', color: T.accent, fontWeight: 500 }}>{dev.deviation_id}</span>
            <span style={{ fontSize: '13px', color: T.sub }}>{dev.site_id}</span>
            <span style={{ fontSize: '13px', color: T.sub }}>{dev.patient_id}</span>
            <span style={{ fontSize: '13px', color: T.text, paddingRight: 10 }}>{dev.category}</span>
            <span style={{ fontSize: '10px', fontWeight: 600, color: sevColor[dev.severity] ?? T.sub, padding: '2px 8px', borderRadius: 10, display: 'inline-block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {dev.severity}
            </span>
            <span style={{ fontSize: '10px', fontWeight: 500, color: T.text, background: T.surface2, padding: '2px 8px', borderRadius: 10, display: 'inline-block', textTransform: 'capitalize' }}>
              {dev.status}
            </span>
          </div>
        ))}
        </AnimatedList>
      </Card>

      {/* -- Detail Drawer -- */}
      <AnimatePresence>
        {selectedDeviation && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDeviation(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)', zIndex: 40 }}
            />
            <motion.aside
              key="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 35 }}
              style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
                background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(30px)', borderLeft: `1px solid ${T.border}`,
                zIndex: 50, display: 'flex', flexDirection: 'column',
                boxShadow: '-10px 0 30px rgba(0,0,0,0.1)',
              }}
            >
              {/* Header */}
              <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: 'SF Mono, monospace', fontSize: '14px', color: T.text, fontWeight: 600 }}>{selectedDeviation.deviation_id}</span>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: sevColor[selectedDeviation.severity], padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {selectedDeviation.severity}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedDeviation(null)}
                  style={{ padding: 6, borderRadius: 16, border: 'none', background: T.surface2, color: T.sub, cursor: 'pointer', display: 'flex' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.sub, marginBottom: 8 }}>Overview</div>
                  <p style={{ fontSize: '13px', lineHeight: 1.5, color: T.text, margin: 0 }}>{selectedDeviation.description}</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { label: 'Site',     value: selectedDeviation.site_id },
                    { label: 'Patient',  value: selectedDeviation.patient_id },
                    { label: 'Rule',     value: selectedDeviation.rule_id, mono: true },
                    { label: 'Category', value: selectedDeviation.category },
                  ].map(m => (
                    <div key={m.label} style={{ background: T.surface2, borderRadius: 12, padding: '12px 14px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.sub, marginBottom: 4 }}>{m.label}</div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: T.text, fontFamily: m.mono ? 'SF Mono, monospace' : 'inherit' }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.sub, marginBottom: 8 }}>Evidence</div>
                  <EvidencePanel expected={selectedDeviation.expected} actual={selectedDeviation.actual} severity={selectedDeviation.severity} />
                </div>
              </div>
              
              <div style={{ padding: '24px', borderTop: `1px solid ${T.border}` }}>
                <button
                  onClick={() => { setSelectedDeviation(null); navigate('/dashboard/capa'); }}
                  style={{ width: '100%', padding: '0', height: 36, borderRadius: 10, border: 'none', background: T.accent, color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  Generate CAPA <ChevronRight size={14} />
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
