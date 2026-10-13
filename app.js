// ==========================================================================
// CHÂM CỨU THẦN TRÍ (ACU-ZEN 3D) - TOÀN DIỆN 60 HUYỆT ĐẠO Y HỌC CỔ TRUYỀN
// Full Interactive Logic, Audio Synthesis, 3D Engine, Games & Flashcards
// ==========================================================================
/* globals Acu3D */

(function () {
  'use strict';

  // --- AUDIO SYNTHESIZER (Web Audio API - Offline, Zero Latency) ---
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
  }

  const sound = new SoundEngine();

  // --- APPLICATION STATE ---
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
      isActive: false
    },

    // Case State
    caseState: {
      currentIndex: 0,
      selectedPoints: []
    },

    // 3D Game State
    game3D: {
      isActive: false,
      targetPoint: null,
      score: 0
    },

    // Current selected point in 3D
    selectedPoint3D: null,

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

    // Cases
    el.caseNum = document.getElementById('case-num');
    el.caseTitle = document.getElementById('case-title');
    el.casePatient = document.getElementById('case-patient');
    el.caseGrid = document.getElementById('case-grid');
    el.caseFeedback = document.getElementById('case-feedback');
    el.btnCheckCase = document.getElementById('btn-check-case');

    // 3D Model Elements
    el.canvas3dWrap = document.getElementById('canvas3d-wrap');
    el.canvas3dContainer = document.getElementById('canvas3d-container');
    el.camPresets = document.querySelectorAll('.cam-preset-chip');
    el.btnToggleCore = document.getElementById('btn-toggle-core');
    el.btnToggleMeridians = document.getElementById('btn-toggle-meridians');
    el.btnGame3D = document.getElementById('btn-game-3d');
    el.btnAutorotate3D = document.getElementById('btn-autorotate-3d');
    el.btnFullscreen3D = document.getElementById('btn-fullscreen-3d');
    el.gameBanner3D = document.getElementById('game-banner-3d');
    el.game3DTarget = document.getElementById('game-3d-target');
    el.game3DScore = document.getElementById('game-3d-score');
    
    // 3D Popover
    el.popover3D = document.getElementById('popover-3d-card');
    el.popoverName = document.getElementById('popover-name');
    el.popoverWho = document.getElementById('popover-who');
    el.popoverRegion = document.getElementById('popover-region');
    el.popoverVerse = document.getElementById('popover-verse');
    el.popoverLoc = document.getElementById('popover-loc');
    el.popoverInd = document.getElementById('popover-ind');
    el.btnPopoverDetail = document.getElementById('btn-popover-detail');
    el.btnPopoverClose = document.getElementById('btn-popover-close');

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

    // Init 3D Viewport
    if (window.Acu3D && el.canvas3dContainer) {
      window.Acu3D.init(el.canvas3dContainer, on3DPointSelected);
    }
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
    
    state.isCardFlipped = false;
    el.cardWrapper.classList.remove('flipped');

    el.cardRegion.textContent = point.region_name;
    el.cardIndex.textContent = `${state.currentIndex + 1} / ${state.filteredPoints.length}`;
    el.pointName.textContent = point.name + (point.who_code ? ` [${point.who_code}]` : '');
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

    const qTypes = [0, 1, 2, 3];
    const qType = qTypes[Math.floor(Math.random() * qTypes.length)];
    const correctPoint = state.allPoints[Math.floor(Math.random() * state.allPoints.length)];
    
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
      btn.textContent = opt.name + (opt.who_code ? ` (${opt.who_code})` : '');
      btn.addEventListener('click', () => handleQuizAnswer(opt.id === correctPoint.id, btn, opt.name));
      el.quizOptions.appendChild(btn);
    });

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

  function handleQuizAnswer(isCorrect, btnClicked, clickedName) {
    clearInterval(state.quiz.timer);
    
    const allBtns = el.quizOptions.querySelectorAll('.opt-btn');
    allBtns.forEach(b => {
      b.disabled = true;
    });

    if (isCorrect) {
      sound.correct();
      if (btnClicked) btnClicked.classList.add('correct');
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

    state.caseState.selectedPoints = [];
    el.caseFeedback.style.display = 'none';
    el.btnCheckCase.textContent = 'Kê Huyệt Điều Trị 🩺';
    el.btnCheckCase.style.display = 'block';

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

  // --- 4. 3D VIEWER INTERACTIONS ---
  function on3DPointSelected(pointData, whoCode) {
    if (!pointData) {
      // Named point from other meridians
      pointData = {
        name: whoCode,
        who_code: whoCode,
        region_name: "Kinh Lạc",
        mnemonic: "Huyệt đạo bổ trợ trên hệ thống kinh lạc",
        location: "Xem vị trí trên mô hình 3D",
        indication: "Tra cứu theo mã WHO " + whoCode
      };
    }

    sound.correct();
    state.selectedPoint3D = pointData;

    // Show Popover Card
    el.popoverName.textContent = pointData.name;
    el.popoverWho.textContent = pointData.who_code ? `[${pointData.who_code}]` : "";
    el.popoverRegion.textContent = pointData.region_name || "Đông Y";
    el.popoverVerse.textContent = `"${pointData.mnemonic || 'Thơ vè nhớ huyệt'}"`;
    el.popoverLoc.innerHTML = `<strong>Vị trí:</strong> ${pointData.location || 'Chưa cập nhật'}`;
    el.popoverInd.innerHTML = `<strong>Tác dụng:</strong> ${pointData.indication || 'Chưa cập nhật'}`;

    el.popover3D.style.display = "block";
  }

  function start3DGame() {
    state.game3D.isActive = true;
    state.game3D.score = 0;
    el.btnGame3D.classList.add("active");
    el.gameBanner3D.style.display = "block";
    el.popover3D.style.display = "none";
    next3DGameQuestion();
  }

  function stop3DGame() {
    state.game3D.isActive = false;
    el.btnGame3D.classList.remove("active");
    el.gameBanner3D.style.display = "none";
    if (window.Acu3D) window.Acu3D.stopFindPointGame();
  }

  function next3DGameQuestion() {
    // Pick random target from 60 points
    const target = state.allPoints[Math.floor(Math.random() * state.allPoints.length)];
    state.game3D.targetPoint = target;

    el.game3DTarget.textContent = `${target.name} [${target.who_code || ''}]`;
    el.game3DScore.textContent = `${state.game3D.score} XP`;

    if (window.Acu3D) {
      window.Acu3D.startFindPointGame(target, function (isCorrect, clickedData) {
        if (isCorrect) {
          sound.correct();
          state.game3D.score += 25;
          state.stats.score += 25;
          localStorage.setItem('acu_stats', JSON.stringify(state.stats));
          renderStats();
          el.game3DTarget.innerHTML = `<span style="color:var(--emerald-light)">✓ Chính xác! +25 XP</span>`;
          setTimeout(next3DGameQuestion, 1200);
        } else {
          sound.wrong();
          const hint = target.region_name ? `(Gợi ý: Thuộc vùng ${target.region_name})` : "";
          el.game3DTarget.innerHTML = `<span style="color:var(--rose)">Chưa đúng! ${hint}</span>`;
          setTimeout(() => {
            el.game3DTarget.textContent = `${target.name} [${target.who_code || ''}]`;
          }, 1400);
        }
      });
    }
  }

  // --- 5. ATLAS & SEARCH ---
  function renderAtlasList(query = '') {
    el.pointsList.innerHTML = '';
    const q = query.trim().toLowerCase();
    
    const filtered = state.allPoints.filter(p => {
      if (!q) return true;
      return p.name.toLowerCase().includes(q) ||
             (p.who_code && p.who_code.toLowerCase().includes(q)) ||
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
          <span class="item-name">${p.name} <small style="font-size:12px;color:var(--emerald-light);">[${p.who_code || ''}]</small></span>
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
        <span class="region-tag" style="color:var(--emerald-light);border-color:var(--emerald);">${p.who_code || ''}</span>
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

      <button id="btn-jump-3d" class="primary-btn" style="margin-top:16px;">
        Xem Vị Trí Trên Người Mẫu 3D 🌐
      </button>
    `;

    document.getElementById('btn-jump-3d').addEventListener('click', () => {
      sound.tap();
      el.modalOverlay.style.display = 'none';
      // Switch to 3D Map Tab
      const mapTab = Array.from(el.tabs).find(t => t.dataset.view === 'map');
      if (mapTab) mapTab.click();
      setTimeout(() => {
        if (window.Acu3D && p.who_code) {
          window.Acu3D.selectPoint(p.who_code);
          on3DPointSelected(p, p.who_code);
        }
      }, 350);
    });

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
        } else if (targetView === 'map') {
          setTimeout(() => {
            if (window.Acu3D) window.Acu3D.resize();
          }, 100);
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

    // 3D Camera Presets
    el.camPresets.forEach(chip => {
      chip.addEventListener('click', () => {
        sound.tap();
        el.camPresets.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const presetKey = chip.dataset.preset;
        if (window.Acu3D) window.Acu3D.focusRegion(presetKey);
      });
    });

    // 3D Secondary Tools
    el.btnToggleCore.addEventListener('click', () => {
      sound.tap();
      const only = window.Acu3D.toggleCoreOnly();
      el.btnToggleCore.classList.toggle('active', only);
    });

    el.btnToggleMeridians.addEventListener('click', () => {
      sound.tap();
      const show = window.Acu3D.toggleMeridians();
      el.btnToggleMeridians.classList.toggle('active', show);
    });

    el.btnAutorotate3D.addEventListener('click', () => {
      sound.tap();
      const rot = window.Acu3D.toggleAutoRotate();
      el.btnAutorotate3D.classList.toggle('active', rot);
    });

    el.btnFullscreen3D.addEventListener('click', () => {
      sound.tap();
      el.canvas3dWrap.classList.toggle('fullscreen');
      setTimeout(() => {
        if (window.Acu3D) window.Acu3D.resize();
      }, 150);
    });

    el.btnGame3D.addEventListener('click', () => {
      sound.tap();
      if (state.game3D.isActive) {
        stop3DGame();
      } else {
        start3DGame();
      }
    });

    // 3D Popover buttons
    el.btnPopoverClose.addEventListener('click', () => {
      sound.tap();
      el.popover3D.style.display = 'none';
    });

    el.btnPopoverDetail.addEventListener('click', () => {
      sound.tap();
      if (state.selectedPoint3D) {
        openPointDetailModal(state.selectedPoint3D);
      }
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
        nextCard(-1);
      } else if (touchStartX - touchEndX > 50) {
        nextCard(1);
      }
    }, { passive: true });
  }

  document.addEventListener('DOMContentLoaded', init);

})();
