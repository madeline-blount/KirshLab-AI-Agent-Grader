import React, { useState, useEffect, useCallback } from 'react';
import { Upload, FileText, Check, X, AlertCircle, Eye, Edit, Save, Download, RefreshCw, Settings, BookOpen, Cpu, ChevronRight, ChevronLeft, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

// ============================================================================
// DATA CONTRACTS (§6)
// ============================================================================

interface ViolationClaim {
  heuristic_id: string;
  description: string;
  severity_student: 1 | 2 | 3 | 4;
  evidence: {
    page_url?: string;
    selector?: string;
    screenshot?: string;
  };
}

interface SubmissionPart {
  part_id: string;
  raw_text: string;
  images: string[];
  claims: ViolationClaim[];
}

interface StudentSubmission {
  student_id: string;
  name: string;
  team_id?: string;
  parts: SubmissionPart[];
  ai_use_statement?: string;
}

interface Finding {
  heuristic_id: string;
  title: string;
  reason: string;
  severity_model: 1 | 2 | 3 | 4;
  confidence: number;
  actionable_fix: string;
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

interface AutogradeResult {
  student_id: string;
  parts: AICritique[];
  score_total: number;
  flags: {
    heuristics_covered: number;
    violations_count: number;
    severity_distribution: Record<string, number>;
    mobile_first_respected: boolean;
  };
  prompt_version: string;
}

interface Exemplar {
  id: string;
  title: string;
  scope: 'global' | 'part';
  part_id?: string;
  files: { kind: string; uri: string }[];
  is_gold: boolean;
  notes?: string;
  created_by: string;
  created_at: string;
}

// ============================================================================
// MOCK DATA (§14)
// ============================================================================

const HEURISTICS = [
  { id: 'H1', name: 'Visibility of System Status', color: 'bg-blue-100 text-blue-800' },
  { id: 'H2', name: 'Match Between System and Real World', color: 'bg-green-100 text-green-800' },
  { id: 'H3', name: 'User Control and Freedom', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'H4', name: 'Consistency and Standards', color: 'bg-purple-100 text-purple-800' },
  { id: 'H5', name: 'Error Prevention', color: 'bg-red-100 text-red-800' },
  { id: 'H6', name: 'Recognition Rather Than Recall', color: 'bg-indigo-100 text-indigo-800' },
  { id: 'H7', name: 'Flexibility and Efficiency of Use', color: 'bg-pink-100 text-pink-800' },
  { id: 'H8', name: 'Aesthetic and Minimalist Design', color: 'bg-orange-100 text-orange-800' },
  { id: 'H9', name: 'Help Users Recognize, Diagnose, and Recover from Errors', color: 'bg-teal-100 text-teal-800' },
  { id: 'H10', name: 'Help and Documentation', color: 'bg-cyan-100 text-cyan-800' },
];

const SEVERITY_LABELS = {
  1: 'Cosmetic',
  2: 'Minor',
  3: 'Major',
  4: 'Critical'
};

const MOCK_STUDENTS: StudentSubmission[] = [
  {
    student_id: 'u123',
    name: 'Casey Lee',
    team_id: 't-02',
    ai_use_statement: 'Used GPT-4 for grammar checking in feedback section.',
    parts: [
      {
        part_id: 'P1A',
        raw_text: 'Modal dialog lacks ESC key handler and visible cancel button. Users must click outside modal to close.',
        images: ['submissions/u123/P1A_1.png'],
        claims: [
          {
            heuristic_id: 'H3',
            description: 'Modal lacks ESC/Cancel during cart edit',
            severity_student: 3,
            evidence: {
              page_url: 'https://example.com/cart',
              selector: 'div.modal',
              screenshot: 'submissions/u123/P1A_1.png'
            }
          }
        ]
      },
      {
        part_id: 'P1B',
        raw_text: 'Form validation shows errors only after submission. No inline feedback during typing.',
        images: ['submissions/u123/P1B_1.png'],
        claims: [
          {
            heuristic_id: 'H5',
            description: 'No inline validation prevents errors',
            severity_student: 2,
            evidence: {
              page_url: 'https://example.com/checkout',
              selector: 'form#checkout',
              screenshot: 'submissions/u123/P1B_1.png'
            }
          }
        ]
      }
    ]
  },
  {
    student_id: 'u124',
    name: 'Jordan Smith',
    team_id: 't-02',
    ai_use_statement: 'No AI tools used.',
    parts: [
      {
        part_id: 'P1A',
        raw_text: 'Search results page shows "No items found" with no suggestions or alternatives.',
        images: ['submissions/u124/P1A_1.png'],
        claims: [
          {
            heuristic_id: 'H9',
            description: 'Error message lacks recovery suggestions',
            severity_student: 3,
            evidence: {
              page_url: 'https://example.com/search?q=xyz',
              selector: 'div.no-results',
              screenshot: 'submissions/u124/P1A_1.png'
            }
          }
        ]
      }
    ]
  }
];

const MOCK_EXEMPLARS: Exemplar[] = [
  {
    id: 'ex_019',
    title: 'A-level Global Exemplar',
    scope: 'global',
    files: [{ kind: 'md', uri: 'exemplars/global_exemplar.md' }],
    is_gold: true,
    notes: 'Covers all 10 heuristics with strong evidence',
    created_by: 'instructor@university.edu',
    created_at: '2025-11-02T19:04:00Z'
  },
  {
    id: 'ex_007',
    title: 'Part 3B Exemplar',
    scope: 'part',
    part_id: 'P3B',
    files: [{ kind: 'pdf', uri: 'exemplars/P3B_exemplar.pdf' }],
    is_gold: false,
    notes: 'Strong mobile-first analysis',
    created_by: 'ta@university.edu',
    created_at: '2025-11-01T14:20:00Z'
  }
];

// ============================================================================
// MOCK API (§13)
// ============================================================================

const mockApi = {
  ingest: async (files: any) => {
    await new Promise(resolve => setTimeout(resolve, 800));
    return {
      parts: ['P1A', 'P1B', 'P2A', 'P2B', 'P3A', 'P3B'],
      rubric_summary: { buckets: 4, penalties: 2, bonuses: 1 }
    };
  },
  
  grade: async (studentId: string, gateK: number) => {
    await new Promise(resolve => setTimeout(resolve, 1200));
    const critique: AICritique = {
      part_id: 'P1A',
      buckets: { content: 8, evidence: 7, presentation: 4, collaboration: 2 },
      findings: [
        {
          heuristic_id: 'H3',
          title: 'Modal lacks keyboard escape',
          reason: 'No Esc handler; focus trap prevents exit; no Cancel button visible.',
          severity_model: 3,
          confidence: 0.84,
          actionable_fix: 'Bind Esc key; add visible Cancel button; restore focus on close.'
        },
        {
          heuristic_id: 'H1',
          title: 'Loading state not indicated',
          reason: 'Cart update happens silently without spinner or status message.',
          severity_model: 2,
          confidence: 0.91,
          actionable_fix: 'Show loading spinner during async operations; confirm completion with brief toast.'
        }
      ],
      feedback_text: 'Your modal analysis identifies a significant user control issue. The lack of ESC key support and visible cancel option creates a frustrating experience, particularly for keyboard users. The evidence is well-documented with clear selectors. Consider expanding your analysis to include loading states – the cart update lacks visual feedback. Your severity ratings align well with the rubric definitions. Strong work on mobile considerations.',
      exemplars_used: ['ex_019']
    };
    return [critique];
  },

  savePrompt: async (delta: string, version: string) => {
    await new Promise(resolve => setTimeout(resolve, 400));
    return { version: `v${parseInt(version.slice(1)) + 1}`, diff_summary: '3 additions, 1 removal' };
  },

  getExemplars: async (scope?: string, partId?: string) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return MOCK_EXEMPLARS.filter(e => 
      (!scope || e.scope === scope) && 
      (!partId || e.part_id === partId)
    );
  },

  uploadExemplar: async (file: any, scope: string, partId?: string) => {
    await new Promise(resolve => setTimeout(resolve, 600));
    const newEx: Exemplar = {
      id: `ex_${Date.now()}`,
      title: file.name,
      scope: scope as 'global' | 'part',
      part_id: partId,
      files: [{ kind: 'pdf', uri: `exemplars/${file.name}` }],
      is_gold: false,
      notes: '',
      created_by: 'ta@university.edu',
      created_at: new Date().toISOString()
    };
    return newEx;
  },

  exportAuditBundle: async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { url: '/downloads/audit_bundle.zip', size: '2.4 MB' };
  }
};

// ============================================================================
// REUSABLE COMPONENTS (§12)
// ============================================================================

const HeuristicPill: React.FC<{ heuristicId: string; size?: 'sm' | 'md' }> = ({ heuristicId, size = 'md' }) => {
  const h = HEURISTICS.find(x => x.id === heuristicId);
  if (!h) return <Badge variant="outline">{heuristicId}</Badge>;
  return (
    <Badge className={`${h.color} ${size === 'sm' ? 'text-xs px-1.5 py-0.5' : ''}`}>
      {h.id}
    </Badge>
  );
};

const SeverityStars: React.FC<{ severity: 1 | 2 | 3 | 4; editable?: boolean; onChange?: (s: 1 | 2 | 3 | 4) => void }> = 
  ({ severity, editable = false, onChange }) => {
  const label = SEVERITY_LABELS[severity];
  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        {[1, 2, 3, 4].map(n => (
          <button
            key={n}
            disabled={!editable}
            onClick={() => editable && onChange && onChange(n as 1 | 2 | 3 | 4)}
            className={`w-5 h-5 ${n <= severity ? 'text-yellow-500' : 'text-gray-300'} ${editable ? 'cursor-pointer hover:scale-110' : ''}`}
          >
            ★
          </button>
        ))}
      </div>
      <span className="text-sm text-gray-600">{label}</span>
    </div>
  );
};

const ConfidenceBadge: React.FC<{ confidence: number }> = ({ confidence }) => {
  const color = confidence >= 0.8 ? 'bg-green-100 text-green-800' : 
                confidence >= 0.6 ? 'bg-yellow-100 text-yellow-800' : 
                'bg-red-100 text-red-800';
  return (
    <Badge className={color}>
      {Math.round(confidence * 100)}% confident
    </Badge>
  );
};

// ============================================================================
// MAIN APP & WIZARD PAGES
// ============================================================================

export default function UsabilityAutograderWizard() {
  const [currentPage, setCurrentPage] = useState<'setup' | 'knowledge' | 'providers' | 'part' | 'review' | 'summary'>('setup');
  const [setupData, setSetupData] = useState<any>({
    roster: null,
    assignment: null,
    rubric: null,
    prompt: null,
    gateK: 3,
    mobileFirst: false,
    preferredMean: null
  });
  const [parts, setParts] = useState<string[]>([]);
  const [currentPartIdx, setCurrentPartIdx] = useState(0);
  const [currentStudentIdx, setCurrentStudentIdx] = useState(0);
  const [students] = useState(MOCK_STUDENTS);
  const [critiques, setCritiques] = useState<Record<string, AICritique>>({});
  const [exemplars, setExemplars] = useState<Exemplar[]>(MOCK_EXEMPLARS);
  const [promptVersion, setPromptVersion] = useState('v1');
  const [results, setResults] = useState<AutogradeResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Keyboard shortcuts (§8)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (currentPage === 'review') {
        if (e.key === 'a' || e.key === 'A') {
          handleApprove();
        } else if (e.key === 'n' || e.key === 'N') {
          handleNext();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentPage, currentPartIdx, currentStudentIdx]);

  const handleSetupUpload = async (fileType: string, file: File) => {
    setSetupData((prev: any) => ({ ...prev, [fileType]: file.name }));
    if (fileType === 'assignment') {
      const result = await mockApi.ingest({ assignment: file });
      setParts(result.parts);
    }
  };

  const startGrading = async () => {
    setLoading(true);
    try {
      const critiquesData = await mockApi.grade(students[0].student_id, setupData.gateK);
      const critiqueMap: Record<string, AICritique> = {};
      critiquesData.forEach((c: AICritique) => {
        critiqueMap[`${students[0].student_id}-${c.part_id}`] = c;
      });
      setCritiques(critiqueMap);
      setCurrentPage('part');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = () => {
    // Save current critique as approved
    handleNext();
  };

  const handleNext = () => {
    if (currentPartIdx < parts.length - 1) {
      setCurrentPartIdx(currentPartIdx + 1);
      setCurrentPage('part');
    } else if (currentStudentIdx < Math.min(setupData.gateK, students.length) - 1) {
      setCurrentStudentIdx(currentStudentIdx + 1);
      setCurrentPartIdx(0);
      setCurrentPage('part');
    } else {
      // Gate complete, move to summary
      setCurrentPage('summary');
    }
  };

  const proceedToReview = () => {
    setCurrentPage('review');
  };

  // ============================================================================
  // PAGE: SETUP (P1)
  // ============================================================================
  
  const SetupPage = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Upload className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">Setup & Ingestion</h1>
          <p className="text-gray-600">Upload assignment materials and configure grading options</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Required Uploads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {['roster', 'assignment', 'rubric', 'prompt'].map(fileType => (
            <div key={fileType} className="flex items-center justify-between p-3 border rounded">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="font-medium capitalize">{fileType}</div>
                  <div className="text-sm text-gray-500">
                    {fileType === 'roster' && 'CSV with student_id, name, email'}
                    {fileType === 'assignment' && 'PDF/HTML with parts/subparts'}
                    {fileType === 'rubric' && 'YAML/JSON with buckets & weights'}
                    {fileType === 'prompt' && 'Markdown/TXT - Prompt v1'}
                  </div>
                </div>
              </div>
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => e.target.files && handleSetupUpload(fileType, e.target.files[0])}
                />
                <Button variant="outline" size="sm" asChild>
                  <span>
                    {setupData[fileType] ? (
                      <><Check className="w-4 h-4 mr-2" /> {setupData[fileType]}</>
                    ) : (
                      <><Upload className="w-4 h-4 mr-2" /> Upload</>
                    )}
                  </span>
                </Button>
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Global Exemplars (0-2)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {exemplars.filter(e => e.scope === 'global').map(ex => (
              <div key={ex.id} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center gap-3">
                  {ex.is_gold && <Badge className="bg-yellow-100 text-yellow-800">Gold</Badge>}
                  <div>
                    <div className="font-medium">{ex.title}</div>
                    <div className="text-sm text-gray-500">{ex.notes}</div>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  <Eye className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <label className="cursor-pointer">
              <input type="file" className="hidden" onChange={(e) => {
                if (e.target.files) {
                  mockApi.uploadExemplar(e.target.files[0], 'global').then(newEx => {
                    setExemplars([...exemplars, newEx]);
                  });
                }
              }} />
              <Button variant="outline" className="w-full">
                <Upload className="w-4 h-4 mr-2" /> Upload Global Exemplar
              </Button>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Grading Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Gate (stop after first K students)</label>
            <input
              type="number"
              value={setupData.gateK}
              onChange={(e) => setSetupData({...setupData, gateK: parseInt(e.target.value)})}
              className="w-24 px-3 py-2 border rounded"
              min="1"
              max="10"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="mobile-first"
              checked={setupData.mobileFirst}
              onChange={(e) => setSetupData({...setupData, mobileFirst: e.target.checked})}
              className="w-4 h-4"
            />
            <label htmlFor="mobile-first" className="text-sm font-medium">
              Mobile-first emphasis (flag missing mobile evidence)
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Preferred mean (optional, rank-preserving)</label>
            <input
              type="number"
              value={setupData.preferredMean || ''}
              onChange={(e) => setSetupData({...setupData, preferredMean: e.target.value ? parseFloat(e.target.value) : null})}
              className="w-24 px-3 py-2 border rounded"
              placeholder="85"
              step="0.1"
            />
          </div>
        </CardContent>
      </Card>

      {parts.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Parsed {parts.length} parts: {parts.join(', ')}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button onClick={() => setCurrentPage('knowledge')} variant="outline">
          <ChevronRight className="w-4 h-4 mr-2" /> Continue to Knowledge Pack
        </Button>
        <Button onClick={startGrading} disabled={!setupData.roster || !setupData.assignment || loading}>
          {loading ? 'Starting...' : 'Skip to Grading'}
        </Button>
      </div>
    </div>
  );

  // ============================================================================
  // PAGE: KNOWLEDGE PACK (P1B)
  // ============================================================================
  
  const KnowledgePage = () => {
    const [knowledgeCards, setKnowledgeCards] = useState<any[]>([]);
    
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold">Domain Knowledge Pack</h1>
            <p className="text-gray-600">Upload lecture decks for pattern library and few-shot examples</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload PPTX/PDF</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="cursor-pointer">
              <input type="file" accept=".pptx,.pdf" multiple className="hidden" onChange={(e) => {
                if (e.target.files) {
                  const cards = Array.from(e.target.files).map((f, i) => ({
                    id: `card_${i}`,
                    file: f.name,
                    slide: i + 1,
                    text: `Sample text from slide ${i + 1}`,
                    heuristic_id: null,
                    pattern_label: '',
                    is_violation_example: false
                  }));
                  setKnowledgeCards(cards);
                }
              }} />
              <Button variant="outline" className="w-full">
                <Upload className="w-4 h-4 mr-2" /> Upload Lecture Materials
              </Button>
            </label>
          </CardContent>
        </Card>

        {knowledgeCards.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Tag Extracted Cards ({knowledgeCards.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-96 overflow-y-auto">
              {knowledgeCards.slice(0, 3).map(card => (
                <div key={card.id} className="p-4 border rounded space-y-3">
                  <div className="text-sm text-gray-600">Slide {card.slide}: {card.text}</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-medium">Heuristic</label>
                      <select className="w-full px-2 py-1 border rounded text-sm">
                        <option value="">Select...</option>
                        {HEURISTICS.map(h => (
                          <option key={h.id} value={h.id}>{h.id} - {h.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium">Pattern Label</label>
                      <input type="text" placeholder="e.g., Modal trap" className="w-full px-2 py-1 border rounded text-sm" />
                    </div>
                    <div className="flex items-end gap-2">
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" className="w-3 h-3" />
                        Violation Example
                      </label>
                    </div>
                  </div>
                </div>
              ))}
              {knowledgeCards.length > 3 && (
                <div className="text-sm text-gray-500 text-center">+ {knowledgeCards.length - 3} more cards</div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button onClick={() => setCurrentPage('setup')} variant="outline">
            <ChevronLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button onClick={() => setCurrentPage('providers')} variant="outline">
            <ChevronRight className="w-4 h-4 mr-2" /> Continue to AI Config
          </Button>
        </div>
      </div>
    );
  };

  // ============================================================================
  // PAGE: AI PROVIDER CONFIG (P1C)
  // ============================================================================
  
  const ProvidersPage = () => {
    const [provider, setProvider] = useState('openai');
    
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Cpu className="w-8 h-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold">AI Provider & Model Configuration</h1>
            <p className="text-gray-600">Configure grading engine and model parameters</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Provider Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Provider</label>
              <select 
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="custom">Custom HTTP</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Model Name</label>
              <input 
                type="text" 
                defaultValue="gpt-4-turbo" 
                className="w-full px-3 py-2 border rounded"
                placeholder="e.g., gpt-4-turbo, claude-3-opus"
              />
            </div>

            {provider === 'custom' && (
              <div>
                <label className="block text-sm font-medium mb-2">Endpoint URL</label>
                <input 
                  type="text" 
                  placeholder="https://api.example.com/v1/chat/completions"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">API Key (session-scoped)</label>
              <input 
                type="password" 
                placeholder="sk-..." 
                className="w-full px-3 py-2 border rounded"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Temperature</label>
                <input type="number" defaultValue="0.3" step="0.1" min="0" max="2" className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Top P</label>
                <input type="number" defaultValue="0.95" step="0.05" min="0" max="1" className="w-full px-3 py-2 border rounded" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Rate Limit (RPM)</label>
                <input type="number" defaultValue="60" className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Concurrency</label>
                <input type="number" defaultValue="3" min="1" max="10" className="w-full px-3 py-2 border rounded" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="streaming" className="w-4 h-4" />
              <label htmlFor="streaming" className="text-sm font-medium">Enable streaming</label>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={() => setCurrentPage('knowledge')} variant="outline">
            <ChevronLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button onClick={startGrading} disabled={loading}>
            {loading ? 'Starting...' : 'Start Grading'}
          </Button>
        </div>
      </div>
    );
  };

  // ============================================================================
  // PAGE: PART/SUBPART REVIEW (P2)
  // ============================================================================
  
  const PartPage = () => {
    const currentPart = parts[currentPartIdx];
    const student = students[currentStudentIdx];
    const partData = student.parts.find(p => p.part_id === currentPart);
    const partExemplars = exemplars.filter(e => e.scope === 'part' && e.part_id === currentPart);
    const globalExemplars = exemplars.filter(e => e.scope === 'global');

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Part {currentPart}: Spec ↔ Submission</h1>
            <p className="text-gray-600">Student: {student.name} ({student.student_id})</p>
          </div>
          <Badge variant="outline">Part {currentPartIdx + 1} of {parts.length}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Assignment Statement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-2">
                <p className="font-medium">{currentPart}: Identify usability violations</p>
                <p className="text-gray-600">
                  Find and document usability issues using Nielsen's 10 heuristics. 
                  Provide evidence with screenshots, URLs, and selectors.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Student Submission</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm">{partData?.raw_text}</p>
                {partData?.images.map((img, i) => (
                  <div key={i} className="text-xs text-gray-500 flex items-center gap-2">
                    <Eye className="w-3 h-3" />
                    {img}
                  </div>
                ))}
                <div className="pt-3 border-t">
                  <div className="text-xs font-medium mb-2">Student Claims:</div>
                  {partData?.claims.map((claim, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm mb-2">
                      <HeuristicPill heuristicId={claim.heuristic_id} size="sm" />
                      <div className="flex-1">
                        <div>{claim.description}</div>
                        <SeverityStars severity={claim.severity_student} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Exemplar Panel</span>
              <div className="text-sm font-normal text-gray-600">
                Global: {globalExemplars.length} / This part: {partExemplars.length}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {partExemplars.map(ex => (
              <div key={ex.id} className="flex items-center justify-between p-3 border rounded bg-blue-50">
                <div className="flex items-center gap-3">
                  {ex.is_gold && <Badge className="bg-yellow-100 text-yellow-800">Gold</Badge>}
                  <Badge>Part-scoped</Badge>
                  <div className="font-medium">{ex.title}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm"><X className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
            {partExemplars.length === 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No part-scoped exemplar; using global exemplar(s) if available.
                </AlertDescription>
              </Alert>
            )}
            <label className="cursor-pointer">
              <input type="file" className="hidden" onChange={(e) => {
                if (e.target.files) {
                  mockApi.uploadExemplar(e.target.files[0], 'part', currentPart).then(newEx => {
                    setExemplars([...exemplars, newEx]);
                  });
                }
              }} />
              <Button variant="outline" size="sm" className="w-full">
                <Upload className="w-4 h-4 mr-2" /> Upload Part Exemplar
              </Button>
            </label>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={() => setCurrentPage('setup')} variant="outline">
            <ChevronLeft className="w-4 h-4 mr-2" /> Back to Setup
          </Button>
          <Button onClick={proceedToReview}>
            Proceed to AI Critique <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  };

  // ============================================================================
  // PAGE: AI CRITIQUE ↔ HUMAN EDIT (P3)
  // ============================================================================
  
  const ReviewPage = () => {
    const currentPart = parts[currentPartIdx];
    const student = students[currentStudentIdx];
    const critiqueKey = `${student.student_id}-${currentPart}`;
    const critique = critiques[critiqueKey];
    const [editMode, setEditMode] = useState(false);
    const [editedFeedback, setEditedFeedback] = useState(critique?.feedback_text || '');
    const wordCount = editedFeedback.split(/\s+/).filter(w => w.length > 0).length;

    if (!critique) {
      return <div>Loading critique...</div>;
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">AI Critique ↔ Human Review</h1>
            <p className="text-gray-600">
              {student.name} - Part {currentPart} 
              <Badge className="ml-2" variant="outline">Prompt {promptVersion}</Badge>
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" title="Approve (A)">
              <Check className="w-4 h-4 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="outline" title="Next (N)" onClick={handleNext}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI Findings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {critique.findings.map((finding, i) => (
                  <div key={i} className="p-4 border rounded space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <HeuristicPill heuristicId={finding.heuristic_id} />
                        <ConfidenceBadge confidence={finding.confidence} />
                      </div>
                      <Button variant="ghost" size="sm" title="Reassign heuristic">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="font-medium">{finding.title}</div>
                    <div className="text-sm text-gray-600">{finding.reason}</div>
                    <SeverityStars severity={finding.severity_model} editable onChange={(s) => {
                      const updated = {...critique};
                      updated.findings[i].severity_model = s;
                      setCritiques({...critiques, [critiqueKey]: updated});
                    }} />
                    <div className="text-sm bg-blue-50 p-2 rounded">
                      <strong>Fix:</strong> {finding.actionable_fix}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rubric Scores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(critique.buckets).map(([bucket, score]) => (
                    <div key={bucket} className="flex justify-between items-center">
                      <span className="text-sm capitalize">{bucket}</span>
                      <div className="flex items-center gap-2">
                        <Progress value={score * 10} className="w-32" />
                        <span className="text-sm font-medium w-8">{score}/10</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Feedback Text</span>
                  <Button variant="ghost" size="sm" onClick={() => setEditMode(!editMode)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {editMode ? (
                  <div className="space-y-2">
                    <textarea
                      value={editedFeedback}
                      onChange={(e) => setEditedFeedback(e.target.value)}
                      className="w-full px-3 py-2 border rounded min-h-[200px] text-sm"
                    />
                    <div className="flex items-center justify-between text-sm">
                      <span className={wordCount < 120 || wordCount > 160 ? 'text-red-600' : 'text-green-600'}>
                        {wordCount} words {wordCount < 120 ? '(too short)' : wordCount > 160 ? '(too long)' : '(✓)'}
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                        <Button size="sm" onClick={() => {
                          const updated = {...critique, feedback_text: editedFeedback};
                          setCritiques({...critiques, [critiqueKey]: updated});
                          setEditMode(false);
                        }}>
                          <Save className="w-4 h-4 mr-1" /> Save
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm space-y-2">
                    <p>{critique.feedback_text}</p>
                    <div className="text-xs text-gray-500">
                      {wordCount} words | Exemplars used: {critique.exemplars_used.join(', ')}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Good as is
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Minor edit needed
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-red-600">
                  <X className="w-4 h-4 mr-2" /> Reject & provide reason
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Comment Snippets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                  + "Consider mobile viewport constraints"
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                  + "Evidence screenshot lacks context"
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                  + "Severity may be overstated"
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // PAGE: SUMMARY & EXPORT
  // ============================================================================
  
  const SummaryPage = () => {
    const totalViolations = 13;
    const heuristicsCovered = 10;
    const severityDist = { '1': 2, '2': 6, '3': 4, '4': 1 };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Summary & Export</h1>
          <p className="text-gray-600">Review grading results and export feedback</p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-blue-600">{students.length}</div>
              <div className="text-sm text-gray-600">Students Graded</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-green-600">{totalViolations}</div>
              <div className="text-sm text-gray-600">Total Violations</div>
              {totalViolations >= 12 && <Badge className="mt-2 bg-green-100 text-green-800">✓ Minimum met</Badge>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-purple-600">{heuristicsCovered}/10</div>
              <div className="text-sm text-gray-600">Heuristics Covered</div>
              {heuristicsCovered === 10 && <Badge className="mt-2 bg-green-100 text-green-800">✓ Complete</Badge>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-orange-600">{promptVersion}</div>
              <div className="text-sm text-gray-600">Prompt Version</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Compliance Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              <span>≥12 total violations identified</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              <span>All 10 heuristics covered</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              <span>Severity ratings (1-4) present</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-600" />
              <span>Evidence provided (URLs, selectors, screenshots)</span>
            </div>
            {setupData.mobileFirst && (
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                <span>Mobile-first emphasis respected</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Severity Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(severityDist).map(([sev, count]) => (
                <div key={sev} className="flex items-center gap-3">
                  <SeverityStars severity={parseInt(sev) as 1 | 2 | 3 | 4} />
                  <Progress value={(count / totalViolations) * 100} className="flex-1" />
                  <span className="text-sm w-8">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export & Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" /> Export Grades CSV
              </Button>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" /> Export Feedback PDFs
              </Button>
              <Button variant="outline">
                <FileText className="w-4 h-4 mr-2" /> Adjudication Log
              </Button>
              <Button variant="outline" onClick={async () => {
                const result = await mockApi.exportAuditBundle();
                alert(`Audit bundle ready: ${result.url} (${result.size})`);
              }}>
                <Download className="w-4 h-4 mr-2" /> Quick Audit Export
              </Button>
            </div>
            <div className="pt-3 border-t space-y-2">
              <Button className="w-full" onClick={async () => {
                setLoading(true);
                const result = await mockApi.savePrompt('Added mobile emphasis', promptVersion);
                setPromptVersion(result.version);
                setLoading(false);
                alert(`Saved as ${result.version}: ${result.diff_summary}`);
              }}>
                <Save className="w-4 h-4 mr-2" /> Save Prompt {promptVersion} → v{parseInt(promptVersion.slice(1)) + 1}
              </Button>
              <Button variant="outline" className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" /> Re-run with {promptVersion} (confirmation required)
              </Button>
            </div>
            {setupData.preferredMean && (
              <div className="pt-3 border-t">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Preferred mean adjustment: {setupData.preferredMean}
                    <Button size="sm" variant="outline" className="ml-3">
                      Apply (rank-preserving)
                    </Button>
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Batch Grading Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                Gate complete: {setupData.gateK} students reviewed. Ready to proceed to batch grading.
              </AlertDescription>
            </Alert>
            <Button className="w-full" disabled={loading}>
              {loading ? 'Processing...' : `Proceed to Batch Grade (${students.length - setupData.gateK} remaining)`}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1">
                Dry-run mode
              </Button>
              <Button variant="outline" size="sm" className="flex-1">
                Interruptible batch
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Graded Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {students.slice(0, setupData.gateK).map((student, i) => (
                <div key={student.student_id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">{student.name}</div>
                    <div className="text-sm text-gray-500">{student.student_id}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge>87/100</Badge>
                    <Badge className="bg-green-100 text-green-800">Final</Badge>
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={() => setCurrentPage('review')} variant="outline">
            <ChevronLeft className="w-4 h-4 mr-2" /> Back to Review
          </Button>
          <Button onClick={() => setCurrentPage('setup')} variant="outline">
            Start New Session
          </Button>
        </div>
      </div>
    );
  };

  // ============================================================================
  // NAVIGATION & MAIN RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Usability Autograder Wizard</h1>
          <p className="text-gray-600">Nielsen's 10 Heuristics Grading Tool with Human-in-the-Loop Calibration</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {[
              { id: 'setup', label: 'Setup', icon: Upload },
              { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
              { id: 'providers', label: 'AI Config', icon: Cpu },
              { id: 'part', label: 'Part Review', icon: FileText },
              { id: 'review', label: 'AI Review', icon: Edit },
              { id: 'summary', label: 'Summary', icon: Check }
            ].map((step, i, arr) => {
              const Icon = step.icon;
              const isActive = currentPage === step.id;
              const isComplete = arr.findIndex(s => s.id === currentPage) > i;
              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => setCurrentPage(step.id as any)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors ${
                        isActive 
                          ? 'bg-blue-600 text-white' 
                          : isComplete 
                            ? 'bg-green-600 text-white' 
                            : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </button>
                    <span className={`text-xs ${isActive ? 'font-bold' : ''}`}>{step.label}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className={`flex-1 h-1 mt-5 mx-2 rounded ${isComplete ? 'bg-green-600' : 'bg-gray-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Page Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {currentPage === 'setup' && <SetupPage />}
          {currentPage === 'knowledge' && <KnowledgePage />}
          {currentPage === 'providers' && <ProvidersPage />}
          {currentPage === 'part' && <PartPage />}
          {currentPage === 'review' && <ReviewPage />}
          {currentPage === 'summary' && <SummaryPage />}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Keyboard shortcuts: A = Approve, N = Next, E = Edit, R = Reassign</p>
          <p className="mt-1">Using mock data from sample repository • Prompt version: {promptVersion}</p>
        </div>
      </div>
    </div>
  );
}