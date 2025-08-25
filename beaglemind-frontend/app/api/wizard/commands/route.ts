import { NextRequest } from 'next/server';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

interface CommandRequest {
  taskTitle: string;
  detail: string;
  hardware: string;
  language?: string;
  goals?: string;
  focus?: string;
  experience?: string;
  provider?: 'openai' | 'groq';
  model?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: CommandRequest = await req.json();
    if (!body.taskTitle || !body.detail || !body.hardware) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
    }
    const lang = body.language || 'C';
    const prompt = [
      'You are an expert embedded engineer for BeagleBoard.',
      'IMPORTANT: Focus STRICTLY on the CURRENT TASK described in DETAIL. Do NOT propose commands for subsequent steps.',
      `TASK TITLE: ${body.taskTitle}`,
      `DETAIL: ${body.detail}`,
      `HARDWARE: ${body.hardware}`,
      `LANGUAGE: ${lang}`,
      `GOALS: ${body.goals || ''}`,
      `FOCUS: ${body.focus || ''}`,
      `EXPERIENCE: ${body.experience || ''}`,
      '',
      'Produce a STRICT JSON object ONLY with shape:',
      `{"commands":[{"cmd":"shell command","explanation":"short reason"}],"code":"OPTIONAL_${lang}_snippet_or_empty_string"}`,
      'Rules:',
      '- 2-6 commands, each minimal, safe, and directly actionable for this task only.',
      '- Do NOT include commands that prepare later tasks or describe multi-step plans.',
      '- Prefer standard Linux tooling (apt, git, make) & BeagleBoard context.',
      '- Avoid destructive operations (no rm -rf *, no sudo unless essential).',
      '- code snippet <= 80 lines, show key logic only, may be empty string if not useful.',
      '- NO text outside JSON.',
      'If the task cannot be accomplished safely, return { "commands": [], "code": "" }.'
    ].join('\n');

    const provider = body.provider === 'groq' ? 'groq' : 'openai';
    const modelId = body.model || (provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o');
    // For now, use OpenAI; Groq support can be added when provider package is available.
    const result = await generateText({
      model: openai(provider === 'groq' ? 'gpt-4o' : modelId),
      system: 'Return ONLY raw JSON. Never add commentary. Focus only on the current task; do not propose next-step commands.',
      prompt,
      temperature: 0.0,
      maxOutputTokens: 800,
    });
    const text = result.text.trim();
  let parsed: { commands?: Array<{ cmd?: string; explanation?: string }>; code?: string } | null = null;
    try {
      const first = text.indexOf('{');
      const last = text.lastIndexOf('}');
      if (first !== -1 && last !== -1) {
        parsed = JSON.parse(text.slice(first, last + 1));
      }
    } catch {}
    if (!parsed || !Array.isArray(parsed.commands)) {
      return new Response(JSON.stringify({ error: 'Model output not parseable' }), { status: 502 });
    }
    const commands = parsed.commands.slice(0, 8).map((c: { cmd?: string; explanation?: string }) => ({
      cmd: c.cmd?.toString().slice(0, 160) || '',
      explanation: c.explanation?.toString().slice(0, 240) || ''
    })).filter((c) => c.cmd);
    const code = typeof parsed.code === 'string' ? parsed.code.slice(0, 4000) : undefined;
    return new Response(JSON.stringify({ commands, code }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch {
  return new Response(JSON.stringify({ error: 'Failed to process request' }), { status: 500 });
  }
}
