// 흉부 X-ray 학습 페이지
(function () {
  'use strict';

  const STATE = {
    data: null,
    filtered: [],
    activeCat: 'all',
    activeSources: new Set(),     // 비어있으면 전체 허용
    searchQ: '',
    quizMode: false,
    currentIdx: 0,                // viewer에서 보고 있는 filtered index
    viewerImgIdx: 0,              // extra_images 갤러리 인덱스
  };

  const $ = sel => document.querySelector(sel);

  // ---------- load ----------
  // 빌드 버전 — 데이터 갱신 시 이 값을 올리면 클라이언트가 새 JSON 강제 fetch
  const DATA_VERSION = '20260526-3';
  async function load() {
    try {
      const res = await fetch(`assets/radiology.json?v=${DATA_VERSION}`, { cache: 'no-cache' });
      STATE.data = await res.json();
      init();
    } catch (e) {
      console.error(e);
      $('#slideGrid').innerHTML = '<p style="color:#c00">슬라이드 로드 실패</p>';
    }
  }

  function init() {
    // lead 문구 동적 업데이트
    const slides = STATE.data.slides;
    const withImg = slides.filter(s => s.image).length;
    const dxN = STATE.data.quiz_pools?.dx_ids?.length || 0;
    const fdN = STATE.data.quiz_pools?.finding_ids?.length || 0;
    $('#radLead').innerHTML =
      `<strong>${slides.length}장</strong>의 슬라이드 + <strong>${withImg}장</strong>의 X-ray 영상.<br>` +
      `3개 강의자료를 통합했고, <strong>진단 ${dxN}문항 · 소견 ${fdN}문항</strong>의 자가 퀴즈를 제공합니다.`;

    renderSources();
    renderCategories();
    applyFilter();
    bindEvents();
  }

  // ---------- sources ----------
  function renderSources() {
    const wrap = $('#sourceFilter');
    if (!STATE.data.sources?.length) return;
    wrap.innerHTML = '';
    STATE.data.sources.forEach(s => {
      const count = STATE.data.slides.filter(sl => sl.source === s.id).length;
      const btn = document.createElement('button');
      btn.className = 'source-pill' +
        (STATE.activeSources.size === 0 || STATE.activeSources.has(s.id) ? ' active' : '');
      btn.innerHTML = `📦 ${s.label} <span class="count">${count}</span>`;
      btn.addEventListener('click', () => {
        if (STATE.activeSources.has(s.id)) {
          STATE.activeSources.delete(s.id);
        } else {
          STATE.activeSources.add(s.id);
        }
        // 모두 끄면 전체 보기
        renderSources();
        applyFilter();
      });
      wrap.appendChild(btn);
    });
  }

  // ---------- categories ----------
  function renderCategories() {
    const wrap = $('#catPills');
    wrap.innerHTML = '';
    const slides = applySourceFilter(STATE.data.slides);

    STATE.data.categories.forEach(c => {
      let count;
      if (c.id === 'all') count = slides.length;
      else count = slides.filter(s => s.cats.includes(c.id)).length;
      if (c.id !== 'all' && count === 0) return;

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

  function applySourceFilter(arr) {
    if (STATE.activeSources.size === 0) return arr;
    return arr.filter(s => STATE.activeSources.has(s.source));
  }

  // ---------- filter / search ----------
  function applyFilter() {
    let arr = applySourceFilter(STATE.data.slides);
    if (STATE.activeCat !== 'all') {
      arr = arr.filter(s => s.cats.includes(STATE.activeCat));
    }
    if (STATE.searchQ) {
      const q = STATE.searchQ.toLowerCase();
      arr = arr.filter(s =>
        (s.title || '').toLowerCase().includes(q) ||
        (s.body || '').toLowerCase().includes(q) ||
        (s.notes || '').toLowerCase().includes(q) ||
        (s.dx_label || '').toLowerCase().includes(q)
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
        img.alt = sl.title || '';
        thumb.appendChild(img);
        // 다중 이미지 표시
        if (sl.extra_images && sl.extra_images.length) {
          const dot = document.createElement('span');
          dot.className = 'multi-dot';
          dot.textContent = `+${sl.extra_images.length}`;
          thumb.appendChild(dot);
        }
      } else {
        thumb.textContent = '📄';
      }

      const info = document.createElement('div');
      info.className = 'info';
      const cats = (sl.cats || []).filter(c => c !== 'other').slice(0, 3)
        .map(cid => {
          const cat = STATE.data.categories.find(c => c.id === cid);
          return cat ? `<span class="mini-badge" title="${cat.name}">${cat.icon}</span>` : '';
        }).join('');
      const dxBadge = (!STATE.quizMode && sl.dx_label)
        ? `<span class="card-dx" title="${escapeHtml(sl.dx_label)}">🩺 ${escapeHtml(sl.dx_label.replace(/\s*\(.*\)/, ''))}</span>`
        : '';
      info.innerHTML = `
        <div class="num">#${String(sl.idx).padStart(3, '0')} · ${escapeHtml(sl.source_label || '')}</div>
        <div class="ttl">${escapeHtml(STATE.quizMode ? '🤔 진단해보세요' : (sl.title || '(제목 없음)'))}</div>
        ${dxBadge}
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
    STATE.viewerImgIdx = 0;
    renderViewer();
    $('#radViewer').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeViewer() {
    $('#radViewer').hidden = true;
    document.body.style.overflow = '';
  }

  function getAllImages(sl) {
    const arr = [];
    if (sl.image) arr.push(sl.image);
    if (sl.extra_images) arr.push(...sl.extra_images);
    return arr;
  }

  function renderViewer() {
    const sl = STATE.filtered[STATE.currentIdx];
    if (!sl) return;
    $('#viewerIdx').textContent =
      `${STATE.currentIdx + 1} / ${STATE.filtered.length}  ·  Slide ${sl.idx}`;
    $('#viewerSource').textContent = sl.source_label || '';
    $('#viewerTitle').textContent = sl.title || '(제목 없음)';
    const highlightTerms = [
      sl.dx_label,
      ...(sl.finding_labels || []),
    ].filter(Boolean);
    $('#viewerBody').innerHTML = sl.body
      ? formatBody(sl.body, { highlightTerms })
      : '<p class="md-empty">(본문 없음)</p>';

    // 이미지 갤러리
    const images = getAllImages(sl);
    const img = $('#viewerImg');
    const noImg = $('#viewerNoImg');
    const thumbs = $('#viewerThumbs');
    if (images.length) {
      const cur = images[STATE.viewerImgIdx] || images[0];
      img.src = cur;
      img.style.display = '';
      img.alt = sl.title || '';
      noImg.hidden = true;
      // 썸네일
      if (images.length > 1) {
        thumbs.hidden = false;
        thumbs.innerHTML = images.map((src, i) =>
          `<button class="vthumb${i === STATE.viewerImgIdx ? ' active' : ''}" data-i="${i}">
            <img src="${src}" alt="" />
          </button>`
        ).join('');
        thumbs.querySelectorAll('button').forEach(b => {
          b.addEventListener('click', () => {
            STATE.viewerImgIdx = Number(b.dataset.i);
            renderViewer();
          });
        });
      } else {
        thumbs.hidden = true;
      }
    } else {
      img.style.display = 'none';
      img.src = '';
      noImg.hidden = false;
      thumbs.hidden = true;
    }

    // 노트
    const notesWrap = $('#viewerNotesWrap');
    if (sl.notes && sl.notes.trim()) {
      notesWrap.hidden = false;
      $('#viewerNotes').innerHTML = formatBody(sl.notes, { highlightTerms });
    } else {
      notesWrap.hidden = true;
    }

    // 태그(진단·소견·카테고리)
    const tagsWrap = $('#viewerTags');
    const tags = [];
    if (sl.dx_label) tags.push(`<span class="tag tag-dx">🩺 ${escapeHtml(sl.dx_label)}</span>`);
    (sl.finding_labels || []).forEach(f =>
      tags.push(`<span class="tag tag-finding">🔎 ${escapeHtml(f)}</span>`)
    );
    (sl.cats || []).forEach(cid => {
      const c = STATE.data.categories.find(x => x.id === cid);
      if (!c || c.id === 'all' || c.id === 'other') return;
      tags.push(`<span class="tag">${c.icon} ${escapeHtml(c.name)}</span>`);
    });
    tagsWrap.innerHTML = tags.join('');

    // Quiz mode: 텍스트 가리기
    const body = $('#viewerBody');
    const revealBtn = $('#revealBtn');
    if (STATE.quizMode) {
      body.classList.add('hidden');
      notesWrap.style.display = 'none';
      tagsWrap.style.display = 'none';
      $('#viewerTitle').textContent = '🤔 진단해보세요';
      revealBtn.hidden = false;
    } else {
      body.classList.remove('hidden');
      notesWrap.style.display = '';
      tagsWrap.style.display = '';
      revealBtn.hidden = true;
    }

    $('#viewerPrev').disabled = STATE.currentIdx === 0;
    $('#viewerNext').disabled = STATE.currentIdx === STATE.filtered.length - 1;
  }

  function reveal() {
    const sl = STATE.filtered[STATE.currentIdx];
    if (!sl) return;
    $('#viewerTitle').textContent = sl.title || '(제목 없음)';
    $('#viewerBody').classList.remove('hidden');
    $('#viewerNotesWrap').style.display = '';
    $('#viewerTags').style.display = '';
    $('#revealBtn').hidden = true;
  }

  function navViewer(delta) {
    const next = STATE.currentIdx + delta;
    if (next < 0 || next >= STATE.filtered.length) return;
    STATE.currentIdx = next;
    STATE.viewerImgIdx = 0;
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

    document.addEventListener('keydown', e => {
      if ($('#radViewer').hidden) return;
      if (e.key === 'ArrowLeft') navViewer(-1);
      else if (e.key === 'ArrowRight') navViewer(1);
      else if (e.key === 'Escape') closeViewer();
      else if (e.key.toLowerCase() === 'r' && STATE.quizMode) reveal();
    });
  }

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, c => (
      { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
    ));
  }

  // ---------- formatBody / formatNotes: 가독성 변환 ----------
  // 본문 텍스트를 줄 단위로 분석해서 목록·단락·라벨로 변환
  function formatBody(text, opts = {}) {
    if (!text) return '';
    const highlightTerms = opts.highlightTerms || [];
    // 줄 분리 + 빈 줄로 단락 구분
    const paragraphs = String(text).replace(/\r\n/g, '\n')
      .split(/\n\s*\n/).map(p => p.split('\n').map(l => l.replace(/\s+$/, '')));

    const html = paragraphs.map(lines => renderParagraph(lines, highlightTerms)).join('');
    return html || `<p>${escapeHtml(text)}</p>`;
  }

  function renderParagraph(lines, highlightTerms) {
    // 라인 분류
    const out = [];
    let listType = null;  // 'ol' | 'ul' | null
    let listItems = [];

    const flushList = () => {
      if (!listType) return;
      out.push(`<${listType} class="md-list">${listItems.map(li => `<li>${li}</li>`).join('')}</${listType}>`);
      listType = null;
      listItems = [];
    };

    for (let raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      // 번호 목록: 1. 1) (1) #1.
      let m = line.match(/^(?:#?\(?\s*\d+\s*[.)]\s+)(.+)$/);
      if (m) {
        if (listType !== 'ol') { flushList(); listType = 'ol'; }
        listItems.push(formatInline(m[1], highlightTerms));
        continue;
      }
      // 불릿: -, •, ·, *, →
      m = line.match(/^[-•·*→]\s+(.+)$/);
      if (m) {
        if (listType !== 'ul') { flushList(); listType = 'ul'; }
        listItems.push(formatInline(m[1], highlightTerms));
        continue;
      }
      flushList();
      // 콜론 포함: 라벨로 처리. R/O는 예외
      const colonMatch = line.match(/^([^:：]{1,30})\s*[:：]\s*(.+)$/);
      const isShortHeader = line.length <= 30 && !line.includes(':') && !line.includes('：');
      if (colonMatch && !/^\s*r\s*\/\s*o\b/i.test(line)) {
        out.push(`<p class="md-line"><b class="md-label">${formatInline(colonMatch[1], highlightTerms)}</b><span class="md-sep">:</span> ${formatInline(colonMatch[2], highlightTerms)}</p>`);
      } else if (isShortHeader) {
        // 짧은 한 줄 = 작은 헤더
        out.push(`<p class="md-subhead">${formatInline(line, highlightTerms)}</p>`);
      } else {
        out.push(`<p class="md-line">${formatInline(line, highlightTerms)}</p>`);
      }
    }
    flushList();
    if (!out.length) return '';
    return `<div class="md-para">${out.join('')}</div>`;
  }

  // 인라인 처리: HTML 이스케이프 + 키워드 강조
  function formatInline(text, highlightTerms) {
    let s = escapeHtml(text);
    // R/O (Rule-out) 강조
    s = s.replace(/\b(R\s*\/\s*O|r\s*\/\s*o)\b/g, '<span class="kw-ro">R/O</span>');
    // 알려진 진단·소견 키워드 강조 (대소문자 무시, 단어 경계)
    const seen = new Set();
    for (const term of highlightTerms) {
      // 라벨에서 괄호 안 영문 부분만 추출 시도 (예: "기흉 (Pneumothorax)" -> ["기흉","Pneumothorax"])
      const pieces = String(term).split(/[()]/).map(x => x.trim()).filter(Boolean);
      for (const p of pieces) {
        const k = p.toLowerCase();
        if (k.length < 3 || seen.has(k)) continue;
        seen.add(k);
        const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(?<![\\w가-힣])(${esc})(?![\\w가-힣])`, 'gi');
        s = s.replace(re, '<mark class="kw-term">$1</mark>');
      }
    }
    // 추가 일반 의학용어
    const COMMON = [
      'GGO', 'consolidation', 'cavity', 'cavitary', 'nodule', 'mass',
      'pneumonia', 'pneumothorax', 'effusion', 'atelectasis', 'emphysema',
      'bronchiectasis', 'honeycombing', 'fibrosis', 'cardiomegaly',
      'lymphadenopathy', 'pulmonary edema', 'lung cancer', 'tuberculosis',
      'TB', 'COPD', 'ARDS', 'PE',
    ];
    for (const w of COMMON) {
      const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(?<![\\w가-힣<])(${esc})(?!\\w)`, 'gi');
      s = s.replace(re, '<mark class="kw-term">$1</mark>');
    }
    return s;
  }

  load();
})();
