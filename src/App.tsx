import { useState, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate, useLocation, useMatch, useParams } from 'react-router-dom';
import { Users, Megaphone, ChevronRight, MessageSquare, ScanSearch, Star, BrainCircuit, Menu, X } from 'lucide-react';
import { fetchCreators, fetchCreatorDetail, updateCreator, deleteCreator, fetchCampaigns, updateCampaignStatus, createCampaign, assignCreatorToCampaign, deleteCampaign, updateCreatorCampaignStatus, fetchProfile } from './api';
import type { UGC, Campana, EstadoEnCampana, UserProfile } from './data';
import UGCsTab from './components/UGCsTab';
import ChatsTab from './components/ChatsTab';
import CampanasTab from './components/CampanasTab';
import CampanaDetail from './components/CampanaDetail';
import NuevaCampanaModal from './components/NuevaCampanaModal';
import ProspeccionTab from './components/ProspeccionTab';
import RecomendacionesTab from './components/RecomendacionesTab';
import TestAgentTab from './components/TestAgentTab';
import UserProfileMenu from './components/UserProfileMenu';
import ProfileView from './components/ProfileView';
import ChatsDisclaimerModal from './components/ChatsDisclaimerModal';
import logoNgr from './assets/Logo-ngr.png';

export const FALLBACK_PROFILE: UserProfile = { id: 'user-001', nombre: 'Bautista', area: 'Marketing', email: null, fotoUrl: null };

type TabId = 'ugcs' | 'campanas' | 'chats' | 'prospeccion' | 'recomendaciones' | 'testagent';

const NAV_ITEMS = [
  { id: 'ugcs' as TabId,             path: '/ugcs',          label: 'UGCs Activos',    icon: Users },
  { id: 'campanas' as TabId,         path: '/campanas',      label: 'Campañas',        icon: Megaphone },
  { id: 'chats' as TabId,            path: '/chats',         label: 'Chats',           icon: MessageSquare },
  { id: 'prospeccion' as TabId,      path: '/prospeccion',   label: 'Prospección',     icon: ScanSearch },
  { id: 'recomendaciones' as TabId,  path: '/recomendaciones', label: 'Recomendaciones', icon: Star },
  { id: 'testagent' as TabId,        path: '/testagent',     label: 'Test Agent',      icon: BrainCircuit },
];

/** Envuelve CampanaDetail: resuelve la campaña por :id y traduce back/delete a navegación real. */
function CampanaDetailRoute({ campanas, ugcs, onTogglePause, onLanzar, onDeleteCampana, onUpdateEstadoCreador, onGoToChat }: {
  campanas: Campana[];
  ugcs: UGC[];
  onTogglePause: (c: Campana) => void;
  onLanzar: (c: Campana) => void;
  onDeleteCampana: (c: Campana) => void;
  onUpdateEstadoCreador: (campanaId: string, creatorId: string, estado: EstadoEnCampana) => void;
  onGoToChat: (ugc: UGC) => void;
}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const campana = campanas.find(c => c.id === id);
  if (!campana) return <Navigate to="/campanas" replace />;
  return (
    <CampanaDetail
      campana={campana}
      ugcs={ugcs}
      onBack={() => navigate('/campanas')}
      onTogglePause={onTogglePause}
      onLanzar={onLanzar}
      onDeleteCampana={onDeleteCampana}
      onUpdateEstadoCreador={onUpdateEstadoCreador}
      onGoToChat={onGoToChat}
    />
  );
}

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
  const navigate = useNavigate();
  const location = useLocation();
  const campanaDetailMatch = useMatch('/campanas/:id');

  const [ugcs, setUGCs] = useState<UGC[]>([]);
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [showNuevaCampana, setShowNuevaCampana] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useDarkMode();
  const [profile, setProfile] = useState<UserProfile>(FALLBACK_PROFILE);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isPerfil = location.pathname === '/perfil';
  const section = location.pathname.split('/')[1] || 'ugcs';
  const selectedCampana = campanaDetailMatch ? campanas.find(c => c.id === campanaDetailMatch.params.id) ?? null : null;

  // Close the mobile drawer automatically on every navigation
  useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);

  // Chats disclaimer: show on every entry into the Chats section (not on every
  // conversation switch within it, since that would fire on each chat click)
  const [showChatsDisclaimer, setShowChatsDisclaimer] = useState(false);
  const prevSectionRef = useRef<string | null>(null);
  useEffect(() => {
    if (section === 'chats' && prevSectionRef.current !== 'chats') {
      setShowChatsDisclaimer(true);
    }
    prevSectionRef.current = section;
  }, [section]);

  function goToChat(ugc: UGC) {
    navigate(`/chats/${ugc.id}`);
  }

  useEffect(() => {
    fetchProfile().then(setProfile).catch(() => {});
  }, []);

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
        
        const creatorsWithChats = creatorsData.map((u: UGC) => {
          const lastMsg = u.conversacion?.[u.conversacion.length - 1];
          const isUnread = lastMsg ? lastMsg.tipo === 'entrante' : false;
          
          return {
            ...u,
            unread: isUnread,
            etiquetas: u.etiquetas || [],
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
  function handleUpdateUGC(ugc: UGC) {
    // Update UI immediately so derived state (allEtiquetas, etc.) stays fresh
    setUGCs(prev => {
      const idx = prev.findIndex(u => u.id === ugc.id);
      if (idx === -1) return [...prev, ugc];
      const next = [...prev];
      next[idx] = ugc;
      return next;
    });
    // Fire-and-forget for operations that need a full-record save (avanzar, descartar, asignar)
    updateCreator(ugc).catch(err => console.error('Failed to persist UGC update:', err));
  }

  async function handleDeleteUGC(id: string) {
    try {
      await deleteCreator(id);
      setUGCs(prev => prev.filter(u => u.id !== id));
    } catch (err) {
      console.error('Failed to delete UGC:', err);
    }
  }

  // ── Campaign assignment ──────────────────────────────────────────
  async function handleAsignarCampana(ugc: UGC, campanaId: string) {
    const today = new Date().toISOString().split('T')[0];
    setCampanas(prev => prev.map(c => {
      if (c.id !== campanaId) return c;
      if (c.ugcs.some(u => u.ugcId === ugc.id)) return c;
      return {
        ...c,
        ugcs: [...c.ugcs, { ugcId: ugc.id, estado: 'Pendiente' as EstadoEnCampana, fechaEnvio: today, fechaRespuesta: null }],
      };
    }));
    try {
      await assignCreatorToCampaign(campanaId, ugc.id);
    } catch (err) {
      console.error('Failed to assign creator to campaign:', err);
    }
  }

  // ── Campaign handlers ─────────────────────────────────────────────
  async function handleDeleteCampana(campana: Campana) {
    try {
      await deleteCampaign(campana.id);
      setCampanas(prev => prev.filter(c => c.id !== campana.id));
      navigate('/campanas');
    } catch (err) {
      console.error('Failed to delete campaign:', err);
    }
  }

  async function handleTogglePause(campana: Campana) {
    const newEstado = campana.estado === 'Pausada' ? 'Activa' : 'Pausada';
    try {
      await updateCampaignStatus(campana.id, newEstado);
      setCampanas(prev => prev.map(c => c.id === campana.id ? { ...c, estado: newEstado } as Campana : c));
    } catch (err) {
      console.error('Failed to toggle pause:', err);
    }
  }

  async function handleLanzar(campana: Campana) {
    try {
      await updateCampaignStatus(campana.id, 'Activa');
      setCampanas(prev => prev.map(c => c.id === campana.id ? { ...c, estado: 'Activa' } as Campana : c));
    } catch (err) {
      console.error('Failed to launch campaign:', err);
    }
  }

  async function handleUpdateEstadoCreador(campanaId: string, creatorId: string, estado: EstadoEnCampana) {
    setCampanas(prev => prev.map(c => {
      if (c.id !== campanaId) return c;
      return { ...c, ugcs: c.ugcs.map(u => u.ugcId === creatorId ? { ...u, estado } : u) };
    }));
    try {
      await updateCreatorCampaignStatus(campanaId, creatorId, estado);
    } catch (err) {
      console.error('Failed to update creator status in campaign:', err);
    }
  }

  async function handleCrearCampana(nueva: Campana) {
    try {
      await createCampaign(nueva);
      setCampanas(prev => [...prev, nueva]);
      setShowNuevaCampana(false);
      navigate(`/campanas/${nueva.id}`);
    } catch (err) {
      console.error('Failed to create campaign:', err);
    }
  }

  // ── Loading state ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-dvh w-screen flex overflow-hidden" style={{ backgroundColor: 'var(--color-bg-app)' }}>
        {/* Sidebar skeleton — hidden on mobile to avoid flashing the broken fixed-width layout while loading */}
        <aside className="hidden lg:flex w-56 flex-shrink-0 flex-col border-r animate-pulse" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)' }}>
          <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl" style={{ backgroundColor: 'var(--color-border)' }} />
              <div className="flex flex-col gap-1.5">
                <div className="h-3 w-20 rounded-md" style={{ backgroundColor: 'var(--color-border)' }} />
                <div className="h-2 w-14 rounded-md" style={{ backgroundColor: 'var(--color-border-subtle)' }} />
              </div>
            </div>
          </div>
          <nav className="flex-1 py-4 px-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-0.5">
                <div className="w-4 h-4 rounded-md flex-shrink-0" style={{ backgroundColor: 'var(--color-border)' }} />
                <div className="h-3 rounded-md flex-1" style={{ backgroundColor: 'var(--color-border)' }} />
                <div className="w-6 h-4 rounded-md" style={{ backgroundColor: 'var(--color-border-subtle)' }} />
              </div>
            ))}
            <div className="mt-6 px-2">
              <div className="h-2 w-14 rounded-md mb-3" style={{ backgroundColor: 'var(--color-border-subtle)' }} />
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between mb-2.5">
                  <div className="h-2.5 w-20 rounded-md" style={{ backgroundColor: 'var(--color-border-subtle)' }} />
                  <div className="h-2.5 w-6 rounded-md" style={{ backgroundColor: 'var(--color-border)' }} />
                </div>
              ))}
            </div>
          </nav>
          <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <div className="flex items-center gap-2.5 px-2 py-2">
              <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--color-border)' }} />
              <div className="flex flex-col gap-1.5 flex-1">
                <div className="h-2.5 w-16 rounded-md" style={{ backgroundColor: 'var(--color-border)' }} />
                <div className="h-2 w-12 rounded-md" style={{ backgroundColor: 'var(--color-border-subtle)' }} />
              </div>
            </div>
          </div>
        </aside>
        {/* Main area skeleton */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="border-b px-6 py-4 flex items-center justify-between flex-shrink-0 animate-pulse" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)' }}>
            <div className="flex flex-col gap-1.5">
              <div className="h-4 w-36 rounded-md" style={{ backgroundColor: 'var(--color-border)' }} />
              <div className="h-2.5 w-52 rounded-md" style={{ backgroundColor: 'var(--color-border-subtle)' }} />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-8 rounded-xl" style={{ backgroundColor: 'var(--color-border-subtle)' }} />
              <div className="w-8 h-8 rounded-xl" style={{ backgroundColor: 'var(--color-border-subtle)' }} />
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto animate-pulse" style={{ backgroundColor: 'var(--color-bg-app)' }}>
            <div className="flex gap-3 items-center mb-4">
              <div className="flex-1 h-10 rounded-xl border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
              <div className="w-24 h-10 rounded-xl border" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
              <div className="w-32 h-10 rounded-xl" style={{ backgroundColor: 'var(--color-brand)', opacity: 0.15 }} />
            </div>
            <div className="border rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-8 px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                {[120, 80, 100, 140, 110, 80].map((w, i) => (
                  <div key={i} className="h-2.5 rounded-md" style={{ width: w, backgroundColor: 'var(--color-border-subtle)' }} />
                ))}
              </div>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-8 px-4 py-3.5 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <div className="flex items-center gap-2.5" style={{ width: 120 }}>
                    <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--color-border)' }} />
                    <div className="h-3 w-20 rounded-md" style={{ backgroundColor: 'var(--color-border)' }} />
                  </div>
                  <div className="h-5 w-20 rounded-md" style={{ backgroundColor: 'var(--color-border-subtle)' }} />
                  <div className="h-2 w-24 rounded-full" style={{ backgroundColor: 'var(--color-border)' }} />
                  <div className="h-3 w-28 rounded-md" style={{ backgroundColor: 'var(--color-border-subtle)' }} />
                  <div className="h-5 w-24 rounded-full" style={{ backgroundColor: 'var(--color-border-subtle)' }} />
                  <div className="flex gap-1.5">
                    <div className="w-7 h-7 rounded-lg" style={{ backgroundColor: 'var(--color-border-subtle)' }} />
                    <div className="w-7 h-7 rounded-lg" style={{ backgroundColor: 'var(--color-border-subtle)' }} />
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg-app)' }}>
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
    <div className="h-dvh w-screen flex overflow-hidden" style={{ backgroundColor: 'var(--color-bg-app)' }}>

      {/* ── Mobile sidebar overlay ─────────────────────────────────── */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden overlay-enter"
          style={{ backgroundColor: 'rgba(9,10,15,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 lg:w-56 flex-shrink-0 flex flex-col border-r transition-transform duration-300 ease-out lg:translate-x-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)' }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border-subtle)' }}>
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
          <button
            onClick={() => setMobileNavOpen(false)}
            aria-label="Cerrar menú"
            className="lg:hidden w-11 h-11 -mr-2.5 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ color: 'var(--color-text-3)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = !isPerfil && (location.pathname === item.path || location.pathname.startsWith(item.path + '/'));
            return (
              <NavLink
                key={item.id}
                to={item.path}
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
                  {item.id === 'recomendaciones' && ugcs.filter(u => u.score > 0 && u.estado !== 'Descartado').length}
                  {item.id === 'testagent' && 'AI'}
                </span>
              </NavLink>
            );
          })}
        </nav>

        {/* User at bottom */}
        <div className="px-3 py-4 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <UserProfileMenu dark={dark} setDark={setDark} profile={profile} onOpenProfile={() => navigate('/perfil')} active={isPerfil} />
        </div>
      </aside>

      {/* ── Main area ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header
          className="border-b px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 flex-shrink-0"
          style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border-subtle)' }}
        >
          <div className="flex items-center gap-1 min-w-0">
            {/* Hamburger: opens the sidebar drawer below the lg breakpoint */}
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label="Abrir menú"
              className="lg:hidden w-11 h-11 -ml-2.5 flex items-center justify-center rounded-xl flex-shrink-0 transition-all duration-200"
              style={{ color: 'var(--color-text-3)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-surface-alt)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = ''}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
            {isPerfil ? (
              <div className="flex items-center gap-1.5 text-sm">
                <button
                  onClick={() => navigate(-1)}
                  className="font-medium transition-colors duration-200"
                  style={{ color: 'var(--color-text-3)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-brand)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--color-text-3)'}
                >
                  Volver
                </button>
                <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--color-text-3)' }} />
                <span className="font-semibold" style={{ color: 'var(--color-text-1)' }}>Mi Perfil</span>
              </div>
            ) : selectedCampana ? (
              <div className="flex items-center gap-1.5 text-sm">
                <button
                  onClick={() => navigate('/campanas')}
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
                  {section === 'ugcs' && 'UGCs Activos'}
                  {section === 'prospeccion' && 'Prospección de UGCs'}
                  {section === 'campanas' && 'Gestión de Campañas'}
                  {section === 'chats' && 'Centro de Mensajería'}
                  {section === 'recomendaciones' && 'Recomendaciones'}
                </h1>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-3)' }}>
                  {section === 'ugcs' && 'Gestioná, calificá y asigná creadores a tus campañas'}
                  {section === 'prospeccion' && 'Buscá y calificá nuevos creadores UGC para tus campañas'}
                  {section === 'campanas' && 'Creá, pausá y monitoreá el progreso de tus campañas activas'}
                  {section === 'chats' && 'Respondé mensajes y coordiná con tus creadores en un solo lugar'}
                  {section === 'recomendaciones' && 'Recomendaciones basadas en performance real de campañas y tendencias'}
                </p>
              </div>
            ) }
            </div>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1.5 flex-shrink-0">
            <UserProfileMenu
              dark={dark}
              setDark={setDark}
              profile={profile}
              onOpenProfile={() => navigate('/perfil')}
              active={false}
              variant="header"
            />
          </div>
        </header>

        {/* Content */}
        <main
          className={`flex-1 ${section === 'chats' || section === 'testagent' ? 'p-0 overflow-hidden' : 'p-4 sm:p-6 overflow-auto'}`}
          style={{ backgroundColor: 'var(--color-bg-app)' }}
        >
          <Routes>
            <Route path="/" element={<Navigate to="/ugcs" replace />} />
            <Route path="/ugcs" element={
              <UGCsTab
                ugcs={ugcs}
                campanas={campanas}
                onAddUGC={() => {}}
                onUpdateUGC={handleUpdateUGC}
                onDeleteUGC={handleDeleteUGC}
                onGoToChat={goToChat}
                onAsignar={handleAsignarCampana}
              />
            } />
            <Route path="/ugcs/:id" element={
              <UGCsTab
                ugcs={ugcs}
                campanas={campanas}
                onAddUGC={() => {}}
                onUpdateUGC={handleUpdateUGC}
                onDeleteUGC={handleDeleteUGC}
                onGoToChat={goToChat}
                onAsignar={handleAsignarCampana}
              />
            } />
            <Route path="/prospeccion" element={<ProspeccionTab />} />
            <Route path="/campanas" element={
              <CampanasTab
                campanas={campanas}
                ugcs={ugcs}
                onSelectCampana={c => navigate(`/campanas/${c.id}`)}
                onTogglePause={handleTogglePause}
                onLanzar={handleLanzar}
                onAddCampana={() => setShowNuevaCampana(true)}
              />
            } />
            <Route path="/campanas/:id" element={
              <CampanaDetailRoute
                campanas={campanas}
                ugcs={ugcs}
                onTogglePause={handleTogglePause}
                onLanzar={handleLanzar}
                onDeleteCampana={handleDeleteCampana}
                onUpdateEstadoCreador={handleUpdateEstadoCreador}
                onGoToChat={goToChat}
              />
            } />
            <Route path="/chats" element={<ChatsTab ugcs={ugcs} onUpdateUGC={handleUpdateUGC} />} />
            <Route path="/chats/:ugcId" element={<ChatsTab ugcs={ugcs} onUpdateUGC={handleUpdateUGC} />} />
            <Route path="/recomendaciones" element={<RecomendacionesTab />} />
            <Route path="/testagent" element={<TestAgentTab />} />
            <Route path="/perfil" element={<ProfileView onSaved={setProfile} />} />
            <Route path="*" element={<Navigate to="/ugcs" replace />} />
          </Routes>
        </main>
      </div>

      {showNuevaCampana && (
        <NuevaCampanaModal
          onClose={() => setShowNuevaCampana(false)}
          onCrear={handleCrearCampana}
          ugcs={ugcs}
        />
      )}

      {showChatsDisclaimer && (
        <ChatsDisclaimerModal
          onClose={() => setShowChatsDisclaimer(false)}
          onTestAgent={() => { setShowChatsDisclaimer(false); navigate('/testagent'); }}
        />
      )}
    </div>
  );
}
