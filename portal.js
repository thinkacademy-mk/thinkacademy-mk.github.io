'use strict';
(() => {
  const siteRoot = new URL('./', document.currentScript.src);
  const $ = id => document.getElementById(id);
  const form = $('lookup-form');
  const field = $('student-number');
  const button = $('lookup-button');
  const message = $('lookup-message');
  const studentNumberPattern = /^[0-9]{12}$/;
  const reportPathPattern = /^content-[a-f0-9]{32}\.html$/;
  const unavailableMessage = 'Your report could not be loaded. Check your connection, then try View Report again.';
  const notFoundMessage = 'No demo report found. Please use 990000000001 or 990000000002.';
  let submitting = false;
  let requestToken = 0;
  const activeControllers = new Set();

  function setMessage(text, state = '') {
    message.textContent = text;
    message.className = `lookup-message${state ? ' ' + state : ''}`;
  }

  async function reportPathFor(number, week) {
    const bytes = new TextEncoder().encode(`mk-week${week}-lv56:` + number);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    const token = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 32);
    const path = `content-${token}.html`;
    if (!reportPathPattern.test(path)) throw new Error('Invalid report path');
    return path;
  }

  async function reportExists(path, week) {
    const controller = new AbortController();
    activeControllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(new URL(path, siteRoot).href, {
        credentials: 'same-origin',
        cache: 'default',
        signal: controller.signal
      });
      if (response.status === 404) return false;
      if (!response.ok) throw new Error('Report unavailable');
      const source = await response.text();
      const document = new DOMParser().parseFromString(source, 'text/html');
      const marker = document.documentElement?.getAttribute('data-prebuilt-report');
      return marker === `week${week}-v2` || marker === `week${week}-index-v1`;
    } finally {
      clearTimeout(timeout);
      activeControllers.delete(controller);
    }
  }

  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    requestToken += 1;
    activeControllers.forEach(controller => controller.abort());
    submitting = false;
    button.disabled = false;
    button.removeAttribute('aria-busy');
    setMessage('');
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    field.removeAttribute('aria-invalid');
    const enteredNumber = field.value.trim();
    if (!studentNumberPattern.test(enteredNumber)) {
      field.setAttribute('aria-invalid', 'true');
      setMessage('Please enter the complete 12-digit Student Number. Use digits 0–9 only.', 'error');
      field.focus();
      return;
    }
    if (!window.crypto?.subtle || typeof TextEncoder !== 'function' || typeof DOMParser !== 'function') {
      setMessage('Please open the secure https:// site in Chrome or Safari, then look up your report again.', 'error');
      return;
    }
    const token = ++requestToken;
    submitting = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    setMessage('Finding your report…');
    try {
      const found = await Promise.all([2].map(async week => {
        try {
          const path = await reportPathFor(enteredNumber, week);
          if (token !== requestToken) return false;
          return await reportExists(path, week);
        } catch { return null; }
      }));
      if (token !== requestToken) return;
      if (!found.some(value => value === true)) {
        setMessage(found.some(value => value === null) ? unavailableMessage : notFoundMessage, 'error');
        return;
      }
      setMessage('Choose an available week…', 'success');
      window.location.assign(new URL(`weeks-${enteredNumber}.html`, siteRoot).href);
    } catch {
      if (token === requestToken) setMessage(unavailableMessage, 'error');
    } finally {
      if (token === requestToken) {
        submitting = false;
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    }
  });

  document.querySelectorAll('[data-demo-uid]').forEach(sample => sample.addEventListener('click', () => {
    field.value = sample.dataset.demoUid;
    field.focus();
    setMessage('Test number filled. Select View Report to continue.');
  }));
  button.disabled = false;
  button.removeAttribute('aria-busy');
  setMessage('');
})();
