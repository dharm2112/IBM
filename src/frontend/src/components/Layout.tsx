import { Outlet, NavLink, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ProgressiveBlur } from './ProgressiveBlur';
import { FramerSmoothScroll } from './FramerSmoothScroll';
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
  ChevronDown,
  Activity,
  Shield
} from 'lucide-react';

// ── Apple HIG Tokens ────────────────────────────────────────────────────────
const T = {
  bg:       '#F5F5F7',
  surface:  'rgba(255, 255, 255, 0.72)', // Frosted glass effect
  surface2: '#F2F2F7',
  border:   'rgba(0,0,0,0.07)',
  text:     '#1D1D1F',
  sub:      '#6E6E73',
  muted:    '#AEAEB2',
  accent:   '#007AFF',
  green:    '#34C759',
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
  <NavLink to={to} end={exact} style={{ textDecoration: 'none' }}>
    {({ isActive }) => (
      <div style={{ position: 'relative', height: 32, marginBottom: 2 }}>
        {isActive && (
          <motion.div
            layoutId="nav-pill"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 8,
              background: 'rgba(0,122,255,0.10)',
            }}
            transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1.0] }} // --ease-spring
          />
        )}
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 10px',
            fontSize: '13px',
            fontWeight: isActive ? 500 : 400,
            color: isActive ? T.accent : '#1D1D1F',
            cursor: 'pointer',
            borderRadius: 8,
            zIndex: 1,
            // Delay color transition if becoming active
            transition: 'color 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            transitionDelay: isActive ? '150ms' : '0ms'
          }}
          whileHover={!isActive ? { background: 'rgba(0,0,0,0.04)' } : undefined}
          transition={{ duration: 0.15 }} // --dur-fast
        >
          <span style={{ 
            color: isActive ? T.accent : '#6E6E73', 
            display: 'flex',
            transition: 'color 150ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            transitionDelay: isActive ? '150ms' : '0ms'
          }}>{icon}</span>
          <span>{label}</span>
        </motion.div>
      </div>
    )}
  </NavLink>
);

const NavLabel = ({ children }: { children: string }) => (
  <p style={{ padding: '0 10px', fontSize: '10px', fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#AEAEB2', margin: '16px 0 6px 0' }}>
    {children}
  </p>
);

// ── Layout ────────────────────────────────────────────────────────────────────
const Layout = () => {
  const location = useLocation();

  const crumbs: Record<string, string> = {
    '/dashboard':                'Executive Dashboard',
    '/dashboard/sites':          'Site Risk',
    '/dashboard/deviations':     'Protocol Deviations',
    '/dashboard/capa':           'CAPA Management',
    '/dashboard/protocol-rules': 'Protocol Rules',
    '/dashboard/audit':          'Audit Trail',
  };

  const pageTitle = crumbs[location.pathname] ?? 'Clinical Ops';

  return (
    <div style={{ display: 'flex', height: '100vh', background: T.bg, color: T.text, overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease }}
        style={{
          width: 220,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: T.surface,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: '0.5px solid rgba(0,0,0,0.08)',
          zIndex: 10,
        }}
      >
        {/* Brand */}
        <div style={{ padding: '24px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <img src="/logo.svg" alt="TrialGuard Logo" style={{ height: 32, width: 'auto', transform: 'scale(1.15)', transformOrigin: 'left center' }} />
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#1D1D1F' }}>TrialGuard</div>
          </div>
          <div style={{ fontSize: '11px', color: '#6E6E73', paddingLeft: 42 }}>Clinical Ops</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '0 12px', display: 'flex', flexDirection: 'column' }}>
          <NavLabel>Overview</NavLabel>
          <NavItem to="/dashboard" icon={<LayoutDashboard size={16} strokeWidth={1.5} />} label="Dashboard" exact />

          <NavLabel>Monitoring</NavLabel>
          <NavItem to="/dashboard/sites"      icon={<Building2 size={16} strokeWidth={1.5} />}     label="Sites" />
          <NavItem to="/dashboard/deviations" icon={<AlertTriangle size={16} strokeWidth={1.5} />} label="Deviations" />

          <NavLabel>Actions</NavLabel>
          <NavItem to="/dashboard/capa" icon={<CheckSquare size={16} strokeWidth={1.5} />} label="CAPA" />

          <NavLabel>Configuration</NavLabel>
          <NavItem to="/dashboard/protocol-rules" icon={<FileText size={16} strokeWidth={1.5} />} label="Protocol" />
          <NavItem to="/dashboard/audit"          icon={<History size={16} strokeWidth={1.5} />}  label="Audit Trail" />
        </nav>

        {/* Footer */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px', color: T.sub, textDecoration: 'none' }}>
            <ChevronLeft size={14} /><span>Home</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.green, display: 'inline-block' }} />
            <span style={{ fontSize: '11px', color: T.text }}>All systems operational</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '11px', color: '#AEAEB2' }}>
            ○ Powered by IBM watsonx.ai
          </div>
        </div>
      </motion.aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', position: 'relative' }}>

        {/* Top bar */}
        <motion.header
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1, ease }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 48,
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            padding: '0 40px',
            justifyContent: 'space-between',
            zIndex: 5,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
             {/* Empty space or dynamic page title could go here if needed, but usually Apple apps have it in content */}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Study selector pill */}
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: 6, 
              background: T.surface2, padding: '4px 10px', 
              borderRadius: 12, cursor: 'pointer',
              fontSize: '13px', fontWeight: 500, color: T.text
            }}>
              CT-801-ONC <ChevronDown size={14} color={T.sub} />
            </div>
            
            <div style={{ display: 'flex', gap: 8, color: T.sub }}>
              <Bell size={18} strokeWidth={1.5} style={{ cursor: 'pointer' }} />
              <Settings size={18} strokeWidth={1.5} style={{ cursor: 'pointer' }} />
            </div>
            
            <div style={{ 
              width: 28, height: 28, borderRadius: '50%', 
              background: '#E5E5EA', display: 'flex', 
              alignItems: 'center', justifyContent: 'center', 
              fontSize: '11px', fontWeight: 600, color: T.text, 
              cursor: 'pointer' 
            }}>
              JD
            </div>
          </div>
        </motion.header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'hidden', paddingTop: 64 }}>
          <FramerSmoothScroll>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.0, 0.0, 0.2, 1.0] } }} // --ease-decelerate
                exit={{ opacity: 0, y: -8, transition: { duration: 0.2, ease: [0.4, 0.0, 1.0, 1.0] } }} // --ease-accelerate
                style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 40px 40px' }}
              >
                {/* Page content */}
                {location.pathname !== '/dashboard/capa' && (
                  <h1 style={{ fontSize: '28px', fontWeight: 600, margin: '0 0 32px 0', color: T.text, letterSpacing: '-0.01em' }}>
                    {pageTitle}
                  </h1>
                )}
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </FramerSmoothScroll>
        </main>
        
        {/* Global Progressive Blur applied to all pages */}
        <ProgressiveBlur position="bottom" height="100px" />
      </div>
    </div>
  );
};

export default Layout;
