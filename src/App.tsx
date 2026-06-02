import { useState, useEffect } from 'react';
import { Users, Megaphone, Bell, ChevronRight, Loader2, Sun, Moon, MessageSquare, ScanSearch } from 'lucide-react';
import { fetchCreators, fetchCreatorDetail, updateCreator, deleteCreator, fetchCampaigns, updateCampaignStatus, createCampaign } from './api';
import type { UGC, Campana } from './data';
import UGCsTab from './components/UGCsTab';
import ChatsTab from './components/ChatsTab';
import CampanasTab from './components/CampanasTab';
import CampanaDetail from './components/CampanaDetail';
import NuevaCampanaModal from './components/NuevaCampanaModal';
import ProspeccionTab from './components/ProspeccionTab';
import logoNgr from './assets/Logo-ngr.png';

type TabId = 'ugcs' | 'campanas' | 'chats' | 'prospeccion';

const NAV_ITEMS = [
  { id: 'ugcs' as TabId,        label: 'UGCs Activos', icon: Users },
  { id: 'prospeccion' as TabId, label: 'Prospección',  icon: ScanSearch },
  { id: 'campanas' as TabId,    label: 'Campañas',     icon: Megaphone },
  { id: 'chats' as TabId,       label: 'Chats',        icon: MessageSquare },
];

function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem('ugcflow-theme');
    return stored === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('ugcflow-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return [dark, setDark] as const;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('ugcs');
  const [ugcs, setUGCs] = useState<UGC[]>([]);
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [selectedCampana, setSelectedCampana] = useState<Campana | null>(null);
  const [showNuevaCampana, setShowNuevaCampana] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useDarkMode();

  // ── Load data from API on mount ──────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [creatorsData, campaignsData] = await Promise.all([
          fetchCreators(),
          fetchCampaigns(),
        ]);
        
        const creatorsWithChats = creatorsData.map((u: UGC, idx: number) => {
          const lastMsg = u.conversacion?.[u.conversacion.length - 1];
          const isUnread = lastMsg ? lastMsg.tipo === 'entrante' : false;
          
          let tags: string[] = [];
          if (u.estado === 'Calificado') tags.push('Calificado');
          if (u.score > 80) tags.push('Top');
          
          const extraTags = ['Moda', 'Foodie', 'Skincare', 'Rosario', 'Córdoba', 'Tech'];
          tags.push(extraTags[idx % extraTags.length]);

          return {
            ...u,
            unread: isUnread,
            etiquetas: tags,
          };
        });
        
        setUGCs(creatorsWithChats);
        setCampanas(campaignsData);
      } catch (err) {
        console.error('Failed to load data:', err);
        setError(err instanceof Error ? err.message : 'Error al cargar datos');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── UGC handlers ─────────────────────────────────────────────────
  async function handleUpdateUGC(ugc: UGC) {
    try {
      await updateCreator(ugc);
      setUGCs(prev => {
        const idx = prev.findIndex(u => u.id === ugc.id);
        if (idx === -1) return [...prev, ugc];
        const next = [...prev];
        next[idx] = ugc;
        return next;
      });
    } catch (err) {
      console.error('Failed to update UGC:', err);
    }
  }

  async function handleDeleteUGC(id: string) {
    try {
      await deleteCreator(id);
      setUGCs(prev => prev.filter(u => u.id !== id));
    } catch (err) {
      console.error('Failed to delete UGC:', err);
    }
  }

  // ── Campaign handlers ─────────────────────────────────────────────
  async function handleTogglePause(campana: Campana) {
    const newEstado = campana.estado === 'Pausada' ? 'Activa' : 'Pausada';
    try {
      await updateCampaignStatus(campana.id, newEstado);
      const updated = { ...campana, estado: newEstado } as Campana;
      setCampanas(prev => prev.map(c => c.id === campana.id ? updated : c));
      if (selectedCampana?.id === campana.id) setSelectedCampana(updated);
    } catch (err) {
      console.error('Failed to toggle pause:', err);
    }
  }

  async function handleLanzar(campana: Campana) {
    try {
      await updateCampaignStatus(campana.id, 'Activa');
      const updated = { ...campana, estado: 'Activa' } as Campana;
      setCampanas(prev => prev.map(c => c.id === campana.id ? updated : c));
      if (selectedCampana?.id === campana.id) setSelectedCampana(updated);
    } catch (err) {
      console.error('Failed to launch campaign:', err);
    }
  }

  function handleSelectCampana(c: Campana) {
    setSelectedCampana(c);
    setActiveTab('campanas');
  }

  async function handleCrearCampana(nueva: Campana) {
    try {
      await createCampaign(nueva);
      setCampanas(prev => [...prev, nueva]);
      setShowNuevaCampana(false);
      setSelectedCampana(nueva);
      setActiveTab('campanas');
    } catch (err) {
      console.error('Failed to create campaign:', err);
    }
  }

  const calificados = ugcs.filter(u => u.estado === 'Calificado').length;
  const activas = campanas.filter(c => c.estado === 'Activa').length;

  // ── Loading state ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-app)' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-brand)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-2)' }}>Cargando datos desde BigQuery...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-app)' }}>
        <div className="rounded-2xl p-8 max-w-md text-center border" style={{ backgroundColor: 'var(--color-surface)', borderColor: '#fecdd3' }}>
          <p className="text-sm font-semibold text-rose-600 mb-2">Error al conectar</p>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-2)' }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-white text-xs font-semibold rounded-xl transition-all active:scale-[0.98]"
            style={{ backgroundColor: 'var(--color-brand)' }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden" style={{ backgroundColor: 'var(--color-bg-app)' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className="w-56 flex-shrink-0 flex flex-col border-r"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)' }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl border flex items-center justify-center overflow-hidden p-1.5 shadow-sm"
              style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <img src={logoNgr} alt="NGR" className="w-full h-auto object-contain" />
            </div>
            <div>
              <p className="text-sm font-black leading-none" style={{ color: 'var(--color-text-1)' }}>UGC Flow</p>
              <p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--color-text-3)' }}>by NGR Digital</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] px-2 mb-2" style={{ color: 'var(--color-text-3)' }}>Menú</p>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSelectedCampana(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-0.5 text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
                style={isActive ? {
                  backgroundColor: 'var(--color-brand)',
                  color: '#fff',
                  boxShadow: 'var(--shadow-btn-brand)',
                } : {
                  color: 'var(--color-text-2)',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
                <span
                  className="ml-auto text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md"
                  style={isActive
                    ? { backgroundColor: 'rgba(255,255,255,0.25)', color: '#fff' }
                    : item.id === 'chats' && ugcs.some(u => u.unread)
                      ? { backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand-hover)' }
                      : { backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-2)' }
                  }
                >
                  {item.id === 'ugcs' && ugcs.length}
                  {item.id === 'prospeccion' && 4}
                  {item.id === 'campanas' && campanas.length}
                  {item.id === 'chats' && ugcs.filter(u => u.unread).length}
                </span>
              </button>
            );
          })}

          {/* Quick stats */}
          <div className="mt-6 px-2">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--color-text-3)' }}>Resumen</p>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>Calificados</span>
                <span className="text-xs font-mono font-bold text-emerald-600">{calificados}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>Campañas activas</span>
                <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-brand)' }}>{activas}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>Total UGCs</span>
                <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-text-2)' }}>{ugcs.length}</span>
              </div>
            </div>
          </div>
        </nav>

        {/* User at bottom */}
        <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl cursor-pointer transition-colors duration-200 group"
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-muted) 100%)' }}>
              SA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-1)' }}>Santiago</p>
              <p className="text-[10px] truncate" style={{ color: 'var(--color-text-3)' }}>Marketing</p>
            </div>
            <ChevronRight className="w-3 h-3 transition-colors duration-200" style={{ color: 'var(--color-text-3)' }} />
          </div>
        </div>
      </aside>

      {/* ── Main area ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header
          className="border-b px-6 py-4 flex items-center justify-between flex-shrink-0"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)' }}
        >
          <div>
            {selectedCampana ? (
              <div className="flex items-center gap-1.5 text-sm">
                <button
                  onClick={() => setSelectedCampana(null)}
                  className="font-medium transition-colors duration-200"
                  style={{ color: 'var(--color-text-3)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-brand)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-3)'}
                >
                  Campañas
                </button>
                <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--color-text-3)' }} />
                <span className="font-semibold truncate max-w-xs" style={{ color: 'var(--color-text-1)' }}>
                  {selectedCampana.nombre}
                </span>
              </div>
            ) : (
              <div>
                <h1 className="text-base font-black" style={{ color: 'var(--color-text-1)' }}>
                  {activeTab === 'ugcs' && 'UGCs Activos'}
                  {activeTab === 'prospeccion' && 'Prospección de UGCs'}
                  {activeTab === 'campanas' && 'Gestión de Campañas'}
                  {activeTab === 'chats' && 'Centro de Mensajería'}
                </h1>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>
                  {activeTab === 'ugcs' && `${ugcs.length} creadores registrados · ${calificados} calificados`}
                  {activeTab === 'prospeccion' && '4 búsquedas · 1 en progreso · 109 creadores hallados'}
                  {activeTab === 'campanas' && `${campanas.length} campañas · ${activas} activas`}
                  {activeTab === 'chats' && `${ugcs.filter(u => u.unread).length} chats sin leer`}
                </p>
              </div>
            ) }
          </div>

          <div className="flex items-center gap-1.5">
            {/* Dark mode toggle */}
            <button
              onClick={() => setDark(d => !d)}
              className="w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-[0.92]"
              style={{ color: 'var(--color-text-3)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}
              title={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {/* Notifications */}
            <button
              className="relative w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-200"
              style={{ color: 'var(--color-text-3)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-brand)' }} />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className={`flex-1 ${activeTab === 'chats' ? 'p-0 overflow-hidden' : 'p-6 overflow-auto'}`} style={{ backgroundColor: 'var(--color-bg-app)' }}>
          {activeTab === 'ugcs' && (
            <UGCsTab
              ugcs={ugcs}
              campanas={campanas}
              onAddUGC={() => {}}
              onUpdateUGC={handleUpdateUGC}
              onDeleteUGC={handleDeleteUGC}
            />
          )}
          {activeTab === 'prospeccion' && (
            <ProspeccionTab />
          )}
          {activeTab === 'chats' && (
            <ChatsTab
              ugcs={ugcs}
              onUpdateUGC={handleUpdateUGC}
            />
          )}
          {activeTab === 'campanas' && !selectedCampana && (
            <CampanasTab
              campanas={campanas}
              ugcs={ugcs}
              onSelectCampana={handleSelectCampana}
              onTogglePause={handleTogglePause}
              onLanzar={handleLanzar}
              onAddCampana={() => setShowNuevaCampana(true)}
            />
          )}
          {activeTab === 'campanas' && selectedCampana && (
            <CampanaDetail
              campana={campanas.find(c => c.id === selectedCampana.id) || selectedCampana}
              ugcs={ugcs}
              onBack={() => setSelectedCampana(null)}
              onTogglePause={handleTogglePause}
              onLanzar={handleLanzar}
            />
          )}
        </main>
      </div>

      {showNuevaCampana && (
        <NuevaCampanaModal
          onClose={() => setShowNuevaCampana(false)}
          onCrear={handleCrearCampana}
          ugcs={ugcs}
        />
      )}
    </div>
  );
}
