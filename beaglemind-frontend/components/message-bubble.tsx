import { User, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import React from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: Array<{ type: string; text: string }>;
}

interface MessageBubbleProps {
  message: Message;
  streaming?: boolean; // true if this is the actively streaming assistant message
}

function InnerMessageBubble({ message, streaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  
  const handleCopy = () => {
    const text = message.parts
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('');
    navigator.clipboard.writeText(text);
  };

  return (
    <div className={`flex items-start gap-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
        ${isUser 
          ? 'bg-slate-800 border border-slate-700' 
          : 'bg-slate-800 border border-slate-700 overflow-hidden'
        }
      `}>
        {isUser ? (
          <User className="h-4 w-4 text-slate-300" />
        ) : (
          <img 
            src="/beagleboard-logo.png" 
            alt="BeagleBoard Logo" 
            className="w-6 h-6 object-contain"
          />
        )}
      </div>

      {/* Message content */}
      <div className={`flex-1 group ${isUser ? 'flex justify-end' : ''}`}>
        <div className={`
          max-w-[85%] rounded-2xl p-4 border break-words overflow-hidden
          ${isUser 
            ? 'bg-cyan-700 text-white border-cyan-700 rounded-tr-sm' 
            : 'bg-slate-850/50 text-slate-100 border-slate-800/50 rounded-tl-sm'
          }
        `}>
          {message.parts.map((part, index) => {
            if (part.type !== 'text') return null;
            const text = part.text;
            if (isUser) {
              return <div key={index} className="whitespace-pre-wrap">{text}</div>;
            }
            // Assistant: during streaming still use MarkdownRenderer but disable highlighting to reduce cost
            return (
              <MarkdownRenderer
                key={index}
                content={text}
                disableHighlight={streaming}
              />
            );
          })}
        </div>

        {/* Action buttons for assistant messages - simplified */}
        {!isUser && !streaming && (
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-slate-500 hover:text-slate-300"
              onClick={handleCopy}
              title="Copy message"
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export const MessageBubble = React.memo(InnerMessageBubble, (prev, next) => {
  // Always re-render while streaming to avoid missed updates if underlying array is mutated in place.
  if (next.streaming) return false;
  if (prev.message.id !== next.message.id) return false;
  if (prev.message.parts.length !== next.message.parts.length) return false;
  const lastPrev = prev.message.parts[prev.message.parts.length - 1]?.text;
  const lastNext = next.message.parts[next.message.parts.length - 1]?.text;
  // If the previous was streaming and now not streaming, re-render for markdown formatting.
  if (prev.streaming && !next.streaming) return false;
  return lastPrev === lastNext;
});
