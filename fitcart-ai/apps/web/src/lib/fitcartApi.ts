const API_BASE = (import.meta.env.VITE_FITCART_API_URL || 'https://fitcart-scraper-api.onrender.com').replace(/\/$/, '');
const TOKEN_KEY = 'fitcart_anonymous_token';
const USER_KEY = 'fitcart_anonymous_user_id';

export interface GalleryItem {
  id: string;
  anonymous_user_id: string;
  category: string;
  product_source: 'upload' | 'scraped_url' | 'image_url';
  product_url: string | null;
  person_image_url: string;
  product_image_url: string;
  result_image_url: string;
  model: string;
  created_at: string;
}

interface AnonymousSession {
  anonymous_user_id: string;
  access_token: string;
}

export interface TryOnInput {
  personImage: File;
  productImage?: File;
  productPageUrl?: string;
  productImageUrl?: string;
  category: string;
}

export class FitCartApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { detail?: string | { message?: string } } | null;
  if (typeof body?.detail === 'string') return body.detail;
  if (body?.detail && typeof body.detail === 'object' && body.detail.message) return body.detail.message;
  return `Request failed (${response.status})`;
}

async function createSession(): Promise<string> {
  const response = await fetch(`${API_BASE}/v1/sessions/anonymous`, { method: 'POST' });
  if (!response.ok) throw new FitCartApiError(await readError(response), response.status);
  const session = await response.json() as AnonymousSession;
  localStorage.setItem(TOKEN_KEY, session.access_token);
  localStorage.setItem(USER_KEY, session.anonymous_user_id);
  return session.access_token;
}

async function token(): Promise<string> {
  return localStorage.getItem(TOKEN_KEY) || createSession();
}

async function authorizedFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const accessToken = await token();
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 401 && retry) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    await createSession();
    return authorizedFetch(path, init, false);
  }
  return response;
}

export async function createTryOn(input: TryOnInput): Promise<GalleryItem> {
  const form = new FormData();
  form.append('person_image', input.personImage);
  form.append('category', input.category || 'clothing');
  form.append('country', 'IN');
  if (input.productImage) form.append('product_image', input.productImage);
  else if (input.productImageUrl) form.append('product_image_url', input.productImageUrl);
  else if (input.productPageUrl) form.append('product_page_url', input.productPageUrl);
  else throw new FitCartApiError('Choose a product image or enter a product link.', 400);

  const response = await authorizedFetch('/v1/try-ons', { method: 'POST', body: form });
  if (!response.ok) throw new FitCartApiError(await readError(response), response.status);
  return response.json() as Promise<GalleryItem>;
}

export async function fetchGallery(): Promise<GalleryItem[]> {
  const response = await authorizedFetch('/v1/gallery');
  if (!response.ok) throw new FitCartApiError(await readError(response), response.status);
  const body = await response.json() as { items: GalleryItem[] };
  return body.items;
}

export function saveLatestTryOn(item: GalleryItem): void {
  sessionStorage.setItem('fitcart_latest_tryon', JSON.stringify(item));
}

export function loadLatestTryOn(): GalleryItem | null {
  try {
    const value = sessionStorage.getItem('fitcart_latest_tryon');
    return value ? JSON.parse(value) as GalleryItem : null;
  } catch {
    return null;
  }
}
