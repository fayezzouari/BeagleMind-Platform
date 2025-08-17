"use client";

import { useState, useCallback, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Maximize2, X, Copy, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';

interface WizardPhaseTask { id: string; title: string; detail: string; est_hours: number; code?: string }
interface WizardPhase {
  id: string;
  title: string;
  objective: string;
  tasks: WizardPhaseTask[];
  deliverables: string[];
  resources: string[];
  dependencies: string[];
  prompts: string[];
}
interface WizardPlan {
  phases: WizardPhase[];
  summary: string;
  next_actions: string[];
  risk_notes: string[];
}

export function WizardArea({ provider, model }: { provider?: 'openai' | 'groq'; model?: string }) {
  const [goals, setGoals] = useState('');
  const [hardware, setHardware] = useState('BeagleBone Black');
  const [experience, setExperience] = useState<'beginner'|'intermediate'|'advanced'>('intermediate');
  const [focus, setFocus] = useState<'hardware'|'software'|'mixed'>('mixed');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState('C');
  const [plan, setPlan] = useState<WizardPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [enrichments, setEnrichments] = useState<Record<string, { loading: boolean; commands?: { cmd: string; explanation: string }[]; code?: string; error?: string }>>({});

  const generate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!goals.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/wizard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goals, hardware, experience, focus, language, provider, model }),
      });
      const data = await resp.json();
      if (!resp.ok || data.error) throw new Error(data.error || 'Failed');
      setPlan(data as WizardPlan);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate plan');
    } finally {
      setLoading(false);
    }
  };

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && showModal) setShowModal(false);
  }, [showModal]);

  useEffect(() => {
    if (showModal) {
      window.addEventListener('keydown', handleKey);
    } else {
      window.removeEventListener('keydown', handleKey);
    }
    return () => window.removeEventListener('keydown', handleKey);
  }, [showModal, handleKey]);

  const copyPlan = () => {
    if (!plan) return;
    const text = [
      plan.summary,
      '\nNext Actions:\n- ' + plan.next_actions.join('\n- '),
      '\nRisks:\n- ' + plan.risk_notes.join('\n- '),
      ...plan.phases.map((p, i) => `\nPhase ${i+1}: ${p.title}\nObjective: ${p.objective}\nTasks:\n${p.tasks.map(t=>`  - ${t.title} (${t.est_hours}h): ${t.detail}`).join('\n')}\nDeliverables: ${p.deliverables.join(', ')}\nResources: ${p.resources.join(', ')}\nPrompts:\n${p.prompts.map(pr=>`  * ${pr}`).join('\n')}`)
    ].join('\n');
    navigator?.clipboard?.writeText(text).then(()=>{
      setCopied(true);
      setTimeout(()=>setCopied(false), 2000);
    });
  };

  const toggleTask = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };

  const enrichTask = async (task: WizardPhaseTask) => {
    if (enrichments[task.id]?.loading) return;
    setEnrichments(prev => ({ ...prev, [task.id]: { ...(prev[task.id] || {}), loading: true, error: undefined } }));
    try {
      const resp = await fetch('/api/wizard/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskTitle: task.title,
          detail: task.detail,
          hardware,
          language,
          goals,
          focus,
          experience,
          provider,
          model,
        })
      });
      const data = await resp.json();
      if (!resp.ok || data.error) throw new Error(data.error || 'Failed');
      setEnrichments(prev => ({ ...prev, [task.id]: { loading: false, commands: data.commands, code: data.code } }));
    } catch (e: unknown) {
      setEnrichments(prev => ({ ...prev, [task.id]: { loading: false, error: e instanceof Error ? e.message : 'Failed to generate commands' } }));
    }
  };

  const PlanBody = ({ compact }: { compact?: boolean }) => (
    <div className={compact ? 'p-6 space-y-10' : 'p-6 space-y-10'}>
      <div className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100">Summary</h2>
        <p className="text-sm text-slate-300 leading-relaxed">{plan?.summary}</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {plan?.next_actions.map(a => (
            <span key={a} className="px-2 py-1 rounded bg-cyan-700/20 border border-cyan-700/40 text-cyan-300">{a}</span>
          ))}
        </div>
      </div>
      {plan?.phases.map((phase, i) => (
        <div key={phase.id} className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Phase {i+1}: {phase.title}</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">{phase.objective}</p>
            </div>
            {phase.dependencies.length > 0 && (
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Deps: {phase.dependencies.length}</div>
            )}
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-200">Tasks</h4>
                <ul className="space-y-2">
                  {phase.tasks.map(t => {
                    const expanded = expandedTasks.has(t.id);
                    const enrich = enrichments[t.id];
                    return (
                      <li key={t.id} className="rounded-lg bg-slate-950/60 border border-slate-800 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => toggleTask(t.id)}
                          className="w-full flex items-start justify-between gap-3 p-3 text-left hover:bg-slate-900/60 focus:outline-none focus:ring-1 focus:ring-cyan-600"
                        >
                          <div className="flex items-start gap-2">
                            {expanded ? <ChevronDown className="h-4 w-4 mt-0.5 text-cyan-400" /> : <ChevronRight className="h-4 w-4 mt-0.5 text-slate-500" />}
                            <div>
                              <div className="text-sm font-medium text-slate-100">{t.title}</div>
                              <div className="text-[10px] text-slate-500 mt-1">~{t.est_hours}h</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {enrich?.commands && <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-700/30 text-emerald-300">Commands</span>}
                            {(t.code || enrich?.code) && <span className="text-[10px] px-2 py-0.5 rounded bg-amber-700/30 text-amber-300">Code</span>}
                          </div>
                        </button>
                        {expanded && (
                          <div className="px-4 pb-4 space-y-3 border-t border-slate-800">
                            <div className="text-xs text-slate-300 whitespace-pre-line pt-3">{t.detail}</div>
                            {t.code && (
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-amber-400 mb-1">Snippet</div>
                                <pre className="rounded-md bg-slate-900/70 border border-slate-800 p-3 overflow-auto max-h-72 text-[11px] leading-relaxed">
                                  <code>{t.code}</code>
                                </pre>
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[11px] text-slate-300 hover:text-cyan-400"
                                disabled={enrich?.loading}
                                onClick={() => enrichTask(t)}
                              >
                                {enrich?.loading && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                                {enrich?.commands ? 'Regenerate Commands' : 'Generate Commands'}
                              </Button>
                              {enrich?.error && <span className="text-[10px] text-red-400">{enrich.error}</span>}
                            </div>
                            {enrich?.commands && (
                              <div className="space-y-2">
                                <div className="text-[10px] uppercase tracking-wide text-emerald-400">Suggested Commands</div>
                                <ul className="space-y-2">
                                  {enrich.commands.map((c, idx) => (
                                    <li key={idx} className="p-2 rounded-md bg-slate-900/70 border border-slate-800">
                                      <div className="flex items-start justify-between gap-3">
                                        <code className="text-[11px] text-cyan-300 break-all select-all">{c.cmd}</code>
                                        <button
                                          onClick={() => navigator?.clipboard?.writeText(c.cmd)}
                                          className="text-[10px] text-slate-400 hover:text-cyan-400"
                                          title="Copy command"
                                          type="button"
                                        >
                                          <Copy className="h-3 w-3" />
                                        </button>
                                      </div>
                                      {c.explanation && <div className="text-[11px] text-slate-400 mt-1 leading-snug">{c.explanation}</div>}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {enrich?.code && !t.code && (
                              <div>
                                <div className="text-[10px] uppercase tracking-wide text-amber-400 mb-1">Generated Snippet</div>
                                <pre className="rounded-md bg-slate-900/70 border border-slate-800 p-3 overflow-auto max-h-72 text-[11px] leading-relaxed">
                                  <code>{enrich.code}</code>
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-200">Suggested Prompts</h4>
                <div className="flex flex-wrap gap-2">
                  {phase.prompts.map(p => (
                    <button
                      key={p}
                      onClick={() => navigator?.clipboard?.writeText(p)}
                      className="text-xs px-2 py-1 rounded bg-amber-700/20 border border-amber-700/40 text-amber-300 hover:bg-amber-700/30 transition"
                      title="Copy prompt"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-200">Deliverables</h4>
                <ul className="text-xs text-slate-400 space-y-1 list-disc pl-4">
                  {phase.deliverables.map(d => <li key={d}>{d}</li>)}
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-200">Resources</h4>
                <ul className="text-xs text-slate-400 space-y-1 list-disc pl-4">
                  {phase.resources.map(r => <li key={r}>{r}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </div>
      ))}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-100">Risks & Notes</h2>
        <ul className="text-xs text-slate-400 space-y-1 list-disc pl-4">
          {plan?.risk_notes.map(r => <li key={r}>{r}</li>)}
        </ul>
      </div>
    </div>
  );

  return (
    <>
    <div className="flex h-full">
      <div className="w-full max-w-3xl mx-auto p-6 flex flex-col gap-6">
        <form onSubmit={generate} className="space-y-6 bg-slate-900/60 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <img src="/beagleboard-logo.png" alt="Logo" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-2xl font-semibold text-slate-100">Project Wizard</h1>
              <p className="text-xs text-cyan-400">Generate a phased BeagleBoard development plan</p>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-300 font-medium">Project Goals *</label>
            <textarea
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-cyan-600"
              rows={3}
              placeholder="e.g. Build a real-time sensor acquisition and visualization system with MQTT and local dashboard"
              value={goals}
              onChange={e => setGoals(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm text-slate-300 font-medium">Hardware</label>
              <input
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-600"
                value={hardware}
                onChange={e => setHardware(e.target.value)}
                placeholder="BeagleBone Black, AI-64, etc"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-300 font-medium">Experience Level</label>
              <select
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-600"
                value={experience}
                onChange={e => setExperience(e.target.value as 'beginner' | 'intermediate' | 'advanced')}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-300 font-medium">Focus</label>
              <select
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-600"
                value={focus}
                onChange={e => setFocus(e.target.value as 'hardware' | 'software' | 'mixed')}
              >
                <option value="mixed">Mixed</option>
                <option value="hardware">Hardware</option>
                <option value="software">Software</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-300 font-medium">Preferred Language</label>
              <select
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-600"
                value={language}
                onChange={e => setLanguage(e.target.value)}
              >
                <option value="C">C</option>
                <option value="C++">C++</option>
                <option value="Python">Python</option>
                <option value="Rust">Rust</option>
                <option value="Go">Go</option>
                <option value="JavaScript">JavaScript</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button type="submit" disabled={loading || !goals.trim()} className="bg-cyan-600 hover:bg-cyan-500">
              {loading ? 'Generating…' : 'Generate Plan'}
            </Button>
            {error && <div className="text-xs text-red-400">{error}</div>}
            {plan && !error && (
              <div className="flex items-center gap-3">
                <div className="text-xs text-emerald-400">Plan generated: {plan.phases.length} phases</div>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-slate-300 hover:text-cyan-400"
                  onClick={() => setShowModal(true)}
                >
                  <Maximize2 className="h-3.5 w-3.5 mr-1" /> Expand
                </Button>
              </div>
            )}
          </div>
        </form>

        <div className="flex-1 min-h-0">
          {plan ? (
            <ScrollArea className="h-[calc(100vh-320px)] rounded-lg border border-slate-800 bg-slate-900/40">
              <PlanBody compact />
            </ScrollArea>
          ) : (
            <div className="h-[calc(100vh-320px)] flex items-center justify-center border border-dashed border-slate-700 rounded-lg text-slate-500 text-sm">
              Enter project details to generate a structured plan.
            </div>
          )}
        </div>
      </div>
    </div>
    {showModal && plan && (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Project Plan Fullscreen"
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowModal(false)} />
        <div className="relative w-full max-w-7xl h-[90vh] bg-slate-950 border border-slate-800 rounded-xl shadow-2xl flex flex-col">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/70 rounded-t-xl">
            <div className="flex items-center gap-3">
              <img src="/beagleboard-logo.png" alt="Logo" className="w-8 h-8 object-contain" />
              <div>
                <div className="text-sm font-semibold text-slate-100">Project Plan (Fullscreen)</div>
                <div className="text-[10px] uppercase tracking-wide text-cyan-400">Phases: {plan.phases.length}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-slate-300 hover:text-cyan-400"
                onClick={copyPlan}
              >
                <Copy className="h-3.5 w-3.5 mr-1" /> {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-red-400"
                onClick={() => setShowModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1 min-h-0 h-full">
            <PlanBody />
          </ScrollArea>
        </div>
      </div>
    )}
    </>
  );
}
