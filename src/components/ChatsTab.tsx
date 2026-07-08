import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, Send, MessageSquare, Instagram, Mail, X, Plus,
  User, Check, AlertCircle, Smile, ArrowLeft
} from 'lucide-react';
import type { UGC, Mensaje, Canal } from '../data';
import { avatarColor, getInitials } from '../utils';
import { sendCreatorMessage } from '../api';

interface Props {
  ugcs: UGC[];
  onUpdateUGC: (ugc: UGC) => void;
}

// Mobile/tablet (<lg) master-detail navigation: only one panel is visible at a time
type MobilePanel = 'lista' | 'conversacion' | 'perfil';

const CANAL_CONFIG: Record<string, { icon: React.ComponentType<any>; color: string; label: string; bg: string; border: string }> = {
  WhatsApp: { icon: MessageSquare, color: '#16a34a', label: 'WhatsApp', bg: 'rgba(22, 163, 74, 0.08)', border: 'rgba(22, 163, 74, 0.2)' },
  Instagram: { icon: Instagram, color: '#9333ea', label: 'Instagram Direct', bg: 'rgba(147, 51, 234, 0.08)', border: 'rgba(147, 51, 234, 0.2)' },
  Email: { icon: Mail, color: '#0284c7', label: 'Correo Electrónico', bg: 'rgba(2, 132, 199, 0.08)', border: 'rgba(2, 132, 199, 0.2)' },
  TikTok: { icon: MessageSquare, color: '#000000', label: 'TikTok Direct', bg: 'rgba(0, 0, 0, 0.05)', border: 'rgba(0, 0, 0, 0.15)' },
};

function getCanalConfig(canal: string) {
  return CANAL_CONFIG[canal] || CANAL_CONFIG['Instagram'];
}

// Helper to parse relative mock date strings into milliseconds for sorting
function getUgcLastMsgTime(u: UGC): number {
  if (!u.conversacion || u.conversacion.length === 0) return 0;
  const lastMsg = u.conversacion[u.conversacion.length - 1];
  
  // Custom timestamp we inject for new messages
  if ((lastMsg as any).timestamp) {
    return (lastMsg as any).timestamp;
  }
  
  const str = (lastMsg.fecha || '').toLowerCase();
  if (str.includes('ahora') || str.includes('justo')) return Date.now();
  if (str.includes('minuto')) {
    const m = parseInt(str.match(/\d+/)?.[0] || '1', 10);
    return Date.now() - m * 60 * 1000;
  }
  if (str.includes('hora')) {
    const h = parseInt(str.match(/\d+/)?.[0] || '1', 10);
    return Date.now() - h * 60 * 60 * 1000;
  }
  if (str.includes('ayer')) return Date.now() - 24 * 60 * 60 * 1000;
  if (str.includes('día') || str.includes('dia')) {
    const d = parseInt(str.match(/\d+/)?.[0] || '1', 10);
    return Date.now() - d * 24 * 60 * 60 * 1000;
  }
  return 0; // very old fallback
}

export default function ChatsTab({ ugcs, onUpdateUGC }: Props) {
  const { ugcId } = useParams<{ ugcId?: string }>();
  const navigate = useNavigate();
  const selectedUgcId = ugcId ?? null;

  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') ?? '';
  const filterType = (searchParams.get('filter') as 'all' | 'unread' | null) ?? 'all';

  function updateParams(patch: Record<string, string | null>, opts?: { replace?: boolean }) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(patch).forEach(([k, v]) => {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      });
      return next;
    }, opts);
  }

  const [inputText, setInputText] = useState('');
  const [newTagText, setNewTagText] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Mobile (<lg) panel navigation: start on the conversation panel when a chat
  // is already preselected via deep-link (e.g. /chats/:ugcId), otherwise the list.
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(() => (ugcId ? 'conversacion' : 'lista'));

  // If the selection is cleared (deselect / navigate away from a chat), fall back to the list on mobile
  useEffect(() => {
    if (!selectedUgcId) {
      setMobilePanel('lista');
    }
  }, [selectedUgcId]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll messages list
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedUgcId, ugcs]);

  // Find currently active UGC
  const activeUgc = useMemo(() => {
    if (!selectedUgcId) return null;
    return ugcs.find(u => u.id === selectedUgcId) || null;
  }, [selectedUgcId, ugcs]);

  // Mark active chat as read on select
  useEffect(() => {
    if (activeUgc && activeUgc.unread) {
      onUpdateUGC({ ...activeUgc, unread: false });
    }
  }, [selectedUgcId]);

  // Handle send message
  function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!activeUgc || !inputText.trim()) return;

    const texto = inputText.trim();
    const newMsg: Mensaje & { timestamp: number } = {
      id: `msg-${Date.now()}`,
      tipo: 'saliente',
      texto,
      fecha: 'ahora mismo',
      timestamp: Date.now(),
    };

    onUpdateUGC({
      ...activeUgc,
      unread: false,
      conversacion: [...activeUgc.conversacion, newMsg],
    });

    setInputText('');

    sendCreatorMessage(activeUgc.id, 'saliente', texto, 'ahora mismo')
      .catch(err => console.error('[ChatsTab] Failed to persist message:', err));
  }

  // Handle updating creator description/bio
  function handleSaveBio(newBio: string) {
    if (!activeUgc) return;
    onUpdateUGC({ ...activeUgc, bio: newBio });
    
    setSaveStatus('Guardado');
    setTimeout(() => setSaveStatus(null), 2000);
  }

  // Handle adding tags
  function handleAddTag() {
    if (!activeUgc || !newTagText.trim()) return;
    const cleanTag = newTagText.trim();
    const currentTags = activeUgc.etiquetas || [];
    
    if (!currentTags.includes(cleanTag)) {
      onUpdateUGC({
        ...activeUgc,
        etiquetas: [...currentTags, cleanTag]
      });
    }
    setNewTagText('');
  }

  // Handle removing tags
  function handleRemoveTag(tag: string) {
    if (!activeUgc) return;
    const currentTags = activeUgc.etiquetas || [];
    onUpdateUGC({
      ...activeUgc,
      etiquetas: currentTags.filter(t => t !== tag)
    });
  }

  // Process, filter, and sort creators list
  const filteredAndSorted = useMemo(() => {
    return ugcs
      .filter(u => {
        const matchSearch = u.nombre.toLowerCase().includes(search.toLowerCase());
        const matchUnread = filterType === 'all' || u.unread;
        return matchSearch && matchUnread;
      })
      .sort((a, b) => getUgcLastMsgTime(b) - getUgcLastMsgTime(a));
  }, [ugcs, search, filterType]);

  const unreadCount = useMemo(() => {
    return ugcs.filter(u => u.unread).length;
  }, [ugcs]);

  return (
    <div className="h-full w-full flex overflow-hidden" style={{ backgroundColor: 'var(--color-surface)' }}>
      {/* 1. Chats List Sidebar */}
      <div
        className={`${mobilePanel === 'lista' ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-80 flex-shrink-0 border-r h-full`}
        style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-surface)' }}
      >
        {/* Header (Search and Filter Tabs) */}
        <div className="p-4 border-b flex flex-col gap-3" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-3)' }} />
            <input
              type="text"
              value={search}
              onChange={e => updateParams({ q: e.target.value }, { replace: true })}
              placeholder="Buscar conversación..."
              className="w-full pl-9 pr-4 py-2 border rounded-xl text-xs focus:outline-none transition-all duration-200"
              style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(252,154,0,0.1)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = ''; }}
            />
          </div>

          <div className="flex p-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: 'var(--color-surface-alt)' }}>
            <button
              onClick={() => updateParams({ filter: null })}
              className="flex-1 py-1 px-2 rounded-md transition-all text-center"
              style={filterType === 'all'
                ? { backgroundColor: 'var(--color-surface)', color: 'var(--color-text-1)', boxShadow: 'var(--shadow-card)' }
                : { color: 'var(--color-text-3)' }}
            >
              Todos
            </button>
            <button
              onClick={() => updateParams({ filter: 'unread' })}
              className="flex-grow py-1 px-2 rounded-md transition-all text-center flex items-center justify-center gap-1.5"
              style={filterType === 'unread'
                ? { backgroundColor: 'var(--color-surface)', color: 'var(--color-text-1)', boxShadow: 'var(--shadow-card)' }
                : { color: 'var(--color-text-3)' }}
            >
              No leídos
              {unreadCount > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold text-white"
                  style={{ backgroundColor: 'var(--color-brand)' }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Chats scrollable list */}
        <div className="flex-grow overflow-y-auto">
          {filteredAndSorted.length === 0 ? (
            <div className="p-8 text-center text-xs" style={{ color: 'var(--color-text-3)' }}>
              No se encontraron conversaciones
            </div>
          ) : (
            filteredAndSorted.map(u => {
              const lastMsg = u.conversacion?.[u.conversacion.length - 1];
              const isSelected = selectedUgcId === u.id;
              const canalCfg = getCanalConfig(u.canal);
              const CanalIcon = canalCfg.icon;

              return (
                <button
                  key={u.id}
                  onClick={() => { navigate(`/chats/${u.id}`); setMobilePanel('conversacion'); }}
                  className="w-full p-4 border-b flex gap-3 text-left transition-colors duration-150 relative"
                  style={{
                    borderColor: 'var(--color-border-subtle)',
                    backgroundColor: isSelected
                      ? 'var(--color-brand-light)'
                      : u.unread
                        ? 'rgba(252, 154, 0, 0.03)'
                        : 'transparent'
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--color-surface-alt)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = isSelected ? 'var(--color-brand-light)' : u.unread ? 'rgba(252, 154, 0, 0.03)' : 'transparent'; }}
                >
                  {/* Left platform border color tag */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: canalCfg.color }}
                  />

                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold ${avatarColor(u.id)}`}>
                      {getInitials(u.nombre)}
                    </div>
                    {/* Channel Floating Badge */}
                    <div
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg flex items-center justify-center border text-white shadow-sm"
                      style={{ backgroundColor: canalCfg.color, borderColor: 'var(--color-surface)' }}
                    >
                      <CanalIcon className="w-2.5 h-2.5" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="flex justify-between items-baseline gap-1">
                      <span className="font-semibold text-xs truncate" style={{ color: 'var(--color-text-1)' }}>
                        {u.nombre}
                      </span>
                      {lastMsg && (
                        <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--color-text-3)' }}>
                          {lastMsg.fecha}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center gap-2 mt-1">
                      <p className="text-[11px] truncate flex-grow" style={{ color: u.unread ? 'var(--color-text-1)' : 'var(--color-text-3)', fontWeight: u.unread ? '700' : '400' }}>
                        {lastMsg ? lastMsg.texto : 'No hay mensajes'}
                      </p>
                      {u.unread && (
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: 'var(--color-brand)' }}
                        />
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Chat Pane and User Profiles details */}
      <div className={`${mobilePanel === 'lista' ? 'hidden' : 'flex'} lg:flex flex-grow h-full`}>
        {activeUgc ? (
          <>
            {/* Active Chat Conversation Pane */}
            <div className={`${mobilePanel === 'conversacion' ? 'flex' : 'hidden'} lg:flex flex-col flex-grow h-full relative`} style={{ backgroundColor: 'var(--color-bg-app)' }}>
              {/* Header Info */}
              <div
                className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0"
                style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)' }}
              >
                <div className="flex items-center gap-1 min-w-0">
                  {/* Back to chats list (mobile/tablet only) */}
                  <button
                    type="button"
                    onClick={() => setMobilePanel('lista')}
                    className="lg:hidden w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl transition-colors -ml-1.5"
                    style={{ color: 'var(--color-text-2)' }}
                    aria-label="Volver a la lista de chats"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobilePanel('perfil')}
                    className="flex items-center gap-3 min-w-0 text-left"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor(activeUgc.id)}`}>
                      {getInitials(activeUgc.nombre)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black truncate" style={{ color: 'var(--color-text-1)' }}>
                        {activeUgc.nombre}
                      </h4>
                      {/* Badge indicating channel source */}
                      <div
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold mt-0.5 border"
                        style={{
                          backgroundColor: getCanalConfig(activeUgc.canal).bg,
                          borderColor: getCanalConfig(activeUgc.canal).border,
                          color: getCanalConfig(activeUgc.canal).color
                        }}
                      >
                        {(() => {
                          const CIcon = getCanalConfig(activeUgc.canal).icon;
                          return <CIcon className="w-2.5 h-2.5" />;
                        })()}
                        Conectado vía {getCanalConfig(activeUgc.canal).label}
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Messages Bubbles list */}
              <div className="flex-grow overflow-y-auto px-6 py-4 flex flex-col gap-3">
                {activeUgc.conversacion.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                    <MessageSquare className="w-10 h-10" style={{ color: 'var(--color-text-3)' }} />
                    <div>
                      <p className="text-xs font-semibold" style={{ color: 'var(--color-text-2)' }}>No hay conversación previa</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-3)' }}>Iniciá la comunicación enviando un mensaje directo</p>
                    </div>
                  </div>
                ) : (
                  activeUgc.conversacion.map((m, idx) => {
                    const isOutgoing = m.tipo === 'saliente';
                    return (
                      <div
                        key={m.id || idx}
                        className={`flex flex-col max-w-[70%] ${isOutgoing ? 'self-end items-end' : 'self-start items-start'}`}
                      >
                        <div
                          className="px-3.5 py-2 rounded-2xl text-xs leading-relaxed shadow-sm"
                          style={
                            isOutgoing
                              ? {
                                  backgroundColor: 'var(--color-brand)',
                                  color: '#fff',
                                  borderBottomRightRadius: '4px',
                                }
                              : {
                                  backgroundColor: 'var(--color-surface)',
                                  color: 'var(--color-text-1)',
                                  border: '1px solid var(--color-border-subtle)',
                                  borderBottomLeftRadius: '4px',
                                }
                          }
                        >
                          {m.texto}
                        </div>
                        <span className="text-[9px] mt-1 px-1" style={{ color: 'var(--color-text-3)' }}>
                          {m.fecha}
                        </span>
                      </div>
                    );
                  })
                )}
                {/* Scroll Anchor */}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Footer Bar */}
              <div
                className="p-4 border-t flex-shrink-0"
                style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)' }}
              >
                <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    placeholder={`Escribir mensaje para enviar por ${getCanalConfig(activeUgc.canal).label}...`}
                    className="flex-grow px-4 py-2.5 border rounded-xl text-xs focus:outline-none transition-all duration-200"
                    style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(252,154,0,0.1)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = ''; }}
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl text-white transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--color-brand)', boxShadow: 'var(--shadow-btn-brand)' }}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>

            {/* Sidebar details (Bio & Tags Administration) */}
            <div
              className={`${mobilePanel === 'perfil' ? 'flex' : 'hidden'} lg:flex flex-col w-full lg:w-72 flex-shrink-0 border-l h-full p-5 overflow-y-auto`}
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)' }}
            >
              {/* Back to conversation (mobile/tablet only) */}
              <button
                type="button"
                onClick={() => setMobilePanel('conversacion')}
                className="lg:hidden w-11 h-11 -ml-2 -mt-1 mb-1 flex-shrink-0 flex items-center justify-center rounded-xl transition-colors self-start"
                style={{ color: 'var(--color-text-2)' }}
                aria-label="Volver a la conversación"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* Profile Card Header */}
              <div className="flex flex-col items-center text-center pb-5 border-b gap-2.5" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold ${avatarColor(activeUgc.id)}`}>
                  {getInitials(activeUgc.nombre)}
                </div>
                <div>
                  <h4 className="text-xs font-black" style={{ color: 'var(--color-text-1)' }}>
                    {activeUgc.nombre}
                  </h4>
                  <p className="text-[10px] mt-0.5 font-medium" style={{ color: 'var(--color-text-3)' }}>
                    {activeUgc.seguidores ? `${activeUgc.seguidores} seguidores` : 'Sin datos de seguidores'}
                  </p>
                </div>

                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold"
                  style={{
                    backgroundColor: 'var(--color-brand-light)',
                    color: 'var(--color-brand-hover)',
                    border: '1px solid var(--color-brand-border)'
                  }}
                >
                  Score: {activeUgc.score}/100
                </span>
              </div>

              {/* Editable Bio/Description */}
              <div className="py-4 border-b flex flex-col gap-2" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-3)' }}>
                    Descripción / Bio
                  </label>
                  {saveStatus && (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-600">
                      <Check className="w-3 h-3" />
                      {saveStatus}
                    </span>
                  )}
                </div>
                <textarea
                  value={activeUgc.bio || ''}
                  onChange={e => onUpdateUGC({ ...activeUgc, bio: e.target.value })}
                  onBlur={e => handleSaveBio(e.target.value)}
                  placeholder="Sin descripción. Escribí algo para guardar..."
                  rows={4}
                  className="w-full px-3 py-2 border rounded-xl text-xs focus:outline-none transition-all duration-200 resize-none"
                  style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; }}
                  onBlurCapture={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                />
              </div>

              {/* Tags/Labels Administration */}
              <div className="py-4 flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-3)' }}>
                  Etiquetas
                </label>
                
                {/* List of current tags */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {!activeUgc.etiquetas || activeUgc.etiquetas.length === 0 ? (
                    <p className="text-[10px] italic" style={{ color: 'var(--color-text-3)' }}>
                      Sin etiquetas asignadas.
                    </p>
                  ) : (
                    activeUgc.etiquetas.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium border"
                        style={{
                          backgroundColor: 'var(--color-surface-alt)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text-2)'
                        }}
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-rose-600 transition-colors ml-0.5 rounded"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Form to add tags */}
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newTagText}
                    onChange={e => setNewTagText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                    placeholder="Agregar etiqueta..."
                    className="flex-grow px-2.5 py-1.5 border rounded-lg text-xs focus:outline-none transition-all duration-200"
                    style={{ backgroundColor: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', color: 'var(--color-text-1)' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; }}
                    onBlurCapture={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    disabled={!newTagText.trim()}
                    className="px-2 border rounded-lg flex items-center justify-center transition-all duration-200 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--color-brand)' }}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Empty/Welcome State */
          <div className="flex-grow flex flex-col items-center justify-center text-center p-8 gap-4" style={{ backgroundColor: 'var(--color-bg-app)' }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-brand-light)' }}>
              <MessageSquare className="w-8 h-8" style={{ color: 'var(--color-brand)' }} />
            </div>
            <div>
              <h3 className="text-sm font-black" style={{ color: 'var(--color-text-1)' }}>
                Bandeja de Entrada UGC
              </h3>
              <p className="text-xs max-w-xs mt-1 leading-relaxed" style={{ color: 'var(--color-text-3)' }}>
                Seleccioná una conversación del listado izquierdo para responder mensajes y administrar la ficha del creador.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
