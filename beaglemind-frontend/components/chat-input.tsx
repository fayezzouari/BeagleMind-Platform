import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Square, ChevronDown, ChevronRight } from 'lucide-react';
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
  const [showSuggestions, setShowSuggestions] = useState<boolean>(true);

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
      <div className="p-2 md:p-3 pb-1 md:pb-2 border-b border-slate-800/50">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs md:text-sm font-medium text-slate-300">Quick suggestions:</h3>
            <button
              type="button"
              onClick={() => setShowSuggestions(v => !v)}
              aria-label={showSuggestions ? 'Hide quick suggestions' : 'Show quick suggestions'}
              className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 border border-transparent hover:border-slate-700 transition-colors"
            >
              {showSuggestions ? <ChevronDown className="h-3 w-3 md:h-4 md:w-4" /> : <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />}
            </button>
          </div>
          {showSuggestions && (
            <div className="flex flex-wrap gap-1.5 md:gap-2">
              {promptSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="px-2 md:px-3 py-1 md:py-1.5 text-xs bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-full text-slate-300 hover:text-cyan-400 transition-colors duration-200"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Input */}
      <div className="p-2 md:p-3">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="relative flex items-end gap-2 md:gap-3 bg-slate-850/50 border border-slate-800 rounded-xl md:rounded-2xl p-2 md:p-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask BeagleMind about hardware, development, or troubleshooting..."
              disabled={disabled}
              className="flex-1 min-h-[16px] md:min-h-[20px] max-h-24 md:max-h-32 resize-none border-0 bg-transparent text-slate-100 placeholder-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm md:text-base"
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
                h-7 w-7 md:h-8 md:w-8 p-0 rounded-lg transition-all duration-200
                ${!disabled && input.trim()
                  ? 'bg-cyan-700 hover:bg-cyan-800 text-white' 
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }
              `}
            >
              {isLoading ? (
                <Square className="h-3 w-3 md:h-4 md:w-4" />
              ) : (
                <Send className="h-3 w-3 md:h-4 md:w-4" />
              )}
            </Button>
          </div>
          
          {/* Tool indicator */}
          {(selectedTool !== 'none' || provider || model) && (
            <div className="flex items-center gap-1.5 md:gap-2 mt-1.5 md:mt-2">
              {selectedTool !== 'none' && (
                <Badge variant="secondary" className="bg-cyan-700/20 text-cyan-400 border-cyan-700/30 text-xs">
                  Web Search Enabled
                </Badge>
              )}
              {(provider && model) && (
                <Badge variant="secondary" className="bg-amber-700/20 text-amber-300 border-amber-700/30 text-xs">
                  {provider}: {model}
                </Badge>
              )}
            </div>
          )}
          
          <div className="flex items-center justify-between mt-1.5 md:mt-2 text-xs text-slate-500">
            <span className="hidden sm:inline">Press Enter to send, Shift + Enter for new line</span>
            <span className="text-xs md:text-sm">BeagleMind • <span className="text-cyan-500">beagleboard.org</span></span>
          </div>
        </form>
      </div>
    </div>
  );
}
