'use strict';
(() => {
  const root = new URL('./', document.currentScript.src);
  const query = new URLSearchParams(location.search);
  const uid = query.get('student');
  const names = {'990000000001':'Test Student A','990000000002':'Test Student B'};
  const day = Number(query.get('day'));
  if (Object.hasOwn(names, uid)) {
    document.getElementById('practice-back').href = new URL(`report-${uid}-week2.html`, root).href;
    document.getElementById('practice-back').textContent = '← 返回 ' + names[uid] + ' 的測試報告';
    document.getElementById('practice-caption').textContent = names[uid] + (Number.isInteger(day) && day >= 1 && day <= 14 ? ` · Day ${day}` : '') + ' · SYNTHETIC PRACTICE';
  }
  document.querySelectorAll('[data-answer]').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('[data-answer]').forEach(choice => choice.setAttribute('aria-pressed', String(choice === button)));
    document.getElementById('practice-feedback').textContent = button.dataset.answer === '3'
      ? '答對了！三角形有 3 條邊。這只是本機測試結果，不會記錄或修改報告。'
      : '這個按鈕可以正常運作。正確答案是 3 條邊；這只是本機測試，不會記錄或修改報告。';
  }));
})();
