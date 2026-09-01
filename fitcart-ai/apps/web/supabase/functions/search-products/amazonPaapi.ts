// Amazon Product Advertising API v5 — SearchItems.
//
// Real, no-fake-data integration: requires an approved Amazon Associates
// account with live PA-API access (Amazon only grants API credentials once
// the Associates account has 3+ qualifying sales in the trailing 180 days —
// this is Amazon's own eligibility rule, not something this code can work
// around). Until AMAZON_PAAPI_ACCESS_KEY / AMAZON_PAAPI_SECRET_KEY /
// AMAZON_PAAPI_PARTNER_TAG are set as secrets, isAmazonConfigured() is
// false and the caller (index.ts) returns an honest "not configured"
// response — never placeholder/mock product data, since the whole point of
// this function is replacing dummy listings with real ones.
//
// UNVERIFIED against a live account — the request-signing algorithm below
// (AWS Signature Version 4) is implemented from Amazon's published PA-API
// v5 spec, which has been stable for years, but has not been exercised
// against a real response here. Confirm against a live account before
// relying on it.

import type { StoreListing } from './types.ts';

const SERVICE = 'ProductAdvertisingAPI';
const TARGET = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems';
const PATH = '/paapi5/searchitems';

function env(name: string, fallback = ''): string {
  return Deno.env.get(name) ?? fallback;
}

export function isAmazonConfigured(): boolean {
  return Boolean(env('AMAZON_PAAPI_ACCESS_KEY') && env('AMAZON_PAAPI_SECRET_KEY') && env('AMAZON_PAAPI_PARTNER_TAG'));
}

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(message: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message)));
}

async function hmac(key: Uint8Array, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message)));
}

async function signingKey(secretKey: string, dateStamp: string, region: string): Promise<Uint8Array> {
  const kDate = await hmac(new TextEncoder().encode(`AWS4${secretKey}`), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, SERVICE);
  return hmac(kService, 'aws4_request');
}

interface AmazonItem {
  ItemInfo?: {
    Title?: { DisplayValue?: string };
    ByLineInfo?: { Brand?: { DisplayValue?: string } };
  };
  Images?: { Primary?: { Large?: { URL?: string } } };
  Offers?: { Listings?: { Price?: { Amount?: number }; SavingBasis?: { Amount?: number } }[] };
  DetailPageURL?: string;
}

export async function searchAmazon(query: string): Promise<StoreListing[]> {
  const accessKey = env('AMAZON_PAAPI_ACCESS_KEY');
  const secretKey = env('AMAZON_PAAPI_SECRET_KEY');
  const partnerTag = env('AMAZON_PAAPI_PARTNER_TAG');
  // India defaults — PA-API signs India-marketplace requests against
  // eu-west-1, not us-east-1 (a well-documented Amazon quirk, not a typo).
  // Override via secrets for a different marketplace.
  const host = env('AMAZON_PAAPI_HOST', 'webservices.amazon.in');
  const region = env('AMAZON_PAAPI_REGION', 'eu-west-1');
  const marketplace = env('AMAZON_PAAPI_MARKETPLACE', 'www.amazon.in');

  const payload = JSON.stringify({
    Keywords: query,
    SearchIndex: 'Apparel',
    ItemCount: 10,
    PartnerTag: partnerTag,
    PartnerType: 'Associates',
    Marketplace: marketplace,
    Resources: [
      'ItemInfo.Title',
      'ItemInfo.ByLineInfo',
      'Images.Primary.Large',
      'Offers.Listings.Price',
      'Offers.Listings.SavingBasis',
    ],
  });

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=utf-8\n` +
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${TARGET}\n`;
  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';

  const canonicalRequest = [
    'POST',
    PATH,
    '',
    canonicalHeaders,
    signedHeaders,
    await sha256Hex(payload),
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const key = await signingKey(secretKey, dateStamp, region);
  const signature = toHex(await hmac(key, stringToSign));

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`https://${host}${PATH}`, {
    method: 'POST',
    headers: {
      'content-encoding': 'amz-1.0',
      'content-type': 'application/json; charset=utf-8',
      host,
      'x-amz-date': amzDate,
      'x-amz-target': TARGET,
      authorization,
    },
    body: payload,
  });

  if (!res.ok) {
    throw new Error(`Amazon PA-API search failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const items: AmazonItem[] = data?.SearchResult?.Items ?? [];

  return items
    .map((item): StoreListing | null => {
      const name = item.ItemInfo?.Title?.DisplayValue;
      const productUrl = item.DetailPageURL;
      if (!name || !productUrl) return null;
      const listing = item.Offers?.Listings?.[0];
      return {
        name,
        brand: item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue ?? 'Unknown',
        price: Math.round(listing?.Price?.Amount ?? 0),
        mrp: Math.round(listing?.SavingBasis?.Amount ?? listing?.Price?.Amount ?? 0),
        color: '',
        imageUrl: item.Images?.Primary?.Large?.URL ?? null,
        productUrl,
        store: 'Amazon',
      };
    })
    .filter((x): x is StoreListing => x !== null);
}
