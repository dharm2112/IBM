import { Outlet, NavLink, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Building2,
  AlertTriangle,
  CheckSquare,
  FileText,
  History,
  Bell,
  Settings,
  ChevronLeft,
  Zap,
} from 'lucide-react';

// ── Light design tokens ───────────────────────────────────────────────────────
const T = {
  bg:       '#f8f9fb',
  surface:  '#ffffff',
  surface2: '#f3f4f6',
  border:   '#e5e7eb',
  text:     '#111827',
  sub:      '#6b7280',
  muted:    '#9ca3af',
  dim:      '#d1d5db',
  indigo:   '#6366f1',
  indigoSub:'rgba(99,102,241,0.08)',
  indigoBorder: 'rgba(99,102,241,0.18)',
  green:    '#10b981',
};

const ease = [0.22, 1, 0.36, 1];

// ── NavItem ───────────────────────────────────────────────────────────────────
const NavItem = ({
  to,
  icon,
  label,
  exact,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  exact?: boolean;
}) => (
  <NavLink to={to} end={exact}>
    {({ isActive }) => (
      <motion.div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '7px 11px',
          borderRadius: 9,
          fontSize: '0.85rem',
          fontWeight: isActive ? 600 : 500,
          color: isActive ? T.indigo : T.sub,
          cursor: 'pointer',
          position: 'relative',
        }}
        whileHover={{ color: T.text, background: T.surface2 }}
        transition={{ duration: 0.15 }}
      >
        {isActive && (
          <motion.div
            layoutId="nav-pill"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 9,
              background: T.indigoSub,
              border: `1px solid ${T.indigoBorder}`,
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          />
        )}
        <span style={{ position: 'relative', color: isActive ? T.indigo : T.muted }}>{icon}</span>
        <span style={{ position: 'relative' }}>{label}</span>
      </motion.div>
    )}
  </NavLink>
);

const NavLabel = ({ children }: { children: string }) => (
  <p style={{ padding: '0 11px', fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: T.muted, marginBottom: 3 }}>
    {children}
  </p>
);

// ── Layout ────────────────────────────────────────────────────────────────────
const Layout = () => {
  const location = useLocation();

  const crumbs: Record<string, string> = {
    '/dashboard':                'Dashboard',
    '/dashboard/sites':          'Sites',
    '/dashboard/deviations':     'Deviations',
    '/dashboard/capa':           'CAPA',
    '/dashboard/protocol-rules': 'Protocol Rules',
    '/dashboard/audit':          'Audit Trail',
  };

  const pageTitle =
    crumbs[location.pathname] ??
    (location.pathname.startsWith('/dashboard/sites/')    ? `Site · ${location.pathname.split('/')[3]}`    :
     location.pathname.startsWith('/dashboard/patients/') ? `Patient · ${location.pathname.split('/')[3]}` :
     'Clinical Ops');

  return (
    <div style={{ display: 'flex', height: '100vh', background: T.bg, color: T.text, fontFamily: "Inter, -apple-system, 'SF Pro Display', sans-serif", overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease }}
        style={{
          width: 236,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: T.surface,
          borderRight: `1px solid ${T.border}`,
        }}
      >
        {/* Brand */}
        <div style={{ padding: '22px 18px 18px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={14} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, letterSpacing: '-0.01em', color: T.text }}>TrialGuard</div>
              <div style={{ fontSize: '0.65rem', color: T.muted }}>Clinical Ops</div>
            </div>
          </div>

          {/* Study badge */}
          <div style={{ background: T.indigoSub, border: `1px solid ${T.indigoBorder}`, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: T.indigo, marginBottom: 3 }}>Active Study</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: T.text }}>CT-801-ONC</div>
            <div style={{ fontSize: '0.7rem', color: T.sub, marginTop: 1 }}>Oncology · Phase II</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <NavLabel>Overview</NavLabel>
            <NavItem to="/dashboard" icon={<LayoutDashboard size={16} />} label="Dashboard" exact />
          </div>
          <div>
            <NavLabel>Monitoring</NavLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <NavItem to="/dashboard/sites"      icon={<Building2 size={16} />}     label="Sites" />
              <NavItem to="/dashboard/deviations" icon={<AlertTriangle size={16} />} label="Deviations" />
            </div>
          </div>
          <div>
            <NavLabel>Actions</NavLabel>
            <NavItem to="/dashboard/capa" icon={<CheckSquare size={16} />} label="CAPA" />
          </div>
          <div>
            <NavLabel>Configuration</NavLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <NavItem to="/dashboard/protocol-rules" icon={<FileText size={16} />} label="Protocol" />
              <NavItem to="/dashboard/audit"          icon={<History size={16} />}  label="Audit Trail" />
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div style={{ padding: '14px 18px', borderTop: `1px solid ${T.border}` }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: T.muted, textDecoration: 'none', marginBottom: 12 }}>
            <ChevronLeft size={13} /><span>Back to Home</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.green, display: 'inline-block' }} />
            <span style={{ fontSize: '0.72rem', color: T.sub }}>All systems operational</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: T.muted, marginTop: 5 }}>Powered by <strong style={{ color: T.sub }}>IBM watsonx.ai</strong></div>
        </div>
      </motion.aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>

        {/* Top bar */}
        <motion.header
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1, ease }}
          style={{
            height: 60,
            borderBottom: `1px solid ${T.border}`,
            background: T.surface,
            display: 'flex',
            alignItems: 'center',
            padding: '0 26px',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={pageTitle}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.18 }}
              style={{ fontSize: '0.9rem', fontWeight: 600, color: T.text }}
            >
              {pageTitle}
            </motion.div>
          </AnimatePresence>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: '0.75rem', textAlign: 'right', marginRight: 8 }}>
              <div style={{ color: T.muted, fontSize: '0.64rem' }}>Study</div>
              <div style={{ fontWeight: 600, color: T.text, fontSize: '0.78rem' }}>CT-801-ONC</div>
            </div>
            <div style={{ width: 1, height: 24, background: T.border }} />
            {[Bell, Settings].map((Icon, i) => (
              <motion.button
                key={i}
                whileHover={{ background: T.surface2, scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{ padding: 7, borderRadius: 8, border: 'none', background: 'transparent', color: T.muted, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <Icon size={17} />
              </motion.button>
            ))}
            <motion.div
              whileHover={{ scale: 1.06 }}
              style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#fff', cursor: 'pointer', marginLeft: 2 }}
            >
              JD
            </motion.div>
          </div>
        </motion.header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', background: T.bg }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease }}
              style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 26px' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default Layout;
