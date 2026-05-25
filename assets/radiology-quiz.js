// 흉부 X-ray 진단·소견 자가 퀴즈
(function () {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  const STATE = {
    data: null,
    mode: null,                  // 'dx' | 'finding' | 'mix'
    questions: [],               // 현재 세션의 문제 배열
    answers: [],                 // 사용자 답: dx=정답 index, finding=set of finding ids
    correctness: [],             // boolean 또는 0~1 (partial)
    currentIdx: 0,
    immediate: true,
    qCount: 10,
    startedAt: null,
  };

  const LS_KEY = 'radQuizScores';

  // ---------- load ----------
  async function load() {
    try {
      const res = await fetch('assets/radiology.json');
      STATE.data = await res.json();
      initSelect();
    } catch (e) {
      console.error(e);
      $('#rq-select').innerHTML = '<p style="color:#c00;text-align:center">데이터 로드 실패</p>';
    }
  }

  // ---------- 선택 화면 ----------
  function initSelect() {
    const pool = STATE.data.quiz_pools || {};
    const dxN = (pool.dx_ids || []).length;
    const fdN = (pool.finding_ids || []).length;
    $('#dxPoolMeta').textContent = `${dxN}문항 풀`;
    $('#findingPoolMeta').textContent = `${fdN}문항 풀`;

    // dx 카운트 → 4지선다 distractor가 부족하면 dx 모드 비활성
    const dxDistinct = (STATE.data.diagnoses || []).filter(d => d.count > 0).length;
    if (dxDistinct < 4) {
      const dxCard = document.querySelector('[data-mode="dx"]');
      dxCard.disabled = true;
      dxCard.title = '진단 종류가 4개 미만이어서 4지선다 출제 불가';
    }

    // 모드 카드 클릭
    $$('.rq-mode-card').forEach(card => {
      card.addEventListener('click', () => {
        if (card.disabled) return;
        startQuiz(card.dataset.mode);
      });
    });

    // 옵션
    $('#qCount').addEventListener('change', e => { STATE.qCount = Number(e.target.value); });
    $('#immediateToggle').addEventListener('change', e => { STATE.immediate = e.target.checked; });

    // 최근 점수
    const scores = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    if (scores.length) {
      $('#recentScores').textContent = scores.slice(-3).reverse()
        .map(s => `${s.mode}=${s.score}/${s.total}`).join(', ');
    }
  }

  // ---------- 퀴즈 생성 ----------
  function buildQuestions(mode) {
    const slides = STATE.data.slides;
    const byId = Object.fromEntries(slides.map(s => [s.idx, s]));
    const dxPool = (STATE.data.quiz_pools.dx_ids || []).map(id => byId[id]).filter(Boolean);
    const fdPool = (STATE.data.quiz_pools.finding_ids || []).map(id => byId[id]).filter(Boolean);

    const dxList = STATE.data.diagnoses.filter(d => d.count > 0);
    const findingList = STATE.data.findings_meta;

    const dxQuestion = (sl) => {
      // 같은 진단이 아닌 다른 진단 3개를 후보로
      const others = dxList.filter(d => d.id !== sl.dx);
      shuffle(others);
      const distractors = others.slice(0, 3).map(d => ({ id: d.id, label: d.label }));
      const correct = { id: sl.dx, label: sl.dx_label };
      const choices = shuffle([correct, ...distractors]);
      return {
        type: 'dx',
        slide: sl,
        prompt: '이 흉부 사진에서 가장 적절한 진단은?',
        choices,                                  // [{id,label}, ...]
        correctIdx: choices.findIndex(c => c.id === sl.dx),
      };
    };

    const findingQuestion = (sl) => {
      const present = new Set(sl.findings || []);
      // 정답이 5개 초과면 너무 어려우니 5개로 제한
      const presentArr = Array.from(present).slice(0, 5);
      const presentSet = new Set(presentArr);
      // distractor 소견: 정답 아닌 것 중 6개 무작위
      const others = findingList.filter(f => !presentSet.has(f.id));
      shuffle(others);
      const distractors = others.slice(0, Math.max(4, 7 - presentArr.length))
        .map(f => ({ id: f.id, label: f.label }));
      const correctChoices = presentArr.map(id => ({
        id, label: findingList.find(f => f.id === id)?.label || id,
      }));
      const choices = shuffle([...correctChoices, ...distractors]);
      return {
        type: 'finding',
        slide: sl,
        prompt: '이 사진에서 보이는 모든 비정상 소견을 고르세요. (정답 ' + presentArr.length + '개)',
        choices,
        correctIds: new Set(presentArr),
      };
    };

    let questions = [];
    if (mode === 'dx') {
      const arr = shuffle([...dxPool]).slice(0, STATE.qCount);
      questions = arr.map(dxQuestion);
    } else if (mode === 'finding') {
      const arr = shuffle([...fdPool]).slice(0, STATE.qCount);
      questions = arr.map(findingQuestion);
    } else {
      // mix: 절반씩
      const half = Math.ceil(STATE.qCount / 2);
      const dxArr = shuffle([...dxPool]).slice(0, half).map(dxQuestion);
      const fdArr = shuffle([...fdPool]).slice(0, STATE.qCount - half).map(findingQuestion);
      questions = shuffle([...dxArr, ...fdArr]);
    }
    return questions;
  }

  function startQuiz(mode) {
    STATE.mode = mode;
    STATE.questions = buildQuestions(mode);
    if (!STATE.questions.length) {
      alert('출제 가능한 문제가 없습니다.');
      return;
    }
    STATE.answers = new Array(STATE.questions.length).fill(null);
    STATE.correctness = new Array(STATE.questions.length).fill(null);
    STATE.currentIdx = 0;
    STATE.startedAt = Date.now();

    showScreen('rq-quiz');
    renderQuestion();
    bindQuiz();
  }

  function showScreen(id) {
    ['rq-select', 'rq-quiz', 'rq-result'].forEach(s => {
      $('#' + s).hidden = (s !== id);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- 문제 렌더링 ----------
  function renderQuestion() {
    const q = STATE.questions[STATE.currentIdx];
    const total = STATE.questions.length;
    $('#rqIndex').textContent = `${STATE.currentIdx + 1} / ${total}`;
    $('#rqBadge').textContent = q.type === 'dx' ? '진단 4지선다' : '소견 다중선택';
    $('#rqBadge').className = 'rq-badge ' + (q.type === 'dx' ? 'badge-dx' : 'badge-finding');
    $('#rqProgressFill').style.width = `${(STATE.currentIdx) / total * 100}%`;

    $('#rqImg').src = q.slide.image;
    $('#rqImg').alt = '흉부 X-ray';

    $('#rqPrompt').textContent = q.prompt;

    // 선지
    const list = $('#rqChoices');
    list.innerHTML = '';
    const isFinding = q.type === 'finding';
    q.choices.forEach((c, i) => {
      const li = document.createElement('li');
      li.className = 'rq-choice';
      const inputType = isFinding ? 'checkbox' : 'radio';
      li.innerHTML = `
        <label>
          <input type="${inputType}" name="rq-choice" value="${i}" />
          <span class="rq-label-text">${escapeHtml(c.label)}</span>
        </label>
      `;
      list.appendChild(li);
    });

    // 선지 변경 감지
    list.addEventListener('change', updateSubmitState);

    // 이전에 답한 경우 복원
    const prevAns = STATE.answers[STATE.currentIdx];
    const prevCorrect = STATE.correctness[STATE.currentIdx];
    if (prevAns != null) {
      restoreAnswer(prevAns, q);
      if (prevCorrect != null) {
        showExplanation(q, prevAns, prevCorrect, /*disable*/ true);
      }
    } else {
      $('#rqExplain').hidden = true;
      $('#rqSubmitBtn').hidden = false;
      $('#rqNextBtn').hidden = true;
      $('#rqSubmitBtn').disabled = true;
    }
  }

  function restoreAnswer(ans, q) {
    if (q.type === 'dx') {
      const radios = $$('input[name="rq-choice"]');
      if (radios[ans]) radios[ans].checked = true;
    } else {
      const inputs = $$('input[name="rq-choice"]');
      ans.forEach(i => { if (inputs[i]) inputs[i].checked = true; });
    }
    updateSubmitState();
  }

  function updateSubmitState() {
    const inputs = $$('input[name="rq-choice"]:checked');
    $('#rqSubmitBtn').disabled = inputs.length === 0;
  }

  function readAnswer(q) {
    const inputs = $$('input[name="rq-choice"]:checked').map(i => Number(i.value));
    if (q.type === 'dx') return inputs[0];
    return inputs.sort((a, b) => a - b);
  }

  function gradeAnswer(q, ans) {
    if (q.type === 'dx') {
      return ans === q.correctIdx ? 1 : 0;
    }
    // finding: F1 score (간단)
    const selectedIds = new Set(ans.map(i => q.choices[i].id));
    const correctIds = q.correctIds;
    let tp = 0, fp = 0, fn = 0;
    selectedIds.forEach(id => correctIds.has(id) ? tp++ : fp++);
    correctIds.forEach(id => !selectedIds.has(id) && fn++);
    if (tp === 0) return 0;
    if (fp === 0 && fn === 0) return 1; // perfect
    // partial credit: F1
    const precision = tp / (tp + fp);
    const recall = tp / (tp + fn);
    return (2 * precision * recall) / (precision + recall);
  }

  function showExplanation(q, ans, score, disabledOnly) {
    const explain = $('#rqExplain');
    explain.hidden = false;
    const verdict = $('#rqVerdict');
    const ansLine = $('#rqAnswerLine');
    const expText = $('#rqExplainText');

    // 채점된 선지 색칠
    const inputs = $$('input[name="rq-choice"]');
    inputs.forEach((input, i) => {
      const li = input.closest('li');
      li.classList.remove('correct', 'wrong', 'missed');
      if (q.type === 'dx') {
        if (i === q.correctIdx) li.classList.add('correct');
        else if (i === ans) li.classList.add('wrong');
      } else {
        const isSelected = ans.includes(i);
        const cid = q.choices[i].id;
        const isCorrect = q.correctIds.has(cid);
        if (isSelected && isCorrect) li.classList.add('correct');
        else if (isSelected && !isCorrect) li.classList.add('wrong');
        else if (!isSelected && isCorrect) li.classList.add('missed');
      }
      input.disabled = true;
    });

    // 결과 텍스트
    if (q.type === 'dx') {
      if (score === 1) {
        verdict.innerHTML = '✅ <b>정답</b>';
        verdict.className = 'rq-verdict ok';
      } else {
        verdict.innerHTML = '❌ <b>오답</b>';
        verdict.className = 'rq-verdict ng';
      }
      ansLine.textContent = `정답: ${q.choices[q.correctIdx].label}`;
    } else {
      const pct = Math.round(score * 100);
      if (score === 1) {
        verdict.innerHTML = `✅ <b>완벽</b> (${pct}점)`;
        verdict.className = 'rq-verdict ok';
      } else if (score >= 0.5) {
        verdict.innerHTML = `🟡 <b>부분 정답</b> (${pct}점)`;
        verdict.className = 'rq-verdict partial';
      } else {
        verdict.innerHTML = `❌ <b>오답</b> (${pct}점)`;
        verdict.className = 'rq-verdict ng';
      }
      const correctLabels = Array.from(q.correctIds).map(id =>
        q.choices.find(c => c.id === id)?.label || id
      );
      ansLine.innerHTML = `정답: <b>${correctLabels.map(escapeHtml).join(', ')}</b>`;
    }

    // 원본 슬라이드 발췌
    const sl = q.slide;
    const explainParts = [];
    if (sl.title) explainParts.push(`<b>${escapeHtml(sl.title)}</b>`);
    if (sl.body) explainParts.push(escapeHtml(sl.body));
    if (sl.notes) explainParts.push(`<i>${escapeHtml(sl.notes)}</i>`);
    expText.innerHTML = explainParts.join('<br><br>');

    // source detail
    if (sl.body || sl.notes) {
      $('#rqSourceDetail').hidden = false;
      $('#rqSourceBody').innerHTML = `
        <p class="rq-src-meta">📦 ${escapeHtml(sl.source_label || '')} · Slide #${sl.idx}</p>
        <p class="rq-src-title">${escapeHtml(sl.title || '')}</p>
        <pre>${escapeHtml(sl.body || '')}</pre>
        ${sl.notes ? `<pre class="rq-notes">📝 ${escapeHtml(sl.notes)}</pre>` : ''}
      `;
    } else {
      $('#rqSourceDetail').hidden = true;
    }

    // 버튼
    $('#rqSubmitBtn').hidden = true;
    $('#rqNextBtn').hidden = false;
    if (STATE.currentIdx === STATE.questions.length - 1) {
      $('#rqNextBtn').textContent = '결과 보기';
    } else {
      $('#rqNextBtn').textContent = '다음 →';
    }
  }

  function submitAnswer() {
    const q = STATE.questions[STATE.currentIdx];
    const ans = readAnswer(q);
    STATE.answers[STATE.currentIdx] = ans;
    const score = gradeAnswer(q, ans);
    STATE.correctness[STATE.currentIdx] = score;
    if (STATE.immediate) {
      showExplanation(q, ans, score, false);
    } else {
      goNext();
    }
  }

  function goNext() {
    if (STATE.currentIdx >= STATE.questions.length - 1) {
      finish();
      return;
    }
    STATE.currentIdx += 1;
    renderQuestion();
  }

  function finish() {
    // 즉시 채점이 꺼져있던 경우 일괄 채점
    STATE.questions.forEach((q, i) => {
      if (STATE.correctness[i] == null && STATE.answers[i] != null) {
        STATE.correctness[i] = gradeAnswer(q, STATE.answers[i]);
      }
    });
    const total = STATE.questions.length;
    const sumScore = STATE.correctness.reduce((a, b) => a + (b || 0), 0);
    const score = Math.round(sumScore * 10) / 10;
    const elapsed = Math.round((Date.now() - STATE.startedAt) / 1000);
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');

    $('#rqResultScore').textContent = `${score} / ${total}`;
    $('#rqResultTime').textContent = `${mm}:${ss}`;
    $('#rqResultMode').textContent = ({ dx: '진단 4지선다', finding: '소견 다중선택', mix: '혼합 모드' })[STATE.mode];

    const pct = sumScore / total;
    let emoji, msg;
    if (pct >= 0.9) { emoji = '🏆'; msg = '거의 만점이에요! 임상 판독 능력이 우수합니다.'; }
    else if (pct >= 0.7) { emoji = '🎉'; msg = '좋은 성적입니다. 틀린 문항을 복습해보세요.'; }
    else if (pct >= 0.5) { emoji = '💪'; msg = '평균 수준. 학습 모드로 보강하고 다시 풀어보세요.'; }
    else { emoji = '📚'; msg = '학습 모드로 충분히 익힌 후 다시 도전해보세요.'; }
    $('#rqResultEmoji').textContent = emoji;
    $('#rqResultMessage').textContent = msg;

    // 점수 저장
    const log = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    log.push({
      mode: STATE.mode, score, total,
      time: elapsed, at: new Date().toISOString(),
    });
    localStorage.setItem(LS_KEY, JSON.stringify(log.slice(-20)));

    // 오답 노트
    const wrong = STATE.questions
      .map((q, i) => ({ q, i, s: STATE.correctness[i] }))
      .filter(x => x.s < 1);
    if (wrong.length) {
      $('#rqWrongOnlyBtn').hidden = false;
      renderWrongList(wrong);
    } else {
      $('#rqWrongOnlyBtn').hidden = true;
    }

    showScreen('rq-result');
  }

  function renderWrongList(wrong) {
    const wrap = $('#rqWrongList');
    wrap.innerHTML = wrong.map(({ q, i, s }) => {
      const sl = q.slide;
      const typeLabel = q.type === 'dx' ? '진단' : '소견';
      const correctAns = q.type === 'dx'
        ? q.choices[q.correctIdx].label
        : Array.from(q.correctIds).map(id => q.choices.find(c => c.id === id)?.label || id).join(', ');
      return `
        <div class="rq-wrong-item">
          <img src="${sl.image}" alt="" loading="lazy" />
          <div>
            <p class="rq-wrong-meta">#${i + 1} · ${typeLabel} · 점수 ${Math.round(s * 100)}%</p>
            <p class="rq-wrong-title">${escapeHtml(sl.title || '')}</p>
            <p class="rq-wrong-ans">정답: <b>${escapeHtml(correctAns)}</b></p>
            ${sl.body ? `<details><summary>본문 보기</summary><pre>${escapeHtml(sl.body)}</pre></details>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // ---------- 이벤트 ----------
  let quizBound = false;
  function bindQuiz() {
    if (quizBound) return;
    quizBound = true;
    $('#rqSubmitBtn').addEventListener('click', submitAnswer);
    $('#rqNextBtn').addEventListener('click', goNext);
    $('#rqExitBtn').addEventListener('click', () => {
      if (confirm('퀴즈를 중단하시겠습니까? 진행 상황은 사라집니다.')) {
        showScreen('rq-select');
      }
    });

    $('#rqRetryBtn').addEventListener('click', () => startQuiz(STATE.mode));
    $('#rqHomeBtn').addEventListener('click', () => showScreen('rq-select'));
    $('#rqWrongOnlyBtn').addEventListener('click', () => {
      const wrongQuestions = STATE.questions.filter((_, i) => STATE.correctness[i] < 1);
      if (!wrongQuestions.length) return;
      STATE.questions = wrongQuestions;
      STATE.answers = new Array(wrongQuestions.length).fill(null);
      STATE.correctness = new Array(wrongQuestions.length).fill(null);
      STATE.currentIdx = 0;
      STATE.startedAt = Date.now();
      showScreen('rq-quiz');
      renderQuestion();
    });

    // 이미지 확대
    $('#rqZoomBtn').addEventListener('click', () => {
      $('#rqZoomImg').src = $('#rqImg').src;
      $('#rqZoomModal').hidden = false;
      document.body.style.overflow = 'hidden';
    });
    $('#rqZoomClose').addEventListener('click', closeZoom);
    document.querySelector('.rq-zoom-overlay').addEventListener('click', closeZoom);

    document.addEventListener('keydown', e => {
      if (!$('#rq-quiz').hidden) {
        if (e.key === 'Enter' && !$('#rqSubmitBtn').hidden && !$('#rqSubmitBtn').disabled) {
          submitAnswer();
        } else if (e.key === 'Enter' && !$('#rqNextBtn').hidden) {
          goNext();
        }
      }
      if (!$('#rqZoomModal').hidden && e.key === 'Escape') closeZoom();
    });
  }

  function closeZoom() {
    $('#rqZoomModal').hidden = true;
    document.body.style.overflow = '';
  }

  // ---------- utils ----------
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, c => (
      { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
    ));
  }

  load();
})();
