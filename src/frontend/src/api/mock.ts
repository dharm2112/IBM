import type {
  Site,
  Patient,
  Visit,
  Deviation,
  ProtocolRule,
  Capa,
} from './types';
import type { AuditLog } from './types';
// ==========================================
// ============================================================================
// WARNING: MOCK DATA FIXTURES - NOT FOR PRODUCTION/DEMO USE
// ============================================================================
// This file contains hardcoded fallback data used ONLY for local UI
// component testing and development when the backend is completely offline.
// 
// The primary application demo path uses: FastAPI -> client.ts -> SQLite.
// Do NOT silently replace failed backend requests with these fakes.
// ============================================================================

// MOCK DATA FIXTURES
// ==========================================

let sites: Site[] = [
  { site_id: 'SITE-001', site_name: 'General Hospital', location: 'New York, NY', principal_investigator: 'Dr. Sarah Connor', status: 'Active', patient_count: 120, risk_score: 85, risk_level: 'HIGH' },
  { site_id: 'SITE-002', site_name: 'Memorial Clinic', location: 'Boston, MA', principal_investigator: 'Dr. John Smith', status: 'Active', patient_count: 85, risk_score: 45, risk_level: 'MEDIUM' },
  { site_id: 'SITE-003', site_name: 'Westside Medical', location: 'Chicago, IL', principal_investigator: 'Dr. Emily Chen', status: 'Active', patient_count: 150, risk_score: 12, risk_level: 'LOW' },
  { site_id: 'SITE-004', site_name: 'University Health', location: 'Austin, TX', principal_investigator: 'Dr. Michael Chang', status: 'Active', patient_count: 200, risk_score: 25, risk_level: 'LOW' },
  { site_id: 'SITE-005', site_name: 'Valley Research', location: 'Phoenix, AZ', principal_investigator: 'Dr. Robert Ford', status: 'Active', patient_count: 65, risk_score: 92, risk_level: 'HIGH' },
];

let patients: Patient[] = [
  { patient_id: 'PT-1001', site_id: 'SITE-001', screening_date: '2023-01-15', enrollment_date: '2023-02-01', status: 'Enrolled', eligibility_status: 'Eligible' },
  { patient_id: 'PT-1002', site_id: 'SITE-001', screening_date: '2023-01-20', enrollment_date: '2023-02-05', status: 'Enrolled', eligibility_status: 'Eligible' },
  { patient_id: 'PT-2001', site_id: 'SITE-002', screening_date: '2023-02-10', enrollment_date: '2023-02-28', status: 'Enrolled', eligibility_status: 'Eligible' },
];

let visits: Visit[] = [
  { visit_id: 'V-1001-1', patient_id: 'PT-1001', site_id: 'SITE-001', visit_number: 1, visit_type: 'Screening', expected_date: '2023-01-15', actual_date: '2023-01-15', status: 'Completed' },
  { visit_id: 'V-1001-2', patient_id: 'PT-1001', site_id: 'SITE-001', visit_number: 2, visit_type: 'Baseline', expected_date: '2023-02-01', actual_date: '2023-02-01', status: 'Completed' },
  { visit_id: 'V-1001-3', patient_id: 'PT-1001', site_id: 'SITE-001', visit_number: 3, visit_type: 'Week 4', expected_date: '2023-03-01', actual_date: '2023-03-05', status: 'Completed' },
  { visit_id: 'V-1001-4', patient_id: 'PT-1001', site_id: 'SITE-001', visit_number: 4, visit_type: 'Week 8', expected_date: '2023-04-01', actual_date: '', status: 'Pending' },
];

let deviations: Deviation[] = [
  { deviation_id: 'DEV-001', site_id: 'SITE-001', patient_id: 'PT-1001', visit_id: 'V-1001-3', rule_id: 'RULE-001', category: 'Visit Schedule', description: 'Visit occurred outside of allowed window (+/- 3 days)', expected: '2023-02-26 to 2023-03-04', actual: '2023-03-05', severity: 'MINOR', status: 'Open', detected_at: '2023-03-05T10:00:00Z' },
  { deviation_id: 'DEV-002', site_id: 'SITE-001', patient_id: 'PT-1002', visit_id: 'V-1002-2', rule_id: 'RULE-002', category: 'Dosing', description: 'Patient received incorrect dosage', expected: '500mg', actual: '250mg', severity: 'CRITICAL', status: 'Open', detected_at: '2023-02-05T14:30:00Z' },
  { deviation_id: 'DEV-003', site_id: 'SITE-005', patient_id: 'PT-5001', visit_id: 'V-5001-1', rule_id: 'RULE-003', category: 'Eligibility', description: 'Patient enrolled despite out-of-range lab values', expected: 'Creatinine < 1.5', actual: 'Creatinine = 1.8', severity: 'MAJOR', status: 'Open', detected_at: '2023-01-10T09:15:00Z' },
  { deviation_id: 'DEV-004', site_id: 'SITE-002', patient_id: 'PT-2001', visit_id: 'V-2001-3', rule_id: 'RULE-001', category: 'Visit Schedule', description: 'Visit missed entirely', expected: 'Week 4 Visit', actual: 'Missed', severity: 'MAJOR', status: 'Resolved', detected_at: '2023-03-28T11:00:00Z' },
];

let protocolRules: ProtocolRule[] = [
  { rule_id: 'RULE-001', category: 'Visit Schedule', name: 'Week 4 Visit Window', description: 'Week 4 visit must occur 28 days +/- 3 days from Baseline', condition: 'visit_date >= baseline_date + 25 AND visit_date <= baseline_date + 31', threshold: '3 days', severity: 'MINOR', protocol_reference: 'Section 4.1.2', approval_status: 'APPROVED' },
  { rule_id: 'RULE-002', category: 'Dosing', name: 'Standard Dose', description: 'Patients must receive 500mg of investigational product', condition: 'dose == 500', threshold: '0 variance', severity: 'CRITICAL', protocol_reference: 'Section 5.2', approval_status: 'APPROVED' },
  { rule_id: 'RULE-003', category: 'Eligibility', name: 'Renal Function', description: 'Creatinine must be < 1.5 mg/dL at screening', condition: 'creatinine < 1.5', threshold: '1.5', severity: 'MAJOR', protocol_reference: 'Section 3.1', approval_status: 'APPROVED' },
  { rule_id: 'RULE-004', category: 'Concomitant Meds', name: 'No NSAIDs', description: 'Patients cannot take NSAIDs during the trial', condition: 'med_class != NSAID', threshold: '0', severity: 'MAJOR', protocol_reference: 'Section 6.1', approval_status: 'PENDING' },
];

let capas: Capa[] = [
  { capa_id: 'CAPA-001', deviation_id: 'DEV-002', title: 'Dosing Error Retraining', root_cause_hypothesis: 'Site staff misread the dispensing log due to confusing labeling.', immediate_action: 'Patient monitored for adverse events. Correct dose administered for next scheduled dose.', corrective_action: 'Retrain all site staff on dispensing protocol.', preventive_action: 'Implement dual-signoff for all investigational product dispensing.', verification_method: 'Review dispensing logs for next 5 patients.', owner_role: 'Principal Investigator', status: 'Pending Review', ai_generated: true, requires_human_approval: true },
  { capa_id: 'CAPA-002', deviation_id: 'DEV-003', title: 'Eligibility Checklist Update', root_cause_hypothesis: 'Coordinator used an outdated version of the eligibility checklist.', immediate_action: 'Patient withdrawn from study.', corrective_action: 'Destroy all printed copies of old checklist.', preventive_action: 'Move checklist to electronic EDC system only.', verification_method: 'Audit electronic vs paper checklist usage in 30 days.', owner_role: 'Study Coordinator', status: 'Approved', ai_generated: false, requires_human_approval: false },
];

let auditLogs: AuditLog[] = [
  { audit_id: 'AL-001', timestamp: '2023-01-10T09:15:00Z', actor: 'System', action: 'Detected Deviation', entity_type: 'Deviation', entity_id: 'DEV-003', details: 'Eligibility deviation detected for PT-5001' },
  { audit_id: 'AL-002', timestamp: '2023-02-05T14:30:00Z', actor: 'System', action: 'Detected Deviation', entity_type: 'Deviation', entity_id: 'DEV-002', details: 'Dosing deviation detected for PT-1002' },
  { audit_id: 'AL-003', timestamp: '2023-02-06T10:00:00Z', actor: 'watsonx.ai', action: 'Generated CAPA Draft', entity_type: 'CAPA', entity_id: 'CAPA-001', details: 'AI generated draft CAPA for DEV-002' },
];

// ==========================================
// UTILS
// ==========================================
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const createAuditLog = (action: string, entity_type: string, entity_id: string, details: string) => {
  auditLogs.unshift({
    audit_id: `AL-${Math.floor(Math.random() * 10000)}`,
    timestamp: new Date().toISOString(),
    actor: 'Current User',
    action,
    entity_type,
    entity_id,
    details,
  });
};

// ==========================================
// API CLIENT FUNCTIONS
// ==========================================

export const api = {
  // GET /api/health
  async getHealth() {
    await delay(200);
    return { status: 'ok' };
  },

  // GET /api/sites
  async getSites() {
    await delay(400);
    return [...sites];
  },

  // GET /api/sites/{site_id}
  async getSite(site_id: string) {
    await delay(300);
    const site = sites.find(s => s.site_id === site_id);
    if (!site) throw new Error('Site not found');
    return site;
  },

  // POST /api/sites/recalculate-risk
  async recalculateRisk() {
    await delay(800);
    // Simulate some changes
    sites = sites.map(s => ({ ...s, risk_score: Math.min(100, s.risk_score + Math.floor(Math.random() * 10 - 5)) }));
    createAuditLog('Recalculated Risk', 'System', 'All', 'Triggered manual risk recalculation');
    return { success: true, message: 'Risk scores updated' };
  },

  // GET /api/patients/{patient_id}
  async getPatient(patient_id: string) {
    await delay(300);
    const patient = patients.find(p => p.patient_id === patient_id);
    if (!patient) throw new Error('Patient not found');
    return patient;
  },

  // GET /api/patients/{patient_id}/timeline
  async getPatientTimeline(patient_id: string) {
    await delay(400);
    return visits.filter(v => v.patient_id === patient_id).sort((a, b) => a.visit_number - b.visit_number);
  },

  // GET /api/visits/{visit_id}
  async getVisit(visit_id: string) {
    await delay(200);
    const visit = visits.find(v => v.visit_id === visit_id);
    if (!visit) throw new Error('Visit not found');
    return visit;
  },

  // GET /api/deviations
  async getDeviations(filters?: { site_id?: string, patient_id?: string, severity?: string }) {
    await delay(500);
    let result = [...deviations];
    if (filters?.site_id) result = result.filter(d => d.site_id === filters.site_id);
    if (filters?.patient_id) result = result.filter(d => d.patient_id === filters.patient_id);
    if (filters?.severity) result = result.filter(d => d.severity === filters.severity);
    return result;
  },

  // GET /api/deviations/{deviation_id}
  async getDeviation(deviation_id: string) {
    await delay(300);
    const deviation = deviations.find(d => d.deviation_id === deviation_id);
    if (!deviation) throw new Error('Deviation not found');
    return deviation;
  },

  // POST /api/protocol/upload
  async uploadProtocol(file: File) {
    await delay(1500); // Simulate Watsonx.ai extraction
    const newRule: ProtocolRule = {
      rule_id: `RULE-${Math.floor(Math.random() * 1000)}`,
      category: 'Extracted',
      name: `Rule extracted from ${file.name}`,
      description: 'AI extracted rule description',
      condition: 'extracted_condition == true',
      threshold: '0',
      severity: 'MINOR',
      protocol_reference: 'Section X',
      approval_status: 'PENDING'
    };
    protocolRules.push(newRule);
    createAuditLog('Extracted Protocol Rule', 'ProtocolRule', newRule.rule_id, `AI extracted rule from ${file.name}`);
    return newRule;
  },

  // GET /api/protocol/rules
  async getProtocolRules() {
    await delay(400);
    return [...protocolRules];
  },

  // POST /api/protocol/rules/{rule_id}/approve
  async approveRule(rule_id: string) {
    await delay(500);
    const rule = protocolRules.find(r => r.rule_id === rule_id);
    if (!rule) throw new Error('Rule not found');
    rule.approval_status = 'APPROVED';
    createAuditLog('Approved Rule', 'ProtocolRule', rule_id, `Rule ${rule_id} approved`);
    return rule;
  },

  // POST /api/protocol/rules/{rule_id}/reject
  async rejectRule(rule_id: string) {
    await delay(500);
    const rule = protocolRules.find(r => r.rule_id === rule_id);
    if (!rule) throw new Error('Rule not found');
    rule.approval_status = 'REJECTED';
    createAuditLog('Rejected Rule', 'ProtocolRule', rule_id, `Rule ${rule_id} rejected`);
    return rule;
  },

  // POST /api/ai/explain-site
  async explainSite(site_id: string) {
    await delay(1200);
    return {
      explanation: `Site ${site_id} shows a disproportionate number of dosing deviations compared to the global average. The risk model weights this heavily because they occurred within the first 30 days of patient enrollment. Recommend retraining site staff on dispensing protocols.`,
      ai_generated: true
    };
  },

  // POST /api/deviations/{deviation_id}/capa
  async generateCapa(deviation_id: string) {
    await delay(1500);
    const newCapa: Capa = {
      capa_id: `CAPA-${Math.floor(Math.random() * 1000)}`,
      deviation_id,
      title: 'AI Generated CAPA Draft',
      root_cause_hypothesis: 'AI Hypothesis: Process ambiguity',
      immediate_action: 'Assess patient safety',
      corrective_action: 'Clarify process documentation',
      preventive_action: 'Implement regular check-ins',
      verification_method: 'Review next 5 occurrences',
      owner_role: 'Site Monitor',
      status: 'Draft',
      ai_generated: true,
      requires_human_approval: true
    };
    capas.push(newCapa);
    createAuditLog('Generated CAPA Draft', 'CAPA', newCapa.capa_id, `AI generated CAPA for deviation ${deviation_id}`);
    return newCapa;
  },

  // POST /api/capa/{capa_id}/approve
  async approveCapa(capa_id: string) {
    await delay(600);
    const capa = capas.find(c => c.capa_id === capa_id);
    if (!capa) throw new Error('CAPA not found');
    capa.status = 'Approved';
    createAuditLog('Approved CAPA', 'CAPA', capa_id, 'Human approved CAPA');
    return capa;
  },

  // POST /api/capa/{capa_id}/reject
  async rejectCapa(capa_id: string) {
    await delay(600);
    const capa = capas.find(c => c.capa_id === capa_id);
    if (!capa) throw new Error('CAPA not found');
    capa.status = 'Rejected';
    createAuditLog('Rejected CAPA', 'CAPA', capa_id, 'Human rejected CAPA');
    return capa;
  },

  // GET /api/capas
  async getCapas() {
    await delay(400);
    return [...capas];
  },

  // GET /api/audit-logs
  async getAuditLogs() {
    await delay(300);
    return [...auditLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
};

export const mockApi = api;
export const setMockSites = (newSites: Site[]) => { sites = newSites; };
export const setMockDeviations = (newDevs: Deviation[]) => { deviations = newDevs; };
export const addMockCapa = (newCapa: Capa) => { capas.push(newCapa); };
export const addMockProtocolRules = (newRules: ProtocolRule[]) => { protocolRules.push(...newRules); };


