# Multimodal Assignment Grading System

## Overview

This system provides automated, AI-driven assessment of student web-based assignments using multimodal analysis. It processes HTML pages, images, CSS, and other web content to generate comprehensive, multi-perspective feedback suitable for educational contexts.

The system implements principles from learning analytics (Siemens & Long, 2011), automated essay scoring (Shermis & Burstein, 2013), and multimodal learning assessment (Blikstein & Worsley, 2016) to provide formative feedback that considers content quality, visual design, technical implementation, and accessibility.

## System Architecture

The system consists of three primary components:

### 1. Shell Script Orchestrator (`grade_submissions.sh`)

The master control script that manages the entire grading pipeline. It handles:

- **Directory traversal and submission discovery**: Systematically identifies student submissions
- **Validation**: Ensures submissions contain required content before processing
- **Pipeline coordination**: Calls Python modules in sequence for extraction, grading, and reporting
- **Error handling**: Manages failures gracefully and maintains detailed logs
- **Parallel processing**: Supports concurrent processing of multiple submissions (optional)
- **Metadata tracking**: Records all processing steps for reproducibility and auditing

### 2. Content Extraction Module (`extract_content.py`)

A Python script that performs multimodal content extraction:

- **HTML parsing**: Extracts text, structure, links, and semantic elements
- **Image processing**: Identifies, resizes, and encodes images for AI analysis
- **CSS analysis**: Extracts and analyzes stylesheet content
- **Accessibility checking**: Evaluates basic WCAG compliance features
- **Metadata extraction**: Captures document metadata and page structure
- **Structured output**: Generates JSON files suitable for AI model input

### 3. Configuration System

Environment-based configuration providing:

- API credentials and model parameters
- Processing options and feature flags
- Rubric definitions and evaluation criteria
- Output format specifications
- Rate limiting and error handling settings

## Prerequisites

### System Requirements

- Unix-like operating system (Linux, macOS)
- Bash shell (version 4.0+)
- Python 3.8 or higher
- Sufficient disk space for temporary files and outputs

### Python Dependencies

```bash
pip install beautifulsoup4 html5lib pillow tinycss2
```

Required packages:
- `beautifulsoup4`: HTML parsing and manipulation
- `html5lib`: Robust HTML5-compliant parsing
- `pillow`: Image processing and format conversion
- `tinycss2`: CSS parsing and analysis

### API Access

- API key for Claude (Anthropic) or compatible large language model
- Sufficient API quota for batch processing

## Installation

1. Clone or download the system files to your working directory:

```bash
mkdir multimodal_grading_system
cd multimodal_grading_system
```

2. Make the main script executable:

```bash
chmod +x grade_submissions.sh
```

3. Create the configuration file:

```bash
mkdir -p config
cp config_template.env config/grading_config.env
```

4. Edit `config/grading_config.env` with your API credentials and preferences:

```bash
nano config/grading_config.env
```

At minimum, you must set:
- `AI_API_KEY`: Your API key for the AI service
- `AI_MODEL_VERSION`: The specific model to use for grading

5. Create necessary directory structure:

```bash
mkdir -p submissions output logs temp
mkdir -p output/reports output/feedback output/metadata
```

## Usage

### Basic Usage

Process all submissions in the default submissions directory:

```bash
./grade_submissions.sh
```

### Specify Custom Directories

```bash
./grade_submissions.sh \
    --submissions ./student_work \
    --output ./grading_results
```

### Dry Run Mode

Test the system without making API calls:

```bash
./grade_submissions.sh --dry-run --verbose
```

This allows you to verify that submissions are discovered and validated correctly before incurring API costs.

### Parallel Processing

Process multiple submissions concurrently:

```bash
./grade_submissions.sh --parallel --max-concurrent 8
```

**Note**: Parallel processing increases speed but also increases API rate limit pressure. Monitor your API usage carefully.

### Verbose Logging

Enable detailed debug output:

```bash
./grade_submissions.sh --verbose
```

### Complete Example

```bash
./grade_submissions.sh \
    --config ./config/custom_config.env \
    --submissions ./spring_2025_submissions \
    --output ./spring_2025_grades \
    --parallel \
    --max-concurrent 4 \
    --verbose
```

## Directory Structure

The system expects and creates the following directory structure:

```
multimodal_grading_system/
├── grade_submissions.sh          # Main orchestration script
├── extract_content.py             # Content extraction module
├── config/
│   ├── grading_config.env        # Configuration file
│   └── grading_rubric.json       # Rubric definitions (optional)
├── submissions/                   # Student submissions (input)
│   ├── student_001/
│   │   ├── index.html
│   │   ├── styles.css
│   │   └── images/
│   ├── student_002/
│   └── ...
├── output/                        # Grading outputs
│   ├── reports/                  # HTML/PDF feedback reports
│   ├── feedback/                 # Structured JSON feedback
│   └── metadata/                 # Processing metadata
├── logs/                          # Execution logs
├── temp/                          # Temporary extraction files
└── cache/                         # Optional caching directory
```

### Submission Format

Each student's work should be in a separate directory under `submissions/`. The directory name serves as the student identifier. Each submission should contain:

- At least one HTML file (preferably `index.html`)
- Any associated images, CSS files, and other assets
- Relative links should work correctly within the submission directory

Example submission structure:

```
submissions/student_001/
├── index.html                     # Main page
├── about.html                     # Additional pages
├── css/
│   └── styles.css
├── images/
│   ├── header.jpg
│   └── logo.png
└── js/
    └── scripts.js
```

## Output Files

For each processed submission, the system generates:

### 1. Feedback Report (`output/reports/student_XXX_report_TIMESTAMP.html`)

An HTML-formatted report containing:
- Overall assessment and grade
- Multi-perspective evaluation (content, design, technical, accessibility)
- Specific strengths and areas for improvement
- Actionable recommendations
- Visual examples where applicable

### 2. Structured Feedback (`output/feedback/student_XXX_feedback_TIMESTAMP.json`)

Machine-readable JSON containing:
- Numerical scores for each evaluation dimension
- Detailed commentary for each criterion
- Specific issues identified
- Metadata about the grading process

### 3. Processing Metadata (`output/metadata/student_XXX_metadata_TIMESTAMP.json`)

Records of the grading process:
- Timestamps and processing duration
- AI model version used
- Extraction statistics
- Any errors or warnings encountered

### 4. Execution Log (`logs/grading_run_TIMESTAMP.log`)

Complete log of the grading session:
- All submissions processed
- Timing information
- Errors and warnings
- System information for reproducibility

## Configuration Options

### API Configuration

```bash
AI_API_KEY="your_api_key"
AI_API_ENDPOINT="https://api.anthropic.com/v1/messages"
AI_MODEL_VERSION="claude-sonnet-4-5-20250929"
AI_MAX_TOKENS=4096
AI_TEMPERATURE=0.3
```

Lower temperature values (0.1-0.5) produce more consistent grading; higher values (0.6-1.0) produce more varied feedback.

### Evaluation Perspectives

Define the analytical dimensions applied during grading:

```bash
EVALUATION_PERSPECTIVES="content_quality,visual_design,technical_implementation,accessibility,usability"
```

Each perspective should correspond to criteria in your rubric. The AI model will be prompted to evaluate the submission from each perspective separately, then synthesize the results.

### Image Processing

```bash
MAX_IMAGE_SIZE_MB=10
RESIZE_LARGE_IMAGES=true
TARGET_IMAGE_WIDTH=1200
```

Large images are automatically resized to reduce API token usage while preserving visual quality sufficient for assessment.

### Rate Limiting

```bash
MAX_API_CALLS_PER_MINUTE=50
DELAY_BETWEEN_CALLS_MS=100
```

Adjust these values based on your API tier and rate limits to avoid throttling.

## Grading Process

The system follows this workflow for each submission:

1. **Discovery**: Identifies all student submission directories
2. **Validation**: Checks that submissions contain required files
3. **Content Extraction**:
   - Parses HTML to extract text, structure, and semantic elements
   - Processes images and converts to appropriate formats
   - Analyzes CSS for styling patterns
   - Checks accessibility features
4. **AI Grading**:
   - Constructs multimodal prompt with text and images
   - Applies multiple evaluation perspectives
   - Generates detailed feedback and scores
5. **Report Generation**:
   - Formats feedback into readable HTML reports
   - Creates structured JSON output for record-keeping
6. **Metadata Recording**:
   - Logs all processing details for reproducibility
   - Records model versions and parameters used

## Evaluation Dimensions

The system can assess submissions across multiple dimensions:

### Content Quality
- Completeness and relevance of information
- Writing quality and clarity
- Appropriate depth for the assignment level
- Logical organization and flow

### Visual Design
- Layout and composition principles
- Color scheme effectiveness
- Typography choices and readability
- Visual hierarchy and emphasis
- Use of whitespace and balance

### Technical Implementation
- HTML validity and semantic structure
- CSS organization and efficiency
- Appropriate use of modern web standards
- Code cleanliness and maintainability
- Proper use of assets (images, fonts, etc.)

### Accessibility
- Alt text for images
- Proper heading hierarchy
- Color contrast ratios
- Semantic HTML usage
- Keyboard navigation support
- Screen reader compatibility

### Usability
- Navigation clarity
- Responsive design considerations
- Loading performance
- Cross-browser compatibility considerations

## Customization

### Creating a Custom Rubric

Create `config/grading_rubric.json` with your criteria:

```json
{
  "total_points": 100,
  "dimensions": [
    {
      "name": "content_quality",
      "weight": 0.30,
      "criteria": [
        {
          "description": "Information is complete and accurate",
          "points": 10
        },
        {
          "description": "Writing is clear and well-organized",
          "points": 10
        }
      ]
    },
    {
      "name": "visual_design",
      "weight": 0.25,
      "criteria": [...]
    }
  ]
}
```

### Modifying Prompts

The AI grading prompts can be customized by creating additional Python scripts that construct prompts based on your rubric and educational context. The prompts should:

- Clearly specify evaluation criteria
- Request specific feedback formats
- Include example assessments (few-shot learning)
- Emphasize constructive, student-focused language

## Best Practices

### For Accurate Grading

1. **Provide Clear Rubrics**: The more specific your criteria, the more consistent the AI grading
2. **Use Multiple Perspectives**: Different analytical lenses catch different issues
3. **Review Samples**: Manually review a random sample of graded submissions to validate AI assessments
4. **Iterate Prompts**: Refine your grading prompts based on output quality
5. **Version Control**: Keep records of which model version and prompts were used

### For Cost Management

1. **Use Dry Runs**: Test with `--dry-run` before processing large batches
2. **Start Small**: Process a few submissions first to estimate costs
3. **Optimize Images**: Enable image resizing to reduce token usage
4. **Batch Processing**: Process submissions during off-peak hours if using time-based pricing
5. **Cache Results**: Enable caching to avoid reprocessing unchanged submissions

### For Student Privacy

1. **Anonymize Identifiers**: Use student IDs rather than names in directory structure
2. **Secure Storage**: Restrict access to output directories
3. **Audit Logs**: Maintain logs of who accessed grading results
4. **Data Retention**: Establish policies for archiving or deleting submission data

## Troubleshooting

### Common Issues

**Problem**: Script reports "AI_API_KEY not set"
**Solution**: Edit `config/grading_config.env` and add your API key

**Problem**: No submissions discovered
**Solution**: Verify submissions are in the correct directory and contain HTML files

**Problem**: API rate limit errors
**Solution**: Reduce `MAX_API_CALLS_PER_MINUTE` or increase `DELAY_BETWEEN_CALLS_MS`

**Problem**: Images not processed correctly
**Solution**: Check image file formats are supported (.jpg, .png, .gif, .webp)

**Problem**: Python module import errors
**Solution**: Install required packages: `pip install beautifulsoup4 html5lib pillow tinycss2`

### Debug Mode

Enable verbose logging to diagnose issues:

```bash
./grade_submissions.sh --verbose --dry-run
```

Examine the log file in `logs/` for detailed error messages.

### Manual Testing

Test the content extraction module independently:

```bash
python3 extract_content.py \
    submissions/student_001 \
    temp/test_extraction \
    --verbose
```

This helps isolate whether issues are in extraction or grading stages.

## Ethical Considerations

Automated grading of student work raises important ethical considerations (Baker & Hawn, 2022):

1. **Transparency**: Students should be informed that AI is used in assessment
2. **Fairness**: Regular auditing is essential to detect bias in grading
3. **Formative Focus**: Use AI for feedback rather than solely summative grades
4. **Human Oversight**: Instructors should review AI assessments, especially for high-stakes work
5. **Appeal Process**: Provide mechanisms for students to contest automated assessments
6. **Data Protection**: Handle student work with appropriate privacy safeguards

## Performance Benchmarks

Approximate processing times (will vary based on submission complexity and API speed):

- Simple submission (1-3 HTML files, few images): 5-15 seconds
- Medium submission (5-10 files, multiple images): 15-30 seconds
- Complex submission (10+ files, many images): 30-60 seconds

API costs (approximate, based on Claude Sonnet 4.5):
- Simple submission: $0.05-0.15
- Medium submission: $0.15-0.30
- Complex submission: $0.30-0.60

**Note**: Costs depend on content length and number of images. Enable image resizing to reduce costs.

## Future Enhancements

Planned features for future versions:

- Interactive web dashboard for viewing results
- Comparative analytics across all submissions
- Plagiarism detection integration
- Support for video content assessment
- Integration with learning management systems (Canvas, Moodle, etc.)
- Student self-assessment comparison
- Peer review integration
- Longitudinal tracking of student progress

## References

Baker, R. S., & Hawn, A. (2022). Algorithmic bias in education. *International Journal of Artificial Intelligence in Education*, 32(4), 1052-1092. https://doi.org/10.1007/s40593-021-00285-9

Blikstein, P., & Worsley, M. (2016). Multimodal learning analytics and education data mining: Using computational technologies to measure complex learning tasks. *Journal of Learning Analytics*, 3(2), 220-238. https://doi.org/10.18608/jla.2016.32.11

Khosravi, H., Sadiq, S., & Gasevic, D. (2020). Development and adoption of an adaptive learning system: Reflections and lessons learned. *Proceedings of the 51st ACM Technical Symposium on Computer Science Education*, 58-64. https://doi.org/10.1145/3328778.3366900

Shermis, M. D., & Burstein, J. (Eds.). (2013). *Handbook of automated essay evaluation: Current applications and new directions*. Routledge.

Siemens, G., & Long, P. (2011). Penetrating the fog: Analytics in learning and education. *EDUCAUSE Review*, 46(5), 30-40.

## Support and Contributing

For questions, issues, or contributions:

1. Review this documentation thoroughly
2. Check the troubleshooting section
3. Examine log files for error details
4. Consult the academic references for theoretical foundations

## License

[Specify your license here]

## Version History

- **1.0.0** (2025-11-01): Initial release
  - Core shell script orchestration
  - Python content extraction module
  - Configuration system
  - Multi-perspective grading support
  - HTML report generation

---

*This system implements research-based principles of automated assessment while maintaining human oversight and ethical considerations appropriate for educational contexts.*
