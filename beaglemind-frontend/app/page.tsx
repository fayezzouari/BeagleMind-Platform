"use client";

import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Sidebar } from '@/components/sidebar';
import { ChatArea } from '@/components/chat-area';
import { ChatInput } from '@/components/chat-input';
import { WizardArea } from '@/components/wizard-area';
import { Button } from '@/components/ui/button';
import { Menu, Wand2, ArrowLeftCircle, ArrowRightCircle } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function BeagleMindApp() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/login');
    }
  }, [authStatus, router]);

  const [view, setView] = useState<'chat' | 'wizard'>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string>('default');
  const [modelProvider, setModelProvider] = useState<'openai' | 'groq'>('openai');
  const [modelName, setModelName] = useState<string>('gpt-4o');
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  
  const [chatKey, setChatKey] = useState<string>(() => `chat-${Date.now()}`);
  const { messages, sendMessage, status, stop } = useChat({
    id: chatKey,
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    onFinish: async ({ message }) => {
      // When first assistant message in a thread arrives, create/save conversation and name it
      try {
  const userMsg = [...messages].reverse().find((mm) => mm.role === 'user');
        // Determine existing conversation id, if any
        const existingId = createdConvIdRef.current || (currentChatIdRef.current && currentChatIdRef.current !== 'default' ? currentChatIdRef.current : undefined);
        // Create conversation if none exists yet for this thread
        if (!existingId) {
          const userText = userMsg ? toTextParts(userMsg.parts).map(p => p.text).join(' ') : (pendingFirstMessageRef.current || '');
          const assistantText = toTextParts(message.parts).map(p => p.text).join(' ');
          const title = await proposeTitle(userText || 'New Chat', assistantText || '');
          const resp = await fetch(`/api/conversations/create`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, first_message: userText })
          });
          const data = await resp.json();
          if (data?.id) {
            const newChatId = data.id as string;
            setCurrentChatId(newChatId);
            createdConvIdRef.current = newChatId;
            // add to local list
            setConversations((prev) => [{ id: newChatId, title, lastMessage: '', timestamp: new Date() }, ...prev.filter(c=>c.id!=='default')]);
            // clear pending first message now that it's been attached to the conversation
            pendingFirstMessageRef.current = null;
          }
        }
        // Append the last user and assistant messages
  const lastUser = userMsg ? [{ role: 'user', content: toTextParts(userMsg.parts).map(p => p.text).join(' ') }] : [];
  const lastAssistant = [{ role: 'assistant', content: toTextParts(message.parts).map(p => p.text).join(' ') }];
        const convId = createdConvIdRef.current || (currentChatIdRef.current && currentChatIdRef.current !== 'default' ? currentChatIdRef.current : undefined);
        if (convId) {
          await fetch(`/api/conversations/append`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conversation_id: convId, messages: [...lastUser, ...lastAssistant], last_preview: lastAssistant[0].content.slice(0, 200) })
          });
          // update local conversation preview/time
          setConversations((prev) => prev.map(c => c.id === convId ? { ...c, lastMessage: lastAssistant[0].content, timestamp: new Date() } : c));
        }
      } catch {}
    }
  });

  async function proposeTitle(userText: string, assistantText: string): Promise<string> {
    const base = (userText || assistantText || '').trim();
    // Simple heuristic if model title route not implemented client-side
    if (!base) return 'New Chat';
    const first = base.split(/[\.\n]/)[0];
    return (first.length > 60 ? first.slice(0, 57) + '…' : first) || 'New Chat';
  }

  function toTextParts(parts: unknown): Array<{ type: string; text: string }> {
    if (!Array.isArray(parts)) return [];
    const out: Array<{ type: string; text: string }> = [];
    for (const p of parts) {
      if (p && typeof p === 'object' && 'text' in p) {
        const text = (p as { text?: unknown }).text;
        if (typeof text === 'string') {
          const typeVal = (p as { type?: unknown }).type;
          out.push({ type: typeof typeVal === 'string' ? typeVal : 'text', text });
        }
      }
    }
    return out;
  }

  const [conversations, setConversations] = useState<{
    id: string; title: string; lastMessage: string; timestamp: Date;
  }[]>([]);
  // Track created conversation id and the latest currentChatId across closures
  const createdConvIdRef = useRef<string | null>(null);
  const currentChatIdRef = useRef<string>(currentChatId);
  const pendingFirstMessageRef = useRef<string | null>(null);
  useEffect(() => { currentChatIdRef.current = currentChatId; }, [currentChatId]);

  // Load conversations for the user on mount
  useEffect(() => {
    const load = async () => {
      try {
  type SessionWithSub = typeof session & { user_sub?: string };
  const s = session as SessionWithSub | null;
  if (!session?.user?.email && !s?.user_sub) return;
  const resp = await fetch(`/api/conversations/list`, { method: 'POST' });
        const data = await resp.json();
        const items = (data?.items || []) as Array<{ id: string; title: string; lastMessage: string; updated_at?: string }>;
        setConversations(items.map(i => ({ id: i.id, title: i.title || 'Untitled', lastMessage: i.lastMessage || '', timestamp: i.updated_at ? new Date(i.updated_at) : new Date() })));
      } catch {}
    };
    load();
  }, [session]);

  const handleNewChat = () => {
    // Reset to a new thread: keep temporary id until first assistant message creates server-side record
  // Clear any history view, stop any running generation, reset refs and chat key.
  setHistoryView(null);
  stop();
  setCurrentChatId('default');
  currentChatIdRef.current = 'default';
  createdConvIdRef.current = null;
  setChatKey(`chat-${Date.now()}`); // reset useChat state
  // Do not auto-open sidebar on mobile; keep it hidden in responsive view by default
  setSidebarOpen(false);
  };

  const [historyView, setHistoryView] = useState<{ convId: string; items: Array<{ id: string; role: 'user'|'assistant'; parts: Array<{ type: string; text: string }> }> } | null>(null);
  const handleSelectChat = async (chatId: string) => {
  setCurrentChatId(chatId);
  currentChatIdRef.current = chatId;
    setSidebarOpen(false);
    try {
      // Load messages and replace current UI messages with that history
  const resp = await fetch(`/api/conversations/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation_id: chatId }) });
      const data = await resp.json();
  const items = (data?.items || []) as Array<{ role: 'user'|'assistant'; content: string; id?: string }>;
  const uiItems = items.map((it, idx) => ({ id: it.id || `${chatId}-${idx}`, role: it.role, parts: [{ type: 'text', text: it.content }] }));
      // Show history view and allow resume
      setHistoryView({ convId: chatId, items: uiItems });
      // Prepare chat hook to resume into this conversation id on next message
      createdConvIdRef.current = chatId;
      setChatKey(`chat-${chatId}`);
    } catch {}
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
  const resp = await fetch('/api/conversations/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation_id: chatId }) });
  const data = await resp.json();
  console.info('delete response', resp.status, data);
  if (!resp.ok) return;
  // remove from local list
  setConversations((prev) => prev.filter(c => c.id !== chatId));
      // if it was the current conversation, reset to default
      if (currentChatIdRef.current === chatId) {
        setCurrentChatId('default');
        currentChatIdRef.current = 'default';
        createdConvIdRef.current = null;
        setChatKey(`chat-${Date.now()}`);
        setHistoryView(null);
      }
      // optional: show server deletion counts
      if (data?.result) {
        console.info('deleted', data.result.deleted_conversation, 'conversation(s),', data.result.deleted_messages, 'messages');
      }
    } catch (err) {}
  };

  const handleSendMessage = async (data: { text: string; tool?: string }) => {
    // Persist the user message: if this thread already has a conversation id, append it;
    // otherwise save it as the conversation first message so it appears in history later.
    const convId = createdConvIdRef.current || (currentChatIdRef.current && currentChatIdRef.current !== 'default' ? currentChatIdRef.current : undefined);
    try {
      if (convId) {
        // append the single user message
        fetch('/api/conversations/append', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversation_id: convId, messages: [{ role: 'user', content: data.text }], last_preview: data.text.slice(0, 200) })
        }).catch(() => {});
        // update local preview/time
        setConversations((prev) => prev.map(c => c.id === convId ? { ...c, lastMessage: data.text, timestamp: new Date() } : c));
      } else {
        // no conversation yet: keep pending first message locally and attach it when the assistant replies
        pendingFirstMessageRef.current = data.text;
      }
    } catch (err) {
      // ignore persistence errors; we still send the message to the model
    }

    // Send the message to the chat transport (do this after initiating persistence)
    if (data.tool) {
      sendMessage({ 
        text: data.text,
        metadata: { tool: data.tool, provider: modelProvider, model: modelName }
      });
    } else {
      sendMessage({ text: data.text, metadata: { provider: modelProvider, model: modelName } });
    }
  };

  // Loading gate while checking session
  if (authStatus === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950 text-slate-200">
        <div className="animate-pulse text-sm opacity-80">Loading your session…</div>
      </div>
    );
  }

  return (
  <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
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
            </div>
          )}

          {/* Toggle arrow button (mobile) - only show on chat view */}
          {view === 'chat' && (
          <button
            aria-label="Toggle history sidebar"
            className="fixed left-3 top-24 z-50 inline-flex items-center justify-center h-8 w-8 rounded-full border border-neutral-800 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 shadow lg:hidden"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            {sidebarOpen ? <ArrowLeftCircle className="h-5 w-5" /> : <ArrowRightCircle className="h-5 w-5" />}
          </button>
          )}

          {/* Main content */}
          <div className={`flex-1 flex flex-col transition-all duration-300 ${view === 'chat' ? 'pt-0' : ''} w-full md:w-auto`}> 
            {view === 'chat' && (
              <>
                <div className="flex-1 overflow-hidden pt-2 px-2 sm:px-4 md:pl-6 md:pr-6">
                  <div className="mb-2">
                    {historyView && (
                      <div className="flex items-center justify-between rounded-md border border-amber-600/40 bg-amber-900/20 px-3 py-2 text-amber-200">
                        <div className="text-xs">Viewing previous conversation</div>
                        <Button size="sm" className="h-7 px-3 bg-neutral-200 text-neutral-900 hover:bg-white" onClick={() => { setHistoryView(null); stop(); }}>
                          Resume chat
                        </Button>
                      </div>
                    )}
                  </div>
                  <ChatArea
                    messages={(historyView ? historyView.items : messages
                      .filter(m => m.role === 'user' || m.role === 'assistant')
                      .map(m => ({
                        id: m.id,
                        role: m.role as 'user' | 'assistant',
                        parts: toTextParts(m.parts)
                      }))
                    )}
                    status={status}
                  />
                </div>
                <div className="border-t border-neutral-800 bg-neutral-900/50 px-2 sm:px-4 md:px-6 py-2">
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
              <div className="h-full w-full overflow-auto"><WizardArea provider={modelProvider} model={modelName} /></div>
            )}
          </div>
        </div>
        {/* Sign out confirmation modal */}
        {showSignOutConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSignOutConfirm(false)} />
            {/* Dialog */}
            <div className="relative z-[101] w-full max-w-sm mx-auto rounded-xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
              <h3 className="text-lg font-semibold text-white">Sign out?</h3>
              <p className="mt-2 text-sm text-neutral-300">You’ll be returned to the login page.</p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <Button variant="ghost" className="text-neutral-300 hover:text-white" onClick={() => setShowSignOutConfirm(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-500 text-white"
                  onClick={() => {
                    setShowSignOutConfirm(false);
                    signOut({ callbackUrl: '/login' });
                  }}
                >
                  Sign out
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
