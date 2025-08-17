"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Provider = 'openai' | 'groq';

const OPENAI_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
  'o1-preview',
  'o1-mini',
];

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-20b',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
];

interface ModelSelectorProps {
  provider: Provider;
  model: string;
  onChange: (next: { provider: Provider; model: string }) => void;
}

export function ModelSelector({ provider, model, onChange }: ModelSelectorProps) {
  const models = provider === 'openai' ? OPENAI_MODELS : GROQ_MODELS;

  return (
    <div className="flex items-center gap-2">
      <Select
        value={provider}
        onValueChange={(v) => {
          const nextProvider = (v as Provider) || 'openai';
          const defaultModel = nextProvider === 'openai' ? OPENAI_MODELS[0] : GROQ_MODELS[0];
          onChange({ provider: nextProvider, model: defaultModel });
        }}
      >
        <SelectTrigger className="h-8 bg-slate-800/50 border-slate-700 text-slate-300">
          <SelectValue placeholder="Provider" />
        </SelectTrigger>
        <SelectContent className="bg-slate-900 border-slate-700">
          <SelectItem value="openai" className="text-slate-300">OpenAI</SelectItem>
          <SelectItem value="groq" className="text-slate-300">Groq</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={model}
        onValueChange={(v) => onChange({ provider, model: v })}
      >
        <SelectTrigger className="min-w-48 h-8 bg-slate-800/50 border-slate-700 text-slate-300">
          <SelectValue placeholder="Model" />
        </SelectTrigger>
        <SelectContent className="bg-slate-900 border-slate-700 max-h-72">
          {models.map((m) => (
            <SelectItem key={m} value={m} className="text-slate-300">{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
