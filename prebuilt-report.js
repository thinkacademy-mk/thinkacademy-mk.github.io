'use strict';
(() => {
  // Report content, scores and every rank row already exist in this document.
  // Only expand/collapse presentation and tell the wrapper the rendered height.
  const send = data => {
    if (window.parent !== window && location.origin !== 'null') {
      window.parent.postMessage(data, location.origin);
    }
  };
  const sendHeight = () => {
    const main = document.querySelector('main');
    if (main) send({type:'weekly-report-height',height:Math.ceil(main.getBoundingClientRect().height + 12)});
  };
  const initializeTopics = () => {
    document.querySelectorAll('[data-topic-toggle]').forEach(button => {
      if (button.disabled) return;
      const panel = document.getElementById(button.getAttribute('aria-controls') || '');
      if (!panel) return;
      const week = button.closest('[data-week]')?.dataset.week || '';
      const setExpanded = expanded => {
        panel.hidden = !expanded;
        button.setAttribute('aria-expanded', String(expanded));
        const label = `${expanded ? 'Hide' : 'Show'} Week ${week} topics`;
        button.setAttribute('aria-label', label);
        button.title = label;
        sendHeight();
      };
      setExpanded(button.dataset.defaultExpanded === 'true');
      button.addEventListener('click', () => setExpanded(button.getAttribute('aria-expanded') !== 'true'));
    });
  };
  const initialize = () => {
    initializeTopics();
    const body = document.getElementById('ranking-body');
    const collapse = document.getElementById('collapse-leaderboard');
    document.documentElement.classList.add('prebuilt-enhanced');
    if (body && collapse) {
      const setExpanded = expanded => {
        body.querySelectorAll('[data-rank-collapsed=\"true\"]').forEach(row => { row.hidden = !expanded; });
        body.querySelectorAll('.rank-gap').forEach(row => { row.hidden = expanded; });
        body.dataset.leaderboardExpanded = expanded ? 'true' : 'false';
        body.querySelectorAll('[data-expand-leaderboard]').forEach(button => {
          button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        });
        collapse.hidden = !expanded;
        sendHeight();
      };
      setExpanded(false);
      body.addEventListener('click', event => {
        if (!event.target.closest('button[data-expand-leaderboard]')) return;
        setExpanded(true);
        collapse.focus();
      });
      collapse.addEventListener('click', () => {
        setExpanded(false);
        const expand = body.querySelector('button[data-expand-leaderboard]');
        if (expand) expand.focus();
      });
    }
    const main = document.querySelector('main');
    if (main && typeof ResizeObserver === 'function') new ResizeObserver(sendHeight).observe(main);
    window.addEventListener('load', sendHeight, {once:true});
    window.addEventListener('resize', sendHeight);
    requestAnimationFrame(() => {
      sendHeight();
      send({type:'weekly-report-ready',title:document.title});
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once:true});
  else initialize();
})();
