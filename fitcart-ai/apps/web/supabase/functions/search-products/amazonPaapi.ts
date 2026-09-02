// Amazon Creators API — catalog/v1/searchItems.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE LOOKS NOTHING LIKE TYPICAL "PA-API v5" SAMPLE CODE
// ---------------------------------------------------------------------------
// This file used to implement Product Advertising API v5 (AWS Signature
// Version 4 request signing). PA-API v5 was deprecated April 30, 2026 and
// fully retired May 15, 2026 — every PA-API v5 call now returns a hard
// `403 AccessDeniedException`, unconditionally, regardless of how correct
// the SigV4 implementation is. If you find PA-API v5 sample code elsewhere
// (blog posts, older SDKs, AI training data), it will not work against a
// live account anymore. See:
//   - https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation
//   - https://affiliate-program.amazon.com/creatorsapi/docs/en-us/migrating-to-creatorsapi-from-paapi
//   - https://dev.to/th3nate/amazon-pa-api-v5-is-shutting-down-april-30-2026-here-is-what-changes-at-the-auth-layer-22ek
//
// The replacement is the Amazon Creators API, which uses OAuth 2.0
// client_credentials (Login-with-Amazon style), not AWS SigV4. There are no
// AWS Access/Secret Keys involved at all — old PA-API credentials do not
// carry over; this is a hard cutover requiring a new app registration at
// Associates Central -> Tools -> CreatorsAPI -> Create App.
//
// Eligibility bar is also materially different (and harder to *maintain*,
// not just reach): PA-API v5 required 3+ qualifying sales in the trailing
// 180 days. Creators API requires 10+ qualified sales in the trailing 30
// days — a rolling window, so access is temporarily revoked if a 30-day
// window passes with fewer than 10 sales, even for a previously-approved
// account. See supabase/README.md for the full setup writeup.
//
// UNVERIFIED / JUDGMENT-CALL ITEMS (be aware before relying on this in
// production — flagged explicitly rather than silently assumed correct):
//   1. Token endpoint: `AMAZON_CREATORS_TOKEN_URL` defaults to
//      `https://api.amazon.com/auth/o2/token` (the standard Login-with-
//      Amazon token endpoint). We could not confirm during this pass whether
//      the India marketplace uses a region-specific token host — confirm
//      against your actual Associates Central region docs and override via
//      the env var if needed.
//   2. Search endpoint host: `https://creatorsapi.amazon/catalog/v1/searchItems`
//      per the migration guide's field-naming examples. Not exercised
//      against a live account.
//   3. `resources` array and response field names below are mechanically
//      derived from the old PA-API v5 PascalCase names using the
//      lowerCamelCase convention the migration guide documents (e.g.
//      `ItemInfo.Title` -> `itemInfo.title`). This is a systematic rename,
//      not a guess, but it is still unverified against a live response —
//      confirm once you have Creators API access.
// ---------------------------------------------------------------------------

import type { StoreListing } from './types.ts';

const DEFAULT_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';
const SEARCH_URL = 'https://creatorsapi.amazon/catalog/v1/searchItems';
const TOKEN_SCOPE = 'creatorsapi::default';

// Refresh the cached token this many ms before its actual expiry, so a
// request never races a token that expires mid-flight.
const TOKEN_REFRESH_BUFFER_MS = 60_000;

function env(name: string, fallback = ''): string {
  return Deno.env.get(name) ?? fallback;
}

export function isAmazonConfigured(): boolean {
  return Boolean(
    env('AMAZON_CREATORS_CLIENT_ID') &&
    env('AMAZON_CREATORS_CLIENT_SECRET') &&
    env('AMAZON_CREATORS_PARTNER_TAG'),
  );
}

// Module-scope singleton — cached across invocations within the same Edge
// Function isolate so we don't fetch a fresh OAuth token on every search
// request (tokens are valid ~3600s per Amazon's docs).
let tokenCache: { token: string; expiresAt: number } | null = null;

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

async function fetchAccessToken(): Promise<string> {
  const clientId = env('AMAZON_CREATORS_CLIENT_ID');
  const clientSecret = env('AMAZON_CREATORS_CLIENT_SECRET');
  const tokenUrl = env('AMAZON_CREATORS_TOKEN_URL', DEFAULT_TOKEN_URL);

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: TOKEN_SCOPE,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data: TokenResponse = await res.json().catch(() => ({}));

  if (!res.ok || !data.access_token) {
    // Never include clientSecret (or any part of the request body) in the
    // thrown message — it propagates to logs and, if a caller isn't
    // careful, potentially to a client-facing error.
    throw new Error(`Amazon Creators API token request failed: ${res.status} ${data.error ?? ''} ${data.error_description ?? ''}`.trim());
  }

  const expiresInMs = (data.expires_in ?? 3600) * 1000;
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + expiresInMs,
  };
  return tokenCache.token;
}

function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt - TOKEN_REFRESH_BUFFER_MS > Date.now()) {
    return Promise.resolve(tokenCache.token);
  }
  return fetchAccessToken();
}

// Exposed for tests only — lets orchestrator.test.ts / amazonPaapi.test.ts
// assert token caching/reuse without reaching into module-private state.
export function __resetTokenCacheForTests(): void {
  tokenCache = null;
}

interface AmazonCreatorsItem {
  itemInfo?: {
    title?: { displayValue?: string };
    byLineInfo?: { brand?: { displayValue?: string } };
  };
  images?: { primary?: { large?: { url?: string } } };
  offers?: { listings?: { price?: { amount?: number }; savingBasis?: { amount?: number } }[] };
  detailPageUrl?: string;
}

interface AmazonCreatorsSearchResponse {
  searchResult?: { items?: AmazonCreatorsItem[] };
}

export async function searchAmazon(query: string): Promise<StoreListing[]> {
  const partnerTag = env('AMAZON_CREATORS_PARTNER_TAG');
  const marketplace = env('AMAZON_CREATORS_MARKETPLACE', 'www.amazon.in');

  const token = await getAccessToken();

  const requestBody = {
    keywords: query,
    partnerTag,
    marketplace,
    itemCount: 10,
    // lowerCamelCase mirror of the old PA-API v5 `Resources` array — see the
    // file-header comment for why these are mechanically derived rather
    // than confirmed against live Creators API docs.
    resources: [
      'itemInfo.title',
      'itemInfo.byLineInfo',
      'images.primary.large',
      'offers.listings.price',
      'offers.listings.savingBasis',
    ],
  };

  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-marketplace': marketplace,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    // Read the body for our own diagnostics but never forward it verbatim
    // to the caller — it could echo back request details.
    const bodyText = await res.text().catch(() => '');
    throw new Error(`Amazon Creators API search failed: ${res.status}${bodyText ? ` ${bodyText.slice(0, 200)}` : ''}`);
  }

  const data: AmazonCreatorsSearchResponse = await res.json();
  const items = data?.searchResult?.items ?? [];

  return items
    .map((item): StoreListing | null => {
      const name = item.itemInfo?.title?.displayValue;
      const productUrl = item.detailPageUrl;
      if (!name || !productUrl) return null;
      const listing = item.offers?.listings?.[0];
      return {
        name,
        brand: item.itemInfo?.byLineInfo?.brand?.displayValue ?? 'Unknown',
        price: Math.round(listing?.price?.amount ?? 0),
        mrp: Math.round(listing?.savingBasis?.amount ?? listing?.price?.amount ?? 0),
        color: '',
        imageUrl: item.images?.primary?.large?.url ?? null,
        productUrl,
        store: 'Amazon',
      };
    })
    .filter((x): x is StoreListing => x !== null);
}
