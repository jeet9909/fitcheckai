import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { PRODUCTS, type Slot } from '../data/products';

export interface CartLine {
  productId: number;
  qty: number;
}

export interface Consent {
  photos: boolean;
  sharing: boolean;
}

export type OutfitState = Record<Slot, number | null>;

export interface AppStateValue {
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
  removeFromCart: (idx: number) => void;
  setTier: (t: string) => void;
  deleteBodyData: () => void;
  setFeedbackChoice: (choice: string) => void;
  setFeedbackNote: (note: string) => void;
  submitFeedback: () => void;
  resetFeedback: () => void;
  markProfileSetupDone: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartLine[]>([{ productId: 7, qty: 1 }]);
  const [savedProductIds, setSavedProductIds] = useState<number[]>([10]);
  const [compareIds, setCompareIds] = useState<number[]>([3, 8]);
  const [outfit, setOutfit] = useState<OutfitState>({ top: 1, bottom: null, shoes: 3, watch: null, accessory: null });
  const [consent, setConsent] = useState<Consent>({ photos: false, sharing: false });
  const [profileSetupDone, setProfileSetupDone] = useState(false);
  const [tier, setTierState] = useState('style');
  const [feedbackChoice, setFeedbackChoiceState] = useState<string | null>(null);
  const [feedbackNote, setFeedbackNoteState] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    window.clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const toggleSave = useCallback((id: number) => {
    setSavedProductIds((prev) => {
      const has = prev.includes(id);
      showToast(has ? 'Removed from saved' : 'Saved for later');
      return has ? prev.filter((x) => x !== id) : [...prev, id];
    });
  }, [showToast]);

  const toggleCompare = useCallback((id: number) => {
    setCompareIds((prev) => {
      const has = prev.includes(id);
      if (!has && prev.length >= 3) {
        showToast('Compare up to 3 items at a time');
        return prev;
      }
      showToast(has ? 'Removed from compare' : 'Added to compare');
      return has ? prev.filter((x) => x !== id) : [...prev, id];
    });
  }, [showToast]);

  const addToOutfit = useCallback((id: number) => {
    const p = PRODUCTS.find((x) => x.id === id);
    if (!p) return;
    setOutfit((prev) => ({ ...prev, [p.slot]: id }));
    showToast(p.name + ' added to outfit');
  }, [showToast]);

  const removeFromSlot = useCallback((slot: Slot) => {
    setOutfit((prev) => ({ ...prev, [slot]: null }));
  }, []);

  const selectForSlot = useCallback((slot: Slot, id: number) => {
    setOutfit((prev) => ({ ...prev, [slot]: id }));
  }, []);

  const toggleConsent = useCallback((key: keyof Consent) => {
    setConsent((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const addToCart = useCallback((id: number) => {
    setCartItems((prev) => {
      if (prev.some((c) => c.productId === id)) {
        showToast('Already in cart');
        return prev;
      }
      showToast('Added to cart');
      return [...prev, { productId: id, qty: 1 }];
    });
  }, [showToast]);

  const removeFromCart = useCallback((idx: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const setTier = useCallback((t: string) => {
    setTierState(t);
    showToast('Plan updated to ' + t.charAt(0).toUpperCase() + t.slice(1));
  }, [showToast]);

  const deleteBodyData = useCallback(() => {
    setProfileSetupDone(false);
    setConsent({ photos: false, sharing: false });
    showToast('Body data deleted');
  }, [showToast]);

  const setFeedbackChoice = useCallback((choice: string) => setFeedbackChoiceState(choice), []);
  const setFeedbackNote = useCallback((note: string) => setFeedbackNoteState(note), []);
  const submitFeedback = useCallback(() => setFeedbackSubmitted(true), []);
  const resetFeedback = useCallback(() => {
    setFeedbackChoiceState(null);
    setFeedbackNoteState('');
    setFeedbackSubmitted(false);
  }, []);
  const markProfileSetupDone = useCallback(() => setProfileSetupDone(true), []);

  const value = useMemo<AppStateValue>(() => ({
    cartItems, savedProductIds, compareIds, outfit, consent, profileSetupDone, tier,
    feedbackChoice, feedbackNote, feedbackSubmitted, toast, searchQuery,
    setSearchQuery, showToast, toggleSave, toggleCompare, addToOutfit, removeFromSlot, selectForSlot,
    toggleConsent, addToCart, removeFromCart, setTier, deleteBodyData,
    setFeedbackChoice, setFeedbackNote, submitFeedback, resetFeedback, markProfileSetupDone,
  }), [cartItems, savedProductIds, compareIds, outfit, consent, profileSetupDone, tier,
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
