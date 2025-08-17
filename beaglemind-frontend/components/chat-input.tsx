import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Square } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ModelSelector } from '@/components/model-selector';

interface ChatInputProps {
  onSendMessage: (message: { text: string; tool?: string }) => void;
  disabled: boolean;
  status: 'ready' | 'submitted' | 'streaming' | 'error';
  provider?: 'openai' | 'groq';
  model?: string;
  onModelChange?: (next: { provider: 'openai' | 'groq'; model: string }) => void;
}

export function ChatInput({ onSendMessage, disabled, status, provider, model, onModelChange }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [selectedTool, setSelectedTool] = useState<string>('none');

  const promptSuggestions = [
    "What are the GPIO pins on BeagleBoard-X15?",
    "How do I set up a development environment for BeagleBoard?",
    "Compare BeagleBone Black vs BeagleBoard-X15",
    "Show me a simple LED blink example",
    "What operating systems can run on BeagleBoard?",
    "How to troubleshoot boot issues?"
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSendMessage({ 
        text: input,
        tool: selectedTool !== 'none' ? selectedTool : undefined
      });
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const isLoading = status === 'submitted' || status === 'streaming';

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  return (
    <div className="border-t border-slate-800 bg-slate-850/50">
      {/* Prompt Suggestions */}
      <div className="p-4 pb-2 border-b border-slate-800/50">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Quick suggestions:</h3>
          <div className="flex flex-wrap gap-2">
            {promptSuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-3 py-1.5 text-xs bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-full text-slate-300 hover:text-cyan-400 transition-colors duration-200"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Input */}
      <div className="p-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="relative flex items-end gap-3 bg-slate-850/50 border border-slate-800 rounded-2xl p-3">
            {/* Tool Selection Dropdown */}
            <div className="flex-shrink-0">
              <Select value={selectedTool} onValueChange={setSelectedTool}>
                <SelectTrigger className="w-32 h-8 bg-slate-800/50 border-slate-700 text-slate-300">
                  <SelectValue placeholder="Tools" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="none" className="text-slate-300">No Tool</SelectItem>
                  <SelectItem value="websearch" className="text-slate-300">
                    Web Search
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask BeagleMind about hardware, development, or troubleshooting..."
              disabled={disabled}
              className="flex-1 min-h-[20px] max-h-32 resize-none border-0 bg-transparent text-slate-100 placeholder-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={1}
            />
            
            {/* Model Selector */}
            {onModelChange && (
              <div className="hidden md:block">
                <ModelSelector
                  provider={provider || 'openai'}
                  model={model || 'gpt-4o'}
                  onChange={onModelChange}
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={disabled || !input.trim()}
              size="sm"
              className={`
                h-8 w-8 p-0 rounded-lg transition-all duration-200
                ${!disabled && input.trim()
                  ? 'bg-cyan-700 hover:bg-cyan-800 text-white' 
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }
              `}
            >
              {isLoading ? (
                <Square className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {/* Tool indicator */}
          {(selectedTool !== 'none' || provider || model) && (
            <div className="flex items-center gap-2 mt-2">
              {selectedTool !== 'none' && (
                <Badge variant="secondary" className="bg-cyan-700/20 text-cyan-400 border-cyan-700/30">
                  Web Search Enabled
                </Badge>
              )}
              {(provider && model) && (
                <Badge variant="secondary" className="bg-amber-700/20 text-amber-300 border-amber-700/30">
                  {provider}: {model}
                </Badge>
              )}
            </div>
          )}
          
          <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
            <span>Press Enter to send, Shift + Enter for new line</span>
            <span>BeagleMind • <span className="text-cyan-500">beagleboard.org</span></span>
          </div>
        </form>
      </div>
    </div>
  );
}
