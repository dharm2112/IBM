import pytest
from fastapi.testclient import TestClient
from src.backend.main import app
from src.backend.db_models import EngineRun, SiteRecord, PatientRecord, DetectedDeviationRecord, CapaRecord, ProtocolRuleRecord
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from src.backend.database import Base, get_db

@pytest.fixture(scope="function")
def db_session():
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    
    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()
            
    app.dependency_overrides[get_db] = override_get_db
    db = TestSession()
    yield db
    db.close()
    app.dependency_overrides.clear()

client = TestClient(app)

def test_get_sites_empty_db(db_session):
    response = client.get("/sites")
    assert response.status_code == 200
    assert response.json() == []

def test_get_sites_with_data(db_session):
    run = EngineRun(run_id="run-123", started_at=datetime.now(timezone.utc), completed_at=datetime.now(timezone.utc), status="success")
    db_session.add(run)
    db_session.commit()
    
    site = SiteRecord(run_id="run-123", site_id="SITE-1", site_name="Test Site", country="US", investigator="Dr. Test", status="Active", patient_count=10)
    db_session.add(site)
    db_session.commit()
    
    response = client.get("/sites")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["site_id"] == "SITE-1"

def test_get_patients(db_session):
    run = EngineRun(run_id="run-123", started_at=datetime.now(timezone.utc), completed_at=datetime.now(timezone.utc), status="success")
    db_session.add(run)
    db_session.commit()
    
    patient = PatientRecord(run_id="run-123", patient_id="PAT-1", site_id="SITE-1", enrollment_date="2026-09-15", date_of_birth="1980-01-01", sex="M", status="active")
    db_session.add(patient)
    db_session.commit()
    
    response = client.get("/patients/PAT-1")
    assert response.status_code == 200
    assert response.json()["patient_id"] == "PAT-1"

def test_get_capas_empty(db_session):
    response = client.get("/capas")
    assert response.status_code == 200
    assert response.json() == []

def test_get_rules_empty(db_session):
    response = client.get("/protocol/rules")
    assert response.status_code == 200
    assert response.json() == []
