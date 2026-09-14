import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { Patient, Visit, Deviation } from '../api/types';
import { StatCard, Timeline, EvidencePanel, SeverityBadge } from '../components';
import type { TimelineItem } from '../components/Timeline';
import { ArrowLeft, AlertTriangle, Check } from 'lucide-react';

export const PatientTimeline = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!patientId) return;
      setIsLoading(true);
      try {
        const [fetchedPatient, fetchedVisits, fetchedDeviations] = await Promise.all([
          api.getPatient(patientId),
          api.getPatientTimeline(patientId),
          api.getDeviations({ patient_id: patientId })
        ]);
        setPatient(fetchedPatient);
        setVisits(fetchedVisits);
        setDeviations(fetchedDeviations);
        
        if (fetchedVisits.length > 0) {
          setSelectedVisitId(fetchedVisits[0].visit_id);
        }
      } catch (error) {
        console.error("Failed to fetch patient data", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [patientId]);

  if (isLoading || !patient) {
    return <div className="flex items-center justify-center h-64 text-base-secondary">Loading patient timeline...</div>;
  }

  const patientDeviations = deviations.filter(d => d.patient_id === patient.patient_id);
  const protocolStatus = patientDeviations.length > 0 ? 'Attention' : 'On Track';

  const timelineItems: TimelineItem[] = visits.map((v) => {
    const hasDeviation = deviations.some(d => d.visit_id === v.visit_id);
    let status: 'Completed' | 'Pending' | 'Deviation' | 'Active' = v.status === 'Completed' ? 'Completed' : 'Pending';
    if (hasDeviation) status = 'Deviation';
    if (v.status === 'Active') status = 'Active';

    return {
      id: v.visit_id,
      title: v.visit_type,
      subtitle: v.expected_date,
      status,
      isActive: selectedVisitId === v.visit_id,
      onClick: () => setSelectedVisitId(v.visit_id)
    };
  });

  const selectedVisit = visits.find(v => v.visit_id === selectedVisitId);
  const selectedVisitDeviation = selectedVisit ? deviations.find(d => d.visit_id === selectedVisit.visit_id) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Section */}
      <button 
        onClick={() => navigate(-1)} 
        className="inline-flex items-center space-x-2 text-sm font-medium text-base-secondary hover:text-base-ink transition-colors mb-2"
      >
        <ArrowLeft size={16} />
        <span>Back</span>
      </button>
      
      <div className="border-b border-base-border pb-6">
        <div className="flex items-center space-x-3 mb-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">Patient</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-green-50 text-risk-low border border-risk-low/20">{patient.status}</span>
        </div>
        <h1 className="text-3xl font-semibold text-base-ink">{patient.patient_id}</h1>
      </div>

      {/* Patient Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Site" value={patient.site_id} className="p-4" />
        <StatCard title="Enrollment" value={new Date(patient.enrollment_date).toLocaleDateString()} className="p-4" />
        <StatCard title="Status" value={patient.eligibility_status} className="p-4" />
        <StatCard title="Current Visit" value={visits.filter(v => v.status === 'Completed').length} subtitle={`out of ${visits.length}`} className="p-4" />
        <StatCard 
          title="Protocol Status" 
          value={protocolStatus} 
          className={`p-4 ${protocolStatus === 'Attention' ? 'border-risk-medium/30' : ''}`} 
        />
      </div>

      {/* Clinical Timeline */}
      <div className="bg-base-card border border-base-border rounded-lg p-6 overflow-hidden">
        <h3 className="text-lg font-semibold mb-8">Clinical Timeline</h3>
        
        <Timeline 
          items={timelineItems} 
          orientation={isMobile ? 'vertical' : 'horizontal'} 
        />

        {/* Selected Visit Detail Card */}
        {selectedVisit && (
          <div className="mt-8 pt-8 border-t border-base-border animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex-1 space-y-6">
                <div>
                  <h3 className="text-xl font-semibold text-base-ink">{selectedVisit.visit_type}</h3>
                  <div className="flex items-center space-x-3 mt-2">
                    <span className="text-sm text-base-secondary">ID: {selectedVisit.visit_id}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                      selectedVisitDeviation ? 'bg-amber-50 text-risk-medium border-risk-medium/20' : 
                      selectedVisit.status === 'Completed' ? 'bg-green-50 text-risk-low border-risk-low/20' : 
                      'bg-slate-50 text-slate-500 border-slate-200'
                    }`}>
                      {selectedVisitDeviation ? 'Deviation' : selectedVisit.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-lg border border-base-border">
                    <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Expected Date</span>
                    <span className="font-medium text-sm text-base-ink">{new Date(selectedVisit.expected_date).toLocaleDateString()}</span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-lg border border-base-border">
                    <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Actual Date</span>
                    <span className="font-medium text-sm text-base-ink">{selectedVisit.actual_date ? new Date(selectedVisit.actual_date).toLocaleDateString() : '-'}</span>
                  </div>
                </div>

                {selectedVisitDeviation ? (
                  <div className="p-4 border border-risk-medium/30 bg-amber-50/30 rounded-lg space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle size={18} className="text-risk-medium" />
                        <h4 className="font-semibold text-risk-medium">Protocol Deviation Detected</h4>
                      </div>
                      <SeverityBadge level={selectedVisitDeviation.severity} />
                    </div>
                    
                    <div>
                      <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Rule Triggered</span>
                      <span className="font-mono text-sm text-base-ink">{selectedVisitDeviation.rule_id}</span>
                    </div>

                    <EvidencePanel 
                      expected={selectedVisitDeviation.expected} 
                      actual={selectedVisitDeviation.actual} 
                      severity={selectedVisitDeviation.severity} 
                      className="bg-white border-amber-200 shadow-sm"
                    />

                    <div>
                      <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Protocol Reference</span>
                      <span className="font-medium text-sm text-base-ink hover:underline cursor-pointer">Section 5.2</span>
                    </div>
                    
                    <button 
                      onClick={() => navigate('/deviations')}
                      className="text-sm font-medium text-risk-medium hover:text-amber-800 transition-colors"
                    >
                      View in Deviation Center &rarr;
                    </button>
                  </div>
                ) : (
                  <div className="p-4 border border-base-border bg-slate-50 rounded-lg">
                    <h4 className="font-medium text-base-ink flex items-center space-x-2">
                      <Check size={16} className="text-risk-low" />
                      <span>No deviations detected for this visit.</span>
                    </h4>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

