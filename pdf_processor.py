#!/usr/bin/env python3
"""
PDF Processor Module
Extracts and structures content from multi-part PDF submissions

This module handles:
- Part boundary detection using text markers
- Text and image extraction per part
- Table/matrix extraction
- Page-to-part mapping
"""

import sys
import re
import json
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from datetime import datetime

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Error: PyMuPDF not installed. Install with: pip install PyMuPDF")
    sys.exit(1)


class PDFProcessor:
    """
    Processes multi-part PDF submissions for grading.
    
    Detects part boundaries, extracts content, and structures data
    for evaluation modules.
    """
    
    def __init__(self, pdf_path: Path, output_dir: Path):
        """
        Initialize PDF processor.
        
        Args:
            pdf_path: Path to student PDF submission
            output_dir: Directory for extracted content
        """
        self.pdf_path = Path(pdf_path)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize data structure
        self.extracted_data = {
            "metadata": {},
            "parts": [],
            "raw_text": "",
            "table_of_contents": None,
            "part_boundaries": [],
            "errors": []
        }
        
        self.doc = None
        
    def process(self) -> Dict:
        """
        Main processing pipeline.
        
        Returns:
            Dictionary containing all extracted and structured content
        """
        try:
            # Open PDF
            self.doc = fitz.open(self.pdf_path)
            
            # Extract metadata
            self._extract_metadata()
            
            # Extract all text
            self._extract_all_text()
            
            # Detect part boundaries
            self._detect_part_boundaries()
            
            # Extract content per part
            self._extract_parts_content()
            
            # Save results
            self._save_results()
            
            return self.extracted_data
            
        except Exception as e:
            self.extracted_data["errors"].append(f"Processing failed: {str(e)}")
            raise
            
        finally:
            if self.doc:
                self.doc.close()
    
    def _extract_metadata(self):
        """Extract basic PDF metadata."""
        self.extracted_data["metadata"] = {
            "filename": self.pdf_path.name,
            "filepath": str(self.pdf_path),
            "processing_timestamp": datetime.now().isoformat(),
            "total_pages": len(self.doc),
            "pdf_metadata": self.doc.metadata
        }
    
    def _extract_all_text(self):
        """Extract all text from PDF for analysis."""
        all_text = []
        for page_num in range(len(self.doc)):
            page = self.doc[page_num]
            text = page.get_text()
            all_text.append(text)
        
        self.extracted_data["raw_text"] = "\n\n--- PAGE BREAK ---\n\n".join(all_text)
    
    def _detect_part_boundaries(self):
        """
        Detect part boundaries using text markers.
        
        Looks for patterns like:
        - "PART 1", "Part 1:", "PART1"
        - "TABLE OF CONTENTS" with page numbers
        """
        # Patterns for part markers
        part_patterns = [
            r'\bPART\s*(\d+)\b',  # "PART 1", "PART1"
            r'\bPart\s*(\d+)\b',  # "Part 1"
            r'\bpart\s*(\d+)\b',  # "part 1"
        ]
        
        boundaries = []
        
        for page_num in range(len(self.doc)):
            page = self.doc[page_num]
            text = page.get_text()
            
            # Check for part markers
            for pattern in part_patterns:
                matches = re.finditer(pattern, text, re.IGNORECASE)
                for match in matches:
                    part_number = int(match.group(1))
                    
                    # Get surrounding context
                    start = max(0, match.start() - 50)
                    end = min(len(text), match.end() + 50)
                    context = text[start:end].strip()
                    
                    boundaries.append({
                        "part_number": part_number,
                        "page_number": page_num + 1,  # 1-indexed for humans
                        "page_index": page_num,  # 0-indexed for code
                        "match_text": match.group(0),
                        "context": context,
                        "detection_method": "text_marker"
                    })
        
        # Sort by page number
        boundaries.sort(key=lambda x: x["page_index"])
        
        # Remove duplicates (same part number on same page)
        unique_boundaries = []
        seen = set()
        for b in boundaries:
            key = (b["part_number"], b["page_index"])
            if key not in seen:
                unique_boundaries.append(b)
                seen.add(key)
        
        self.extracted_data["part_boundaries"] = unique_boundaries
        
        # Detect table of contents if present
        self._detect_table_of_contents()
    
    def _detect_table_of_contents(self):
        """
        Detect table of contents page and extract part page numbers.
        """
        toc_patterns = [
            r'TABLE\s+OF\s+CONTENTS',
            r'CONTENTS',
            r'Strategic\s+Foundation.*?\d+',
            r'Divergent\s+Ideation.*?\d+',
        ]
        
        for page_num in range(min(5, len(self.doc))):  # Check first 5 pages
            page = self.doc[page_num]
            text = page.get_text()
            
            # Check if this looks like a TOC
            for pattern in toc_patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    # Extract part names and page numbers
                    toc_entries = self._parse_toc(text)
                    if toc_entries:
                        self.extracted_data["table_of_contents"] = {
                            "page": page_num + 1,
                            "entries": toc_entries
                        }
                        return
    
    def _parse_toc(self, text: str) -> List[Dict]:
        """
        Parse table of contents text to extract part information.
        
        Args:
            text: TOC page text
            
        Returns:
            List of TOC entries with part names and page numbers
        """
        entries = []
        
        # Pattern: Part name followed by page number
        # e.g., "Strategic Foundation    3"
        pattern = r'([A-Za-z\s]+?)\s+(\d+)\s*$'
        
        for line in text.split('\n'):
            line = line.strip()
            if not line:
                continue
            
            match = re.search(pattern, line)
            if match:
                part_name = match.group(1).strip()
                page_num = int(match.group(2))
                
                # Filter out unlikely entries
                if len(part_name) > 5 and page_num > 0:
                    entries.append({
                        "name": part_name,
                        "page": page_num
                    })
        
        return entries
    
    def _extract_parts_content(self):
        """
        Extract content for each detected part.
        """
        boundaries = self.extracted_data["part_boundaries"]
        
        if not boundaries:
            self.extracted_data["errors"].append("No part boundaries detected")
            return
        
        # Determine page ranges for each part
        part_ranges = []
        for i, boundary in enumerate(boundaries):
            start_page = boundary["page_index"]
            
            # End page is start of next part, or end of document
            if i + 1 < len(boundaries):
                end_page = boundaries[i + 1]["page_index"] - 1
            else:
                end_page = len(self.doc) - 1
            
            part_ranges.append({
                "part_number": boundary["part_number"],
                "start_page": start_page,
                "end_page": end_page,
                "page_count": end_page - start_page + 1
            })
        
        # Extract content for each part
        for part_range in part_ranges:
            part_data = self._extract_part_content(
                part_range["part_number"],
                part_range["start_page"],
                part_range["end_page"]
            )
            self.extracted_data["parts"].append(part_data)
    
    def _extract_part_content(self, part_number: int, start_page: int, end_page: int) -> Dict:
        """
        Extract content for a single part.
        
        Args:
            part_number: Part number (1-5)
            start_page: Starting page index (0-indexed)
            end_page: Ending page index (0-indexed, inclusive)
            
        Returns:
            Dictionary with part content
        """
        part_data = {
            "part_number": part_number,
            "page_range": [start_page + 1, end_page + 1],  # 1-indexed
            "page_count": end_page - start_page + 1,
            "text_content": "",
            "images": [],
            "tables": []
        }
        
        # Extract text from all pages in range
        text_parts = []
        for page_idx in range(start_page, end_page + 1):
            page = self.doc[page_idx]
            page_text = page.get_text()
            text_parts.append(page_text)
            
            # Extract images
            images = self._extract_images_from_page(page, page_idx)
            part_data["images"].extend(images)
            
            # Extract tables (crucial for Part 3)
            tables = self._extract_tables_from_page(page, page_idx)
            part_data["tables"].extend(tables)
        
        part_data["text_content"] = "\n\n".join(text_parts)
        
        return part_data
    
    def _extract_images_from_page(self, page, page_idx: int) -> List[Dict]:
        """
        Extract images from a page.
        
        Args:
            page: PyMuPDF page object
            page_idx: Page index (0-indexed)
            
        Returns:
            List of image metadata dictionaries
        """
        images = []
        image_list = page.get_images()
        
        for img_idx, img in enumerate(image_list):
            xref = img[0]
            
            try:
                base_image = self.doc.extract_image(xref)
                
                image_data = {
                    "page": page_idx + 1,
                    "image_index": img_idx,
                    "xref": xref,
                    "width": base_image["width"],
                    "height": base_image["height"],
                    "colorspace": base_image["colorspace"],
                    "ext": base_image["ext"],
                    # Don't store actual image bytes in JSON
                    # "image_bytes": base_image["image"]
                }
                
                images.append(image_data)
                
            except Exception as e:
                images.append({
                    "page": page_idx + 1,
                    "image_index": img_idx,
                    "error": str(e)
                })
        
        return images
    
    def _extract_tables_from_page(self, page, page_idx: int) -> List[Dict]:
        """
        Extract tables from a page.
        
        This is crucial for Part 3 matrix extraction.
        
        Args:
            page: PyMuPDF page object
            page_idx: Page index (0-indexed)
            
        Returns:
            List of table data dictionaries
        """
        tables = []
        
        # Get text with layout preserved
        text = page.get_text("text")
        
        # Simple table detection: look for grid-like structures
        # This is a basic implementation; more sophisticated table detection
        # would use libraries like camelot or tabula
        
        lines = text.split('\n')
        
        # Look for lines with multiple tabs or aligned columns
        potential_table_lines = []
        for i, line in enumerate(lines):
            # Count tabs or multiple spaces
            if '\t' in line or '  ' in line:
                potential_table_lines.append((i, line))
        
        # If we found potential table lines, group them
        if len(potential_table_lines) > 3:  # At least 3 rows for a table
            tables.append({
                "page": page_idx + 1,
                "row_count": len(potential_table_lines),
                "detection_method": "text_pattern",
                "raw_lines": [line for _, line in potential_table_lines]
            })
        
        return tables
    
    def _save_results(self):
        """Save extracted data to JSON file."""
        output_file = self.output_dir / "extracted_content.json"
        
        # Create summary without raw text for readability
        summary = {k: v for k, v in self.extracted_data.items() if k != "raw_text"}
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)
        
        # Save full data separately
        full_output_file = self.output_dir / "extracted_content_full.json"
        with open(full_output_file, 'w', encoding='utf-8') as f:
            json.dump(self.extracted_data, f, indent=2, ensure_ascii=False)


def main():
    """Command-line interface for PDF processing."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Extract content from multi-part PDF submissions"
    )
    parser.add_argument(
        "pdf_path",
        type=Path,
        help="Path to PDF file"
    )
    parser.add_argument(
        "output_dir",
        type=Path,
        help="Directory for output"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose output"
    )
    
    args = parser.parse_args()
    
    # Process PDF
    processor = PDFProcessor(args.pdf_path, args.output_dir)
    results = processor.process()
    
    # Print summary
    print(f"\nProcessing Summary:")
    print(f"  Total pages: {results['metadata']['total_pages']}")
    print(f"  Parts detected: {len(results['parts'])}")
    
    for part in results['parts']:
        print(f"    Part {part['part_number']}: pages {part['page_range'][0]}-{part['page_range'][1]} ({part['page_count']} pages)")
        print(f"      Images: {len(part['images'])}")
        print(f"      Tables: {len(part['tables'])}")
    
    if results['errors']:
        print(f"\n  Errors: {len(results['errors'])}")
        for error in results['errors']:
            print(f"    - {error}")
    
    print(f"\nOutput saved to: {args.output_dir}")
    
    return 0 if not results['errors'] else 1


if __name__ == "__main__":
    sys.exit(main())
