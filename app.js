// ==========================================================================
// CHÂM CỨU THẦN TRÍ (ACU-ZEN) - 60 HUYỆT ĐẠO Y HỌC CỔ TRUYỀN
// Full Interactive Logic, Audio Synthesis, Games & Flashcards
// ==========================================================================

(function() {
  'use strict';

  // --- AUDIO SYNTHESIZER (Web Audio API - No MP3s needed, zero latency) ---
  class SoundEngine {
    constructor() {
      this.ctx = null;
    }
    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.ctx = new AudioContext();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }
    playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.15) {
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {}
    }
    tap() {
      this.playTone(400, 'triangle', 0.05, 0.08);
      if (navigator.vibrate) navigator.vibrate(8);
    }
    flip() {
      this.playTone(320, 'sine', 0.08, 0.08);
    }
    correct() {
      this.init();
      if (!this.ctx) return;
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 'triangle', 0.2, 0.12), i * 70);
      });
      if (navigator.vibrate) navigator.vibrate([15, 30, 15]);
    }
    wrong() {
      this.playTone(180, 'sawtooth', 0.25, 0.12);
      if (navigator.vibrate) navigator.vibrate(60);
    }
    levelUp() {
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, i) => {
        setTimeout(() => this.playTone(freq, 'sine', 0.3, 0.15), i * 90);
      });
    }
  }

  const sound = new SoundEngine();

  // --- STATE MANAGEMENT ---
  const state = {
    allPoints: window.ACUPOINTS_DATA || [],
    cases: window.CLINICAL_CASES || [],
    activeTab: 'flashcard',
    filterRegion: 'all',
    filteredPoints: [],
    currentIndex: 0,
    isCardFlipped: false,
    
    // Quiz State
    quiz: {
      score: 0,
      streak: 0,
      lives: 3,
      timer: null,
      timeLeft: 12,
      currentQuestion: null,
      isActive: false
    },

    // Case State
    caseState: {
      currentIndex: 0,
      selectedPoints: []
    },

    // Map State
    mapView: 'front', // 'front' | 'back'
    mapQuizTarget: null,
    mapScore: 0,

    // Persistence
    masteryMap: JSON.parse(localStorage.getItem('acu_mastery') || '{}'),
    stats: JSON.parse(localStorage.getItem('acu_stats') || '{"learned":0,"score":0,"streak":0}')
  };

  // --- DOM ELEMENTS CACHE ---
  const el = {};

  function initElements() {
    el.tabs = document.querySelectorAll('.nav-btn');
    el.sections = document.querySelectorAll('.view-section');
    el.statMastery = document.getElementById('stat-mastery');
    el.statScore = document.getElementById('stat-score');
    
    // Flashcard
    el.filterChips = document.querySelectorAll('.filter-chip');
    el.cardWrapper = document.getElementById('flashcard-wrapper');
    el.cardRegion = document.getElementById('card-region');
    el.cardIndex = document.getElementById('card-index');
    el.pointName = document.getElementById('point-name');
    el.mnemonicVerse = document.getElementById('mnemonic-verse');
    el.pointTipText = document.getElementById('point-tip-text');
    el.detailLocation = document.getElementById('detail-location');
    el.detailIndication = document.getElementById('detail-indication');
    el.detailSpecial = document.getElementById('detail-special');
    el.btnForgot = document.getElementById('btn-forgot');
    el.btnHesitant = document.getElementById('btn-hesitant');
    el.btnMastered = document.getElementById('btn-mastered');

    // Quiz
    el.hearts = document.querySelectorAll('.heart-icon');
    el.comboBadge = document.getElementById('combo-badge');
    el.timerFill = document.getElementById('timer-bar-fill');
    el.quizQuestion = document.getElementById('quiz-question');
    el.quizTypeBadge = document.getElementById('quiz-type-badge');
    el.quizOptions = document.getElementById('quiz-options');
    el.quizScoreVal = document.getElementById('quiz-score-val');

    // Cases
    el.caseNum = document.getElementById('case-num');
    el.caseTitle = document.getElementById('case-title');
    el.casePatient = document.getElementById('case-patient');
    el.caseGrid = document.getElementById('case-grid');
    el.caseFeedback = document.getElementById('case-feedback');
    el.btnCheckCase = document.getElementById('btn-check-case');

    // Map
    el.switchFront = document.getElementById('switch-front');
    el.switchBack = document.getElementById('switch-back');
    el.bodySvgFront = document.getElementById('body-svg-front');
    el.bodySvgBack = document.getElementById('body-svg-back');
    el.mapPreview = document.getElementById('map-preview');
    el.previewName = document.getElementById('preview-name');
    el.previewDesc = document.getElementById('preview-desc');
    el.mapGamePrompt = document.getElementById('map-game-prompt');

    // Atlas
    el.searchInput = document.getElementById('search-input');
    el.pointsList = document.getElementById('points-list');
    el.modalOverlay = document.getElementById('modal-overlay');
    el.modalContent = document.getElementById('modal-content');
  }

  // --- INITIALIZATION ---
  function init() {
    initElements();
    updateFilteredPoints();
    renderStats();
    bindEvents();
    renderFlashcard();
    renderAtlasList();
    initMapDots();
  }

  function updateFilteredPoints() {
    if (state.filterRegion === 'all') {
      state.filteredPoints = [...state.allPoints];
    } else {
      state.filteredPoints = state.allPoints.filter(p => p.region_id === state.filterRegion);
    }
    state.currentIndex = 0;
  }

  function renderStats() {
    const totalMastered = Object.values(state.masteryMap).filter(v => v >= 2).length;
    if (el.statMastery) el.statMastery.textContent = `${totalMastered}/60`;
    if (el.statScore) el.statScore.textContent = `${state.stats.score} XP`;
  }

  function saveMastery(id, delta) {
    state.masteryMap[id] = Math.max(0, (state.masteryMap[id] || 0) + delta);
    localStorage.setItem('acu_mastery', JSON.stringify(state.masteryMap));
    state.stats.score += Math.max(1, delta * 5);
    localStorage.setItem('acu_stats', JSON.stringify(state.stats));
    renderStats();
  }

  // --- 1. FLASHCARD LOGIC ---
  function renderFlashcard() {
    if (!state.filteredPoints.length) return;
    const point = state.filteredPoints[state.currentIndex];
    
    // Reset flip
    state.isCardFlipped = false;
    el.cardWrapper.classList.remove('flipped');

    el.cardRegion.textContent = point.region_name;
    el.cardIndex.textContent = `${state.currentIndex + 1} / ${state.filteredPoints.length}`;
    el.pointName.textContent = point.name;
    el.mnemonicVerse.textContent = `"${point.mnemonic}"`;
    el.pointTipText.textContent = point.memory_trick;

    el.detailLocation.textContent = point.location;
    el.detailIndication.textContent = point.indication;
    
    if (point.special_note) {
      el.detailSpecial.style.display = 'block';
      el.detailSpecial.textContent = '⚡ Lưu ý: ' + point.special_note;
    } else {
      el.detailSpecial.style.display = 'none';
    }
  }

  function nextCard(direction = 1) {
    sound.tap();
    state.currentIndex = (state.currentIndex + direction + state.filteredPoints.length) % state.filteredPoints.length;
    renderFlashcard();
  }

  // --- 2. SPEED QUIZ ENGINE ---
  function startQuiz() {
    state.quiz.lives = 3;
    state.quiz.score = 0;
    state.quiz.streak = 0;
    state.quiz.isActive = true;
    updateHearts();
    nextQuizQuestion();
  }

  function updateHearts() {
    el.hearts.forEach((heart, i) => {
      if (i < state.quiz.lives) {
        heart.classList.remove('lost');
      } else {
        heart.classList.add('lost');
      }
    });
  }

  function nextQuizQuestion() {
    if (state.quiz.lives <= 0) {
      endQuiz();
      return;
    }

    clearInterval(state.quiz.timer);
    state.quiz.timeLeft = 12;
    updateTimerBar();

    // Generate Question Types:
    // 0: Thơ vè -> Tên huyệt
    // 1: Bệnh lý -> Tên huyệt
    // 2: Vị trí -> Tên huyệt
    // 3: Cảnh báo / Lưu ý vàng -> Tên huyệt
    const qTypes = [0, 1, 2, 3];
    const qType = qTypes[Math.floor(Math.random() * qTypes.length)];
    
    const correctPoint = state.allPoints[Math.floor(Math.random() * state.allPoints.length)];
    
    // Pick 3 distractors
    const distractors = state.allPoints
      .filter(p => p.id !== correctPoint.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);
    
    const options = [correctPoint, ...distractors].sort(() => 0.5 - Math.random());
    
    let qText = '';
    let badgeText = '';

    if (qType === 0) {
      badgeText = 'Thơ Vè Nhớ Nhanh';
      qText = `Câu vè: "${correctPoint.mnemonic}" nhắc đến huyệt đạo nào?`;
    } else if (qType === 1) {
      badgeText = 'Chỉ Định Điều Trị';
      const mainInd = correctPoint.indication.split(',')[0].trim();
      qText = `Bệnh nhân cần điều trị chứng "${mainInd}", nên chọn huyệt nào sau đây?`;
    } else if (qType === 2) {
      badgeText = 'Giải Phẫu Vị Trí';
      qText = `Vị trí: "${correctPoint.location}" là cách xác định của huyệt nào?`;
    } else {
      badgeText = 'Tuyệt Kỹ & Cảnh Báo';
      if (correctPoint.special_note) {
        qText = `Huyệt nào có đặc điểm: "${correctPoint.special_note}"?`;
      } else {
        badgeText = 'Khắc Sâu Trí Nhớ';
        qText = `Mẹo nhớ: "${correctPoint.memory_trick}" tương ứng với huyệt nào?`;
      }
    }

    el.quizTypeBadge.textContent = badgeText;
    el.quizQuestion.textContent = qText;
    el.comboBadge.textContent = state.quiz.streak > 1 ? `🔥 Combo x${state.quiz.streak}` : '';

    el.quizOptions.innerHTML = '';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'opt-btn';
      btn.textContent = opt.name;
      btn.addEventListener('click', () => handleQuizAnswer(opt.id === correctPoint.id, btn, correctPoint.name));
      el.quizOptions.appendChild(btn);
    });

    // Start countdown
    state.quiz.timer = setInterval(() => {
      state.quiz.timeLeft -= 0.1;
      updateTimerBar();
      if (state.quiz.timeLeft <= 0) {
        clearInterval(state.quiz.timer);
        handleQuizAnswer(false, null, correctPoint.name);
      }
    }, 100);
  }

  function updateTimerBar() {
    const pct = Math.max(0, (state.quiz.timeLeft / 12) * 100);
    el.timerFill.style.width = pct + '%';
    if (pct < 25) {
      el.timerFill.className = 'timer-bar-fill danger';
    } else if (pct < 50) {
      el.timerFill.className = 'timer-bar-fill warning';
    } else {
      el.timerFill.className = 'timer-bar-fill';
    }
  }

  function handleQuizAnswer(isCorrect, btnClicked, correctName) {
    clearInterval(state.quiz.timer);
    
    // Disable all options
    const allBtns = el.quizOptions.querySelectorAll('.opt-btn');
    allBtns.forEach(b => {
      b.disabled = true;
      if (b.textContent === correctName) {
        b.classList.add('correct');
      }
    });

    if (isCorrect) {
      sound.correct();
      state.quiz.streak++;
      const bonus = state.quiz.streak * 5;
      state.quiz.score += 10 + bonus;
      state.stats.score += 10 + bonus;
      localStorage.setItem('acu_stats', JSON.stringify(state.stats));
      renderStats();
    } else {
      sound.wrong();
      if (btnClicked) btnClicked.classList.add('wrong');
      state.quiz.streak = 0;
      state.quiz.lives--;
      updateHearts();
    }

    setTimeout(() => {
      nextQuizQuestion();
    }, 1100);
  }

  function endQuiz() {
    sound.wrong();
    el.quizQuestion.textContent = `Trận đấu kết thúc! Bạn ghi được ${state.quiz.score} điểm.`;
    el.quizTypeBadge.textContent = 'Hoàn Thành';
    el.quizOptions.innerHTML = `
      <button class="primary-btn" id="btn-restart-quiz">Chơi Lại Trận Mới ⚡</button>
    `;
    document.getElementById('btn-restart-quiz').addEventListener('click', () => {
      sound.tap();
      startQuiz();
    });
  }

  // --- 3. CA LÂM SÀNG LOGIC ---
  function renderCase() {
    const currentCase = state.cases[state.caseState.currentIndex];
    if (!currentCase) return;

    el.caseNum.textContent = `Ca ${state.caseState.currentIndex + 1} / ${state.cases.length}`;
    el.caseTitle.textContent = currentCase.title;
    el.casePatient.innerHTML = `
      <strong>Bệnh án:</strong> ${currentCase.patient}<br>
      <span style="color:var(--emerald-light);font-size:12px;margin-top:4px;display:block;">Chẩn đoán: ${currentCase.diagnosis}</span>
    `;

    // Reset selection & feedback
    state.caseState.selectedPoints = [];
    el.caseFeedback.style.display = 'none';
    el.btnCheckCase.textContent = 'Kê Huyệt Điều Trị 🩺';
    el.btnCheckCase.style.display = 'block';

    // Build choice pool (target points + some distractors)
    const targets = state.allPoints.filter(p => currentCase.target_points.includes(p.id));
    const otherPoints = state.allPoints.filter(p => !currentCase.target_points.includes(p.id))
      .sort(() => 0.5 - Math.random())
      .slice(0, 6 - targets.length);
    
    const pool = [...targets, ...otherPoints].sort(() => 0.5 - Math.random());

    el.caseGrid.innerHTML = '';
    pool.forEach(p => {
      const chip = document.createElement('div');
      chip.className = 'case-point-chip';
      chip.textContent = p.name;
      chip.dataset.id = p.id;
      chip.addEventListener('click', () => {
        sound.tap();
        if (chip.classList.contains('selected')) {
          chip.classList.remove('selected');
          state.caseState.selectedPoints = state.caseState.selectedPoints.filter(id => id !== p.id);
        } else {
          if (state.caseState.selectedPoints.length < 3) {
            chip.classList.add('selected');
            state.caseState.selectedPoints.push(p.id);
          }
        }
      });
      el.caseGrid.appendChild(chip);
    });
  }

  function checkCase() {
    if (state.caseState.selectedPoints.length === 0) {
      alert('Vui lòng chọn ít nhất 1-2 huyệt bạn cho là phù hợp!');
      return;
    }

    const currentCase = state.cases[state.caseState.currentIndex];
    const matchCount = state.caseState.selectedPoints.filter(id => currentCase.target_points.includes(id)).length;
    
    if (matchCount >= 1) {
      sound.correct();
      el.caseFeedback.innerHTML = `
        <strong>Chính xác! Phác đồ đắc dụng:</strong><br>
        ${currentCase.explanation}
      `;
      saveMastery(currentCase.target_points[0], 1);
    } else {
      sound.wrong();
      el.caseFeedback.innerHTML = `
        <span style="color:var(--rose)">Chưa tối ưu!</span><br>
        ${currentCase.explanation}
      `;
    }

    el.caseFeedback.style.display = 'block';
    el.btnCheckCase.textContent = 'Ca Tiếp Theo ➔';
    el.btnCheckCase.onclick = () => {
      state.caseState.currentIndex = (state.caseState.currentIndex + 1) % state.cases.length;
      renderCase();
      el.btnCheckCase.onclick = checkCase;
    };
  }

  // --- 4. MAP SVG & TÌM HUYỆT ---
  function initMapDots() {
    renderMapDots(el.bodySvgFront, 'front');
    renderMapDots(el.bodySvgBack, 'back');
  }

  function renderMapDots(svgEl, viewType) {
    if (!svgEl) return;
    
    // Filter points belonging to this view
    const backRegions = ['back'];
    const pts = state.allPoints.filter(p => {
      if (viewType === 'back') {
        return backRegions.includes(p.region_id) || ['h_8', 'h_11', 'h_37', 'h_49', 'h_53', 'h_56', 'h_60'].includes(p.id);
      } else {
        return !backRegions.includes(p.region_id) && !['h_8', 'h_11', 'h_37', 'h_49', 'h_53', 'h_56', 'h_60'].includes(p.id);
      }
    });

    pts.forEach(p => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'acupoint-dot');
      g.dataset.id = p.id;
      
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', p.coords.x * 2.4 + 30); // Scale to SVG viewBox 300x520
      circle.setAttribute('cy', p.coords.y * 5);
      circle.setAttribute('r', '6');

      g.appendChild(circle);
      
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        sound.tap();
        showMapPreview(p);
      });

      svgEl.appendChild(g);
    });
  }

  function showMapPreview(p) {
    el.mapPreview.style.display = 'block';
    el.previewName.innerHTML = `<span>${p.name}</span> <span style="font-size:12px;color:var(--emerald-light)">${p.region_name}</span>`;
    el.previewDesc.innerHTML = `<strong>Vị trí:</strong> ${p.location}<br><strong>Tác dụng:</strong> ${p.indication}`;
  }

  // --- 5. ATLAS & SEARCH ---
  function renderAtlasList(query = '') {
    el.pointsList.innerHTML = '';
    const q = query.trim().toLowerCase();
    
    const filtered = state.allPoints.filter(p => {
      if (!q) return true;
      return p.name.toLowerCase().includes(q) ||
             p.indication.toLowerCase().includes(q) ||
             p.location.toLowerCase().includes(q) ||
             p.mnemonic.toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
      el.pointsList.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-dim);font-size:13px;">Không tìm thấy huyệt nào phù hợp.</div>`;
      return;
    }

    filtered.forEach(p => {
      const item = document.createElement('div');
      item.className = 'point-list-item';
      item.innerHTML = `
        <div class="item-head">
          <span class="item-name">${p.name}</span>
          <span class="region-tag">${p.region_name}</span>
        </div>
        <div class="item-loc">${p.location}</div>
        <div class="item-ind">🎯 ${p.indication}</div>
      `;
      item.addEventListener('click', () => {
        sound.tap();
        openPointDetailModal(p);
      });
      el.pointsList.appendChild(item);
    });
  }

  function openPointDetailModal(p) {
    el.modalContent.innerHTML = `
      <div class="modal-close-bar"><div class="modal-drag-handle"></div></div>
      <div class="card-top-bar" style="margin-bottom:12px;">
        <span class="region-tag">${p.region_name}</span>
      </div>
      <h2 style="font-size:26px;color:#fff;margin-bottom:8px;">${p.name}</h2>
      <div class="point-mnemonic-verse">"${p.mnemonic}"</div>
      
      <div class="detail-block">
        <div class="detail-label">Vị Trí & Cách Lấy Huyệt</div>
        <div class="detail-value">${p.location}</div>
      </div>
      <div class="detail-block">
        <div class="detail-label">Tác Dụng & Chủ Trị</div>
        <div class="detail-value">${p.indication}</div>
      </div>
      <div class="detail-block">
        <div class="detail-label">Mẹo Khắc Sâu Trí Nhớ</div>
        <div class="detail-value" style="color:#fde68a;">${p.memory_trick}</div>
      </div>
      ${p.special_note ? `
        <div class="alert-box">
          ⚠️ <strong>Lưu ý đặc biệt:</strong> ${p.special_note}
        </div>
      ` : ''}
    `;
    el.modalOverlay.style.display = 'flex';
  }

  // --- BIND ALL EVENTS ---
  function bindEvents() {
    // Navigation Tabs
    el.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        sound.tap();
        const targetView = tab.dataset.view;
        el.tabs.forEach(t => t.classList.remove('active'));
        el.sections.forEach(s => s.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`view-${targetView}`).classList.add('active');
        state.activeTab = targetView;

        if (targetView === 'quiz' && !state.quiz.isActive) {
          startQuiz();
        } else if (targetView === 'cases') {
          renderCase();
        }
      });
    });

    // Flashcard Region Filter
    el.filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        sound.tap();
        el.filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.filterRegion = chip.dataset.region;
        updateFilteredPoints();
        renderFlashcard();
      });
    });

    // Card Flip
    el.cardWrapper.addEventListener('click', (e) => {
      if (e.target.closest('.action-btn')) return;
      sound.flip();
      state.isCardFlipped = !state.isCardFlipped;
      el.cardWrapper.classList.toggle('flipped', state.isCardFlipped);
    });

    // Leitner buttons
    el.btnForgot.addEventListener('click', (e) => {
      e.stopPropagation();
      const pt = state.filteredPoints[state.currentIndex];
      saveMastery(pt.id, -1);
      nextCard(1);
    });
    el.btnHesitant.addEventListener('click', (e) => {
      e.stopPropagation();
      nextCard(1);
    });
    el.btnMastered.addEventListener('click', (e) => {
      e.stopPropagation();
      sound.correct();
      const pt = state.filteredPoints[state.currentIndex];
      saveMastery(pt.id, 1);
      nextCard(1);
    });

    // Case Submit
    el.btnCheckCase.addEventListener('click', checkCase);

    // Map View Switcher
    el.switchFront.addEventListener('click', () => {
      sound.tap();
      el.switchFront.classList.add('active');
      el.switchBack.classList.remove('active');
      el.bodySvgFront.style.display = 'block';
      el.bodySvgBack.style.display = 'none';
    });

    el.switchBack.addEventListener('click', () => {
      sound.tap();
      el.switchBack.classList.add('active');
      el.switchFront.classList.remove('active');
      el.bodySvgFront.style.display = 'none';
      el.bodySvgBack.style.display = 'block';
    });

    // Search Input
    el.searchInput.addEventListener('input', (e) => {
      renderAtlasList(e.target.value);
    });

    // Modal Close
    el.modalOverlay.addEventListener('click', (e) => {
      if (e.target === el.modalOverlay) {
        el.modalOverlay.style.display = 'none';
      }
    });

    // Touch swipe gestures on flashcard
    let touchStartX = 0;
    el.cardWrapper.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    el.cardWrapper.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].screenX;
      if (touchEndX - touchStartX > 50) {
        // Swipe Right -> Prev
        nextCard(-1);
      } else if (touchStartX - touchEndX > 50) {
        // Swipe Left -> Next
        nextCard(1);
      }
    }, { passive: true });
  }

  // Start when DOM is ready
  document.addEventListener('DOMContentLoaded', init);

})();
