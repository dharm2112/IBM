import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Site, Deviation } from '../api/types';
import { DataTable, RiskBadge, SeverityBadge, AIBanner, DetailDrawer, EvidencePanel } from '../components';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

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
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 250, color: T.sub, fontSize: '13px' }}>Loading site details...</div>;
  }

  const deviationColumns = [
    { key: 'id', header: 'ID', render: (d: Deviation) => <span style={{ fontFamily: 'SF Mono, monospace', fontSize: '11px', color: T.text, fontWeight: 500 }}>{d.deviation_id}</span> },
    { key: 'patient', header: 'Patient', render: (d: Deviation) => <span style={{ fontSize: '13px', color: T.sub }}>{d.patient_id}</span> },
    { key: 'rule', header: 'Rule', render: (d: Deviation) => <span style={{ fontFamily: 'SF Mono, monospace', fontSize: '11px', color: T.sub }}>{d.rule_id}</span> },
    { key: 'category', header: 'Category', render: (d: Deviation) => <span style={{ fontSize: '13px', color: T.text }}>{d.category}</span> },
    { key: 'severity', header: 'Severity', render: (d: Deviation) => <SeverityBadge level={d.severity} /> },
    { key: 'status', header: 'Status', render: (d: Deviation) => <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 8px', background: T.surface2, borderRadius: 10, color: T.text, textTransform: 'capitalize' }}>{d.status}</span> },
  ];

  const riskDriversData = [
    { name: 'Dosing violations', value: 6, fill: T.accent },
    { name: 'Missed safety visits', value: 4, fill: T.sub },
    { name: 'Medication violations', value: 2, fill: T.muted },
    { name: 'Repeat deviations', value: 3, fill: '#DDE1E4' },
  ].sort((a, b) => b.value - a.value);

  const categoryBreakdownData = [
    { name: 'Dosing', value: 8, fill: T.accent },
    { name: 'Visit', value: 5, fill: '#8B5CF6' },
    { name: 'Medication', value: 3, fill: '#EC4899' },
    { name: 'Laboratory', value: 2, fill: '#F43F5E' },
    { name: 'Procedural', value: 1, fill: T.amber },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: -40 }} // Pull up to match layout
    >
      {/* Header Section */}
      <div>
        <Link to="/dashboard/sites" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '13px', fontWeight: 500, color: T.sub, textDecoration: 'none', marginBottom: 8 }}>
          <ArrowLeft size={14} />
          <span>Sites</span>
        </Link>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, borderBottom: `1px solid ${T.border}`, paddingBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <span style={{ fontFamily: 'SF Mono, monospace', fontSize: '13px', color: T.sub }}>{site.site_id}</span>
              <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: T.surface2, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Active</span>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 600, color: T.text, margin: 0, letterSpacing: '-0.01em' }}>{site.site_name}</h1>
            <p style={{ fontSize: '13px', color: T.sub, margin: '6px 0 0 0' }}>PI: {site.principal_investigator} &middot; {site.location}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <RiskBadge level={site.risk_level} className="text-sm px-3 py-1" />
            <div style={{ fontSize: '34px', fontWeight: 300, color: T.text, letterSpacing: '-0.02em', lineHeight: 1 }}>
              {site.risk_score} <span style={{ fontSize: '16px', color: T.muted, fontWeight: 500 }}>/ 100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        
        {/* Left Column: Risk Breakdown */}
        <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 500, color: T.text, margin: '0 0 24px 0', letterSpacing: '-0.01em' }}>Primary Risk Drivers</h3>
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={riskDriversData} margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 13, fill: T.text }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: T.surface2 }} contentStyle={{ borderRadius: 8, border: `1px solid ${T.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                    {riskDriversData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 500, color: T.text, margin: '0 0 24px 0', letterSpacing: '-0.01em' }}>Deviation Category Breakdown</h3>
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={categoryBreakdownData} margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 13, fill: T.text }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: T.surface2 }} contentStyle={{ borderRadius: 8, border: `1px solid ${T.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                    {categoryBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div style={{ marginTop: 8 }}>
            <h3 style={{ fontSize: '18px', fontWeight: 500, color: T.text, margin: '0 0 16px 0', letterSpacing: '-0.01em' }}>Recent Deviations</h3>
            <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
              <DataTable 
                data={deviations} 
                columns={deviationColumns} 
                keyField="deviation_id"
                onRowClick={(dev) => setSelectedDeviation(dev)}
              />
            </div>
          </div>
        </div>

        {/* Right Column: AI Analysis */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${T.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.surface }}>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: T.text, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={16} color={T.accent} />
                  AI Risk Analysis
                </h3>
                <p style={{ fontSize: '11px', color: T.sub, margin: '4px 0 0 0' }}>IBM watsonx.ai</p>
              </div>
            </div>
            
            <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              {!aiAnalysis && !isAnalyzing && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 0' }}>
                  <p style={{ fontSize: '14px', fontWeight: 500, color: T.text, margin: '0 0 8px 0' }}>Why is this site high risk?</p>
                  <p style={{ fontSize: '13px', color: T.sub, margin: '0 0 24px 0', maxWidth: 250, lineHeight: 1.5 }}>Generate a synthesized explanation of the primary risk drivers based on clinical evidence.</p>
                  <button 
                    onClick={handleAnalyzeRisk}
                    style={{ width: '100%', height: 36, background: T.accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
                  >
                    Analyze Risk
                  </button>
                </div>
              )}
              
              {isAnalyzing && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 0', gap: 16 }}>
                  <Loader2 size={32} color={T.accent} style={{ animation: 'spin 1s linear infinite' }} />
                  <p style={{ fontSize: '13px', fontWeight: 500, color: T.sub, animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>Analyzing site evidence...</p>
                </div>
              )}

              {aiAnalysis && !isAnalyzing && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div>
                    <h4 style={{ fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px 0' }}>Summary</h4>
                    <p style={{ fontSize: '13px', color: T.text, lineHeight: 1.5, margin: 0 }}>
                      Site {site.site_id} is classified as HIGH risk primarily due to repeated dosing deviations and missed safety visits.
                    </p>
                  </div>
                  
                  <div>
                    <h4 style={{ fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px 0' }}>Key Drivers</h4>
                    <ul style={{ fontSize: '13px', color: T.text, margin: 0, paddingLeft: 16, lineHeight: 1.6 }}>
                      <li>6 major dosing deviations</li>
                      <li>4 missed safety visits</li>
                      <li>2 prohibited medication events</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 style={{ fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px 0' }}>Evidence</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <span style={{ padding: '2px 8px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: '11px', fontFamily: 'SF Mono, monospace', color: T.text }}>DEV-0001</span>
                      <span style={{ padding: '2px 8px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: '11px', fontFamily: 'SF Mono, monospace', color: T.text }}>DOSE-003</span>
                      <span style={{ padding: '2px 8px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, fontSize: '11px', fontFamily: 'SF Mono, monospace', color: T.text }}>P104-003</span>
                    </div>
                  </div>
                  
                  <div>
                    <h4 style={{ fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px 0' }}>Recommended Focus</h4>
                    <p style={{ fontSize: '13px', color: T.text, lineHeight: 1.5, margin: 0 }}>
                      Review the site's dosing administration workflow and safety-visit scheduling process.
                    </p>
                  </div>
                </div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: 'SF Mono, monospace', fontSize: '14px', color: T.text, fontWeight: 600 }}>{selectedDeviation?.deviation_id}</span>
            {selectedDeviation && <SeverityBadge level={selectedDeviation.severity} />}
          </div>
        }
      >
        {selectedDeviation && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 24 }}>
            <div>
              <h3 style={{ fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px 0' }}>Overview</h3>
              <p style={{ fontSize: '13px', color: T.text, lineHeight: 1.5, margin: 0 }}>{selectedDeviation.description}</p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ padding: '12px 16px', background: T.surface2, borderRadius: 12 }}>
                <span style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Patient</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: T.text }}>{selectedDeviation.patient_id}</span>
              </div>
              <div style={{ padding: '12px 16px', background: T.surface2, borderRadius: 12 }}>
                <span style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Rule</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: T.text, fontFamily: 'SF Mono, monospace' }}>{selectedDeviation.rule_id}</span>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px 0' }}>Evidence</h3>
              <EvidencePanel 
                expected={selectedDeviation.expected} 
                actual={selectedDeviation.actual} 
                severity={selectedDeviation.severity} 
              />
            </div>
          </div>
        )}
      </DetailDrawer>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </motion.div>
  );
};
