import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/mock';
import type { Site, Deviation } from '../api/types';
import { StatCard, DataTable, RiskBadge, SeverityBadge, DetailDrawer, EvidencePanel } from '../components';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { RefreshCw, Calculator, ArrowRight } from 'lucide-react';

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
      const [fetchedSites, fetchedDeviations] = await Promise.all([
        api.getSites(),
        api.getDeviations()
      ]);
      setSites(fetchedSites);
      setDeviations(fetchedDeviations);
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
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

  if (isLoading && sites.length === 0) {
    return <div className="flex items-center justify-center h-64 text-base-secondary">Loading dashboard data...</div>;
  }

  const highRiskSites = sites.filter(s => s.risk_level === 'HIGH').length;
  const majorDeviations = deviations.filter(d => d.severity === 'MAJOR' || d.severity === 'CRITICAL').length;
  const topSites = [...sites].sort((a, b) => b.risk_score - a.risk_score).slice(0, 5);

  const riskDistribution = [
    { name: 'LOW', value: sites.filter(s => s.risk_level === 'LOW').length, color: '#10B981' },
    { name: 'MEDIUM', value: sites.filter(s => s.risk_level === 'MEDIUM').length, color: '#F59E0B' },
    { name: 'HIGH', value: sites.filter(s => s.risk_level === 'HIGH').length, color: '#EF4444' },
  ];

  const trendData = [
    { name: 'Week 1', deviations: 12 },
    { name: 'Week 2', deviations: 18 },
    { name: 'Week 3', deviations: 15 },
    { name: 'Week 4', deviations: deviations.length },
  ];

  const deviationColumns = [
    { key: 'id', header: 'Deviation ID', render: (d: Deviation) => <span className="font-mono text-xs">{d.deviation_id}</span> },
    { key: 'site', header: 'Site', render: (d: Deviation) => d.site_id },
    { key: 'patient', header: 'Patient', render: (d: Deviation) => d.patient_id },
    { key: 'rule', header: 'Rule', render: (d: Deviation) => d.rule_id },
    { key: 'category', header: 'Category', render: (d: Deviation) => d.category },
    { key: 'severity', header: 'Severity', render: (d: Deviation) => <SeverityBadge level={d.severity} /> },
    { key: 'status', header: 'Status', render: (d: Deviation) => <span className="text-xs font-medium px-2 py-1 bg-slate-100 rounded">{d.status}</span> },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-base-ink">Executive Dashboard</h1>
          <p className="text-sm text-base-secondary mt-2">Clinical trial monitoring overview.</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <span className="text-xs text-base-muted">Last updated 2 min ago</span>
          <div className="flex items-center space-x-3">
            <button 
              onClick={fetchData} 
              disabled={isLoading}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-base-ink bg-white border border-base-border hover:bg-slate-50 rounded-md transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
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
      </div>

      {/* Trial Health Banner */}
      {highRiskSites > 0 && (
        <div className="bg-risk-high/10 border border-risk-high/20 rounded-lg p-4 flex items-start space-x-3">
          <div className="p-2 bg-risk-high rounded-full text-white shrink-0">
            <span className="font-bold text-xs uppercase">Attention</span>
          </div>
          <div>
            <h3 className="font-semibold text-risk-high">Trial Health</h3>
            <p className="text-sm text-base-ink mt-0.5">{highRiskSites} site{highRiskSites > 1 ? 's require' : ' requires'} investigation due to elevated risk scores.</p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Sites" value={sites.length} subtitle="Across the trial" />
        <StatCard title="Patients" value={100} subtitle="Active participants" />
        <StatCard title="Protocol Deviations" value={deviations.length} subtitle={`${majorDeviations} major/critical`} />
        <StatCard title="High-Risk Sites" value={highRiskSites} subtitle="Requires attention" trend="up" className="border-risk-high/30" />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-base-card border border-base-border rounded-lg p-6 flex flex-col">
          <h3 className="text-lg font-semibold mb-6">Risk Distribution</h3>
          <div className="flex-1 flex items-center justify-center relative min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskDistribution} innerRadius={60} outerRadius={80} dataKey="value" stroke="none">
                  {riskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-semibold text-base-ink">{sites.length}</span>
              <span className="text-xs text-base-secondary">Sites</span>
            </div>
          </div>
          <div className="flex justify-center space-x-4 mt-4">
            {riskDistribution.map(d => (
              <div key={d.name} className="flex items-center space-x-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></div>
                <span className="text-xs font-medium text-base-secondary">{d.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-base-card border border-base-border rounded-lg p-6 lg:col-span-2 flex flex-col">
          <h3 className="text-lg font-semibold mb-6">Deviation Trend</h3>
          <div className="flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#667085' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#667085' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Line type="monotone" dataKey="deviations" stroke="#111827" strokeWidth={3} dot={{ r: 4, fill: '#111827', strokeWidth: 2, stroke: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Risk Sites */}
      <div className="bg-base-card border border-base-border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Top Risk Sites</h3>
        <div className="space-y-4">
          {topSites.map((site) => (
            <div key={site.site_id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg group transition-colors">
              <div className="flex items-center space-x-6 flex-1">
                <div className="w-24">
                  <span className="font-mono text-xs text-base-secondary">{site.site_id}</span>
                </div>
                <div className="flex-1 font-medium">{site.site_name}</div>
                <div className="w-32 flex items-center space-x-2">
                  <span className="text-sm font-semibold w-8">{site.risk_score}</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${site.risk_level === 'HIGH' ? 'bg-risk-high' : site.risk_level === 'MEDIUM' ? 'bg-risk-medium' : 'bg-risk-low'}`}
                      style={{ width: `${site.risk_score}%` }}
                    />
                  </div>
                </div>
                <div className="w-24">
                  <RiskBadge level={site.risk_level} />
                </div>
              </div>
              <button 
                onClick={() => navigate(`/sites/${site.site_id}`)}
                className="opacity-0 group-hover:opacity-100 p-2 text-base-secondary hover:text-base-ink transition-all"
              >
                <ArrowRight size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Deviations */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Recent Protocol Deviations</h3>
        <DataTable 
          data={deviations.slice(0, 5)} 
          columns={deviationColumns} 
          keyField="deviation_id"
          onRowClick={(dev) => setSelectedDeviation(dev)}
        />
      </div>

      {/* Detail Drawer for Deviation */}
      <DetailDrawer
        isOpen={!!selectedDeviation}
        onClose={() => setSelectedDeviation(null)}
        title={
          <div className="flex items-center space-x-3">
            <span className="font-mono text-sm">{selectedDeviation?.deviation_id}</span>
            {selectedDeviation && <SeverityBadge level={selectedDeviation.severity} />}
          </div>
        }
      >
        {selectedDeviation && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-base-muted uppercase tracking-wider mb-3">Overview</h3>
              <p className="text-base text-base-ink">{selectedDeviation.description}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-base-border">
                <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Site</span>
                <span className="font-medium text-sm">{selectedDeviation.site_id}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-base-border">
                <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Patient</span>
                <span className="font-medium text-sm">{selectedDeviation.patient_id}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-base-border">
                <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Rule</span>
                <span className="font-mono text-sm">{selectedDeviation.rule_id}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-base-border">
                <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Category</span>
                <span className="font-medium text-sm">{selectedDeviation.category}</span>
              </div>
            </div>

            <div className="pt-4">
              <h3 className="text-sm font-semibold text-base-muted uppercase tracking-wider mb-3">Evidence</h3>
              <EvidencePanel 
                expected={selectedDeviation.expected} 
                actual={selectedDeviation.actual} 
                severity={selectedDeviation.severity} 
              />
            </div>
            
            <div className="pt-4">
              <button 
                onClick={() => {
                  setSelectedDeviation(null);
                  navigate('/capa');
                }}
                className="w-full py-2.5 bg-base-ink hover:bg-black text-white text-sm font-medium rounded-md transition-colors"
              >
                Generate CAPA
              </button>
            </div>
          </div>
        )}
      </DetailDrawer>

    </div>
  );
};
