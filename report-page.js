'use strict';
(() => {
  const siteRoot = new URL('./', document.currentScript.src);
  const selectionKey = 'mk-weekly-report-week-2';
  const reportAssetVersion = '33';
  const pathPattern = /^content-[a-f0-9]{32}\.html$/;
  const directPath = document.documentElement.dataset.reportPath;
  const isDirectReport = typeof directPath === 'string';
  const permanentUrlPattern = /^\/reports\/week-2\/(?:level-(?:1-2|3-4|5-6)\/)?[0-9]{12}\/$/;
  let permanentLinks = {};
  if (isDirectReport) {
    try {
      const links = JSON.parse(document.documentElement.dataset.reportLinks || '{}');
      for (const [path, url] of Object.entries(links)) {
        if (pathPattern.test(path) && typeof url === 'string' && permanentUrlPattern.test(url)) {
          permanentLinks[path] = url;
        }
      }
    } catch { /* Invalid optional navigation never changes the bound report. */ }
  }
  const reportMarkers = new Set(['week2-v2', 'week2-index-v1']);
  const status = document.getElementById('report-status');
  const empty = document.getElementById('report-empty');
  const wrap = document.getElementById('report-frame-wrap');
  const origin = location.origin;
  let frame = null;
  let timer = null;
  let boundPath = null;
  const recover = message => {
    clearTimeout(timer);
    wrap.replaceChildren();
    frame = null;
    status.hidden = true;
    document.getElementById('empty-message').textContent = message;
    empty.hidden = false;
  };
  const setHeight = height => {
    if (frame && Number.isFinite(height) && height >= 200 && height <= 20000) {
      frame.style.height = `${Math.ceil(height)}px`;
    }
  };
  const ready = title => {
    clearTimeout(timer);
    if (typeof title === 'string' && title.trim()) document.title = title;
    status.hidden = true;
  };
  document.querySelectorAll('[data-clear-selection]').forEach(link => link.addEventListener('click', () => {
    try {
      sessionStorage.removeItem(selectionKey);
      sessionStorage.removeItem('mk-weekly-student');
    } catch { /* The lookup page explains unavailable browser storage. */ }
  }));
  window.addEventListener('pageshow', event => {
    if (!event.persisted || isDirectReport) return;
    let selected;
    try { selected = sessionStorage.getItem(selectionKey); } catch { selected = null; }
    if (!selected || selected !== boundPath) recover("Enter your child's Student Number on the lookup page to open their report.");
  });
  window.addEventListener('message', event => {
    if (!frame || event.origin !== origin || event.source !== frame.contentWindow || !event.data) return;
    if (event.data.type === 'weekly-report-height') setHeight(event.data.height);
    if (event.data.type === 'weekly-report-ready') ready(event.data.title);
    if (event.data.type === 'weekly-report-error') recover('Your report could not be opened. Please return to the lookup page and try again.');
  });
  let selected;
  try { selected = isDirectReport ? directPath : sessionStorage.getItem(selectionKey); } catch {
    recover('Please use a browser that allows session storage, then look up your report again.');
    return;
  }
  if (typeof selected !== 'string' || !pathPattern.test(selected)) {
    recover("Enter your child's Student Number on the lookup page to open their report.");
    return;
  }
  boundPath = selected;
  frame = document.createElement('iframe');
  frame.className = 'report-frame';
  frame.title = 'Your Week 2 Math Kangaroo report';
  frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation');
  frame.referrerPolicy = 'no-referrer';
  frame.addEventListener('load', () => {
    if (!frame) return;
    try {
      const document = frame.contentDocument;
      if (!reportMarkers.has(document?.documentElement.dataset.prebuiltReport)) {
        recover('Your report could not be loaded. Please return to the lookup page and try again.');
        return;
      }
      const title = document.title;
      frame.title = title;
      setHeight(document.querySelector('main').getBoundingClientRect().height + 12);
      ready(title);
      if (isDirectReport) {
        document.querySelectorAll('.level-choice, .level-choice-return a').forEach(link => {
          const destination = new URL(link.getAttribute('href'), frame.src);
          const canonical = permanentLinks[destination.pathname.replace(/^\//, '')];
          if (destination.origin !== origin || !canonical) return;
          link.href = canonical;
          link.addEventListener('click', event => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            window.location.assign(canonical);
          });
        });
      }
    } catch {
      recover('Your report could not be opened. Please check your connection, then look it up again.');
    }
  });
  frame.addEventListener('error', () => recover('Your report could not be opened. Please check your connection, then look it up again.'));
  timer = setTimeout(() => recover('Your report is taking longer to open. Please check your connection, then return to the lookup page and try again.'), 15000);
  frame.src = new URL(selected, siteRoot).href + `?v=${reportAssetVersion}`;
  wrap.replaceChildren(frame);
})();
