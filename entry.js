'use strict';
(() => {
  const siteRoot = new URL('https://emily0huayun.github.io/math-kangaroo-reports/');
  const frame = document.getElementById('report-frame');
  const fallback = document.getElementById('report-fallback');
  const loading = document.getElementById('report-loading');
  const loadingTitle = document.getElementById('report-loading-title');
  const loadingMessage = document.getElementById('report-loading-message');
  const loadingLink = document.getElementById('report-loading-link');
  const oldRoute = /^reports\/(?:weeks\/([0-9]{12})|week-([12])\/(?:level-(1-2|3-4|5-6)\/)?([0-9]{12}))\/$/;
  const finalRoute = /^reports\/week-3\/(?:level-(1-2|3-4|5-6)\/)?([0-9]{12})\/$/;
  let currentTarget;
  let currentKind;
  let pendingTarget;
  let finalRequestId = '';
  let requestSequence = 0;
  let loadingTimer;
  let legacyRecoveryAttempted = false;

  function showLegacyLoading(target, route) {
    clearTimeout(loadingTimer);
    const title = route.week ? `Week ${route.week} report` : 'Earlier weekly reports';
    document.title = `${title} · Think Academy`;
    loading.hidden = false;
    loading.dataset.slow = 'false';
    loadingTitle.textContent = `Opening ${route.week ? `your Week ${route.week} report` : 'your weekly reports'}…`;
    loadingMessage.textContent = 'Your saved report is loading.';
    loadingLink.href = target.href;
    loadingTimer = setTimeout(() => {
      if (currentKind !== 'legacy' || currentTarget?.href !== target.href || loading.hidden) return;
      loading.dataset.slow = 'true';
      loadingMessage.textContent = 'Taking a little longer? You can open the saved report directly.';
    }, 10000);
  }

  function hideLoading() {
    clearTimeout(loadingTimer);
    loading.hidden = true;
  }

  function level(value) {
    if (!value) return '';
    const match = /^(?:lv|level-?)?(1-2|3-4|5-6)$/.exec(value.toLowerCase().replace(/\s/g, '').replace(/–/g, '-'));
    return match ? match[1] : null;
  }

  function student(params) {
    const values = ['uid', 'student', 'studentNumber'].flatMap(key => params.getAll(key));
    if (!values.length) return '';
    return values.every(value => /^[0-9]{12}$/.test(value) && value === values[0]) ? values[0] : null;
  }

  function pathRoute(path) {
    if (path === '' || path === 'index.html') return { kind: 'root', path: '' };
    const normalized = path.replace(/index\.html$/, '').replace(/\/?$/, '/');
    if (normalized === 'final/') return { kind: 'final', path: 'final/' };
    const final = finalRoute.exec(normalized);
    if (final) return { kind: 'final', path: 'final/', uid: final[2], level: final[1] || '' };
    const old = oldRoute.exec(normalized);
    return old ? { kind: 'legacy', path: normalized, picker: Boolean(old[1]), uid: old[1] || old[4], week: old[2] || '', level: old[3] || '' } : null;
  }

  function finalTarget(incoming, route = {}) {
    const uid = route.uid || student(incoming.searchParams);
    const selectedLevel = route.level || level(incoming.searchParams.get('level'));
    if (uid === null || selectedLevel === null) return null;
    const target = new URL('final/', siteRoot);
    // Final routes forward only report-routing fields, without old week aliases.
    if (uid) target.searchParams.set('uid', uid);
    if (selectedLevel) target.searchParams.set('level', selectedLevel);
    target.hash = incoming.hash;
    return target;
  }

  function requestedTarget() {
    const incoming = new URL(location.href);
    const route = pathRoute(incoming.pathname.replace(/^\//, ''));
    if (route?.kind === 'legacy') {
      const target = new URL(route.path, siteRoot);
      target.search = incoming.search;
      target.hash = incoming.hash;
      return target;
    }
    if (route?.kind === 'final') return finalTarget(incoming, route) || new URL('final/', siteRoot);
    const uid = student(incoming.searchParams);
    const week = /^(?:week-)?([123])$/.exec(incoming.searchParams.get('week') || '');
    const selectedLevel = level(incoming.searchParams.get('level'));
    if (uid && week && week[1] !== '3' && selectedLevel !== null) {
      const target = new URL(`reports/week-${week[1]}/${selectedLevel ? `level-${selectedLevel}/` : ''}${uid}/`, siteRoot);
      target.search = incoming.search;
      target.hash = incoming.hash;
      return target;
    }
    return finalTarget(incoming) || new URL('final/', siteRoot);
  }

  function validateTarget(value) {
    let target;
    try { target = new URL(value); } catch { return null; }
    if (target.origin !== siteRoot.origin || target.username || target.password || !target.pathname.startsWith(siteRoot.pathname)) return null;
    const route = pathRoute(target.pathname.slice(siteRoot.pathname.length));
    if (!route) return null;
    if (route.kind === 'final') {
      // Final messages use canonical final/, never a redirect alias.
      if (target.pathname !== new URL('final/', siteRoot).pathname || student(target.searchParams) === null || target.searchParams.getAll('level').length > 1 || level(target.searchParams.get('level')) === null) return null;
      const week = target.searchParams.get('week');
      if (week && !/^(?:week-)?3$/.test(week)) return null;
      target = finalTarget(target);
    }
    return { target, route };
  }

  function reflectTarget(target, route) {
    const changed = currentTarget?.href !== target.href;
    let branded;
    if (route.kind === 'final') branded = '/' + target.search + target.hash;
    else {
      const params = new URLSearchParams(target.search);
      ['uid', 'student', 'studentNumber', 'week', 'level'].forEach(key => params.delete(key));
      if (route.kind === 'legacy' && !route.picker) {
        params.set('uid', route.uid);
        params.set('week', route.week);
        if (route.level) params.set('level', route.level);
      }
      // Explicit old week-picker links must remain week pickers after reload.
      const path = route.picker ? '/' + route.path : '/';
      branded = path + (params.size ? '?' + params.toString() : '') + target.hash;
    }
    if (location.pathname + location.search + location.hash !== branded) history.replaceState(null, '', branded);
    currentTarget = target;
    currentKind = route.kind === 'final' ? 'final' : 'legacy';
    fallback.href = target.href;
    if (currentKind === 'legacy') {
      document.title = `${route.week ? `Week ${route.week} report` : 'Earlier weekly reports'} · Think Academy`;
      loadingLink.href = target.href;
      if (changed) showLegacyLoading(target, route);
    }
  }

  function tellFinalLocation() {
    if (currentKind !== 'final' || !finalRequestId) return;
    frame.contentWindow.postMessage({ type: 'mk-report-location', url: currentTarget.href, requestId: finalRequestId }, siteRoot.origin);
  }

  function requestTarget(target, initial = false) {
    const route = pathRoute(target.pathname.slice(siteRoot.pathname.length));
    const kind = route.kind === 'final' ? 'final' : 'legacy';
    const previousKind = currentKind;
    currentTarget = target;
    currentKind = kind;
    fallback.href = target.href;
    pendingTarget = target;
    legacyRecoveryAttempted = false;
    if (kind === 'final') finalRequestId = `mk-final-${++requestSequence}`;
    else finalRequestId = '';
    if (kind === 'legacy') showLegacyLoading(target, route);
    else {
      hideLoading();
      document.title = 'Math Kangaroo Final Report · Think Academy';
    }
    if (initial || previousKind !== kind) frame.src = target.href;
    else if (kind === 'final') tellFinalLocation();
    else frame.contentWindow.postMessage({ type: 'mk-report-location', url: target.href }, siteRoot.origin);
  }

  function restoreRequested() {
    const target = requestedTarget();
    if (currentTarget?.href !== target.href) requestTarget(target);
    else fallback.href = target.href;
  }

  function matchesPendingFinal(target) {
    if (!pendingTarget) return true;
    const expected = pendingTarget.searchParams;
    return target.searchParams.get('uid') === expected.get('uid') &&
      (!expected.get('level') || target.searchParams.get('level') === expected.get('level')) &&
      target.hash === pendingTarget.hash;
  }

  document.getElementById('report-loading-dismiss').addEventListener('click', hideLoading);
  frame.addEventListener('load', () => {
    if (currentKind === 'final') tellFinalLocation();
    else frame.contentWindow.postMessage({ type: 'mk-report-location', url: currentTarget.href }, siteRoot.origin);
  });
  window.addEventListener('message', event => {
    if (event.origin !== siteRoot.origin || event.source !== frame.contentWindow) return;
    if (event.data?.type === 'mk-report-ready') {
      // A restored iframe or a late final-document load must not replace an
      // explicit Week 1/2 request. Retry that validated destination once.
      if (currentKind === 'legacy' && pendingTarget && !legacyRecoveryAttempted && typeof event.data.url === 'string' && event.data.url.length <= 4096) {
        const loaded = validateTarget(event.data.url);
        if (loaded?.route.kind === 'final') {
          legacyRecoveryAttempted = true;
          frame.src = currentTarget.href;
        }
      }
      // Old weekly pages can navigate internally to the new root redirect.
      // Adopt that already loaded final document only after the legacy request
      // was acknowledged, never while a newer parent navigation is pending.
      if (currentKind === 'legacy' && !pendingTarget && typeof event.data.url === 'string' && event.data.url.length <= 4096) {
        const loaded = validateTarget(event.data.url);
        if (loaded?.route.kind === 'final') {
          currentTarget = loaded.target;
          currentKind = 'final';
          pendingTarget = loaded.target;
          finalRequestId = `mk-final-${++requestSequence}`;
          fallback.href = loaded.target.href;
          hideLoading();
          document.title = 'Math Kangaroo Final Report · Think Academy';
        }
      }
      tellFinalLocation();
      return;
    }
    if (event.data?.type === 'mk-report-view-ready') {
      if (currentKind !== 'legacy' || typeof event.data.url !== 'string' || event.data.url.length > 4096) return;
      const loaded = validateTarget(event.data.url);
      if (loaded?.route.kind === 'legacy' && loaded.target.href === currentTarget.href) hideLoading();
      return;
    }
    if (event.data?.type !== 'mk-report-navigation' || typeof event.data.url !== 'string' || event.data.url.length > 4096) return;
    const parsed = validateTarget(event.data.url);
    if (!parsed) return;
    const { target, route } = parsed;
    if (currentKind === 'final') {
      if (route.kind !== 'final' || event.data.requestId !== finalRequestId || !matchesPendingFinal(target)) return;
    } else if (route.kind === 'final' || (pendingTarget && target.href !== pendingTarget.href)) return;
    pendingTarget = null;
    reflectTarget(target, route);
  });
  window.addEventListener('popstate', restoreRequested);
  window.addEventListener('hashchange', restoreRequested);
  requestTarget(requestedTarget(), true);
})();
