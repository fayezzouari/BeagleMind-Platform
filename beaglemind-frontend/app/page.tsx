"use client";

import { useState, useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Sidebar } from '@/components/sidebar';
import { ChatArea } from '@/components/chat-area';
import { ChatInput } from '@/components/chat-input';
import { WizardArea } from '@/components/wizard-area';
import { Button } from '@/components/ui/button';
import { Menu, Wand2 } from 'lucide-react';

// Session Storage Keys
const STORAGE_KEYS = {
  CONVERSATIONS: 'beaglemind_conversations',
  CURRENT_CHAT_ID: 'beaglemind_current_chat_id',
  MESSAGES: 'beaglemind_messages',
} as const;

// Session Storage Utilities
const sessionStorage = {
  get: function <T>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    try {
      const item = window.sessionStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Error reading from sessionStorage:', error);
      return null;
    }
  },

  set: function <T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error writing to sessionStorage:', error);
    }
  },

  remove: (key: string): void => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from sessionStorage:', error);
    }
  },

  clear: (): void => {
    if (typeof window === 'undefined') return;
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        window.sessionStorage.removeItem(key);
      });
    } catch (error) {
      console.error('Error clearing sessionStorage:', error);
    }
  }
};

// Types
interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messageCount?: number;
}

interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  conversationId: string;
}

export default function BeagleMindApp() {
  const [view, setView] = useState<'chat' | 'wizard'>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string>('default');
  const [modelProvider, setModelProvider] = useState<'openai' | 'groq'>('openai');
  const [modelName, setModelName] = useState<string>('gpt-4o');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [storedMessages, setStoredMessages] = useState<StoredMessage[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const currentChatRef = useRef<string>('default');

  // Load data from session storage on mount
  useEffect(() => {
    const loadFromStorage = () => {
    // Load conversations
    const savedConversations: Conversation[] | null = sessionStorage.get(STORAGE_KEYS.CONVERSATIONS);
    if (savedConversations) {
      const parsedConversations = savedConversations.map((conv: Conversation) => ({
        ...conv,
        timestamp: new Date(conv.timestamp)
      }));
      setConversations(parsedConversations);
    } else {
      // Default conversation if none saved
      const defaultConversation: Conversation = {
        id: 'default',
        title: 'New Chat',
        lastMessage: 'Welcome to BeagleMind!',
        timestamp: new Date(),
        messageCount: 0
      };
      setConversations([defaultConversation]);
    }

    // Load current chat ID
    const savedCurrentChatId: string | null = sessionStorage.get(STORAGE_KEYS.CURRENT_CHAT_ID);
    if (savedCurrentChatId) {
      setCurrentChatId(savedCurrentChatId);
      currentChatRef.current = savedCurrentChatId;
    }

    // Load stored messages
    const savedMessages: StoredMessage[] | null = sessionStorage.get(STORAGE_KEYS.MESSAGES);
    if (savedMessages) {
      setStoredMessages(savedMessages);
    }      setIsLoaded(true);
    };

    loadFromStorage();
  }, []);

  // Save conversations to session storage whenever they change
  useEffect(() => {
    if (isLoaded && conversations.length > 0) {
      sessionStorage.set(STORAGE_KEYS.CONVERSATIONS, conversations);
    }
  }, [conversations, isLoaded]);

  // Save current chat ID to session storage
  useEffect(() => {
    if (isLoaded) {
      sessionStorage.set(STORAGE_KEYS.CURRENT_CHAT_ID, currentChatId);
    }
  }, [currentChatId, isLoaded]);

  // Save messages to session storage
  useEffect(() => {
    if (isLoaded && storedMessages.length > 0) {
      sessionStorage.set(STORAGE_KEYS.MESSAGES, storedMessages);
    }
  }, [storedMessages, isLoaded]);

  // Clear session storage on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.clear();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
    onFinish: () => {
      // Only sync if we have messages from the current session and they belong to current conversation
      if (messages.length > 0 && currentChatRef.current === currentChatId) {
        // Sync all current messages to stored messages for the current conversation
        const currentConversationMessages = messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: Array.isArray(m.parts)
              ? m.parts
                  .filter((p: unknown) => {
                    const part = p as Record<string, unknown>;
                    return typeof part === 'object' && part !== null && 'text' in part && typeof part.text === 'string';
                  })
                  .map((p: unknown) => {
                    const part = p as { text: string };
                    return part.text;
                  })
                  .join('')
              : '',
            timestamp: Date.now(),
            conversationId: currentChatId
          }));

        // Replace stored messages for current conversation
        setStoredMessages(prev => [
          ...prev.filter(m => m.conversationId !== currentChatId),
          ...currentConversationMessages
        ]);

        // Update conversation's last message and count
        const lastMessage = currentConversationMessages[currentConversationMessages.length - 1];
        if (lastMessage) {
          setConversations(prev => prev.map(conv => {
            if (conv.id === currentChatId) {
              return {
                ...conv,
                lastMessage: lastMessage.content.slice(0, 50) + (lastMessage.content.length > 50 ? '...' : ''),
                messageCount: currentConversationMessages.length
              };
            }
            return conv;
          }));
        }
      }
    }
  });  const handleNewChat = () => {
    const newChatId = `chat-${Date.now()}`;
    const newConversation: Conversation = {
      id: newChatId,
      title: 'New Chat',
      lastMessage: '',
      timestamp: new Date(),
      messageCount: 0
    };
    setConversations(prev => [newConversation, ...prev]);
    setCurrentChatId(newChatId);
    currentChatRef.current = newChatId;
    setSidebarOpen(true); // ensure sidebar becomes visible after creating
  };

  const handleSelectChat = (chatId: string) => {
    // If switching to a different conversation, we need to handle the transition
    const isDifferentConversation = currentChatRef.current !== chatId;
    
    if (isDifferentConversation && messages.length > 0) {
      // Save current conversation messages before switching
      const currentConversationMessages = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: Array.isArray(m.parts)
            ? m.parts
                .filter((p: unknown) => {
                  const part = p as Record<string, unknown>;
                  return typeof part === 'object' && part !== null && 'text' in part && typeof part.text === 'string';
                })
                .map((p: unknown) => {
                  const part = p as { text: string };
                  return part.text;
                })
                .join('')
            : '',
          timestamp: Date.now(),
          conversationId: currentChatRef.current
        }));

      setStoredMessages(prev => [
        ...prev.filter(m => m.conversationId !== currentChatRef.current),
        ...currentConversationMessages
      ]);
    }

    setCurrentChatId(chatId);
    currentChatRef.current = chatId;
    setSidebarOpen(false);
  };

  const handleSendMessage = (data: { text: string; tool?: string }) => {
    // Send message to AI - let useChat handle the user message
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
            onClick={() => { setView('chat'); setSidebarOpen(!sidebarOpen); }}
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
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="absolute left-0 top-0 h-full z-40">
            <Sidebar
              conversations={conversations}
              currentChatId={currentChatId}
              onNewChat={handleNewChat}
              onSelectChat={handleSelectChat}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        )}

      


        {/* Main content area (padded left when sidebar open on large screens) */}
        <div className={`h-full flex flex-col transition-all duration-300 ${view === 'chat' ? 'pt-0' : ''} ${sidebarOpen ? 'lg:ml-80' : ''}`}>
          {view === 'chat' && (
            <>
              <div className="flex-1 overflow-hidden pt-1 md:pt-2 px-2 md:px-4 lg:pl-6 lg:pr-6">
                <ChatArea
                  messages={
                    // If we have current messages from useChat and they belong to current conversation
                    messages.length > 0 && currentChatRef.current === currentChatId
                      ? messages
                          .filter(m => m.role === 'user' || m.role === 'assistant')
                          .map(m => ({
                            id: m.id,
                            role: m.role as 'user' | 'assistant',
                            parts: Array.isArray(m.parts)
                              ? m.parts
                                  .filter((p: unknown) => {
                                    const part = p as Record<string, unknown>;
                                    return typeof part === 'object' && part !== null && 'text' in part && typeof part.text === 'string';
                                  })
                                  .map((p: unknown) => {
                                    const part = p as Record<string, unknown>;
                                    return {
                                      type: typeof part.type === 'string' ? part.type : '',
                                      text: (part as { text: string }).text || ''
                                    };
                                  })
                              : []
                          }))
                      : // Otherwise, show stored messages for current conversation
                        storedMessages
                          .filter((m: StoredMessage) => m.conversationId === currentChatId)
                          .map((m: StoredMessage) => ({
                            id: m.id,
                            role: m.role,
                            parts: [{ type: 'text' as const, text: m.content }]
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
