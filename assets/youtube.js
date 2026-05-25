// YouTube channel videos loader (Lung study lab @kaist79)
(function () {
  'use strict';
  const grid = document.getElementById('ytGrid');
  if (!grid) return;

  fetch('assets/youtube.json')
    .then(r => r.json())
    .then(data => render(data))
    .catch(err => {
      console.error(err);
      grid.innerHTML = `
        <div class="yt-fallback">
          <p>영상 목록을 불러올 수 없습니다.</p>
          <a href="https://www.youtube.com/@kaist79/videos" target="_blank" rel="noopener" class="yt-more-btn">
            📺 YouTube에서 직접 보기 →
          </a>
        </div>`;
    });

  function render(data) {
    const videos = (data.videos || []).slice(0, 8);
    if (!videos.length) {
      grid.innerHTML = '<p>표시할 영상이 없습니다.</p>';
      return;
    }
    grid.innerHTML = videos.map(v => `
      <a class="yt-card" href="${v.url}" target="_blank" rel="noopener">
        <div class="yt-thumb">
          <img loading="lazy" src="${v.thumbnail}" alt="${escapeHtml(v.title)}" />
          ${v.duration ? `<span class="yt-duration">${escapeHtml(v.duration)}</span>` : ''}
          <span class="yt-play">▶</span>
        </div>
        <div class="yt-meta">
          <div class="yt-title">${escapeHtml(v.title)}</div>
          <div class="yt-sub">
            ${v.viewsText ? `<span>${escapeHtml(v.viewsText)}</span>` : ''}
            ${v.publishedText ? `<span>· ${escapeHtml(v.publishedText)}</span>` : ''}
          </div>
        </div>
      </a>
    `).join('');
  }

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }
})();
