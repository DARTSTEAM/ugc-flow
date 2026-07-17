import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { fetchBrands } from '../api';
import type { Brand } from '../data';

const STORAGE_KEY = 'ugcflow-selected-brand';
const DEFAULT_BRAND_ID = 'popeyes';

interface CompanyContextValue {
  brands: Brand[];
  selectedBrandId: string;
  setSelectedBrandId: (id: string) => void;
  /** true hasta que el usuario elige una marca a mano o el default se resuelve contra `profile.marcaAsignada` — permite pisar el fallback una sola vez, en la primera visita. */
  isFirstVisit: boolean;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const hadStoredValueAtInit = useRef(typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY) !== null);

  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandIdState] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_BRAND_ID;
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_BRAND_ID;
  });

  useEffect(() => {
    fetchBrands().then(setBrands).catch(() => {});
  }, []);

  function setSelectedBrandId(id: string) {
    hadStoredValueAtInit.current = true; // a partir de una elección explícita, ya no es "primera visita"
    setSelectedBrandIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  return (
    <CompanyContext.Provider value={{ brands, selectedBrandId, setSelectedBrandId, isFirstVisit: !hadStoredValueAtInit.current }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany debe usarse dentro de <CompanyProvider>');
  return ctx;
}
