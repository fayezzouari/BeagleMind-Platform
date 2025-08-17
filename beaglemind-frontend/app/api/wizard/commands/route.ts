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
    const prompt = `You are an expert embedded engineer for BeagleBoard.\nTASK TITLE: ${body.taskTitle}\nDETAIL: ${body.detail}\nHARDWARE: ${body.hardware}\nLANGUAGE: ${lang}\nGOALS: ${body.goals || ''}\nFOCUS: ${body.focus || ''}\nEXPERIENCE: ${body.experience || ''}\n\nProduce a STRICT JSON object ONLY with shape:\n{"commands":[{"cmd":"shell command","explanation":"short reason"}],"code":"OPTIONAL_${lang}_snippet_or_empty_string"}\nRules:\n- 3-8 commands, each minimal, safe, directly actionable.\n- Prefer standard Linux tooling (apt, git, make) & BeagleBoard context.\n- Avoid destructive operations (no rm -rf *, no sudo unless essential).\n- code snippet <= 80 lines, show key logic only, may be empty string if not useful.\n- NO text outside JSON.`;

    const provider = body.provider === 'groq' ? 'groq' : 'openai';
    const modelId = body.model || (provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o');
    // For now, use OpenAI; Groq support can be added when provider package is available.
    const result = await generateText({
      model: openai(provider === 'groq' ? 'gpt-4o' : modelId),
      system: 'Return ONLY raw JSON. Never add commentary.',
      prompt,
      temperature: 0.3,
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
