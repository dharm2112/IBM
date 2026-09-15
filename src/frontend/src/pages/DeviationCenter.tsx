import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { api } from '../api/client';
import type { Deviation } from '../api/types';
import { DataTable, SeverityBadge, StatCard, DetailDrawer, EvidencePanel } from '../components';
import { Search } from 'lucide-react';

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
    { key: 'id', header: 'Deviation ID', render: (d: Deviation) => <span style={{ fontFamily: 'SF Mono, monospace', fontSize: '11px', color: T.text, fontWeight: 500 }}>{d.deviation_id}</span> },
    { key: 'site', header: 'Site', render: (d: Deviation) => <span style={{ fontSize: '13px', color: T.sub }}>{d.site_id}</span> },
    { key: 'patient', header: 'Patient', render: (d: Deviation) => <span style={{ fontSize: '13px', color: T.sub }}>{d.patient_id}</span> },
    { key: 'rule', header: 'Rule', render: (d: Deviation) => <span style={{ fontFamily: 'SF Mono, monospace', fontSize: '11px', color: T.sub }}>{d.rule_id}</span> },
    { key: 'category', header: 'Category', render: (d: Deviation) => <span style={{ fontSize: '13px', color: T.text }}>{d.category}</span> },
    { key: 'severity', header: 'Severity', render: (d: Deviation) => <SeverityBadge level={d.severity} /> },
    { key: 'detected', header: 'Detected', render: (d: Deviation) => <span style={{ fontSize: '13px', color: T.sub }}>{new Date(d.detected_at).toLocaleDateString()}</span> },
    { key: 'status', header: 'Status', render: (d: Deviation) => (
      <span style={{ 
        fontSize: '10px', 
        fontWeight: 500, 
        padding: '2px 8px', 
        borderRadius: 10,
        textTransform: 'capitalize',
        background: d.status === 'Open' ? '#FFF8E6' : '#E6F4EA',
        color: d.status === 'Open' ? '#B26B00' : '#137333',
      }}>
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
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 250, color: T.sub, fontSize: '13px' }}>Loading deviations...</div>;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: -40 }} // Pull up to match layout
    >
      {/* Header Section */}
      <div style={{ paddingBottom: 24, borderBottom: `1px solid ${T.border}` }}>

        <p style={{ fontSize: '13px', color: T.sub, margin: '8px 0 0 0' }}>
          <strong style={{ color: T.text, fontWeight: 500 }}>{totalDevs} detected deviations.</strong> Review deviations detected by approved protocol rules.
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
        <StatCard title="Total" value={totalDevs} />
        <StatCard title="Critical" value={criticalDevs} style={criticalDevs > 0 ? { border: `1px solid rgba(255,59,48,0.3)` } : {}} />
        <StatCard title="Major" value={majorDevs} />
        <StatCard title="Minor" value={minorDevs} />
        <StatCard title="Open" value={openDevs} />
      </div>

      {/* Filters & Table Section */}
      <div style={{ background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`, padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: 400 }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.muted }} size={16} />
            <input 
              type="text" 
              placeholder="Search deviation ID, site, patient or rule..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', padding: '0 16px 0 36px', height: 36, fontSize: '13px', border: 'none', background: T.surface2, borderRadius: 10, color: T.text, outline: 'none' }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Severity</span>
              <select 
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                style={{ height: 36, padding: '0 32px 0 12px', fontSize: '13px', background: T.surface2, border: 'none', borderRadius: 8, color: T.text, outline: 'none', appearance: 'none' }}
              >
                <option value="All">All</option>
                <option value="CRITICAL">Critical</option>
                <option value="MAJOR">Major</option>
                <option value="MINOR">Minor</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</span>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ height: 36, padding: '0 32px 0 12px', fontSize: '13px', background: T.surface2, border: 'none', borderRadius: 8, color: T.text, outline: 'none', appearance: 'none' }}
              >
                <option value="All">All</option>
                <option value="Open">Open</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Category</span>
              <select 
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ height: 36, padding: '0 32px 0 12px', fontSize: '13px', background: T.surface2, border: 'none', borderRadius: 8, color: T.text, outline: 'none', appearance: 'none' }}
              >
                <option value="All">All</option>
                <option value="Visit Schedule">Visit Schedule</option>
                <option value="Dosing">Dosing</option>
                <option value="Eligibility">Eligibility</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ margin: '0 -20px -20px -20px' }}>
          <DataTable 
            data={filteredDeviations} 
            columns={columns} 
            keyField="deviation_id"
            onRowClick={(dev) => setSelectedDeviation(dev)}
          />
        </div>
      </div>

      {/* Detail Drawer */}
      <DetailDrawer
        isOpen={!!selectedDeviation}
        onClose={() => setSelectedDeviation(null)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: 'SF Mono, monospace', fontSize: '14px', color: T.text, fontWeight: 600 }}>{selectedDeviation?.deviation_id}</span>
            {selectedDeviation && <SeverityBadge level={selectedDeviation.severity} />}
            {selectedDeviation && (
              <span style={{ 
                fontSize: '10px', 
                fontWeight: 600, 
                padding: '2px 8px', 
                borderRadius: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                background: T.surface2,
                color: T.sub,
              }}>
                {selectedDeviation.status}
              </span>
            )}
          </div>
        }
      >
        {selectedDeviation && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 24 }}>
            <div>
              <h3 style={{ fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px 0' }}>Overview</h3>
              <p style={{ fontSize: '13px', color: T.text, lineHeight: 1.5, margin: 0, padding: 16, background: T.surface2, borderRadius: 12 }}>
                {selectedDeviation.description}
              </p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div 
                style={{ padding: '12px 16px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, cursor: 'pointer', transition: 'border-color 0.2s' }}
                onClick={() => navigate(`/dashboard/sites/${selectedDeviation.site_id}`)}
                onMouseOver={(e) => e.currentTarget.style.borderColor = T.muted}
                onMouseOut={(e) => e.currentTarget.style.borderColor = T.border}
              >
                <span style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Site</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: T.text }}>{selectedDeviation.site_id}</span>
              </div>
              <div 
                style={{ padding: '12px 16px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, cursor: 'pointer', transition: 'border-color 0.2s' }}
                onClick={() => navigate(`/dashboard/patients/${selectedDeviation.patient_id}`)}
                onMouseOver={(e) => e.currentTarget.style.borderColor = T.muted}
                onMouseOut={(e) => e.currentTarget.style.borderColor = T.border}
              >
                <span style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Patient</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: T.text }}>{selectedDeviation.patient_id}</span>
              </div>
              <div style={{ padding: '12px 16px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12 }}>
                <span style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Visit</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: T.text }}>{selectedDeviation.visit_id}</span>
              </div>
              <div style={{ padding: '12px 16px', background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12 }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, paddingTop: 24, borderTop: `1px solid ${T.border}` }}>
              <div>
                <span style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Protocol Reference</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: T.text, textDecoration: 'underline', cursor: 'pointer' }}>Section 5.2</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Detected At</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: T.text }}>{new Date(selectedDeviation.detected_at).toLocaleString()}</span>
              </div>
            </div>
            
            <div style={{ paddingTop: 32 }}>
              <button 
                onClick={() => {
                  setSelectedDeviation(null);
                  navigate('/dashboard/capa');
                }}
                style={{ width: '100%', padding: '0 16px', height: 36, background: T.accent, color: '#fff', border: 'none', borderRadius: 10, fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
              >
                Generate CAPA
              </button>
            </div>
          </div>
        )}
      </DetailDrawer>

    </motion.div>
  );
};
