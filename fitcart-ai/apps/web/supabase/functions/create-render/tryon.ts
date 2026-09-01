// Pluggable virtual try-on provider, per fitcart-ai/ai/virtual-try-on.md
// section 8 (TryOnService interface, mockable). Real inference needs a
// bake-off (doc section 5) before committing to one hosted provider — until
// FAL_API_KEY is set, mockProvider keeps the rest of the pipeline (upload,
// quota, verdict, save) fully testable without a paid key.

export interface TryOnResult {
  imageUrl: string;
}

export interface TryOnProvider {
  render(personPhotoUrl: string, garmentImageUrl: string | null): Promise<TryOnResult>;
}

// Passthrough: returns the person's own photo. Lets the UI exercise the
// full render -> verdict -> save loop with no external API call.
export const mockProvider: TryOnProvider = {
  render(personPhotoUrl) {
    return Promise.resolve({ imageUrl: personPhotoUrl });
  },
};

// UNVERIFIED against a live key — fal.ai's serverless REST contract
// (https://fal.run/{model}, `Authorization: Key <key>`) is documented for
// their models generally, but the exact input field names for
// fal-ai/idm-vton have not been confirmed against a real response here.
// Treat this as a starting point for the bake-off, not a load-bearing
// integration until it's been run against a live key.
async function falRender(personPhotoUrl: string, garmentImageUrl: string): Promise<TryOnResult> {
  const apiKey = Deno.env.get('FAL_API_KEY') ?? '';
  const res = await fetch('https://fal.run/fal-ai/idm-vton', {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      human_image_url: personPhotoUrl,
      garment_image_url: garmentImageUrl,
    }),
  });
  if (!res.ok) {
    throw new Error(`fal.ai try-on request failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const imageUrl = data?.image?.url;
  if (!imageUrl) {
    throw new Error('fal.ai try-on response had no image.url');
  }
  return { imageUrl };
}

export function getTryOnProvider(): TryOnProvider {
  const hasFalKey = Boolean(Deno.env.get('FAL_API_KEY'));
  if (!hasFalKey) return mockProvider;
  return {
    async render(personPhotoUrl, garmentImageUrl) {
      if (!garmentImageUrl) return mockProvider.render(personPhotoUrl, garmentImageUrl);
      return falRender(personPhotoUrl, garmentImageUrl);
    },
  };
}
