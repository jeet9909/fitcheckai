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
    await waitFor(() => expect(screen.getByRole('button', { name: /create my try-on/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /create my try-on/i }));

    expect(navigateMock).toHaveBeenCalledWith('/processing', {
      state: { afterRoute: '/result', sourceLink: null, productId: 42 },
    });
  });

  it('still forwards sourceLink (the paste-a-link flow) when there is no productId', async () => {
    locationState = { sourceLink: 'https://www.myntra.com/p/1' };
    render(<Setup />);

    uploadPhoto();
    await waitFor(() => expect(screen.getByRole('button', { name: /create my try-on/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /create my try-on/i }));

    expect(navigateMock).toHaveBeenCalledWith('/processing', {
      state: { afterRoute: '/result', sourceLink: 'https://www.myntra.com/p/1', productId: null },
    });
  });

  it('forwards productId: null when neither productId nor sourceLink is present', async () => {
    locationState = null;
    render(<Setup />);

    uploadPhoto();
    await waitFor(() => expect(screen.getByRole('button', { name: /create my try-on/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /create my try-on/i }));

    expect(navigateMock).toHaveBeenCalledWith('/processing', {
      state: { afterRoute: '/result', sourceLink: null, productId: null },
    });
  });

  it('accepts a photo dropped onto the dropzone (drag-and-drop), not just click-to-choose', async () => {
    render(<Setup />);
    const dropzone = screen.getByText(/drop a photo here/i).closest('div') as HTMLElement;
    const file = new File(['x'], 'photo.png', { type: 'image/png' });

    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    await waitFor(() => expect(screen.getByRole('button', { name: /create my try-on/i })).not.toBeDisabled());
  });

  it('calls preventDefault on dragover so the browser does not navigate away with the file', () => {
    render(<Setup />);
    const dropzone = screen.getByText(/drop a photo here/i).closest('div') as HTMLElement;
    const dragOverEvent = Object.assign(new Event('dragover', { bubbles: true, cancelable: true }), {
      dataTransfer: { files: [] },
    });
    const preventDefaultSpy = vi.spyOn(dragOverEvent, 'preventDefault');

    fireEvent(dropzone, dragOverEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('rejects a non-JPG/PNG file with an inline error and does not enable submit', () => {
    render(<Setup />);
    const file = new File(['x'], 'photo.gif', { type: 'image/gif' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByRole('alert')).toHaveTextContent(/jpg or png/i);
    expect(screen.getByRole('button', { name: /create my try-on/i })).toBeDisabled();
  });

  it('rejects a file over 12 MB with an inline error and does not enable submit', () => {
    render(<Setup />);
    const oversizedFile = new File(['x'], 'photo.png', { type: 'image/png' });
    Object.defineProperty(oversizedFile, 'size', { value: 13 * 1024 * 1024 });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [oversizedFile] } });

    expect(screen.getByRole('alert')).toHaveTextContent(/12 ?mb/i);
    expect(screen.getByRole('button', { name: /create my try-on/i })).toBeDisabled();
  });

  it('rejects an oversized file dropped onto the dropzone too (validation applies to drag-and-drop)', () => {
    render(<Setup />);
    const dropzone = screen.getByText(/drop a photo here/i).closest('div') as HTMLElement;
    const oversizedFile = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(oversizedFile, 'size', { value: 13 * 1024 * 1024 });

    fireEvent.drop(dropzone, { dataTransfer: { files: [oversizedFile] } });

    expect(screen.getByRole('alert')).toHaveTextContent(/12 ?mb/i);
    expect(screen.getByRole('button', { name: /create my try-on/i })).toBeDisabled();
  });
});
