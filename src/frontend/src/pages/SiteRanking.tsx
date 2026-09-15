import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { api } from '../api/client';
import type { Site } from '../api/types';
import { DataTable, RiskBadge } from '../components';
import type { Column } from '../components/DataTable';
import { Search, Calculator, ArrowRight } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

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

export const SiteRanking = () => {
  const navigate = useNavigate();
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRisk, setFilterRisk] = useState<'ALL' | 'LOW' | 'MEDIUM' | 'HIGH'>('ALL');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const fetchedSites = await api.getSites();
      // Sort by risk score descending by default
      setSites(fetchedSites.sort((a: Site, b: Site) => b.risk_score - a.risk_score));
    } catch (error) {
      console.error("Failed to fetch sites", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      await api.recalculateRisk();
      await fetchData();
    } finally {
      setIsRecalculating(false);
    }
  };

  const filteredSites = sites.filter(site => {
    const matchesSearch = site.site_name.toLowerCase().includes(search.toLowerCase()) || 
                          site.site_id.toLowerCase().includes(search.toLowerCase());
    const matchesRisk = filterRisk === 'ALL' || site.risk_level === filterRisk;
    return matchesSearch && matchesRisk;
  });

  const columns: Column<Site>[] = [
    { key: 'rank', header: 'Rank', render: (s: Site) => <span style={{ fontWeight: 600, color: T.sub, fontSize: '13px' }}>{filteredSites.indexOf(s) + 1}</span> },
    { key: 'id', header: 'Site', render: (s: Site) => (
      <div>
        <div style={{ fontWeight: 500, color: T.text, fontSize: '13px' }}>{s.site_name}</div>
        <div style={{ fontFamily: 'SF Mono, monospace', fontSize: '11px', color: T.sub, marginTop: '2px' }}>{s.site_id}</div>
      </div>
    ) },
    { key: 'location', header: 'Location', render: (s: Site) => <span style={{ fontSize: '13px', color: T.sub }}>{s.location}</span> },
    { key: 'patients', header: 'Patients', render: (s: Site) => <span style={{ fontSize: '13px', color: T.sub }}>{s.patient_count}</span> },
    { key: 'deviations', header: 'Deviations', render: () => <span style={{ fontSize: '13px', color: T.text }}>{Math.floor(Math.random() * 20)}</span> },
    { key: 'major', header: 'Major', render: () => <span style={{ color: T.red, fontWeight: 500, fontSize: '13px' }}>{Math.floor(Math.random() * 5)}</span> },
    { key: 'risk_score', header: 'Risk Score', render: (s: Site) => (
      <div style={{ width: 120, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: '13px', fontWeight: 600, width: 28, textAlign: 'right', color: T.text }}>{s.risk_score}</span>
        <div style={{ flex: 1, height: 4, background: T.surface2, borderRadius: 4, overflow: 'hidden' }}>
          <div 
            style={{ 
              height: '100%', 
              borderRadius: 4,
              background: s.risk_level === 'HIGH' ? T.red : s.risk_level === 'MEDIUM' ? T.amber : T.green,
              width: `${s.risk_score}%`
            }}
          />
        </div>
      </div>
    ) },
    { key: 'risk_level', header: 'Level', render: (s: Site) => <RiskBadge level={s.risk_level} /> },
    { key: 'trend', header: 'Trend', render: (s: Site) => {
      const data = Array.from({length: 5}, () => ({ v: Math.random() * 100 }));
      const color = s.risk_level === 'HIGH' ? T.red : s.risk_level === 'MEDIUM' ? T.amber : T.green;
      return (
        <div style={{ width: 64, height: 32 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    } },
    { key: 'actions', header: '', render: () => <ArrowRight size={14} color={T.muted} /> }
  ];

  if (isLoading && sites.length === 0) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 250, color: T.sub, fontSize: '13px' }}>Loading site data...</div>;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: -40 }} // Pull up to match layout
    >
      {/* Header Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
          <button 
            onClick={handleRecalculate}
            disabled={isRecalculating}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', height: 36, borderRadius: 10, border: 'none', background: T.accent, color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
          >
            <Calculator size={14} style={isRecalculating ? { animation: 'spin 1s linear infinite' } : {}} />
            <span>Recalculate Risk</span>
          </button>
        </div>
      </div>

      <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Filter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 320 }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.muted }} size={16} />
            <input 
              type="text" 
              placeholder="Search sites..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0 16px 0 36px', height: 36, fontSize: '13px', border: 'none', background: T.surface2, borderRadius: 10, color: T.text, outline: 'none' }}
            />
          </div>
          
          {/* Segmented Control */}
          <div style={{ display: 'flex', alignItems: 'center', background: T.surface2, borderRadius: 8, padding: 2 }}>
            {(['ALL', 'LOW', 'MEDIUM', 'HIGH'] as const).map((risk) => (
              <button
                key={risk}
                onClick={() => setFilterRisk(risk)}
                style={{
                  padding: '6px 16px',
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  background: filterRisk === risk ? T.surface : 'transparent',
                  color: filterRisk === risk ? T.text : T.sub,
                  boxShadow: filterRisk === risk ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {risk === 'ALL' ? 'All' : risk}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ margin: '0 -20px -20px -20px' }}>
          <DataTable 
            data={filteredSites} 
            columns={columns} 
            keyField="site_id"
            onRowClick={(site: Site) => navigate(`/dashboard/sites/${site.site_id}`)}
          />
        </div>
      </div>
    </motion.div>
  );
};
