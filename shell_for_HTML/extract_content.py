#!/usr/bin/env python3
"""
Multimodal Content Extraction Module

This module extracts and structures content from student web-based submissions,
preparing them for AI-based assessment. It handles HTML parsing, image extraction,
CSS analysis, and metadata generation.

The extraction process follows principles of multimodal learning analytics
(Blikstein & Worsley, 2016) and prepares content in formats suitable for
large language model processing.
"""

import os
import sys
import json
import argparse
import logging
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from datetime import datetime
import hashlib

# HTML and web content parsing
from bs4 import BeautifulSoup
import html5lib  # More robust HTML parsing

# Image processing
from PIL import Image
import base64

# CSS parsing
import tinycss2

# URL and file utilities
import mimetypes
from urllib.parse import urljoin, urlparse


class SubmissionExtractor:
    """
    Extracts and structures multimodal content from student submissions.
    
    This class implements a systematic approach to parsing web-based assignments,
    capturing text, visual, and structural elements necessary for comprehensive
    automated assessment (Khosravi et al., 2019).
    """
    
    def __init__(self, submission_dir: Path, output_dir: Path, config: Dict):
        """
        Initialize the content extractor.
        
        Args:
            submission_dir: Directory containing student submission
            output_dir: Directory for extracted content output
            config: Configuration dictionary with extraction parameters
        """
        self.submission_dir = Path(submission_dir)
        self.output_dir = Path(output_dir)
        self.config = config
        
        # Setup logging
        self.logger = logging.getLogger(__name__)
        
        # Initialize storage for extracted content
        self.extracted_data = {
            "metadata": {},
            "html_files": [],
            "text_content": [],
            "images": [],
            "styles": [],
            "structure": {},
            "errors": []
        }
        
        # Create output directory
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def extract_all(self) -> Dict:
        """
        Perform complete extraction of submission content.
        
        Returns:
            Dictionary containing all extracted and structured content
        """
        self.logger.info(f"Beginning extraction from {self.submission_dir}")
        
        try:
            # Extract metadata
            self._extract_metadata()
            
            # Find and process HTML files
            html_files = self._find_html_files()
            
            for html_file in html_files:
                self._process_html_file(html_file)
            
            # Process images
            self._extract_images()
            
            # Process CSS files
            self._extract_styles()
            
            # Analyze overall structure
            self._analyze_structure()
            
            # Save extracted data
            self._save_extraction_results()
            
            self.logger.info("Extraction completed successfully")
            
        except Exception as e:
            self.logger.error(f"Extraction failed: {str(e)}")
            self.extracted_data["errors"].append(str(e))
        
        return self.extracted_data
    
    def _extract_metadata(self):
        """Extract basic metadata about the submission."""
        self.logger.debug("Extracting submission metadata")
        
        self.extracted_data["metadata"] = {
            "student_id": self.submission_dir.name,
            "extraction_timestamp": datetime.now().isoformat(),
            "submission_path": str(self.submission_dir),
            "total_files": sum(1 for _ in self.submission_dir.rglob("*") if _.is_file()),
            "total_size_bytes": sum(f.stat().st_size for f in self.submission_dir.rglob("*") if f.is_file())
        }
    
    def _find_html_files(self) -> List[Path]:
        """
        Locate all HTML files in the submission.
        
        Returns:
            List of paths to HTML files
        """
        html_extensions = ['.html', '.htm']
        html_files = []
        
        for ext in html_extensions:
            html_files.extend(self.submission_dir.rglob(f"*{ext}"))
        
        self.logger.info(f"Found {len(html_files)} HTML files")
        return html_files
    
    def _process_html_file(self, html_path: Path):
        """
        Parse and extract content from a single HTML file.
        
        Args:
            html_path: Path to HTML file
        """
        self.logger.debug(f"Processing HTML file: {html_path}")
        
        try:
            with open(html_path, 'r', encoding='utf-8', errors='ignore') as f:
                html_content = f.read()
            
            # Parse HTML using html5lib for robustness
            soup = BeautifulSoup(html_content, 'html5lib')
            
            # Extract structured data
            html_data = {
                "filepath": str(html_path.relative_to(self.submission_dir)),
                "title": self._extract_title(soup),
                "text_content": self._extract_text(soup),
                "headings": self._extract_headings(soup),
                "links": self._extract_links(soup, html_path),
                "images_referenced": self._extract_image_references(soup),
                "semantic_elements": self._analyze_semantic_structure(soup),
                "accessibility_features": self._check_accessibility(soup),
                "metadata_tags": self._extract_metadata_tags(soup)
            }
            
            self.extracted_data["html_files"].append(html_data)
            
            # Store full text for AI processing
            self.extracted_data["text_content"].append({
                "source": html_data["filepath"],
                "content": html_data["text_content"]
            })
            
        except Exception as e:
            self.logger.error(f"Error processing {html_path}: {str(e)}")
            self.extracted_data["errors"].append(f"HTML processing error in {html_path}: {str(e)}")
    
    def _extract_title(self, soup: BeautifulSoup) -> str:
        """Extract page title."""
        title_tag = soup.find('title')
        return title_tag.get_text(strip=True) if title_tag else "No title"
    
    def _extract_text(self, soup: BeautifulSoup) -> str:
        """
        Extract visible text content from HTML.
        
        This method removes script and style elements and extracts
        human-readable text following best practices for text extraction
        (Finn et al., 2001).
        """
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        
        # Get text
        text = soup.get_text(separator=' ', strip=True)
        
        # Clean up whitespace
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        return text
    
    def _extract_headings(self, soup: BeautifulSoup) -> List[Dict]:
        """Extract all heading elements with their hierarchy."""
        headings = []
        for level in range(1, 7):
            for heading in soup.find_all(f'h{level}'):
                headings.append({
                    "level": level,
                    "text": heading.get_text(strip=True)
                })
        return headings
    
    def _extract_links(self, soup: BeautifulSoup, base_path: Path) -> List[Dict]:
        """Extract all hyperlinks."""
        links = []
        for link in soup.find_all('a', href=True):
            links.append({
                "text": link.get_text(strip=True),
                "href": link['href'],
                "is_external": self._is_external_link(link['href'])
            })
        return links
    
    def _is_external_link(self, href: str) -> bool:
        """Determine if a link is external."""
        parsed = urlparse(href)
        return bool(parsed.netloc)
    
    def _extract_image_references(self, soup: BeautifulSoup) -> List[Dict]:
        """Extract information about images referenced in HTML."""
        images = []
        for img in soup.find_all('img'):
            images.append({
                "src": img.get('src', ''),
                "alt": img.get('alt', ''),
                "title": img.get('title', '')
            })
        return images
    
    def _analyze_semantic_structure(self, soup: BeautifulSoup) -> Dict:
        """
        Analyze use of semantic HTML5 elements.
        
        Semantic HTML usage is an important criterion for assessing
        web development skill and accessibility (Lachlainn & McCarthy, 2016).
        """
        semantic_elements = [
            'header', 'nav', 'main', 'article', 'section', 
            'aside', 'footer', 'figure', 'figcaption'
        ]
        
        structure = {}
        for element in semantic_elements:
            count = len(soup.find_all(element))
            if count > 0:
                structure[element] = count
        
        return structure
    
    def _check_accessibility(self, soup: BeautifulSoup) -> Dict:
        """
        Check for basic accessibility features.
        
        Accessibility is a critical dimension of web quality that can be
        assessed automatically (Vigo et al., 2013).
        """
        accessibility = {
            "images_with_alt": 0,
            "images_without_alt": 0,
            "has_lang_attribute": bool(soup.html and soup.html.get('lang')),
            "has_viewport_meta": bool(soup.find('meta', attrs={'name': 'viewport'})),
            "heading_hierarchy_valid": True,  # Would need more complex check
            "form_labels_present": len(soup.find_all('label')) > 0
        }
        
        # Check alt attributes on images
        for img in soup.find_all('img'):
            if img.get('alt') is not None:
                accessibility["images_with_alt"] += 1
            else:
                accessibility["images_without_alt"] += 1
        
        return accessibility
    
    def _extract_metadata_tags(self, soup: BeautifulSoup) -> Dict:
        """Extract meta tags from HTML head."""
        metadata = {}
        for meta in soup.find_all('meta'):
            name = meta.get('name') or meta.get('property')
            content = meta.get('content')
            if name and content:
                metadata[name] = content
        return metadata
    
    def _extract_images(self):
        """
        Extract and process image files.
        
        Images are encoded in base64 for inclusion in API requests,
        following best practices for multimodal AI input (Radford et al., 2021).
        """
        self.logger.debug("Extracting images")
        
        image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp']
        image_files = []
        
        for ext in image_extensions:
            image_files.extend(self.submission_dir.rglob(f"*{ext}"))
        
        for img_path in image_files:
            try:
                img_data = self._process_image(img_path)
                self.extracted_data["images"].append(img_data)
            except Exception as e:
                self.logger.error(f"Error processing image {img_path}: {str(e)}")
    
    def _process_image(self, img_path: Path) -> Dict:
        """
        Process a single image file.
        
        Args:
            img_path: Path to image file
            
        Returns:
            Dictionary containing image data and metadata
        """
        img_data = {
            "filepath": str(img_path.relative_to(self.submission_dir)),
            "filename": img_path.name,
            "size_bytes": img_path.stat().st_size
        }
        
        try:
            # Open image with PIL
            with Image.open(img_path) as img:
                img_data["width"] = img.width
                img_data["height"] = img.height
                img_data["format"] = img.format
                img_data["mode"] = img.mode
                
                # Resize if necessary (for API token limits)
                max_dimension = self.config.get("max_image_dimension", 1200)
                if img.width > max_dimension or img.height > max_dimension:
                    img.thumbnail((max_dimension, max_dimension))
                    self.logger.debug(f"Resized image {img_path.name}")
                
                # Convert to base64 for API transmission
                img_data["base64"] = self._encode_image_base64(img_path)
                
        except Exception as e:
            self.logger.error(f"Could not process image {img_path}: {str(e)}")
            img_data["error"] = str(e)
        
        return img_data
    
    def _encode_image_base64(self, img_path: Path) -> str:
        """Encode image as base64 string."""
        with open(img_path, 'rb') as img_file:
            return base64.b64encode(img_file.read()).decode('utf-8')
    
    def _extract_styles(self):
        """Extract and analyze CSS styles."""
        self.logger.debug("Extracting styles")
        
        css_files = list(self.submission_dir.rglob("*.css"))
        
        for css_path in css_files:
            try:
                with open(css_path, 'r', encoding='utf-8', errors='ignore') as f:
                    css_content = f.read()
                
                style_data = {
                    "filepath": str(css_path.relative_to(self.submission_dir)),
                    "size_bytes": css_path.stat().st_size,
                    "content": css_content,
                    "rules_count": self._count_css_rules(css_content)
                }
                
                self.extracted_data["styles"].append(style_data)
                
            except Exception as e:
                self.logger.error(f"Error processing CSS {css_path}: {str(e)}")
    
    def _count_css_rules(self, css_content: str) -> int:
        """Count number of CSS rules."""
        rules = tinycss2.parse_stylesheet(css_content)
        return len([r for r in rules if r.type == 'qualified-rule'])
    
    def _analyze_structure(self):
        """Analyze overall submission structure."""
        self.logger.debug("Analyzing submission structure")
        
        self.extracted_data["structure"] = {
            "total_html_files": len(self.extracted_data["html_files"]),
            "total_images": len(self.extracted_data["images"]),
            "total_css_files": len(self.extracted_data["styles"]),
            "has_index_page": any(
                'index.html' in html_data["filepath"] or 'index.htm' in html_data["filepath"]
                for html_data in self.extracted_data["html_files"]
            ),
            "directory_depth": max(
                len(Path(html_data["filepath"]).parts) 
                for html_data in self.extracted_data["html_files"]
            ) if self.extracted_data["html_files"] else 0
        }
    
    def _save_extraction_results(self):
        """Save extracted data to JSON file."""
        output_file = self.output_dir / "extracted_content.json"
        
        # Create a copy without base64 image data for readability
        summary_data = {k: v for k, v in self.extracted_data.items() if k != "images"}
        summary_data["images"] = [
            {k: v for k, v in img.items() if k != "base64"}
            for img in self.extracted_data["images"]
        ]
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(summary_data, f, indent=2, ensure_ascii=False)
        
        self.logger.info(f"Extraction results saved to {output_file}")
        
        # Save full data with images separately
        full_output_file = self.output_dir / "extracted_content_full.json"
        with open(full_output_file, 'w', encoding='utf-8') as f:
            json.dump(self.extracted_data, f, indent=2, ensure_ascii=False)


def main():
    """Command-line interface for content extraction."""
    parser = argparse.ArgumentParser(
        description="Extract multimodal content from student web submissions"
    )
    parser.add_argument(
        "submission_dir",
        type=Path,
        help="Directory containing student submission"
    )
    parser.add_argument(
        "output_dir",
        type=Path,
        help="Directory for extraction output"
    )
    parser.add_argument(
        "--config",
        type=Path,
        help="Path to configuration file (JSON)"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose logging"
    )
    
    args = parser.parse_args()
    
    # Setup logging
    log_level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=log_level,
        format='[%(asctime)s] [%(levelname)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Load configuration
    config = {}
    if args.config:
        with open(args.config, 'r') as f:
            config = json.load(f)
    
    # Create extractor and run
    extractor = SubmissionExtractor(
        args.submission_dir,
        args.output_dir,
        config
    )
    
    results = extractor.extract_all()
    
    # Print summary
    print(f"\nExtraction Summary:")
    print(f"  HTML files: {len(results['html_files'])}")
    print(f"  Images: {len(results['images'])}")
    print(f"  CSS files: {len(results['styles'])}")
    print(f"  Errors: {len(results['errors'])}")
    
    if results['errors']:
        print(f"\nErrors encountered:")
        for error in results['errors']:
            print(f"  - {error}")
    
    return 0 if not results['errors'] else 1


if __name__ == "__main__":
    sys.exit(main())
