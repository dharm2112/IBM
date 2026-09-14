from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from src.backend.database import get_db
from src.backend.db_models import EngineRun, SiteRiskScoreRecord, DetectedDeviationRecord

router = APIRouter(tags=["Data APIs"])

def _get_latest_run_id(db: Session) -> str | None:
    latest_run = db.query(EngineRun).order_by(EngineRun.started_at.desc()).first()
    return latest_run.run_id if latest_run else None

@router.get("/sites")
def get_sites(db: Session = Depends(get_db)):
    """Fetch sites from the latest engine run."""
    run_id = _get_latest_run_id(db)
    if not run_id:
        return []
    records = db.query(SiteRiskScoreRecord).filter(SiteRiskScoreRecord.run_id == run_id).all()
    
    sites = []
    for r in records:
        sites.append({
            "site_id": r.site_id,
            "site_name": f"Generated Site {r.site_id}",
            "location": "Simulated Location",
            "principal_investigator": "Dr. Generated",
            "status": "Active",
            "patient_count": 5, 
            "risk_score": r.risk_score,
            "risk_level": r.risk_level.upper(),
        })
    return sites

@router.get("/sites/{site_id}")
def get_site(site_id: str, db: Session = Depends(get_db)):
    """Fetch a specific site by ID."""
    run_id = _get_latest_run_id(db)
    if not run_id:
        raise HTTPException(status_code=404, detail="No engine runs found")
    record = db.query(SiteRiskScoreRecord).filter(
        SiteRiskScoreRecord.run_id == run_id,
        SiteRiskScoreRecord.site_id == site_id
    ).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="Site not found")
        
    return {
        "site_id": record.site_id,
        "site_name": f"Generated Site {record.site_id}",
        "location": "Simulated Location",
        "principal_investigator": "Dr. Generated",
        "status": "Active",
        "patient_count": 5,
        "risk_score": record.risk_score,
        "risk_level": record.risk_level.upper(),
    }

@router.get("/deviations")
def get_deviations(
    site_id: str | None = None,
    patient_id: str | None = None,
    severity: str | None = None,
    db: Session = Depends(get_db)
):
    """Fetch deviations from the latest engine run, optionally filtered."""
    run_id = _get_latest_run_id(db)
    if not run_id:
        return []
        
    query = db.query(DetectedDeviationRecord).filter(DetectedDeviationRecord.run_id == run_id)
    if site_id:
        query = query.filter(DetectedDeviationRecord.site_id == site_id)
    if patient_id:
        query = query.filter(DetectedDeviationRecord.patient_id == patient_id)
    if severity:
        query = query.filter(DetectedDeviationRecord.severity == severity.lower())
        
    records = query.all()
    
    deviations = []
    for d in records:
        deviations.append({
            "deviation_id": d.deviation_id,
            "site_id": d.site_id,
            "patient_id": d.patient_id,
            "visit_id": d.visit_id or 'V-GEN',
            "rule_id": d.rule_id,
            "category": d.category,
            "description": d.description,
            "expected": d.expected or 'N/A',
            "actual": d.actual or 'N/A',
            "severity": d.severity.upper(),
            "status": (d.status or 'open').title(),
            "detected_at": d.detected_at or d.created_at.isoformat() if d.created_at else "",
        })
    return deviations

@router.get("/deviations/{deviation_id}")
def get_deviation(deviation_id: str, db: Session = Depends(get_db)):
    """Fetch a specific deviation by ID."""
    record = db.query(DetectedDeviationRecord).filter(DetectedDeviationRecord.deviation_id == deviation_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Deviation not found")
        
    return {
        "deviation_id": record.deviation_id,
        "site_id": record.site_id,
        "patient_id": record.patient_id,
        "visit_id": record.visit_id or 'V-GEN',
        "rule_id": record.rule_id,
        "category": record.category,
        "description": record.description,
        "expected": record.expected or 'N/A',
        "actual": record.actual or 'N/A',
        "severity": record.severity.upper(),
        "status": (record.status or 'open').title(),
        "detected_at": record.detected_at or record.created_at.isoformat() if record.created_at else "",
    }
