// 호흡기 시험 (전공의 자가평가)
(function () {
  'use strict';

  const STATE = {
    questionsDb: null,
    selectedCat: null,
    quizQs: [],        // 현재 시험에 출제된 10문제
    currentIdx: 0,
    answers: [],       // 사용자 선택지 index 배열
    startTime: null,
    timerInterval: null,
    timerSeconds: 0,
    timerEnabled: false,
    immediateReveal: true,
    QUIZ_LIMIT: 10,
    TIMER_DURATION: 10 * 60, // 10분
  };

  const $ = sel => document.querySelector(sel);

  // ---------- helpers ----------
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function showScreen(id) {
    document.querySelectorAll('.quiz-screen').forEach(el => el.hidden = el.id !== id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- load questions ----------
  async function loadQuestions() {
    try {
      const res = await fetch('assets/questions.json');
      STATE.questionsDb = await res.json();
      renderCategories();
    } catch (e) {
      console.error('Failed to load questions', e);
      $('#categoryGrid').innerHTML = '<p style="color:#c00">문제 데이터 로드 실패</p>';
    }
  }

  // ---------- category selection ----------
  function renderCategories() {
    const grid = $('#categoryGrid');
    const cats = STATE.questionsDb.categories;
    grid.innerHTML = '';
    // 통합 시험 카드 (전체 6분야)
    grid.appendChild(makeCatCard({
      id: 'all',
      icon: '🎯',
      name: '종합 모의시험',
      desc: '6개 분야 통합 · 10문제 · 분야별 강약점 분석 포함',
    }));
    cats.forEach(c => grid.appendChild(makeCatCard(c)));
    fetchGlobalStats();
  }

  function makeCatCard(cat) {
    const btn = document.createElement('button');
    btn.className = 'cat-card';
    btn.type = 'button';
    btn.dataset.cat = cat.id;
    btn.innerHTML = `
      <span class="cat-icon">${cat.icon}</span>
      <div class="cat-name">${cat.name}</div>
      <div class="cat-desc">${cat.desc}</div>
      <span class="cat-arrow">시작 →</span>
    `;
    btn.addEventListener('click', () => startQuiz(cat.id));
    return btn;
  }

  // ---------- global stats ----------
  async function fetchGlobalStats() {
    const wrap = $('#globalStats');
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('API not ready');
      const data = await res.json();
      renderGlobalStats(data);
    } catch (e) {
      // API 미설정 시 graceful fallback
      wrap.innerHTML = `
        <div class="stat-item"><span class="stat-label">전체 응시</span><span class="stat-value">-</span></div>
        <div class="stat-item"><span class="stat-label">평균 점수</span><span class="stat-value">-</span></div>
        <div class="stat-item"><span class="stat-label">최고 점수</span><span class="stat-value">-</span></div>
        <div class="stat-item"><span class="stat-label">상태</span><span class="stat-value" style="font-size:13px">로컬모드</span></div>
      `;
    }
  }

  function renderGlobalStats(data) {
    const wrap = $('#globalStats');
    const total = data.total || 0;
    const avg = total ? (data.sum / total).toFixed(1) : '-';
    const max = data.max ?? '-';
    wrap.innerHTML = `
      <div class="stat-item"><span class="stat-label">전체 응시</span><span class="stat-value">${total}</span></div>
      <div class="stat-item"><span class="stat-label">평균 점수</span><span class="stat-value">${avg}</span></div>
      <div class="stat-item"><span class="stat-label">최고 점수</span><span class="stat-value">${max}/10</span></div>
      <div class="stat-item"><span class="stat-label">상태</span><span class="stat-value" style="font-size:13px;color:#16a34a">실시간</span></div>
    `;
  }

  // ---------- start quiz ----------
  function startQuiz(catId, retryQs) {
    STATE.selectedCat = catId;
    STATE.timerEnabled = $('#timerToggle').checked;
    STATE.immediateReveal = $('#immediateToggle').checked;

    let pool;
    if (retryQs && retryQs.length) {
      pool = retryQs;
    } else if (catId === 'all') {
      pool = STATE.questionsDb.questions;
    } else {
      pool = STATE.questionsDb.questions.filter(q => q.cat === catId);
    }
    STATE.quizQs = shuffle(pool).slice(0, STATE.QUIZ_LIMIT);
    STATE.currentIdx = 0;
    STATE.answers = new Array(STATE.quizQs.length).fill(null);
    STATE.startTime = Date.now();

    // 분야 badge
    const catObj = STATE.questionsDb.categories.find(c => c.id === catId);
    const catName = catId === 'all' ? '🎯 종합 모의시험' : `${catObj.icon} ${catObj.name}`;
    $('#catBadge').textContent = catName;

    // timer
    if (STATE.timerEnabled) {
      STATE.timerSeconds = STATE.TIMER_DURATION;
      $('#timerDisplay').hidden = false;
      $('#timerValue').textContent = fmtTime(STATE.timerSeconds);
      STATE.timerInterval = setInterval(() => {
        STATE.timerSeconds--;
        if (STATE.timerSeconds <= 0) {
          STATE.timerSeconds = 0;
          finishQuiz();
        }
        $('#timerValue').textContent = fmtTime(STATE.timerSeconds);
      }, 1000);
    } else {
      $('#timerDisplay').hidden = true;
    }

    renderQuestion();
    showScreen('screen-quiz');
  }

  // ---------- render question ----------
  function renderQuestion() {
    const q = STATE.quizQs[STATE.currentIdx];
    const total = STATE.quizQs.length;
    $('#qIndex').textContent = `${STATE.currentIdx + 1} / ${total}`;
    $('#progressFill').style.width = `${((STATE.currentIdx + 1) / total) * 100}%`;
    $('#questionText').textContent = `Q${STATE.currentIdx + 1}. ${q.q}`;

    const list = $('#choicesList');
    list.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D', 'E'];
    q.choices.forEach((ch, i) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.type = 'button';
      btn.innerHTML = `<span class="choice-letter">${letters[i]}</span><span>${ch}</span>`;
      btn.addEventListener('click', () => onChoose(i, btn));
      li.appendChild(btn);
      list.appendChild(li);
    });

    $('#explanationBox').hidden = true;
    $('#explanationBox').innerHTML = '';
    $('#nextBtn').disabled = true;
    $('#nextBtn').textContent = STATE.currentIdx === total - 1 ? '결과 보기 →' : '다음 →';
  }

  function onChoose(idx, btn) {
    if (btn.disabled) return;
    const q = STATE.quizQs[STATE.currentIdx];
    STATE.answers[STATE.currentIdx] = idx;

    if (STATE.immediateReveal) {
      // 모든 선택지 disabled + 정답/오답 표시
      document.querySelectorAll('.choice-btn').forEach((b, i) => {
        b.disabled = true;
        if (i === q.a) b.classList.add('correct');
        else if (i === idx) b.classList.add('wrong');
      });
      // 해설
      const box = $('#explanationBox');
      const correctMark = idx === q.a ? '✅ 정답' : '❌ 오답';
      box.innerHTML = `<strong>${correctMark}</strong><br>${q.e}`;
      box.hidden = false;
    } else {
      // 선택만 표시
      document.querySelectorAll('.choice-btn').forEach((b, i) => {
        b.classList.toggle('selected', i === idx);
      });
    }

    $('#nextBtn').disabled = false;
  }

  // ---------- navigation ----------
  $('#nextBtn').addEventListener('click', () => {
    if (STATE.currentIdx < STATE.quizQs.length - 1) {
      STATE.currentIdx++;
      renderQuestion();
    } else {
      finishQuiz();
    }
  });

  $('#exitBtn').addEventListener('click', () => {
    if (confirm('시험을 중단하시겠습니까? 진행 상황은 저장되지 않습니다.')) {
      if (STATE.timerInterval) clearInterval(STATE.timerInterval);
      showScreen('screen-select');
    }
  });

  // ---------- finish & submit ----------
  async function finishQuiz() {
    if (STATE.timerInterval) clearInterval(STATE.timerInterval);
    const elapsedSec = Math.floor((Date.now() - STATE.startTime) / 1000);
    const score = STATE.quizQs.reduce((acc, q, i) => acc + (STATE.answers[i] === q.a ? 1 : 0), 0);

    // 결과 표시 우선
    renderResult(score, elapsedSec);
    showScreen('screen-result');

    // 백엔드 전송 (실패해도 결과는 보임)
    try {
      const catBreakdown = {};
      STATE.quizQs.forEach((q, i) => {
        catBreakdown[q.cat] = catBreakdown[q.cat] || { correct: 0, total: 0 };
        catBreakdown[q.cat].total++;
        if (STATE.answers[i] === q.a) catBreakdown[q.cat].correct++;
      });
      const payload = {
        category: STATE.selectedCat,
        score,
        total: STATE.quizQs.length,
        elapsedSec,
        breakdown: catBreakdown,
        timestamp: Date.now(),
      };
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        renderPercentile(data, score);
      } else {
        renderPercentileFallback(score);
      }
    } catch (e) {
      renderPercentileFallback(score);
    }
  }

  function renderResult(score, elapsedSec) {
    const total = STATE.quizQs.length;
    $('#resultScore').textContent = `${score} / ${total}`;
    $('#resultTime').textContent = fmtTime(elapsedSec);
    const catObj = STATE.questionsDb.categories.find(c => c.id === STATE.selectedCat);
    $('#resultCategory').textContent = STATE.selectedCat === 'all' ? '종합 모의시험' : catObj.name;

    const pct = score / total;
    let emoji, msg;
    if (pct >= 0.9) { emoji = '🏆'; msg = '완벽합니다! 호흡기 마스터!'; }
    else if (pct >= 0.7) { emoji = '🎉'; msg = '훌륭한 실력입니다.'; }
    else if (pct >= 0.5) { emoji = '👍'; msg = '잘 하셨습니다. 한 번 더 복습해보세요.'; }
    else if (pct >= 0.3) { emoji = '📖'; msg = '아쉬워요. 매뉴얼·요약본 복습이 필요합니다.'; }
    else { emoji = '💪'; msg = '괜찮습니다. 다시 도전하세요!'; }
    $('#resultEmoji').textContent = emoji;
    $('#resultMessage').textContent = msg;

    // 리뷰
    renderReview();
    // 종합 시험이면 radar chart
    if (STATE.selectedCat === 'all') {
      renderRadarChart();
      $('#radarSection').hidden = false;
    } else {
      $('#radarSection').hidden = true;
    }
  }

  function renderReview() {
    const wrap = $('#reviewList');
    wrap.innerHTML = '';
    STATE.quizQs.forEach((q, i) => {
      const userIdx = STATE.answers[i];
      const correct = userIdx === q.a;
      const div = document.createElement('div');
      div.className = `review-item ${correct ? 'correct' : 'wrong'}`;
      const userAnsTxt = userIdx == null ? '(무응답)' : q.choices[userIdx];
      div.innerHTML = `
        <span class="rv-mark ${correct ? 'ok' : 'no'}">${correct ? '✅' : '❌'}</span>
        <div class="rv-q">Q${i + 1}. ${q.q}</div>
        <div class="rv-ans">내 답: <strong>${userAnsTxt}</strong></div>
        ${!correct ? `<div class="rv-ans">정답: <strong>${q.choices[q.a]}</strong></div>` : ''}
        <div class="rv-exp">📌 ${q.e}</div>
      `;
      wrap.appendChild(div);
    });
  }

  function renderRadarChart() {
    const canvas = $('#radarChart');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;
    const r = Math.min(W, H) / 2 - 50;

    const cats = STATE.questionsDb.categories;
    // 분야별 정답률 계산
    const scoreByCat = {};
    cats.forEach(c => scoreByCat[c.id] = { correct: 0, total: 0 });
    STATE.quizQs.forEach((q, i) => {
      const c = q.cat;
      if (!scoreByCat[c]) scoreByCat[c] = { correct: 0, total: 0 };
      scoreByCat[c].total++;
      if (STATE.answers[i] === q.a) scoreByCat[c].correct++;
    });
    const values = cats.map(c => {
      const s = scoreByCat[c.id];
      return s.total ? s.correct / s.total : 0;
    });
    const labels = cats.map(c => c.name);

    ctx.clearRect(0, 0, W, H);
    const N = cats.length;
    const angleStep = (Math.PI * 2) / N;
    const startA = -Math.PI / 2;

    // 배경 동심 폴리곤
    for (let lev = 1; lev <= 4; lev++) {
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const a = startA + angleStep * i;
        const rr = (r * lev) / 4;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = lev === 4 ? '#9ca3af' : '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 축 선
    for (let i = 0; i < N; i++) {
      const a = startA + angleStep * i;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.strokeStyle = '#e5e7eb';
      ctx.stroke();
    }

    // 데이터 폴리곤
    ctx.beginPath();
    values.forEach((v, i) => {
      const a = startA + angleStep * i;
      const rr = r * v;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(46, 117, 182, 0.25)';
    ctx.strokeStyle = '#1f4e79';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    // 데이터 포인트
    values.forEach((v, i) => {
      const a = startA + angleStep * i;
      const rr = r * v;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#1f4e79';
      ctx.fill();
    });

    // 레이블
    ctx.font = 'bold 12px Pretendard, -apple-system, sans-serif';
    ctx.fillStyle = '#1f4e79';
    labels.forEach((label, i) => {
      const a = startA + angleStep * i;
      const lx = cx + Math.cos(a) * (r + 24);
      const ly = cy + Math.sin(a) * (r + 24);
      ctx.textAlign = Math.abs(Math.cos(a)) < 0.1 ? 'center' : (Math.cos(a) > 0 ? 'left' : 'right');
      ctx.textBaseline = Math.sin(a) > 0.3 ? 'top' : (Math.sin(a) < -0.3 ? 'bottom' : 'middle');
      ctx.fillText(label, lx, ly);
    });
  }

  function renderPercentile(serverData, score) {
    const total = serverData.total || 1;
    const better = serverData.lower || 0; // 내 점수보다 낮은 사람 수
    const percentile = Math.round((better / Math.max(total - 1, 1)) * 100);
    const topPct = 100 - percentile;
    $('#percentileFill').style.width = `${percentile}%`;
    $('#percentileLabel').textContent = `상위 ${topPct}%`;
    const avg = serverData.total ? (serverData.sum / serverData.total).toFixed(1) : '-';
    $('#percentileInfo').textContent = `전체 ${total}명 응시 · 평균 ${avg}점 · 내 점수 ${score}점`;
  }

  function renderPercentileFallback(score) {
    // 백엔드 없을 때는 localStorage 기반
    const history = JSON.parse(localStorage.getItem('quiz_scores') || '[]');
    history.push(score);
    localStorage.setItem('quiz_scores', JSON.stringify(history.slice(-100)));
    const avg = history.length ? (history.reduce((a, b) => a + b, 0) / history.length).toFixed(1) : '-';
    const max = history.length ? Math.max(...history) : '-';
    $('#percentileFill').style.width = `${(score / 10) * 100}%`;
    $('#percentileLabel').textContent = `${score}점`;
    $('#percentileInfo').textContent = `내 응시 ${history.length}회 · 내 평균 ${avg}점 · 내 최고 ${max}점 (서버 비교 미연결)`;
  }

  // ---------- result actions ----------
  $('#retryWrongBtn').addEventListener('click', () => {
    const wrongs = STATE.quizQs.filter((q, i) => STATE.answers[i] !== q.a);
    if (!wrongs.length) {
      alert('틀린 문제가 없습니다! 🎉');
      return;
    }
    startQuiz(STATE.selectedCat, wrongs);
  });
  $('#retryAllBtn').addEventListener('click', () => startQuiz(STATE.selectedCat));
  $('#newCatBtn').addEventListener('click', () => {
    showScreen('screen-select');
    fetchGlobalStats();
  });

  // ---------- init ----------
  loadQuestions();
})();
