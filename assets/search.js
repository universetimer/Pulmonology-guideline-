// 사이트 전체 검색 (헤더에 통합되는 모달)
(function () {
  'use strict';

  let INDEX = null;
  let loading = null;

  // 검색 UI 주입
  function injectUI() {
    // 헤더에 버튼 추가 (이미 페이지에 없으면)
    let btn = document.querySelector('.header-search-btn');
    if (!btn) {
      const header = document.querySelector('header.site-header');
      if (!header) return;
      btn = document.createElement('button');
      btn.className = 'header-search-btn';
      btn.id = 'openSearchBtn';
      btn.setAttribute('aria-label', '검색');
      btn.innerHTML = '🔍';
      header.appendChild(btn);
    }

    // 모달 마크업
    const modal = document.createElement('div');
    modal.className = 'search-modal';
    modal.id = 'searchModal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="search-overlay"></div>
      <div class="search-panel">
        <div class="search-input-wrap">
          <span class="search-icon">🔍</span>
          <input type="search" id="searchInput" placeholder="검색어 입력 (예: COPD, 결핵, 폐암, GGO...)" autocomplete="off" />
          <button class="search-close" aria-label="닫기">✕</button>
        </div>
        <div class="search-filters" id="searchFilters">
          <button class="sf-btn active" data-type="all">전체</button>
          <button class="sf-btn" data-type="manual">📚 매뉴얼</button>
          <button class="sf-btn" data-type="summary">📋 요약본</button>
          <button class="sf-btn" data-type="quiz">🎯 시험</button>
          <button class="sf-btn" data-type="radiology">🩻 X-ray</button>
        </div>
        <div class="search-results" id="searchResults"></div>
        <div class="search-hint">
          💡 Tip: 키워드를 띄어쓰기로 여러 개 입력하면 AND 검색됩니다.
          <kbd>↑</kbd><kbd>↓</kbd> 이동, <kbd>Enter</kbd> 열기, <kbd>Esc</kbd> 닫기
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    btn.addEventListener('click', openModal);

    // 모달 이벤트
    modal.querySelector('.search-overlay').addEventListener('click', closeModal);
    modal.querySelector('.search-close').addEventListener('click', closeModal);
    document.addEventListener('keydown', e => {
      if (e.key === '/' && !isInputFocused() && modal.hidden) {
        e.preventDefault();
        openModal();
      } else if (e.key === 'Escape' && !modal.hidden) {
        closeModal();
      } else if (!modal.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter')) {
        navResults(e);
      }
    });

    const input = modal.querySelector('#searchInput');
    let debounceT;
    input.addEventListener('input', () => {
      clearTimeout(debounceT);
      debounceT = setTimeout(runSearch, 80);
    });

    modal.querySelectorAll('.sf-btn').forEach(b => {
      b.addEventListener('click', () => {
        modal.querySelectorAll('.sf-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        runSearch();
      });
    });
  }

  function isInputFocused() {
    const t = document.activeElement;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
  }

  function openModal() {
    const modal = document.getElementById('searchModal');
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('searchInput').focus(), 0);
    ensureIndexLoaded();
  }

  function closeModal() {
    const modal = document.getElementById('searchModal');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  async function ensureIndexLoaded() {
    if (INDEX || loading) return loading;
    loading = (async () => {
      try {
        const res = await fetch('assets/search-index.json');
        const data = await res.json();
        INDEX = data.entries;
        runSearch();
      } catch (e) {
        document.getElementById('searchResults').innerHTML =
          '<p style="text-align:center;color:#c00">검색 인덱스 로드 실패</p>';
      }
    })();
    return loading;
  }

  function runSearch() {
    if (!INDEX) return;
    const q = document.getElementById('searchInput').value.trim().toLowerCase();
    const typeFilter = document.querySelector('.sf-btn.active')?.dataset.type || 'all';

    const wrap = document.getElementById('searchResults');
    if (!q) {
      wrap.innerHTML = `
        <div class="search-empty">
          <p>📚 매뉴얼·요약본·시험문제·X-ray 슬라이드를 한 번에 검색합니다.</p>
          <div class="search-pop-tags">
            ${['COPD','천식','결핵','폐암','MDR-TB','Osimertinib','GGO','기흉','폐고혈압','CAP'].map(t =>
              `<button class="pop-tag" data-tag="${t}">${t}</button>`
            ).join('')}
          </div>
        </div>
      `;
      wrap.querySelectorAll('.pop-tag').forEach(b => {
        b.addEventListener('click', () => {
          document.getElementById('searchInput').value = b.dataset.tag;
          runSearch();
        });
      });
      return;
    }

    // tokenize, 공백 분리 → AND 검색
    const tokens = q.split(/\s+/).filter(Boolean);

    let results = INDEX
      .filter(e => typeFilter === 'all' || e.type === typeFilter)
      .map(e => {
        const text = (e.title + ' ' + e.snippet).toLowerCase();
        // 모든 토큰 포함 여부
        let allMatch = true;
        let score = 0;
        for (const tok of tokens) {
          if (!text.includes(tok)) { allMatch = false; break; }
          // 타이틀 가산점
          if (e.title.toLowerCase().includes(tok)) score += 10;
          // 등장 횟수
          score += (text.split(tok).length - 1);
        }
        return allMatch ? { e, score } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);

    if (!results.length) {
      wrap.innerHTML = `<div class="search-empty"><p>"${escapeHtml(q)}" 검색 결과가 없습니다.</p></div>`;
      return;
    }

    wrap.innerHTML = results.map((r, i) => renderResult(r.e, tokens, i)).join('');
    wrap.querySelectorAll('.sr-item').forEach(el => {
      el.addEventListener('click', () => {
        const url = el.dataset.url;
        if (url) window.location.href = url;
      });
      el.addEventListener('mouseenter', () => {
        wrap.querySelectorAll('.sr-item.kbd-focus').forEach(x => x.classList.remove('kbd-focus'));
        el.classList.add('kbd-focus');
      });
    });
    // 첫 결과에 키보드 포커스
    wrap.querySelector('.sr-item')?.classList.add('kbd-focus');
  }

  function renderResult(e, tokens, i) {
    const titleHl = highlight(e.title, tokens);
    const snippetHl = highlight(e.snippet, tokens);
    const img = e.image ? `<div class="sr-thumb"><img src="${e.image}" loading="lazy" alt=""></div>` : '';
    return `
      <div class="sr-item" data-url="${e.url}" data-idx="${i}">
        ${img}
        <div class="sr-body">
          <div class="sr-type">${e.typeName}</div>
          <div class="sr-title">${titleHl}</div>
          <div class="sr-snippet">${snippetHl}</div>
        </div>
        <span class="sr-arrow">→</span>
      </div>
    `;
  }

  function navResults(e) {
    const items = Array.from(document.querySelectorAll('.sr-item'));
    if (!items.length) return;
    const cur = items.findIndex(x => x.classList.contains('kbd-focus'));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[cur]?.classList.remove('kbd-focus');
      const next = items[(cur + 1) % items.length];
      next.classList.add('kbd-focus');
      next.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[cur]?.classList.remove('kbd-focus');
      const prev = items[(cur - 1 + items.length) % items.length];
      prev.classList.add('kbd-focus');
      prev.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = items[Math.max(cur, 0)];
      if (target?.dataset.url) window.location.href = target.dataset.url;
    }
  }

  // ---- utils ----
  function highlight(s, tokens) {
    const esc = escapeHtml(s);
    let out = esc;
    tokens.forEach(tok => {
      if (!tok) return;
      const re = new RegExp(`(${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      out = out.replace(re, '<mark class="hl">$1</mark>');
    });
    return out;
  }
  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  // init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectUI);
  } else {
    injectUI();
  }
})();
