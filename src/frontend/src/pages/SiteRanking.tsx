import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/mock';
import type { Site } from '../api/types';
import { DataTable, RiskBadge } from '../components';
import { Search, Calculator, LineChart as LineChartIcon } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

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
      setSites(fetchedSites.sort((a, b) => b.risk_score - a.risk_score));
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

  const columns = [
    { key: 'rank', header: 'Rank', render: (_: Site, index: number) => <span className="font-semibold text-base-muted">{index + 1}</span> },
    { key: 'id', header: 'Site', render: (s: Site) => (
      <div>
        <div className="font-medium text-base-ink">{s.site_name}</div>
        <div className="font-mono text-xs text-base-secondary mt-0.5">{s.site_id}</div>
      </div>
    ) },
    { key: 'location', header: 'Location', render: (s: Site) => s.location },
    { key: 'patients', header: 'Patients', render: (s: Site) => s.patient_count },
    // Mock deviations count for demo purposes (can be expanded later)
    { key: 'deviations', header: 'Deviations', render: () => Math.floor(Math.random() * 20) },
    { key: 'major', header: 'Major', render: () => <span className="text-risk-high font-medium">{Math.floor(Math.random() * 5)}</span> },
    { key: 'risk_score', header: 'Risk Score', render: (s: Site) => (
      <div className="w-32 flex items-center space-x-2">
        <span className="text-sm font-semibold w-8 text-right">{s.risk_score}</span>
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full ${s.risk_level === 'HIGH' ? 'bg-risk-high' : s.risk_level === 'MEDIUM' ? 'bg-risk-medium' : 'bg-risk-low'}`}
            style={{ width: `${s.risk_score}%` }}
          />
        </div>
      </div>
    ) },
    { key: 'risk_level', header: 'Level', render: (s: Site) => <RiskBadge level={s.risk_level} /> },
    { key: 'trend', header: 'Trend', render: (s: Site) => {
      // Generate a small dummy sparkline
      const data = Array.from({length: 5}, () => ({ v: Math.random() * 100 }));
      const color = s.risk_level === 'HIGH' ? '#EF4444' : s.risk_level === 'MEDIUM' ? '#F59E0B' : '#10B981';
      return (
        <div className="w-16 h-8">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    } },
  ];

  if (isLoading && sites.length === 0) {
    return <div className="flex items-center justify-center h-64 text-base-secondary">Loading site data...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-base-ink">Site Risk</h1>
          <p className="text-sm text-base-secondary mt-2">Prioritized view of clinical trial sites.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleRecalculate}
            disabled={isRecalculating}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-base-ink hover:bg-black rounded-md transition-colors disabled:opacity-50"
          >
            <Calculator size={16} className={isRecalculating ? "animate-spin" : ""} />
            <span>Recalculate Risk</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-1">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-muted" size={16} />
          <input 
            type="text" 
            placeholder="Search sites..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-base-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-base-ink/20 focus:border-base-ink transition-shadow"
          />
        </div>
        
        <div className="flex items-center space-x-2 bg-white border border-base-border rounded-md p-1">
          {(['ALL', 'LOW', 'MEDIUM', 'HIGH'] as const).map((risk) => (
            <button
              key={risk}
              onClick={() => setFilterRisk(risk)}
              className={`px-4 py-1.5 text-xs font-medium rounded transition-colors ${
                filterRisk === risk 
                  ? 'bg-slate-100 text-base-ink shadow-sm' 
                  : 'text-base-secondary hover:text-base-ink hover:bg-slate-50'
              }`}
            >
              {risk === 'ALL' ? 'All' : risk}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <DataTable 
        data={filteredSites} 
        columns={columns.map((col, index) => ({
          ...col,
          render: (row) => col.render(row, index)
        }))} 
        keyField="site_id"
        onRowClick={(site) => navigate(`/sites/${site.site_id}`)}
      />
    </div>
  );
};
