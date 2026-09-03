import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
const markProfileSetupDoneMock = vi.fn();
let locationState: { sourceLink?: string | null; productId?: number | null } | null = null;

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ state: locationState }),
}));

vi.mock('../state/AppState', () => ({
  useAppState: () => ({ markProfileSetupDone: markProfileSetupDoneMock }),
}));

const { default: Setup } = await import('./Setup');

function uploadPhoto() {
  const file = new File(['x'], 'photo.png', { type: 'image/png' });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe('Setup', () => {
  afterEach(() => {
    navigateMock.mockReset();
    markProfileSetupDoneMock.mockReset();
    locationState = null;
  });

  it('forwards the productId from ProductDetail/ProductCard through to Processing, alongside sourceLink', async () => {
    locationState = { productId: 42 };
    render(<Setup />);

    uploadPhoto();
    await waitFor(() => expect(screen.getByRole('button', { name: /see it on me/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /see it on me/i }));

    expect(navigateMock).toHaveBeenCalledWith('/processing', {
      state: { afterRoute: '/result', sourceLink: null, productId: 42 },
    });
  });

  it('still forwards sourceLink (the paste-a-link flow) when there is no productId', async () => {
    locationState = { sourceLink: 'https://www.myntra.com/p/1' };
    render(<Setup />);

    uploadPhoto();
    await waitFor(() => expect(screen.getByRole('button', { name: /see it on me/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /see it on me/i }));

    expect(navigateMock).toHaveBeenCalledWith('/processing', {
      state: { afterRoute: '/result', sourceLink: 'https://www.myntra.com/p/1', productId: null },
    });
  });

  it('forwards productId: null when neither productId nor sourceLink is present', async () => {
    locationState = null;
    render(<Setup />);

    uploadPhoto();
    await waitFor(() => expect(screen.getByRole('button', { name: /see it on me/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /see it on me/i }));

    expect(navigateMock).toHaveBeenCalledWith('/processing', {
      state: { afterRoute: '/result', sourceLink: null, productId: null },
    });
  });
});
