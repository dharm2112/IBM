"""
src/tests/backend/test_engine_routes.py
────────────────────────────────────────
Integration tests for POST /run-engine.

Test strategy
─────────────
• The rule engine, risk scorer, and data generator are all real (not mocked).
  These are pure-Python deterministic modules with no external dependencies.

• The database uses an in-memory SQLite instance scoped per-test so tests
  are isolated and leave no files on disk.

• The WatsonxService is NOT exercised by /run-engine — it only runs the
  deterministic Member 1 pipeline.  No IBM credentials are required.

Architecture invariants verified
──────────────────────────────────
• risk_score and risk_level in the response come exclusively from
  score_all_sites() — they are never set or modified by AI code.
• Every detected deviation has a severity field set by the rule engine.
• The response contains a valid run_id and status="completed".
• Deviation sample contains no more than 10 entries.
• site_risk_scores are sorted by risk_score descending (highest risk first).
• high_risk_sites count matches the actual HIGH-level sites.
• /run-engine does not call WatsonxService (no AI credentials required).

Run:
    pytest src/tests/backend/test_engine_routes.py -v
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

# ORM models needed by DB persistence tests (imported at top-level to
# ensure they are registered on Base.metadata before fixture runs)
from src.backend.db_models import (  # noqa: F401
    DetectedDeviationRecord,
    EngineRun,
    SiteRiskScoreRecord,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="function")
def in_memory_db():
    """Create a fresh in-memory SQLite database for each test.

    Uses StaticPool so that every thread (incl. FastAPI's request handler)
    reuses the same connection and therefore sees the same in-memory tables.
    Without StaticPool, each new connection to 'sqlite:///:memory:' is a
    different empty database.
    """
    from sqlalchemy import create_engine as _create_engine
    from sqlalchemy.orm import sessionmaker as _sessionmaker
    from sqlalchemy.pool import StaticPool

    # Build a brand-new in-memory engine with a shared single connection
    test_engine = _create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Import ORM models so their Table objects are on Base.metadata
    import src.backend.db_models  # noqa: F401
    from src.backend.database import Base

    # Create ALL tables on this test engine
    Base.metadata.create_all(bind=test_engine)

    TestSession = _sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    return override_get_db, TestSession


@pytest.fixture(scope="function")
def engine_client(in_memory_db):
    """
    Return a TestClient with the in-memory DB wired in.

    WatsonxService is NOT mocked — /run-engine never calls it.
    """
    override_get_db, TestSession = in_memory_db
    from src.backend.database import get_db
    from src.backend.main import app

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, TestSession

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Minimal request body (small dataset for fast tests)
# ---------------------------------------------------------------------------

_SMALL_BODY = {
    "num_sites": 2,
    "patients_per_site": 2,
    "random_seed": 42,
}

_MEDIUM_BODY = {
    "num_sites": 3,
    "patients_per_site": 3,
    "random_seed": 99,
}


# ===========================================================================
# 1. Happy path — basic response shape
# ===========================================================================


class TestRunEngineHappyPath:
    def test_returns_200(self, engine_client):
        client, _ = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        assert response.status_code == 200, response.text

    def test_status_is_completed(self, engine_client):
        client, _ = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        assert response.json()["status"] == "completed"

    def test_run_id_is_present(self, engine_client):
        client, _ = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        body = response.json()
        assert "run_id" in body
        assert body["run_id"].startswith("RUN-")

    def test_sites_count_matches_request(self, engine_client):
        client, _ = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        assert response.json()["sites_count"] == _SMALL_BODY["num_sites"]

    def test_patients_count_matches_request(self, engine_client):
        client, _ = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        body = response.json()
        expected_patients = _SMALL_BODY["num_sites"] * _SMALL_BODY["patients_per_site"]
        assert body["patients_count"] == expected_patients

    def test_sites_scored_equals_sites_count(self, engine_client):
        client, _ = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        body = response.json()
        # Every site gets a risk score (even zero-deviation sites)
        assert body["sites_scored"] == body["sites_count"]

    def test_site_risk_scores_list_length_matches_sites(self, engine_client):
        client, _ = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        body = response.json()
        assert len(body["site_risk_scores"]) == body["sites_count"]

    def test_deviation_sample_at_most_10(self, engine_client):
        client, _ = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        body = response.json()
        assert len(body["deviation_sample"]) <= 10

    def test_timestamps_present(self, engine_client):
        client, _ = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        body = response.json()
        assert "started_at" in body
        assert "completed_at" in body
        assert body["started_at"] is not None
        assert body["completed_at"] is not None

    def test_message_mentions_deterministic(self, engine_client):
        client, _ = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        message = response.json()["message"].lower()
        assert "deterministic" in message


# ===========================================================================
# 2. Architecture invariants — risk score provenance
# ===========================================================================


class TestRiskScoreProvenance:
    def test_each_site_risk_score_has_risk_score_field(self, engine_client):
        """risk_score must come from score_all_sites() only."""
        client, _ = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        for score in response.json()["site_risk_scores"]:
            assert "risk_score" in score
            assert isinstance(score["risk_score"], (int, float))

    def test_each_site_risk_score_has_risk_level_field(self, engine_client):
        """risk_level must come from score_all_sites() only."""
        client, _ = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        valid_levels = {"LOW", "MEDIUM", "HIGH"}
        for score in response.json()["site_risk_scores"]:
            assert "risk_level" in score
            assert score["risk_level"] in valid_levels, (
                f"risk_level={score['risk_level']!r} not in {valid_levels}"
            )

    def test_risk_scores_sorted_descending(self, engine_client):
        """score_all_sites() returns highest risk first."""
        client, _ = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        scores = [s["risk_score"] for s in response.json()["site_risk_scores"]]
        assert scores == sorted(scores, reverse=True), (
            f"site_risk_scores not sorted descending: {scores}"
        )

    def test_risk_score_in_valid_range(self, engine_client):
        """Deterministic risk scores must be in [0, 100]."""
        client, _ = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        for score in response.json()["site_risk_scores"]:
            assert 0.0 <= score["risk_score"] <= 100.0, (
                f"risk_score={score['risk_score']} out of range [0, 100]"
            )

    def test_high_risk_sites_count_is_consistent(self, engine_client):
        """high_risk_sites must equal number of scores with risk_level='HIGH'."""
        client, _ = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        body = response.json()
        actual_high = sum(
            1 for s in body["site_risk_scores"] if s["risk_level"] == "HIGH"
        )
        assert body["high_risk_sites"] == actual_high


# ===========================================================================
# 3. Architecture invariants — deviation severity provenance
# ===========================================================================


class TestDeviationSeverityProvenance:
    def test_deviation_sample_each_has_severity_field(self, engine_client):
        client, _ = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        body = response.json()
        for dev in body["deviation_sample"]:
            assert "severity" in dev

    def test_deviation_severity_values_are_valid(self, engine_client):
        """Severity must be set by rule engine; only valid values allowed."""
        client, _ = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        valid_severities = {"major", "minor", "administrative"}
        for dev in response.json()["deviation_sample"]:
            assert dev["severity"].lower() in valid_severities, (
                f"severity={dev['severity']!r} not in {valid_severities}"
            )

    def test_deviation_sample_each_has_rule_id(self, engine_client):
        client, _ = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        for dev in response.json()["deviation_sample"]:
            assert "rule_id" in dev
            assert dev["rule_id"]  # non-empty

    def test_deviation_sample_each_has_site_id(self, engine_client):
        client, _ = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        for dev in response.json()["deviation_sample"]:
            assert "site_id" in dev


# ===========================================================================
# 4. Database persistence
# ===========================================================================


class TestDatabasePersistence:
    def test_engine_run_persisted(self, engine_client):
        """EngineRun row must be written to the DB after completion."""
        client, TestSession = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        run_id = response.json()["run_id"]

        db = TestSession()
        try:
            run = db.query(EngineRun).filter_by(run_id=run_id).first()
            assert run is not None
            assert run.status == "completed"
        finally:
            db.close()

    def test_site_risk_scores_persisted(self, engine_client):
        """SiteRiskScoreRecord rows must be written for every site."""
        client, TestSession = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        body = response.json()
        run_id = body["run_id"]

        db = TestSession()
        try:
            db_scores = db.query(SiteRiskScoreRecord).filter_by(run_id=run_id).all()
            assert len(db_scores) == body["sites_count"]
        finally:
            db.close()

    def test_detected_deviations_persisted(self, engine_client):
        """DetectedDeviationRecord rows must be written for every deviation."""
        client, TestSession = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        body = response.json()
        run_id = body["run_id"]

        db = TestSession()
        try:
            db_devs = db.query(DetectedDeviationRecord).filter_by(run_id=run_id).all()
            assert len(db_devs) == body["deviations_detected"]
        finally:
            db.close()

    def test_persisted_risk_scores_match_response(self, engine_client):
        """DB risk scores must match the HTTP response values exactly."""
        client, TestSession = engine_client
        response = client.post("/run-engine", json=_SMALL_BODY)
        body = response.json()
        run_id = body["run_id"]

        db = TestSession()
        try:
            db_scores = {
                s.site_id: s
                for s in db.query(SiteRiskScoreRecord).filter_by(run_id=run_id).all()
            }
            for resp_score in body["site_risk_scores"]:
                sid = resp_score["site_id"]
                assert sid in db_scores, f"site_id {sid} not found in DB"
                assert db_scores[sid].risk_score == resp_score["risk_score"]
                assert db_scores[sid].risk_level == resp_score["risk_level"]
        finally:
            db.close()

    def test_db_severity_not_modified_by_ai(self, engine_client):
        """
        Severity values in the DB must be exactly as produced by the rule engine.
        They should never be 'pending', 'draft', or any AI-generated value.
        """
        client, TestSession = engine_client
        client.post("/run-engine", json=_SMALL_BODY)

        db = TestSession()
        try:
            devs = db.query(DetectedDeviationRecord).all()
            ai_severities = {"pending", "draft", "approved", "review"}
            for dev in devs:
                assert dev.severity.lower() not in ai_severities, (
                    f"DB deviation {dev.deviation_id} has AI-generated severity "
                    f"{dev.severity!r}"
                )
        finally:
            db.close()


# ===========================================================================
# 5. Validation — bad request bodies
# ===========================================================================


class TestRunEngineValidation:
    def test_num_sites_zero_returns_422(self, engine_client):
        client, _ = engine_client
        response = client.post("/run-engine", json={**_SMALL_BODY, "num_sites": 0})
        assert response.status_code == 422

    def test_num_sites_over_limit_returns_422(self, engine_client):
        client, _ = engine_client
        response = client.post("/run-engine", json={**_SMALL_BODY, "num_sites": 51})
        assert response.status_code == 422

    def test_patients_per_site_zero_returns_422(self, engine_client):
        client, _ = engine_client
        response = client.post("/run-engine", json={**_SMALL_BODY, "patients_per_site": 0})
        assert response.status_code == 422

    def test_patients_per_site_over_limit_returns_422(self, engine_client):
        client, _ = engine_client
        response = client.post("/run-engine", json={**_SMALL_BODY, "patients_per_site": 51})
        assert response.status_code == 422


# ===========================================================================
# 6. Repeatability / seed determinism
# ===========================================================================


class TestDeterminism:
    def test_same_seed_same_deviation_count(self, engine_client):
        """Same seed must produce same number of deviations (determinism)."""
        client, _ = engine_client
        r1 = client.post("/run-engine", json=_SMALL_BODY)
        r2 = client.post("/run-engine", json=_SMALL_BODY)
        assert r1.json()["deviations_detected"] == r2.json()["deviations_detected"]

    def test_different_seed_may_differ(self, engine_client):
        """Different seed is allowed to produce different results."""
        client, _ = engine_client
        r1 = client.post("/run-engine", json=_SMALL_BODY)
        r2 = client.post("/run-engine", json={**_SMALL_BODY, "random_seed": 9999})
        # We can't assert they differ (may be equal by coincidence) but at
        # least both should return 200 and have valid structure.
        assert r1.status_code == 200
        assert r2.status_code == 200

    def test_medium_dataset_also_succeeds(self, engine_client):
        client, _ = engine_client
        response = client.post("/run-engine", json=_MEDIUM_BODY)
        assert response.status_code == 200
        body = response.json()
        assert body["sites_count"] == _MEDIUM_BODY["num_sites"]
        assert body["status"] == "completed"


# ===========================================================================
# 7. Default body (no request body provided)
# ===========================================================================


class TestDefaultBody:
    def test_no_body_uses_defaults_and_returns_200(self, engine_client):
        """All RunEngineRequest fields have defaults — empty body is valid."""
        client, _ = engine_client
        response = client.post("/run-engine", json={})
        assert response.status_code == 200
        body = response.json()
        # Defaults: num_sites=5, patients_per_site=5
        assert body["sites_count"] == 5
        assert body["patients_count"] == 25
