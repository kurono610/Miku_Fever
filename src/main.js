import './style.css'
import { Player } from "textalive-app-api";

// ========================================================
// 🎛️ 自動調整（レスポンシブ）設定エリア
// ========================================================
const WAVE_BOX_PROP = {
  heightRatio: 0.56,
  aspectRatio: 1.7778,
  yRatio: 0.05,
  xRatio: 0.5,

  backgroundColor: "rgba(0, 15, 30, 0.6)",
  borderColorNormal: "#00f2fe",
  borderColorChorus: "#2c42ec",
  borderWidthRatio: 0.005,
  borderRadiusRatio: 0.005
};

let waveBox = { x: 0, y: 0, width: 0, height: 0, borderWidth: 0, borderRadius: 0 };
function initApp() {
  document.querySelector('#app').innerHTML = `
  <div id="start-screen" class="screen">
    <h1 class="title">MikuFever</h1>
    <div class="difficulty-menu" style="display: flex; flex-direction: column; gap: 15px;">
      <button id="startEasyBtn" style="padding: 12px 24px; font-size: 1.2rem; cursor: pointer;">スタート</button>
    </div>
  </div>

  <div id="game-screen" class="screen">
    <div id="stage-bg"></div>
    <canvas id="live-effect-canvas" style="position: absolute; inset: 0; pointer-events: none; z-index: 400;"></canvas>

    <div id="rule-overlay">
      <h2>ルール説明</h2>
      <p>音楽に合わせてノーツをクリックしてミクを応援しよう！</p>
      <button id="startSongBtn" style="padding: 15px 30px; font-size: 1.5rem; cursor: pointer;">曲を始める</button>
    </div>
    
    <div id="live-effects-layer">
      <div class="spotlight spotlight-left"></div>
      <div class="spotlight spotlight-right"></div>
      <div class="penlight-container"></div>
      <div class="laser laser-1"></div>
      <div class="laser laser-2"></div>
    </div>

    <div id="stage-bg2"></div>
    <div id="object-2"></div>
    <div id="kubi-char"></div>
    <div id="object-1">
      <div class="dj-equalizer">
        <div class="bar"></div>
        <div class="bar"></div>
        <div class="bar"></div>
        <div class="bar"></div>
        <div class="bar"></div>
      </div>
    </div>
    <div id="stage-bg3"></div>

    <div id="lyrics">Loading...</div>
    <div id="note-layer"></div>
    <div id="score-display">SCORE: 0</div>
    <div id="combo-display">COMBO 0</div>

    <div id="gauge-container">
      <div id="gauge-wrapper">
        <div id="gauge-bar"></div>
        <div id="gauge-norma-line"></div>
        <span id="gauge-text-status">NORMAL</span>
      </div>
      <div id="gauge-soul-icon"></div>
    </div>

    <div id="judge-text"></div>

    <div id="screen-area" style="overflow: hidden; pointer-events: none;">
      <video id="screen-video" autoplay muted loop></video>
    </div>
  </div>

  <div id="pause-menu" class="hidden">
    <h2>MENU</h2>
    <button id="resumeBtn">Resume</button>
    <button id="restartBtn">Restart</button>
    <button id="skipBtn">Skip</button>
    <button id="menuBackToTitleBtn">TITLE</button>
  </div>

  <div id="result-screen" class="screen">
    <h1>RESULT</h1>
    <p id="score">SCORE : 0</p>
    <button id="retryBtn">RETRY</button>
    <button id="backToTitleBtn">TITLE</button>
  </div>

  <div id="loading-screen" class="screen active">
    <div class="spinner"></div>
    <div class="loading-text">LOADING...</div>
  </div>
  `;
  document.querySelector("#startEasyBtn").addEventListener("click", () => {
    changeScreen("game-screen");
    player.requestPlay();
  });
}

initApp();
// --- DOM要素の取得 ---
const startScreen = document.querySelector("#start-screen");
const gameScreen = document.querySelector("#game-screen");
const resultScreen = document.querySelector("#result-screen");
const loadingScreen = document.querySelector("#loading-screen");
const noteLayer = document.querySelector("#note-layer");
const pauseMenu = document.querySelector("#pause-menu");

const startEasyBtn = document.querySelector("#startEasyBtn");
const retryBtn = document.querySelector("#retryBtn");
const backToTitleBtn = document.querySelector("#backToTitleBtn");
const menuBackToTitleBtn = document.querySelector("#menuBackToTitleBtn");
const resumeBtn = document.querySelector("#resumeBtn");
const restartBtn = document.querySelector("#restartBtn");
const skipBtn = document.querySelector("#skipBtn");

const ruleOverlay = document.querySelector("#rule-overlay");
const startSongBtn = document.querySelector("#startSongBtn");

// 状態管理変数
let score = 0;
let combo = 0;
let gauge = 0;
let noteOrder = 1000;
let currentPhrase = null;
let isPaused = false;
let chorusMode = false;
let lastBeatCount = -1;

const CHAR_FACES = {
  normal: new URL('./images/normal.png', import.meta.url).href,
  chorus: new URL('./images/chorus.png', import.meta.url).href,
  happy: new URL('./images/happy.png', import.meta.url).href,
  sad: new URL('./images/sad.png', import.meta.url).href
};
let faceTimer = null;
let isTemporaryFace = false;

const DIFFICULTY_SETTINGS = {
  easy: { normal: 4, chorus: 2 },
  normal: { normal: 2, chorus: 2 }
};
let currentDifficulty = "easy";

const APPROACH_DURATION = 1100;
const PERFECT_WINDOW = 80;
const GREAT_WINDOW = 120;
const GOOD_WINDOW = 150;

// 📐 レイアウト更新関数
function updateLayout() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  const canvas = document.querySelector("#live-effect-canvas");
  if (canvas) {
    canvas.width = w;
    canvas.height = h;
  }

  waveBox.height = h * WAVE_BOX_PROP.heightRatio;
  waveBox.width = waveBox.height * WAVE_BOX_PROP.aspectRatio;
  waveBox.x = (w - waveBox.width) / 2;
  waveBox.y = h * WAVE_BOX_PROP.yRatio;

  waveBox.borderWidth = h * WAVE_BOX_PROP.borderWidthRatio;
  waveBox.borderRadius = h * WAVE_BOX_PROP.borderRadiusRatio;

  const screenArea = document.querySelector("#screen-area");
  if (screenArea) {
    screenArea.style.position = "absolute";
    screenArea.style.left = `${waveBox.x}px`;
    screenArea.style.top = `${waveBox.y}px`;
    screenArea.style.width = `${waveBox.width}px`;
    screenArea.style.height = `${waveBox.height}px`;
    screenArea.style.zIndex = "500";
  }
}
window.addEventListener("resize", updateLayout);

// 🎵 TextAlive Player 初期化
const player = new Player({
  app: { token: "KlwQ6tP7XMt0ooKO" }
});

// ポーズ切り替えキー
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!gameScreen.classList.contains("active")) return;

  isPaused = !isPaused;
  pauseMenu.classList.toggle("hidden");

  if (isPaused) {
    player.requestPause();
  } else {
    player.requestPlay();
  }
});

function updateGauge(amount) {
  gauge = Math.max(0, Math.min(100, gauge + amount));
  const gaugeBar = document.querySelector("#gauge-bar");
  const statusText = document.querySelector("#gauge-text-status");

  if (gaugeBar) gaugeBar.style.width = `${gauge}%`;

  gameScreen.classList.remove("soul-max", "norma-clear");

  if (gauge >= 100) {
    gameScreen.classList.add("soul-max");
    if (statusText) statusText.textContent = "SOUL MAX!!";
  } else if (gauge >= 70) {
    gameScreen.classList.add("norma-clear");
    if (statusText) statusText.textContent = "CLEAR!";
  } else {
    if (statusText) statusText.textContent = "NORMAL";
  }
  updateLiveEffects();
}

function updateLiveEffects() {
  const effectsLayer = document.querySelector('#live-effects-layer');
  if (!effectsLayer) return;

  if (chorusMode) {
    effectsLayer.classList.add('is-chorus');
    changeCharacterFace("chorus");
  } else {
    effectsLayer.classList.remove('is-chorus');
    changeCharacterFace("normal");
  }

  effectsLayer.classList.remove('speed-low', 'speed-mid', 'speed-fast');

  if (gauge >= 80) {
    effectsLayer.classList.add('speed-fast');
  } else if (gauge >= 40) {
    effectsLayer.classList.add('speed-mid');
  } else {
    effectsLayer.classList.add('speed-low');
  }
}

function initPenlights() {
  const container = document.querySelector('.penlight-container');
  if (!container) return;

  container.innerHTML = "";
  const count = 40;
  for (let i = 0; i < count; i++) {
    const penlight = document.createElement('div');
    penlight.classList.add('penlight');
    penlight.style.animationDelay = `${Math.random() * -2}s`;
    penlight.style.height = `${45 + Math.random() * 30}px`;
    penlight.style.opacity = `${0.6 + Math.random() * 0.4}`;
    container.appendChild(penlight);
  }
}
initPenlights();

function createNote() {
  const note = document.createElement("div");
  note.classList.add("note");

  const noteImg = document.createElement("img");

  noteImg.style.width = "90%";
  noteImg.style.height = "90%";
  noteImg.style.objectFit = "contain";
  noteImg.style.position = "absolute";
  noteImg.style.left = "50%";
  noteImg.style.top = "50%";
  noteImg.style.transform = "translate(-50%, -50%)";
  noteImg.style.pointerEvents = "none";
  note.appendChild(noteImg);

  const approach = document.createElement("div");
  approach.classList.add("approach");
  approach.style.animationDuration = `${APPROACH_DURATION}ms`;

  const padding = 50;
  const minX = padding;
  const maxX = window.innerWidth - padding;
  const minY = window.innerHeight * 0.45;
  const maxY = window.innerHeight - 150;

  const x = minX + Math.random() * (maxX - minX);
  const y = minY + Math.random() * (maxY - minY);

  note.style.left = x + "px";
  note.style.top = y + "px";
  approach.style.left = x + "px";
  approach.style.top = y + "px";

  note.style.zIndex = noteOrder;
  approach.style.zIndex = noteOrder - 1;
  noteOrder--;

  noteLayer.appendChild(approach);
  noteLayer.appendChild(note);

  const spawnTime = performance.now();

  note.addEventListener("click", () => {
    if (isPaused) return;
    const elapsed = performance.now() - spawnTime;
    judgeByProgress(elapsed);
    note.remove();
    approach.remove();
  });

  setTimeout(() => {
    if (note.parentNode) {
      judgeMiss();
      note.remove();
      approach.remove();
    }
  }, APPROACH_DURATION + GOOD_WINDOW);
}

function judgeByProgress(elapsed) {
  const diff = Math.abs(elapsed - APPROACH_DURATION);

  if (diff <= PERFECT_WINDOW) {
    showJudge("PERFECT");
    changeCharacterFace("happy", 400);
    addScore(300);
    combo++;
    updateGauge(2);
  } else if (diff <= GREAT_WINDOW) {
    showJudge("GREAT");
    addScore(200);
    changeCharacterFace("happy", 400);
    combo++;
    updateGauge(1);
  } else if (diff <= GOOD_WINDOW) {
    showJudge("GOOD");
    addScore(100);
    combo++;
    updateGauge(0);
  } else {
    showJudge("MISS");
    changeCharacterFace("sad", 400);
    combo = 0;
    updateGauge(-3);
  }
  updateCombo();
}

function judgeMiss() {
  combo = 0;
  updateCombo();
  showJudge("MISS");
  changeCharacterFace("sad", 400);
  updateGauge(-4);
}

function showJudge(text) {
  const judgeText = document.querySelector("#judge-text");
  if (!judgeText) return;
  judgeText.textContent = text;
  judgeText.classList.remove("judge-show");
  void judgeText.offsetWidth;
  judgeText.classList.add("judge-show");
}

function addScore(point) {
  score += point;
  const scoreDisplay = document.querySelector("#score-display");
  if (scoreDisplay) scoreDisplay.textContent = `SCORE: ${score}`;
}

function updateCombo() {
  const comboDisplay = document.querySelector("#combo-display");
  if (comboDisplay) comboDisplay.textContent = `COMBO ${combo}`;
}

function changeScreen(targetScreen, useLoading = false, setupCallback = null) {
  const allScreens = document.querySelectorAll(".screen");

  if (useLoading) {
    loadingScreen.classList.add("active");
    allScreens.forEach(s => {
      if (s !== loadingScreen) s.classList.remove("active", "norma-clear", "soul-max");
    });
    targetScreen.classList.add("active");

    if (setupCallback) setupCallback();

    setTimeout(() => {
      loadingScreen.classList.remove("active");
    }, 800);
  } else {
    allScreens.forEach(s => s.classList.remove("active", "norma-clear", "soul-max"));
    targetScreen.classList.add("active");
    if (setupCallback) setupCallback();
  }
}

function resetGame() {
  score = 0;
  combo = 0;
  gauge = 0;
  updateCombo();
  updateGauge(0);

  currentPhrase = null;
  const lyricsEl = document.querySelector("#lyrics");
  if (lyricsEl) {
    lyricsEl.innerHTML = "";
    lyricsEl.classList.remove("has-bubble");
  }

  const judgeText = document.querySelector("#judge-text");
  if (judgeText) {
    judgeText.textContent = "";
    judgeText.classList.remove("judge-show");
  }

  const scoreDisplay = document.querySelector("#score-display");
  if (scoreDisplay) scoreDisplay.textContent = "SCORE: 0";
  document.querySelectorAll(".note, .approach, .smoke-particle").forEach(el => el.remove());
}

function playNormalAnimation(kubiChar, beatCount) {
  kubiChar.classList.remove("spin-animate", "bounce-animate", "sabi-animate");
  void kubiChar.offsetWidth;

  const r = Math.random();
  if (r < 0.4) {
    kubiChar.classList.add("spin-animate");
  } else if (r < 0.8) {
    kubiChar.classList.add("bounce-animate");
  }
}

function changeCharacterFace(faceType, duration = 0) {
  const kubiChar = document.querySelector("#kubi-char");
  if (!kubiChar) return;

  if (duration === 0 && isTemporaryFace) return;

  if (faceTimer) clearTimeout(faceTimer);
  kubiChar.style.backgroundImage = `url('${CHAR_FACES[faceType]}')`;

  if (duration > 0) {
    isTemporaryFace = true;
    faceTimer = setTimeout(() => {
      isTemporaryFace = false;
      const defaultFace = chorusMode ? "chorus" : "normal";
      kubiChar.style.backgroundImage = `url('${CHAR_FACES[defaultFace]}')`;
    }, duration);
  }
}

function playChorusAnimation(kubiChar, beatCount) {
  kubiChar.classList.remove("spin-animate", "bounce-animate", "sabi-animate");
  void kubiChar.offsetWidth;
  kubiChar.classList.add("sabi-animate");
}

// Playerのリスナー設定
player.addListener({
  onAppReady: (app) => {
    if (!app.managed) {
      player.createFromSongUrl("https://piapro.jp/t/E2i3/20251215092113");
    }
  },
  onVideoReady: () => {
    changeScreen(startScreen, true, () => {
      updateLayout();
    });
  },
  onBeat: (beat) => {
    updateLiveEffects();
  },
  onTimeUpdate: (position) => {
    const phrase = player.video?.findPhrase(position);
    const lyricsEl = document.querySelector("#lyrics");

    if (phrase && lyricsEl) {
      if (currentPhrase !== phrase) {
        currentPhrase = phrase;
        lyricsEl.innerHTML = "";
        lyricsEl.classList.add("has-bubble");

        for (const word of phrase.children) {
          for (const char of word.children) {
            if (char.text === "\n" || char.text === "\r") {
              const br = document.createElement("br");
              lyricsEl.appendChild(br);
              continue;
            }
            const span = document.createElement("span");
            span.classList.add("lyric-char");
            span.textContent = char.text;
            span.dataset.start = char.startTime;
            lyricsEl.appendChild(span);
          }
        }
        lyricsEl.classList.remove("lyrics-show");
        void lyricsEl.offsetWidth;
        lyricsEl.classList.add("lyrics-show");
      }

      const charSpans = lyricsEl.querySelectorAll(".lyric-char");
      charSpans.forEach(span => {
        const startTime = parseFloat(span.dataset.start);
        if (position >= startTime) {
          span.classList.add("char-shown");
        } else {
          span.classList.remove("char-shown");
        }
      });
    } else if (lyricsEl) {
      if (currentPhrase !== null) {
        currentPhrase = null;
        lyricsEl.innerHTML = "";
        lyricsEl.classList.remove("has-bubble");
      }
    }

    const bpm = 174;
    const beatInterval = (60 / bpm) * 1000;
    const currentBeatCount = Math.floor(position / beatInterval);

    if (currentBeatCount !== lastBeatCount && !isPaused) {
      lastBeatCount = currentBeatCount;
      const kubiChar = document.querySelector("#kubi-char");
      if (kubiChar) {
        if (chorusMode) {
          playChorusAnimation(kubiChar, currentBeatCount);
        } else {
          playNormalAnimation(kubiChar, currentBeatCount);
        }
      }

      // --- 修正後のノーツ生成ロジック ---
      const noteInterval = DIFFICULTY_SETTINGS[currentDifficulty];
      const beat = player.findBeat(player.timer.position); // 現在の拍情報を取得
      const interval = chorusMode ? noteInterval.chorus : noteInterval.normal;

      // 1. 指定の拍周期に達しているか確認
      if (currentBeatCount % interval === 0) {

        // 2. 「強拍（小節の頭など）」なら必ず生成し、「弱拍」なら確率で生成（ランダム性の付与）
        // これにより、単調なリズムに強弱が生まれます
        let shouldSpawn = false;
        if (beat && beat.isStrong) {
          shouldSpawn = true; // 強拍は確実に鳴らす
        } else {
          // 弱拍は、サビなら確率高め、通常なら確率低めで生成
          const prob = chorusMode ? 1.0 : 0.8;
          shouldSpawn = Math.random() < prob;
        }

        // 3. サビなら密度を上げるために、複数生成するなどの演出も可能
        if (shouldSpawn) {
          createNote();
          // サビでかつ強拍なら、さらにもう一つ追加して密度を上げる演出
          if (chorusMode && beat && beat.isStrong) {
            setTimeout(createNote, 100);
          }
        }
      }
    }

    const chorusZone = player.findChorus(position);
    if (chorusZone) {
      if (!chorusMode) {
        chorusMode = true;
        updateLiveEffects();
      }
    } else {
      if (chorusMode) {
        chorusMode = false;
        updateLiveEffects();
      }
    }

    if (player.video && position >= player.video.duration - 1000) {
      if (!resultScreen.classList.contains("active")) {
        player.requestStop();
      }
    }
  },
  onPause: () => {
    if (player.video && player.timer.position >= player.video.duration - 1500) {
      if (!resultScreen.classList.contains("active")) {
        player.requestStop();
      }
    }
  },
  onStop: () => {
    if (startScreen.classList.contains("active")) return;
    changeScreen(resultScreen, true, () => {
      const resScore = document.querySelector("#result-screen #score");
      if (resScore) resScore.textContent = `SCORE : ${score}`;
    });
  }
});

// --- 🕹️ ボタンのイベントリスナー設定 ---

startEasyBtn.addEventListener("click", () => {
  currentDifficulty = "easy";
  changeScreen(gameScreen, true, () => {
    updateLayout();
    if (ruleOverlay) ruleOverlay.style.display = "flex";
  });
});

startSongBtn.addEventListener("click", () => {
  console.log("スタートボタンが押されました");
  if (ruleOverlay) ruleOverlay.style.display = "none";
  player.requestMediaSeek(0);
  player.requestPlay();
});

skipBtn.addEventListener("click", () => {
  if (player.video) {
    const endPosition = player.video.duration - 10000;
    player.requestMediaSeek(endPosition);
    isPaused = false;
    pauseMenu.classList.add("hidden");
    player.requestPlay();
  }
});

resumeBtn.addEventListener("click", () => {
  isPaused = false;
  pauseMenu.classList.add("hidden");
  player.requestPlay();
});

restartBtn.addEventListener("click", () => {
  pauseMenu.classList.add("hidden");
  isPaused = false;
  changeScreen(gameScreen, true, () => {
    resetGame();
    updateLayout();
    player.requestMediaSeek(0);
    player.requestPlay();
  });
});

menuBackToTitleBtn.addEventListener("click", () => {
  pauseMenu.classList.add("hidden");
  isPaused = false;
  player.requestStop();
  changeScreen(startScreen, true, () => {
    resetGame();
  });
});

retryBtn.addEventListener("click", () => {
  changeScreen(gameScreen, true, () => {
    resetGame();
    updateLayout();
    player.requestMediaSeek(0);
    player.requestPlay();
  });
});

backToTitleBtn.addEventListener("click", () => {
  changeScreen(startScreen, true, () => {
    resetGame();
  });
});

// ========================================================
// ⚡ 波形アニメーションループ
// ========================================================
function drawWaveLoop() {
  requestAnimationFrame(drawWaveLoop);

  const canvas = document.querySelector("#live-effect-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const gameScreen = document.querySelector("#game-screen");
  if (!gameScreen || !gameScreen.classList.contains("active")) return;

  ctx.fillStyle = WAVE_BOX_PROP.backgroundColor;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(waveBox.x, waveBox.y, waveBox.width, waveBox.height, waveBox.borderRadius);
  } else {
    ctx.rect(waveBox.x, waveBox.y, waveBox.width, waveBox.height);
  }
  ctx.fill();

  if (waveBox.borderWidth > 0) {
    ctx.strokeStyle = chorusMode ? WAVE_BOX_PROP.borderColorChorus : WAVE_BOX_PROP.borderColorNormal;
    ctx.lineWidth = waveBox.borderWidth;
    ctx.stroke();
  }

  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(waveBox.x, waveBox.y, waveBox.width, waveBox.height, waveBox.borderRadius);
  } else {
    ctx.rect(waveBox.x, waveBox.y, waveBox.width, waveBox.height);
  }
  ctx.clip();

  if (player && player.timer) {
    const pos = player.timer.position;
    let beatPulse = 0;
    const beat = player.findBeat(pos);
    if (beat) {
      beatPulse = Math.exp(-beat.progress(pos) * 4);
    }

    let amplitude = chorusMode
      ? (waveBox.height * 0.25 + beatPulse * (waveBox.height * 0.25))
      : (waveBox.height * 0.12 + beatPulse * (waveBox.height * 0.10));

    let frequency = 0.015;
    let speed = pos * 0.006;
    let centerY = waveBox.y + (waveBox.height * 0.5);

    ctx.beginPath();
    for (let x = waveBox.x; x <= waveBox.x + waveBox.width; x += 4) {
      let y = centerY +
        Math.sin(x * frequency + speed) * amplitude +
        Math.cos(x * 0.014 - speed * 1.3) * (amplitude * 0.35);

      if (x === waveBox.x) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.strokeStyle = chorusMode ? "#1900ff" : "#00f2fe";
    ctx.lineWidth = Math.max(2, waveBox.width * 0.006);
    ctx.shadowBlur = 12;
    ctx.shadowColor = chorusMode ? "#1900ff" : "#00f2fe";
    ctx.stroke();
  }

  ctx.restore();
}

// 初回配置計算を実行
setTimeout(updateLayout, 100);

// 超高精度描画ループを起動
requestAnimationFrame(drawWaveLoop);