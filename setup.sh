#!/bin/bash

################################################################################
# PROJECT SETUP SCRIPT
# Multimodal Assignment Grading System
#
# This script initializes the project directory structure and configuration
# files necessary for running the grading system.
################################################################################

set -euo pipefail

echo "=========================================="
echo "Multimodal Grading System - Setup"
echo "=========================================="
echo ""

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Setting up project in: ${SCRIPT_DIR}"
echo ""

# Create directory structure
echo "Creating directory structure..."

directories=(
    "config"
    "submissions"
    "output"
    "output/reports"
    "output/feedback"
    "output/metadata"
    "logs"
    "temp"
    "cache"
    "scripts"
)

for dir in "${directories[@]}"; do
    mkdir -p "${SCRIPT_DIR}/${dir}"
    echo "  ✓ Created ${dir}/"
done

echo ""

# Copy configuration template if it doesn't exist
CONFIG_FILE="${SCRIPT_DIR}/config/grading_config.env"
if [[ ! -f "${CONFIG_FILE}" ]]; then
    if [[ -f "${SCRIPT_DIR}/config_template.env" ]]; then
        echo "Creating configuration file..."
        cp "${SCRIPT_DIR}/config_template.env" "${CONFIG_FILE}"
        echo "  ✓ Created config/grading_config.env"
        echo ""
        echo "⚠️  IMPORTANT: You must edit config/grading_config.env with your API key!"
        echo "   Edit the file and set AI_API_KEY to your actual API key."
    else
        echo "⚠️  Warning: config_template.env not found. Skipping config creation."
    fi
else
    echo "Configuration file already exists: ${CONFIG_FILE}"
fi

echo ""

# Move Python script to scripts directory if not already there
if [[ -f "${SCRIPT_DIR}/extract_content.py" ]] && [[ ! -f "${SCRIPT_DIR}/scripts/extract_content.py" ]]; then
    echo "Moving Python scripts to scripts directory..."
    mv "${SCRIPT_DIR}/extract_content.py" "${SCRIPT_DIR}/scripts/extract_content.py"
    echo "  ✓ Moved extract_content.py to scripts/"
fi

# Make Python scripts executable
if [[ -f "${SCRIPT_DIR}/scripts/extract_content.py" ]]; then
    chmod +x "${SCRIPT_DIR}/scripts/extract_content.py"
    echo "  ✓ Made extract_content.py executable"
fi

echo ""

# Make main grading script executable
if [[ -f "${SCRIPT_DIR}/grade_submissions.sh" ]]; then
    chmod +x "${SCRIPT_DIR}/grade_submissions.sh"
    echo "  ✓ Made grade_submissions.sh executable"
fi

echo ""

# Check for Python and required packages
echo "Checking Python environment..."

if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "  ✓ Python found: ${PYTHON_VERSION}"
    
    echo ""
    echo "Checking required Python packages..."
    
    # Check for required packages
    packages=("bs4:beautifulsoup4" "PIL:pillow" "tinycss2:tinycss2")
    missing_packages=()
    
    for package in "${packages[@]}"; do
        import_name="${package%%:*}"
        package_name="${package##*:}"
        
        if python3 -c "import ${import_name}" 2>/dev/null; then
            echo "  ✓ ${package_name} installed"
        else
            echo "  ✗ ${package_name} NOT installed"
            missing_packages+=("${package_name}")
        fi
    done
    
    if [[ ${#missing_packages[@]} -gt 0 ]]; then
        echo ""
        echo "⚠️  Missing packages detected. Install them with:"
        echo "   pip install ${missing_packages[*]}"
    else
        echo ""
        echo "  ✓ All required packages are installed"
    fi
else
    echo "  ✗ Python3 not found. Please install Python 3.8 or higher."
fi

echo ""

# Create a sample submission directory
echo "Creating sample submission structure..."
SAMPLE_DIR="${SCRIPT_DIR}/submissions/sample_student"
if [[ ! -d "${SAMPLE_DIR}" ]]; then
    mkdir -p "${SAMPLE_DIR}/images"
    mkdir -p "${SAMPLE_DIR}/css"
    
    # Create sample index.html
    cat > "${SAMPLE_DIR}/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sample Student Portfolio</title>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
    <header>
        <h1>My Portfolio</h1>
        <nav>
            <ul>
                <li><a href="#about">About</a></li>
                <li><a href="#projects">Projects</a></li>
                <li><a href="#contact">Contact</a></li>
            </ul>
        </nav>
    </header>
    
    <main>
        <section id="about">
            <h2>About Me</h2>
            <p>This is a sample student submission for testing the grading system.</p>
        </section>
        
        <section id="projects">
            <h2>Projects</h2>
            <article>
                <h3>Project 1</h3>
                <p>Description of an interesting project.</p>
            </article>
        </section>
    </main>
    
    <footer>
        <p>&copy; 2025 Sample Student. All rights reserved.</p>
    </footer>
</body>
</html>
EOF
    
    # Create sample CSS
    cat > "${SAMPLE_DIR}/css/styles.css" << 'EOF'
body {
    font-family: Arial, sans-serif;
    line-height: 1.6;
    margin: 0;
    padding: 0;
}

header {
    background: #333;
    color: #fff;
    padding: 1rem;
}

nav ul {
    list-style: none;
    padding: 0;
}

nav ul li {
    display: inline;
    margin-right: 1rem;
}

nav a {
    color: #fff;
    text-decoration: none;
}

main {
    padding: 2rem;
}

footer {
    background: #333;
    color: #fff;
    text-align: center;
    padding: 1rem;
    margin-top: 2rem;
}
EOF
    
    echo "  ✓ Created sample submission in submissions/sample_student/"
    echo "    You can use this for testing the system."
else
    echo "  Sample submission already exists"
fi

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Edit config/grading_config.env and add your API key"
echo "2. Place student submissions in the submissions/ directory"
echo "3. Run the grading system:"
echo "   ./grade_submissions.sh --dry-run --verbose"
echo ""
echo "For more information, see README.md"
echo ""
