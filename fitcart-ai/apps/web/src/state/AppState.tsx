import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Product, Slot } from '../data/products';
import {
  addToCartApi, deleteProfileApi, fetchProducts, fetchState, removeFromCartApi, resetFeedbackApi,
  setOutfitSlotApi, setTierApi, setupProfileApi, toggleCompareApi, toggleConsentApi, toggleSavedApi,
  updateFeedbackApi, type ApiState,
} from '../lib/api';

export interface CartLine {
  productId: number;
  qty: number;
}

export interface Consent {
  photos: boolean;
  sharing: boolean;
}

export type OutfitState = Record<Slot, number | null>;

const EMPTY_OUTFIT: OutfitState = { top: null, bottom: null, shoes: null, watch: null, accessory: null };

export interface AppStateValue {
  ready: boolean;
  products: Product[];
  cartItems: CartLine[];
  savedProductIds: number[];
  compareIds: number[];
  outfit: OutfitState;
  consent: Consent;
  profileSetupDone: boolean;
  tier: string;
  feedbackChoice: string | null;
  feedbackNote: string;
  feedbackSubmitted: boolean;
  toast: string | null;
  searchQuery: string;

  setSearchQuery: (q: string) => void;
  showToast: (msg: string) => void;
  toggleSave: (id: number) => void;
  toggleCompare: (id: number) => void;
  addToOutfit: (id: number) => void;
  removeFromSlot: (slot: Slot) => void;
  selectForSlot: (slot: Slot, id: number) => void;
  toggleConsent: (key: keyof Consent) => void;
  addToCart: (id: number) => void;
  removeFromCart: (productId: number) => void;
  setTier: (t: string) => void;
  deleteBodyData: () => void;
  setFeedbackChoice: (choice: string) => void;
  setFeedbackNote: (note: string) => void;
  submitFeedback: () => void;
  resetFeedback: () => void;
  markProfileSetupDone: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

function applyApiState(s: ApiState, setters: {
  setCartItems: (v: CartLine[]) => void;
  setSavedProductIds: (v: number[]) => void;
  setCompareIds: (v: number[]) => void;
  setOutfit: (v: OutfitState) => void;
  setConsent: (v: Consent) => void;
  setProfileSetupDone: (v: boolean) => void;
  setTierState: (v: string) => void;
  setFeedbackChoiceState: (v: string | null) => void;
  setFeedbackNoteState: (v: string) => void;
  setFeedbackSubmitted: (v: boolean) => void;
}) {
  setters.setCartItems(s.cartItems);
  setters.setSavedProductIds(s.savedProductIds);
  setters.setCompareIds(s.compareIds);
  setters.setOutfit({ ...EMPTY_OUTFIT, ...s.outfit });
  setters.setConsent(s.consent);
  setters.setProfileSetupDone(s.profileSetupDone);
  setters.setTierState(s.tier);
  setters.setFeedbackChoiceState(s.feedbackChoice);
  setters.setFeedbackNoteState(s.feedbackNote);
  setters.setFeedbackSubmitted(s.feedbackSubmitted);
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [cartItems, setCartItems] = useState<CartLine[]>([]);
  const [savedProductIds, setSavedProductIds] = useState<number[]>([]);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [outfit, setOutfit] = useState<OutfitState>(EMPTY_OUTFIT);
  const [consent, setConsent] = useState<Consent>({ photos: false, sharing: false });
  const [profileSetupDone, setProfileSetupDone] = useState(false);
  const [tier, setTierState] = useState('style');
  const [feedbackChoice, setFeedbackChoiceState] = useState<string | null>(null);
  const [feedbackNote, setFeedbackNoteState] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);

  const applyState = useCallback((s: ApiState) => {
    applyApiState(s, {
      setCartItems, setSavedProductIds, setCompareIds, setOutfit, setConsent,
      setProfileSetupDone, setTierState, setFeedbackChoiceState, setFeedbackNoteState, setFeedbackSubmitted,
    });
    if (s.error) showToast(s.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const showToast = useCallback((msg: string) => {
    window.clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const toggleSave = useCallback((id: number) => {
    const has = savedProductIds.includes(id);
    showToast(has ? 'Removed from saved' : 'Saved for later');
    toggleSavedApi(id).then(applyState);
  }, [savedProductIds, showToast, applyState]);

  const toggleCompare = useCallback((id: number) => {
    const has = compareIds.includes(id);
    if (!has && compareIds.length >= 3) {
      showToast('Compare up to 3 items at a time');
      return;
    }
    showToast(has ? 'Removed from compare' : 'Added to compare');
    toggleCompareApi(id).then(applyState);
  }, [compareIds, showToast, applyState]);

  const addToOutfit = useCallback((id: number) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    showToast(p.name + ' added to outfit');
    setOutfitSlotApi(p.slot, id).then(applyState);
  }, [products, showToast, applyState]);

  const removeFromSlot = useCallback((slot: Slot) => {
    setOutfitSlotApi(slot, null).then(applyState);
  }, [applyState]);

  const selectForSlot = useCallback((slot: Slot, id: number) => {
    setOutfitSlotApi(slot, id).then(applyState);
  }, [applyState]);

  const toggleConsent = useCallback((key: keyof Consent) => {
    toggleConsentApi(key).then(applyState);
  }, [applyState]);

  const addToCart = useCallback((id: number) => {
    if (cartItems.some((c) => c.productId === id)) {
      showToast('Already in cart');
      return;
    }
    showToast('Added to cart');
    addToCartApi(id).then(applyState);
  }, [cartItems, showToast, applyState]);

  const removeFromCart = useCallback((productId: number) => {
    removeFromCartApi(productId).then(applyState);
  }, [applyState]);

  const setTier = useCallback((t: string) => {
    showToast('Plan updated to ' + t.charAt(0).toUpperCase() + t.slice(1));
    setTierApi(t).then(applyState);
  }, [showToast, applyState]);

  const deleteBodyData = useCallback(() => {
    showToast('Body data deleted');
    deleteProfileApi().then(applyState);
  }, [showToast, applyState]);

  const setFeedbackChoice = useCallback((choice: string) => {
    setFeedbackChoiceState(choice);
    updateFeedbackApi({ choice }).then(applyState);
  }, [applyState]);

  const setFeedbackNote = useCallback((note: string) => {
    setFeedbackNoteState(note);
    updateFeedbackApi({ note }).catch(() => {});
  }, []);

  const submitFeedback = useCallback(() => {
    updateFeedbackApi({ note: feedbackNote, submit: true }).then(applyState);
  }, [feedbackNote, applyState]);

  const resetFeedback = useCallback(() => {
    resetFeedbackApi().then(applyState);
  }, [applyState]);

  const markProfileSetupDone = useCallback(() => {
    setupProfileApi().then(applyState);
  }, [applyState]);

  const value = useMemo<AppStateValue>(() => ({
    ready, products, cartItems, savedProductIds, compareIds, outfit, consent, profileSetupDone, tier,
    feedbackChoice, feedbackNote, feedbackSubmitted, toast, searchQuery,
    setSearchQuery, showToast, toggleSave, toggleCompare, addToOutfit, removeFromSlot, selectForSlot,
    toggleConsent, addToCart, removeFromCart, setTier, deleteBodyData,
    setFeedbackChoice, setFeedbackNote, submitFeedback, resetFeedback, markProfileSetupDone,
  }), [ready, products, cartItems, savedProductIds, compareIds, outfit, consent, profileSetupDone, tier,
    feedbackChoice, feedbackNote, feedbackSubmitted, toast, searchQuery, showToast, toggleSave, toggleCompare,
    addToOutfit, removeFromSlot, selectForSlot, toggleConsent, addToCart, removeFromCart, setTier,
    deleteBodyData, setFeedbackChoice, setFeedbackNote, submitFeedback, resetFeedback, markProfileSetupDone]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}
