// Login page.
//
// Contract (functions/api/auth/login.ts):
//   POST /api/auth/login { email, password }
//     -> 200 { status: 'ok', user: {...}, subscription: {...} }
//     -> 401 { status: 'invalid_credentials' }
//     -> 403 { status: 'forbidden' } (cross-origin request)
//     -> 503 { status: 'not_configured' } (SESSION_SECRET missing)
//
// `?next=` only ever holds a known short keyword (never a raw URL) so this
// page can't be used as an open redirect.
(() => {
  'use strict';

  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit-btn');

  const NEXT_DESTINATIONS = {
    account: '/account.html',
    pricing: '/pricing.html',
    studio3d: '/studio3d.html',
  };

  function resolveNextDestination() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get('next');
    return (next && NEXT_DESTINATIONS[next]) || '/account.html';
  }

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function hideError() {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) return;

    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in…';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      let json = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (res.ok && json && json.status === 'ok' && json.user) {
        window.location.href = resolveNextDestination();
        return;
      }

      if (json && json.status === 'invalid_credentials') {
        showError('Incorrect email or password.');
      } else if (json && json.status === 'not_configured') {
        showError("Accounts aren't set up yet — check back soon.");
      } else {
        showError("Couldn't log in. Please try again.");
      }
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    } catch (err) {
      console.error('login: request failed', err);
      showError("Couldn't reach the server. Please check your connection and try again.");
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
})();
