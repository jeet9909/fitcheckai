import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
const createTryOnMock = vi.fn();
let locationState: { afterRoute?: string; sourceLink?: string | null; productId?: number | null } | null = null;

const tryOn = {
  id: 'tryon-1', anonymous_user_id: 'user-1', category: 'shirt', product_source: 'upload' as const,
  product_url: null, person_image_url: 'https://example.com/person', product_image_url: 'https://example.com/product',
  result_image_url: 'https://example.com/result', model: 'gemini-3.1-flash-image', created_at: '2026-09-23T00:00:00Z',
};

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ state: locationState }),
}));

vi.mock('../lib/fitcartApi', () => ({
  createTryOn: (...args: unknown[]) => createTryOnMock(...args),
  saveLatestTryOn: vi.fn(),
}));

vi.mock('../lib/tryOnDraft', () => ({
  getTryOnDraft: () => ({ personImage: new File(['x'], 'person.png'), productImage: new File(['x'], 'product.png'), category: 'shirt' }),
  clearTryOnDraft: vi.fn(),
}));

const { default: Processing } = await import('./Processing');

describe('Processing', () => {
  afterEach(() => {
    navigateMock.mockReset();
    createTryOnMock.mockReset();
    locationState = null;
  });

  it('calls the real try-on client and forwards the generated result', async () => {
    createTryOnMock.mockResolvedValue(tryOn);
    locationState = { afterRoute: '/result', sourceLink: 'https://www.myntra.com/p/1', productId: 42 };
    render(<Processing />);

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/result', {
      replace: true,
      state: { sourceLink: 'https://www.myntra.com/p/1', productId: 42, tryOn },
    }));
    expect(createTryOnMock).toHaveBeenCalledOnce();
  });

  it('shows an API failure instead of navigating to a fake result', async () => {
    createTryOnMock.mockRejectedValue(new Error('Gemini image generation failed'));
    render(<Processing />);

    await waitFor(() => expect(document.body).toHaveTextContent('Gemini image generation failed'));
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
