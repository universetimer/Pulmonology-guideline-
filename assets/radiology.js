// 흉부 X-ray 학습 페이지
(function () {
  'use strict';

  const STATE = {
    data: null,           // { slides, categories }
    filtered: [],         // 필터링된 슬라이드 배열
    activeCat: 'all',
    searchQ: '',
    quizMode: false,
    currentIdx: 0,        // viewer에서 현재 보고 있는 filtered 배열의 index
  };

  const $ = sel => document.querySelector(sel);

  // ---------- load ----------
  async function load() {
    try {
      const res = await fetch('assets/radiology.json');
      STATE.data = await res.json();
      init();
    } catch (e) {
      console.error(e);
      $('#slideGrid').innerHTML = '<p style="color:#c00">슬라이드 로드 실패</p>';
    }
  }

  function init() {
    renderCategories();
    applyFilter();
    bindEvents();
  }

  // ---------- categories ----------
  function renderCategories() {
    const wrap = $('#catPills');
    wrap.innerHTML = '';
    const slides = STATE.data.slides;

    STATE.data.categories.forEach(c => {
      let count;
      if (c.id === 'all') count = slides.length;
      else count = slides.filter(s => s.cats.includes(c.id)).length;
      if (c.id !== 'all' && count === 0) return; // 빈 카테고리 숨김

      const btn = document.createElement('button');
      btn.className = 'cat-pill' + (c.id === STATE.activeCat ? ' active' : '');
      btn.dataset.cat = c.id;
      btn.innerHTML = `${c.icon} ${c.name} <span class="count">${count}</span>`;
      btn.addEventListener('click', () => {
        STATE.activeCat = c.id;
        renderCategories();
        applyFilter();
      });
      wrap.appendChild(btn);
    });
  }

  // ---------- filter / search ----------
  function applyFilter() {
    let arr = STATE.data.slides;
    if (STATE.activeCat !== 'all') {
      arr = arr.filter(s => s.cats.includes(STATE.activeCat));
    }
    if (STATE.searchQ) {
      const q = STATE.searchQ.toLowerCase();
      arr = arr.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.body.toLowerCase().includes(q) ||
        s.notes.toLowerCase().includes(q)
      );
    }
    STATE.filtered = arr;
    renderGrid();
  }

  function renderGrid() {
    const grid = $('#slideGrid');
    const stats = $('#radStats');
    stats.textContent = `${STATE.filtered.length}개 슬라이드`;

    if (!STATE.filtered.length) {
      grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px">검색 결과가 없습니다.</p>';
      return;
    }

    grid.innerHTML = '';
    STATE.filtered.forEach((sl, i) => {
      const card = document.createElement('div');
      card.className = 'slide-card';
      card.dataset.idx = i;

      const thumb = document.createElement('div');
      thumb.className = 'thumb' + (sl.image ? '' : ' no-img');
      if (sl.image) {
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.src = sl.image;
        img.alt = sl.title;
        thumb.appendChild(img);
      } else {
        thumb.textContent = '📄';
      }

      const info = document.createElement('div');
      info.className = 'info';
      const cats = (sl.cats || []).filter(c => c !== 'other').slice(0, 2)
        .map(cid => {
          const cat = STATE.data.categories.find(c => c.id === cid);
          return cat ? `<span class="mini-badge">${cat.icon}</span>` : '';
        }).join('');
      info.innerHTML = `
        <div class="num">#${String(sl.idx).padStart(3, '0')}</div>
        <div class="ttl">${escapeHtml(STATE.quizMode ? '🤔 진단해보세요' : sl.title)}</div>
        <div class="badge-row">${cats}</div>
      `;
      card.appendChild(thumb);
      card.appendChild(info);
      card.addEventListener('click', () => openViewer(i));
      grid.appendChild(card);
    });
  }

  // ---------- viewer ----------
  function openViewer(idx) {
    STATE.currentIdx = idx;
    renderViewer();
    $('#radViewer').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeViewer() {
    $('#radViewer').hidden = true;
    document.body.style.overflow = '';
  }

  function renderViewer() {
    const sl = STATE.filtered[STATE.currentIdx];
    if (!sl) return;
    $('#viewerIdx').textContent = `${STATE.currentIdx + 1} / ${STATE.filtered.length}  ·  Slide ${sl.idx}`;
    $('#viewerTitle').textContent = sl.title;
    $('#viewerBody').textContent = sl.body || '(본문 없음)';

    // 이미지
    const img = $('#viewerImg');
    const noImg = $('#viewerNoImg');
    if (sl.image) {
      img.src = sl.image;
      img.style.display = '';
      img.alt = sl.title;
      noImg.hidden = true;
    } else {
      img.style.display = 'none';
      img.src = '';
      noImg.hidden = false;
    }

    // 노트
    const notesWrap = $('#viewerNotesWrap');
    if (sl.notes && sl.notes.trim()) {
      notesWrap.hidden = false;
      $('#viewerNotes').textContent = sl.notes;
    } else {
      notesWrap.hidden = true;
    }

    // 카테고리 배지
    const catWrap = $('#viewerCats');
    catWrap.innerHTML = (sl.cats || []).map(cid => {
      const c = STATE.data.categories.find(x => x.id === cid);
      if (!c || c.id === 'all') return '';
      return `<span class="mini-badge">${c.icon} ${c.name}</span>`;
    }).join('');

    // Quiz mode: 텍스트 가리기
    const body = $('#viewerBody');
    const revealBtn = $('#revealBtn');
    if (STATE.quizMode) {
      body.classList.add('hidden');
      notesWrap.style.display = 'none';
      $('#viewerTitle').textContent = '🤔 진단해보세요';
      revealBtn.hidden = false;
    } else {
      body.classList.remove('hidden');
      notesWrap.style.display = '';
      revealBtn.hidden = true;
    }

    // nav buttons
    $('#viewerPrev').disabled = STATE.currentIdx === 0;
    $('#viewerNext').disabled = STATE.currentIdx === STATE.filtered.length - 1;
  }

  function reveal() {
    const sl = STATE.filtered[STATE.currentIdx];
    if (!sl) return;
    $('#viewerTitle').textContent = sl.title;
    $('#viewerBody').classList.remove('hidden');
    $('#viewerNotesWrap').style.display = '';
    $('#revealBtn').hidden = true;
  }

  function navViewer(delta) {
    const next = STATE.currentIdx + delta;
    if (next < 0 || next >= STATE.filtered.length) return;
    STATE.currentIdx = next;
    renderViewer();
  }

  // ---------- events ----------
  function bindEvents() {
    $('#radSearch').addEventListener('input', e => {
      STATE.searchQ = e.target.value.trim();
      applyFilter();
    });

    $('#quizMode').addEventListener('change', e => {
      STATE.quizMode = e.target.checked;
      renderGrid();
    });

    $('#viewerClose').addEventListener('click', closeViewer);
    $('#viewerOverlay').addEventListener('click', closeViewer);
    $('#viewerPrev').addEventListener('click', () => navViewer(-1));
    $('#viewerNext').addEventListener('click', () => navViewer(1));
    $('#revealBtn').addEventListener('click', reveal);

    // 키보드: ← → ESC, R (reveal)
    document.addEventListener('keydown', e => {
      if ($('#radViewer').hidden) return;
      if (e.key === 'ArrowLeft') navViewer(-1);
      else if (e.key === 'ArrowRight') navViewer(1);
      else if (e.key === 'Escape') closeViewer();
      else if (e.key.toLowerCase() === 'r' && STATE.quizMode) reveal();
    });
  }

  // ---------- utils ----------
  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  load();
})();
