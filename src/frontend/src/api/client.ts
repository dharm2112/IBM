import { mockApi, setMockSites, setMockDeviations } from './mock';
import type { Site, Deviation, Capa, ProtocolRule } from './types';

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
    // Calls Member 1 rule engine to generate dataset, detect deviations, and score sites.
    const response = await fetchWithHandler('/run-engine', {
      method: 'POST',
      body: JSON.stringify({ num_sites: 5, patients_per_site: 5 }),
    });

    // Map backend site risk summaries to frontend Site types
    const newSites: Site[] = response.site_risk_scores.map((s: any) => ({
      site_id: s.site_id,
      site_name: `Generated Site ${s.site_id}`,
      location: 'Simulated Location',
      principal_investigator: 'Dr. Generated',
      status: 'Active',
      patient_count: 5,
      risk_score: s.risk_score,
      risk_level: s.risk_level.toUpperCase(),
    }));

    // Map backend deviation samples to frontend Deviation types
    const newDeviations: Deviation[] = response.deviation_sample.map((d: any) => ({
      deviation_id: d.deviation_id,
      site_id: d.site_id,
      patient_id: d.patient_id,
      visit_id: 'V-GEN',
      rule_id: d.rule_id,
      category: d.category,
      description: d.description,
      expected: d.expected || 'N/A',
      actual: d.actual || 'N/A',
      severity: d.severity.toUpperCase(),
      status: d.status || 'Open',
      detected_at: new Date().toISOString(),
    }));

    // Update the mock data in memory so the rest of the app sees the new generated data
    setMockSites(newSites);
    setMockDeviations(newDeviations);

    return { success: true, message: response.message };
  },

  async explainSite(site_id: string) {
    // 1. Fetch site and deviations from mock cache (populated by recalculateRisk or default mock)
    const site = await mockApi.getSite(site_id);
    const allDeviations = await mockApi.getDeviations({ site_id });

    // 2. Prepare payload exactly as /ai/explain-risk expects (Member 1 to Member 2 data structure)
    const payload = {
      site_id: site.site_id,
      site_name: site.site_name,
      risk_score: site.risk_score,
      risk_level: site.risk_level.toLowerCase(),
      total_patients: site.patient_count,
      deviations: allDeviations.map(d => ({
        deviation_id: d.deviation_id,
        rule_id: d.rule_id,
        category: d.category,
        severity: d.severity.toLowerCase(),
        description: d.description,
        visit: d.visit_id,
        affected_patients: 1,
        occurrence_count: 1
      }))
    };

    // 3. Call actual backend
    const result = await fetchWithHandler('/ai/explain-risk', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return {
      explanation: result.explanation,
      key_findings: result.key_findings,
      recommended_focus: result.recommended_focus,
      ai_generated: true
    };
  },

  async generateCapa(deviation_id: string) {
    // 1. Find deviation from local state
    const deviation = await mockApi.getDeviation(deviation_id);

    // 2. Prepare payload
    const payload = {
      deviation_id: deviation.deviation_id,
      rule_id: deviation.rule_id,
      category: deviation.category,
      severity: deviation.severity.toLowerCase(),
      description: deviation.description,
      protocol_requirement: deviation.expected || 'Follow protocol',
      site_id: deviation.site_id
    };

    // 3. Call backend
    const result = await fetchWithHandler('/ai/generate-capa', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    // 4. Map backend CAPA response to frontend Capa type
    const newCapa: Capa = {
      capa_id: `CAPA-${deviation_id}`,
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
      requires_human_approval: result.human_review_required
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
      // Fallback for simple text files if uploaded
      const text = await file.text();
      result = await fetchWithHandler('/ai/extract-protocol', {
        method: 'POST',
        body: JSON.stringify({ protocol_text: text }),
      });
    }

    // Map extracted rules to frontend ProtocolRule type
    // We'll just return the first rule to match the mock signature, 
    // or you could update the signature if the UI supports arrays.
    if (result.rules && result.rules.length > 0) {
      const extracted = result.rules[0];
      const newRule: ProtocolRule = {
        rule_id: extracted.rule_id || `RULE-${Math.floor(Math.random() * 1000)}`,
        category: extracted.category || 'Extracted',
        name: `Extracted: ${extracted.category}`,
        description: extracted.description,
        condition: 'extracted',
        threshold: '0',
        severity: (extracted.severity || 'MINOR').toUpperCase() as any,
        protocol_reference: extracted.protocol_reference || 'PDF Extraction',
        approval_status: extracted.status === 'pending' ? 'PENDING' : 'APPROVED'
      };
      return newRule;
    }
    
    throw new Error('No rules were extracted from this document.');
  },

  // ---------------------------------------------------------
  // MOCK FALLBACKS (Endpoints not yet implemented in backend)
  // ---------------------------------------------------------

  async getSites() {
    return mockApi.getSites();
  },

  async getSite(site_id: string) {
    return mockApi.getSite(site_id);
  },

  async getPatient(patient_id: string) {
    return mockApi.getPatient(patient_id);
  },

  async getPatientTimeline(patient_id: string) {
    return mockApi.getPatientTimeline(patient_id);
  },

  async getVisit(visit_id: string) {
    return mockApi.getVisit(visit_id);
  },

  async getDeviations(filters?: { site_id?: string; patient_id?: string; severity?: string }) {
    return mockApi.getDeviations(filters);
  },

  async getDeviation(deviation_id: string) {
    return mockApi.getDeviation(deviation_id);
  },

  async approveCapa(capa_id: string) {
    return mockApi.approveCapa(capa_id);
  },

  async rejectCapa(capa_id: string) {
    return mockApi.rejectCapa(capa_id);
  },

  async getAuditLogs() {
    return mockApi.getAuditLogs();
  }
};
