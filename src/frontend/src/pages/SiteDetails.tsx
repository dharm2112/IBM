import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/mock';
import type { Site, Deviation } from '../api/types';
import { DataTable, RiskBadge, SeverityBadge, AIBanner, DetailDrawer, EvidencePanel } from '../components';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react';

export const SiteDetails = () => {
  const { siteId } = useParams();
  const [site, setSite] = useState<Site | null>(null);
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDeviation, setSelectedDeviation] = useState<Deviation | null>(null);
  
  // AI State
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!siteId) return;
      setIsLoading(true);
      try {
        const [fetchedSite, fetchedDeviations] = await Promise.all([
          api.getSite(siteId),
          api.getDeviations({ site_id: siteId })
        ]);
        setSite(fetchedSite);
        setDeviations(fetchedDeviations);
      } catch (error) {
        console.error("Failed to fetch site data", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [siteId]);

  const handleAnalyzeRisk = async () => {
    if (!siteId) return;
    setIsAnalyzing(true);
    try {
      const result = await api.explainSite(siteId);
      setAiAnalysis(result);
    } catch (error) {
      console.error("AI Analysis failed", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading || !site) {
    return <div className="flex items-center justify-center h-64 text-base-secondary">Loading site details...</div>;
  }

  const deviationColumns = [
    { key: 'id', header: 'ID', render: (d: Deviation) => <span className="font-mono text-xs">{d.deviation_id}</span> },
    { key: 'patient', header: 'Patient', render: (d: Deviation) => d.patient_id },
    { key: 'rule', header: 'Rule', render: (d: Deviation) => d.rule_id },
    { key: 'category', header: 'Category', render: (d: Deviation) => d.category },
    { key: 'severity', header: 'Severity', render: (d: Deviation) => <SeverityBadge level={d.severity} /> },
    { key: 'status', header: 'Status', render: (d: Deviation) => <span className="text-xs font-medium px-2 py-1 bg-slate-100 rounded">{d.status}</span> },
  ];

  const riskDriversData = [
    { name: 'Dosing violations', value: 6, fill: '#111827' },
    { name: 'Missed safety visits', value: 4, fill: '#667085' },
    { name: 'Medication violations', value: 2, fill: '#98A2B3' },
    { name: 'Repeat deviations', value: 3, fill: '#DDE1E4' },
  ].sort((a, b) => b.value - a.value);

  const categoryBreakdownData = [
    { name: 'Dosing', value: 8, fill: '#6366F1' },
    { name: 'Visit', value: 5, fill: '#8B5CF6' },
    { name: 'Medication', value: 3, fill: '#EC4899' },
    { name: 'Laboratory', value: 2, fill: '#F43F5E' },
    { name: 'Procedural', value: 1, fill: '#F59E0B' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Section */}
      <Link to="/sites" className="inline-flex items-center space-x-2 text-sm font-medium text-base-secondary hover:text-base-ink transition-colors mb-2">
        <ArrowLeft size={16} />
        <span>Sites</span>
      </Link>
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-base-border pb-6">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <span className="font-mono text-sm text-base-secondary">{site.site_id}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">Active</span>
          </div>
          <h1 className="text-3xl font-semibold text-base-ink">{site.site_name}</h1>
          <p className="text-sm text-base-secondary mt-2">PI: {site.principal_investigator} &middot; {site.location}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <RiskBadge level={site.risk_level} className="text-sm px-3 py-1" />
          <div className="text-3xl font-semibold text-base-ink">
            {site.risk_score} <span className="text-base text-base-muted font-medium">/ 100</span>
          </div>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Risk Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-base-card border border-base-border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-6">Primary Risk Drivers</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={riskDriversData} margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 13, fill: '#111827' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                    {riskDriversData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-base-card border border-base-border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-6">Deviation Category Breakdown</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={categoryBreakdownData} margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 13, fill: '#111827' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                    {categoryBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">Recent Deviations</h3>
            <DataTable 
              data={deviations} 
              columns={deviationColumns} 
              keyField="deviation_id"
              onRowClick={(dev) => setSelectedDeviation(dev)}
            />
          </div>
        </div>

        {/* Right Column: AI Analysis */}
        <div className="space-y-6">
          <div className="bg-base-card border border-base-border rounded-lg overflow-hidden flex flex-col h-full">
            <div className="p-6 border-b border-base-border flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  <Sparkles size={16} className="text-ai-text" />
                  AI Risk Analysis
                </h3>
                <p className="text-xs text-base-secondary mt-1">IBM watsonx.ai</p>
              </div>
            </div>
            
            <div className="p-6 flex-1 flex flex-col">
              {!aiAnalysis && !isAnalyzing && (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                  <p className="text-base-ink font-medium mb-2">Why is this site high risk?</p>
                  <p className="text-sm text-base-secondary mb-6 max-w-[250px]">Generate a synthesized explanation of the primary risk drivers based on clinical evidence.</p>
                  <button 
                    onClick={handleAnalyzeRisk}
                    className="w-full py-2.5 bg-base-ink hover:bg-black text-white text-sm font-medium rounded-md transition-colors"
                  >
                    Analyze Risk
                  </button>
                </div>
              )}
              
              {isAnalyzing && (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-12 space-y-4">
                  <Loader2 className="w-8 h-8 text-ai-text animate-spin" />
                  <p className="text-sm font-medium text-base-secondary animate-pulse">Analyzing site evidence...</p>
                </div>
              )}

              {aiAnalysis && !isAnalyzing && (
                <AIBanner className="flex-1">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-semibold text-base-muted uppercase tracking-wider mb-2">Summary</h4>
                      <p className="text-sm text-base-ink leading-relaxed">
                        Site {site.site_id} is classified as HIGH risk primarily due to repeated dosing deviations and missed safety visits.
                      </p>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-semibold text-base-muted uppercase tracking-wider mb-2">Key Drivers</h4>
                      <ul className="text-sm text-base-ink space-y-1.5 list-disc pl-4 marker:text-base-muted">
                        <li>6 major dosing deviations</li>
                        <li>4 missed safety visits</li>
                        <li>2 prohibited medication events</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-semibold text-base-muted uppercase tracking-wider mb-2">Evidence</h4>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 bg-white border border-base-border rounded text-xs font-mono">DEV-0001</span>
                        <span className="px-2 py-1 bg-white border border-base-border rounded text-xs font-mono">DOSE-003</span>
                        <span className="px-2 py-1 bg-white border border-base-border rounded text-xs font-mono">P104-003</span>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-semibold text-base-muted uppercase tracking-wider mb-2">Recommended Focus</h4>
                      <p className="text-sm text-base-ink leading-relaxed">
                        Review the site's dosing administration workflow and safety-visit scheduling process.
                      </p>
                    </div>
                  </div>
                </AIBanner>
              )}
            </div>
          </div>
        </div>
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
            {/* Same drawer content as dashboard for consistency */}
            <div>
              <h3 className="text-sm font-semibold text-base-muted uppercase tracking-wider mb-3">Overview</h3>
              <p className="text-base text-base-ink">{selectedDeviation.description}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-base-border">
                <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Patient</span>
                <span className="font-medium text-sm">{selectedDeviation.patient_id}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-base-border">
                <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Rule</span>
                <span className="font-mono text-sm">{selectedDeviation.rule_id}</span>
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
          </div>
        )}
      </DetailDrawer>

    </div>
  );
};
