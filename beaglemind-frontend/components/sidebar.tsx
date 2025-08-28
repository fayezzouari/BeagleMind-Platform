import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, X, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messageCount?: number;
}

interface SidebarProps {
  conversations: Conversation[];
  currentChatId: string;
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  onClose: () => void;
}

export function Sidebar({ 
  conversations, 
  currentChatId, 
  onNewChat, 
  onSelectChat,
  onClose 
}: SidebarProps) {
  return (
    <div className="h-full bg-slate-950 border-r border-slate-800 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded overflow-hidden bg-slate-800 border border-slate-700">
              <img 
                src="/beagleboard-logo.png" 
                alt="BeagleBoard Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-100">BeagleMind</span>
              <div className="text-xs text-cyan-400">beagleboard.org</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden text-slate-400 hover:text-cyan-400 h-6 w-6 p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <Button
          onClick={onNewChat}
          className="w-full bg-cyan-700 hover:bg-cyan-800 text-white border-0 h-8 text-sm"
        >
          <Plus className="h-3 w-3 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="p-3 border-b border-slate-800">
        <h3 className="text-xs font-medium text-slate-300 mb-2">Quick Start</h3>
        <div className="space-y-1.5">
          <div className="p-2 bg-blue-700/20 border border-blue-700/30 rounded-md">
            <div className="text-xs font-medium text-blue-300 mb-0.5">Getting Started</div>
            <div className="text-xs text-slate-400">Learn BeagleBoard basics</div>
          </div>
          <div className="p-2 bg-emerald-700/20 border border-emerald-700/30 rounded-md">
            <div className="text-xs font-medium text-emerald-300 mb-0.5">Hardware Help</div>
            <div className="text-xs text-slate-400">GPIO, specs, and setup</div>
          </div>
          <div className="p-2 bg-amber-700/20 border border-amber-700/30 rounded-md">
            <div className="text-xs font-medium text-amber-300 mb-0.5">Troubleshooting</div>
            <div className="text-xs text-slate-400">Debug and fix issues</div>
          </div>
        </div>
      </div>

      {/* Conversations list */}
      <ScrollArea className="flex-1 p-2">
        <div className="px-2 mb-2">
          <h3 className="text-xs font-medium text-slate-300">Recent Conversations</h3>
        </div>
        <div className="space-y-1">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`
                group relative p-2 rounded-md cursor-pointer transition-all duration-200
                ${currentChatId === conversation.id 
                  ? 'bg-cyan-700/20 border border-cyan-700/30' 
                  : 'hover:bg-slate-850/50'
                }
              `}
              onClick={() => onSelectChat(conversation.id)}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className={`
                    text-xs font-medium truncate
                    ${currentChatId === conversation.id ? 'text-cyan-100' : 'text-slate-200'}
                  `}>
                    {conversation.title}
                  </h3>
                  {conversation.lastMessage && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {conversation.lastMessage}
                    </p>
                  )}
                  <p className="text-xs text-slate-600 mt-0.5">
                    {formatDistanceToNow(conversation.timestamp, { addSuffix: true })}
                  </p>
                </div>
              </div>
              
              {/* Delete button - shows on hover */}
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 p-0 text-slate-500 hover:text-red-400"
                onClick={(e) => {
                  e.stopPropagation();
                  // Handle delete conversation
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-slate-800">
        <div className="text-xs text-slate-500 text-center mb-1">
          Powered by BeagleBoard Foundation
        </div>
        <div className="text-xs text-slate-600 text-center">
          Open-source hardware • Community driven
        </div>
      </div>
    </div>
  );
}
