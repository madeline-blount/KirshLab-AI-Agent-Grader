#!/usr/bin/env python3
"""
Part 3 Evaluator: Systematic Evaluation (Matrix Analysis)

Evaluates comparison matrix (30 cells) for:
- Evaluative vs. descriptive language
- UX principle citations
- Specificity and evidence
- Matrix completeness

Includes confidence scoring for all evaluations.
"""

import re
import json
from typing import Dict, List, Tuple
from collections import Counter


class Part3Evaluator:
    """
    Evaluates Part 3: Systematic Evaluation (30 points)
    
    Components:
    - Comparison Matrix (20 pts)
    - Tool-Based Analysis (5 pts)
    - Selection Rationale (5 pts)
    """
    
    # Known UX principles and frameworks
    UX_PRINCIPLES = [
        "miller's law", "hick's law", "fitts's law", "fitts' law",
        "gestalt", "proximity", "similarity", "closure", "continuity",
        "wcag", "accessibility", "contrast ratio",
        "nielsen norman", "usability heuristic",
        "cognitive load", "mental model",
        "f-pattern", "z-pattern", "scan pattern",
        "visual hierarchy", "information architecture",
        "design thinking", "user-centered design",
        "affordance", "signifier", "feedback",
        "consistency", "recognition over recall"
    ]
    
    # Indicators of evaluative language
    EVALUATIVE_INDICATORS = [
        # Impact/causation
        "meets threshold", "exceeds", "reduces", "increases",
        "impact", "effect", "results in", "causes", "leads to",
        "improves", "enhances", "strengthens", "weakens",
        
        # Comparison/tradeoffs
        "however", "but", "although", "while", "whereas",
        "tradeoff", "trade-off", "versus", "compared to",
        
        # Reasoning
        "because", "therefore", "thus", "consequently",
        "since", "as a result", "this means", "suggesting",
        
        # Measurement/quantification
        "by", "percent", "%", "approximately", "roughly",
        "about", "around", "within", "between",
        
        # Quality judgments with reasoning
        "effective because", "successful due to",
        "problematic since", "beneficial as"
    ]
    
    # Indicators of descriptive language
    DESCRIPTIVE_INDICATORS = [
        # Simple existence
        "has", "contains", "includes", "shows", "displays",
        "is", "are", "uses", "features", "presents",
        
        # Without context or evaluation
        "there is", "there are", "consists of",
        "made of", "composed of"
    ]
    
    def __init__(self, part3_data: Dict):
        """
        Initialize Part 3 evaluator.
        
        Args:
            part3_data: Extracted Part 3 content from PDF processor
        """
        self.part3_data = part3_data
        self.text_content = part3_data.get("text_content", "")
        
        # Evaluation results
        self.results = {
            "matrix_evaluation": {},
            "tool_analysis_evaluation": {},
            "rationale_evaluation": {},
            "overall_score": 0,
            "confidence_scores": {},
            "warnings": [],
            "hard_rules_triggered": []
        }
    
    def evaluate(self) -> Dict:
        """
        Main evaluation pipeline.
        
        Returns:
            Dictionary with scores, confidence levels, and feedback
        """
        # 1. Extract and evaluate matrix
        self._evaluate_matrix()
        
        # 2. Evaluate tool-based analysis
        self._evaluate_tool_analysis()
        
        # 3. Evaluate selection rationale
        self._evaluate_selection_rationale()
        
        # 4. Calculate overall score
        self._calculate_overall_score()
        
        return self.results
    
    def _evaluate_matrix(self):
        """
        Evaluate comparison matrix (20 points).
        
        Checks:
        - Completeness (30 cells expected)
        - Evaluative vs. descriptive language
        - UX principle citations
        - Specificity and evidence
        """
        matrix_eval = {
            "cells_found": 0,
            "cells_analyzed": [],
            "evaluative_count": 0,
            "descriptive_count": 0,
            "ux_principle_citations": 0,
            "score": 0,
            "feedback": []
        }
        
        # Extract matrix cells
        cells = self._extract_matrix_cells()
        matrix_eval["cells_found"] = len(cells)
        
        # Analyze each cell
        for i, cell in enumerate(cells):
            cell_analysis = self._analyze_cell(cell, i + 1)
            matrix_eval["cells_analyzed"].append(cell_analysis)
            
            if cell_analysis["classification"] == "EVALUATIVE":
                matrix_eval["evaluative_count"] += 1
            elif cell_analysis["classification"] == "DESCRIPTIVE":
                matrix_eval["descriptive_count"] += 1
        
        # Count UX principles
        matrix_eval["ux_principle_citations"] = self._count_ux_principles(self.text_content)
        
        # Calculate score
        score, confidence, feedback = self._score_matrix(matrix_eval)
        matrix_eval["score"] = score
        matrix_eval["feedback"] = feedback
        
        self.results["matrix_evaluation"] = matrix_eval
        self.results["confidence_scores"]["matrix"] = confidence
    
    def _extract_matrix_cells(self) -> List[str]:
        """
        Extract individual matrix cells from text.
        
        This is challenging because the matrix format varies.
        Strategy:
        1. Look for table structure patterns
        2. Look for repeated concept/criterion patterns
        3. Extract text blocks that appear to be evaluative
        
        Returns:
            List of cell text strings
        """
        cells = []
        
        # Strategy 1: Look for clear section boundaries
        # Pattern: "Concept X" or "Criterion Y" headers followed by content
        
        text = self.text_content
        
        # Look for lines that appear to be matrix cells
        # Characteristics:
        # - Multiple sentences
        # - Contains evaluative language
        # - 20-200 words typically
        
        paragraphs = text.split('\n\n')
        
        for para in paragraphs:
            para = para.strip()
            
            # Skip very short or very long blocks
            word_count = len(para.split())
            if word_count < 10 or word_count > 300:
                continue
            
            # Look for evaluative indicators
            has_eval_indicators = any(
                indicator in para.lower()
                for indicator in self.EVALUATIVE_INDICATORS[:15]  # Check key indicators
            )
            
            if has_eval_indicators:
                cells.append(para)
        
        # If we didn't find enough cells, be more lenient
        if len(cells) < 20:
            # Include more paragraphs
            for para in paragraphs:
                para = para.strip()
                word_count = len(para.split())
                
                if 15 <= word_count <= 250 and para not in cells:
                    # Check if it has design-related content
                    design_terms = ["design", "layout", "hierarchy", "spacing", "visual", "navigation"]
                    if any(term in para.lower() for term in design_terms):
                        cells.append(para)
        
        return cells[:50]  # Cap at 50 to avoid including non-matrix content
    
    def _analyze_cell(self, cell_text: str, cell_number: int) -> Dict:
        """
        Analyze a single matrix cell.
        
        Args:
            cell_text: Text content of the cell
            cell_number: Cell index (1-30)
            
        Returns:
            Analysis dictionary with classification and confidence
        """
        analysis = {
            "cell_number": cell_number,
            "text": cell_text,
            "word_count": len(cell_text.split()),
            "classification": "UNKNOWN",
            "confidence": 0.0,
            "evaluative_score": 0.0,
            "descriptive_score": 0.0,
            "has_measurement": False,
            "has_impact_statement": False,
            "has_tradeoff": False,
            "reasoning": []
        }
        
        cell_lower = cell_text.lower()
        
        # Count evaluative indicators
        eval_count = sum(
            1 for indicator in self.EVALUATIVE_INDICATORS
            if indicator in cell_lower
        )
        
        # Count descriptive indicators
        desc_count = sum(
            1 for indicator in self.DESCRIPTIVE_INDICATORS
            if indicator in cell_lower
        )
        
        # Check for measurements (numbers, percentages, thresholds)
        has_numbers = bool(re.search(r'\d+', cell_text))
        has_percentage = '%' in cell_text or 'percent' in cell_lower
        has_threshold = any(word in cell_lower for word in ['≤', '≥', '>=', '<=', 'threshold', 'target', 'meets'])
        
        analysis["has_measurement"] = has_numbers and (has_percentage or has_threshold)
        
        # Check for impact statements
        impact_patterns = [
            r'\b(reduces?|increases?|improves?|enhances?|strengthens?|weakens?)',
            r'\b(by|from|to)\s+\d+',
            r'(impact|effect|result)',
        ]
        analysis["has_impact_statement"] = any(
            re.search(pattern, cell_lower) for pattern in impact_patterns
        )
        
        # Check for tradeoff discussion
        tradeoff_words = ['however', 'but', 'although', 'while', 'tradeoff', 'trade-off', 'versus']
        analysis["has_tradeoff"] = any(word in cell_lower for word in tradeoff_words)
        
        # Calculate scores
        analysis["evaluative_score"] = eval_count / max(len(self.EVALUATIVE_INDICATORS), 1)
        analysis["descriptive_score"] = desc_count / max(len(self.DESCRIPTIVE_INDICATORS), 1)
        
        # Classification logic
        if analysis["has_impact_statement"] and analysis["has_measurement"]:
            analysis["classification"] = "EVALUATIVE"
            analysis["confidence"] = 0.9
            analysis["reasoning"].append("Contains impact statement with measurements")
        elif eval_count > desc_count and eval_count > 2:
            analysis["classification"] = "EVALUATIVE"
            analysis["confidence"] = 0.7 + (0.1 if analysis["has_tradeoff"] else 0)
            analysis["reasoning"].append(f"Strong evaluative language ({eval_count} indicators)")
        elif desc_count > eval_count and desc_count > 2:
            analysis["classification"] = "DESCRIPTIVE"
            analysis["confidence"] = 0.7
            analysis["reasoning"].append(f"Primarily descriptive language ({desc_count} indicators)")
        elif eval_count > 0:
            analysis["classification"] = "EVALUATIVE"
            analysis["confidence"] = 0.5
            analysis["reasoning"].append("Some evaluative indicators present")
        else:
            analysis["classification"] = "DESCRIPTIVE"
            analysis["confidence"] = 0.6
            analysis["reasoning"].append("No clear evaluative language")
        
        return analysis
    
    def _count_ux_principles(self, text: str) -> int:
        """
        Count UX principle citations in text.
        
        Args:
            text: Text to analyze
            
        Returns:
            Number of unique UX principles referenced
        """
        text_lower = text.lower()
        
        found_principles = set()
        
        for principle in self.UX_PRINCIPLES:
            if principle in text_lower:
                found_principles.add(principle)
        
        return len(found_principles)
    
    def _score_matrix(self, matrix_eval: Dict) -> Tuple[float, float, List[str]]:
        """
        Calculate matrix score out of 20 points.
        
        Args:
            matrix_eval: Matrix evaluation data
            
        Returns:
            Tuple of (score, confidence, feedback_list)
        """
        score = 0.0
        confidence = 0.0
        feedback = []
        
        cells_found = matrix_eval["cells_found"]
        evaluative_count = matrix_eval["evaluative_count"]
        descriptive_count = matrix_eval["descriptive_count"]
        ux_citations = matrix_eval["ux_principle_citations"]
        
        # Check completeness
        if cells_found == 0:
            feedback.append("❌ CRITICAL: No matrix cells detected")
            confidence = 0.9
            return 0, confidence, feedback
        
        if cells_found < 25:
            feedback.append(f"⚠️ Only {cells_found} cells detected (expect 30)")
            confidence = 0.6
        else:
            confidence = 0.8
        
        # Calculate evaluative percentage
        total_classified = evaluative_count + descriptive_count
        if total_classified > 0:
            evaluative_pct = evaluative_count / total_classified
        else:
            evaluative_pct = 0
        
        # HARD RULE: >50% descriptive = max 14/20
        if evaluative_pct < 0.5:
            feedback.append(f"🚨 HARD RULE: {evaluative_pct*100:.0f}% evaluative (need >50%) → capped at 14/20")
            self.results["hard_rules_triggered"].append({
                "rule": "matrix_descriptive_cap",
                "details": f"{evaluative_pct*100:.0f}% evaluative",
                "cap": 14
            })
            max_score = 14
        else:
            max_score = 20
        
        # Scoring logic
        # Base score from completeness
        completeness_score = min(cells_found / 30.0, 1.0) * 8  # Up to 8 points for completeness
        
        # Score from evaluative quality
        evaluative_quality_score = evaluative_pct * 8  # Up to 8 points for being evaluative
        
        # Score from UX principles
        ux_score = min(ux_citations / 5.0, 1.0) * 4  # Up to 4 points for 5+ principles
        
        score = completeness_score + evaluative_quality_score + ux_score
        score = min(score, max_score)
        
        # Feedback
        feedback.append(f"📊 Matrix cells detected: {cells_found}/30")
        feedback.append(f"✅ Evaluative cells: {evaluative_count} ({evaluative_pct*100:.0f}%)")
        feedback.append(f"📋 Descriptive cells: {descriptive_count}")
        feedback.append(f"🎓 UX principles cited: {ux_citations}")
        feedback.append(f"💯 Matrix score: {score:.1f}/{max_score}")
        
        if evaluative_pct >= 0.8:
            feedback.append("🌟 Excellent: Highly evaluative matrix")
        elif evaluative_pct >= 0.6:
            feedback.append("✓ Good: Mostly evaluative")
        elif evaluative_pct >= 0.4:
            feedback.append("⚠️ Adequate: Mixed evaluative/descriptive")
        else:
            feedback.append("❌ Poor: Too descriptive")
        
        return score, confidence, feedback
    
    def _evaluate_tool_analysis(self):
        """
        Evaluate tool-based analysis section (5 points).
        
        Looks for:
        - Mention of tools used
        - Screenshots or evidence
        - Interpretation of results
        """
        tool_eval = {
            "tools_mentioned": [],
            "has_evidence": False,
            "has_interpretation": False,
            "score": 0,
            "feedback": []
        }
        
        text_lower = self.text_content.lower()
        
        # Look for tool mentions
        tools = [
            "v41 wizard", "wizard", "chatgpt", "claude", "ai",
            "contrast checker", "wave", "lighthouse",
            "figma", "sketch", "adobe xd"
        ]
        
        for tool in tools:
            if tool in text_lower:
                tool_eval["tools_mentioned"].append(tool)
        
        # Check for evidence keywords
        evidence_keywords = ["screenshot", "image", "figure", "result", "output", "shows", "demonstrates"]
        tool_eval["has_evidence"] = any(kw in text_lower for kw in evidence_keywords)
        
        # Check for interpretation
        interpretation_keywords = ["analysis", "insight", "finding", "helped", "used to", "revealed", "showed that"]
        tool_eval["has_interpretation"] = any(kw in text_lower for kw in interpretation_keywords)
        
        # Score
        if len(tool_eval["tools_mentioned"]) > 0 and tool_eval["has_interpretation"]:
            tool_eval["score"] = 5
            tool_eval["feedback"].append("✅ Complete tool analysis with interpretation")
        elif len(tool_eval["tools_mentioned"]) > 0:
            tool_eval["score"] = 3
            tool_eval["feedback"].append("⚠️ Tools mentioned but limited interpretation")
        else:
            tool_eval["score"] = 0
            tool_eval["feedback"].append("❌ No clear tool analysis found")
        
        confidence = 0.7 if len(tool_eval["tools_mentioned"]) > 0 else 0.5
        
        self.results["tool_analysis_evaluation"] = tool_eval
        self.results["confidence_scores"]["tool_analysis"] = confidence
    
    def _evaluate_selection_rationale(self):
        """
        Evaluate selection rationale (5 points).
        
        Requirements:
        - 200-300 words
        - Cites matrix evidence
        - Acknowledges tradeoffs
        - Clear reasoning
        """
        rationale_eval = {
            "word_count": 0,
            "has_matrix_citations": False,
            "has_tradeoffs": False,
            "has_clear_reasoning": False,
            "score": 0,
            "feedback": []
        }
        
        # Find rationale section
        # Look for keywords like "selection rationale", "chosen", "selected"
        text = self.text_content
        
        # Simple approach: look for paragraph with "selected" or "chose"
        rationale_text = ""
        for para in text.split('\n\n'):
            if 'select' in para.lower() or 'chose' in para.lower() or 'rationale' in para.lower():
                if len(para.split()) > 100:  # Substantial paragraph
                    rationale_text = para
                    break
        
        if not rationale_text:
            # Try to find any substantial concluding paragraph
            paragraphs = [p for p in text.split('\n\n') if len(p.split()) > 150]
            if paragraphs:
                rationale_text = paragraphs[-1]  # Last substantial paragraph
        
        if rationale_text:
            rationale_eval["word_count"] = len(rationale_text.split())
            
            # Check for matrix citations
            matrix_keywords = ["matrix", "comparison", "evaluation", "criterion", "score", "as shown"]
            rationale_eval["has_matrix_citations"] = any(kw in rationale_text.lower() for kw in matrix_keywords)
            
            # Check for tradeoffs
            tradeoff_keywords = ["however", "although", "tradeoff", "trade-off", "but", "while", "versus"]
            rationale_eval["has_tradeoffs"] = any(kw in rationale_text.lower() for kw in tradeoff_keywords)
            
            # Check for reasoning
            reasoning_keywords = ["because", "since", "therefore", "as a result", "due to", "this means"]
            rationale_eval["has_clear_reasoning"] = any(kw in rationale_text.lower() for kw in reasoning_keywords)
        
        # Score
        score = 0
        word_count = rationale_eval["word_count"]
        
        # Word count scoring
        if 200 <= word_count <= 300:
            score += 1
            rationale_eval["feedback"].append(f"✅ Word count: {word_count} (target: 200-300)")
        elif 150 <= word_count < 200 or 300 < word_count <= 350:
            score += 0.5
            rationale_eval["feedback"].append(f"⚠️ Word count: {word_count} (slightly off target)")
        else:
            rationale_eval["feedback"].append(f"❌ Word count: {word_count} (target: 200-300)")
        
        # Matrix citations (HARD RULE: no citation = max 3/5)
        if rationale_eval["has_matrix_citations"]:
            score += 2
            rationale_eval["feedback"].append("✅ Cites matrix evidence")
        else:
            rationale_eval["feedback"].append("❌ No matrix citations → max 3/5")
            self.results["hard_rules_triggered"].append({
                "rule": "rationale_no_matrix_citation",
                "cap": 3
            })
        
        # Tradeoffs
        if rationale_eval["has_tradeoffs"]:
            score += 1
            rationale_eval["feedback"].append("✅ Acknowledges tradeoffs")
        else:
            rationale_eval["feedback"].append("⚠️ No tradeoff discussion")
        
        # Reasoning
        if rationale_eval["has_clear_reasoning"]:
            score += 1
            rationale_eval["feedback"].append("✅ Clear reasoning present")
        else:
            rationale_eval["feedback"].append("⚠️ Limited explicit reasoning")
        
        # Apply cap if needed
        if not rationale_eval["has_matrix_citations"]:
            score = min(score, 3)
        
        rationale_eval["score"] = score
        
        confidence = 0.8 if rationale_text else 0.4
        
        self.results["selection_rationale_evaluation"] = rationale_eval
        self.results["confidence_scores"]["rationale"] = confidence
    
    def _calculate_overall_score(self):
        """Calculate overall Part 3 score out of 30."""
        matrix_score = self.results["matrix_evaluation"]["score"]
        tool_score = self.results["tool_analysis_evaluation"]["score"]
        rationale_score = self.results["selection_rationale_evaluation"]["score"]
        
        total = matrix_score + tool_score + rationale_score
        
        # Check for caps from hard rules
        caps = [rule["cap"] for rule in self.results["hard_rules_triggered"]]
        if caps:
            total = min(total, min(caps))
        
        self.results["overall_score"] = total
        self.results["max_score"] = 30


def main():
    """Test the evaluator with sample data."""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python evaluate_part3.py <extracted_json>")
        sys.exit(1)
    
    import json
    from pathlib import Path
    
    json_path = Path(sys.argv[1])
    
    with open(json_path) as f:
        data = json.load(f)
    
    # Find Part 3
    part3_data = None
    for part in data.get("parts", []):
        if part["part_number"] == 3:
            part3_data = part
            break
    
    if not part3_data:
        print("ERROR: Part 3 not found in extracted data")
        sys.exit(1)
    
    # Evaluate
    evaluator = Part3Evaluator(part3_data)
    results = evaluator.evaluate()
    
    # Print results
    print("\n" + "="*60)
    print("PART 3 EVALUATION RESULTS")
    print("="*60)
    
    print(f"\n📊 OVERALL SCORE: {results['overall_score']:.1f}/30")
    
    print("\n🔲 MATRIX EVALUATION (20 pts):")
    print(f"   Score: {results['matrix_evaluation']['score']:.1f}/20")
    print(f"   Confidence: {results['confidence_scores']['matrix']:.0%}")
    for fb in results['matrix_evaluation']['feedback']:
        print(f"   {fb}")
    
    print("\n🔧 TOOL ANALYSIS (5 pts):")
    print(f"   Score: {results['tool_analysis_evaluation']['score']:.1f}/5")
    print(f"   Confidence: {results['confidence_scores']['tool_analysis']:.0%}")
    for fb in results['tool_analysis_evaluation']['feedback']:
        print(f"   {fb}")
    
    print("\n📝 SELECTION RATIONALE (5 pts):")
    print(f"   Score: {results['selection_rationale_evaluation']['score']:.1f}/5")
    print(f"   Confidence: {results['confidence_scores']['rationale']:.0%}")
    for fb in results['selection_rationale_evaluation']['feedback']:
        print(f"   {fb}")
    
    if results['hard_rules_triggered']:
        print("\n🚨 HARD RULES TRIGGERED:")
        for rule in results['hard_rules_triggered']:
            print(f"   - {rule['rule']}: {rule.get('details', '')} (cap: {rule['cap']})")
    
    # Save results
    output_path = json_path.parent / "part3_evaluation.json"
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\nResults saved to: {output_path}")


if __name__ == "__main__":
    main()
