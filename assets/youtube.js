// YouTube channel loader — Shorts 우선 + 일반 영상 보조 (Lung study lab @kaist79)
(function () {
  'use strict';
  const grid = document.getElementById('ytGrid');
  if (!grid) return;

  fetch('assets/youtube.json?v=20260526-3', { cache: 'no-cache' })
    .then(r => r.json())
    .then(data => render(data))
    .catch(err => {
      console.error(err);
      grid.innerHTML = `
        <div class="yt-fallback">
          <p>영상 목록을 불러올 수 없습니다.</p>
          <a href="https://www.youtube.com/@kaist79/shorts" target="_blank" rel="noopener" class="yt-more-btn">
            📺 YouTube에서 직접 보기 →
          </a>
        </div>`;
    });

  function render(data) {
    const shorts = (data.shorts || []).slice(0, 18);  // 캐러셀에 최대 18개
    const longform = (data.videos || []).slice(0, 4); // 강의 영상 4개

    // 기존 .yt-grid 가 4열 grid라 새 구조와 충돌 → block로 해제
    grid.style.display = 'block';
    grid.style.gap = '0';

    let html = '';

    if (shorts.length) {
      html += `
        <div class="yt-shorts-wrap">
          <div class="yt-section-head">
            <h3>📱 Shorts</h3>
            <a href="${esc(data.channel?.shortsUrl || 'https://www.youtube.com/@kaist79/shorts')}"
               target="_blank" rel="noopener" class="yt-section-more">전체 Shorts →</a>
          </div>
          <div class="yt-shorts-carousel" id="ytShortsCarousel">
            ${shorts.map(shortCard).join('')}
          </div>
        </div>`;
    }

    if (longform.length) {
      html += `
        <div class="yt-longform-wrap">
          <div class="yt-section-head">
            <h3>🎬 강의 영상</h3>
            <a href="${esc(data.channel?.videosUrl || 'https://www.youtube.com/@kaist79/videos')}"
               target="_blank" rel="noopener" class="yt-section-more">전체 영상 →</a>
          </div>
          <div class="yt-longform-grid">
            ${longform.map(longCard).join('')}
          </div>
        </div>`;
    }

    if (!html) {
      grid.innerHTML = '<p style="text-align:center;color:#777">표시할 영상이 없습니다.</p>';
      return;
    }
    grid.innerHTML = html;
  }

  function shortCard(v) {
    return `
      <a class="yt-short-card" href="${esc(v.url)}" target="_blank" rel="noopener">
        <div class="yt-short-thumb">
          <img loading="lazy" src="${esc(v.thumbnail)}" alt="${esc(v.title)}"
               onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg';" />
          <span class="yt-short-play">▶</span>
          <span class="yt-short-badge">Shorts</span>
        </div>
        <div class="yt-short-meta">
          <div class="yt-short-title">${esc(v.title)}</div>
          ${v.viewsText ? `<div class="yt-short-views">${esc(v.viewsText)}</div>` : ''}
        </div>
      </a>`;
  }

  function longCard(v) {
    return `
      <a class="yt-card" href="${esc(v.url)}" target="_blank" rel="noopener">
        <div class="yt-thumb">
          <img loading="lazy" src="${esc(v.thumbnail)}" alt="${esc(v.title)}" />
          ${v.duration ? `<span class="yt-duration">${esc(v.duration)}</span>` : ''}
          <span class="yt-play">▶</span>
        </div>
        <div class="yt-meta">
          <div class="yt-title">${esc(v.title)}</div>
          <div class="yt-sub">
            ${v.viewsText ? `<span>${esc(v.viewsText)}</span>` : ''}
            ${v.publishedText ? `<span>· ${esc(v.publishedText)}</span>` : ''}
          </div>
        </div>
      </a>`;
  }

  function esc(s) {
    return (s || '').replace(/[&<>"']/g, c => (
      { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
    ));
  }
})();
