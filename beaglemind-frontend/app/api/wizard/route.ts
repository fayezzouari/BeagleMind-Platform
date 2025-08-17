import { NextRequest } from 'next/server';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

/*
 Project Wizard API
 Accepts: POST { goals: string; hardware: string; experience: string; focus?: string }
 Returns structured phased plan with milestones, dependencies, resources, and recommended prompts.
*/

interface WizardRequest {
  goals: string;
  hardware: string;
  experience: string; // beginner | intermediate | advanced
  focus?: string; // software | hardware | mixed
  language?: string; // preferred implementation language for code snippets
  provider?: 'openai' | 'groq';
  model?: string;
}

interface PhasePlan {
  id: string;
  title: string;
  objective: string;
  tasks: { id: string; title: string; detail: string; est_hours: number; code?: string }[];
  deliverables: string[];
  resources: string[];
  dependencies: string[];
  prompts: string[];
}

interface WizardResponse {
  phases: PhasePlan[];
  summary: string;
  next_actions: string[];
  risk_notes: string[];
}

function generateId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

// Heuristic fallback generator (used if LLM or retrieval fails)
function buildHeuristicPlan(input: WizardRequest): WizardResponse {
  const { goals, hardware, experience, focus = 'mixed' } = input;

  const baseResources = [
    'Official BeagleBoard docs',
    'Hardware reference manual',
    'Linux device tree docs',
    'BeagleBoard forum threads',
    'GPIO & peripheral examples'
  ];

  const phases: PhasePlan[] = [];

  // Phase 1: Environment & Validation
  phases.push({
    id: generateId('phase'),
    title: 'Environment & Hardware Validation',
    objective: `Validate ${hardware} board, flashing, connectivity, and baseline performance`,
    tasks: [
      { id: generateId('task'), title: 'Flash / Update Image', detail: 'Download latest image, verify checksum, flash to SD/eMMC', est_hours: 2 },
      { id: generateId('task'), title: 'Boot & Serial Console', detail: 'Establish serial and SSH access, capture boot logs', est_hours: 1.5 },
      { id: generateId('task'), title: 'I/O Smoke Test', detail: 'Test LEDs, one GPIO, network, and storage', est_hours: 2 }
    ],
    deliverables: ['Boot log', 'Flashed image notes', 'Initial validation checklist'],
    resources: baseResources,
    dependencies: [],
    prompts: [
      'Explain the boot sequence of my BeagleBoard variant',
      'What are common boot issues and how to diagnose them?',
      'Generate a checklist for validating fresh board setup'
    ]
  });

  // Phase 2: Core Feature / Goal Framing
  phases.push({
    id: generateId('phase'),
    title: 'Core Feature Framing',
    objective: `Break down primary goal: ${goals}`,
    tasks: [
      { id: generateId('task'), title: 'Decompose Goal', detail: 'List required subsystems (I/O, drivers, libs, protocols)', est_hours: 2 },
      { id: generateId('task'), title: 'Select Libraries', detail: 'Choose userspace vs kernel approach, dependencies', est_hours: 1.5 },
      { id: generateId('task'), title: 'Create Architecture Sketch', detail: 'High-level block diagram & data flow', est_hours: 2 }
    ],
    deliverables: ['Subsystem list', 'Architecture diagram', 'Dependency matrix'],
    resources: [...baseResources, 'Block diagram tooling', 'Relevant protocol specs'],
    dependencies: [phases[0].id],
    prompts: [
      `Given the goal "${goals}", list the hardware subsystems involved`,
      'Suggest tradeoffs between Python vs C for this feature on BeagleBoard',
      'Provide a sample data flow for the core pipeline'
    ]
  });

  // Phase 3: Implementation Sprint 1
  phases.push({
    id: generateId('phase'),
    title: 'Implementation Sprint 1',
    objective: 'Establish minimal viable pipeline / driver interaction',
    tasks: [
      { id: generateId('task'), title: 'Prototype GPIO / Peripheral Access', detail: 'Implement basic access routines & test harness', est_hours: 3 },
      { id: generateId('task'), title: 'Logging & Telemetry', detail: 'Add structured logging for timing & errors', est_hours: 2 },
      { id: generateId('task'), title: 'Baseline Performance Metrics', detail: 'Capture latency, throughput, and CPU use', est_hours: 2 }
    ],
    deliverables: ['Prototype code', 'Test harness', 'Performance baseline report'],
    resources: [...baseResources, 'Perf measurement tools (perf, trace-cmd)'],
    dependencies: [phases[1].id],
    prompts: [
      'Generate a minimal GPIO read/write example with timing capture',
      'How to measure latency for my data pipeline on BeagleBoard?',
      'Suggest logging structure for embedded diagnostics'
    ]
  });

  // Phase 4: Risk & Optimization Pass
  phases.push({
    id: generateId('phase'),
    title: 'Risk & Optimization',
    objective: 'Identify bottlenecks, thermal/power constraints, and failure modes',
    tasks: [
      { id: generateId('task'), title: 'Thermal / Power Check', detail: 'Monitor temps & consumption under load', est_hours: 2 },
      { id: generateId('task'), title: 'Error Injection Tests', detail: 'Simulate disconnects, corrupt input, edge signal timing', est_hours: 3 },
      { id: generateId('task'), title: 'Optimize Critical Path', detail: 'Profile and tune hotspots (interrupt latency, I/O)', est_hours: 3 }
    ],
    deliverables: ['Risk register', 'Optimization log', 'Thermal/power report'],
    resources: [...baseResources, 'Thermal monitoring tools', 'Power measurement tools'],
    dependencies: [phases[2].id],
    prompts: [
      'List common performance bottlenecks for BeagleBoard hardware apps',
      'Generate a risk table for my project with severity/mitigation',
      'Provide methods for measuring GPIO toggle latency'
    ]
  });

  // Adjust plan depth based on experience
  if (experience === 'beginner') {
    phases.forEach(p => p.tasks.push({ id: generateId('task'), title: 'Documentation Review', detail: 'Read and summarize official docs section relevant to this phase', est_hours: 1 }));
  } else if (experience === 'advanced') {
    phases.push({
      id: generateId('phase'),
      title: 'Advanced Enhancement',
      objective: 'Add stretch goals and advanced capabilities',
      tasks: [
        { id: generateId('task'), title: 'Upstream Contribution', detail: 'Prepare patch or documentation improvement', est_hours: 4 },
        { id: generateId('task'), title: 'Instrumentation Layer', detail: 'Add tracing/profiling hooks for future scaling', est_hours: 3 }
      ],
      deliverables: ['Patch submission', 'Instrumentation docs'],
      resources: [...baseResources, 'Kernel contribution guidelines'],
      dependencies: [phases[phases.length - 1].id],
      prompts: [
        'How to structure a kernel patch description?',
        'Suggest instrumentation points for long-term observability'
      ]
    });
  }

  const summary = `Generated a phased plan (${phases.length} phases) targeting goal: ${goals}. Focus: ${focus}. Experience: ${experience}.`;
  const next_actions = [
    'Review Phase 1 tasks and adjust estimates',
    'Confirm hardware inventory and tools',
    'Schedule first validation session',
  ];
  const risk_notes = [
    'Unclear hardware revisions can cause subtle timing differences',
    'Thermal throttling if enclosure airflow is poor',
    'Driver/library version drift over time'
  ];

  return { phases, summary, next_actions, risk_notes };
}

// --- Retrieval Helpers (reuse pattern from chat route) ---
const KNOWLEDGE_BASE_URL = process.env.KNOWLEDGE_BASE_URL || 'http://localhost:8000';
const KB_COLLECTION_NAME = process.env.KB_COLLECTION_NAME || 'beaglemind_col';
const WIZARD_CONTEXT_RESULTS = Number(process.env.WIZARD_CONTEXT_RESULTS || process.env.KB_CONTEXT_RESULTS || 5);
const WIZARD_CONTEXT_CHAR_BUDGET = Number(process.env.WIZARD_CONTEXT_CHAR_BUDGET || process.env.KB_CONTEXT_CHAR_BUDGET || 4000);

interface RetrieveResponse {
  documents: string[][];
  metadatas: Array<Array<Record<string, unknown>>>;
  distances: number[][];
  total_found: number;
  filtered_results: number;
}

async function retrieveContext(query: string) {
  try {
    const body = {
      query,
      collection_name: KB_COLLECTION_NAME,
      n_results: 10,
      include_metadata: true,
      rerank: true,
    };
    const resp = await fetch(`${KNOWLEDGE_BASE_URL}/api/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store'
    });
    if (!resp.ok) throw new Error('retrieve failed');
    const data: RetrieveResponse = await resp.json();
    const flat = data.documents.flatMap((group, gi) => group.map((content, di) => ({
      content,
      meta: (data.metadatas?.[gi]?.[di] as Record<string, unknown>) || {},
      distance: data.distances?.[gi]?.[di] || 0,
    })));
    return flat.slice(0, WIZARD_CONTEXT_RESULTS);
  } catch (e) {
    console.warn('Wizard retrieval error', e);
    return [];
  }
}

function buildContextBlock(snippets: Array<{ content: string; meta: Record<string, unknown> }>) {
  if (!snippets.length) return '';
  let used = 0;
  const parts: string[] = [];
  for (let i = 0; i < snippets.length; i++) {
    const raw = (snippets[i].content || '').trim();
    if (!raw) continue;
    const header = `Snippet ${i + 1}`;
    const remaining = WIZARD_CONTEXT_CHAR_BUDGET - used - header.length - 4;
    if (remaining <= 0) break;
    const clipped = raw.slice(0, remaining);
    const block = `${header}:\n${clipped}`;
    used += block.length + 2;
    parts.push(block);
    if (used >= WIZARD_CONTEXT_CHAR_BUDGET) break;
  }
  return parts.length ? `<retrieved_context>\n${parts.join('\n\n')}\n</retrieved_context>` : '';
}

// Parse model JSON output robustly
function safeParseJSON(text: string): Record<string, unknown> | null {
  try {
    // Extract first { ... } block
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first === -1 || last === -1) return null;
    const slice = text.slice(first, last + 1);
    return JSON.parse(slice) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function attachIds(obj: Record<string, unknown>): WizardResponse {
  const phases: PhasePlan[] = (Array.isArray(obj.phases) ? obj.phases : []).map((p: Record<string, unknown>) => ({
    id: generateId('phase'),
    title: typeof p.title === 'string' ? p.title.slice(0, 120) : 'Untitled Phase',
    objective: typeof p.objective === 'string' ? p.objective.slice(0, 400) : '',
    tasks: (Array.isArray(p.tasks) ? p.tasks : []).map((t: Record<string, unknown>) => ({
      id: generateId('task'),
      title: typeof t.title === 'string' ? t.title.slice(0, 120) : 'Task',
      detail: typeof t.detail === 'string' ? t.detail.slice(0, 400) : '',
      est_hours: typeof t.est_hours === 'number' ? t.est_hours : 1,
      code: typeof t.code === 'string' ? t.code.slice(0, 1200) : undefined,
    })),
    deliverables: Array.isArray(p.deliverables) ? p.deliverables.map((d: unknown) => String(d).slice(0, 120)) : [],
    resources: Array.isArray(p.resources) ? p.resources.map((r: unknown) => String(r).slice(0, 160)) : [],
    dependencies: Array.isArray(p.dependencies) ? p.dependencies.map((d: unknown) => String(d)) : [],
    prompts: Array.isArray(p.prompts) ? p.prompts.map((d: unknown) => String(d).slice(0, 200)) : [],
  }));
  return {
    phases,
    summary: typeof obj.summary === 'string' ? obj.summary.slice(0, 500) : 'Project plan summary',
    next_actions: Array.isArray(obj.next_actions) ? obj.next_actions.map((a: unknown) => String(a).slice(0, 160)) : [],
    risk_notes: Array.isArray(obj.risk_notes) ? obj.risk_notes.map((r: unknown) => String(r).slice(0, 200)) : [],
  };
}

async function buildLLMPlan(input: WizardRequest): Promise<WizardResponse> {
  const query = `${input.goals} ${input.hardware}`.trim();
  const retrieved = await retrieveContext(query);
  const contextBlock = buildContextBlock(retrieved);
  const lang = (input.language || 'C').trim();
  const system = `You are an expert BeagleBoard and embedded ${lang} engineer & project planner.
Your task: produce a precise, implementation-focused phased execution plan.
RULES:
1. Output ONLY valid JSON (no markdown, no commentary outside JSON).
2. JSON shape: { summary, phases, next_actions, risk_notes }.
3. phases: [ { title, objective, tasks, deliverables, resources, dependencies, prompts } ]. 3-6 phases typical.
4. tasks: [{ title, detail, est_hours, code? }]. Each task est_hours 1-6 unless strongly justified.
5. code (OPTIONAL) is a concise ${lang} snippet (<= 60 lines, <= 1200 chars) showing key logic (initialization, driver usage, IO loop, optimization pattern, etc.). Omit if trivial.
6. Use ONLY facts from retrieved context plus standard BeagleBoard knowledge. For assumptions use prefix 'Assumption:' in detail.
7. Avoid placeholders like TODO; show realistic function names & minimal scaffolding.
8. Keep resources and prompts directly actionable.
9. Summary must mention if context was sparse.
10. No duplicate phases or tasks.`;
  const user = `GOALS: ${input.goals}\nHARDWARE: ${input.hardware}\nEXPERIENCE: ${input.experience}\nFOCUS: ${input.focus || 'mixed'}\nLANGUAGE: ${lang}\n${contextBlock}`;

  const provider = input.provider === 'groq' ? 'groq' : 'openai';
  const modelId = input.model || (provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o');
  // TODO: When @ai-sdk/groq is installed, switch to Groq provider here
  const model = openai(provider === 'groq' ? 'gpt-4o' : modelId);
  const result = await generateText({
    model,
    system,
    prompt: user,
  temperature: 0.4,
  maxOutputTokens: 1800,
  });

  const parsed = safeParseJSON(result.text);
  if (!parsed) throw new Error('Failed to parse LLM JSON');
  return attachIds(parsed);
}

export async function POST(req: NextRequest) {
  try {
  const body: WizardRequest = await req.json();
    if (!body.goals || !body.hardware || !body.experience) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }
    // Attempt LLM-based plan first
    try {
      const plan = await buildLLMPlan(body);
      return new Response(JSON.stringify(plan), { status: 200, headers: { 'Content-Type': 'application/json', 'X-Plan-Mode': 'llm' } });
    } catch (e) {
      console.warn('LLM plan generation failed, falling back to heuristic:', e);
      const plan = buildHeuristicPlan(body);
      return new Response(JSON.stringify(plan), { status: 200, headers: { 'Content-Type': 'application/json', 'X-Plan-Mode': 'heuristic-fallback' } });
    }
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
  }
}
