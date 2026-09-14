# src/ai — IBM watsonx.ai integration layer

from src.ai.watsonx_service import WatsonxService, WatsonxConfig, WatsonxError
from src.ai.protocol_extractor import (
    ProtocolExtractor,
    ExtractedRule,
    ExtractionResult,
    ProtocolExtractionError,
    ProtocolParseError,
)
from src.ai.risk_explainer import (
    RiskExplainer,
    SiteRiskContext,
    DeviationSummary,
    RiskExplanation,
    RiskExplainerError,
    RiskExplainerParseError,
)
from src.ai.capa_generator import (
    CapaGenerator,
    CapaDraft,
    DeviationDetail,
    CapaGeneratorError,
    CapaParseError,
)

__all__ = [
    # Core service
    "WatsonxService",
    "WatsonxConfig",
    "WatsonxError",
    # Protocol extraction
    "ProtocolExtractor",
    "ExtractedRule",
    "ExtractionResult",
    "ProtocolExtractionError",
    "ProtocolParseError",
    # Risk explanation
    "RiskExplainer",
    "SiteRiskContext",
    "DeviationSummary",
    "RiskExplanation",
    "RiskExplainerError",
    "RiskExplainerParseError",
    # CAPA generation
    "CapaGenerator",
    "CapaDraft",
    "DeviationDetail",
    "CapaGeneratorError",
    "CapaParseError",
]
