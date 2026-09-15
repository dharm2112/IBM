"""Read and review APIs backed by persisted synthetic data."""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from src.backend.database import get_db
from src.backend.db_models import EngineRun, SiteRecord, PatientRecord, VisitRecord, LabRecord, DoseRecord, MedicationRecord, SiteRiskScoreRecord, DetectedDeviationRecord, CapaRecord, ProtocolRuleRecord, ProtocolRuleMappingRecord, AuditLogRecord, add_audit_event
from src.ai.rule_mapper import get_canonical_rules

router = APIRouter(tags=["Data APIs"])
def latest(db): return db.query(EngineRun).order_by(EngineRun.started_at.desc()).first()
def dev(x): return {"deviation_id":x.deviation_id,"site_id":x.site_id,"patient_id":x.patient_id,"visit_id":x.visit_id or "V-GEN","rule_id":x.rule_id,"category":x.category,"description":x.description,"expected":x.expected or "N/A","actual":x.actual or "N/A","severity":x.severity.upper(),"status":(x.status or "open").title(),"detected_at":x.detected_at or (x.created_at.isoformat() if x.created_at else "")}
def site(x,s): return {"site_id":x.site_id,"site_name":x.site_name,"location":", ".join(v for v in [x.city,x.country] if v),"principal_investigator":x.investigator,"status":x.status.title(),"patient_count":x.patient_count,"risk_score":s.risk_score if s else 0,"risk_level":s.risk_level.upper() if s else "LOW"}

@router.get("/sites")
def get_sites(db:Session=Depends(get_db)):
    r=latest(db)
    if not r:return []
    scores={x.site_id:x for x in db.query(SiteRiskScoreRecord).filter_by(run_id=r.run_id)}
    return [site(x,scores.get(x.site_id)) for x in db.query(SiteRecord).filter_by(run_id=r.run_id)]
@router.get("/sites/{site_id}")
def get_site(site_id:str,db:Session=Depends(get_db)):
    r=latest(db);x=db.query(SiteRecord).filter_by(run_id=r.run_id if r else None,site_id=site_id).first()
    if not x:raise HTTPException(404,"Site not found")
    return site(x,db.query(SiteRiskScoreRecord).filter_by(run_id=r.run_id,site_id=site_id).first())
@router.get("/patients")
def patients_list(site_id: str | None = None, db: Session = Depends(get_db)):
    r = latest(db)
    if not r: return []
    q = db.query(PatientRecord).filter_by(run_id=r.run_id)
    if site_id: q = q.filter_by(site_id=site_id)
    return [{"patient_id": x.patient_id, "site_id": x.site_id, "enrollment_date": x.enrollment_date,
             "status": x.status.title() if x.status else "Active", "eligibility_status": "Eligible"} for x in q]
@router.get("/patients/{patient_id}")
def patient(patient_id:str,db:Session=Depends(get_db)):
    r=latest(db);x=db.query(PatientRecord).filter_by(run_id=r.run_id if r else None,patient_id=patient_id).first()
    if not x:raise HTTPException(404,"Patient not found")
    return {"patient_id":x.patient_id,"site_id":x.site_id,"screening_date":None,"enrollment_date":x.enrollment_date,"status":x.status.title(),"eligibility_status":"Eligible"}
@router.get("/patients/{patient_id}/timeline")
def timeline(patient_id:str,db:Session=Depends(get_db)):
    r=latest(db)
    if not r:return []
    return [{"visit_id":x.visit_id,"patient_id":x.patient_id,"site_id":x.site_id,"visit_number":x.visit_number,"visit_type":x.visit_type,"expected_date":x.scheduled_date,"actual_date":x.actual_date or "","status":x.status.title()} for x in db.query(VisitRecord).filter_by(run_id=r.run_id,patient_id=patient_id).order_by(VisitRecord.visit_number)]
@router.get("/visits/{visit_id}")
def visit(visit_id:str,db:Session=Depends(get_db)):
    r=latest(db);x=db.query(VisitRecord).filter_by(run_id=r.run_id if r else None,visit_id=visit_id).first()
    if not x:raise HTTPException(404,"Visit not found")
    return {"visit_id":x.visit_id,"patient_id":x.patient_id,"site_id":x.site_id,"visit_number":x.visit_number,"visit_type":x.visit_type,"expected_date":x.scheduled_date,"actual_date":x.actual_date or "","status":x.status.title(),"labs":[{"test_code":z.test_code,"result_value":z.result_value,"unit":z.result_unit} for z in db.query(LabRecord).filter_by(run_id=r.run_id,visit_id=x.visit_id)],"doses":[{"dose_id":z.dose_id,"actual_dose":z.actual_dose,"unit":z.dose_unit} for z in db.query(DoseRecord).filter_by(run_id=r.run_id,visit_id=x.visit_id)]}
@router.get("/deviations")
def deviations(site_id:str|None=None,patient_id:str|None=None,severity:str|None=None,db:Session=Depends(get_db)):
    r=latest(db)
    if not r:return []
    q=db.query(DetectedDeviationRecord).filter_by(run_id=r.run_id)
    if site_id:q=q.filter_by(site_id=site_id)
    if patient_id:q=q.filter_by(patient_id=patient_id)
    if severity:q=q.filter_by(severity=severity.lower())
    return [dev(x) for x in q]
@router.get("/deviations/{deviation_id}")
def deviation(deviation_id:str,db:Session=Depends(get_db)):
    x=db.query(DetectedDeviationRecord).filter_by(deviation_id=deviation_id).order_by(DetectedDeviationRecord.id.desc()).first()
    if not x:raise HTTPException(404,"Deviation not found")
    return dev(x)
@router.get("/risk-scores")
def risks(db:Session=Depends(get_db)):
    r=latest(db);return [] if not r else [x.to_dict() for x in db.query(SiteRiskScoreRecord).filter_by(run_id=r.run_id)]

def capa_out(x): return {"capa_id":x.capa_id,"deviation_id":x.deviation_id,"site_id":x.site_id,"root_cause_analysis":x.root_cause_analysis,"immediate_actions":json.loads(x.immediate_actions or '[]'),"preventive_actions":json.loads(x.preventive_actions or '[]'),"timeline":json.loads(x.timeline or '[]'),"effectiveness_check":x.effectiveness_check,"full_draft":x.full_draft,"status":x.status,"human_review_required":x.human_review_required}
@router.get("/capas")
def capas(db:Session=Depends(get_db)):return [capa_out(x) for x in db.query(CapaRecord).order_by(CapaRecord.created_at.desc())]
@router.get("/capas/{capa_id}")
def capa(capa_id:str,db:Session=Depends(get_db)):
    x=db.query(CapaRecord).filter_by(capa_id=capa_id).first()
    if not x:raise HTTPException(404,"CAPA not found")
    return capa_out(x)
@router.patch("/capas/{capa_id}/status")
def capa_status(capa_id:str,body:dict,db:Session=Depends(get_db)):
    x=db.query(CapaRecord).filter_by(capa_id=capa_id).first();new=body.get("status","").lower()
    if not x:raise HTTPException(404,"CAPA not found")
    if new not in {"approved","rejected"}:raise HTTPException(422,"CAPA status must be approved or rejected")
    old=x.status;x.status=new;add_audit_event(db,f"capa_{new}","CAPA",capa_id,previous_status=old,new_status=new,source="user_review");db.commit();return capa_out(x)
def rule_out(x, m=None):
    d = {k:getattr(x,k) for k in ("rule_id","protocol_id","category","description","condition","expected_value","allowed_range","unit","visit","severity_hint","source_text","confidence","status")}
    if m:
        d["mapping"] = {
            "canonical_rule_id": m.canonical_rule_id,
            "mapping_status": m.mapping_status,
            "confidence": m.confidence,
            "mapping_reason": m.mapping_reason
        }
    return d
@router.get("/protocol/rules")
def rules(db:Session=Depends(get_db)):
    rules = db.query(ProtocolRuleRecord).order_by(ProtocolRuleRecord.created_at.desc()).all()
    mappings = {m.extracted_rule_id: m for m in db.query(ProtocolRuleMappingRecord).all()}
    return [rule_out(x, mappings.get(x.rule_id)) for x in rules]
@router.get("/protocol/rules/{rule_id}")
def rule(rule_id:str,db:Session=Depends(get_db)):
    x=db.query(ProtocolRuleRecord).filter_by(rule_id=rule_id).first()
    if not x:raise HTTPException(404,"Protocol rule not found")
    m = db.query(ProtocolRuleMappingRecord).filter_by(extracted_rule_id=rule_id).first()
    return rule_out(x, m)
@router.patch("/protocol/rules/{rule_id}/status")
def rule_status(rule_id:str,body:dict,db:Session=Depends(get_db)):
    x=db.query(ProtocolRuleRecord).filter_by(rule_id=rule_id).first();new=body.get("status","").lower()
    if not x:raise HTTPException(404,"Protocol rule not found")
    if x.status!="pending" or new not in {"approved","rejected"}:raise HTTPException(422,"Only pending rules may be approved or rejected")
    old=x.status;x.status=new;add_audit_event(db,f"protocol_rule_{new}","ProtocolRule",rule_id,previous_status=old,new_status=new,source="user_review");db.commit()
    m = db.query(ProtocolRuleMappingRecord).filter_by(extracted_rule_id=rule_id).first()
    return rule_out(x, m)
    
@router.get("/protocol/rules/{rule_id}/mapping")
def get_rule_mapping(rule_id: str, db: Session = Depends(get_db)):
    m = db.query(ProtocolRuleMappingRecord).filter_by(extracted_rule_id=rule_id).first()
    if not m: raise HTTPException(404, "Mapping not found")
    return {"canonical_rule_id": m.canonical_rule_id, "mapping_status": m.mapping_status, "mapping_reason": m.mapping_reason}

@router.patch("/protocol/rules/{rule_id}/mapping")
def update_rule_mapping(rule_id: str, body: dict, db: Session = Depends(get_db)):
    m = db.query(ProtocolRuleMappingRecord).filter_by(extracted_rule_id=rule_id).first()
    if not m: raise HTTPException(404, "Mapping not found")
    new_status = body.get("status", "").lower()
    if new_status not in {"approved", "rejected", "unsupported"}:
        raise HTTPException(422, "Invalid status")
    
    old = m.mapping_status
    m.mapping_status = new_status
    
    # Audit trail for mapping changes
    add_audit_event(db, f"mapping_{new_status}", "ProtocolRuleMapping", rule_id, previous_status=old, new_status=new_status, source="user_review")
    db.commit()
    
    x = db.query(ProtocolRuleRecord).filter_by(rule_id=rule_id).first()
    return rule_out(x, m)

@router.get("/protocol/canonical-rules")
def get_canonical_rules_api():
    return get_canonical_rules()

@router.get("/audit-logs")
def audits(db:Session=Depends(get_db)):
    return [{"audit_id":x.event_id,"timestamp":x.timestamp.isoformat(),"actor":x.source,"action":x.event_type,"entity_type":x.entity_type,"entity_id":x.entity_id,"details":x.details or "","previous_status":x.previous_status,"new_status":x.new_status,"source":x.source} for x in db.query(AuditLogRecord).order_by(AuditLogRecord.timestamp.desc())]
