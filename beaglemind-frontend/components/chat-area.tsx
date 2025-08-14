import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from '@/components/message-bubble';
import { LoadingDots } from '@/components/loading-dots';
import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { ArrowDown } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: Array<{ type: string; text: string }>;
}

interface ChatAreaProps {
  messages: Message[];
  status: 'ready' | 'submitted' | 'streaming' | 'error';
}

export function ChatArea({ messages, status }: ChatAreaProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  // Track whether user has manually scrolled up (disable auto-scroll)
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = scrollAreaRef; // reuse

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 40; // px threshold
    if (atBottom) {
      if (!autoScroll) setAutoScroll(true);
    } else {
      if (autoScroll) setAutoScroll(false);
    }
  }, [autoScroll]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (!autoScroll) return; // user browsing history
    const behavior: ScrollBehavior = status === 'streaming' ? 'auto' : 'smooth';
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, [messages, status, autoScroll]);

  const { lastAssistantId, lastAssistantHasContent } = useMemo(() => {
    let id: string | null = null;
    let hasContent = false;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        id = messages[i].id;
        hasContent = messages[i].parts.some(p => p.type === 'text' && p.text.trim().length > 0);
        break;
      }
    }
    return { lastAssistantId: id, lastAssistantHasContent: hasContent };
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-2xl">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-6">
            <img 
              src="/beagleboard-logo.png" 
              alt="BeagleBoard Logo" 
              className="w-16 h-16 object-contain"
            />
          </div>
          <h2 className="text-3xl font-bold text-slate-100 mb-3">
            Welcome to BeagleMind
          </h2>
          <p className="text-slate-400 mb-8 text-lg">
            Your intelligent BeagleBoard assistant. Get help with hardware, development, 
            and everything related to your BeagleBoard projects.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 bg-blue-700/20 border border-blue-700/30 rounded-xl">
              <h3 className="font-semibold text-blue-300 mb-2">Hardware Specs</h3>
              <p className="text-slate-400 text-xs">
                Learn about BeagleBoard specifications, GPIO pins, and hardware capabilities
              </p>
            </div>
            
            <div className="p-4 bg-emerald-700/20 border border-emerald-700/30 rounded-xl">
              <h3 className="font-semibold text-emerald-300 mb-2">Quick Setup</h3>
              <p className="text-slate-400 text-xs">
                Get started with Linux, development environments, and project setup
              </p>
            </div>
            
            <div className="p-4 bg-amber-700/20 border border-amber-700/30 rounded-xl">
              <h3 className="font-semibold text-amber-300 mb-2">Development</h3>
              <p className="text-slate-400 text-xs">
                Programming guides, libraries, and embedded systems development
              </p>
            </div>
          </div>
          
          <div className="mt-8 p-4 bg-slate-850/50 border border-slate-800 rounded-xl">
            <p className="text-sm text-slate-300">
              <strong>Tip:</strong> Ask me about specific BeagleBoard models, GPIO programming, 
              or troubleshooting your development setup.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 h-full">
      <ScrollArea className="flex-1 h-full chat-scroll-area" ref={scrollAreaRef}>
        <div className="max-w-4xl mx-auto space-y-6 p-4 pb-8">
        {messages.map((message) => {
          const streaming = status === 'streaming' && lastAssistantId === message.id;
          return <MessageBubble key={message.id} message={message} streaming={streaming} />;
        })}
        
  {(status === 'submitted' || (status === 'streaming' && (!lastAssistantId || !lastAssistantHasContent))) && (
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
              <img 
                src="/beagleboard-logo.png" 
                alt="BeagleBoard Logo" 
                className="w-6 h-6 object-contain"
              />
            </div>
            <div className="flex-1">
              <div className="bg-slate-850/50 rounded-2xl rounded-tl-sm p-4 border border-slate-800/50">
                <LoadingDots />
              </div>
            </div>
          </div>
        )}
        
          {/* Invisible element to scroll to */}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      {!autoScroll && (
        <button
          onClick={() => {
            setAutoScroll(true);
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="absolute bottom-4 right-4 z-10 px-3 py-2 rounded-full bg-neutral-800/80 border border-neutral-700 text-xs text-neutral-200 flex items-center gap-1 shadow hover:bg-neutral-700 backdrop-blur"
        >
          <ArrowDown className="h-4 w-4" /> Latest
        </button>
      )}
    </div>
  );
}
