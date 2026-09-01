import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Product } from '../data/products';
import {
  deleteProfileApi, fetchProducts, fetchState, setupProfileApi, toggleConsentApi, toggleSavedApi, type ApiState,
} from '../lib/api';

export interface Consent {
  photos: boolean;
  sharing: boolean;
}

export interface AppStateValue {
  ready: boolean;
  products: Product[];
  savedProductIds: number[];
  consent: Consent;
  profileSetupDone: boolean;
  toast: string | null;
  searchQuery: string;

  setSearchQuery: (q: string) => void;
  showToast: (msg: string) => void;
  toggleSave: (id: number) => void;
  toggleConsent: (key: keyof Consent) => void;
  deleteBodyData: () => void;
  markProfileSetupDone: () => void;
  refreshProducts: () => Promise<void>;
}

const AppStateContext = createContext<AppStateValue | null>(null);

function applyApiState(s: ApiState, setters: {
  setSavedProductIds: (v: number[]) => void;
  setConsent: (v: Consent) => void;
  setProfileSetupDone: (v: boolean) => void;
}) {
  setters.setSavedProductIds(s.savedProductIds);
  setters.setConsent(s.consent);
  setters.setProfileSetupDone(s.profileSetupDone);
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [savedProductIds, setSavedProductIds] = useState<number[]>([]);
  const [consent, setConsent] = useState<Consent>({ photos: false, sharing: false });
  const [profileSetupDone, setProfileSetupDone] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    window.clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const applyState = useCallback((s: ApiState) => {
    applyApiState(s, { setSavedProductIds, setConsent, setProfileSetupDone });
    if (s.error) showToast(s.error);
  }, [showToast]);

  useEffect(() => {
    Promise.all([fetchProducts(), fetchState()]).then(([p, s]) => {
      setProducts(p);
      applyState(s);
      setReady(true);
    }).catch(() => {
      setReady(true);
      showToast('Could not reach the server — try refreshing');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshProducts = useCallback(async () => {
    try {
      setProducts(await fetchProducts());
    } catch {
      showToast('Could not refresh the catalog — try again');
    }
  }, [showToast]);

  const toggleSave = useCallback((id: number) => {
    const has = savedProductIds.includes(id);
    showToast(has ? 'Removed from saved' : 'Saved for later');
    toggleSavedApi(id).then(applyState);
  }, [savedProductIds, showToast, applyState]);

  const toggleConsent = useCallback((key: keyof Consent) => {
    toggleConsentApi(key).then(applyState);
  }, [applyState]);

  const deleteBodyData = useCallback(() => {
    showToast('Body data deleted');
    deleteProfileApi().then(applyState);
  }, [showToast, applyState]);

  const markProfileSetupDone = useCallback(() => {
    setupProfileApi().then(applyState);
  }, [applyState]);

  const value = useMemo<AppStateValue>(() => ({
    ready, products, savedProductIds, consent, profileSetupDone, toast, searchQuery,
    setSearchQuery, showToast, toggleSave, toggleConsent, deleteBodyData, markProfileSetupDone, refreshProducts,
  }), [ready, products, savedProductIds, consent, profileSetupDone, toast, searchQuery, showToast,
    toggleSave, toggleConsent, deleteBodyData, markProfileSetupDone, refreshProducts]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
