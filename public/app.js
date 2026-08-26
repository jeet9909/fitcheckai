(() => {
  'use strict';

  // ---------- Constants ----------
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_FILE_BYTES = 6 * 1024 * 1024; // 6MB
  const REQUEST_TIMEOUT_MS = 35000; // slightly longer than the server's 30s budget
  const NOT_CONFIGURED_DEFAULT_MESSAGE =
    "AI provider isn't configured yet — this demo can't generate a live preview until the API key is added.";
  // Purely presentational copy shown while waiting on /api/tryon — cycles on a timer.
  // There is no real progress signal from the server, so this never claims completion.
  const LOADING_MESSAGES = [
    'Analyzing your photo…',
    'Matching the fit and lighting…',
    'Blending the garment onto you…',
    'Rendering your look…',
  ];
  const LOADING_MESSAGE_INTERVAL_MS = 3200;
  const PROGRESS_TICK_MS = 400;
  const PROGRESS_CAP_PERCENT = 92; // never reaches 100% until the real response arrives

  // ---------- Element refs ----------
  const personInput = document.getElementById('person-input');
  const garmentInput = document.getElementById('garment-input');
  const personDropzone = document.getElementById('person-dropzone');
  const garmentDropzone = document.getElementById('garment-dropzone');
  const personDropzoneContent = document.getElementById('person-dropzone-content');
  const garmentDropzoneContent = document.getElementById('garment-dropzone-content');
  const personPreview = document.getElementById('person-preview');
  const garmentPreview = document.getElementById('garment-preview');
  const personHelp = document.getElementById('person-help');
  const garmentHelp = document.getElementById('garment-help');
  const personAcceptBadge = document.getElementById('person-accept-badge');
  const garmentAcceptBadge = document.getElementById('garment-accept-badge');

  const submitBtn = document.getElementById('submit-btn');
  const loadingState = document.getElementById('loading-state');
  const loadingStatusText = document.getElementById('loading-status-text');
  const progressBar = document.getElementById('progress-bar');

  const bannerNotConfigured = document.getElementById('banner-not-configured');
  const bannerNotConfiguredText = document.getElementById('banner-not-configured-text');
  const bannerError = document.getElementById('banner-error');
  const retryBtn = document.getElementById('retry-btn');

  const resultSection = document.getElementById('result-section');
  const resultImage = document.getElementById('result-image');
  const downloadBtn = document.getElementById('download-btn');
  const tryAnotherBtn = document.getElementById('try-another-btn');
  const revealStage = document.getElementById('reveal-stage');
  const revealBeforeImg = document.getElementById('reveal-before');

  const feedbackSection = document.getElementById('feedback-section');
  const feedbackForm = document.getElementById('feedback-form');
  const feedbackSubmitBtn = document.getElementById('feedback-submit-btn');
  const feedbackThanks = document.getElementById('feedback-thanks');
  const feedbackError = document.getElementById('feedback-error');

  // ---------- State ----------
  /** @type {'idle'|'ready'|'loading'|'success'|'not_configured'|'error'} */
  let phase = 'idle';
  let personImage = null; // { mimeType, data, dataUrl }
  let garmentImage = null; // { mimeType, data, dataUrl }
  let feedbackSubmitted = false;
  let loadingMessageTimer = null;
  let progressTimer = null;
  let progressPercent = 0;

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ---------- Rendering ----------
  function render() {
    bannerNotConfigured.hidden = phase !== 'not_configured';
    bannerError.hidden = phase !== 'error';
    loadingState.hidden = phase !== 'loading';
    resultSection.hidden = phase !== 'success';
    feedbackSection.hidden = phase !== 'success';
    submitBtn.disabled = !(personImage && garmentImage) || phase === 'loading';
  }

  function setPhaseFromImages() {
    phase = personImage && garmentImage ? 'ready' : 'idle';
    render();
  }

  // ---------- Loading animation (purely presentational; no real progress data exists) ----------
  function startLoadingAnimation() {
    let messageIndex = 0;
    loadingStatusText.textContent = LOADING_MESSAGES[0];
    window.clearInterval(loadingMessageTimer);
    loadingMessageTimer = window.setInterval(() => {
      messageIndex = (messageIndex + 1) % LOADING_MESSAGES.length;
      loadingStatusText.textContent = LOADING_MESSAGES[messageIndex];
    }, LOADING_MESSAGE_INTERVAL_MS);

    progressPercent = 0;
    progressBar.style.width = '0%';
    window.clearInterval(progressTimer);
    progressTimer = window.setInterval(() => {
      // Eases toward (but never reaches) the cap — never presented as real progress.
      progressPercent += (PROGRESS_CAP_PERCENT - progressPercent) * 0.1 + 0.6;
      if (progressPercent > PROGRESS_CAP_PERCENT) progressPercent = PROGRESS_CAP_PERCENT;
      progressBar.style.width = `${progressPercent}%`;
    }, PROGRESS_TICK_MS);
  }

  function stopLoadingAnimation(succeeded) {
    window.clearInterval(loadingMessageTimer);
    window.clearInterval(progressTimer);
    loadingMessageTimer = null;
    progressTimer = null;
    if (succeeded) {
      progressBar.style.width = '100%';
      window.setTimeout(() => {
        progressBar.style.width = '0%';
      }, 350);
    } else {
      progressBar.style.width = '0%';
    }
  }

  // ---------- Dropzone micro-interactions ----------
  function pulseDropzone(dropzoneEl, className, durationMs) {
    dropzoneEl.classList.remove(className);
    // Force reflow so the animation can be retriggered on repeated attempts.
    void dropzoneEl.offsetWidth;
    dropzoneEl.classList.add(className);
    window.setTimeout(() => dropzoneEl.classList.remove(className), durationMs);
  }

  // ---------- Validation & encoding ----------
  function validateFile(file) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: 'Please upload a JPG, PNG, or WEBP image.' };
    }
    if (file.size > MAX_FILE_BYTES) {
      return { valid: false, error: 'Image must be under 6MB.' };
    }
    return { valid: true };
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        const commaIndex = dataUrl.indexOf(',');
        const meta = dataUrl.slice(0, commaIndex);
        const data = dataUrl.slice(commaIndex + 1);
        const mimeMatch = /^data:(.*?);base64$/.exec(meta);
        const mimeType = mimeMatch ? mimeMatch[1] : file.type;
        resolve({ mimeType, data, dataUrl });
      };
      reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
      reader.readAsDataURL(file);
    });
  }

  function showPreview(kind, dataUrl) {
    const previewEl = kind === 'person' ? personPreview : garmentPreview;
    const contentEl = kind === 'person' ? personDropzoneContent : garmentDropzoneContent;
    const dropzoneEl = kind === 'person' ? personDropzone : garmentDropzone;
    const badgeEl = kind === 'person' ? personAcceptBadge : garmentAcceptBadge;
    previewEl.src = dataUrl;
    previewEl.hidden = false;
    contentEl.hidden = true;
    dropzoneEl.classList.add('has-image');
    badgeEl.hidden = false;
    pulseDropzone(dropzoneEl, 'accepted', 500);
  }

  async function handleFile(kind, file) {
    const helpEl = kind === 'person' ? personHelp : garmentHelp;
    const dropzoneEl = kind === 'person' ? personDropzone : garmentDropzone;
    helpEl.textContent = '';

    const { valid, error } = validateFile(file);
    if (!valid) {
      helpEl.textContent = error;
      pulseDropzone(dropzoneEl, 'rejected', 500);
      return;
    }

    try {
      const encoded = await fileToBase64(file);
      if (kind === 'person') {
        personImage = encoded;
      } else {
        garmentImage = encoded;
      }
      showPreview(kind, encoded.dataUrl);
      if (phase !== 'loading') {
        setPhaseFromImages();
      }
    } catch (err) {
      console.error('Failed to read file for', kind, err);
      helpEl.textContent = "Couldn't read that file. Please try another image.";
      pulseDropzone(dropzoneEl, 'rejected', 500);
    }
  }

  // ---------- Dropzone wiring ----------
  function setupDropzone(kind, dropzoneEl, inputEl) {
    dropzoneEl.addEventListener('click', () => inputEl.click());

    dropzoneEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        inputEl.click();
      }
    });

    inputEl.addEventListener('change', () => {
      const file = inputEl.files && inputEl.files[0];
      if (file) handleFile(kind, file);
      inputEl.value = '';
    });

    dropzoneEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzoneEl.classList.add('dragover');
    });

    dropzoneEl.addEventListener('dragleave', () => {
      dropzoneEl.classList.remove('dragover');
    });

    dropzoneEl.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzoneEl.classList.remove('dragover');
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleFile(kind, file);
    });
  }

  setupDropzone('person', personDropzone, personInput);
  setupDropzone('garment', garmentDropzone, garmentInput);

  // ---------- Submit / tryon request ----------
  async function onSubmit() {
    if (!personImage || !garmentImage || phase === 'loading') return;

    phase = 'loading';
    render();
    startLoadingAnimation();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch('/api/tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personImage: { mimeType: personImage.mimeType, data: personImage.data },
          garmentImage: { mimeType: garmentImage.mimeType, data: garmentImage.data },
        }),
        signal: controller.signal,
      });

      let json;
      try {
        json = await res.json();
      } catch (parseErr) {
        console.error('Failed to parse /api/tryon response body', parseErr);
        stopLoadingAnimation(false);
        phase = 'error';
        render();
        return;
      }

      handleTryonResponse(json);
    } catch (err) {
      if (err && err.name === 'AbortError') {
        console.error('tryon request timed out after', REQUEST_TIMEOUT_MS, 'ms');
      } else {
        console.error('tryon request failed', err);
      }
      stopLoadingAnimation(false);
      phase = 'error';
      render();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function triggerReveal() {
    revealBeforeImg.src = personImage ? personImage.dataUrl : '';
    revealStage.classList.remove('revealed', 'badge-visible');
    // Force reflow so the reveal can replay on a second/third generation this session.
    void revealStage.offsetWidth;
    const reduceMotion = prefersReducedMotion();
    window.requestAnimationFrame(() => {
      revealStage.classList.add('revealed');
      window.setTimeout(
        () => revealStage.classList.add('badge-visible'),
        reduceMotion ? 0 : 250
      );
    });
  }

  function handleTryonResponse(json) {
    const status = json && json.status;
    stopLoadingAnimation(status === 'ok');

    switch (status) {
      case 'ok': {
        const image = json.image || {};
        const dataUrl = `data:${image.mimeType};base64,${image.data}`;
        resultImage.src = dataUrl;
        downloadBtn.href = dataUrl;
        const ext = (image.mimeType || 'image/png').split('/')[1] || 'png';
        downloadBtn.setAttribute('download', `fitcheck-result.${ext}`);
        phase = 'success';
        render();
        triggerReveal();
        prepareFeedbackFormForResult();
        break;
      }
      case 'not_configured':
        bannerNotConfiguredText.textContent = json.message || NOT_CONFIGURED_DEFAULT_MESSAGE;
        phase = 'not_configured';
        render();
        break;
      case 'invalid_request':
      case 'provider_error':
      default:
        console.error('tryon returned an error status', status, json);
        phase = 'error';
        render();
        break;
    }
  }

  submitBtn.addEventListener('click', onSubmit);

  retryBtn.addEventListener('click', () => {
    setPhaseFromImages();
  });

  // Lets the user explore another garment on the same person photo without a
  // page reload — keeps the person image (the costlier one to redo) and only
  // clears the garment slot, so the flow continues rather than starting over.
  function handleTryAnotherOutfit() {
    garmentImage = null;
    garmentPreview.hidden = true;
    garmentPreview.src = '';
    garmentDropzoneContent.hidden = false;
    garmentDropzone.classList.remove('has-image', 'accepted', 'rejected');
    garmentAcceptBadge.hidden = true;
    garmentHelp.textContent = '';
    revealStage.classList.remove('revealed', 'badge-visible');
    setPhaseFromImages();
    garmentDropzone.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'center',
    });
    garmentDropzone.focus();
  }

  tryAnotherBtn.addEventListener('click', handleTryAnotherOutfit);

  // ---------- Feedback form ----------
  function setFeedbackControlsDisabled(disabled) {
    feedbackForm.querySelectorAll('input, textarea, button').forEach((el) => {
      el.disabled = disabled;
    });
  }

  // Purely visual: highlights the chosen radio "chip" and gives it a small pop.
  feedbackForm.addEventListener('change', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement) || target.type !== 'radio') return;
    const group = feedbackForm.querySelectorAll(`input[name="${target.name}"]`);
    group.forEach((input) => {
      const label = input.closest('.radio-option');
      if (label) label.classList.toggle('selected', input.checked);
    });
    const selectedLabel = target.closest('.radio-option');
    if (selectedLabel && !prefersReducedMotion()) {
      selectedLabel.classList.remove('pop');
      void selectedLabel.offsetWidth;
      selectedLabel.classList.add('pop');
    }
  });

  function prepareFeedbackFormForResult() {
    if (feedbackSubmitted) {
      setFeedbackControlsDisabled(true);
      feedbackThanks.hidden = false;
      feedbackError.hidden = true;
      return;
    }
    feedbackForm.reset();
    feedbackForm.querySelectorAll('.radio-option').forEach((label) => {
      label.classList.remove('selected', 'pop');
    });
    setFeedbackControlsDisabled(false);
    feedbackThanks.hidden = true;
    feedbackError.hidden = true;
  }

  feedbackForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (feedbackSubmitted) return;

    feedbackError.hidden = true;

    const formData = new FormData(feedbackForm);
    const looksLikeYou = formData.get('looksLikeYou');
    const wouldAffectPurchase = formData.get('wouldAffectPurchase');
    if (!looksLikeYou || !wouldAffectPurchase) {
      return; // native `required` validation handles messaging
    }

    const originalLabel = feedbackSubmitBtn.textContent;
    feedbackSubmitBtn.disabled = true;
    feedbackSubmitBtn.textContent = 'Submitting…';

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          looksLikeYou: looksLikeYou === 'yes',
          wouldAffectPurchase: wouldAffectPurchase === 'yes',
          comment: String(formData.get('comment') || ''),
          timestamp: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        throw new Error(`Feedback request failed with status ${res.status}`);
      }

      feedbackSubmitted = true;
      setFeedbackControlsDisabled(true);
      feedbackThanks.hidden = false;
    } catch (err) {
      console.error('feedback submission failed', err);
      feedbackError.hidden = false;
      feedbackSubmitBtn.disabled = false;
      feedbackSubmitBtn.textContent = originalLabel;
    }
  });

  // ---------- Initial render ----------
  render();
})();
