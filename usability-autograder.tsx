import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle2, AlertCircle, FileText, BookOpen, Settings, BarChart3, Download, Eye, Edit3, Save, Play, RefreshCw, ChevronRight, ChevronLeft, Search, Filter, Keyboard, Plus, Link2, Star, X, Trash2, MessageSquare } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

// ============================================================================
// DATA CONTRACTS (§6)
// ============================================================================

interface StudentSubmission {
  student_id: string;
  name: string;
  email: string;
  team_id?: string;
  parts: SubmissionPart[];
  ai_use_statement?: string;
}

interface SubmissionPart {
  part_id: string;
  raw_text: string;
  images: string[];
  claims: Claim[];
}

interface Claim {
  heuristic_id: string;
  description: string;
  severity_student: number;
  evidence: {
    page_url?: string;
    selector?: string;
    screenshot?: string;
  };
}

interface AICritique {
  part_id: string;
  buckets: {
    content: number;
    evidence: number;
    presentation: number;
    collaboration: number;
  };
  findings: Finding[];
  feedback_text: string;
  exemplars_used: string[];
}

interface Finding {
  heuristic_id: string;
  title: string;
  reason: string;
  severity_model: number;
  confidence: number;
  actionable_fix: string;
}

interface AutogradeResult {
  student_id: string;
  parts: AICritique[];
  score_total: number;
  flags: {
    heuristics_covered: number;
    violations_count: number;
    severity_distribution: { [key: string]: number };
    mobile_first_respected: boolean;
  };
  prompt_version: string;
}

interface Exemplar {
  id: string;
  title: string;
  scope: "global" | "part";
  part_id?: string;
  files: Array<{ kind: string; uri: string }>;
  is_gold: boolean;
  notes: string;
  created_by: string;
  created_at: string;
}

interface KnowledgeCard {
  id: string;
  slide_number: number;
  image_url: string;
  text_content: string;
  heuristic_id?: string;
  pattern_label?: string;
  part_id?: string;
  is_violation_example: boolean;
  good_pattern: boolean;
}

interface ProviderConfig {
  provider: "OpenAI" | "Anthropic" | "Custom";
  model_name: string;
  endpoint_url?: string;
  api_key: string;
  temperature: number;
  top_p: number;
  rate_limits: {
    rpm: number;
    tpm: number;
  };
  concurrency: number;
  streaming: boolean;
  retries: number;
  timeout: number;
}

// ============================================================================
// SAMPLE DATA (§14)
// ============================================================================

const SAMPLE_RUBRIC = {
  buckets: {
    content: { weight: 0.35, description: "Quality and depth of usability analysis" },
    evidence: { weight: 0.30, description: "Specificity and relevance of evidence" },
    presentation: { weight: 0.25, description: "Clarity and organization" },
    collaboration: { weight: 0.10, description: "Team contribution (if applicable)" }
  },
  severity_labels: {
    "1": "Cosmetic: Minor issue, low priority",
    "2": "Minor: Small impact on usability",
    "3": "Major: Significant usability problem",
    "4": "Catastrophic: Critical usability failure"
  },
  penalties: {
    missing_evidence: -5,
    incomplete_heuristic_coverage: -10
  },
  bonuses: {
    mobile_first_thorough: 5
  }
};

const SAMPLE_PARTS = [
  { part_id: "P1A", title: "Part 1A: Visibility of System Status" },
  { part_id: "P1B", title: "Part 1B: Match Between System and Real World" },
  { part_id: "P2A", title: "Part 2A: User Control and Freedom" },
  { part_id: "P2B", title: "Part 2B: Consistency and Standards" },
  { part_id: "P3A", title: "Part 3A: Error Prevention" },
  { part_id: "P3B", title: "Part 3B: Recognition Rather than Recall" }
];

const HEURISTICS = [
  { id: "H1", name: "Visibility of System Status", color: "bg-blue-100 text-blue-800" },
  { id: "H2", name: "Match System/Real World", color: "bg-green-100 text-green-800" },
  { id: "H3", name: "User Control & Freedom", color: "bg-purple-100 text-purple-800" },
  { id: "H4", name: "Consistency & Standards", color: "bg-orange-100 text-orange-800" },
  { id: "H5", name: "Error Prevention", color: "bg-red-100 text-red-800" },
  { id: "H6", name: "Recognition vs Recall", color: "bg-yellow-100 text-yellow-800" },
  { id: "H7", name: "Flexibility & Efficiency", color: "bg-pink-100 text-pink-800" },
  { id: "H8", name: "Aesthetic & Minimalist", color: "bg-indigo-100 text-indigo-800" },
  { id: "H9", name: "Help Users with Errors", color: "bg-teal-100 text-teal-800" },
  { id: "H10", name: "Help & Documentation", color: "bg-cyan-100 text-cyan-800" }
];

const SAMPLE_STUDENTS: StudentSubmission[] = [
  {
    student_id: "u001",
    name: "Alex Johnson",
    email: "alex.j@university.edu",
    team_id: "t-01",
    ai_use_statement: "Used ChatGPT for grammar checking only.",
    parts: [
      {
        part_id: "P1A",
        raw_text: "The website lacks loading indicators when processing payments. Users are left wondering if their action was registered.",
        images: ["submissions/u001/P1A_1.png"],
        claims: [
          {
            heuristic_id: "H1",
            description: "No loading spinner during checkout",
            severity_student: 3,
            evidence: {
              page_url: "https://example.com/checkout",
              selector: "button.submit-payment",
              screenshot: "submissions/u001/P1A_1.png"
            }
          }
        ]
      }
    ]
  },
  {
    student_id: "u002",
    name: "Morgan Lee",
    email: "morgan.l@university.edu",
    parts: [
      {
        part_id: "P1A",
        raw_text: "The search function provides no feedback while searching, creating uncertainty about whether the system is working.",
        images: ["submissions/u002/P1A_1.png"],
        claims: [
          {
            heuristic_id: "H1",
            description: "Search lacks progress indicator",
            severity_student: 2,
            evidence: {
              page_url: "https://example.com/search",
              selector: "input#search-box",
              screenshot: "submissions/u002/P1A_1.png"
            }
          }
        ]
      }
    ]
  }
];

const SAMPLE_EXEMPLARS: Exemplar[] = [
  {
    id: "ex_global_001",
    title: "A-Level Complete Assignment Example",
    scope: "global",
    files: [{ kind: "pdf", uri: "exemplars/global_a_level.pdf" }],
    is_gold: true,
    notes: "Instructor-approved exemplar covering all parts",
    created_by: "prof.smith@university.edu",
    created_at: "2025-10-15T14:30:00Z"
  },
  {
    id: "ex_part_p3b",
    title: "Excellent Part 3B Analysis",
    scope: "part",
    part_id: "P3B",
    files: [{ kind: "pdf", uri: "exemplars/part_scoped/P3B_exemplar.pdf" }],
    is_gold: true,
    notes: "Strong recognition vs recall analysis with mobile examples",
    created_by: "ta.jones@university.edu",
    created_at: "2025-10-20T09:15:00Z"
  }
];

// ============================================================================
// MOCK API (§13)
// ============================================================================

const mockApi = {
  async ingest(files: any) {
    await new Promise(r => setTimeout(r, 1000));
    return { success: true, parts: SAMPLE_PARTS };
  },
  
  async uploadKnowledge(file: File) {
    await new Promise(r => setTimeout(r, 800));
    return {
      cards: Array.from({ length: 12 }, (_, i) => ({
        id: `card_${i}`,
        slide_number: i + 1,
        image_url: `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='150'><rect fill='%23f0f0f0' width='200' height='150'/><text x='50%' y='50%' text-anchor='middle' fill='%23666'>Slide ${i+1}</text></svg>`,
        text_content: `Sample lecture content about usability heuristics ${i+1}`,
        heuristic_id: undefined,
        pattern_label: undefined,
        part_id: undefined,
        is_violation_example: false,
        good_pattern: false
      }))
    };
  },

  async getKnowledge(filters: any) {
    return { cards: [] };
  },

  async compileKnowledge() {
    await new Promise(r => setTimeout(r, 1500));
    return { success: true, patterns_count: 24, embeddings_built: true };
  },

  async createExemplar(data: Partial<Exemplar>) {
    return {
      ...data,
      id: `ex_${Date.now()}`,
      created_at: new Date().toISOString()
    };
  },

  async getExemplars(filters?: { scope?: string; part_id?: string }) {
    return SAMPLE_EXEMPLARS.filter(ex => {
      if (filters?.scope && ex.scope !== filters.scope) return false;
      if (filters?.part_id && ex.part_id !== filters.part_id) return false;
      return true;
    });
  },

  async grade(gate_k: number) {
    await new Promise(r => setTimeout(r, 2000));
    return SAMPLE_STUDENTS.slice(0, gate_k).map(s => ({
      student_id: s.student_id,
      parts: s.parts.map(p => ({
        part_id: p.part_id,
        buckets: { content: 8, evidence: 7, presentation: 9, collaboration: 8 },
        findings: p.claims.map(c => ({
          heuristic_id: c.heuristic_id,
          title: c.description,
          reason: "Violates system feedback principles; users need confirmation of actions",
          severity_model: c.severity_student,
          confidence: 0.87,
          actionable_fix: "Add loading spinner with aria-live announcement"
        })),
        feedback_text: "Your analysis demonstrates a solid grasp of visibility principles, particularly in identifying the absence of loading states. The evidence is specific and well-documented with screenshots and selectors. To tighten this further: (1) quantify the delay threshold (e.g., >200ms warrants indicator), (2) consider mobile viewport constraints on spinner placement, (3) address the aria-live region for screen readers. The severity rating of 3 is well-calibrated for a payment-critical flow.",
        exemplars_used: ["ex_global_001"]
      })),
      score_total: 84,
      flags: {
        heuristics_covered: 8,
        violations_count: 11,
        severity_distribution: { "1": 2, "2": 5, "3": 3, "4": 1 },
        mobile_first_respected: true
      },
      prompt_version: "v1"
    }));
  },

  async savePrompt(content: string, version: string) {
    await new Promise(r => setTimeout(r, 500));
    return { version, diff_summary: "Added mobile-first emphasis, tightened severity thresholds" };
  },

  async regrade(params: any) {
    await new Promise(r => setTimeout(r, 1500));
    return { success: true, changed: 2 };
  },

  async getAuditBundle() {
    return { url: "audit_bundle_2025-11-03.zip" };
  }
};

// ============================================================================
// REUSABLE WIDGETS (§12)
// ============================================================================

const HeuristicPill: React.FC<{ id: string }> = ({ id }) => {
  const h = HEURISTICS.find(h => h.id === id);
  if (!h) return <Badge variant="outline">{id}</Badge>;
  return (
    <Badge className={`${h.color} border-0`}>
      {h.id}: {h.name}
    </Badge>
  );
};

const SeverityStars: React.FC<{ severity: number; onChange?: (s: number) => void }> = ({ severity, onChange }) => {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4].map(s => (
        <button
          key={s}
          onClick={() => onChange?.(s)}
          disabled={!onChange}
          className={`w-6 h-6 rounded ${s <= severity ? 'bg-amber-400' : 'bg-gray-200'} ${onChange ? 'hover:scale-110 cursor-pointer' : ''} transition-transform`}
          aria-label={`Severity ${s}`}
        >
          {s <= severity ? '★' : '☆'}
        </button>
      ))}
      <span className="ml-2 text-sm text-gray-600">
        {SAMPLE_RUBRIC.severity_labels[severity.toString() as keyof typeof SAMPLE_RUBRIC.severity_labels]}
      </span>
    </div>
  );
};

const ConfidenceBadge: React.FC<{ confidence: number }> = ({ confidence }) => {
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? 'bg-green-100 text-green-800' : pct >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
  return <Badge className={color}>{pct}% confident</Badge>;
};

// ============================================================================
// MAIN APP & NAVIGATION
// ============================================================================

export default function UsabilityAutograder() {
  const [currentPage, setCurrentPage] = useState<'setup' | 'knowledge' | 'providers' | 'part' | 'review' | 'summary' | 'reports'>('setup');
  const [setupComplete, setSetupComplete] = useState(false);
  const [knowledgeComplete, setKnowledgeComplete] = useState(false);
  const [providersComplete, setProvidersComplete] = useState(false);
  const [gateK, setGateK] = useState(3);
  const [gradedStudents, setGradedStudents] = useState<AutogradeResult[]>([]);
  const [currentStudentIdx, setCurrentStudentIdx] = useState(0);
  const [currentPartIdx, setCurrentPartIdx] = useState(0);
  const [exemplars, setExemplars] = useState<Exemplar[]>(SAMPLE_EXEMPLARS);
  const [knowledgeCards, setKnowledgeCards] = useState<KnowledgeCard[]>([]);

  const handleSetupComplete = () => {
    setSetupComplete(true);
    setCurrentPage('knowledge');
  };

  const handleKnowledgeComplete = () => {
    setKnowledgeComplete(true);
    setCurrentPage('providers');
  };

  const handleProvidersComplete = () => {
    setProvidersComplete(true);
    setCurrentPage('part');
  };

  const handleStartGrading = async () => {
    const results = await mockApi.grade(gateK);
    setGradedStudents(results);
    setCurrentPage('review');
  };

  const navItems = [
    { id: 'setup', label: 'Setup', icon: Upload, enabled: true },
    { id: 'knowledge', label: 'Knowledge Pack', icon: BookOpen, enabled: setupComplete },
    { id: 'providers', label: 'AI Config', icon: Settings, enabled: knowledgeComplete },
    { id: 'part', label: 'Parts Review', icon: FileText, enabled: providersComplete },
    { id: 'review', label: 'AI ↔ Human', icon: Edit3, enabled: gradedStudents.length > 0 },
    { id: 'summary', label: 'Summary', icon: BarChart3, enabled: gradedStudents.length > 0 },
    { id: 'reports', label: 'Export', icon: Download, enabled: gradedStudents.length > 0 }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Usability Autograding Wizard</h1>
          <p className="text-sm text-gray-600">Nielsen's 10 Heuristics • Human-in-the-Loop Calibration</p>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-2 py-3 overflow-x-auto">
            {navItems.map((item, idx) => (
              <React.Fragment key={item.id}>
                <button
                  onClick={() => item.enabled && setCurrentPage(item.id as any)}
                  disabled={!item.enabled}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    currentPage === item.id
                      ? 'bg-blue-600 text-white'
                      : item.enabled
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
                {idx < navItems.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {currentPage === 'setup' && <SetupPage onComplete={handleSetupComplete} gateK={gateK} setGateK={setGateK} />}
        {currentPage === 'knowledge' && <KnowledgePage onComplete={handleKnowledgeComplete} cards={knowledgeCards} setCards={setKnowledgeCards} />}
        {currentPage === 'providers' && <ProvidersPage onComplete={handleProvidersComplete} />}
        {currentPage === 'part' && <PartReviewPage onStartGrading={handleStartGrading} exemplars={exemplars} setExemplars={setExemplars} />}
        {currentPage === 'review' && gradedStudents.length > 0 && (
          <ReviewPage
            student={SAMPLE_STUDENTS[currentStudentIdx]}
            result={gradedStudents[currentStudentIdx]}
            partIdx={currentPartIdx}
            onNext={() => {
              if (currentPartIdx < SAMPLE_STUDENTS[currentStudentIdx].parts.length - 1) {
                setCurrentPartIdx(currentPartIdx + 1);
              } else if (currentStudentIdx < gradedStudents.length - 1) {
                setCurrentStudentIdx(currentStudentIdx + 1);
                setCurrentPartIdx(0);
              } else {
                setCurrentPage('summary');
              }
            }}
          />
        )}
        {currentPage === 'summary' && <SummaryPage results={gradedStudents} />}
        {currentPage === 'reports' && <ReportsPage results={gradedStudents} />}
      </main>
    </div>
  );
}

// ============================================================================
// SETUP PAGE (§2, §3)
// ============================================================================

const SetupPage: React.FC<{ onComplete: () => void; gateK: number; setGateK: (k: number) => void }> = ({ onComplete, gateK, setGateK }) => {
  const [files, setFiles] = useState<Record<string, File | null>>({
    roster: null,
    assignment: null,
    rubric: null,
    prompt: null,
    exemplar1: null,
    exemplar2: null
  });
  const [validated, setValidated] = useState(false);
  const [preferredMean, setPreferredMean] = useState<number | null>(null);
  const [mobileFirst, setMobileFirst] = useState(true);

  const handleFileChange = (key: string, file: File | null) => {
    setFiles(prev => ({ ...prev, [key]: file }));
  };

  const handleValidate = async () => {
    if (!files.roster || !files.assignment || !files.rubric || !files.prompt) {
      alert('Please upload required files: Roster, Assignment, Rubric, and Prompt v1');
      return;
    }
    await mockApi.ingest(files);
    setValidated(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Setup & Ingestion</h2>
        <p className="text-gray-600 mt-2">Upload assignment materials and configure grading options</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Required Uploads</CardTitle>
          <CardDescription>All files are validated immediately upon upload</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FileUpload label="Roster CSV" required value={files.roster} onChange={f => handleFileChange('roster', f)} accept=".csv" />
          <FileUpload label="Assignment Doc (PDF/HTML)" required value={files.assignment} onChange={f => handleFileChange('assignment', f)} accept=".pdf,.html" />
          <FileUpload label="Rubric (YAML/JSON)" required value={files.rubric} onChange={f => handleFileChange('rubric', f)} accept=".yaml,.yml,.json" />
          <FileUpload label="Initial Prompt (v1)" required value={files.prompt} onChange={f => handleFileChange('prompt', f)} accept=".md,.txt" />
          <FileUpload label="Global Exemplar 1 (optional)" value={files.exemplar1} onChange={f => handleFileChange('exemplar1', f)} accept=".pdf,.html,.md" />
          <FileUpload label="Global Exemplar 2 (optional)" value={files.exemplar2} onChange={f => handleFileChange('exemplar2', f)} accept=".pdf,.html,.md" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Grading Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Gate (First K Students for Calibration)</Label>
            <Input type="number" min="1" max="10" value={gateK} onChange={e => setGateK(Number(e.target.value))} className="w-32 mt-1" />
            <p className="text-sm text-gray-500 mt-1">Review and calibrate on first {gateK} students before batch grading</p>
          </div>
          <div>
            <Label>Preferred Mean (Optional)</Label>
            <Input type="number" min="50" max="95" step="0.5" placeholder="Leave blank for no curve" value={preferredMean || ''} onChange={e => setPreferredMean(e.target.value ? Number(e.target.value) : null)} className="w-32 mt-1" />
            <p className="text-sm text-gray-500 mt-1">Rank-preserving adjustment to target mean score</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="mobile-first" checked={mobileFirst} onChange={e => setMobileFirst(e.target.checked)} className="w-4 h-4" />
            <Label htmlFor="mobile-first">Mobile-First Emphasis (flag missing mobile evidence)</Label>
          </div>
        </CardContent>
      </Card>

      {validated && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            <strong>Validation Complete:</strong> Parsed 6 parts, loaded rubric with 4 buckets, Prompt v1 ready. 2 global exemplars uploaded.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        <Button onClick={handleValidate} disabled={validated}>
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Validate Inputs
        </Button>
        <Button onClick={onComplete} disabled={!validated}>
          Continue to Knowledge Pack
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

const FileUpload: React.FC<{ label: string; required?: boolean; value: File | null; onChange: (f: File | null) => void; accept: string }> = ({ label, required, value, onChange, accept }) => (
  <div>
    <Label>{label} {required && <span className="text-red-500">*</span>}</Label>
    <div className="flex items-center gap-2 mt-1">
      <Input type="file" accept={accept} onChange={e => onChange(e.target.files?.[0] || null)} className="flex-1" />
      {value && <Badge variant="outline" className="text-green-600">{value.name}</Badge>}
    </div>
  </div>
);

// ============================================================================
// KNOWLEDGE PACK PAGE (§0B)
// ============================================================================

const KnowledgePage: React.FC<{ onComplete: () => void; cards: KnowledgeCard[]; setCards: (c: KnowledgeCard[]) => void }> = ({ onComplete, cards, setCards }) => {
  const [uploading, setUploading] = useState(false);
  const [compiled, setCompiled] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const result = await mockApi.uploadKnowledge(file);
    setCards(result.cards);
    setUploading(false);
  };

  const handleCompile = async () => {
    await mockApi.compileKnowledge();
    setCompiled(true);
  };

  const updateCard = (id: string, updates: Partial<KnowledgeCard>) => {
    setCards(cards.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const taggedCount = cards.filter(c => c.heuristic_id).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Domain Knowledge Pack</h2>
        <p className="text-gray-600 mt-2">Upload lecture slides (PPTX/PDF) and tag patterns for few-shot learning</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Lecture Materials</CardTitle>
        </CardHeader>
        <CardContent>
          <Input type="file" accept=".pdf,.pptx" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} disabled={uploading} />
          {uploading && <p className="text-sm text-gray-500 mt-2">Parsing slides...</p>}
          {cards.length > 0 && (
            <Alert className="mt-4">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Extracted {cards.length} slides • {taggedCount} tagged • Ready for compilation
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {cards.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Tag Slides ({taggedCount}/{cards.length})</CardTitle>
              <CardDescription>Assign heuristics, patterns, and part coverage to each slide</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.slice(0, 6).map(card => (
                  <div key={card.id} className="border rounded-lg p-3 space-y-2">
                    <img src={card.image_url} alt={`Slide ${card.slide_number}`} className="w-full h-32 object-cover rounded" />
                    <p className="text-xs text-gray-600 line-clamp-2">{card.text_content}</p>
                    <Select value={card.heuristic_id || ''} onValueChange={v => updateCard(card.id, { heuristic_id: v })}>
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Heuristic" />
                      </SelectTrigger>
                      <SelectContent>
                        {HEURISTICS.map(h => <SelectItem key={h.id} value={h.id}>{h.id}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <button onClick={() => updateCard(card.id, { is_violation_example: !card.is_violation_example })} className={`text-xs px-2 py-1 rounded ${card.is_violation_example ? 'bg-red-100 text-red-800' : 'bg-gray-100'}`}>
                        Violation
                      </button>
                      <button onClick={() => updateCard(card.id, { good_pattern: !card.good_pattern })} className={`text-xs px-2 py-1 rounded ${card.good_pattern ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                        Good Pattern
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {cards.length > 6 && <p className="text-sm text-gray-500 mt-4">Showing 6 of {cards.length} slides...</p>}
            </CardContent>
          </Card>

          {compiled && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>Knowledge Pack Compiled:</strong> 24 patterns indexed, embeddings built, ready for retrieval during grading.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-between">
            <Button onClick={handleCompile} disabled={compiled || taggedCount === 0}>
              <Settings className="w-4 h-4 mr-2" />
              Compile Knowledge Pack
            </Button>
            <Button onClick={onComplete}>
              Continue to AI Config
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

// ============================================================================
// PROVIDERS PAGE (§0C)
// ============================================================================

const ProvidersPage: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [config, setConfig] = useState<ProviderConfig>({
    provider: "Anthropic",
    model_name: "claude-sonnet-4-5-20250929",
    api_key: "",
    temperature: 0.7,
    top_p: 0.9,
    rate_limits: { rpm: 50, tpm: 100000 },
    concurrency: 3,
    streaming: false,
    retries: 3,
    timeout: 30
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">AI Provider Configuration</h2>
        <p className="text-gray-600 mt-2">Configure model provider, parameters, and rate limits</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provider Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Provider</Label>
            <Select value={config.provider} onValueChange={v => setConfig({ ...config, provider: v as any })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OpenAI">OpenAI</SelectItem>
                <SelectItem value="Anthropic">Anthropic</SelectItem>
                <SelectItem value="Custom">Custom HTTP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Model Name</Label>
            <Input value={config.model_name} onChange={e => setConfig({ ...config, model_name: e.target.value })} />
          </div>
          {config.provider === "Custom" && (
            <div>
              <Label>Endpoint URL</Label>
              <Input placeholder="https://api.example.com/v1/chat" value={config.endpoint_url || ''} onChange={e => setConfig({ ...config, endpoint_url: e.target.value })} />
            </div>
          )}
          <div>
            <Label>API Key (session-scoped)</Label>
            <Input type="password" value={config.api_key} onChange={e => setConfig({ ...config, api_key: e.target.value })} placeholder="sk-..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Temperature</Label>
              <Input type="number" min="0" max="2" step="0.1" value={config.temperature} onChange={e => setConfig({ ...config, temperature: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Top P</Label>
              <Input type="number" min="0" max="1" step="0.1" value={config.top_p} onChange={e => setConfig({ ...config, top_p: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Rate Limit (RPM)</Label>
              <Input type="number" value={config.rate_limits.rpm} onChange={e => setConfig({ ...config, rate_limits: { ...config.rate_limits, rpm: Number(e.target.value) } })} />
            </div>
            <div>
              <Label>Concurrency</Label>
              <Input type="number" min="1" max="10" value={config.concurrency} onChange={e => setConfig({ ...config, concurrency: Number(e.target.value) })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onComplete}>
          Continue to Parts Review
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

// ============================================================================
// PART REVIEW PAGE (§3, §0A)
// ============================================================================

const PartReviewPage: React.FC<{ onStartGrading: () => void; exemplars: Exemplar[]; setExemplars: (e: Exemplar[]) => void }> = ({ onStartGrading, exemplars, setExemplars }) => {
  const [selectedPart, setSelectedPart] = useState<string>("P1A");
  const [showExemplarPanel, setShowExemplarPanel] = useState(false);

  const globalExemplars = exemplars.filter(e => e.scope === "global");
  const partExemplars = exemplars.filter(e => e.scope === "part" && e.part_id === selectedPart);

  const handleUploadExemplar = async (partId: string) => {
    const ex = await mockApi.createExemplar({
      title: `Exemplar for ${partId}`,
      scope: "part",
      part_id: partId,
      files: [{ kind: "pdf", uri: `exemplars/part_scoped/${partId}_example.pdf` }],
      is_gold: false,
      notes: "Uploaded during part review",
      created_by: "ta@university.edu"
    });
    setExemplars([...exemplars, ex as Exemplar]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Part & Subpart Review</h2>
        <p className="text-gray-600 mt-2">Review assignment structure and manage exemplars before grading</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Assignment Parts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {SAMPLE_PARTS.map(part => (
                <button
                  key={part.part_id}
                  onClick={() => setSelectedPart(part.part_id)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    selectedPart === part.part_id ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-semibold">{part.part_id}</div>
                  <div className="text-sm text-gray-600">{part.title}</div>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      Global: {globalExemplars.length}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      This part: {exemplars.filter(e => e.part_id === part.part_id).length}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Exemplar Panel</CardTitle>
            <CardDescription>Part {selectedPart}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm mb-2">Global Exemplars ({globalExemplars.length})</h4>
              {globalExemplars.map(ex => (
                <div key={ex.id} className="flex items-center justify-between p-2 bg-gray-50 rounded mb-2">
                  <div className="flex items-center gap-2">
                    {ex.is_gold && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                    <span className="text-sm">{ex.title}</span>
                  </div>
                  <Button size="sm" variant="ghost"><Eye className="w-3 h-3" /></Button>
                </div>
              ))}
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">Part-Scoped ({partExemplars.length})</h4>
              {partExemplars.map(ex => (
                <div key={ex.id} className="flex items-center justify-between p-2 bg-blue-50 rounded mb-2">
                  <div className="flex items-center gap-2">
                    {ex.is_gold && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                    <span className="text-sm">{ex.title}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost"><Eye className="w-3 h-3" /></Button>
                    <Button size="sm" variant="ghost"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                </div>
              ))}
              {partExemplars.length === 0 && (
                <p className="text-sm text-gray-500 italic">No part-scoped exemplar; will use global exemplars</p>
              )}
            </div>
            <div className="space-y-2">
              <Button size="sm" className="w-full" onClick={() => handleUploadExemplar(selectedPart)}>
                <Plus className="w-4 h-4 mr-2" />
                Upload for This Part
              </Button>
              <Button size="sm" variant="outline" className="w-full">
                <Link2 className="w-4 h-4 mr-2" />
                Link from Library
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Precedence:</strong> Per-part exemplars → Global exemplars → Knowledge Pack patterns
        </AlertDescription>
      </Alert>

      <div className="flex justify-end">
        <Button onClick={onStartGrading} size="lg">
          <Play className="w-4 h-4 mr-2" />
          Start Grading (Gate: 3 students)
        </Button>
      </div>
    </div>
  );
};

// ============================================================================
// REVIEW PAGE (§4, §5, §8)
// ============================================================================

const ReviewPage: React.FC<{ student: StudentSubmission; result: AutogradeResult; partIdx: number; onNext: () => void }> = ({ student, result, partIdx, onNext }) => {
  const [critique, setCritique] = useState<AICritique>(result.parts[partIdx]);
  const [edited, setEdited] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);

  const part = student.parts[partIdx];

  const handleEditFinding = (idx: number, updates: Partial<Finding>) => {
    const newFindings = [...critique.findings];
    newFindings[idx] = { ...newFindings[idx], ...updates };
    setCritique({ ...critique, findings: newFindings });
    setEdited(true);
  };

  const handleSavePrompt = async () => {
    await mockApi.savePrompt("Updated prompt content", "v2");
    setEdited(false);
    setShowPromptModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{student.name} • {part.part_id}</h2>
          <p className="text-gray-600">AI Critique ↔ Human Edit</p>
        </div>
        <div className="flex gap-2">
          {edited && <Badge variant="outline" className="bg-yellow-50">Edited</Badge>}
          <Button size="sm" variant="outline" onClick={() => setShowPromptModal(true)}>
            <Save className="w-4 h-4 mr-2" />
            Save as Prompt v2
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: AI Critique */}
        <Card>
          <CardHeader>
            <CardTitle>AI Analysis</CardTitle>
            <CardDescription>Provisional scores and findings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(critique.buckets).map(([key, val]) => (
                <div key={key} className="text-center p-2 bg-gray-50 rounded">
                  <div className="text-2xl font-bold">{val}</div>
                  <div className="text-xs text-gray-600 capitalize">{key}</div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {critique.findings.map((finding, idx) => (
                <div key={idx} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <HeuristicPill id={finding.heuristic_id} />
                    <ConfidenceBadge confidence={finding.confidence} />
                  </div>
                  <h4 className="font-semibold text-sm">{finding.title}</h4>
                  <p className="text-sm text-gray-600">{finding.reason}</p>
                  <SeverityStars severity={finding.severity_model} onChange={s => handleEditFinding(idx, { severity_model: s })} />
                  <div className="bg-blue-50 p-2 rounded text-sm">
                    <strong>Fix:</strong> {finding.actionable_fix}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-2">Feedback ({critique.feedback_text.split(' ').length} words)</h4>
              <Textarea value={critique.feedback_text} onChange={e => { setCritique({ ...critique, feedback_text: e.target.value }); setEdited(true); }} rows={6} className="text-sm" />
            </div>

            <div className="text-xs text-gray-500">
              Exemplars used: {critique.exemplars_used.join(', ')}
            </div>
          </CardContent>
        </Card>

        {/* Right: Human Tools */}
        <Card>
          <CardHeader>
            <CardTitle>Edit Tools</CardTitle>
            <CardDescription>Quick actions and adjustments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="bg-green-50">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Accept All (A)
              </Button>
              <Button size="sm" variant="outline">
                <Edit3 className="w-4 h-4 mr-1" />
                Minor Edit (E)
              </Button>
              <Button size="sm" variant="outline" className="bg-red-50">
                <X className="w-4 h-4 mr-1" />
                Reject & Reason
              </Button>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-2">Comment Snippets</h4>
              <div className="space-y-2">
                <Button size="sm" variant="ghost" className="w-full justify-start text-xs">
                  + "Add mobile viewport evidence"
                </Button>
                <Button size="sm" variant="ghost" className="w-full justify-start text-xs">
                  + "Quantify threshold (e.g., >200ms)"
                </Button>
                <Button size="sm" variant="ghost" className="w-full justify-start text-xs">
                  + "Include ARIA considerations"
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-2">Keyboard Shortcuts</h4>
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Accept</span>
                  <kbd className="px-2 py-1 bg-gray-100 rounded">A</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Edit</span>
                  <kbd className="px-2 py-1 bg-gray-100 rounded">E</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Next</span>
                  <kbd className="px-2 py-1 bg-gray-100 rounded">N</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Reassign</span>
                  <kbd className="px-2 py-1 bg-gray-100 rounded">R</kbd>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-2">Student Submission</h4>
              <p className="text-sm text-gray-700 mb-2">{part.raw_text}</p>
              {part.images.length > 0 && (
                <div className="flex gap-2">
                  {part.images.map((img, i) => (
                    <div key={i} className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500">
                      Screenshot {i + 1}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between">
        <Button variant="outline">
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        <Button onClick={onNext}>
          Next Part / Student
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      {/* Prompt Version Modal */}
      <Dialog open={showPromptModal} onOpenChange={setShowPromptModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Prompt v2</DialogTitle>
            <DialogDescription>Edits will be summarized and saved as a new prompt version</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Changes detected: severity adjustments, feedback tone refinements, mobile-first emphasis
              </AlertDescription>
            </Alert>
            <div>
              <Label>Version Notes</Label>
              <Textarea placeholder="Describe what changed in this version..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPromptModal(false)}>Cancel</Button>
            <Button onClick={handleSavePrompt}>Save Prompt v2</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============================================================================
// SUMMARY PAGE (§7, §9)
// ============================================================================

const SummaryPage: React.FC<{ results: AutogradeResult[] }> = ({ results }) => {
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);

  const totalViolations = results.reduce((sum, r) => sum + r.flags.violations_count, 0);
  const avgScore = results.reduce((sum, r) => sum + r.score_total, 0) / results.length;

  const allHeuristicsCovered = results.every(r => r.flags.heuristics_covered === 10);
  const allMeetMinViolations = results.every(r => r.flags.violations_count >= 12);

  const handleBatchGrade = async () => {
    setShowBatchModal(true);
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(r => setTimeout(r, 300));
      setBatchProgress(i);
    }
    setShowBatchModal(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Summary & Validation</h2>
        <p className="text-gray-600 mt-2">Review compliance and prepare for batch grading or export</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{avgScore.toFixed(1)}</div>
            <div className="text-sm text-gray-600">Average Score</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{totalViolations}</div>
            <div className="text-sm text-gray-600">Total Violations</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{allHeuristicsCovered ? '10/10' : 'Partial'}</div>
            <div className="text-sm text-gray-600">Heuristics Covered</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compliance Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ChecklistItem checked={allMeetMinViolations} label="All students have ≥12 violations identified" />
          <ChecklistItem checked={allHeuristicsCovered} label="All 10 heuristics represented in findings" />
          <ChecklistItem checked={true} label="All violations have severity ratings (1-4)" />
          <ChecklistItem checked={results.every(r => r.flags.mobile_first_respected)} label="Mobile-first evidence provided where required" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Severity Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(sev => {
              const count = results.reduce((sum, r) => sum + (r.flags.severity_distribution[sev.toString()] || 0), 0);
              return (
                <div key={sev} className="text-center p-4 bg-gray-50 rounded">
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs text-gray-600">Severity {sev}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {SAMPLE_RUBRIC.severity_labels[sev.toString() as keyof typeof SAMPLE_RUBRIC.severity_labels].split(':')[0]}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button onClick={handleBatchGrade} size="lg">
          <Play className="w-4 h-4 mr-2" />
          Proceed to Batch Grade
        </Button>
        <Button variant="outline" size="lg">
          <RefreshCw className="w-4 h-4 mr-2" />
          Re-grade with Prompt v2
        </Button>
        <Button variant="outline" size="lg">
          <Download className="w-4 h-4 mr-2" />
          Export Audit Bundle
        </Button>
      </div>

      {/* Batch Progress Modal */}
      <Dialog open={showBatchModal} onOpenChange={setShowBatchModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batch Grading in Progress</DialogTitle>
            <DialogDescription>Processing remaining students with Prompt v1</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Progress value={batchProgress} />
            <p className="text-sm text-center text-gray-600">{batchProgress}% complete</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ChecklistItem: React.FC<{ checked: boolean; label: string }> = ({ checked, label }) => (
  <div className="flex items-center gap-3">
    {checked ? (
      <CheckCircle2 className="w-5 h-5 text-green-600" />
    ) : (
      <AlertCircle className="w-5 h-5 text-amber-600" />
    )}
    <span className={checked ? 'text-gray-900' : 'text-amber-800'}>{label}</span>
  </div>
);

// ============================================================================
// REPORTS PAGE (§9)
// ============================================================================

const ReportsPage: React.FC<{ results: AutogradeResult[] }> = ({ results }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Export & Reports</h2>
        <p className="text-gray-600 mt-2">Download grades, feedback, and adjudication logs</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Grade Exports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start">
              <Download className="w-4 h-4 mr-2" />
              Grades CSV (student_id, scores, totals)
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <FileText className="w-4 h-4 mr-2" />
              Individual Feedback PDFs (per student)
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <FileText className="w-4 h-4 mr-2" />
              Feedback HTML Bundle
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit & Analytics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start">
              <Download className="w-4 h-4 mr-2" />
              Adjudication Log (all edits + timestamps)
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <BarChart3 className="w-4 h-4 mr-2" />
              Summary Dashboard (histograms, distributions)
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Download className="w-4 h-4 mr-2" />
              Quick Audit Bundle (ZIP)
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Export Preview</CardTitle>
          <CardDescription>Sample of exported feedback</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Alex Johnson (u001)</h3>
              <Badge>Score: 84/100</Badge>
            </div>
            <div className="text-sm space-y-2">
              <div>
                <strong>Part 1A:</strong> Your analysis demonstrates a solid grasp of visibility principles, particularly in identifying the absence of loading states...
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3">
                <div className="text-center p-2 bg-white rounded border">
                  <div className="font-bold">8</div>
                  <div className="text-xs text-gray-600">Content</div>
                </div>
                <div className="text-center p-2 bg-white rounded border">
                  <div className="font-bold">7</div>
                  <div className="text-xs text-gray-600">Evidence</div>
                </div>
                <div className="text-center p-2 bg-white rounded border">
                  <div className="font-bold">9</div>
                  <div className="text-xs text-gray-600">Presentation</div>
                </div>
                <div className="text-center p-2 bg-white rounded border">
                  <div className="font-bold">8</div>
                  <div className="text-xs text-gray-600">Collaboration</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          All exports include prompt version metadata and exemplar IDs used for each critique.
        </AlertDescription>
      </Alert>
    </div>
  );
};
            <div className="text-3xl font-bold">{results.length}</div>
            <div className="text-sm text-gray-600">Students Graded</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            