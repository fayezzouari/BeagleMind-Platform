"use client";

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Sidebar } from '@/components/sidebar';
import { ChatArea } from '@/components/chat-area';
import { ChatInput } from '@/components/chat-input';
import { WizardArea } from '@/components/wizard-area';
import { Button } from '@/components/ui/button';
import { Menu, Wand2, ChevronLeft, ChevronRight } from 'lucide-react';

export default function BeagleMindApp() {
  const [view, setView] = useState<'chat' | 'wizard'>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string>('default');
  const [modelProvider, setModelProvider] = useState<'openai' | 'groq'>('openai');
  const [modelName, setModelName] = useState<string>('gpt-4o');
  
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
  });

  const [conversations, setConversations] = useState([
    {
      id: 'default',
      title: 'New Chat',
      lastMessage: 'Welcome to BeagleMind!',
      timestamp: new Date(),
    },
  ]);

  const handleNewChat = () => {
    const newChatId = `chat-${Date.now()}`;
    const newConversation = {
      id: newChatId,
      title: 'New Chat',
      lastMessage: '',
      timestamp: new Date(),
    };
    setConversations([newConversation, ...conversations]);
    setCurrentChatId(newChatId);
    setSidebarOpen(true); // ensure sidebar becomes visible after creating
  };

  const handleSelectChat = (chatId: string) => {
    setCurrentChatId(chatId);
    setSidebarOpen(false);
  };

  const handleSendMessage = (data: { text: string; tool?: string }) => {
    if (data.tool) {
      sendMessage({ 
        text: data.text,
        metadata: { tool: data.tool, provider: modelProvider, model: modelName }
      });
    } else {
      sendMessage({ text: data.text, metadata: { provider: modelProvider, model: modelName } });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Global Navbar */}
      <header className="flex items-center justify-between h-14 md:h-16 px-4 md:px-6 border-b border-neutral-800 bg-neutral-900/95 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/80 z-50 relative">
        <div className="flex items-center gap-2 md:gap-3 select-none">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded overflow-hidden bg-neutral-800 border border-neutral-700">
            <img src="/beagleboard-logo.png" alt="BeagleBoard Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-white tracking-tight">BeagleMind</h1>
            <div className="text-xs md:text-sm text-neutral-400">beagleboard.org</div>
          </div>
        </div>
        <nav className="flex items-center gap-2 md:gap-4 text-sm">
          <Button
            variant={view === 'chat' ? 'default' : 'ghost'}
            className={`h-8 md:h-9 px-3 md:px-4 rounded-md text-xs md:text-sm font-medium ${view === 'chat' ? 'bg-neutral-200 text-neutral-900 hover:bg-white' : 'text-neutral-300 hover:text-white'}`}
            onClick={() => { setView('chat'); }}
          >
            <Menu className="h-4 w-4 md:h-5 md:w-5 mr-1" /> 
            <span className="hidden sm:inline">Chat</span>
          </Button>
          <Button
            variant={view === 'wizard' ? 'default' : 'ghost'}
            className={`h-8 md:h-9 px-3 md:px-4 rounded-md text-xs md:text-sm font-medium inline-flex items-center gap-1 md:gap-2 ${view === 'wizard' ? 'bg-neutral-200 text-neutral-900 hover:bg-white' : 'text-neutral-300 hover:text-white'}`}
            onClick={() => { setView('wizard'); setSidebarOpen(false); }}
          >
            <Wand2 className="h-4 w-4 md:h-5 md:w-5" /> 
            <span className="hidden sm:inline">Wizard</span>
          </Button>
          <div className="hidden lg:block text-neutral-400 text-xs md:text-sm">BeagleBoard AI Assistant</div>
        </nav>
      </header>

      {/* Body Area */}
      <div className="flex-1 relative overflow-hidden">

      


        {/* Main content area (padded left when sidebar open on large screens) */}
        <div className={`h-full flex flex-col transition-all duration-300 ${view === 'chat' ? 'pt-0' : ''}`}>
          {view === 'chat' && (
            <>
              <div className="flex-1 overflow-hidden pt-1 md:pt-2 px-2 md:px-4 lg:pl-6 lg:pr-6">
                <ChatArea
                  messages={messages
                    .filter(m => m.role === 'user' || m.role === 'assistant')
                    .map(m => ({
                      id: m.id,
                      role: m.role as 'user' | 'assistant',
                      parts: Array.isArray(m.parts)
                        ? m.parts
                            .filter(p => 'text' in p && typeof p.text === 'string')
                            .map(p => ({
                              type: typeof p.type === 'string' ? p.type : '',
                              text: (p as { text: string }).text || ''
                            }))
                        : []
                    }))
                  }
                  status={status}
                />
              </div>
              <div className="border-t border-neutral-800 bg-neutral-900/50 px-2 md:px-4 lg:px-6 py-1 md:py-2">
                <ChatInput
                  onSendMessage={handleSendMessage}
                  disabled={status !== 'ready'}
                  status={status}
                  provider={modelProvider}
                  model={modelName}
                  onModelChange={({ provider, model }) => { setModelProvider(provider); setModelName(model); }}
                />
              </div>
            </>
          )}
          {view === 'wizard' && (
            <div className="h-full overflow-hidden"><WizardArea provider={modelProvider} model={modelName} /></div>
          )}
        </div>
      </div>
    </div>
  );
}
