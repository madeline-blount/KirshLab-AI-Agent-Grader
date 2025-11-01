# Multipart PDF Assignment Grading System - Architecture Specification

## Executive Summary

This system evaluates **single PDF submissions** containing **5 sequential parts**, each assessed against specific rubric criteria. The assignment (Portfolio Design with AI Collaboration) requires evaluation of both text content (writing quality, critical thinking, measurability) and visual content (sketches, mockups, design quality).

## System Components

### 1. Master Orchestration Script: `grade_multipart_submission.sh`

**Purpose**: Coordinates the complete grading pipeline for multi-part PDF assignments

**Capabilities**:
- Discovers student PDF submissions
- Validates PDF structure and completeness
- Routes each part to appropriate evaluation pipeline
- Aggregates part-level scores into submission-level grades
- Generates comprehensive feedback reports
- Handles errors and logs all processing

**Key Differences from V1**:
- Part-aware routing (each part has different evaluation criteria)
- Single PDF processing (not directory traversal)
- Structured rubric application (point values, deductions, caps)

### 2. PDF Processing Module: `pdf_processor.py`

**Purpose**: Extract and structure content from multi-part PDF submissions

**Capabilities**:

#### 2.1 Structure Detection
- Identify part boundaries using text markers ("Part 1:", "Part 2:", etc.)
- Extract page ranges for each part
- Handle variable page counts
- Detect missing parts

#### 2.2 Text Extraction
- Extract all text content per page and per part
- Preserve formatting where relevant (headings, lists, tables)
- Apply OCR for scanned/image-based text (Tesseract fallback)
- Calculate word counts for reflections

#### 2.3 Image Extraction
- Extract all embedded images with page associations
- Identify image types (sketches, mockups, screenshots, diagrams)
- Preserve image metadata (position, size, captions)
- Convert to formats suitable for AI vision analysis

#### 2.4 Visual Design Analysis
- **Color Palette**: Extract dominant colors, calculate contrast ratios
- **Typography**: Identify fonts, measure size hierarchies, count font families
- **Layout**: Analyze grid systems, spacing patterns, alignment
- **Composition**: Evaluate visual hierarchy, balance, whitespace usage

#### 2.5 Matrix Extraction (Part 3)
- Detect comparison matrix tables
- Extract cell contents (30 cells expected)
- Associate cells with concepts and criteria
- Identify empty/incomplete cells

**Output**: Structured JSON containing:
```json
{
  "submission_metadata": {...},
  "parts": [
    {
      "part_number": 1,
      "title": "Strategic Foundation",
      "page_range": [2, 5],
      "text_content": "...",
      "images": [],
      "extracted_elements": {
        "job_postings": 3,
        "brand_attributes": 5,
        "criteria": [...]
      }
    },
    {...}
  ],
  "visual_analysis": {...}
}
```

### 3. Part-Specific Evaluation Modules

Each part requires specialized evaluation logic:

#### 3.1 Part 1 Evaluator: `evaluate_part1.py`

**Criteria**: Strategic Foundation (20 points)

**Evaluation Tasks**:

1. **Job Postings Analysis (5 pts)**
   - Count job postings (require 3)
   - Assess synthesis quality (pattern identification)
   - Evaluate strategic thinking (differentiation opportunities)

2. **Brand Attributes (5 pts)**
   - Count attributes (require 5)
   - Classify type (personality traits vs. generic)
   - Assess relevance to job goals

3. **Measurable Criteria (10 pts)** - CRITICAL
   - Count criteria (require 5)
   - Parse each for measurability components:
     * Metric: Numeric/countable measure
     * Target: Threshold or range (≤, ≥, between)
     * Measurement method: Verification steps
     * Rationale: Research/principle citation
   - Flag subjective language ("clean," "professional," "good")
   - Verify thresholds are specific (not "5-10 items")

**Scoring Logic**:
```python
def evaluate_measurable_criteria(criteria_list):
    score = 0
    for criterion in criteria_list:
        measurability_score = 0
        if has_numeric_threshold(criterion): measurability_score += 0.5
        if has_measurement_method(criterion): measurability_score += 0.5
        if has_research_citation(criterion): measurability_score += 0.5
        if not has_subjective_terms(criterion): measurability_score += 0.5
        score += min(measurability_score, 2.0)  # Max 2 pts per criterion
    return min(score, 10)  # Cap at 10 pts
```

#### 3.2 Part 2 Evaluator: `evaluate_part2.py`

**Criteria**: Divergent Ideation (25 points)

**Evaluation Tasks**:

1. **Human Sketches (10 pts)**
   - Identify 3 distinct sketches
   - Analyze divergence using image comparison:
     * Layout structure differences
     * Navigation patterns
     * Information architecture approaches
   - Apply "divergence test": Can all 3 be described with same sentence?
   - Assess conceptual variety (not just visual variation)

2. **AI Variants (8 pts)**
   - Identify 3 AI-generated variants
   - Assess visual quality and relevance
   - Verify correspondence to human sketches

3. **AI Iteration Logs (7 pts)** - CRITICAL ENFORCEMENT
   - Count prompt iterations per variant (require ≥2)
   - Verify genuine problem-solving (not cosmetic changes)
   - Assess refinement quality:
     * Problem identification
     * Prompt modification strategy
     * Outcome improvement
   - **HARD RULE**: <2 iterations = max 16/25 for entire Part 2

**Divergence Analysis Algorithm**:
```python
def analyze_divergence(sketches):
    features = extract_visual_features(sketches)
    # Compare: layout grid, navigation type, content hierarchy
    similarity_matrix = compute_pairwise_similarity(features)
    avg_similarity = mean(similarity_matrix)
    
    if avg_similarity > 0.7: return "LOW_DIVERGENCE"
    elif avg_similarity > 0.4: return "MEDIUM_DIVERGENCE"
    else: return "HIGH_DIVERGENCE"
```

#### 3.3 Part 3 Evaluator: `evaluate_part3.py`

**Criteria**: Systematic Evaluation (30 points)

**Evaluation Tasks**:

1. **Comparison Matrix (20 pts)** - HIGHEST WEIGHT
   - Verify 30 cells filled (6 concepts × 5 criteria)
   - Classify each cell as EVALUATIVE vs. DESCRIPTIVE:
     * **Descriptive**: States what exists ("Has 5 nav items")
     * **Evaluative**: Explains impact ("5 items meets ≤7 threshold, reducing cognitive load")
   - Count UX principle citations (Miller's Law, WCAG, etc.)
   - Assess specificity (measurements, evidence)
   - **HARD RULE**: >50% descriptive cells = max 14/20

2. **Tool-Based Analysis (5 pts)**
   - Verify tool usage (screenshots, outputs)
   - Assess interpretation quality
   - Check if insights inform evaluation

3. **Selection Rationale (5 pts)**
   - Verify word count (200-300 words)
   - Check for explicit matrix citations
   - Assess acknowledgment of tradeoffs
   - **HARD RULE**: No matrix reference = max 3/5

**Cell Classification Algorithm**:
```python
def classify_matrix_cell(text):
    evaluative_indicators = [
        "meets threshold", "exceeds", "reduces", "increases",
        "impact", "effect", "results in", "causes",
        "however", "but", "tradeoff", "versus",
        "because", "therefore", "leads to"
    ]
    
    descriptive_indicators = [
        "has", "contains", "includes", "shows",
        "is", "are", "uses", "displays"
    ]
    
    eval_score = count_indicators(text, evaluative_indicators)
    desc_score = count_indicators(text, descriptive_indicators)
    
    if eval_score > desc_score and has_impact_explanation(text):
        return "EVALUATIVE"
    else:
        return "DESCRIPTIVE"
```

#### 3.4 Part 4 Evaluator: `evaluate_part4.py`

**Criteria**: Refinement & Development (15 points)

**Evaluation Tasks**:

1. **Refined Mockup (10 pts)**
   - Assess fidelity level (low/mid/high)
   - Evaluate visual hierarchy using:
     * Size differentials between elements
     * Contrast usage
     * Spacing patterns
   - Check for real content (not lorem ipsum)
   - Verify typography choices
   - Assess against stated criteria from Part 1
   - **Note**: Strategic thinking > visual perfection

2. **Design Decisions (5 pts)**
   - Count decisions documented (require 5-7)
   - Assess rationale quality per decision
   - Verify connection to criteria/goals
   - Check for alternatives considered

**Visual Hierarchy Assessment**:
```python
def assess_visual_hierarchy(mockup_image):
    elements = detect_elements(mockup_image)
    sizes = [e.size for e in elements]
    size_variance = stdev(sizes) / mean(sizes)
    
    contrast_scores = [compute_contrast(e, background) for e in elements]
    avg_contrast = mean(contrast_scores)
    
    hierarchy_score = 0
    if size_variance > 0.5: hierarchy_score += 3  # Good size variation
    if avg_contrast > 4.5: hierarchy_score += 3  # WCAG AA compliance
    if has_clear_focal_point(mockup_image): hierarchy_score += 4
    
    return min(hierarchy_score, 10)
```

#### 3.5 Part 5 Evaluator: `evaluate_part5.py`

**Criteria**: Critical Reflection (10 points)

**Evaluation Tasks**:

1. **Word Count** (300-400 words required)
2. **AI Failure Identification**
   - Count specific AI failures mentioned (require ≥2)
   - Assess specificity (not generic "didn't work well")
   - Verify explanations of why failures occurred
   - **HARD RULE**: 0 failures = -5 point penalty
3. **Critical Thinking**
   - Assess honesty and depth of reflection
   - Evaluate learning insights
   - Check for human voice (not AI-generated reflection)
4. **Generic Language Detection**
   - Flag corporate buzzwords
   - Identify AI-typical phrasing

**AI Failure Detection Algorithm**:
```python
def count_ai_failures(text):
    failure_indicators = [
        "failed to", "didn't work", "couldn't", "unable to",
        "struggled with", "produced poor", "generated incorrect",
        "misunderstood", "hallucinated", "generic output"
    ]
    
    failure_count = 0
    for indicator in failure_indicators:
        if indicator in text.lower():
            # Verify it's about AI, not student
            context = get_context(text, indicator, window=50)
            if ai_mentioned_in_context(context):
                failure_count += 1
    
    return failure_count
```

### 4. Gaming Detection Module: `detect_gaming.py`

**Purpose**: Identify patterns suggesting attempts to game the system

**Flags Detected**:

1. **Subjective Criteria**: >3 criteria with vague terms
2. **Descriptive Matrix**: >50% cells only describe
3. **No Iteration**: Any variant <2 prompt rounds
4. **Buzzword Overload**: >8 corporate/AI terms
5. **No Matrix Citations**: Rationale doesn't reference matrix
6. **Perfect AI Claim**: Zero failures identified

**Scoring Impacts**:
- 3-4 flags → max 65/100
- 5+ flags → max 50/100

**Implementation**:
```python
def detect_gaming_flags(submission_data):
    flags = []
    
    # Flag 1: Subjective criteria
    subjective_terms = ["clean", "professional", "good", "nice", "effective"]
    subjective_count = count_terms_in_criteria(submission_data.part1.criteria, subjective_terms)
    if subjective_count > 3:
        flags.append("SUBJECTIVE_CRITERIA")
    
    # Flag 2: Descriptive matrix
    descriptive_cells = [c for c in submission_data.part3.matrix_cells if c.classification == "DESCRIPTIVE"]
    if len(descriptive_cells) / 30 > 0.5:
        flags.append("DESCRIPTIVE_MATRIX")
    
    # Flag 3-6: Similar logic...
    
    return flags
```

### 5. Scoring and Report Generation: `generate_report.py`

**Purpose**: Aggregate part scores, apply deductions/caps, generate feedback

**Scoring Logic**:

```python
def calculate_final_score(part_scores, gaming_flags, deductions):
    # Sum part scores
    raw_score = sum(part_scores.values())
    
    # Apply gaming caps
    if len(gaming_flags) >= 5:
        raw_score = min(raw_score, 50)
    elif len(gaming_flags) >= 3:
        raw_score = min(raw_score, 65)
    
    # Apply hard caps
    if not part_scores['part3']['matrix_complete']:
        raw_score = min(raw_score, 50)
    if not part_scores['part2']['all_logs_present']:
        raw_score = min(raw_score, 70)
    
    # Apply deductions
    final_score = raw_score - deductions['late'] - deductions['formatting']
    
    return max(final_score, 0)
```

**Report Structure**:

```
=====================================
GRADING REPORT
Student: [Name]
Submission: [Filename]
Date: [Timestamp]
=====================================

PART-BY-PART BREAKDOWN

Part 1: Strategic Foundation (Score: X/20)
✓ Job Postings: X/5
  - [Specific feedback]
✓ Brand Attributes: X/5
  - [Specific feedback]
✓ Measurable Criteria: X/10
  - [Detailed analysis of each criterion]
  - [Flags for subjective language]

Part 2: Divergent Ideation (Score: X/25)
✓ Human Sketches: X/10
  - Divergence assessment: [HIGH/MEDIUM/LOW]
  - [Specific feedback on variety]
✓ AI Variants: X/8
  - [Quality assessment]
✓ AI Iteration Logs: X/7
  - Variant 1: [N iterations - meets/fails requirement]
  - [Iteration quality feedback]

Part 3: Systematic Evaluation (Score: X/30)
✓ Comparison Matrix: X/20
  - Cells completed: N/30
  - Evaluative cells: N/30 (N%)
  - [Specific examples of strong/weak cells]
  - UX principles cited: N
✓ Tool Analysis: X/5
✓ Selection Rationale: X/5
  - Word count: N words
  - Matrix citations: [Present/Absent]

Part 4: Refinement (Score: X/15)
✓ Refined Mockup: X/10
  - Visual hierarchy: [Assessment]
  - Typography: [Assessment]
  - Content quality: [Assessment]
✓ Design Decisions: X/5
  - Decisions documented: N/7

Part 5: Critical Reflection (Score: X/10)
✓ Word count: N words (300-400 required)
✓ AI failures identified: N (≥2 required)
✓ Critical thinking: [Assessment]
✓ Honesty and depth: [Assessment]

GAMING FLAGS DETECTED: [N]
[List of flags if any]

DEDUCTIONS:
- Late submission: -N points
- File naming: -N points
- Missing integrity statement: -N points

FINAL SCORE: X/100
LETTER GRADE: [A/B/C/D/F]

OVERALL STRENGTHS:
- [Bulleted list]

AREAS FOR IMPROVEMENT:
- [Bulleted list with specific, actionable advice]

CRITICAL ISSUES:
- [Any hard rule violations]

=====================================
```

### 6. Configuration System: `config/assignment_rubrics/`

**Purpose**: Store rubric definitions for different assignments

**Structure**:
```
config/
├── assignment_rubrics/
│   ├── portfolio_design_ai.json      # This assignment
│   ├── another_assignment.json        # Future assignments
│   └── template.json                  # Template for new assignments
├── evaluation_models.json             # AI model configs per evaluation type
└── grading_config.env                 # System-wide settings
```

**Rubric JSON Format**:
```json
{
  "assignment_name": "Portfolio Design with AI Collaboration",
  "assignment_code": "A2",
  "total_points": 100,
  "parts": [
    {
      "part_number": 1,
      "name": "Strategic Foundation",
      "points": 20,
      "components": [
        {
          "name": "Job Postings Analysis",
          "points": 5,
          "evaluation_criteria": {
            "count_required": 3,
            "requires_synthesis": true,
            "requires_strategy": true
          },
          "scoring_rubric": {
            "excellent": {"score": 5, "requirements": [...]},
            "good": {"score": 4, "requirements": [...]},
            "adequate": {"score": 3, "requirements": [...]},
            "poor": {"score": 0-2, "requirements": [...]}
          }
        },
        {...}
      ],
      "special_rules": []
    },
    {...}
  ],
  "hard_rules": [
    {
      "condition": "any_variant_iterations < 2",
      "consequence": "cap_part2_at_16"
    },
    {
      "condition": "matrix_descriptive_cells > 50%",
      "consequence": "cap_matrix_score_at_14"
    },
    {...}
  ],
  "gaming_detection": {
    "flags": [...],
    "consequences": {
      "3-4_flags": "cap_total_at_65",
      "5+_flags": "cap_total_at_50"
    }
  },
  "deductions": {
    "late_1-24hrs": -20,
    "late_25-48hrs": -40,
    "late_>48hrs": 0,
    "filename_error": -2,
    "missing_integrity": -2
  }
}
```

## Data Flow

```
Student PDF Submission
        ↓
[1] PDF Processor
    - Extract structure (parts)
    - Extract text (per part)
    - Extract images (per part)
    - Visual analysis (colors, typography, layout)
    - Matrix extraction (Part 3)
        ↓
[2] Part-Specific Evaluators (parallel)
    - Part 1: Measurability analysis
    - Part 2: Divergence + iteration analysis
    - Part 3: Matrix cell classification
    - Part 4: Visual hierarchy assessment
    - Part 5: Failure identification + critical thinking
        ↓
[3] Gaming Detection
    - Analyze patterns across all parts
    - Generate flags
        ↓
[4] Score Aggregation
    - Sum part scores
    - Apply hard rules (caps)
    - Apply gaming consequences
    - Apply deductions
        ↓
[5] Report Generation
    - Part-by-part breakdown
    - Specific, actionable feedback
    - Overall assessment
        ↓
Output: PDF Report + JSON metadata
```

## Technical Stack

### PDF Processing
- **PyMuPDF (fitz)**: Primary PDF manipulation (text, images, metadata)
- **Tesseract OCR**: Fallback for scanned text
- **pdf2image**: Convert pages to images for visual analysis
- **Pillow**: Image processing

### Visual Analysis
- **OpenCV**: Image comparison, feature extraction, layout detection
- **scikit-image**: Color palette extraction, contrast calculation
- **pytesseract**: Font detection (via OCR metadata)

### Text Analysis
- **NLTK/spaCy**: NLP for text classification and sentiment
- **Custom regex**: Pattern matching for thresholds, measurements, citations

### AI Integration
- **Anthropic Claude API**: Multimodal analysis (text + images)
  - Part 1: Criteria measurability assessment
  - Part 2: Divergence analysis with visual input
  - Part 3: Matrix cell evaluation
  - Part 4: Mockup visual quality assessment
  - Part 5: Critical thinking and honesty detection

## Development Phases

### Phase 1: Core Infrastructure (Current)
- ✅ System architecture design
- ⏳ PDF processor implementation
- ⏳ Part detection and structure analysis
- ⏳ Basic text/image extraction

### Phase 2: Part Evaluators (Next Priority)
- Part 1 evaluator (measurability detection)
- Part 3 evaluator (matrix cell classification) - HIGHEST IMPACT
- Part 5 evaluator (failure detection) - SIMPLEST

### Phase 3: Visual Analysis
- Part 2 evaluator (divergence analysis)
- Part 4 evaluator (mockup assessment)
- Visual design metrics (color, typography, layout)

### Phase 4: Integration & Testing
- Gaming detection module
- Score aggregation and caps
- Report generation
- End-to-end testing with sample submissions

### Phase 5: Validation
- Compare AI grading with instructor grading (inter-rater reliability)
- Refine evaluation algorithms based on discrepancies
- Document validation methodology

## Success Criteria

The system is production-ready when:

1. **Accuracy**: ≥85% agreement with instructor on pass/fail decisions
2. **Specificity**: Feedback identifies specific issues mentioned in rubric
3. **Consistency**: Same submission graded multiple times yields ≤5% variation
4. **Coverage**: All rubric criteria have automated checks
5. **Hard Rule Enforcement**: 100% accuracy on hard rules (caps, deductions)
6. **Gaming Detection**: Flags ≥80% of gaming attempts identified by instructors
7. **Processing Speed**: <2 minutes per submission for typical 20-page PDF

## Ethical Considerations

1. **Transparency**: Students know AI is used; rubric is public
2. **Appeal Process**: Instructor reviews all flagged submissions
3. **Bias Mitigation**: Regular auditing across student demographics
4. **Formative Focus**: Detailed feedback, not just scores
5. **Human Oversight**: Instructor reviews borderline cases and gaming flags

## Next Steps

**Immediate action**: Implement PDF processor with part detection and basic extraction.

**Your input needed**:
1. Do you have sample student submissions I can use for development/testing?
2. Are there specific edge cases in PDF structure I should anticipate?
3. Should the system handle late submission timestamp detection automatically?
4. Do you want confidence scores for each evaluation (e.g., "85% confident this is evaluative")?

Shall I proceed with implementing the PDF processor module?
