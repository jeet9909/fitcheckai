// Signup page.
//
// Contract (functions/api/auth/signup.ts):
//   POST /api/auth/signup { email, password }
//     -> 201 { status: 'ok', user: {...} }
//     -> 409 { status: 'email_taken' }
//     -> 503 { status: 'not_configured' } (SESSION_SECRET missing)
//
// The 8-character minimum below is a UX hint only — the real validation
// boundary is server-side, same as everywhere else in this app.
//
// `?next=` only ever holds a known short keyword (never a raw URL) so this
// page can't be used as an open redirect.
(() => {
  'use strict';

  const form = document.getElementById('signup-form');
  const emailInput = document.getElementById('signup-email');
  const passwordInput = document.getElementById('signup-password');
  const errorEl = document.getElementById('signup-error');
  const submitBtn = document.getElementById('signup-submit-btn');

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

  function hideError() {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  function showGenericError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function showEmailTakenError() {
    errorEl.textContent = '';
    errorEl.appendChild(document.createTextNode('That email is already registered. '));
    const link = document.createElement('a');
    link.href = '/login.html';
    link.textContent = 'Log in instead';
    errorEl.appendChild(link);
    errorEl.hidden = false;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) return;

    if (password.length < 8) {
      showGenericError('Password must be at least 8 characters.');
      return;
    }

    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing up…';

    try {
      const res = await fetch('/api/auth/signup', {
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

      if (json && json.status === 'email_taken') {
        showEmailTakenError();
      } else if (json && json.status === 'not_configured') {
        showGenericError("Accounts aren't set up yet — check back soon.");
      } else if (json && json.status === 'invalid_request' && json.message) {
        showGenericError(json.message);
      } else {
        showGenericError("Couldn't create your account. Please try again.");
      }
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    } catch (err) {
      console.error('signup: request failed', err);
      showGenericError("Couldn't reach the server. Please check your connection and try again.");
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
})();
