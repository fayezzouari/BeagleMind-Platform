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
        metadata: { tool: data.tool }
      });
    } else {
      sendMessage({ text: data.text });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Global Navbar */}
      <header className="flex items-center justify-between h-20 px-8 border-b border-neutral-800 bg-neutral-900/95 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/80 z-50 relative">
        <div className="flex items-center gap-4 select-none">
          <div className="w-12 h-12 rounded overflow-hidden bg-neutral-800 border border-neutral-700">
            <img src="/beagleboard-logo.png" alt="BeagleBoard Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">BeagleMind</h1>
            <div className="text-sm text-neutral-400">beagleboard.org</div>
          </div>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Button
            variant={view === 'chat' ? 'default' : 'ghost'}
            className={`h-10 px-5 rounded-md text-sm font-medium ${view === 'chat' ? 'bg-neutral-200 text-neutral-900 hover:bg-white' : 'text-neutral-300 hover:text-white'}`}
            onClick={() => { setView('chat'); }}
          >
            <Menu className="h-5 w-5 mr-1" /> Chat
          </Button>
          <Button
            variant={view === 'wizard' ? 'default' : 'ghost'}
            className={`h-10 px-5 rounded-md text-sm font-medium inline-flex items-center gap-2 ${view === 'wizard' ? 'bg-neutral-200 text-neutral-900 hover:bg-white' : 'text-neutral-300 hover:text-white'}`}
            onClick={() => { setView('wizard'); setSidebarOpen(false); }}
          >
            <Wand2 className="h-5 w-5" /> Wizard
          </Button>
          <div className="hidden md:block text-neutral-400 text-sm">BeagleBoard AI Assistant</div>
        </nav>
      </header>

      {/* Body Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Sidebar (chat only) */}
        {view === 'chat' && (
          <div className={`fixed inset-y-20 top-20 left-0 z-40 w-80 transform transition-transform duration-300 ease-in-out bg-slate-950 border-r border-neutral-800 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <Sidebar
              conversations={conversations}
              currentChatId={currentChatId}
              onNewChat={handleNewChat}
              onSelectChat={handleSelectChat}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        )}

        {/* Floating Sidebar Toggle (chat only) */}
    {view === 'chat' && (
          <button
            onClick={() => setSidebarOpen(o => !o)}
            aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
      className={`group absolute top-24 z-50 h-10 w-10 flex items-center justify-center rounded-full border border-neutral-700 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white shadow-md backdrop-blur transition-all duration-300 ${sidebarOpen ? 'left-[300px]' : 'left-2'}`}
          >
      {sidebarOpen ? <ChevronLeft className="h-6 w-6" /> : <ChevronRight className="h-6 w-6" />}
          </button>
        )}

        {/* Overlay when sidebar open on small screens */}
    {view === 'chat' && sidebarOpen && (
          <div
      className="fixed inset-0 top-20 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content area (padded left when sidebar open on large screens) */}
        <div className={`h-full flex flex-col transition-all duration-300 ${view === 'chat' ? 'pt-0' : ''}`}>
          {view === 'chat' && (
            <>
              <div className="flex-1 overflow-hidden pt-2 px-4 md:pl-6 md:pr-6">
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
              <div className="border-t border-neutral-800 bg-neutral-900/50 px-4 md:px-6 py-2">
                <ChatInput
                  onSendMessage={handleSendMessage}
                  disabled={status !== 'ready'}
                  status={status}
                />
              </div>
            </>
          )}
          {view === 'wizard' && (
            <div className="h-full overflow-hidden"><WizardArea /></div>
          )}
        </div>
      </div>
    </div>
  );
}
