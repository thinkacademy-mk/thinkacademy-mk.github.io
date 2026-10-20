'use strict';
(() => {
  const siteRoot = new URL('https://emily0huayun.github.io/math-kangaroo-reports/');
  const frame = document.getElementById('report-frame');
  const fallback = document.getElementById('report-fallback');
  const routePattern = /^reports\/(?:weeks\/[0-9]{12}|week-[12]\/(?:level-(?:1-2|3-4|5-6)\/)?[0-9]{12})\/$/;
  let currentTarget = '';
  let pendingTarget = '';

  function allowedPath(path) {
    if (path === '' || path === 'index.html') return '';
    const normalized = path.replace(/index\.html$/, '').replace(/\/?$/, '/');
    return routePattern.test(normalized) ? normalized : null;
  }

  function queryPath(params) {
    const uid = params.get('uid') || params.get('student') || params.get('studentNumber');
    if (!/^[0-9]{12}$/.test(uid || '')) return null;
    const weekValue = params.get('week');
    if (!weekValue) return `reports/weeks/${uid}/`;
    const week = /^(?:week-)?([12])$/.exec(weekValue);
    if (!week) return null;
    const levelValue = params.get('level');
    if (!levelValue) return `reports/week-${week[1]}/${uid}/`;
    const level = /^(?:lv|level-?)?(1-2|3-4|5-6)$/.exec(levelValue.toLowerCase().replace(/\s/g, '').replace(/–/g, '-'));
    return level ? `reports/week-${week[1]}/level-${level[1]}/${uid}/` : null;
  }

  function requestedTarget() {
    const incoming = new URL(location.href);
    const path = allowedPath(incoming.pathname.replace(/^\//, ''));
    const selected = path || queryPath(incoming.searchParams) || '';
    const target = new URL(selected, siteRoot);
    target.search = incoming.search;
    target.hash = incoming.hash;
    return target;
  }

  function reflectTarget(target) {
    const path = target.pathname.slice(siteRoot.pathname.length);
    const branded = '/' + path + target.search + target.hash;
    if (location.pathname + location.search + location.hash !== branded) {
      history.replaceState(null, '', branded);
    }
    currentTarget = target.href;
    fallback.href = target.href;
  }

  function loadRequested() {
    const target = requestedTarget();
    if (currentTarget !== target.href) {
      currentTarget = target.href;
      pendingTarget = target.href;
      frame.src = target.href;
    }
    fallback.href = target.href;
  }

  function restoreRequested() {
    const target = requestedTarget();
    fallback.href = target.href;
    if (currentTarget === target.href) return;
    pendingTarget = target.href;
    frame.contentWindow.postMessage({ type: 'mk-report-location', url: target.href }, siteRoot.origin);
  }

  window.addEventListener('message', event => {
    if (event.origin !== siteRoot.origin || event.source !== frame.contentWindow ||
        event.data?.type !== 'mk-report-navigation' || typeof event.data.url !== 'string' ||
        event.data.url.length > 4096) return;
    let target;
    try { target = new URL(event.data.url); } catch { return; }
    if (target.origin !== siteRoot.origin || !target.pathname.startsWith(siteRoot.pathname) ||
        allowedPath(target.pathname.slice(siteRoot.pathname.length)) === null) return;
    if (pendingTarget && target.href !== pendingTarget) return;
    pendingTarget = '';
    reflectTarget(target);
  });
  window.addEventListener('popstate', restoreRequested);
  window.addEventListener('hashchange', restoreRequested);
  loadRequested();
})();
