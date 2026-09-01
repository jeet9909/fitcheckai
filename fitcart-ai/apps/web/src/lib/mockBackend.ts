import type { ApiState } from './api';

// Standalone browser-only backend for static hosting (GitHub Pages), where
// there is no Cloudflare Functions/D1 backend to call. Installed only when
// VITE_MOCK_API is set at build time — see vite.config.ts. Persists to
// localStorage so state survives a refresh; nothing here is shared across
// devices or users. Real backend (auth, payments, product catalog) replaces
// this once it exists.
//
// No seed/dummy products here on purpose — the catalog is real data only,
// from fetch-product (paste-a-link scraping) or search-products (Amazon/
// Flipkart affiliate APIs). A signed-out/unconfigured visitor sees an empty
// catalog rather than placeholder products.

const STORAGE_KEY = 'fitcart_mock_state_v1';

interface MockState {
  savedProductIds: number[];
  consent: { photos: boolean; sharing: boolean };
  profileSetupDone: boolean;
}

function defaultState(): MockState {
  return { savedProductIds: [], consent: { photos: false, sharing: false }, profileSetupDone: false };
}

function loadState(): MockState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

function saveState(s: MockState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // localStorage unavailable (private mode etc.) — state just won't persist
  }
}

function toApiState(s: MockState): ApiState {
  return { savedProductIds: s.savedProductIds, consent: s.consent, profileSetupDone: s.profileSetupDone };
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
}

export function installMockBackend() {
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.startsWith('/api/')) return realFetch(input, init);

    const path = url.slice('/api'.length);
    const method = (init?.method ?? 'GET').toUpperCase();
    const state = loadState();

    if (path === '/products' && method === 'GET') {
      return jsonResponse([]);
    }

    if (path === '/state' && method === 'GET') {
      return jsonResponse(toApiState(state));
    }

    if (path === '/saved/toggle' && method === 'POST') {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      const id = body.productId as number;
      state.savedProductIds = state.savedProductIds.includes(id)
        ? state.savedProductIds.filter((x) => x !== id)
        : [...state.savedProductIds, id];
      saveState(state);
      return jsonResponse(toApiState(state));
    }

    if (path === '/consent' && method === 'POST') {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      const key = body.key as 'photos' | 'sharing';
      state.consent = { ...state.consent, [key]: !state.consent[key] };
      saveState(state);
      return jsonResponse(toApiState(state));
    }

    if (path === '/profile/setup' && method === 'POST') {
      state.profileSetupDone = true;
      saveState(state);
      return jsonResponse(toApiState(state));
    }

    if (path === '/profile' && method === 'DELETE') {
      state.profileSetupDone = false;
      state.consent = { photos: false, sharing: false };
      saveState(state);
      return jsonResponse(toApiState(state));
    }

    return jsonResponse({ error: `Mock backend: no handler for ${method} ${path}` });
  };
}
