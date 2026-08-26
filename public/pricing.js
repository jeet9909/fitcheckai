// Pricing page: drives the Pro card's call-to-action button based on the
// visitor's session/subscription state.
//
// Contract (functions/api/auth/session.ts, functions/api/billing/*.ts):
//   GET  /api/auth/session      -> { authenticated: boolean, user?: {...},
//                                     subscription?: { plan: 'free' | 'pro' } }
//   POST /api/billing/checkout  -> 200 { status: 'ok', url }
//                                -> 401 { status: 'unauthorized' }
//                                -> 503 { status: 'not_configured' }
//   POST /api/billing/portal    -> 200 { status: 'ok', url }
//                                -> 400 { status: 'invalid_request', message } (no billing account yet)
//                                -> 401 { status: 'unauthorized' }
//                                -> 503 { status: 'not_configured' }
//
// Stripe Checkout's cancel_url points back here as
// /pricing.html?checkout=cancelled — handled on load below.
(() => {
  'use strict';

  const ctaBtn = document.getElementById('pro-cta-btn');
  const statusEl = document.getElementById('pro-plan-status');
  const banner = document.getElementById('pricing-billing-banner');
  const bannerText = document.getElementById('pricing-billing-banner-text');

  function hideBanner() {
    banner.hidden = true;
  }

  function showBanner(kind, text) {
    banner.className = 'banner ' + (kind === 'error' ? 'banner-error' : 'banner-info');
    banner.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    bannerText.textContent = text;
    banner.hidden = false;
  }

  async function fetchSession() {
    try {
      const res = await fetch('/api/auth/session', { headers: { Accept: 'application/json' } });
      if (!res.ok) return { authenticated: false };
      return await res.json();
    } catch (err) {
      console.error('pricing: session check failed', err);
      return { authenticated: false };
    }
  }

  async function handleCtaClick(isAuthed, action) {
    if (!isAuthed) {
      window.location.href = '/signup.html?next=pricing';
      return;
    }

    const endpoint = action === 'portal' ? '/api/billing/portal' : '/api/billing/checkout';
    const originalLabel = ctaBtn.textContent;
    ctaBtn.disabled = true;
    ctaBtn.textContent = action === 'portal' ? 'Opening…' : 'Redirecting…';
    hideBanner();

    try {
      const res = await fetch(endpoint, { method: 'POST' });
      let json = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (json && json.status === 'unauthorized') {
        window.location.href = '/login.html?next=pricing';
        return;
      }

      if (json && json.status === 'not_configured') {
        showBanner('info', "Payments aren't live yet — check back soon.");
        ctaBtn.disabled = false;
        ctaBtn.textContent = originalLabel;
        return;
      }

      if (json && typeof json.url === 'string' && json.url) {
        window.location.href = json.url;
        return;
      }

      if (json && json.message) {
        showBanner('error', json.message);
        ctaBtn.disabled = false;
        ctaBtn.textContent = originalLabel;
        return;
      }

      throw new Error('Unexpected billing response');
    } catch (err) {
      console.error('pricing: billing action failed', err);
      showBanner('error', "Something went wrong. Please try again.");
      ctaBtn.disabled = false;
      ctaBtn.textContent = originalLabel;
    }
  }

  async function init() {
    const session = await fetchSession();
    const isAuthed = !!session.authenticated;
    const isPro = isAuthed && !!(session.subscription && session.subscription.plan === 'pro');

    if (isPro) {
      statusEl.hidden = false;
      ctaBtn.textContent = 'Manage subscription';
    } else {
      ctaBtn.textContent = 'Upgrade to Pro';
    }
    ctaBtn.disabled = false;

    const action = isPro ? 'portal' : 'checkout';
    ctaBtn.addEventListener('click', () => handleCtaClick(isAuthed, action));

    const params = new URLSearchParams(window.location.search);
    const checkoutParam = params.get('checkout');
    if (checkoutParam === 'cancelled' || checkoutParam === 'canceled') {
      showBanner('info', 'Checkout was cancelled — you can upgrade any time.');
    }
  }

  init();
})();
