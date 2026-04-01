import { useState } from 'react';
import { Users, Megaphone, Settings, Bell, ChevronRight } from 'lucide-react';
import { UGCS_MOCK, CAMPANAS_MOCK } from './data';
import type { UGC, Campana } from './data';
import UGCsTab from './components/UGCsTab';
import CampanasTab from './components/CampanasTab';
import CampanaDetail from './components/CampanaDetail';
import logoNgr from './assets/Logo-ngr.png';

type TabId = 'ugcs' | 'campanas';

const NAV_ITEMS = [
  { id: 'ugcs' as TabId, label: 'UGCs', icon: Users },
  { id: 'campanas' as TabId, label: 'Campañas', icon: Megaphone },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('ugcs');
  const [ugcs, setUGCs] = useState<UGC[]>(UGCS_MOCK);
  const [campanas, setCampanas] = useState<Campana[]>(CAMPANAS_MOCK);
  const [selectedCampana, setSelectedCampana] = useState<Campana | null>(null);

  // UGC handlers
  function handleUpdateUGC(ugc: UGC) {
    setUGCs(prev => {
      const idx = prev.findIndex(u => u.id === ugc.id);
      if (idx === -1) return [...prev, ugc];
      const next = [...prev];
      next[idx] = ugc;
      return next;
    });
  }

  function handleDeleteUGC(id: string) {
    setUGCs(prev => prev.filter(u => u.id !== id));
  }

  // Campaign handlers
  function handleTogglePause(campana: Campana) {
    const updated = {
      ...campana,
      estado: campana.estado === 'Pausada' ? 'Activa' : 'Pausada'
    } as Campana;
    setCampanas(prev => prev.map(c => c.id === campana.id ? updated : c));
    if (selectedCampana?.id === campana.id) setSelectedCampana(updated);
  }

  function handleLanzar(campana: Campana) {
    const updated = { ...campana, estado: 'Activa' } as Campana;
    setCampanas(prev => prev.map(c => c.id === campana.id ? updated : c));
    if (selectedCampana?.id === campana.id) setSelectedCampana(updated);
  }

  function handleSelectCampana(c: Campana) {
    setSelectedCampana(c);
    setActiveTab('campanas');
  }

  const calificados = ugcs.filter(u => u.estado === 'Calificado').length;
  const activas = campanas.filter(c => c.estado === 'Activa').length;

  return (
    <div className="min-h-screen bg-slate-50 flex" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      
      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-slate-100 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-white rounded-xl border border-slate-100 shadow-sm flex items-center justify-center overflow-hidden p-1.5">
              <img src={logoNgr} alt="NGR" className="w-full h-auto object-contain" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 leading-none">UGC Flow</p>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">by NGR Digital</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3">
          <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] px-2 mb-2">Navegación</p>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSelectedCampana(null); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-0.5 text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
                {item.id === 'ugcs' && (
                  <span className={`ml-auto text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {ugcs.length}
                  </span>
                )}
                {item.id === 'campanas' && (
                  <span className={`ml-auto text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {campanas.length}
                  </span>
                )}
              </button>
            );
          })}

          {/* Quick stats */}
          <div className="mt-6 px-2">
            <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-3">Resumen</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Calificados</span>
                <span className="text-xs font-mono font-bold text-emerald-600">{calificados}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Campañas activas</span>
                <span className="text-xs font-mono font-bold text-indigo-600">{activas}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Total UGCs</span>
                <span className="text-xs font-mono font-bold text-slate-600">{ugcs.length}</span>
              </div>
            </div>
          </div>
        </nav>

        {/* User at bottom */}
        <div className="px-3 py-4 border-t border-slate-50">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-xs font-bold text-white">
              SA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">Santiago</p>
              <p className="text-[10px] text-slate-400 truncate">Marketing</p>
            </div>
            <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
          </div>
        </div>
      </aside>

      {/* ── Main area ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top bar */}
        <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            {/* Breadcrumb */}
            {selectedCampana ? (
              <div className="flex items-center gap-1.5 text-sm">
                <button
                  onClick={() => setSelectedCampana(null)}
                  className="font-medium text-slate-400 hover:text-indigo-600 transition-colors"
                >
                  Campañas
                </button>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                <span className="font-semibold text-slate-900 truncate max-w-xs">{selectedCampana.nombre}</span>
              </div>
            ) : (
              <div>
                <h1 className="text-base font-black text-slate-900">
                  {activeTab === 'ugcs' ? 'Base de Creadores UGC' : 'Gestión de Campañas'}
                </h1>
                <p className="text-xs text-slate-400">
                  {activeTab === 'ugcs'
                    ? `${ugcs.length} creadores registrados · ${calificados} calificados`
                    : `${campanas.length} campañas · ${activas} activas`
                  }
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button className="relative w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-500 rounded-full" />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          {activeTab === 'ugcs' && (
            <UGCsTab
              ugcs={ugcs}
              campanas={campanas}
              onAddUGC={() => {}}
              onUpdateUGC={handleUpdateUGC}
              onDeleteUGC={handleDeleteUGC}
            />
          )}
          {activeTab === 'campanas' && !selectedCampana && (
            <CampanasTab
              campanas={campanas}
              ugcs={ugcs}
              onSelectCampana={handleSelectCampana}
              onTogglePause={handleTogglePause}
              onLanzar={handleLanzar}
              onAddCampana={() => {}}
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
    </div>
  );
}
