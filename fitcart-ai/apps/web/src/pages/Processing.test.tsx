import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
let locationState: { afterRoute?: string; sourceLink?: string | null; productId?: number | null } | null = null;

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ state: locationState }),
}));

const { default: Processing } = await import('./Processing');

// Advances in 900ms increments (Processing's own step interval), matching
// how the fake-timer clock actually gets driven in this suite — a single
// large advanceTimersByTimeAsync() call across the interval-then-nested-
// setTimeout boundary is unreliable here, so this steps through each tick
// instead of jumping straight to the end.
async function runOutTheClock(ticks: number) {
  for (let i = 0; i < ticks; i += 1) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
  }
}

describe('Processing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    navigateMock.mockReset();
    locationState = null;
  });

  it('forwards productId (alongside sourceLink) through to the afterRoute once processing completes', async () => {
    locationState = { afterRoute: '/result', sourceLink: 'https://www.myntra.com/p/1', productId: 42 };
    render(<Processing />);

    await runOutTheClock(6);

    expect(navigateMock).toHaveBeenCalledWith('/result', {
      replace: true,
      state: { sourceLink: 'https://www.myntra.com/p/1', productId: 42 },
    });
  });

  it('forwards productId: null when no product was involved (upload-only flow)', async () => {
    locationState = { afterRoute: '/result', sourceLink: null };
    render(<Processing />);

    await runOutTheClock(6);

    expect(navigateMock).toHaveBeenCalledWith('/result', {
      replace: true,
      state: { sourceLink: null, productId: null },
    });
  });
});
