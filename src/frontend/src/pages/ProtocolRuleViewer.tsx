import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { ProtocolRule } from '../api/types';
import type { Column } from '../components/DataTable';
import { DataTable, SeverityBadge, DetailDrawer, AIBanner } from '../components';
import { Loader2, Upload, AlertTriangle, CheckCircle, XCircle, Shield, Link as LinkIcon } from 'lucide-react';

export const ProtocolRuleViewer = () => {
  const [rules, setRules] = useState<ProtocolRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Drawer state
  const [selectedRule, setSelectedRule] = useState<ProtocolRule | null>(null);

  // Extract Rules modal state
  const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractMode, setExtractMode] = useState<'text' | 'file'>('text');
  const [protocolText, setProtocolText] = useState('');
  const [protocolFile, setProtocolFile] = useState<File | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedRules = await api.getProtocolRules();
      setRules(fetchedRules);
    } catch (err: any) {
      setError(err.message || 'Failed to load protocol rules.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExtract = async () => {
    let fileToUpload: File | null = null;

    if (extractMode === 'file' && protocolFile) {
      fileToUpload = protocolFile;
    } else if (extractMode === 'text' && protocolText.trim()) {
      // Create a blob file from the text input to send to the uploadProtocol function
      // which expects a File object.
      fileToUpload = new File([protocolText], "pasted_protocol.txt", { type: "text/plain" });
    }

    if (!fileToUpload) {
      setError("Please provide protocol text or a PDF file.");
      return;
    }
    
    setIsExtracting(true);
    setError(null);
    try {
      // client.ts returns an array of rules now
      const newRules = await api.uploadProtocol(fileToUpload) as unknown as ProtocolRule[];
      
      // Merge new rules and old rules
      setRules(prev => [...newRules, ...prev]);
      
      setIsExtractModalOpen(false);
      setProtocolText('');
      setProtocolFile(null);
      // Automatically open the drawer for the first extracted rule
      if (newRules.length > 0) {
        setSelectedRule(newRules[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to extract protocol. Watsonx may be unavailable.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleApprove = async (rule_id: string) => {
    try {
      await api.approveProtocolRule(rule_id);
      setRules(prev => prev.map(r => r.rule_id === rule_id ? { ...r, approval_status: 'APPROVED' } : r));
      if (selectedRule && selectedRule.rule_id === rule_id) {
        setSelectedRule({ ...selectedRule, approval_status: 'APPROVED' });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to approve rule.');
    }
  };

  const handleReject = async (rule_id: string) => {
    try {
      await api.rejectProtocolRule(rule_id);
      setRules(prev => prev.map(r => r.rule_id === rule_id ? { ...r, approval_status: 'REJECTED' } : r));
      if (selectedRule && selectedRule.rule_id === rule_id) {
        setSelectedRule({ ...selectedRule, approval_status: 'REJECTED' });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reject rule.');
    }
  };

  // Helper for confidence badge
  const renderConfidenceBadge = (confidence?: string) => {
    if (!confidence) return null;
    const lower = confidence.toLowerCase();
    
    let colorClass = 'bg-slate-100 text-slate-800';
    if (lower.includes('high')) colorClass = 'bg-green-100 text-green-800';
    else if (lower.includes('medium')) colorClass = 'bg-amber-100 text-amber-800';
    else if (lower.includes('low')) colorClass = 'bg-red-100 text-red-800';
    
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
        {confidence}
      </span>
    );
  };

  const columns: Column<ProtocolRule>[] = [
    { key: 'id', header: 'Rule ID', render: (r: ProtocolRule) => <span className="font-mono text-xs">{r.rule_id}</span> },
    { key: 'category', header: 'Category', render: (r: ProtocolRule) => (
      <span className="font-medium text-sm text-base-ink">{r.category}</span>
    )},
    { key: 'description', header: 'Description', render: (r: ProtocolRule) => (
      <div className="truncate max-w-[250px] text-sm" title={r.description}>
        {r.description}
      </div>
    )},
    { key: 'visit', header: 'Visit', render: (r: ProtocolRule) => (
      <span className="text-sm text-base-secondary">{r.visit || '-'}</span>
    )},
    { key: 'severity_hint', header: 'Severity Hint', render: (r: ProtocolRule) => (
      r.severity ? <SeverityBadge level={r.severity} /> : (r.severity_hint ? <span className="text-xs uppercase bg-slate-100 px-2 py-1 rounded">{r.severity_hint}</span> : <span>-</span>)
    )},
    { key: 'confidence', header: 'Confidence', render: (r: ProtocolRule) => renderConfidenceBadge(r.confidence) },
    { key: 'status', header: 'Status', render: (r: ProtocolRule) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        r.approval_status === 'APPROVED' ? 'bg-green-100 text-green-800' :
        r.approval_status === 'REJECTED' ? 'bg-red-100 text-red-800' :
        'bg-amber-100 text-amber-800'
      }`}>
        {r.approval_status}
      </span>
    )},
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-base-ink">Protocol Rule Viewer</h1>
          <p className="text-sm text-base-secondary mt-2">Manage and review rules used by the deterministic engine.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setIsExtractModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-base-ink hover:bg-black rounded-md transition-colors"
          >
            <Upload size={16} />
            <span>Extract Rules</span>
          </button>
        </div>
      </div>

      <AIBanner>
        <div className="space-y-1">
          <h3 className="font-semibold text-sm text-ai-text">AI Protocol Extraction</h3>
          <p className="text-sm text-ai-text/80">
            IBM watsonx.ai extracts candidate protocol rules from source text or PDF. 
            Extracted rules start as <strong className="font-semibold">PENDING</strong> and require human approval before they can be used by the deterministic rule engine.
          </p>
          <p className="text-sm text-ai-text/80 font-medium pt-1">
            <Shield size={14} className="inline mr-1" />
            AI does not determine final deviation severity.
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
        <div className="flex items-center justify-center h-64 text-base-secondary">Loading protocol rules...</div>
      ) : (
        <DataTable 
          data={rules} 
          columns={columns} 
          keyField="rule_id"
          onRowClick={(r: ProtocolRule) => setSelectedRule(r)}
        />
      )}

      {/* Extract Rules Modal */}
      {isExtractModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-base-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-base-ink">Extract Protocol Rules</h2>
              <button 
                onClick={() => setIsExtractModalOpen(false)}
                className="text-base-muted hover:text-base-ink transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              <div className="flex space-x-4 border-b border-base-border mb-4">
                <button
                  className={`pb-2 text-sm font-medium ${extractMode === 'text' ? 'text-base-ink border-b-2 border-base-ink' : 'text-base-secondary hover:text-base-ink'}`}
                  onClick={() => setExtractMode('text')}
                >
                  Text Input
                </button>
                <button
                  className={`pb-2 text-sm font-medium ${extractMode === 'file' ? 'text-base-ink border-b-2 border-base-ink' : 'text-base-secondary hover:text-base-ink'}`}
                  onClick={() => setExtractMode('file')}
                >
                  PDF Upload
                </button>
              </div>

              {extractMode === 'text' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-base-ink block">Protocol Text</label>
                  <textarea 
                    className="w-full border border-base-border rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-base-ink/20"
                    rows={6}
                    placeholder="Paste clinical trial protocol text here..."
                    value={protocolText}
                    onChange={(e) => setProtocolText(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-base-ink block">Protocol PDF</label>
                  <input 
                    type="file"
                    accept="application/pdf"
                    className="w-full border border-base-border rounded-md p-2 text-sm"
                    onChange={(e) => setProtocolFile(e.target.files?.[0] || null)}
                  />
                  <p className="text-xs text-base-muted mt-1">Upload a PDF protocol document to extract rules.</p>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-base-border bg-slate-50 rounded-b-xl flex justify-end space-x-3">
              <button 
                onClick={() => setIsExtractModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-base-ink bg-white border border-base-border rounded-md hover:bg-slate-50 transition-colors"
                disabled={isExtracting}
              >
                Cancel
              </button>
              <button 
                onClick={handleExtract}
                disabled={isExtracting || (extractMode === 'text' && !protocolText.trim()) || (extractMode === 'file' && !protocolFile)}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-base-ink hover:bg-black rounded-md transition-colors disabled:opacity-50"
              >
                {isExtracting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                <span>{isExtracting ? 'Extracting...' : 'Extract Rules'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rule Detail Drawer */}
      <DetailDrawer 
        isOpen={!!selectedRule} 
        onClose={() => setSelectedRule(null)}
        title={
          <div className="flex items-center space-x-3">
            <span className="font-mono text-sm">{selectedRule?.rule_id}</span>
            {selectedRule?.approval_status === 'PENDING' && (
              <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded font-medium border border-amber-200">
                Pending Review
              </span>
            )}
            {selectedRule?.approval_status === 'APPROVED' && (
              <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded font-medium border border-green-200 flex items-center space-x-1">
                <CheckCircle size={12} />
                <span>Approved</span>
              </span>
            )}
            {selectedRule?.approval_status === 'REJECTED' && (
              <span className="bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded font-medium border border-red-200">
                Rejected
              </span>
            )}
          </div>
        }
      >
        {selectedRule && (
          <div className="space-y-6 pb-20">
            <div>
              <h3 className="text-xl font-semibold text-base-ink mb-1">{selectedRule.category}</h3>
              <p className="text-base text-base-secondary">{selectedRule.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg border border-base-border">
                <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Expected Value</span>
                <span className="font-medium text-sm">{selectedRule.expected_value || '-'}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-base-border">
                <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Allowed Range</span>
                <span className="font-medium text-sm">{selectedRule.allowed_range || '-'}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-base-border">
                <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Unit</span>
                <span className="font-medium text-sm">{selectedRule.unit || '-'}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg border border-base-border">
                <span className="text-xs text-base-muted uppercase tracking-wider block mb-1">Visit</span>
                <span className="font-medium text-sm">{selectedRule.visit || '-'}</span>
              </div>
            </div>

            <div className="border-t border-base-border pt-6">
              <h3 className="text-sm font-semibold text-base-muted uppercase tracking-wider mb-4">Technical Details</h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-base-ink mb-1">Condition Logic</h4>
                  <code className="text-sm text-pink-600 bg-pink-50 p-3 rounded border border-pink-100 block font-mono">
                    {selectedRule.condition || '-'}
                  </code>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-base-ink mb-1">Severity Hint</h4>
                    <p className="text-sm text-base-secondary">{selectedRule.severity_hint || selectedRule.severity || '-'}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-base-ink mb-1">Confidence</h4>
                    <div className="mt-1">{renderConfidenceBadge(selectedRule.confidence)}</div>
                  </div>
                </div>
              </div>
            </div>

            {selectedRule.source_text && (
              <div className="border-t border-base-border pt-6">
                <h3 className="text-sm font-semibold text-base-muted uppercase tracking-wider mb-2 flex items-center">
                  <LinkIcon size={14} className="mr-1.5" />
                  Source Evidence
                </h3>
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                  <p className="text-sm text-blue-900 italic">"{selectedRule.source_text}"</p>
                  <p className="text-xs text-blue-700/70 mt-2 font-medium">— {selectedRule.protocol_reference || 'Extracted Document'}</p>
                </div>
              </div>
            )}

            {selectedRule.approval_status === 'PENDING' && (
              <div className="fixed bottom-0 right-0 w-full md:w-[600px] border-t border-base-border bg-white p-4 shadow-lg flex space-x-3">
                <button 
                  onClick={() => handleApprove(selectedRule.rule_id)}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
                >
                  Approve Rule
                </button>
                <button 
                  onClick={() => handleReject(selectedRule.rule_id)}
                  className="flex-1 py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium rounded-md transition-colors"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};
