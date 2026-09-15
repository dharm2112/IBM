import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useSpring,
} from 'motion/react';
import {
  Activity,
  AlertTriangle,
  CheckSquare,
  ChevronRight,
  FileText,
  History,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

// ─── Reusable fade-up on scroll ──────────────────────────────────────────────
const FadeUp = ({
  children,
  delay = 0,
  className = '',
  style = {},
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
};

// ─── Stagger container ────────────────────────────────────────────────────────
const StaggerContainer = ({
  children,
  className = '',
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      style={style}
      initial="hidden"
      animate={inView ? 'show' : 'hidden'}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.1 } },
      }}
    >
      {children}
    </motion.div>
  );
};

const StaggerItem = ({
  children,
  style = {},
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) => (
  <motion.div
    style={style}
    variants={{
      hidden: { opacity: 0, y: 32 },
      show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
    }}
  >
    {children}
  </motion.div>
);

// ─── Floating Icon Card ───────────────────────────────────────────────────────
const FloatingCard = ({
  icon,
  color,
  x,
  y,
  rotate,
  floatY,
  delay = 0,
}: {
  icon: React.ReactNode;
  color: string;
  x: string;
  y: string;
  rotate: number;
  floatY: number;
  delay?: number;
}) => (
  <motion.div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      zIndex: 5,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
      borderRadius: 20,
      background: 'rgba(18,18,24,0.85)',
      border: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      color,
      cursor: 'pointer',
    }}
    initial={{ opacity: 0, scale: 0.6, rotate: rotate - 10 }}
    animate={{
      opacity: 1,
      scale: 1,
      rotate,
      y: [0, floatY, 0],
    }}
    transition={{
      opacity: { duration: 0.6, delay },
      scale: { duration: 0.6, delay },
      rotate: { duration: 0.6, delay },
      y: { duration: 5 + delay, repeat: Infinity, ease: 'easeInOut', delay },
    }}
    whileHover={{
      scale: 1.1,
      borderColor: `${color}66`,
      boxShadow: `0 0 28px ${color}44`,
    }}
  >
    {icon}
  </motion.div>
);

// ─── Ping Dot ─────────────────────────────────────────────────────────────────
const PingDot = ({ color }: { color: string }) => (
  <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
    <motion.span
      style={{ position: 'absolute', borderRadius: '50%', background: color, width: 8, height: 8 }}
      animate={{ scale: [1, 2], opacity: [0.6, 0] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
    />
    <span style={{ position: 'relative', borderRadius: '50%', background: color, width: 8, height: 8, display: 'inline-block' }} />
  </span>
);

// ─── Bento Card ───────────────────────────────────────────────────────────────
const BentoCard = ({
  children,
  style = {},
  hoverBorderColor = 'rgba(99,102,241,0.3)',
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  hoverBorderColor?: string;
}) => (
  <motion.div
    style={{
      borderRadius: 28,
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      background: 'rgba(18,18,24,0.8)',
      border: '1px solid rgba(255,255,255,0.05)',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
      ...style,
    }}
    whileHover={{
      borderColor: hoverBorderColor,
      boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
      y: -4,
    }}
    transition={{ duration: 0.25 }}
  >
    {children}
  </motion.div>
);

// ─── Timeline Event ───────────────────────────────────────────────────────────
const TimelineEvent = ({
  time,
  badge,
  badgeColor,
  title,
  desc,
}: {
  time: string;
  badge: string;
  badgeColor: { bg: string; text: string; border: string };
  title: string;
  desc: string;
}) => (
  <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', width: 190, flexShrink: 0 }}>
    <div style={{ position: 'absolute', top: -38, zIndex: 40, width: 20, height: 20, borderRadius: '50%', background: '#121218', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', border: '1px solid rgba(99,102,241,0.8)' }} />
    </div>
    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#71717a', marginBottom: 4 }}>{time}</span>
    <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 10px', borderRadius: 999, background: badgeColor.bg, color: badgeColor.text, border: `1px solid ${badgeColor.border}`, marginBottom: 8 }}>{badge}</span>
    <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>{title}</h4>
    <p style={{ fontSize: '0.65rem', color: '#a1a1aa', margin: 0, maxWidth: 170 }}>{desc}</p>
  </div>
);

// ─── Main Landing Page ────────────────────────────────────────────────────────
const LandingPage = () => {
  const navigate = useNavigate();
  const heroRef = useRef(null);

  // Parallax for hero glow blobs
  const { scrollY } = useScroll();
  const blobY = useSpring(useTransform(scrollY, [0, 600], [0, -120]), { stiffness: 60, damping: 20 });
  const blobScale = useTransform(scrollY, [0, 600], [1, 1.4]);
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const heroY = useTransform(scrollY, [0, 400], [0, -60]);

  return (
    <div style={{ background: '#0A0A0F', minHeight: '100vh', color: '#fff', fontFamily: 'Inter, sans-serif', overflowX: 'hidden' }}>

      {/* ── Global Styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        @keyframes aurora-shift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .aurora-text {
          background: linear-gradient(135deg,#a78bfa,#818cf8,#38bdf8,#a78bfa);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: aurora-shift 6s ease infinite;
        }

        .liquid-btn {
          position: relative;
          overflow: hidden;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          padding: 14px 32px;
          font-size: 1rem;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 8px 30px rgba(99,102,241,0.15);
        }
        .liquid-btn::before {
          content:'';
          position:absolute;
          bottom:0;left:0;right:0;
          height:3px;
          background: linear-gradient(135deg,#FF0080,#7928CA,#0070F3,#38bdf8);
          opacity:0.85;
          border-radius:50% 50% 0 0 / 80% 80% 0 0;
          filter:blur(1px);
        }
        .liquid-btn:hover {
          border-color:rgba(99,102,241,0.4);
          box-shadow:0 0 36px rgba(99,102,241,0.3);
          transform:translateY(-2px);
        }

        .stat-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 999px;
          padding: 6px 14px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #a1a1aa;
        }

        .grid-bg {
          background-image: linear-gradient(to right,rgba(31,41,55,0.07) 1px,transparent 1px),
                            linear-gradient(to bottom,rgba(31,41,55,0.07) 1px,transparent 1px);
          background-size: 4rem 4rem;
          mask-image: radial-gradient(ellipse 60% 60% at 50% 50%,#000 60%,transparent 100%);
        }
      `}</style>

      {/* ── Hero Section ─────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: '10rem', overflow: 'hidden' }}
      >
        {/* Grid overlay */}
        <div className="grid-bg" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }} />

        {/* Parallax glow blobs */}
        <motion.div
          style={{
            position: 'absolute', top: '28%', left: '50%',
            translateX: '-50%', translateY: '-50%',
            y: blobY, scale: blobScale,
            width: 560, height: 560,
            background: 'rgba(99,102,241,0.10)',
            borderRadius: '50%', filter: 'blur(130px)', pointerEvents: 'none', zIndex: 0,
          }}
        />
        <motion.div
          style={{
            position: 'absolute', bottom: 0, left: '50%',
            translateX: '-50%',
            y: useTransform(scrollY, [0, 400], [0, 60]),
            width: '80vw', height: 260,
            background: 'rgba(168,85,247,0.10)',
            borderRadius: '50% 50% 0 0', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0,
          }}
        />

        {/* Floating tech icons */}
        <FloatingCard icon={<ShieldCheck size={38} />} color="#6366f1" x="12vw" y="18vh" rotate={-8} floatY={-14} delay={0.4} />
        <FloatingCard icon={<Activity size={38} />}    color="#38bdf8" x="78vw" y="14vh" rotate={10}  floatY={12}  delay={0.6} />
        <FloatingCard icon={<AlertTriangle size={38}/>} color="#f59e0b" x="8vw"  y="55vh" rotate={6}   floatY={-10} delay={0.5} />
        <FloatingCard icon={<FileText size={38} />}    color="#ec4899" x="79vw" y="48vh" rotate={-10} floatY={14}  delay={0.7} />
        <FloatingCard icon={<Users size={38} />}       color="#10b981" x="70vw" y="70vh" rotate={8}   floatY={-12} delay={0.8} />

        {/* Parallax hero content */}
        <motion.div
          style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 1.5rem', y: heroY, opacity: heroOpacity }}
        >
          

          {/* Headline */}
          <div style={{ overflow: 'hidden' }}>
            <motion.h1
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              style={{ fontSize: 'clamp(2.5rem, 6vw, 5.5rem)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.03em', margin: 0 }}
            >
              Your Clinical Trial<br />
              <span className="aurora-text">Has a Story.</span>
            </motion.h1>
          </div>

          {/* Sub-headline */}
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{ marginTop: '1.5rem', fontSize: 'clamp(1rem, 2vw, 1.25rem)', fontWeight: 500, color: '#a1a1aa', maxWidth: 620, lineHeight: 1.65 }}
          >
            Map, track, and reconstruct every protocol deviation, patient event, and site risk — in{' '}
            <strong style={{ color: '#818cf8' }}>real-time.</strong>
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ marginTop: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
          >
            <motion.button
              className="liquid-btn"
              onClick={() => navigate('/dashboard')}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Jump Into TrialGuard
                <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1.6, repeat: Infinity }}>→</motion.span>
              </span>
            </motion.button>

            <motion.div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { icon: <PingDot color="#10b981" />, text: 'All systems live' },
                { icon: <Zap size={12} style={{ color: '#6366f1' }} />, text: 'Powered by IBM watsonx.ai' },
                { icon: <ShieldCheck size={12} style={{ color: '#38bdf8' }} />, text: 'FDA 21 CFR Part 11 Ready' },
              ].map((pill, i) => (
                <motion.div
                  key={pill.text}
                  className="stat-pill"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.55 + i * 0.08, duration: 0.4 }}
                >
                  {pill.icon}<span>{pill.text}</span>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Bottom fade */}
        <div style={{ position: 'absolute', inset: 'auto 0 0', height: 160, background: 'linear-gradient(to top,#0A0A0F,transparent)', pointerEvents: 'none', zIndex: 10 }} />
      </section>

      {/* ── Feature Bento Grid ────────────────────────────────────────────────── */}
      <section id="features" style={{ position: 'relative', zIndex: 20, background: '#0A0A0F', padding: '6rem 1.5rem' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>

          {/* Section header */}
          <FadeUp style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)', fontWeight: 900, letterSpacing: '-0.02em', margin: '0 0 1rem' }}>
              Architected for <span className="aurora-text">Total Intelligence</span>
            </h2>
            <p style={{ color: '#71717a', fontSize: '1.05rem', maxWidth: 560, margin: '0 auto' }}>
              TrialGuard continuously maps, audits, and records every single event inside your clinical trial operations.
            </p>
          </FadeUp>

          {/* Bento grid */}
          <StaggerContainer style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1.5rem' }}>

            {/* Card 1 – Patient Timeline (2-col) */}
            <StaggerItem style={{ gridColumn: 'span 2' }}>
              <BentoCard hoverBorderColor="rgba(99,102,241,0.35)">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div style={{ padding: 12, background: 'rgba(99,102,241,0.1)', borderRadius: 16, border: '1px solid rgba(99,102,241,0.2)' }}>
                      <History size={22} style={{ color: '#818cf8' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', margin: 0 }}>Patient Event Time-Travel</h3>
                      <p style={{ fontSize: '0.78rem', color: '#71717a', margin: '3px 0 0' }}>Reconstruct trial timelines down to the exact visit.</p>
                    </div>
                  </div>

                  {/* Mini timeline */}
                  <div style={{ position: 'relative', overflowX: 'auto', paddingTop: '3rem', paddingBottom: '0.5rem', marginTop: '1.5rem' }}>
                    <div style={{ position: 'absolute', left: 24, right: 24, top: 22, height: 2, background: '#27272a' }}>
                      <motion.div
                        style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right,#6366f1,#a855f7,transparent)', borderRadius: 9999 }}
                        initial={{ scaleX: 0, originX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '3rem', paddingLeft: '1.5rem', minWidth: 'max-content' }}>
                      {[
                        { time: 'Day 0',   badge: 'Enrollment', bc: { bg: 'rgba(16,185,129,0.1)', text: '#34d399', border: 'rgba(16,185,129,0.2)' }, title: 'Patient PT-042 Enrolled', desc: 'Baseline vitals recorded. Consent form signed.' },
                        { time: 'Week 2',  badge: 'Deviation',  bc: { bg: 'rgba(245,158,11,0.1)', text: '#fbbf24', border: 'rgba(245,158,11,0.2)' }, title: 'Missed Visit Window',     desc: 'Visit occurred 4 days outside protocol window.' },
                        { time: 'Week 6',  badge: 'CAPA Raised',bc: { bg: 'rgba(99,102,241,0.1)', text: '#818cf8', border: 'rgba(99,102,241,0.2)' }, title: 'Root Cause Identified',  desc: 'Site scheduling error — corrective plan submitted.' },
                        { time: 'Week 10', badge: 'Resolved',   bc: { bg: 'rgba(16,185,129,0.1)', text: '#34d399', border: 'rgba(16,185,129,0.2)' }, title: 'CAPA Closed',            desc: 'No further deviations. Site back on track.' },
                      ].map((ev, i) => (
                        <motion.div key={ev.time} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15, duration: 0.5 }}>
                          <TimelineEvent time={ev.time} badge={ev.badge} badgeColor={ev.bc} title={ev.title} desc={ev.desc} />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#52525b' }}>
                  <span>Scroll inside timeline to scrub back in time</span>
                  <motion.span
                    style={{ color: '#818cf8', fontWeight: 600, cursor: 'pointer' }}
                    whileHover={{ x: 4 }}
                    onClick={() => navigate('/dashboard/patients/PT-042')}
                  >Explore Timeline →</motion.span>
                </div>
              </BentoCard>
            </StaggerItem>

            {/* Card 2 – Live Compliance */}
            <StaggerItem>
              <BentoCard hoverBorderColor="rgba(236,72,153,0.3)">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
                    <div style={{ padding: 12, background: 'rgba(236,72,153,0.1)', borderRadius: 16, border: '1px solid rgba(236,72,153,0.2)' }}>
                      <ShieldCheck size={22} style={{ color: '#f472b6' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', margin: 0 }}>Live Compliance</h3>
                      <p style={{ fontSize: '0.78rem', color: '#71717a', margin: '3px 0 0' }}>Continuous protocol audits.</p>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(8,8,12,0.8)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, minHeight: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 12 }}>
                      <PingDot color="#10b981" />
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#d4d4d8' }}>Live Audit Feed</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { msg: 'CONSENT_MISSING on PT-007', level: 'CRITICAL', color: '#ef4444' },
                        { msg: 'Visit window exceeded — SITE-03', level: 'MAJOR', color: '#f59e0b' },
                        { msg: 'Lab value outside range — PT-019', level: 'MINOR', color: '#6366f1' },
                        { msg: 'ICF version mismatch — SITE-07', level: 'MAJOR', color: '#f59e0b' },
                      ].map((item, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -16 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: i * 0.1, duration: 0.4 }}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: `${item.color}10`, borderRadius: 10, border: `1px solid ${item.color}22` }}
                        >
                          <span style={{ fontSize: '0.6rem', fontWeight: 700, color: item.color, background: `${item.color}20`, padding: '2px 6px', borderRadius: 999 }}>{item.level}</span>
                          <span style={{ fontSize: '0.7rem', color: '#a1a1aa' }}>{item.msg}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#52525b' }}>Real-time checks aligned with ICH E6(R3).</div>
              </BentoCard>
            </StaggerItem>

            {/* Card 3 – Site Risk Ranking */}
            <StaggerItem>
              <BentoCard hoverBorderColor="rgba(56,189,248,0.3)">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
                    <div style={{ padding: 12, background: 'rgba(56,189,248,0.1)', borderRadius: 16, border: '1px solid rgba(56,189,248,0.2)' }}>
                      <TrendingUp size={22} style={{ color: '#38bdf8' }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', margin: 0 }}>Site Risk Ranking</h3>
                      <p style={{ fontSize: '0.78rem', color: '#71717a', margin: '3px 0 0' }}>Instant risk scores per site.</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[
                      { id: 'SITE-03', name: 'Mumbai Medical Center',  score: 87, color: '#ef4444', level: 'HIGH'   },
                      { id: 'SITE-07', name: 'Delhi Oncology Inst.',   score: 64, color: '#f59e0b', level: 'MEDIUM' },
                      { id: 'SITE-01', name: 'Bangalore Trial Hub',    score: 41, color: '#f59e0b', level: 'MEDIUM' },
                      { id: 'SITE-09', name: 'Chennai Research Ctr',   score: 18, color: '#10b981', level: 'LOW'    },
                    ].map((site, i) => (
                      <motion.div key={site.id} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: '0.65rem', color: '#52525b', fontFamily: 'monospace', width: 56 }}>{site.id}</span>
                          <span style={{ flex: 1, fontSize: '0.73rem', color: '#d4d4d8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{site.name}</span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: site.color, width: 26, textAlign: 'right' }}>{site.score}</span>
                          <div style={{ width: 64, height: 5, background: '#27272a', borderRadius: 999, overflow: 'hidden' }}>
                            <motion.div
                              style={{ height: '100%', background: site.color, borderRadius: 999 }}
                              initial={{ width: 0 }}
                              whileInView={{ width: `${site.score}%` }}
                              viewport={{ once: true }}
                              transition={{ duration: 0.8, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                            />
                          </div>
                          <span style={{ fontSize: '0.58rem', fontWeight: 700, color: site.color, background: `${site.color}18`, padding: '2px 7px', borderRadius: 999 }}>{site.level}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#52525b' }}>Auto-computed from IBM watsonx.ai risk models.</div>
              </BentoCard>
            </StaggerItem>

            {/* Card 4 – Protocol Drift (2-col) */}
            <StaggerItem style={{ gridColumn: 'span 2' }}>
              <BentoCard hoverBorderColor="rgba(99,102,241,0.3)">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ padding: 12, background: 'rgba(99,102,241,0.1)', borderRadius: 16, border: '1px solid rgba(99,102,241,0.2)' }}>
                        <Sparkles size={22} style={{ color: '#818cf8' }} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', margin: 0 }}>Protocol Drift Detection</h3>
                        <p style={{ fontSize: '0.78rem', color: '#71717a', margin: '3px 0 0' }}>Spot violations the moment they happen against your rules.</p>
                      </div>
                    </div>
                    <motion.button
                      style={{ fontSize: '0.7rem', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', padding: '6px 14px', borderRadius: 10, color: '#818cf8', fontWeight: 700, cursor: 'pointer' }}
                      whileHover={{ background: 'rgba(99,102,241,0.2)', scale: 1.04 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => navigate('/dashboard/protocol-rules')}
                    >View Rules</motion.button>
                  </div>

                  <div style={{ background: 'rgba(8,8,12,0.9)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: 16, fontFamily: 'monospace', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.65rem', color: '#52525b' }}>
                      <span>protocol/visit-window.json</span>
                      <motion.span
                        style={{ color: '#f59e0b', fontWeight: 700 }}
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >DRIFT DETECTED</motion.span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[
                        { text: 'rule "visit_window_7_days" {', color: '#71717a' },
                        { text: '  patient_id: "PT-042"', color: '#71717a' },
                        { text: '- visit_delta_days: 11  // Exceeded 7-day window', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
                        { text: '}', color: '#71717a' },
                      ].map((line, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -12 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: i * 0.08, duration: 0.4 }}
                          style={{ color: line.color, background: line.bg, padding: '2px 8px', borderRadius: line.bg ? 8 : 0 }}
                        >{line.text}</motion.div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#52525b' }}>
                  <span>Syncs with Protocol Rule Engine &amp; CAPA workflows</span>
                  <motion.span style={{ color: '#818cf8', fontWeight: 600, cursor: 'pointer' }} whileHover={{ x: 4 }} onClick={() => navigate('/dashboard/deviations')}>Reconcile Drift →</motion.span>
                </div>
              </BentoCard>
            </StaggerItem>

          </StaggerContainer>
        </div>
      </section>

      {/* ── Analytics Preview ─────────────────────────────────────────────────── */}
      <section style={{ background: '#0A0A0F', padding: '0 1.5rem 6rem', position: 'relative', zIndex: 30 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: '3rem', alignItems: 'center' }}>

            {/* Left */}
            <FadeUp style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 999, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8', fontSize: '0.7rem', fontWeight: 700, width: 'fit-content' }}>
                <Sparkles size={12} /> Integrations &amp; Analytics
              </div>
              <h2 style={{ fontSize: 'clamp(1.75rem,3.5vw,2.8rem)', fontWeight: 900, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.1 }}>
                Clinical Integrity,<br /><span className="aurora-text">Visualized.</span>
              </h2>
              <p style={{ color: '#71717a', fontSize: '0.9rem', lineHeight: 1.7, margin: 0 }}>
                See TrialGuard in action. Switch between live analytics views to inspect deviation trends, site performance bands, and compliance scores.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Risk Key</span>
                {[
                  { color: '#10b981', label: 'Green (On Track)',  desc: 'Site operating within protocol parameters.' },
                  { color: '#f59e0b', label: 'Amber (Warning)',   desc: 'Minor deviations detected — monitoring needed.' },
                  { color: '#ef4444', label: 'Red (Breach)',      desc: 'Critical protocol deviation — CAPA required.' },
                ].map((item, i) => (
                  <motion.div key={item.color} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.4 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <PingDot color={item.color} />
                    <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}><strong style={{ color: '#d4d4d8' }}>{item.label}:</strong> {item.desc}</span>
                  </motion.div>
                ))}
              </div>
            </FadeUp>

            {/* Right – mock chart */}
            <FadeUp delay={0.15}>
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, backdropFilter: 'blur(12px)', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['Deviation Trend', 'Risk Heatmap', 'CAPA Rate'].map((tab, i) => (
                      <span key={tab} style={{ padding: '5px 14px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 600, background: i === 0 ? 'rgba(99,102,241,0.15)' : 'transparent', border: i === 0 ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent', color: i === 0 ? '#818cf8' : '#52525b', cursor: 'pointer' }}>{tab}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', color: '#71717a' }}>
                    <PingDot color="#10b981" /><span>Live</span>
                  </div>
                </div>

                <div style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 180 }}>
                    {[
                      { week: 'Wk 1', val: 45, color: '#10b981' },
                      { week: 'Wk 2', val: 72, color: '#f59e0b' },
                      { week: 'Wk 3', val: 58, color: '#f59e0b' },
                      { week: 'Wk 4', val: 91, color: '#ef4444' },
                      { week: 'Wk 5', val: 67, color: '#f59e0b' },
                      { week: 'Wk 6', val: 34, color: '#10b981' },
                      { week: 'Wk 7', val: 48, color: '#10b981' },
                      { week: 'Wk 8', val: 80, color: '#ef4444' },
                    ].map((bar, i) => (
                      <div key={bar.week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <motion.div
                          style={{ width: '100%', borderRadius: '6px 6px 0 0', background: `linear-gradient(to top,${bar.color}88,${bar.color}22)`, border: `1px solid ${bar.color}44` }}
                          initial={{ height: 0 }}
                          whileInView={{ height: bar.val * 1.6 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.7, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                        />
                        <span style={{ fontSize: '0.6rem', color: '#52525b' }}>{bar.week}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    {[
                      { label: 'Total Deviations', value: '134', delta: '+12%', pos: false },
                      { label: 'Resolved',          value: '98',  delta: '+8%',  pos: true  },
                      { label: 'Pending CAPA',       value: '36',  delta: '-3',   pos: true  },
                    ].map((stat, i) => (
                      <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>{stat.value}</div>
                        <div style={{ fontSize: '0.65rem', color: '#71717a', marginTop: 2 }}>{stat.label}</div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: stat.pos ? '#10b981' : '#ef4444', marginTop: 2 }}>{stat.delta}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </FadeUp>

          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section style={{ background: '#0A0A0F', padding: '4rem 1.5rem 6rem', textAlign: 'center', position: 'relative', zIndex: 30, overflow: 'hidden' }}>
        <motion.div
          style={{ position: 'absolute', top: '50%', left: '50%', translateX: '-50%', translateY: '-50%', width: '60vw', height: 200, background: 'rgba(99,102,241,0.08)', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none' }}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <FadeUp style={{ position: 'relative', zIndex: 10 }}>
          <h2 style={{ fontSize: 'clamp(1.75rem,4vw,3rem)', fontWeight: 900, letterSpacing: '-0.02em', margin: '0 0 1rem' }}>
            Ready to <span className="aurora-text">Guard Your Trial?</span>
          </h2>
          <p style={{ color: '#71717a', marginBottom: '2.5rem', fontSize: '1rem' }}>
            Join the next generation of clinical intelligence.
          </p>
          <motion.button
            className="liquid-btn"
            onClick={() => navigate('/dashboard')}
            style={{ fontSize: '1.05rem', padding: '16px 44px' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
          >
            Open Dashboard →
          </motion.button>

          <StaggerContainer style={{ marginTop: '3rem', display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap' }}>
            {[
              { icon: <CheckSquare size={16} />, label: 'CAPA Management' },
              { icon: <AlertTriangle size={16} />, label: 'Deviation Center' },
              { icon: <History size={16} />, label: 'Full Audit Trail' },
              { icon: <ShieldCheck size={16} />, label: 'Compliance Reports' },
            ].map((item) => (
              <StaggerItem key={item.label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#52525b' }}>
                  <span style={{ color: '#6366f1' }}>{item.icon}</span>{item.label}
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </FadeUp>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: '#3f3f46' }}>
        Built with IBM watsonx.ai · Clinical Ops Intelligence · {new Date().getFullYear()}
      </footer>

    </div>
  );
};

export default LandingPage;
