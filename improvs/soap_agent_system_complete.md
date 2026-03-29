# SOAP Note Generation System - Complete Implementation Package

## Executive Summary

This package contains a production-ready agentic AI system for generating medical SOAP notes using CrewAI. The system addresses hallucination, misattribution, and quality issues through specialized multi-agent collaboration with validation and reflection patterns.

**Architecture:** 5 specialized agents in sequential workflow with iterative refinement
**Key Innovation:** Every extracted data point includes source attribution (speaker, timestamp, quote)
**Quality Control:** Dual validation (Validator + Reflector agents) with automatic revision loops

---

## Project Structure

```
soap_agent_system/
├── README.md
├── requirements.txt
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── setup.py
├── prometheus.yml
├── main.py
├── crew_config.py
├── agents/
│   ├── __init__.py
│   ├── transcription_agent.py
│   ├── clinical_extractor.py
│   ├── validator_agent.py
│   ├── soap_builder.py
│   └── reflector_agent.py
├── tools/
│   ├── __init__.py
│   ├── medical_ontology_lookup.py
│   ├── transcript_search.py
│   └── vital_validator.py
├── schemas/
│   ├── __init__.py
│   └── clinical_data.py
├── utils/
│   ├── __init__.py
│   ├── error_handling.py
│   └── batch_processor.py
├── monitoring/
│   ├── __init__.py
│   └── metrics.py
├── tests/
│   ├── __init__.py
│   ├── test_validator_agent.py
│   ├── test_extractor.py
│   ├── test_integration.py
│   └── fixtures/
│       └── sample_encounter.txt
└── api/
    ├── __init__.py
    ├── fastapi_server.py
    └── routes.py
```

---

## File Contents

### 1. requirements.txt

```txt
# Core dependencies
crewai==0.28.0
crewai-tools==0.2.6
pydantic==2.5.0
python-dotenv==1.0.0
langchain==0.1.0
langchain-openai==0.0.5

# LLM Providers (choose one or both)
openai==1.12.0
anthropic==0.18.0

# Audio transcription services (choose based on your preference)
openai-whisper==20231117
assemblyai==0.17.0
deepgram-sdk==2.12.0

# Audio processing
librosa==0.10.1
soundfile==0.12.1
pydub==0.25.1

# API server
fastapi==0.109.0
uvicorn[standard]==0.27.0
python-multipart==0.0.6

# Utilities
tenacity==8.2.3
redis==5.0.1
aioredis==2.0.1

# Monitoring
prometheus-client==0.19.0

# Development
pytest==8.0.0
pytest-asyncio==0.23.3
pytest-cov==4.1.0
black==24.1.1
ruff==0.1.14
mypy==1.8.0
```

---

### 2. .env.example

```bash
# LLM Provider API Keys (use one or both)
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# Choose which LLM to use for each agent type
# Options: "openai" or "anthropic"
TRANSCRIPTION_LLM_PROVIDER=openai
EXTRACTION_LLM_PROVIDER=openai
VALIDATION_LLM_PROVIDER=openai
BUILDER_LLM_PROVIDER=anthropic
REFLECTOR_LLM_PROVIDER=anthropic

# Model specifications
OPENAI_MODEL=gpt-4-turbo-preview
ANTHROPIC_MODEL=claude-3-opus-20240229

# Transcription Service (choose one)
TRANSCRIPTION_SERVICE=assemblyai  # Options: assemblyai, deepgram, whisper
ASSEMBLYAI_API_KEY=your-assemblyai-key-here
DEEPGRAM_API_KEY=your-deepgram-key-here

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_CACHE_TTL=3600

# Application Settings
MAX_REVISIONS=2
QUALITY_THRESHOLD=0.8
CREW_VERBOSE=2
CREW_MEMORY_ENABLED=true

# API Server
API_HOST=0.0.0.0
API_PORT=8000
API_WORKERS=4

# Monitoring
PROMETHEUS_PORT=9090
ENABLE_METRICS=true

# Logging
LOG_LEVEL=INFO
LOG_FILE=logs/soap_system.log

# Security
API_KEY_ENABLED=false
API_KEY=your-api-key-for-authentication

# HIPAA Compliance
ENABLE_PHI_LOGGING=false
AUDIT_LOG_PATH=logs/audit.log
```

---

### 3. schemas/clinical_data.py

```python
"""
Clinical data schemas with source attribution for traceability.
Every extracted data point includes speaker, timestamp, and quote.
"""
from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from enum import Enum


class Speaker(str, Enum):
    """Speaker identification in conversation."""
    DOCTOR = "doctor"
    PATIENT = "patient"
    UNKNOWN = "unknown"


class SourceReference(BaseModel):
    """
    Reference to transcript source for complete traceability.
    
    Enables validation that data was actually stated in conversation.
    """
    speaker: Speaker
    timestamp: str = Field(description="Timestamp in format HH:MM:SS or seconds")
    quote: str = Field(description="Exact quote from transcript")
    confidence: float = Field(ge=0.0, le=1.0, default=1.0)
    
    class Config:
        json_schema_extra = {
            "example": {
                "speaker": "patient",
                "timestamp": "00:02:15",
                "quote": "I've been having chest pain for three days",
                "confidence": 0.95
            }
        }


class VitalSign(BaseModel):
    """
    Structured vital sign with validation flags.
    
    Critical: is_measured vs patient-reported affects clinical interpretation.
    """
    name: str = Field(description="Vital sign name (e.g., 'Blood Pressure', 'Heart Rate')")
    value: str = Field(description="Measured or reported value")
    unit: str = Field(description="Unit of measurement")
    source: SourceReference
    is_measured: bool = Field(
        description="True if directly measured by clinician, False if patient-reported"
    )
    validated: bool = Field(
        default=False,
        description="Set to True after validation confirms presence in transcript"
    )
    validation_notes: Optional[str] = Field(
        default=None,
        description="Any concerns or notes from validation process"
    )
    
    @field_validator('name')
    @classmethod
    def normalize_vital_name(cls, v: str) -> str:
        """Normalize vital sign names to title case."""
        return v.title()


class Symptom(BaseModel):
    """
    Patient symptom with detailed clinical characteristics.
    
    Follows HPI (History of Present Illness) documentation standards.
    """
    description: str = Field(description="Primary symptom description")
    onset: Optional[str] = Field(default=None, description="When symptom started")
    duration: Optional[str] = Field(default=None, description="How long symptom has lasted")
    severity: Optional[str] = Field(
        default=None,
        description="Severity (mild, moderate, severe) or numeric scale"
    )
    characteristics: List[str] = Field(
        default_factory=list,
        description="Specific qualities (sharp, dull, radiating, etc.)"
    )
    aggravating_factors: List[str] = Field(default_factory=list)
    relieving_factors: List[str] = Field(default_factory=list)
    associated_symptoms: List[str] = Field(default_factory=list)
    source: SourceReference
    
    class Config:
        json_schema_extra = {
            "example": {
                "description": "Chest pain",
                "onset": "3 days ago",
                "duration": "Intermittent, lasts 10-15 minutes",
                "severity": "7/10",
                "characteristics": ["sharp", "substernal", "radiating to left arm"],
                "aggravating_factors": ["exertion", "stress"],
                "relieving_factors": ["rest"],
                "associated_symptoms": ["shortness of breath", "diaphoresis"],
                "source": {
                    "speaker": "patient",
                    "timestamp": "00:01:30",
                    "quote": "I get this sharp pain in my chest when I walk upstairs",
                    "confidence": 0.95
                }
            }
        }


class Medication(BaseModel):
    """Current or newly prescribed medication."""
    name: str = Field(description="Generic or brand name")
    dosage: Optional[str] = Field(default=None, description="Dose amount")
    frequency: Optional[str] = Field(default=None, description="How often taken")
    route: Optional[str] = Field(default=None, description="Administration route (PO, IV, etc.)")
    indication: Optional[str] = Field(default=None, description="Why prescribed")
    source: SourceReference


class PhysicalExamFinding(BaseModel):
    """Objective physical examination finding."""
    system: str = Field(description="Body system examined (cardiovascular, respiratory, etc.)")
    finding: str = Field(description="Examination result")
    abnormal: bool = Field(default=False, description="True if abnormal finding")
    source: SourceReference


class ClinicalData(BaseModel):
    """
    Complete structured clinical data extraction from encounter.
    
    This is the output of the Clinical Extractor Agent and input to Validator.
    """
    # Required fields
    chief_complaint: str = Field(description="Primary reason for visit in patient's words")
    
    # Clinical data lists
    vitals: List[VitalSign] = Field(default_factory=list)
    symptoms: List[Symptom] = Field(default_factory=list)
    medications: List[Medication] = Field(default_factory=list)
    physical_exam_findings: List[PhysicalExamFinding] = Field(default_factory=list)
    
    # History
    patient_history: List[str] = Field(
        default_factory=list,
        description="Past medical history, surgical history, family history, social history"
    )
    
    # Metadata
    extraction_confidence: float = Field(
        ge=0.0, le=1.0,
        description="Overall confidence in extraction quality"
    )
    unsupported_claims: List[str] = Field(
        default_factory=list,
        description="Claims that couldn't be traced to transcript - potential hallucinations"
    )
    extraction_timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "chief_complaint": "Chest pain for 3 days",
                "vitals": [],
                "symptoms": [],
                "medications": [],
                "physical_exam_findings": [],
                "patient_history": [],
                "extraction_confidence": 0.92,
                "unsupported_claims": []
            }
        }


class SOAPNote(BaseModel):
    """
    Final SOAP (Subjective, Objective, Assessment, Plan) note output.
    
    This is the deliverable document for clinical records.
    """
    subjective: str = Field(
        description="Patient's narrative: chief complaint, HPI, PMH, medications, ROS"
    )
    objective: str = Field(
        description="Objective findings: vitals, physical exam, lab results"
    )
    assessment: str = Field(
        description="Clinical impression, differential diagnoses, severity assessment"
    )
    plan: str = Field(
        description="Diagnostic workup, treatment plan, follow-up, patient education"
    )
    
    # Traceability and quality metrics
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Encounter metadata (patient_id, encounter_id, timestamps)"
    )
    evidence_map: Dict[str, List[SourceReference]] = Field(
        default_factory=dict,
        description="Maps each section's claims to source references"
    )
    quality_score: float = Field(
        ge=0.0, le=1.0,
        description="Quality assessment from Reflector Agent"
    )
    revision_count: int = Field(
        default=0,
        description="Number of times note was revised"
    )
    validation_report: Optional[str] = Field(
        default=None,
        description="Summary of validation findings and concerns"
    )
    generation_timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "subjective": "Patient presents with...",
                "objective": "Vital signs: BP 120/80...",
                "assessment": "1. Chest pain, likely angina...",
                "plan": "1. EKG and cardiac enzymes...",
                "metadata": {
                    "patient_id": "P-12345",
                    "encounter_id": "E-67890",
                    "provider": "Dr. Smith"
                },
                "evidence_map": {},
                "quality_score": 0.87,
                "revision_count": 1,
                "validation_report": "All vitals validated against transcript"
            }
        }


class ValidationReport(BaseModel):
    """Output from Validator Agent."""
    validated_data: ClinicalData
    validation_passed: bool
    concerns: List[str] = Field(default_factory=list)
    hallucinations_detected: int = 0
    misattributions_detected: int = 0
    confidence_score: float = Field(ge=0.0, le=1.0)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ReflectionReport(BaseModel):
    """Output from Reflector Agent."""
    quality_score: float = Field(ge=0.0, le=1.0)
    strengths: List[str] = Field(default_factory=list)
    improvements_needed: List[str] = Field(default_factory=list)
    specific_suggestions: Dict[str, str] = Field(
        default_factory=dict,
        description="Maps SOAP section to specific improvement text"
    )
    requires_revision: bool
    timestamp: datetime = Field(default_factory=datetime.utcnow)
```

---

### 4. tools/vital_validator.py

```python
"""
Vital sign validation tool with clinical range checking and transcript verification.
"""
from typing import Dict, List, Optional, Tuple
from crewai_tools import BaseTool
import re


class VitalValidatorTool(BaseTool):
    """
    Validates vital signs against clinical ranges and transcript evidence.
    
    This is a critical safety tool that prevents hallucinated vitals from
    entering clinical documentation.
    """
    
    name: str = "vital_validator"
    description: str = (
        "Validates vital signs against normal clinical ranges and checks if "
        "they appear in the transcript. Returns validation status with any concerns. "
        "Use this tool for EVERY vital sign extracted before including in SOAP note."
    )
    
    # Normal ranges for adult vitals (adjust for pediatric/geriatric as needed)
    VITAL_RANGES: Dict[str, Tuple[float, float]] = {
        "blood_pressure_systolic": (90, 140),
        "blood_pressure_diastolic": (60, 90),
        "heart_rate": (60, 100),
        "pulse": (60, 100),
        "respiratory_rate": (12, 20),
        "temperature_f": (97.0, 99.5),
        "temperature_c": (36.1, 37.5),
        "oxygen_saturation": (95, 100),
        "spo2": (95, 100),
        "weight_kg": (40, 200),
        "weight_lb": (88, 440),
        "height_cm": (140, 210),
        "height_in": (55, 83),
        "bmi": (18.5, 30),
    }
    
    def _run(
        self,
        vital_name: str,
        vital_value: str,
        transcript: str,
        vital_unit: Optional[str] = None
    ) -> Dict:
        """
        Validate a vital sign against transcript and clinical norms.
        
        Args:
            vital_name: Name of vital (e.g., "blood_pressure", "heart_rate")
            vital_value: The value to validate (e.g., "120/80", "72")
            transcript: Full conversation transcript to search
            vital_unit: Unit of measurement (optional, e.g., "mmHg", "bpm")
            
        Returns:
            Dict with validation results:
            {
                "is_valid": bool,
                "in_transcript": bool,
                "concerns": List[str],
                "range_check": Optional[str],
                "recommendation": str
            }
        """
        result = {
            "is_valid": True,
            "concerns": [],
            "in_transcript": False,
            "range_check": None,
            "recommendation": "Include in SOAP note"
        }
        
        # 1. Check if mentioned in transcript
        result["in_transcript"] = self._check_transcript_presence(
            vital_name, vital_value, transcript
        )
        
        if not result["in_transcript"]:
            result["concerns"].append(
                f"⚠️ CRITICAL: {vital_name} value '{vital_value}' NOT found in transcript. "
                f"This may be a hallucination. DO NOT include in SOAP note unless "
                f"you can find explicit mention."
            )
            result["is_valid"] = False
            result["recommendation"] = "EXCLUDE from SOAP note - not in transcript"
        
        # 2. Range validation for numeric vitals
        range_result = self._validate_range(vital_name, vital_value)
        if range_result:
            result["range_check"] = range_result["message"]
            if not range_result["in_range"]:
                result["concerns"].append(
                    f"Value {vital_value} is outside normal range. "
                    f"This is clinically significant and should be highlighted."
                )
        
        # 3. Format validation
        format_valid, format_msg = self._validate_format(vital_name, vital_value)
        if not format_valid:
            result["concerns"].append(format_msg)
        
        return result
    
    def _check_transcript_presence(
        self, vital_name: str, vital_value: str, transcript: str
    ) -> bool:
        """
        Check if vital sign appears anywhere in transcript.
        
        Uses fuzzy matching to account for different phrasings.
        """
        transcript_lower = transcript.lower()
        
        # Generate search terms
        search_terms = [
            vital_name.replace("_", " "),
            vital_value.lower(),
        ]
        
        # Add common synonyms
        synonyms = {
            "blood_pressure": ["bp", "blood pressure", "pressure"],
            "heart_rate": ["hr", "heart rate", "pulse"],
            "respiratory_rate": ["rr", "respiratory rate", "breathing rate", "respirations"],
            "temperature": ["temp", "temperature"],
            "oxygen_saturation": ["o2 sat", "oxygen", "spo2", "saturation"],
        }
        
        vital_key = vital_name.lower().replace(" ", "_")
        if vital_key in synonyms:
            search_terms.extend(synonyms[vital_key])
        
        # Check for any term presence
        for term in search_terms:
            if term and term in transcript_lower:
                return True
        
        # Check for numeric value near vital name
        # Extract numbers from vital_value
        numbers = re.findall(r'\d+\.?\d*', vital_value)
        for number in numbers:
            for term in search_terms[:3]:  # Check against main terms
                pattern = rf'{term}.*?{number}|{number}.*?{term}'
                if re.search(pattern, transcript_lower, re.DOTALL):
                    return True
        
        return False
    
    def _validate_range(self, vital_name: str, vital_value: str) -> Optional[Dict]:
        """Validate numeric value against clinical ranges."""
        vital_key = vital_name.lower().replace(" ", "_")
        
        if vital_key not in self.VITAL_RANGES:
            return None
        
        min_val, max_val = self.VITAL_RANGES[vital_key]
        
        try:
            # Extract numeric value (handle formats like "120/80", "98.6", "72 bpm")
            if "/" in vital_value:  # Blood pressure
                numbers = [float(n) for n in re.findall(r'\d+\.?\d*', vital_value)]
                if len(numbers) >= 1:
                    numeric_value = numbers[0]  # Check systolic
                else:
                    return None
            else:
                numeric_value = float(re.findall(r'\d+\.?\d*', vital_value)[0])
            
            in_range = min_val <= numeric_value <= max_val
            
            return {
                "in_range": in_range,
                "message": f"Normal range: {min_val}-{max_val}",
                "value": numeric_value
            }
        except (ValueError, IndexError):
            return {
                "in_range": False,
                "message": f"Could not parse numeric value from '{vital_value}'",
                "value": None
            }
    
    def _validate_format(self, vital_name: str, vital_value: str) -> Tuple[bool, str]:
        """Validate format of vital sign value."""
        vital_key = vital_name.lower().replace(" ", "_")
        
        # Blood pressure should be in format XXX/YYY
        if "blood_pressure" in vital_key:
            if not re.match(r'^\d{2,3}/\d{2,3}', vital_value):
                return False, "Blood pressure should be in format XXX/YYY"
        
        # Temperature should have decimal
        if "temperature" in vital_key:
            if not re.search(r'\d+\.\d+', vital_value):
                return False, "Temperature should include decimal (e.g., 98.6)"
        
        return True, "Format valid"
```

---

### 5. tools/transcript_search.py

```python
"""
Transcript search tool for finding clinical information with speaker attribution.
"""
from typing import List, Dict, Optional
from crewai_tools import BaseTool
import re
from difflib import SequenceMatcher


class TranscriptSearchTool(BaseTool):
    """
    Search transcript for specific medical terms with context and speaker info.
    
    Returns matching segments with sufficient context for clinical interpretation.
    """
    
    name: str = "transcript_search"
    description: str = (
        "Search the transcript for specific medical terms, symptoms, or statements. "
        "Returns matching quotes with speaker (doctor/patient), timestamp, and "
        "surrounding context. Use this tool to verify ANY claim before including "
        "in extracted data or SOAP note."
    )
    
    def _run(
        self,
        query: str,
        transcript: str,
        speaker_filter: Optional[str] = None,
        context_lines: int = 2
    ) -> List[Dict]:
        """
        Search transcript for query terms.
        
        Args:
            query: Search terms (space-separated or phrase)
            transcript: Full transcript with speaker labels
            speaker_filter: Optional filter for "doctor" or "patient"
            context_lines: Number of lines of context to include
            
        Returns:
            List of matching segments with context:
            [
                {
                    "speaker": "patient",
                    "timestamp": "00:01:30",
                    "text": "matched text",
                    "context_before": "previous statement",
                    "context_after": "next statement",
                    "matched_terms": ["term1"],
                    "confidence": 0.95
                }
            ]
        """
        # Parse transcript into structured segments
        segments = self._parse_transcript(transcript)
        
        if not segments:
            return [{
                "error": "Could not parse transcript. Expected format: [speaker] [timestamp] text",
                "raw_transcript_sample": transcript[:200]
            }]
        
        # Perform search
        results = []
        query_terms = query.lower().split()
        
        for i, segment in enumerate(segments):
            # Apply speaker filter
            if speaker_filter and segment["speaker"].lower() != speaker_filter.lower():
                continue
            
            text_lower = segment["text"].lower()
            
            # Check for matches (exact terms or fuzzy)
            matched_terms = []
            match_score = 0.0
            
            for term in query_terms:
                if term in text_lower:
                    matched_terms.append(term)
                    match_score += 1.0
                else:
                    # Fuzzy matching for medical terms (account for typos)
                    for word in text_lower.split():
                        similarity = SequenceMatcher(None, term, word).ratio()
                        if similarity > 0.85:  # High similarity threshold
                            matched_terms.append(f"{term}~{word}")
                            match_score += similarity
            
            if matched_terms:
                # Get context
                context_before = []
                context_after = []
                
                for j in range(max(0, i - context_lines), i):
                    context_before.append(segments[j]["text"])
                
                for j in range(i + 1, min(len(segments), i + context_lines + 1)):
                    context_after.append(segments[j]["text"])
                
                confidence = min(match_score / len(query_terms), 1.0)
                
                results.append({
                    "speaker": segment["speaker"],
                    "timestamp": segment["timestamp"],
                    "text": segment["text"],
                    "context_before": " | ".join(context_before),
                    "context_after": " | ".join(context_after),
                    "matched_terms": matched_terms,
                    "confidence": round(confidence, 2),
                    "segment_index": i
                })
        
        # Sort by confidence
        results.sort(key=lambda x: x["confidence"], reverse=True)
        
        return results if results else [{
            "message": f"No matches found for query: '{query}'",
            "suggestion": "Try synonyms or broader terms"
        }]
    
    def _parse_transcript(self, transcript: str) -> List[Dict]:
        """
        Parse transcript into structured segments.
        
        Expected format: [speaker] [timestamp] text
        Example: [doctor] [00:01:30] How are you feeling today?
        """
        segments = []
        
        # Pattern: [speaker] [timestamp] text
        pattern = r'\[(doctor|patient|provider|nurse)\]\s*\[([^\]]+)\]\s*(.+?)(?=\[(?:doctor|patient|provider|nurse)\]|$)'
        
        matches = re.findall(pattern, transcript, re.IGNORECASE | re.DOTALL)
        
        for speaker, timestamp, text in matches:
            segments.append({
                "speaker": speaker.lower(),
                "timestamp": timestamp.strip(),
                "text": text.strip()
            })
        
        return segments
    
    def get_full_context(
        self, transcript: str, segment_index: int, window: int = 5
    ) -> str:
        """
        Get full context around a specific segment.
        
        Useful for understanding the broader conversation context.
        """
        segments = self._parse_transcript(transcript)
        
        if segment_index >= len(segments):
            return "Invalid segment index"
        
        start = max(0, segment_index - window)
        end = min(len(segments), segment_index + window + 1)
        
        context_segments = segments[start:end]
        
        formatted = []
        for i, seg in enumerate(context_segments, start=start):
            marker = ">>> " if i == segment_index else "    "
            formatted.append(
                f"{marker}[{seg['speaker']}] [{seg['timestamp']}] {seg['text']}"
            )
        
        return "\n".join(formatted)
```

---

### 6. tools/medical_ontology_lookup.py

```python
"""
Medical ontology lookup tool for standardizing clinical terminology.
"""
from typing import Dict, List, Optional
from crewai_tools import BaseTool


class MedicalOntologyTool(BaseTool):
    """
    Look up medical terms for standardization and validation.
    
    In production, this should integrate with:
    - SNOMED CT for symptoms/findings
    - ICD-10 for diagnoses
    - RxNorm for medications
    - LOINC for lab tests
    
    For now, uses a simplified local ontology.
    """
    
    name: str = "medical_ontology_lookup"
    description: str = (
        "Look up medical terms to find standard names, synonyms, and validate "
        "symptom descriptions. Helps standardize clinical terminology and catch "
        "incorrect or ambiguous terms. Use this tool when extracting symptoms "
        "or diagnoses to ensure proper clinical terminology."
    )
    
    # Simplified symptom ontology (expand with real SNOMED CT in production)
    SYMPTOM_ONTOLOGY = {
        "chest pain": {
            "standard_term": "Chest Pain",
            "snomed_id": "29857009",
            "synonyms": ["chest discomfort", "thoracic pain", "precordial pain"],
            "qualifiers": [
                "crushing", "sharp", "dull", "burning", "stabbing",
                "radiating", "substernal", "left-sided", "right-sided"
            ],
            "associated_symptoms": [
                "shortness of breath", "diaphoresis", "nausea",
                "palpitations", "dizziness"
            ],
            "red_flags": [
                "radiating to left arm", "jaw pain", "diaphoresis",
                "associated shortness of breath"
            ]
        },
        "shortness of breath": {
            "standard_term": "Dyspnea",
            "snomed_id": "267036007",
            "synonyms": [
                "difficulty breathing", "breathlessness", "SOB",
                "air hunger", "labored breathing"
            ],
            "qualifiers": [
                "at rest", "on exertion", "orthopnea",
                "paroxysmal nocturnal dyspnea", "acute", "chronic"
            ],
            "associated_symptoms": [
                "wheezing", "cough", "chest tightness", "chest pain"
            ],
            "red_flags": ["at rest", "sudden onset", "unable to speak in full sentences"]
        },
        "cough": {
            "standard_term": "Cough",
            "snomed_id": "49727002",
            "synonyms": ["coughing"],
            "qualifiers": [
                "productive", "dry", "nocturnal", "chronic", "acute",
                "paroxysmal", "barking", "whooping"
            ],
            "characteristics": [
                "sputum color", "hemoptysis", "duration", "frequency"
            ],
            "associated_symptoms": [
                "fever", "shortness of breath", "wheezing",
                "chest pain", "sore throat"
            ]
        },
        "fever": {
            "standard_term": "Pyrexia",
            "snomed_id": "386661006",
            "synonyms": ["elevated temperature", "febrile", "hyperthermia"],
            "qualifiers": [
                "high-grade", "low-grade", "intermittent",
                "continuous", "relapsing"
            ],
            "specifications": {
                "low_grade": "< 101°F (38.3°C)",
                "high_grade": "> 103°F (39.4°C)"
            },
            "associated_symptoms": [
                "chills", "rigors", "night sweats", "malaise"
            ]
        },
        "headache": {
            "standard_term": "Headache",
            "snomed_id": "25064002",
            "synonyms": ["cephalalgia", "head pain"],
            "qualifiers": [
                "throbbing", "stabbing", "pressure-like", "band-like",
                "unilateral", "bilateral", "frontal", "temporal", "occipital"
            ],
            "associated_symptoms": [
                "nausea", "vomiting", "photophobia", "phonophobia",
                "visual aura", "neck stiffness"
            ],
            "red_flags": [
                "sudden onset (thunderclap)", "worst headache of life",
                "fever with neck stiffness", "neurological deficits",
                "new onset after age 50"
            ]
        },
        "abdominal pain": {
            "standard_term": "Abdominal Pain",
            "snomed_id": "21522001",
            "synonyms": ["stomach pain", "belly pain", "tummy ache"],
            "qualifiers": [
                "sharp", "dull", "cramping", "colicky", "burning",
                "RUQ", "LUQ", "RLQ", "LLQ", "epigastric", "periumbilical"
            ],
            "associated_symptoms": [
                "nausea", "vomiting", "diarrhea", "constipation",
                "fever", "bloating"
            ],
            "red_flags": [
                "rebound tenderness", "guarding", "rigid abdomen",
                "blood in stool", "persistent vomiting"
            ]
        },
        "dizziness": {
            "standard_term": "Dizziness",
            "snomed_id": "404640003",
            "synonyms": ["lightheadedness", "vertigo", "presyncope"],
            "qualifiers": [
                "spinning sensation (vertigo)", "lightheaded",
                "unsteady", "room spinning", "positional"
            ],
            "associated_symptoms": [
                "nausea", "hearing loss", "tinnitus",
                "palpitations", "chest pain"
            ],
            "clarifications": {
                "vertigo": "spinning sensation",
                "presyncope": "feeling of impending faint",
                "disequilibrium": "unsteadiness/imbalance"
            }
        },
        "fatigue": {
            "standard_term": "Fatigue",
            "snomed_id": "84229001",
            "synonyms": [
                "tiredness", "exhaustion", "lack of energy",
                "malaise", "weakness"
            ],
            "qualifiers": [
                "acute", "chronic", "exertional", "post-exertional malaise"
            ],
            "associated_symptoms": [
                "weakness", "poor concentration", "sleep disturbance",
                "weight changes", "mood changes"
            ]
        }
    }
    
    # Medication ontology (simplified - use RxNorm in production)
    MEDICATION_ONTOLOGY = {
        "aspirin": {
            "generic_name": "Aspirin",
            "brand_names": ["Bayer", "Bufferin", "Ecotrin"],
            "drug_class": "Antiplatelet agent, NSAID",
            "common_doses": ["81mg", "325mg"],
            "routes": ["PO"]
        },
        "metformin": {
            "generic_name": "Metformin",
            "brand_names": ["Glucophage", "Fortamet"],
            "drug_class": "Biguanide antidiabetic",
            "common_doses": ["500mg", "850mg", "1000mg"],
            "routes": ["PO"]
        },
        "lisinopril": {
            "generic_name": "Lisinopril",
            "brand_names": ["Prinivil", "Zestril"],
            "drug_class": "ACE inhibitor",
            "common_doses": ["5mg", "10mg", "20mg", "40mg"],
            "routes": ["PO"]
        }
    }
    
    def _run(
        self,
        term: str,
        category: str = "symptom"
    ) -> Dict:
        """
        Look up medical term in appropriate ontology.
        
        Args:
            term: Medical term to look up
            category: "symptom", "medication", "diagnosis"
            
        Returns:
            Dict with standardized information and suggestions
        """
        term_lower = term.lower().strip()
        
        if category == "symptom":
            return self._lookup_symptom(term_lower)
        elif category == "medication":
            return self._lookup_medication(term_lower)
        else:
            return {
                "term": term,
                "category": category,
                "note": "Category not yet supported. Supported: symptom, medication"
            }
    
    def _lookup_symptom(self, term: str) -> Dict:
        """Look up symptom in ontology."""
        # Direct match
        if term in self.SYMPTOM_ONTOLOGY:
            result = self.SYMPTOM_ONTOLOGY[term].copy()
            result["input_term"] = term
            result["match_type"] = "exact"
            return result
        
        # Synonym match
        for standard_term, info in self.SYMPTOM_ONTOLOGY.items():
            if term in [s.lower() for s in info.get("synonyms", [])]:
                result = info.copy()
                result["input_term"] = term
                result["match_type"] = "synonym"
                result["use_instead"] = info["standard_term"]
                return result
        
        # Partial match (fuzzy)
        for standard_term, info in self.SYMPTOM_ONTOLOGY.items():
            if term in standard_term or standard_term in term:
                result = info.copy()
                result["input_term"] = term
                result["match_type"] = "partial"
                result["suggestion"] = f"Did you mean '{info['standard_term']}'?"
                return result
        
        # Not found
        return {
            "input_term": term,
            "match_type": "not_found",
            "standard_term": term.title(),
            "note": (
                "Term not found in ontology. Verify clinical accuracy and spelling. "
                "Consider using transcript_search to confirm exact wording used."
            ),
            "recommendation": "Use exact patient wording if ambiguous"
        }
    
    def _lookup_medication(self, term: str) -> Dict:
        """Look up medication in ontology."""
        term_lower = term.lower()
        
        # Direct match (generic name)
        if term_lower in self.MEDICATION_ONTOLOGY:
            result = self.MEDICATION_ONTOLOGY[term_lower].copy()
            result["input_term"] = term
            result["match_type"] = "exact_generic"
            return result
        
        # Brand name match
        for generic, info in self.MEDICATION_ONTOLOGY.items():
            if term.title() in info.get("brand_names", []):
                result = info.copy()
                result["input_term"] = term
                result["match_type"] = "brand_name"
                result["recommendation"] = f"Use generic name: {info['generic_name']}"
                return result
        
        return {
            "input_term": term,
            "match_type": "not_found",
            "note": "Medication not found in ontology. Verify spelling and check transcript.",
            "recommendation": "Use exact medication name from transcript"
        }
    
    def get_differential_diagnoses(self, symptoms: List[str]) -> List[Dict]:
        """
        Suggest differential diagnoses based on symptom constellation.
        
        This is a simplified version - in production, use clinical decision
        support systems.
        """
        # Simplified differential suggestions
        differential_patterns = {
            ("chest pain", "shortness of breath"): [
                {"diagnosis": "Acute Coronary Syndrome", "urgency": "EMERGENT"},
                {"diagnosis": "Pulmonary Embolism", "urgency": "EMERGENT"},
                {"diagnosis": "Pneumonia", "urgency": "URGENT"},
            ],
            ("fever", "cough"): [
                {"diagnosis": "Upper Respiratory Infection", "urgency": "ROUTINE"},
                {"diagnosis": "Pneumonia", "urgency": "URGENT"},
                {"diagnosis": "Bronchitis", "urgency": "ROUTINE"},
            ],
            ("headache", "fever", "neck stiffness"): [
                {"diagnosis": "Meningitis", "urgency": "EMERGENT"},
            ],
        }
        
        symptoms_normalized = tuple(sorted([s.lower().strip() for s in symptoms]))
        
        # Check for pattern matches
        for pattern, differentials in differential_patterns.items():
            if all(s in symptoms_normalized for s in pattern):
                return differentials
        
        return [{
            "note": "No specific differential pattern matched. Requires clinical correlation."
        }]
```

---

### 7. agents/transcription_agent.py

```python
"""
Transcription Agent - Specialized in speaker diarization and accurate transcription.
"""
from crewai import Agent
from typing import Optional


def create_transcription_agent(
    llm_provider: str = "openai",
    model: Optional[str] = None
) -> Agent:
    """
    Create transcription agent specialized in medical audio transcription.
    
    Pattern: Tool Use
    Focus: Speaker diarization, high accuracy, confidence scoring
    
    Args:
        llm_provider: "openai" or "anthropic"
        model: Specific model name (optional)
    
    Returns:
        Configured Agent instance
    """
    return Agent(
        role="Medical Transcription Specialist",
        
        goal=(
            "Produce highly accurate transcriptions of medical conversations with "
            "clear speaker attribution (doctor vs patient) and precise timestamps. "
            "Flag any low-confidence segments for human review. Prioritize accuracy "
            "over speed - patient safety depends on correct transcription."
        ),
        
        backstory=(
            "You are an expert medical transcriptionist with 15 years of experience "
            "in clinical documentation. You have deep familiarity with medical "
            "terminology, anatomy, medications, and procedures. You can distinguish "
            "between healthcare provider speech patterns (using medical jargon) and "
            "patient speech patterns (using lay terminology). "
            "\n\n"
            "You understand that accurate speaker attribution is CRITICAL - confusing "
            "who said what could lead to dangerous clinical errors. For example, if a "
            "patient reports 'no chest pain' but the transcription attributes it to "
            "the doctor, it completely changes the clinical picture. "
            "\n\n"
            "Your core principles: "
            "1. When unsure about a word, flag it - never guess medical terms "
            "2. Mark low-confidence segments with [UNCERTAIN] tags "
            "3. Preserve exact patient wording (don't correct grammar) "
            "4. Use standard medical abbreviations only when clearly stated "
            "5. Include natural speech patterns (pauses, corrections) as they provide context"
        ),
        
        verbose=True,
        allow_delegation=False,
        
        # Tools would be configured here in production
        # tools=[WhisperTranscriptionTool(), DeepgramDiarizationTool()]
        tools=[],
        
        # LLM configuration based on provider
        llm=model if model else (
            "gpt-4-turbo-preview" if llm_provider == "openai" 
            else "claude-3-opus-20240229"
        ),
    )


# Example output format for this agent
TRANSCRIPTION_OUTPUT_FORMAT = """
Expected output format:

[doctor] [00:00:15] Good morning. What brings you in today?
[patient] [00:00:18] I've been having this chest pain for about three days now.
[doctor] [00:00:23] Can you describe the pain for me? Where is it located?
[patient] [00:00:27] It's right here in the middle of my chest. It feels like pressure, like someone's sitting on my chest.
[doctor] [00:00:35] Does it radiate anywhere? To your arm, jaw, or back?
[patient] [00:00:39] Yeah, sometimes it goes down my left arm.
[UNCERTAIN] [00:00:42] [unclear speech]
[doctor] [00:00:45] Let me take your blood pressure.
[doctor] [00:00:58] Your blood pressure is one twenty over eighty.

Confidence Scoring:
- Overall transcript confidence: 0.95
- Low confidence segments: 1 (marked with [UNCERTAIN])
- Speaker attribution confidence: 0.98

Notes:
- Clear speaker differentiation maintained throughout
- Medical terminology correctly transcribed
- One brief unclear segment flagged at 00:00:42
"""
```

---

### 8. agents/clinical_extractor.py

```python
"""
Clinical Extractor Agent - Extracts structured data from transcripts.
"""
from crewai import Agent
from typing import Optional, List
from tools.transcript_search import TranscriptSearchTool
from tools.medical_ontology_lookup import MedicalOntologyTool


def create_clinical_extractor_agent(
    llm_provider: str = "openai",
    model: Optional[str] = None,
    custom_tools: Optional[List] = None
) -> Agent:
    """
    Create clinical data extraction agent.
    
    Pattern: Tool Use + Planning
    Focus: Structured extraction with mandatory source attribution
    
    This agent NEVER fabricates data - everything must be traceable to transcript.
    """
    tools = custom_tools or [
        TranscriptSearchTool(),
        MedicalOntologyTool(),
    ]
    
    return Agent(
        role="Clinical Data Extraction Specialist",
        
        goal=(
            "Extract ALL clinically relevant information from the medical transcript "
            "into structured, standardized format. Every single extracted data point "
            "MUST include: speaker (doctor/patient), timestamp, direct quote from "
            "transcript, and confidence score. "
            "\n\n"
            "CRITICAL RULE: If information is not explicitly stated in the transcript, "
            "do NOT include it. It is better to have incomplete but accurate data than "
            "complete but fabricated data."
        ),
        
        backstory=(
            "You are a clinical documentation specialist with expertise in structured "
            "data extraction and medical coding. You have been trained specifically to "
            "combat a common AI problem: hallucination of clinical data. "
            "\n\n"
            "You follow the fundamental principle of medical documentation: "
            "'If it's not documented, it didn't happen' - but you reverse it: "
            "'If it didn't happen in the transcript, don't document it.' "
            "\n\n"
            "Your workflow for EVERY piece of extracted data: "
            "1. Use transcript_search tool to find mentions of the data "
            "2. Read the actual quote from the transcript "
            "3. Identify who said it (doctor or patient) "
            "4. Note the timestamp "
            "5. Use medical_ontology_lookup to standardize terminology "
            "6. Only then add it to the structured output "
            "\n\n"
            "You are meticulous and skeptical. If you can't find a direct quote to "
            "support a data point, you flag it as 'unsupported' rather than including it. "
            "You understand that fabricated vital signs or symptoms could lead to "
            "incorrect diagnoses and patient harm. "
            "\n\n"
            "Special attention areas: "
            "- Vital signs: NEVER assume values not stated "
            "- Symptom characteristics: Use exact patient words, not medical interpretation "
            "- Medications: Include exact names, doses, frequencies as stated "
            "- Timeline: Preserve exact onset/duration descriptions "
            "- Negatives: Document what patient explicitly denies (e.g., 'no fever')"
        ),
        
        verbose=True,
        allow_delegation=False,
        tools=tools,
        
        llm=model if model else (
            "gpt-4-turbo-preview" if llm_provider == "openai"
            else "claude-3-opus-20240229"
        ),
    )


# Example extraction prompt template
EXTRACTION_PROMPT_TEMPLATE = """
You are performing clinical data extraction on the following transcript.

TRANSCRIPT:
{transcript}

TASK:
Extract the following information. For EACH item, you MUST:
1. Use the transcript_search tool to find the relevant quote
2. Include the speaker, timestamp, and exact quote
3. Use medical_ontology_lookup for standardization

EXTRACT:
1. Chief Complaint: Main reason for visit (in patient's words)

2. History of Present Illness:
   - For each symptom, extract:
     * Description
     * Onset (when it started)
     * Duration
     * Severity (if mentioned)
     * Characteristics (quality of symptom)
     * Aggravating factors
     * Relieving factors
     * Associated symptoms
     * SOURCE for each!

3. Vital Signs:
   - ONLY include if explicitly measured or stated
   - Mark whether measured by doctor or reported by patient
   - Include: BP, HR, RR, Temp, O2 sat, weight, height

4. Physical Examination:
   - Only findings explicitly stated by doctor
   - Note normal vs. abnormal

5. Medications:
   - Current medications patient is taking
   - Include: name, dose, frequency, indication if stated

6. Past Medical History:
   - Any mentioned past diagnoses or surgeries

7. Review of Systems:
   - Any positive or pertinent negative findings

CRITICAL: If you cannot find explicit mention in the transcript, add to "unsupported_claims" list.
Mark your extraction_confidence based on how complete and well-supported the data is.
"""
```

---

### 9. agents/validator_agent.py

```python
"""
Validator Agent - Validates extracted data against transcript and clinical norms.
"""
from crewai import Agent
from typing import Optional, List
from tools.vital_validator import VitalValidatorTool
from tools.transcript_search import TranscriptSearchTool


def create_validator_agent(
    llm_provider: str = "openai",
    model: Optional[str] = None,
    custom_tools: Optional[List] = None
) -> Agent:
    """
    Create validation agent that catches hallucinations and errors.
    
    Pattern: Reflection
    Focus: Quality assurance, hallucination detection
    
    This agent is the primary defense against fabricated data reaching clinical records.
    """
    tools = custom_tools or [
        VitalValidatorTool(),
        TranscriptSearchTool(),
    ]
    
    return Agent(
        role="Clinical Data Validator",
        
        goal=(
            "Validate that every piece of extracted clinical data is genuinely present "
            "in the transcript and clinically plausible. Flag any data that appears "
            "fabricated, misattributed, or clinically inconsistent. Your job is to catch "
            "errors BEFORE they reach clinical documentation."
        ),
        
        backstory=(
            "You are a medical quality assurance specialist with 20 years of experience "
            "in clinical documentation auditing. You have reviewed thousands of medical "
            "records and have developed an expert eye for inconsistencies, fabrications, "
            "and documentation errors. "
            "\n\n"
            "You understand that AI systems can 'hallucinate' - generate plausible-sounding "
            "but completely fabricated data. You've seen cases where: "
            "- Blood pressure readings were invented when none were taken "
            "- Patient statements were attributed to the doctor (or vice versa) "
            "- Symptom details were embellished beyond what patient actually said "
            "- Normal exam findings were assumed when no exam was documented "
            "\n\n"
            "Your validation process is systematic: "
            "\n"
            "For EVERY vital sign: "
            "1. Use vital_validator tool to check if it appears in transcript "
            "2. Verify the value is within plausible clinical ranges "
            "3. Confirm who stated it (measured vs. patient-reported) "
            "4. If validation fails, mark as unsupported "
            "\n"
            "For symptoms and findings: "
            "1. Use transcript_search to find the original quote "
            "2. Verify the speaker attribution is correct "
            "3. Check that characteristics match what was actually said "
            "4. Ensure no embellishment or assumption occurred "
            "\n"
            "For medications: "
            "1. Confirm exact names, doses, frequencies match transcript "
            "2. Don't accept 'commonly prescribed doses' if not stated "
            "\n\n"
            "You are appropriately skeptical. You understand that patient safety depends "
            "on accurate documentation. When in doubt, you flag it. You would rather have "
            "incomplete but accurate records than complete but unreliable ones. "
            "\n\n"
            "Your output includes: "
            "- Validated (True/False) flag for each data point "
            "- List of specific concerns found "
            "- Count of hallucinations detected "
            "- Count of misattributions detected "
            "- Overall validation confidence score "
            "- Recommendation (APPROVE or REQUEST REVISION)"
        ),
        
        verbose=True,
        allow_delegation=False,
        tools=tools,
        
        llm=model if model else (
            "gpt-4-turbo-preview" if llm_provider == "openai"
            else "claude-3-opus-20240229"
        ),
    )


# Example validation checklist
VALIDATION_CHECKLIST = """
VALIDATION CHECKLIST:

□ VITAL SIGNS VALIDATION:
  For each vital sign:
  □ Appears in transcript? (use vital_validator)
  □ Within normal clinical range?
  □ Speaker correctly identified (measured vs reported)?
  □ Unit of measurement appropriate?
  
□ SYMPTOM VALIDATION:
  For each symptom:
  □ Description matches patient's actual words?
  □ Characteristics actually stated (not assumed)?
  □ Onset/duration/severity from transcript?
  □ No embellishment beyond what was said?
  
□ SPEAKER ATTRIBUTION:
  □ Chief complaint from patient?
  □ Physical exam findings from doctor?
  □ No confusion between doctor/patient statements?
  
□ MEDICATION VALIDATION:
  □ Names match transcript exactly?
  □ Doses explicitly stated (not assumed)?
  □ Frequencies mentioned?
  
□ FABRICATION CHECK:
  □ No invented vitals?
  □ No assumed physical exam findings?
  □ No symptom details not mentioned?
  □ No medications added "because typical"?
  
VALIDATION RESULT:
- Hallucinations detected: [count]
- Misattributions detected: [count]
- Unsupported claims: [list]
- Recommendation: [APPROVE / REQUEST REVISION / REJECT]
"""
```

---

### 10. agents/soap_builder.py

```python
"""
SOAP Builder Agent - Constructs professional clinical notes from validated data.
"""
from crewai import Agent
from typing import Optional, List
from tools.transcript_search import TranscriptSearchTool


def create_soap_builder_agent(
    llm_provider: str = "openai",
    model: Optional[str] = None,
    custom_tools: Optional[List] = None
) -> Agent:
    """
    Create SOAP note builder agent.
    
    Pattern: Planning
    Focus: Professional clinical documentation that meets standards
    
    This agent transforms structured data into comprehensive SOAP notes.
    """
    tools = custom_tools or [TranscriptSearchTool()]
    
    return Agent(
        role="SOAP Note Composer",
        
        goal=(
            "Create comprehensive, professional SOAP notes that meet clinical "
            "documentation standards and provide clear, actionable information for "
            "healthcare providers. Every statement should be traceable to validated "
            "source data."
        ),
        
        backstory=(
            "You are a senior physician with 20 years of clinical experience and "
            "recognized expertise in medical documentation. Other physicians frequently "
            "compliment your notes for being thorough yet concise, clinically relevant, "
            "and easy to follow. "
            "\n\n"
            "You understand the multiple purposes of medical documentation: "
            "1. Continuity of care - other providers need to understand the case "
            "2. Medical-legal protection - complete accurate documentation "
            "3. Billing support - proper documentation of complexity "
            "4. Quality metrics - demonstrating appropriate care "
            "5. Patient safety - clear communication of findings and plans "
            "\n\n"
            "Your SOAP note writing principles: "
            "\n"
            "SUBJECTIVE: "
            "- Start with chief complaint in patient's own words (quoted) "
            "- Present HPI in chronological narrative "
            "- Include all pertinent positives and negatives "
            "- Document relevant PMH, medications, allergies "
            "- Include pertinent ROS findings "
            "- Use patient's language for symptoms, medical terms for context "
            "\n"
            "OBJECTIVE: "
            "- Always include vital signs if documented "
            "- Present physical exam systematically "
            "- Distinguish normal from abnormal findings clearly "
            "- Include relevant lab/imaging results if available "
            "- Only include findings that were actually documented "
            "\n"
            "ASSESSMENT: "
            "- State clear clinical impression "
            "- Include differential diagnoses when appropriate "
            "- Integrate subjective and objective findings "
            "- Assess severity/acuity "
            "- Show clinical reasoning "
            "\n"
            "PLAN: "
            "- Organize by problem if multiple issues "
            "- Include diagnostic workup clearly "
            "- Specify treatments with exact details (drug, dose, route, frequency) "
            "- State follow-up plans and timeframes "
            "- Document patient education provided "
            "- Include safety netting advice "
            "- Specify when to return or escalate care "
            "\n\n"
            "Quality markers you ensure: "
            "- Specific rather than generic (not 'vital signs normal' but actual values) "
            "- Complete but concise (no unnecessary wordiness) "
            "- Logical flow (findings support assessment, assessment supports plan) "
            "- Actionable (next steps are clear) "
            "- Professional medical language throughout "
            "- Proper medical abbreviations only "
            "\n\n"
            "You AVOID common documentation pitfalls: "
            "- Generic phrases like 'patient doing well' "
            "- Copy-paste errors or inconsistencies "
            "- Unclear pronouns (always specify 'patient' or 'doctor') "
            "- Vague time references (use specific dates/times) "
            "- Missing red flags or safety concerns "
            "- Plans without clear next steps"
        ),
        
        verbose=True,
        allow_delegation=False,
        tools=tools,
        
        llm=model if model else (
            "gpt-4-turbo-preview" if llm_provider == "openai"
            else "claude-3-opus-20240229"
        ),
    )


# Example SOAP note template
SOAP_NOTE_TEMPLATE = """
SOAP NOTE TEMPLATE:

SUBJECTIVE:
Chief Complaint: [In patient's words, quoted]

History of Present Illness:
[Patient name] is a [age]-year-old [gender] who presents with [chief complaint].
[Chronological narrative of present illness including: onset, location, duration, 
characteristics, aggravating/relieving factors, radiation, timing, severity, 
associated symptoms]

Review of Systems: [Pertinent positives and negatives]

Past Medical History: [Relevant diagnoses]
Past Surgical History: [Relevant surgeries]
Medications: [Current medications with doses]
Allergies: [Drug allergies and reactions]
Social History: [Relevant social factors]
Family History: [Relevant family history]

OBJECTIVE:
Vital Signs: 
- BP: [value] mmHg
- HR: [value] bpm
- RR: [value] breaths/min
- Temp: [value] °F
- O2 Sat: [value]% on room air
[Include weight, height, BMI if documented]

Physical Examination:
General: [appearance, distress level]
[System by system examination - only include examined systems]
HEENT: [if examined]
Cardiovascular: [if examined]
Respiratory: [if examined]
Abdomen: [if examined]
Neurological: [if examined]
Skin: [if relevant]
Extremities: [if examined]

[Labs/Imaging results if available]

ASSESSMENT:
1. [Primary diagnosis or working diagnosis]
   [Brief clinical reasoning: key findings that support this]
   [Differential diagnoses if appropriate]
   [Severity assessment]

2. [Additional problems if present]

PLAN:
1. [Problem 1 or overall plan if single issue]
   Diagnostic:
   - [Specific tests ordered]
   
   Therapeutic:
   - [Specific medications: drug, dose, route, frequency, duration]
   - [Other treatments]
   
   Follow-up:
   - [Specific timeframe and reason]
   - [Specific safety netting instructions]
   
   Patient Education:
   - [Specific topics discussed]
   - [Warning signs to watch for]

[Repeat for additional problems if multiple]

[Include evidence_map linking each section to source references]
"""
```

---

### 11. agents/reflector_agent.py

```python
"""
Reflector Agent - Reviews SOAP notes for quality and completeness.
"""
from crewai import Agent
from typing import Optional, List
from tools.transcript_search import TranscriptSearchTool


def create_reflector_agent(
    llm_provider: str = "anthropic",  # Claude excellent at reflection
    model: Optional[str] = None,
    custom_tools: Optional[List] = None
) -> Agent:
    """
    Create reflection agent for quality review.
    
    Pattern: Reflection
    Focus: Quality assurance, identifying improvements
    
    This agent ensures SOAP notes meet high clinical standards before finalization.
    """
    tools = custom_tools or [TranscriptSearchTool()]
    
    return Agent(
        role="Clinical Documentation Reviewer",
        
        goal=(
            "Review generated SOAP notes for clinical quality, completeness, accuracy, "
            "and adherence to documentation standards. Identify specific improvements "
            "with references to source transcript. Ensure notes would meet the standards "
            "of expert clinical documentation."
        ),
        
        backstory=(
            "You are a medical director who oversees clinical documentation quality "
            "at a large healthcare system. You review hundreds of notes weekly and "
            "have developed an expert eye for documentation excellence vs. mediocrity. "
            "\n\n"
            "You can immediately spot: "
            "- Generic statements that could apply to any patient "
            "- Missing details that were available in the encounter "
            "- Logical inconsistencies (findings don't support assessment) "
            "- Inadequate plans (unclear next steps) "
            "- Safety concerns not addressed "
            "- Poor clinical reasoning "
            "\n\n"
            "Your review process: "
            "\n"
            "COMPLETENESS CHECK (score 0-1): "
            "- Was all relevant information from transcript included? "
            "- Are there gaps that would confuse another provider? "
            "- Is temporal sequence clear? "
            "- Are all active problems addressed in plan? "
            "\n"
            "SPECIFICITY CHECK (score 0-1): "
            "- Are vital signs specified (not 'normal')? "
            "- Are symptom characteristics detailed? "
            "- Are medications fully specified (drug/dose/route/frequency)? "
            "- Are follow-up plans concrete (not 'as needed')? "
            "- Is there enough detail for another provider to act? "
            "\n"
            "CLINICAL COHERENCE CHECK (score 0-1): "
            "- Do objective findings support the assessment? "
            "- Does the plan logically follow from assessment? "
            "- Are differential diagnoses considered appropriately? "
            "- Is severity/acuity appropriately conveyed? "
            "- Would an expert agree with the clinical reasoning? "
            "\n"
            "PROFESSIONAL QUALITY CHECK (score 0-1): "
            "- Is the language professional and clear? "
            "- Is medical terminology used appropriately? "
            "- Is the note well-organized and easy to follow? "
            "- Are there grammatical errors or unclear statements? "
            "\n"
            "SAFETY CHECK (critical): "
            "- Are red flags appropriately addressed? "
            "- Are safety netting instructions adequate? "
            "- Are high-risk scenarios considered? "
            "- Is follow-up plan safe for the condition? "
            "\n\n"
            "Your feedback is: "
            "- Specific (cite exactly what needs improvement) "
            "- Actionable (provide concrete suggestions) "
            "- Evidence-based (reference transcript for missing details) "
            "- Constructive (focus on improving patient care) "
            "\n\n"
            "You calculate an overall quality_score (0-1) as the weighted average: "
            "- Completeness: 25% "
            "- Specificity: 30% "
            "- Clinical Coherence: 25% "
            "- Professional Quality: 20% "
            "\n"
            "If quality_score < 0.8, you request revision with specific improvements. "
            "You may iterate up to 2 times to achieve acceptable quality. "
            "\n\n"
            "You understand that excellent documentation: "
            "- Protects patient safety "
            "- Supports care continuity "
            "- Meets legal standards "
            "- Enables quality improvement "
            "And that is why you maintain high standards."
        ),
        
        verbose=True,
        allow_delegation=False,
        tools=tools,
        
        llm=model if model else "claude-3-opus-20240229",
    )


# Example reflection output
REFLECTION_OUTPUT_TEMPLATE = """
SOAP NOTE QUALITY REVIEW:

Overall Quality Score: [0.XX]

SCORES BY DIMENSION:
- Completeness: [0.XX] / 1.0
- Specificity: [0.XX] / 1.0
- Clinical Coherence: [0.XX] / 1.0
- Professional Quality: [0.XX] / 1.0

STRENGTHS:
1. [Specific strength with example]
2. [Specific strength with example]

IMPROVEMENTS NEEDED:
1. [Specific issue]
   Current: "[quote from SOAP note]"
   Problem: [why this is insufficient]
   Improvement: [specific suggestion]
   Reference: [transcript quote showing missing information]

2. [Next specific issue]
   ...

SAFETY CONCERNS:
[Any patient safety issues identified, or "None identified"]

RECOMMENDATION: [APPROVE / REQUEST REVISION / NEEDS SIGNIFICANT WORK]

[If revision requested, provide specific revision instructions]
"""
```

---

### 12. crew_config.py

```python
"""
CrewAI workflow configuration - orchestrates the multi-agent system.
"""
from crewai import Crew, Task, Process
from typing import Dict, Optional
import os
from dotenv import load_dotenv

from agents.transcription_agent import create_transcription_agent
from agents.clinical_extractor import create_clinical_extractor_agent
from agents.validator_agent import create_validator_agent
from agents.soap_builder import create_soap_builder_agent
from agents.reflector_agent import create_reflector_agent

load_dotenv()


def create_soap_generation_crew(
    enable_memory: bool = True,
    enable_cache: bool = True,
    verbose_level: int = 2
) -> Crew:
    """
    Create the complete SOAP note generation crew.
    
    Architecture:
    Sequential workflow: Transcription → Extraction → Validation → Building → Reflection
    
    Pattern: Multi-Agent Collaboration (Chapter 5 of Agentic Design Patterns)
    Key principle: Specialized agents with clear handoffs and validation loops
    
    Args:
        enable_memory: Enable conversation memory across tasks
        enable_cache: Cache intermediate results for efficiency
        verbose_level: 0 (quiet), 1 (normal), 2 (detailed)
    
    Returns:
        Configured Crew instance
    """
    
    # Get LLM configurations from environment
    transcription_provider = os.getenv("TRANSCRIPTION_LLM_PROVIDER", "openai")
    extraction_provider = os.getenv("EXTRACTION_LLM_PROVIDER", "openai")
    validation_provider = os.getenv("VALIDATION_LLM_PROVIDER", "openai")
    builder_provider = os.getenv("BUILDER_LLM_PROVIDER", "anthropic")
    reflector_provider = os.getenv("REFLECTOR_LLM_PROVIDER", "anthropic")
    
    # Initialize specialized agents
    transcription_agent = create_transcription_agent(llm_provider=transcription_provider)
    extractor_agent = create_clinical_extractor_agent(llm_provider=extraction_provider)
    validator_agent = create_validator_agent(llm_provider=validation_provider)
    builder_agent = create_soap_builder_agent(llm_provider=builder_provider)
    reflector_agent = create_reflector_agent(llm_provider=reflector_provider)
    
    # Define tasks with clear objectives and expected outputs
    
    # TASK 1: Transcription
    transcription_task = Task(
        description=(
            "Transcribe the provided audio file into structured text format with "
            "speaker diarization and timestamps. "
            "\n\n"
            "REQUIREMENTS: "
            "1. Use speaker diarization to identify doctor vs patient "
            "2. Format each segment as: [speaker] [timestamp] text "
            "3. Include confidence scores for each segment "
            "4. Flag any low-confidence or unclear segments with [UNCERTAIN] "
            "5. Preserve exact wording (don't correct patient's grammar) "
            "6. Use medical terminology only when clearly stated "
            "\n\n"
            "INPUT: "
            "Audio file path: {audio_file_path} "
            "\n\n"
            "EXAMPLE OUTPUT: "
            "[doctor] [00:00:15] What brings you in today? "
            "[patient] [00:00:18] I've been having chest pain for three days. "
            "[doctor] [00:00:23] Can you describe the pain? "
            "[patient] [00:00:27] It's a pressure in the middle of my chest. "
            "\n"
            "Overall Confidence: 0.95 "
            "Low Confidence Segments: 0"
        ),
        expected_output=(
            "Complete formatted transcript with: "
            "- [speaker] [timestamp] text format for all segments "
            "- Overall transcript confidence score "
            "- List of any uncertain segments "
            "- Total duration and segment count"
        ),
        agent=transcription_agent,
    )
    
    # TASK 2: Clinical Data Extraction
    extraction_task = Task(
        description=(
            "Extract structured clinical data from the transcript using the tools provided. "
            "\n\n"
            "CRITICAL RULES: "
            "1. For EVERY data point, use transcript_search tool to find the source "
            "2. Include speaker, timestamp, and direct quote for all extracted items "
            "3. Use medical_ontology_lookup to standardize terminology "
            "4. If information is NOT in transcript, add to unsupported_claims list "
            "5. NEVER fabricate vitals, symptoms, or other data "
            "\n\n"
            "EXTRACT THE FOLLOWING: "
            "\n"
            "1. Chief Complaint (in patient's words) "
            "2. Symptoms with complete characterization: "
            "   - Description, onset, duration, severity "
            "   - Characteristics, aggravating/relieving factors "
            "   - Associated symptoms "
            "3. Vital Signs (ONLY if explicitly stated): "
            "   - Mark whether measured or patient-reported "
            "4. Physical Exam Findings (ONLY if doctor stated) "
            "5. Current Medications "
            "6. Past Medical History "
            "7. Review of Systems findings "
            "\n\n"
            "WORKFLOW: "
            "1. Identify candidate data point "
            "2. Use transcript_search to find quote "
            "3. Verify speaker and timestamp "
            "4. Use medical_ontology_lookup for standardization "
            "5. Add to structured output with source reference "
            "6. Calculate extraction_confidence "
            "\n\n"
            "OUTPUT FORMAT: ClinicalData schema with all source references"
        ),
        expected_output=(
            "ClinicalData object (JSON) containing: "
            "- chief_complaint with source "
            "- vitals list (each with source reference) "
            "- symptoms list (each with full characterization and source) "
            "- medications list (with doses, frequencies, sources) "
            "- physical_exam_findings list (with sources) "
            "- patient_history list "
            "- extraction_confidence score "
            "- unsupported_claims list (should be empty if done correctly)"
        ),
        agent=extractor_agent,
        context=[transcription_task],  # Depends on transcription output
    )
    
    # TASK 3: Validation
    validation_task = Task(
        description=(
            "Validate the extracted clinical data against the transcript and clinical norms. "
            "\n\n"
            "VALIDATION PROCESS: "
            "\n"
            "For EACH vital sign: "
            "1. Use vital_validator tool with: "
            "   - vital_name "
            "   - vital_value "
            "   - transcript "
            "2. Check result: "
            "   - If in_transcript=False → Mark as unsupported, set validated=False "
            "   - If outside normal range → Add concern note "
            "3. Update vital with validated flag and notes "
            "\n"
            "For EACH symptom: "
            "1. Use transcript_search to find original quote "
            "2. Verify characteristics match what was said (no embellishment) "
            "3. Confirm speaker attribution correct "
            "\n"
            "For medications: "
            "1. Verify exact names, doses, frequencies against transcript "
            "\n"
            "SPEAKER ATTRIBUTION CHECK: "
            "- Chief complaint should be from patient "
            "- Physical exam should be from doctor "
            "- Vitals should be clearly attributed "
            "\n\n"
            "COUNT: "
            "- Hallucinations detected (data not in transcript) "
            "- Misattributions detected (wrong speaker) "
            "\n\n"
            "DECISION: "
            "- If zero hallucinations and high confidence → APPROVE "
            "- If minor issues (1-2 concerns) → APPROVE WITH NOTES "
            "- If major issues (3+ concerns or critical errors) → REQUEST REVISION"
        ),
        expected_output=(
            "ValidationReport containing: "
            "- validated_data (ClinicalData with updated validated flags) "
            "- validation_passed (boolean) "
            "- concerns (list of specific issues found) "
            "- hallucinations_detected (count) "
            "- misattributions_detected (count) "
            "- confidence_score "
            "- detailed validation notes"
        ),
        agent=validator_agent,
        context=[transcription_task, extraction_task],
    )
    
    # TASK 4: SOAP Note Building
    soap_building_task = Task(
        description=(
            "Create a comprehensive SOAP note from the validated clinical data. "
            "\n\n"
            "SOAP NOTE STRUCTURE: "
            "\n"
            "SUBJECTIVE: "
            "- Start with: 'Patient presents with [chief complaint]' "
            "- Write HPI in chronological narrative "
            "- Include all symptom characteristics "
            "- Document relevant PMH, medications, allergies "
            "- Include pertinent ROS "
            "\n"
            "OBJECTIVE: "
            "- ALWAYS list vital signs if documented (with actual values) "
            "- Present physical exam systematically "
            "- Only include validated findings (validated=True) "
            "- Distinguish normal from abnormal clearly "
            "\n"
            "ASSESSMENT: "
            "- State primary clinical impression "
            "- Show clinical reasoning (how findings support impression) "
            "- Include differential diagnoses if appropriate "
            "- Assess severity/acuity "
            "\n"
            "PLAN: "
            "- Organize by problem if multiple issues "
            "- Specify diagnostics to be ordered "
            "- Detail treatments (drug, dose, route, frequency) "
            "- State follow-up timeframe and reasons "
            "- Include patient education points "
            "- Provide safety netting instructions "
            "\n\n"
            "QUALITY REQUIREMENTS: "
            "- Be specific (not 'vital signs normal', list actual values) "
            "- Be complete (address all active problems) "
            "- Be logical (findings support assessment, assessment supports plan) "
            "- Be professional (proper medical language) "
            "- Be actionable (clear next steps) "
            "\n\n"
            "CREATE evidence_map: "
            "Map each major statement to its source reference from validated_data"
        ),
        expected_output=(
            "SOAPNote object containing: "
            "- subjective (comprehensive S section) "
            "- objective (detailed O section with vitals) "
            "- assessment (clear A section with reasoning) "
            "- plan (actionable P section) "
            "- evidence_map (links to sources) "
            "- metadata (patient_id, encounter_id, etc.) "
            "- initial quality_score estimate"
        ),
        agent=builder_agent,
        context=[transcription_task, validation_task],
    )
    
    # TASK 5: Reflection and Quality Review
    reflection_task = Task(
        description=(
            "Review the generated SOAP note for quality, completeness, and clinical excellence. "
            "\n\n"
            "EVALUATION CRITERIA: "
            "\n"
            "1. COMPLETENESS (weight: 0.25): "
            "   - Was all relevant information from transcript included? "
            "   - Are there unexplained gaps? "
            "   - Is temporal sequence clear? "
            "   - Score 0.0-1.0 "
            "\n"
            "2. SPECIFICITY (weight: 0.30): "
            "   - Are vitals specified with actual values? "
            "   - Are symptoms detailed (not generic)? "
            "   - Are medications fully specified? "
            "   - Are plans concrete? "
            "   - Score 0.0-1.0 "
            "\n"
            "3. CLINICAL COHERENCE (weight: 0.25): "
            "   - Do findings support assessment? "
            "   - Does plan follow from assessment? "
            "   - Is reasoning sound? "
            "   - Score 0.0-1.0 "
            "\n"
            "4. PROFESSIONAL QUALITY (weight: 0.20): "
            "   - Clear and well-organized? "
            "   - Proper medical language? "
            "   - Free of errors? "
            "   - Score 0.0-1.0 "
            "\n\n"
            "CALCULATE quality_score = weighted average "
            "\n\n"
            "IDENTIFY IMPROVEMENTS: "
            "- For each dimension < 0.8, identify specific issues "
            "- Use transcript_search to find missing details "
            "- Provide concrete suggestions with examples "
            "\n\n"
            "DECISION: "
            "- If quality_score >= 0.8 → APPROVE "
            "- If 0.7 <= quality_score < 0.8 → APPROVE WITH SUGGESTIONS "
            "- If quality_score < 0.7 → REQUEST REVISION "
            "\n\n"
            "If requesting revision, provide: "
            "- Specific sections to improve "
            "- Exact changes needed "
            "- Reference to transcript for missing info"
        ),
        expected_output=(
            "ReflectionReport containing: "
            "- quality_score (overall, 0-1) "
            "- dimension_scores (dict with each criterion) "
            "- strengths (list of positive points) "
            "- improvements_needed (list of specific issues) "
            "- specific_suggestions (dict: section → improvement text) "
            "- requires_revision (boolean) "
            "- If approved: revised SOAPNote object with updated quality_score"
        ),
        agent=reflector_agent,
        context=[transcription_task, validation_task, soap_building_task],
    )
    
    # Create the crew with sequential process
    crew = Crew(
        agents=[
            transcription_agent,
            extractor_agent,
            validator_agent,
            builder_agent,
            reflector_agent,
        ],
        tasks=[
            transcription_task,
            extraction_task,
            validation_task,
            soap_building_task,
            reflection_task,
        ],
        process=Process.sequential,  # Linear workflow with handoffs
        verbose=verbose_level,
        memory=enable_memory,  # Enables context retention across tasks
        cache=enable_cache,    # Caches results for efficiency
        # Optional: add planning capability
        # planning=True,  # Enables dynamic replanning if needed
    )
    
    return crew


def create_revision_crew(
    original_crew: Crew,
    feedback: str
) -> Crew:
    """
    Create a revision crew for iterative improvement.
    
    When quality_score < threshold, this crew focuses only on:
    Builder → Reflector loop
    
    Args:
        original_crew: The original crew instance
        feedback: Specific feedback from first reflection
    
    Returns:
        Revision-focused Crew
    """
    builder_agent = create_soap_builder_agent()
    reflector_agent = create_reflector_agent()
    
    # Revision-focused building task
    revision_task = Task(
        description=(
            f"Revise the SOAP note based on this feedback: "
            f"\n\n{feedback}"
            f"\n\n"
            f"Make specific improvements in the areas identified. "
            f"Use transcript_search to add missing details. "
            f"Ensure all suggestions are addressed."
        ),
        expected_output="Revised SOAPNote object",
        agent=builder_agent,
    )
    
    # Re-evaluation task
    reevaluation_task = Task(
        description=(
            "Re-evaluate the revised SOAP note. "
            "Check if previous feedback was addressed. "
            "Calculate new quality_score."
        ),
        expected_output="Updated ReflectionReport with new quality_score",
        agent=reflector_agent,
        context=[revision_task],
    )
    
    revision_crew = Crew(
        agents=[builder_agent, reflector_agent],
        tasks=[revision_task, reevaluation_task],
        process=Process.sequential,
        verbose=2,
    )
    
    return revision_crew
```

Now I'll create the remaining essential files to complete the package.

---

### 13. main.py

```python
"""
Main orchestration for SOAP note generation system.
Production-ready entry point with error handling, monitoring, and caching.
"""
import asyncio
import json
import time
from pathlib import Path
from typing import Dict, Optional
from datetime import datetime
import logging

from crew_config import create_soap_generation_crew, create_revision_crew
from schemas.clinical_data import SOAPNote, ClinicalData, ValidationReport
from utils.error_handling import (
    SOAPGenerationError,
    TranscriptionError,
    ValidationError,
    with_retry,
    CircuitBreaker
)
from monitoring.metrics import SOAPMetrics
import os
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(os.getenv("LOG_FILE", "logs/soap_system.log")),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class SOAPNoteGenerator:
    """
    Production-ready SOAP note generation service.
    
    Features:
    - Multi-agent workflow with validation
    - Automatic revision loops
    - Error handling and retries
    - Performance monitoring
    - Result caching
    """
    
    def __init__(
        self,
        max_revisions: Optional[int] = None,
        quality_threshold: Optional[float] = None,
        enable_cache: bool = True
    ):
        """
        Initialize SOAP note generator.
        
        Args:
            max_revisions: Maximum revision iterations (default from env)
            quality_threshold: Minimum quality score (default from env)
            enable_cache: Enable result caching
        """
        self.max_revisions = max_revisions or int(os.getenv("MAX_REVISIONS", "2"))
        self.quality_threshold = quality_threshold or float(os.getenv("QUALITY_THRESHOLD", "0.8"))
        self.enable_cache = enable_cache
        
        # Initialize crew
        self.crew = create_soap_generation_crew(
            enable_memory=os.getenv("CREW_MEMORY_ENABLED", "true").lower() == "true",
            enable_cache=enable_cache,
            verbose_level=int(os.getenv("CREW_VERBOSE", "2"))
        )
        
        # Circuit breaker for external APIs
        self.circuit_breaker = CircuitBreaker(failure_threshold=5, timeout=60)
        
        logger.info(
            f"SOAP Generator initialized: "
            f"max_revisions={self.max_revisions}, "
            f"quality_threshold={self.quality_threshold}"
        )
    
    @SOAPMetrics.track_generation
    async def generate_soap_note(
        self,
        audio_file_path: str,
        patient_id: str,
        encounter_id: str,
        provider_id: Optional[str] = None,
        encounter_date: Optional[str] = None
    ) -> Dict:
        """
        Generate SOAP note from audio recording.
        
        Workflow:
        1. Transcription with speaker diarization
        2. Clinical data extraction
        3. Validation against transcript
        4. SOAP note building
        5. Quality reflection
        6. Revision loop if needed (up to max_revisions)
        
        Args:
            audio_file_path: Path to audio recording file
            patient_id: Patient identifier
            encounter_id: Unique encounter identifier
            provider_id: Healthcare provider identifier
            encounter_date: Date of encounter (ISO format)
            
        Returns:
            Dict containing:
            {
                "success": bool,
                "soap_note": SOAPNote dict,
                "metadata": {
                    "patient_id": str,
                    "encounter_id": str,
                    "quality_score": float,
                    "revision_count": int,
                    "generation_time_seconds": float,
                    "validation_report": str
                },
                "error": Optional[str]
            }
        """
        start_time = time.time()
        
        logger.info(f"Starting SOAP generation for encounter {encounter_id}")
        
        # Validate inputs
        if not Path(audio_file_path).exists():
            error_msg = f"Audio file not found: {audio_file_path}"
            logger.error(error_msg)
            return {
                "success": False,
                "error": error_msg,
                "encounter_id": encounter_id
            }
        
        try:
            # Prepare inputs for crew
            inputs = {
                "audio_file_path": audio_file_path,
                "patient_id": patient_id,
                "encounter_id": encounter_id,
                "provider_id": provider_id or "UNKNOWN",
                "encounter_date": encounter_date or datetime.utcnow().isoformat()
            }
            
            # Execute main crew workflow with circuit breaker protection
            result = await self._execute_with_circuit_breaker(
                self.crew.kickoff,
                inputs=inputs
            )
            
            # Parse crew output
            soap_note, validation_report = self._parse_crew_output(result)
            
            # Check quality and revise if needed
            revision_count = 0
            while soap_note.quality_score < self.quality_threshold and revision_count < self.max_revisions:
                logger.info(
                    f"Quality score {soap_note.quality_score:.2f} below threshold "
                    f"{self.quality_threshold}, initiating revision {revision_count + 1}/{self.max_revisions}"
                )
                
                SOAPMetrics.revision_count.observe(revision_count + 1)
                
                # Get specific feedback from reflection
                feedback = self._extract_revision_feedback(result)
                
                # Create revision crew
                revision_crew = create_revision_crew(self.crew, feedback)
                
                # Execute revision
                revision_inputs = {
                    **inputs,
                    "previous_soap_note": soap_note.dict(),
                    "feedback": feedback
                }
                
                result = await self._execute_with_circuit_breaker(
                    revision_crew.kickoff,
                    inputs=revision_inputs
                )
                
                soap_note, validation_report = self._parse_crew_output(result)
                revision_count += 1
                soap_note.revision_count = revision_count
            
            # Calculate generation time
            generation_time = time.time() - start_time
            
            # Record metrics
            SOAPMetrics.quality_score.observe(soap_note.quality_score)
            
            if validation_report and hasattr(validation_report, 'hallucinations_detected'):
                if validation_report.hallucinations_detected > 0:
                    SOAPMetrics.hallucinations_detected.inc(
                        validation_report.hallucinations_detected
                    )
            
            logger.info(
                f"SOAP note generated successfully: "
                f"encounter={encounter_id}, "
                f"quality={soap_note.quality_score:.2f}, "
                f"revisions={revision_count}, "
                f"time={generation_time:.1f}s"
            )
            
            return {
                "success": True,
                "soap_note": soap_note.dict(),
                "metadata": {
                    "patient_id": patient_id,
                    "encounter_id": encounter_id,
                    "provider_id": provider_id,
                    "encounter_date": encounter_date,
                    "quality_score": soap_note.quality_score,
                    "revision_count": revision_count,
                    "generation_time_seconds": round(generation_time, 2),
                    "validation_report": validation_report.dict() if validation_report else None,
                    "audio_file_path": audio_file_path,
                    "timestamp": datetime.utcnow().isoformat()
                }
            }
            
        except TranscriptionError as e:
            logger.error(f"Transcription failed for {encounter_id}: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": f"Transcription error: {str(e)}",
                "error_type": "TranscriptionError",
                "encounter_id": encounter_id
            }
        
        except ValidationError as e:
            logger.error(f"Validation failed for {encounter_id}: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": f"Validation error: {str(e)}",
                "error_type": "ValidationError",
                "encounter_id": encounter_id
            }
        
        except Exception as e:
            logger.error(f"Unexpected error for {encounter_id}: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": f"System error: {str(e)}",
                "error_type": type(e).__name__,
                "encounter_id": encounter_id
            }
    
    async def _execute_with_circuit_breaker(self, func, **kwargs):
        """Execute function with circuit breaker protection."""
        return self.circuit_breaker.call(func, **kwargs)
    
    def _parse_crew_output(self, result) -> tuple[SOAPNote, Optional[ValidationReport]]:
        """
        Parse CrewAI output into structured objects.
        
        The result contains outputs from all agents. We extract:
        - Final SOAP note from reflector agent
        - Validation report from validator agent
        """
        # CrewAI returns task outputs
        # Implementation depends on how agents structure their output
        # For now, assuming JSON string output from final task
        
        try:
            if isinstance(result, str):
                data = json.loads(result)
            elif hasattr(result, 'dict'):
                data = result.dict()
            else:
                data = result
            
            # Extract SOAP note
            soap_note_data = data.get('soap_note') or data
            soap_note = SOAPNote(**soap_note_data)
            
            # Extract validation report if present
            validation_data = data.get('validation_report')
            validation_report = ValidationReport(**validation_data) if validation_data else None
            
            return soap_note, validation_report
            
        except Exception as e:
            logger.error(f"Error parsing crew output: {str(e)}")
            logger.debug(f"Raw output: {result}")
            raise SOAPGenerationError(f"Failed to parse crew output: {str(e)}")
    
    def _extract_revision_feedback(self, result) -> str:
        """Extract specific feedback for revision from reflection output."""
        try:
            if isinstance(result, dict):
                reflection = result.get('reflection_report', {})
                improvements = reflection.get('improvements_needed', [])
                suggestions = reflection.get('specific_suggestions', {})
                
                feedback_parts = ["REVISION FEEDBACK:", ""]
                
                if improvements:
                    feedback_parts.append("Issues to address:")
                    for i, issue in enumerate(improvements, 1):
                        feedback_parts.append(f"{i}. {issue}")
                    feedback_parts.append("")
                
                if suggestions:
                    feedback_parts.append("Specific improvements by section:")
                    for section, suggestion in suggestions.items():
                        feedback_parts.append(f"- {section}: {suggestion}")
                
                return "\n".join(feedback_parts)
            
            return "Improve specificity and completeness based on transcript details."
            
        except Exception as e:
            logger.warning(f"Could not extract detailed feedback: {str(e)}")
            return "General revision needed to improve quality score."


async def main():
    """Example usage and testing."""
    
    # Initialize generator
    generator = SOAPNoteGenerator(
        max_revisions=2,
        quality_threshold=0.8
    )
    
    # Example: Generate SOAP note
    result = await generator.generate_soap_note(
        audio_file_path="./recordings/example_encounter.wav",
        patient_id="P-12345",
        encounter_id="E-67890",
        provider_id="DR-001",
        encounter_date="2024-02-15"
    )
    
    # Display results
    if result["success"]:
        print("\n" + "="*80)
        print("SOAP NOTE GENERATION SUCCESSFUL")
        print("="*80)
        
        soap = result["soap_note"]
        metadata = result["metadata"]
        
        print(f"\nEncounter ID: {metadata['encounter_id']}")
        print(f"Patient ID: {metadata['patient_id']}")
        print(f"Quality Score: {metadata['quality_score']:.2f}")
        print(f"Revisions: {metadata['revision_count']}")
        print(f"Generation Time: {metadata['generation_time_seconds']}s")
        
        print("\n" + "-"*80)
        print("SUBJECTIVE:")
        print("-"*80)
        print(soap['subjective'])
        
        print("\n" + "-"*80)
        print("OBJECTIVE:")
        print("-"*80)
        print(soap['objective'])
        
        print("\n" + "-"*80)
        print("ASSESSMENT:")
        print("-"*80)
        print(soap['assessment'])
        
        print("\n" + "-"*80)
        print("PLAN:")
        print("-"*80)
        print(soap['plan'])
        
        # Save to file
        output_dir = Path("output")
        output_dir.mkdir(exist_ok=True)
        
        output_file = output_dir / f"soap_note_{metadata['encounter_id']}.json"
        with open(output_file, 'w') as f:
            json.dump(result, f, indent=2)
        
        print(f"\n✓ Full output saved to: {output_file}")
        
    else:
        print("\n" + "="*80)
        print("SOAP NOTE GENERATION FAILED")
        print("="*80)
        print(f"\nError: {result['error']}")
        print(f"Error Type: {result.get('error_type', 'Unknown')}")


if __name__ == "__main__":
    asyncio.run(main())
```

The file is getting very long. Let me create a final comprehensive document with the remaining implementation files and deployment instructions...
