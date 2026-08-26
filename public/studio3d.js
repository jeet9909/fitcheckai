// Studio 3D page — honest "coming soon" placeholder with a waitlist capture.
// No real 3D generation exists yet (see BRIEF.md); this page's only job is
// presentation plus collecting waitlist emails via POST /api/waitlist.
//
// Contract:
//   GET  /api/auth/session -> { status: 'ok', authenticated: boolean,
//                                user?: { id, email }, subscription?: { plan, status } }
//   POST /api/waitlist { email, timestamp } -> 200 { status: 'ok' } on success,
//                                    { status: 'invalid_request', message } on failure
(() => {
  'use strict';

  const loadingEl = document.getElementById('studio3d-loading');
  const anonSection = document.getElementById('studio3d-anon');
  const freeSection = document.getElementById('studio3d-free');
  const proSection = document.getElementById('studio3d-pro');

  const freeForm = document.getElementById('studio3d-waitlist-form');
  const freeEmailInput = document.getElementById('studio3d-email');
  const freeError = document.getElementById('studio3d-error');
  const freeSubmitBtn = document.getElementById('studio3d-submit-btn');
  const freeThanks = document.getElementById('studio3d-thanks');

  const proBtn = document.getElementById('studio3d-pro-btn');
  const proError = document.getElementById('studio3d-pro-error');
  const proThanks = document.getElementById('studio3d-pro-thanks');
  const proEmailEl = document.getElementById('studio3d-pro-email');

  async function submitWaitlist(email) {
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, timestamp: new Date().toISOString() }),
    });

    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (res.ok && (!json || json.status === undefined || json.status === 'ok')) {
      return { ok: true };
    }

    return { ok: false, message: json && json.message ? json.message : null };
  }

  function showSection(section) {
    loadingEl.hidden = true;
    anonSection.hidden = section !== 'anon';
    freeSection.hidden = section !== 'free';
    proSection.hidden = section !== 'pro';
  }

  function wireFreeForm() {
    freeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      freeError.hidden = true;

      const email = freeEmailInput.value.trim();
      if (!email) return;

      const originalLabel = freeSubmitBtn.textContent;
      freeSubmitBtn.disabled = true;
      freeSubmitBtn.textContent = 'Joining…';

      try {
        const result = await submitWaitlist(email);
        if (result.ok) {
          freeForm.hidden = true;
          freeThanks.hidden = false;
        } else {
          freeError.textContent = result.message || "Couldn't join the waitlist. Please try again.";
          freeError.hidden = false;
          freeSubmitBtn.disabled = false;
          freeSubmitBtn.textContent = originalLabel;
        }
      } catch (err) {
        console.error('studio3d: waitlist submission failed', err);
        freeError.textContent = "Couldn't reach the server. Please check your connection and try again.";
        freeError.hidden = false;
        freeSubmitBtn.disabled = false;
        freeSubmitBtn.textContent = originalLabel;
      }
    });
  }

  function wireProButton(email) {
    proEmailEl.textContent = email || 'your account email';
    proBtn.addEventListener('click', async () => {
      proError.hidden = true;
      const originalLabel = proBtn.textContent;
      proBtn.disabled = true;
      proBtn.textContent = 'Confirming…';

      try {
        const result = await submitWaitlist(email);
        if (result.ok) {
          proBtn.hidden = true;
          proThanks.hidden = false;
        } else {
          proError.textContent = result.message || "Couldn't confirm your spot. Please try again.";
          proError.hidden = false;
          proBtn.disabled = false;
          proBtn.textContent = originalLabel;
        }
      } catch (err) {
        console.error('studio3d: waitlist submission failed', err);
        proError.textContent = "Couldn't reach the server. Please check your connection and try again.";
        proError.hidden = false;
        proBtn.disabled = false;
        proBtn.textContent = originalLabel;
      }
    });
  }

  async function init() {
    let session;
    try {
      const res = await fetch('/api/auth/session', { headers: { Accept: 'application/json' } });
      session = res.ok ? await res.json() : { authenticated: false };
    } catch (err) {
      console.error('studio3d: session check failed', err);
      session = { authenticated: false };
    }

    if (!session.authenticated) {
      showSection('anon');
      return;
    }

    const email = (session.user && session.user.email) || '';
    const isPro = !!(session.subscription && session.subscription.plan === 'pro');

    if (isPro) {
      showSection('pro');
      wireProButton(email);
    } else {
      showSection('free');
      if (email) freeEmailInput.value = email;
      wireFreeForm();
    }
  }

  init();
})();
