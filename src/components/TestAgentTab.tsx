import { useState, useRef, useEffect } from 'react';
import { Send, RefreshCw, MessageCircle, X, Check, Database, UserCheck } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type SideEventType = 'ugc_update' | 'human_handoff';

interface SideEvent {
  type: SideEventType;
  fields: Record<string, string>;
  timestamp: string;
}

type ChatState = 'idle' | 'starting' | 'active' | 'loading';

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function SideEventCard({ event, index }: { event: SideEvent; index: number }) {
  const entries = Object.entries(event.fields);
  const isHandoff = event.type === 'human_handoff';

  return (
    <div
      className="rounded-xl border p-3"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: isHandoff ? '#fdba74' : '#86efac',
        animation: `msgSlideIn 0.25s ease-out ${index * 0.05}s both`,
      }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        {isHandoff ? (
          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-orange-400">
            <UserCheck className="w-3 h-3 text-white" strokeWidth={2.5} />
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-emerald-500">
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        )}
        <span className={`text-xs font-bold ${isHandoff ? 'text-orange-500' : 'text-emerald-600'}`}>
          {isHandoff ? 'Derivado con un humano' : 'Información actualizada correctamente'}
        </span>
      </div>
      {entries.length > 0 && (
        <div className="space-y-1">
          {entries.map(([key, value]) => (
            <div key={key} className="flex gap-1.5 text-xs">
              <span className="font-semibold flex-shrink-0" style={{ color: 'var(--color-text-2)' }}>
                {key}:
              </span>
              <span className="break-all" style={{ color: 'var(--color-text-1)' }}>
                {String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
      {event.timestamp && (
        <p className="text-[10px] mt-2" style={{ color: 'var(--color-text-3)' }}>
          {formatTime(event.timestamp)}
        </p>
      )}
    </div>
  );
}

export default function TestAgentTab() {
  const [chatState, setChatState] = useState<ChatState>('idle');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sideEvents, setSideEvents] = useState<SideEvent[]>([]);
  const [input, setInput] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackState, setFeedbackState] = useState<'idle' | 'loading' | 'sent'>('idle');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const feedbackRef = useRef<HTMLTextAreaElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Scroll to bottom on new messages / typing
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatState]);

  // Auto-focus feedback textarea
  useEffect(() => {
    if (showFeedback) setTimeout(() => feedbackRef.current?.focus(), 50);
  }, [showFeedback]);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => { eventSourceRef.current?.close(); };
  }, []);

  const connectSSE = (convId: string) => {
    eventSourceRef.current?.close();
    const es = new EventSource(`/api/agent/conversations/${convId}/events`);
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ugc_update' || data.type === 'human_handoff') {
          setSideEvents(prev => [...prev, { type: data.type, fields: data.fields ?? {}, timestamp: data.timestamp }]);
        }
      } catch { /* ignore malformed events */ }
    };
    eventSourceRef.current = es;
  };

  const startNewChat = async () => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setChatState('starting');
    setMessages([]);
    setConversationId(null);
    setUserName(null);
    setSideEvents([]);
    setFeedbackState('idle');
    setFeedbackText('');

    try {
      const res = await fetch('/api/agent/conversations', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConversationId(data.conversationId);
      setUserName(data.userName ?? null);
      setMessages([{ role: 'assistant', content: data.greeting }]);
      setChatState('active');
      connectSSE(data.conversationId);
      setTimeout(() => textareaRef.current?.focus(), 100);
    } catch (err) {
      console.error('Error starting conversation:', err);
      setChatState('idle');
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || chatState !== 'active' || !conversationId) return;

    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setChatState('loading');

    try {
      const res = await fetch(`/api/agent/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, userName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Hubo un error al procesar tu mensaje. Intentalo de nuevo.' },
      ]);
    } finally {
      setChatState('active');
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const sendFeedback = async () => {
    if (!feedbackText.trim() || !conversationId) return;
    setFeedbackState('loading');
    try {
      const res = await fetch(`/api/agent/conversations/${conversationId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedbackText }),
      });
      if (!res.ok) throw new Error('Error al guardar el feedback');
      setFeedbackState('sent');
      setTimeout(() => setShowFeedback(false), 1800);
    } catch (err) {
      console.error('Error sending feedback:', err);
      setFeedbackState('idle');
    }
  };

  const isIdle     = chatState === 'idle';
  const isStarting = chatState === 'starting';
  const isLoading  = chatState === 'loading';
  const canSend    = chatState === 'active' && input.trim().length > 0;
  const hasUpdates = sideEvents.length > 0;

  // ── Empty state ──────────────────────────────────────────────────────
  if (isIdle) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-8 p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: 'var(--color-brand-light)' }}>
            <MessageCircle className="w-8 h-8" style={{ color: 'var(--color-brand)' }} />
          </div>
          <h2 className="text-xl font-black mb-2" style={{ color: 'var(--color-text-1)' }}>Test Agent</h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-2)' }}>
            Simulá una conversación con el agente de prospección como si fueras un creador UGC.
            Evaluá el tono, las preguntas y el flujo antes de salir al campo.
          </p>
        </div>
        <button
          onClick={startNewChat}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm transition-all active:scale-[0.97]"
          style={{ backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }}
        >
          <RefreshCw className="w-4 h-4" />
          Empezar nuevo chat
        </button>
      </div>
    );
  }

  // ── Active chat ──────────────────────────────────────────────────────
  return (
    <div className="h-full flex overflow-hidden" style={{ backgroundColor: 'var(--color-bg-app)' }}>

      {/* ── Chat column ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center min-w-0 overflow-hidden">

        {/* Action bar */}
        <div className="w-full max-w-2xl flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"
              style={{ animation: 'pulseGreen 2s ease-in-out infinite' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--color-text-2)' }}>Sesión activa</span>
            {conversationId && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md"
                style={{ backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-3)' }}>
                {conversationId.slice(-10)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowFeedback(true); setFeedbackText(''); setFeedbackState('idle'); }}
              disabled={!conversationId}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-[0.97] disabled:opacity-40"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)', backgroundColor: 'var(--color-surface)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface)'}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Dar feedback
            </button>
            <button
              onClick={startNewChat}
              disabled={isStarting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-70"
              style={{ backgroundColor: 'var(--color-brand)' }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isStarting ? 'animate-spin' : ''}`} />
              Nuevo chat
            </button>
          </div>
        </div>

        {/* Chat window */}
        <div
          className="w-full max-w-2xl flex flex-col rounded-2xl border mx-4 overflow-hidden"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border-subtle)',
            flex: '1 1 0',
            minHeight: 0,
          }}
        >
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3" style={{ minHeight: 0 }}>

            {isStarting && (
              <div className="flex items-center justify-center h-full">
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: 'var(--color-brand)', animation: `typingBounce 1.1s ease-in-out ${i * 0.18}s infinite` }} />
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                style={{ animation: 'msgSlideIn 0.22s ease-out both' }}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mr-2.5 mt-0.5 text-[11px] font-black text-white"
                    style={{ backgroundColor: 'var(--color-brand)' }}>
                    AI
                  </div>
                )}
                <div
                  className="max-w-[76%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
                  style={msg.role === 'user'
                    ? { backgroundColor: 'var(--color-brand)', color: '#fff', borderRadius: '16px 16px 4px 16px' }
                    : { backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-1)', borderRadius: '16px 16px 16px 4px' }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex flex-col gap-1.5" style={{ animation: 'msgSlideIn 0.22s ease-out both' }}>
                <div className="flex justify-start">
                  <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mr-2.5 mt-0.5 text-[11px] font-black text-white"
                    style={{ backgroundColor: 'var(--color-brand)' }}>
                    AI
                  </div>
                  <div className="px-4 py-3 flex items-center gap-1.5"
                    style={{ backgroundColor: 'var(--color-surface-alt)', borderRadius: '16px 16px 16px 4px' }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: 'var(--color-text-3)', animation: `typingBounce 1.1s ease-in-out ${i * 0.18}s infinite` }} />
                    ))}
                  </div>
                </div>
                <p className="text-[10px] ml-11" style={{ color: 'var(--color-text-3)' }}>
                  El agente está procesando tu mensaje…
                </p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 p-4 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <div className="flex items-end gap-3 rounded-xl border px-4 py-3 transition-all duration-150"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-app)' }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder={isLoading ? 'Esperando respuesta...' : 'Escribí tu mensaje...'}
                disabled={chatState !== 'active'}
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm outline-none leading-relaxed disabled:opacity-50"
                style={{ color: 'var(--color-text-1)', maxHeight: '120px', fontFamily: 'var(--font-sans)' }}
              />
              <button
                onClick={sendMessage}
                disabled={!canSend}
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-150 active:scale-[0.90] disabled:opacity-30"
                style={{ backgroundColor: 'var(--color-brand)', color: '#fff' }}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-center mt-2" style={{ color: 'var(--color-text-3)' }}>
              Enter para enviar · Shift+Enter para nueva línea
            </p>
          </div>
        </div>
      </div>

      {/* ── UGC updates panel ────────────────────────────────────────── */}
      {hasUpdates && (
        <div
          className="w-72 flex-shrink-0 flex flex-col border-l overflow-hidden"
          style={{
            borderColor: 'var(--color-border-subtle)',
            backgroundColor: 'var(--color-bg-app)',
            animation: 'slideInRight 0.28s ease-out both',
          }}
        >
          {/* Panel header */}
          <div className="px-4 py-3 border-b flex-shrink-0 flex items-center gap-2"
            style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-surface)' }}>
            <Database className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--color-text-3)' }} />
            <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-2)' }}>
              Actividad del agente
            </p>
            <span className="ml-auto text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md"
              style={{ backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-2)' }}>
              {sideEvents.length}
            </span>
          </div>

          {/* Cards */}
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
            {sideEvents.map((event, i) => (
              <SideEventCard key={i} event={event} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* ── Feedback modal ────────────────────────────────────────────── */}
      {showFeedback && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowFeedback(false); }}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-6 border"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              boxShadow: 'var(--shadow-modal)',
              animation: 'modalIn 0.2s ease-out both',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-base" style={{ color: 'var(--color-text-1)' }}>Feedback del chat</h3>
              <button
                onClick={() => setShowFeedback(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                style={{ color: 'var(--color-text-3)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {conversationId && (
              <p className="text-[11px] font-mono mb-3" style={{ color: 'var(--color-text-3)' }}>
                Chat: {conversationId}
              </p>
            )}
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-2)' }}>
              ¿Qué te pareció la conversación? Tu feedback ayuda a mejorar el agente de prospección.
            </p>
            {feedbackState === 'sent' ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#dcfce7' }}>
                  <Check className="w-6 h-6 text-emerald-600" />
                </div>
                <p className="font-semibold text-sm" style={{ color: 'var(--color-text-1)' }}>¡Gracias por tu feedback!</p>
              </div>
            ) : (
              <>
                <textarea
                  ref={feedbackRef}
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  placeholder="Contanos qué te pareció: el tono, las preguntas, la fluidez, lo que se podría mejorar..."
                  rows={5}
                  className="w-full rounded-xl border p-3 text-sm resize-none outline-none transition-all"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-app)', color: 'var(--color-text-1)', fontFamily: 'var(--font-sans)' }}
                />
                <div className="flex gap-2 mt-4 justify-end">
                  <button
                    onClick={() => setShowFeedback(false)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all active:scale-[0.97]"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-2)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={sendFeedback}
                    disabled={!feedbackText.trim() || feedbackState === 'loading'}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-brand)' }}
                  >
                    {feedbackState === 'loading' ? 'Enviando...' : 'Enviar feedback'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
