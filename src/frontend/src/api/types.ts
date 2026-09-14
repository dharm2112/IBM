export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type Severity = 'MINOR' | 'MAJOR' | 'CRITICAL';

export interface Site {
  site_id: string;
  site_name: string;
  location: string;
  principal_investigator: string;
  status: string;
  patient_count: number;
  risk_score: number;
  risk_level: RiskLevel;
}

export interface Patient {
  patient_id: string;
  site_id: string;
  screening_date: string;
  enrollment_date: string;
  status: string;
  eligibility_status: string;
}

export interface Visit {
  visit_id: string;
  patient_id: string;
  site_id: string;
  visit_number: number;
  visit_type: string;
  expected_date: string;
  actual_date: string;
  status: string;
}

export interface Deviation {
  deviation_id: string;
  site_id: string;
  patient_id: string;
  visit_id: string;
  rule_id: string;
  category: string;
  description: string;
  expected: string;
  actual: string;
  severity: Severity;
  status: string;
  detected_at: string;
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ProtocolRule {
  rule_id: string;
  category: string;
  name?: string;
  description: string;
  condition?: string;
  expected_value?: string;
  allowed_range?: string;
  unit?: string;
  visit?: string;
  severity_hint?: string;
  source_text?: string;
  confidence?: string;
  threshold?: string;
  severity?: Severity;
  protocol_reference?: string;
  approval_status: ApprovalStatus;
}

export type CapaStatus = 'Draft' | 'Pending Review' | 'Approved' | 'Rejected' | 'Closed';

export interface Capa {
  capa_id: string;
  deviation_id: string;
  title: string;
  root_cause_hypothesis: string;
  immediate_action: string;
  corrective_action: string;
  preventive_action: string;
  verification_method: string;
  owner_role: string;
  status: CapaStatus;
  ai_generated: boolean;
  requires_human_approval: boolean;
}

export interface AuditLog {
  audit_id: string;
  timestamp: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  previous_status?: string;
  new_status?: string;
  source?: string;
}
