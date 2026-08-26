// Shared site nav, included on every page via <script src="/nav.js" defer></script>.
// Populates #nav-links based on GET /api/auth/session. Never assumes an
// authenticated state before the session check resolves — defaults to the
// logged-out nav on any fetch failure, which is the safe choice for a nav
// that never guards page content by itself.
(() => {
  'use strict';

  async function fetchSession() {
    try {
      const res = await fetch('/api/auth/session', {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error('nav: session check failed', err);
      return null;
    }
  }

  function makeLink(href, text, className) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    a.className = className || 'site-nav-link';
    return a;
  }

  function renderLoggedOut(navLinks) {
    navLinks.innerHTML = '';

    const loginLi = document.createElement('li');
    loginLi.appendChild(makeLink('/login.html', 'Log in'));
    navLinks.appendChild(loginLi);

    const signupLi = document.createElement('li');
    signupLi.appendChild(makeLink('/signup.html', 'Sign up', 'site-nav-link site-nav-link-cta'));
    navLinks.appendChild(signupLi);
  }

  function renderLoggedIn(navLinks, session) {
    navLinks.innerHTML = '';
    const isPro = !!(session.subscription && session.subscription.plan === 'pro');

    const studioLi = document.createElement('li');
    studioLi.appendChild(makeLink('/studio.html', 'Studio'));
    navLinks.appendChild(studioLi);

    const studio3dLi = document.createElement('li');
    studio3dLi.appendChild(makeLink('/studio3d.html', 'Studio 3D'));
    navLinks.appendChild(studio3dLi);

    const accountLi = document.createElement('li');
    const accountLink = makeLink('/account.html', 'Account');
    if (isPro) {
      const badge = document.createElement('span');
      badge.className = 'pro-badge';
      badge.textContent = 'Pro';
      accountLink.appendChild(document.createTextNode(' '));
      accountLink.appendChild(badge);
    }
    accountLi.appendChild(accountLink);
    navLinks.appendChild(accountLi);

    const logoutLi = document.createElement('li');
    const logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.className = 'site-nav-link';
    logoutBtn.textContent = 'Log out';
    logoutBtn.addEventListener('click', async () => {
      logoutBtn.disabled = true;
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (err) {
        console.error('nav: logout request failed', err);
      } finally {
        window.location.href = '/';
      }
    });
    logoutLi.appendChild(logoutBtn);
    navLinks.appendChild(logoutLi);
  }

  async function initNav() {
    const navLinks = document.getElementById('nav-links');
    if (!navLinks) return;

    const session = await fetchSession();
    if (session && session.authenticated) {
      renderLoggedIn(navLinks, session);
    } else {
      renderLoggedOut(navLinks);
    }
  }

  initNav();
})();
