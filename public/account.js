// Account page. Auth-gated: redirects to /login.html?next=account if the
// session check comes back unauthenticated.
//
// Contract (functions/api/auth/session.ts, functions/api/billing/*.ts):
//   GET  /api/auth/session      -> { authenticated: boolean,
//                                     user?: { email: string },
//                                     subscription?: { plan: 'free' | 'pro' } }
//   POST /api/billing/checkout  -> 200 { status: 'ok', url }
//                                -> 401 { status: 'unauthorized' }
//                                -> 503 { status: 'not_configured' }
//   POST /api/billing/portal    -> 200 { status: 'ok', url }
//                                -> 400 { status: 'invalid_request', message } (no billing account yet)
//                                -> 401 { status: 'unauthorized' }
//                                -> 503 { status: 'not_configured' }
//
// Post-checkout handling: the checkout success_url points back here as
// /account.html?checkout=success, sent before the webhook necessarily
// finished writing the subscription row, so this polls the session endpoint
// a few times rather than showing stale "Free" status right after checkout.
(() => {
  'use strict';

  const loadingEl = document.getElementById('account-loading');
  const contentEl = document.getElementById('account-content');
  const emailEl = document.getElementById('account-email');
  const planEl = document.getElementById('account-plan');
  const actionBtn = document.getElementById('account-action-btn');
  const confirmingEl = document.getElementById('account-confirming');
  const banner = document.getElementById('account-status-banner');
  const bannerText = document.getElementById('account-status-banner-text');

  const POLL_INTERVAL_MS = 1500;
  const MAX_POLL_ATTEMPTS = 5;

  function redirectToLogin() {
    window.location.href = '/login.html?next=account';
  }

  async function fetchSession() {
    const res = await fetch('/api/auth/session', { headers: { Accept: 'application/json' } });
    return res.json();
  }

  function hideBanner() {
    banner.hidden = true;
  }

  function showBanner(kind, text) {
    banner.className = 'banner ' + (kind === 'error' ? 'banner-error' : 'banner-info');
    banner.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    bannerText.textContent = text;
    banner.hidden = false;
  }

  function isPro(session) {
    return !!(session && session.subscription && session.subscription.plan === 'pro');
  }

  function renderAccount(session) {
    loadingEl.hidden = true;
    contentEl.hidden = false;

    emailEl.textContent = (session.user && session.user.email) || '—';

    const pro = isPro(session);
    planEl.textContent = pro ? 'Pro' : 'Free';

    actionBtn.hidden = false;
    actionBtn.disabled = false;
    actionBtn.dataset.action = pro ? 'portal' : 'checkout';
    actionBtn.textContent = pro ? 'Manage subscription' : 'Upgrade to Pro';
  }

  async function handleAction() {
    const action = actionBtn.dataset.action;
    const endpoint = action === 'portal' ? '/api/billing/portal' : '/api/billing/checkout';
    const originalLabel = actionBtn.textContent;
    actionBtn.disabled = true;
    actionBtn.textContent = action === 'portal' ? 'Opening…' : 'Redirecting…';
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
        redirectToLogin();
        return;
      }

      if (json && json.status === 'not_configured') {
        showBanner('info', "Payments aren't live yet — check back soon.");
        actionBtn.disabled = false;
        actionBtn.textContent = originalLabel;
        return;
      }

      if (json && typeof json.url === 'string' && json.url) {
        window.location.href = json.url;
        return;
      }

      if (json && json.message) {
        showBanner('error', json.message);
        actionBtn.disabled = false;
        actionBtn.textContent = originalLabel;
        return;
      }

      throw new Error('Unexpected billing response');
    } catch (err) {
      console.error('account: billing action failed', err);
      showBanner('error', 'Something went wrong. Please try again.');
      actionBtn.disabled = false;
      actionBtn.textContent = originalLabel;
    }
  }

  async function pollForPro(attemptsLeft) {
    if (attemptsLeft <= 0) {
      confirmingEl.hidden = true;
      showBanner(
        'info',
        "Still confirming your subscription — this can take a minute. Refresh this page shortly if it doesn't update."
      );
      actionBtn.hidden = false;
      return;
    }

    let session;
    try {
      session = await fetchSession();
    } catch (err) {
      console.error('account: session poll failed', err);
      confirmingEl.hidden = true;
      actionBtn.hidden = false;
      return;
    }

    if (!session.authenticated) {
      redirectToLogin();
      return;
    }

    if (isPro(session)) {
      confirmingEl.hidden = true;
      renderAccount(session);
      return;
    }

    window.setTimeout(() => pollForPro(attemptsLeft - 1), POLL_INTERVAL_MS);
  }

  async function init() {
    let session;
    try {
      session = await fetchSession();
    } catch (err) {
      console.error('account: session check failed', err);
      redirectToLogin();
      return;
    }

    if (!session || !session.authenticated) {
      redirectToLogin();
      return;
    }

    renderAccount(session);
    actionBtn.addEventListener('click', handleAction);

    const params = new URLSearchParams(window.location.search);
    const checkoutParam = params.get('checkout');

    // Stripe Checkout's success_url points here; cancel_url points back to
    // /pricing.html instead, so "cancelled" is handled there, not here.
    if (checkoutParam === 'success' && !isPro(session)) {
      confirmingEl.hidden = false;
      actionBtn.hidden = true;
      pollForPro(MAX_POLL_ATTEMPTS);
    }
  }

  init();
})();
