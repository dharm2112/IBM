import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Deviation } from '../api/types';
import { DataTable, SeverityBadge, StatCard, DetailDrawer, EvidencePanel } from '../components';
import { Search } from 'lucide-react';

export const DeviationCenter = () => {
  const navigate = useNavigate();
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDeviation, setSelectedDeviation] = useState<Deviation | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const fetched = await api.getDeviations();
        setDeviations(fetched);
      } catch (error) {
        console.error("Failed to fetch deviations", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredDeviations = deviations.filter(d => {
    const matchesSearch = 
      d.deviation_id.toLowerCase().includes(search.toLowerCase()) ||
      d.site_id.toLowerCase().includes(search.toLowerCase()) ||
      d.patient_id.toLowerCase().includes(search.toLowerCase()) ||
      d.rule_id.toLowerCase().includes(search.toLowerCase());
      
    const matchesSeverity = severityFilter === 'All' || d.severity === severityFilter;
    const matchesStatus = statusFilter === 'All' || d.status === statusFilter;
    const matchesCategory = categoryFilter === 'All' || d.category === categoryFilter;

    return matchesSearch && matchesSeverity && matchesStatus && matchesCategory;
  });

  const columns = [
    { key: 'id', header: 'Deviation ID', render: (d: Deviation) => <span className="font-mono text-xs font-semibold">{d.deviation_id}</span> },
    { key: 'site', header: 'Site', render: (d: Deviation) => d.site_id },
    { key: 'patient', header: 'Patient', render: (d: Deviation) => d.patient_id },
    { key: 'rule', header: 'Rule', render: (d: Deviation) => d.rule_id },
    { key: 'category', header: 'Category', render: (d: Deviation) => d.category },
    { key: 'severity', header: 'Severity', render: (d: Deviation) => <SeverityBadge level={d.severity} /> },
    { key: 'detected', header: 'Detected', render: (d: Deviation) => new Date(d.detected_at).toLocaleDateString() },
    { key: 'status', header: 'Status', render: (d: Deviation) => (
      <span className={`text-xs font-medium px-2 py-1 rounded border ${
        d.status === 'Open' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
        'bg-green-50 text-green-700 border-green-200'
      }`}>
        {d.status}
      </span>
    )},
  ];

  const totalDevs = deviations.length;
  const criticalDevs = deviations.filter(d => d.severity === 'CRITICAL').length;
  const majorDevs = deviations.filter(d => d.severity === 'MAJOR').length;
  const minorDevs = deviations.filter(d => d.severity === 'MINOR').length;
  const openDevs = deviations.filter(d => d.status === 'Open').length;

  if (isLoading && deviations.length === 0) {
    return <div className="flex items-center justify-center h-64 text-base-secondary">Loading deviations...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="border-b border-base-border pb-6">
        <h1 className="text-3xl font-semibold text-base-ink">Protocol Deviations</h1>
        <p className="text-sm text-base-secondary mt-2">
          <strong className="text-base-ink font-medium">{totalDevs} detected deviations.</strong> Review deviations detected by approved protocol rules.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Total" value={totalDevs} className="p-4" />
        <StatCard title="Critical" value={criticalDevs} className="p-4 border-risk-high/30" />
        <StatCard title="Major" value={majorDevs} className="p-4" />
        <StatCard title="Minor" value={minorDevs} className="p-4" />
        <StatCard title="Open" value={openDevs} className="p-4" />
      </div>

      {/* Filters Section */}
      <div className="bg-base-card border border-base-border rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-muted" size={16} />
            <input 
              type="text" 
              placeholder="Search deviation ID, site, patient or rule..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-base-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-base-ink/20 focus:border-base-ink transition-shadow"
            />
          </div>
          
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-base-secondary uppercase tracking-wider">Severity</span>
              <select 
                className="text-sm border border-base-border rounded-md bg-white py-1.5 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-base-ink/20 focus:border-base-ink"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
              >
                <option value="All">All</option>
                <option value="CRITICAL">Critical</option>
                <option value="MAJOR">Major</option>
                <option value="MINOR">Minor</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-base-secondary uppercase tracking-wider">Status</span>
              <select 
                className="text-sm border border-base-border rounded-md bg-white py-1.5 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-base-ink/20 focus:border-base-ink"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All</option>
                <option value="Open">Open</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-base-secondary uppercase tracking-wider">Category</span>
              <select 
                className="text-sm border border-base-border rounded-md bg-white py-1.5 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-base-ink/20 focus:border-base-ink"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="All">All</option>
                <option value="Visit Schedule">Visit Schedule</option>
                <option value="Dosing">Dosing</option>
                <option value="Eligibility">Eligibility</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <DataTable 
        data={filteredDeviations} 
        columns={columns} 
        keyField="deviation_id"
        onRowClick={(dev) => setSelectedDeviation(dev)}
      />

      {/* Detail Drawer */}
      <DetailDrawer
        isOpen={!!selectedDeviation}
        onClose={() => setSelectedDeviation(null)}
        title={
          <div className="flex items-center space-x-3">
            <span className="font-mono text-sm">{selectedDeviation?.deviation_id}</span>
            {selectedDeviation && <SeverityBadge level={selectedDeviation.severity} />}
            {selectedDeviation && (
              <span className="text-xs font-medium px-2 py-0.5 rounded border bg-slate-100 text-slate-700 border-slate-200">
                {selectedDeviation.status}
              </span>
            )}
          </div>
        }
      >
        {selectedDeviation && (
          <div className="space-y-8">
            <div>
              <h3 className="text-xs font-semibold text-base-muted uppercase tracking-wider mb-3">Overview</h3>
              <p className="text-sm text-base-ink leading-relaxed bg-slate-50 p-4 rounded-lg border border-base-border">
                {selectedDeviation.description}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div 
                className="p-4 bg-white rounded-lg border border-base-border shadow-sm cursor-pointer hover:border-base-ink transition-colors group"
                onClick={() => navigate(`/sites/${selectedDeviation.site_id}`)}
              >
                <span className="text-xs text-base-muted uppercase tracking-wider block mb-1 group-hover:text-base-ink transition-colors">Site</span>
                <span className="font-medium text-sm text-base-ink">{selectedDeviation.site_id}</span>
              </div>
              <div 
                className="p-4 bg-white rounded-lg border border-base-border shadow-sm cursor-pointer hover:border-base-ink transition-colors group"
                onClick={() => navigate(`/patients/${selectedDeviation.patient_id}`)}
              >
                <span className="text-xs text-base-muted uppercase tracking-wider block mb-1 group-hover:text-base-ink transition-colors">Patient</span>
                <span className="font-medium text-sm text-base-ink">{selectedDeviation.patient_id}</span>
              </div>
              <div className="p-4 bg-white rounded-lg border border-base-border shadow-sm">
                <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Visit</span>
                <span className="font-medium text-sm text-base-ink">{selectedDeviation.visit_id}</span>
              </div>
              <div className="p-4 bg-white rounded-lg border border-base-border shadow-sm">
                <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Rule</span>
                <span className="font-mono text-sm text-base-ink">{selectedDeviation.rule_id}</span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-base-muted uppercase tracking-wider mb-3">Evidence</h3>
              <EvidencePanel 
                expected={selectedDeviation.expected} 
                actual={selectedDeviation.actual} 
                severity={selectedDeviation.severity} 
              />
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-base-border pt-6">
              <div>
                <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Protocol Reference</span>
                <span className="font-medium text-sm text-base-ink hover:underline cursor-pointer">Section 5.2</span>
              </div>
              <div>
                <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Detected At</span>
                <span className="font-medium text-sm text-base-ink">{new Date(selectedDeviation.detected_at).toLocaleString()}</span>
              </div>
            </div>
            
            <div className="pt-8">
              <button 
                onClick={() => {
                  setSelectedDeviation(null);
                  navigate('/capa');
                }}
                className="w-full py-3 bg-base-ink hover:bg-black text-white text-sm font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-base-ink"
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
