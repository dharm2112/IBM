import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, AlertTriangle, CheckSquare, FileText, History, Bell, Settings } from 'lucide-react';

const Layout = () => {
  const location = useLocation();
  
  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === '/') return 'Clinical Ops / Dashboard';
    if (path.startsWith('/sites')) return 'Clinical Ops / Sites' + (path.length > 7 ? ` / ${path.split('/')[2]}` : '');
    if (path.startsWith('/deviations')) return 'Clinical Ops / Deviations';
    if (path.startsWith('/capa')) return 'Clinical Ops / CAPA';
    if (path.startsWith('/protocol-rules')) return 'Clinical Ops / Protocol';
    if (path.startsWith('/audit')) return 'Clinical Ops / Audit';
    if (path.startsWith('/patients')) return 'Clinical Ops / Patients' + (path.length > 9 ? ` / ${path.split('/')[2]}` : '');
    return 'Clinical Ops';
  };

  return (
    <div className="flex h-screen bg-base-bg text-base-ink font-sans">
      {/* Sidebar */}
      <aside className="w-[260px] border-r border-base-border bg-base-card flex flex-col shrink-0">
        <div className="p-6 border-b border-base-border">
          <h1 className="text-lg font-semibold tracking-tight">Clinical Ops</h1>
          <p className="text-sm text-base-secondary">Risk Monitor</p>
          
          <div className="mt-6 pt-6 border-t border-base-border">
            <p className="text-xs font-semibold text-base-muted tracking-wider uppercase">Study</p>
            <p className="text-sm font-medium mt-1">CT-801-ONC</p>
            <p className="text-xs text-base-secondary mt-0.5">Oncology Phase II</p>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <p className="px-3 text-xs font-semibold text-base-muted tracking-wider uppercase mb-2">Overview</p>
            <div className="space-y-1">
              <NavItem to="/" icon={<LayoutDashboard size={18} />} label="Dashboard" />
            </div>
          </div>
          
          <div>
            <p className="px-3 text-xs font-semibold text-base-muted tracking-wider uppercase mb-2">Monitoring</p>
            <div className="space-y-1">
              <NavItem to="/sites" icon={<Building2 size={18} />} label="Sites" />
              <NavItem to="/deviations" icon={<AlertTriangle size={18} />} label="Deviations" />
            </div>
          </div>
          
          <div>
            <p className="px-3 text-xs font-semibold text-base-muted tracking-wider uppercase mb-2">Actions</p>
            <div className="space-y-1">
              <NavItem to="/capa" icon={<CheckSquare size={18} />} label="CAPA" />
            </div>
          </div>
          
          <div>
            <p className="px-3 text-xs font-semibold text-base-muted tracking-wider uppercase mb-2">Configuration</p>
            <div className="space-y-1">
              <NavItem to="/protocol-rules" icon={<FileText size={18} />} label="Protocol" />
              <NavItem to="/audit" icon={<History size={18} />} label="Audit" />
            </div>
          </div>
        </nav>
        
        <div className="p-4 border-t border-base-border">
          <div className="flex items-center space-x-2 text-sm text-base-secondary mb-2">
            <div className="w-2 h-2 rounded-full bg-risk-low"></div>
            <span>All systems operational</span>
          </div>
          <p className="text-xs text-base-muted">Powered by<br/><span className="font-semibold text-base-secondary">IBM watsonx.ai</span></p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-[72px] border-b border-base-border bg-base-card flex items-center px-8 shrink-0 justify-between">
          <div className="text-sm font-medium text-base-secondary">
            {getBreadcrumb()}
          </div>
          <div className="flex items-center space-x-6">
            <div className="text-sm text-right">
              <p className="text-base-muted text-xs">Study:</p>
              <p className="font-medium">CT-801-ONC</p>
            </div>
            
            <div className="flex items-center space-x-3 border-l border-base-border pl-6">
              <button className="p-1.5 text-base-secondary hover:text-base-ink rounded-full hover:bg-base-bg transition-colors">
                <Bell size={20} />
              </button>
              <button className="p-1.5 text-base-secondary hover:text-base-ink rounded-full hover:bg-base-bg transition-colors">
                <Settings size={20} />
              </button>
              <div className="ml-2 h-8 w-8 rounded-full bg-slate-100 border border-base-border flex items-center justify-center text-sm font-medium text-base-ink">
                JD
              </div>
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-base-bg">
          <div className="max-w-[1440px] mx-auto p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

const NavItem = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center space-x-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${
          isActive
            ? 'bg-base-bg text-base-ink'
            : 'text-base-secondary hover:bg-base-bg hover:text-base-ink'
        }`
      }
    >
      <div className={`${({ isActive }: any) => isActive ? 'text-base-ink' : 'text-base-muted'}`}>
        {icon}
      </div>
      <span>{label}</span>
    </NavLink>
  );
};

export default Layout;
