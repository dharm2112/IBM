import type { Capa, CapaStatus, ProtocolRule } from './types';

// Map a raw /capas DB row to the frontend Capa shape
function mapCapa(x: any): Capa {
  // DB stores status lowercase; frontend Kanban expects title-case
  const statusMap: Record<string, CapaStatus> = {
    draft: 'Draft',
    'pending review': 'Pending Review',
    approved: 'Approved',
    rejected: 'Rejected',
    closed: 'Closed',
  };
  return {
    capa_id: x.capa_id,
    deviation_id: x.deviation_id,
    title: `AI Generated CAPA for ${x.deviation_id}`,
    root_cause_hypothesis: x.root_cause_analysis || '',
    immediate_action: Array.isArray(x.immediate_actions) ? x.immediate_actions.join(' ') : (x.immediate_actions || ''),
    corrective_action: 'See preventive actions',
    preventive_action: Array.isArray(x.preventive_actions) ? x.preventive_actions.join(' ') : (x.preventive_actions || ''),
    verification_method: x.effectiveness_check || '',
    owner_role: 'Principal Investigator',
    status: statusMap[x.status?.toLowerCase()] ?? 'Draft',
    ai_generated: true,
    requires_human_approval: x.human_review_required ?? true,
  };
}

// Map a raw /protocol/rules DB row to the frontend ProtocolRule shape
function mapProtocolRule(x: any): ProtocolRule {
  const statusMap: Record<string, 'PENDING' | 'APPROVED' | 'REJECTED'> = {
    pending: 'PENDING',
    approved: 'APPROVED',
    rejected: 'REJECTED',
  };
  return {
    rule_id: x.rule_id,
    category: x.category || 'Extracted',
    name: `Extracted: ${x.category || x.rule_id}`,
    description: x.description || '',
    condition: x.condition,
    expected_value: x.expected_value,
    allowed_range: x.allowed_range,
    unit: x.unit,
    visit: x.visit,
    severity_hint: x.severity_hint,
    source_text: x.source_text,
    confidence: x.confidence,
    threshold: '0',
    protocol_reference: 'AI Extraction',
    approval_status: statusMap[x.status?.toLowerCase()] ?? 'PENDING',
  };
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function fetchWithHandler(endpoint: string, options?: RequestInit) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(response.status, errorData.detail || errorData.message || response.statusText);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error(error instanceof Error ? error.message : 'Network error');
  }
}

export const api = {
  // ---------------------------------------------------------
  // REAL FASTAPI ENDPOINTS
  // ---------------------------------------------------------

  async getHealth() {
    return await fetchWithHandler('/health');
  },

  async recalculateRisk() {
    // Run the engine pipeline
    const response = await fetchWithHandler('/run-engine', {
      method: 'POST',
      body: JSON.stringify({ num_sites: 5, patients_per_site: 5 }),
    });

    // We used to fetch sites and deviations here to sync mock cache, but it's no longer needed.

    return { success: true, message: response.message };
  },

  async explainSite(site_id: string) {
    // Fetch site and its deviations from real DB endpoints
    const [site, allDeviations] = await Promise.all([
      fetchWithHandler(`/sites/${site_id}`),
      fetchWithHandler(`/deviations?site_id=${site_id}`),
    ]);

    const payload = {
      site_id: site.site_id,
      site_name: site.site_name,
      risk_score: site.risk_score,
      risk_level: site.risk_level.toLowerCase(),
      total_patients: site.patient_count,
      deviations: allDeviations.map((d: any) => ({
        deviation_id: d.deviation_id,
        rule_id: d.rule_id,
        category: d.category,
        severity: d.severity.toLowerCase(),
        description: d.description,
        visit: d.visit_id,
        affected_patients: 1,
        occurrence_count: 1,
      })),
    };

    const result = await fetchWithHandler('/ai/explain-risk', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return {
      explanation: result.explanation,
      key_findings: result.key_findings,
      recommended_focus: result.recommended_focus,
      ai_generated: true,
    };
  },

  async generateCapa(deviation_id: string) {
    // Fetch deviation from real DB endpoint
    const deviation = await fetchWithHandler(`/deviations/${deviation_id}`);

    const payload = {
      deviation_id: deviation.deviation_id,
      rule_id: deviation.rule_id,
      category: deviation.category,
      severity: deviation.severity.toLowerCase(),
      description: deviation.description,
      protocol_requirement: deviation.expected || 'Follow protocol',
      site_id: deviation.site_id,
    };

    const result = await fetchWithHandler('/ai/generate-capa', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    // capa_id is now returned from the backend (persisted in DB)
    const newCapa: Capa = {
      capa_id: result.capa_id || `CAPA-${deviation_id}`,
      deviation_id: deviation.deviation_id,
      title: `AI Generated CAPA for ${deviation.rule_id}`,
      root_cause_hypothesis: result.root_cause_analysis,
      immediate_action: result.immediate_actions.join(' '),
      corrective_action: 'See preventive actions',
      preventive_action: result.preventive_actions.join(' '),
      verification_method: result.effectiveness_check,
      owner_role: 'Principal Investigator',
      status: 'Draft',
      ai_generated: true,
      requires_human_approval: result.human_review_required,
    };

    return newCapa;
  },

  async uploadProtocol(file: File) {
    let result;
    if (file.type === 'application/pdf') {
      const formData = new FormData();
      formData.append('file', file);
      result = await fetchWithHandler('/ai/extract-protocol-pdf', {
        method: 'POST',
        body: formData,
      });
    } else {
      const text = await file.text();
      result = await fetchWithHandler('/ai/extract-protocol', {
        method: 'POST',
        body: JSON.stringify({ protocol_text: text }),
      });
    }

    // Rules are persisted to DB by the backend; just return the mapped list
    const newRules: ProtocolRule[] = (result.rules || []).map((extracted: any) => ({
      rule_id: extracted.rule_id || `RULE-${Math.floor(Math.random() * 1000)}`,
      category: extracted.category || 'Extracted',
      name: `Extracted: ${extracted.category}`,
      description: extracted.description,
      condition: extracted.condition,
      expected_value: extracted.expected_value,
      allowed_range: extracted.allowed_range,
      unit: extracted.unit,
      visit: extracted.visit,
      severity_hint: extracted.severity_hint,
      source_text: extracted.source_text,
      confidence: extracted.confidence,
      threshold: '0',
      severity: (extracted.severity || 'MINOR').toUpperCase() as any,
      protocol_reference: extracted.protocol_reference || (file.type === 'application/pdf' ? 'PDF Extraction' : 'Text Extraction'),
      approval_status: extracted.status === 'pending' ? 'PENDING' : 'APPROVED',
    }));

    if (newRules.length > 0) return newRules;
    throw new Error('No rules were extracted from this document.');
  },

  // ---------------------------------------------------------
  // REAL BACKEND DATA ENDPOINTS
  // ---------------------------------------------------------

  async getSites() {
    return await fetchWithHandler('/sites');
  },

  async getSite(site_id: string) {
    return await fetchWithHandler(`/sites/${site_id}`);
  },

  async getPatient(patient_id: string) {
    return await fetchWithHandler(`/patients/${patient_id}`);
  },

  async getPatientTimeline(patient_id: string) {
    return await fetchWithHandler(`/patients/${patient_id}/timeline`);
  },

  async getVisit(visit_id: string) {
    return await fetchWithHandler(`/visits/${visit_id}`);
  },

  async getDeviations(filters?: { site_id?: string; patient_id?: string; severity?: string }) {
    const params = new URLSearchParams();
    if (filters?.site_id) params.append('site_id', filters.site_id);
    if (filters?.patient_id) params.append('patient_id', filters.patient_id);
    if (filters?.severity) params.append('severity', filters.severity);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return await fetchWithHandler(`/deviations${qs}`);
  },

  async getDeviation(deviation_id: string) {
    return await fetchWithHandler(`/deviations/${deviation_id}`);
  },

  async getCapas() {
    const raw = await fetchWithHandler('/capas');
    return raw.map(mapCapa);
  },

  async getProtocolRules() {
    const raw = await fetchWithHandler('/protocol/rules');
    return raw.map(mapProtocolRule);
  },

  async approveProtocolRule(rule_id: string) {
    return await fetchWithHandler(`/protocol/rules/${rule_id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved' }),
    });
  },

  async rejectProtocolRule(rule_id: string) {
    return await fetchWithHandler(`/protocol/rules/${rule_id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'rejected' }),
    });
  },

  async approveCapa(capa_id: string) {
    return await fetchWithHandler(`/capas/${capa_id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'approved' }),
    });
  },

  async rejectCapa(capa_id: string) {
    return await fetchWithHandler(`/capas/${capa_id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'rejected' }),
    });
  },

  async getAuditLogs() {
    return await fetchWithHandler('/audit-logs');
  },
};
