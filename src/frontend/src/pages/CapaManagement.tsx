import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Capa, Deviation } from '../api/types';
import type { Column } from '../components/DataTable';
import { DataTable, SeverityBadge, DetailDrawer, AIBanner } from '../components';
import { FileText, Loader2, Plus, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export const CAPAManagement = () => {
  const [capas, setCapas] = useState<Capa[]>([]);
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Drawer state
  const [selectedCapa, setSelectedCapa] = useState<Capa | null>(null);

  // Generate CAPA modal state
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [selectedDeviationId, setSelectedDeviationId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [fetchedCapas, fetchedDeviations] = await Promise.all([
        api.getCapas(),
        api.getDeviations()
      ]);
      setCapas(fetchedCapas);
      setDeviations(fetchedDeviations);
    } catch (err: any) {
      setError(err.message || 'Failed to load CAPA data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGenerateCapa = async () => {
    if (!selectedDeviationId) return;
    
    setIsGenerating(true);
    setError(null);
    try {
      const newCapa = await api.generateCapa(selectedDeviationId);
      setCapas(prev => [...prev, newCapa]);
      setIsGenerateModalOpen(false);
      setSelectedDeviationId('');
      setSelectedCapa(newCapa);
    } catch (err: any) {
      setError(err.message || 'Failed to generate CAPA. Watsonx may be unavailable.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = async (capa_id: string) => {
    try {
      await api.approveCapa(capa_id);
      setCapas(prev => prev.map(c => c.capa_id === capa_id ? { ...c, status: 'Approved' } : c));
      if (selectedCapa && selectedCapa.capa_id === capa_id) {
        setSelectedCapa({ ...selectedCapa, status: 'Approved' });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to approve CAPA.');
    }
  };

  const handleReject = async (capa_id: string) => {
    try {
      await api.rejectCapa(capa_id);
      setCapas(prev => prev.map(c => c.capa_id === capa_id ? { ...c, status: 'Rejected' } : c));
      if (selectedCapa && selectedCapa.capa_id === capa_id) {
        setSelectedCapa({ ...selectedCapa, status: 'Rejected' });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reject CAPA.');
    }
  };

  // Find deviation for a specific CAPA
  const getDeviationForCapa = (capa: Capa) => {
    return deviations.find(d => d.deviation_id === capa.deviation_id);
  };

  const columns: Column<Capa>[] = [
    { key: 'id', header: 'CAPA ID', render: (c: Capa) => <span className="font-mono text-sm">{c.capa_id}</span> },
    { key: 'deviation', header: 'Deviation', render: (c: Capa) => {
        const dev = getDeviationForCapa(c);
        return dev ? (
          <div>
            <div className="font-mono text-xs">{dev.deviation_id}</div>
            <div className="text-xs text-base-secondary truncate max-w-[150px]">{dev.category}</div>
          </div>
        ) : <span className="text-base-muted text-xs">Unknown</span>;
    }},
    { key: 'site', header: 'Site', render: (c: Capa) => {
        const dev = getDeviationForCapa(c);
        return dev ? <span className="text-sm">{dev.site_id}</span> : '-';
    }},
    { key: 'severity', header: 'Severity', render: (c: Capa) => {
        const dev = getDeviationForCapa(c);
        return dev ? <SeverityBadge level={dev.severity} /> : <span />;
    }},
    { key: 'title', header: 'Title', render: (c: Capa) => (
      <div className="truncate max-w-[200px] text-sm" title={c.title}>
        {c.ai_generated && <span className="mr-1.5 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">AI Draft</span>}
        {c.title}
      </div>
    )},
    { key: 'status', header: 'Status', render: (c: Capa) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        c.status === 'Approved' ? 'bg-green-100 text-green-800' :
        c.status === 'Rejected' ? 'bg-red-100 text-red-800' :
        c.status === 'Pending Review' || c.status === 'Draft' ? 'bg-amber-100 text-amber-800' :
        'bg-slate-100 text-slate-800'
      }`}>
        {c.status}
      </span>
    )},
  ];

  // Deviations available for new CAPAs (those that don't already have one attached)
  const availableDeviations = deviations.filter(d => !capas.find(c => c.deviation_id === d.deviation_id));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-base-ink">CAPA Management</h1>
          <p className="text-sm text-base-secondary mt-2">Generate and review Corrective and Preventive Actions.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setIsGenerateModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-base-ink hover:bg-black rounded-md transition-colors"
          >
            <Plus size={16} />
            <span>New CAPA</span>
          </button>
        </div>
      </div>

      <AIBanner>
        <div className="space-y-1">
          <h3 className="font-semibold text-sm text-ai-text">AI-Assisted CAPA Generation</h3>
          <p className="text-sm text-ai-text/80">
            Watsonx.ai drafts Corrective and Preventive Actions based on deterministic deviation data. AI does not determine severity. All AI drafts require human review and approval.
          </p>
        </div>
      </AIBanner>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center space-x-3">
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-base-secondary">Loading CAPA records...</div>
      ) : (
        <DataTable 
          data={capas} 
          columns={columns} 
          keyField="capa_id"
          onRowClick={(c: Capa) => setSelectedCapa(c)}
        />
      )}

      {/* Generate CAPA Modal */}
      {isGenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-base-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-base-ink">Generate CAPA with Watsonx</h2>
              <button 
                onClick={() => setIsGenerateModalOpen(false)}
                className="text-base-muted hover:text-base-ink transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              <p className="text-sm text-base-secondary mb-4">
                Select a deviation to generate a draft CAPA. The AI will analyze the deviation details, expected protocol, and severity (determined by the rules engine) to propose root causes and corrective actions.
              </p>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-base-ink block">Select Deviation</label>
                <select 
                  className="w-full border border-base-border rounded-md p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-base-ink/20"
                  value={selectedDeviationId}
                  onChange={(e) => setSelectedDeviationId(e.target.value)}
                >
                  <option value="">-- Choose a deviation --</option>
                  {availableDeviations.map(d => (
                    <option key={d.deviation_id} value={d.deviation_id}>
                      {d.deviation_id} - {d.category} (Site: {d.site_id})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-base-border bg-slate-50 rounded-b-xl flex justify-end space-x-3">
              <button 
                onClick={() => setIsGenerateModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-base-ink bg-white border border-base-border rounded-md hover:bg-slate-50 transition-colors"
                disabled={isGenerating}
              >
                Cancel
              </button>
              <button 
                onClick={handleGenerateCapa}
                disabled={!selectedDeviationId || isGenerating}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-base-ink hover:bg-black rounded-md transition-colors disabled:opacity-50"
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                <span>{isGenerating ? 'Generating...' : 'Generate CAPA'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAPA Detail Drawer */}
      <DetailDrawer 
        isOpen={!!selectedCapa} 
        onClose={() => setSelectedCapa(null)}
        title={
          <div className="flex items-center space-x-3">
            <span className="font-mono text-sm">{selectedCapa?.capa_id}</span>
            {selectedCapa?.status === 'Draft' && (
              <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded font-medium border border-amber-200">
                Draft - Review Required
              </span>
            )}
            {selectedCapa?.status === 'Approved' && (
              <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded font-medium border border-green-200 flex items-center space-x-1">
                <CheckCircle size={12} />
                <span>Approved</span>
              </span>
            )}
          </div>
        }
      >
        {selectedCapa && (
          <div className="space-y-6">
            {selectedCapa.ai_generated && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start space-x-3">
                <FileText className="text-purple-600 mt-0.5 flex-shrink-0" size={18} />
                <div>
                  <h4 className="text-sm font-medium text-purple-900">AI-Generated Draft</h4>
                  <p className="text-xs text-purple-700 mt-1">
                    This CAPA was generated by Watsonx.ai based on deterministic severity. Human approval is required before it can be closed.
                  </p>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-xl font-semibold text-base-ink mb-2">{selectedCapa.title}</h3>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="p-4 bg-slate-50 rounded-lg border border-base-border">
                  <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Status</span>
                  <span className="font-medium text-sm">{selectedCapa.status}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-base-border">
                  <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Owner Role</span>
                  <span className="font-medium text-sm">{selectedCapa.owner_role}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-base-border pt-6">
              <h3 className="text-sm font-semibold text-base-muted uppercase tracking-wider mb-4">Investigation & Plan</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-base-ink mb-1">Root Cause Hypothesis</h4>
                  <p className="text-sm text-base-secondary bg-slate-50 p-3 rounded border border-base-border/50">
                    {selectedCapa.root_cause_hypothesis}
                  </p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-base-ink mb-1">Immediate Corrective Action</h4>
                  <p className="text-sm text-base-secondary bg-slate-50 p-3 rounded border border-base-border/50">
                    {selectedCapa.immediate_action}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-base-ink mb-1">Preventive Action</h4>
                  <p className="text-sm text-base-secondary bg-slate-50 p-3 rounded border border-base-border/50">
                    {selectedCapa.preventive_action}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-base-ink mb-1">Effectiveness Check</h4>
                  <p className="text-sm text-base-secondary bg-slate-50 p-3 rounded border border-base-border/50">
                    {selectedCapa.verification_method}
                  </p>
                </div>
              </div>
            </div>

            {selectedCapa.requires_human_approval && (selectedCapa.status === 'Draft' || selectedCapa.status === 'Pending Review') && (
              <div className="border-t border-base-border pt-6 mt-6">
                <h3 className="text-sm font-semibold text-base-muted uppercase tracking-wider mb-3">Human Review</h3>
                <div className="flex space-x-3">
                  <button 
                    onClick={() => handleApprove(selectedCapa.capa_id)}
                    className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
                  >
                    Approve CAPA
                  </button>
                  <button 
                    onClick={() => handleReject(selectedCapa.capa_id)}
                    className="flex-1 py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium rounded-md transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};
