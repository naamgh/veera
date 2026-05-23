// Restores the Trainer App static shell before main.js initialises.
(function(){
  const app = document.querySelector('main.app');
  if(!app || app.children.length) return;

  const style = document.createElement('style');
  style.textContent = `
    .compact-command-strip{
      display:flex;
      align-items:center;
      justify-content:center;
      gap:10px;
      flex-wrap:wrap;
      padding:10px 12px;
      margin-top:8px;
      border-radius:18px;
      background:rgba(255,255,255,.04);
      backdrop-filter:blur(10px);
    }
    .command-group{
      display:flex;
      align-items:center;
      gap:8px;
    }
    .command-divider{
      width:1px;
      height:28px;
      background:rgba(148,163,184,.18);
      flex:0 0 auto;
    }
    .compact-pill-btn,
    .compact-intensity-chip{
      height:38px;
      min-height:38px;
      padding:0 14px;
      border-radius:999px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      font-weight:800;
      font-size:14px;
      line-height:1;
    }
    .compact-pill-btn{
      border:1px solid rgba(148,163,184,.2);
      background:rgba(255,255,255,.06);
      color:inherit;
      cursor:pointer;
    }
    .compact-pill-btn:disabled{
      opacity:.45;
    }
    .compact-intensity-chip{
      min-width:72px;
      background:rgba(255,255,255,.08);
    }
    .ride-command-group .compact-pill-btn{
      min-width:38px;
      padding:0;
      font-size:16px;
    }
    .ride-controls-column,
    .ride-action-stack,
    #readyBanner{
      display:none !important;
    }
  `;
  document.head.appendChild(style);

  app.innerHTML = `
  <section class="panel">
    <div class="setup-header">
      <strong>Setup</strong>
      <div class="setup-toggles">
        <label class="switch-row" title="Sound cues"><span>Sound</span><input id="soundToggle" type="checkbox" checked><i></i></label>
        <label class="switch-row" title="Dark mode"><span>Dark</span><input id="darkModeToggle" type="checkbox"><i></i></label>
      </div>
    </div>

    <div class="card shortcut-card">
      <p class="shortcut-card-title">Keyboard shortcuts</p>
      <div class="shortcut-legend" aria-label="Keyboard shortcuts">
        <span><i class="key-icon">↵</i> Ready</span>
        <span><i class="key-icon wide">SPC</i> Pause</span>
        <span><i class="key-icon">↑</i> + intensity</span>
        <span><i class="key-icon">↓</i> − intensity</span>
        <span><i class="key-icon">←</i> Hide Menu</span>
        <span><i class="key-icon">→</i> Show Menu</span>
      </div>
    </div>

    <div class="card">
      <label for="ftpInput">FTP</label>
      <input id="ftpInput" type="number" value="250" min="50" max="600">
      <p class="small">Used to convert ZWO % FTP targets into watts.</p>
    </div>

    <div class="card">
      <div class="erg-grid">
        <button id="connectHrBtn">Connect HR</button>
        <button class="secondary" id="connectTrainerBtn">Connect Trainer</button>
      </div>
      <div class="status"><span id="hrDot" class="dot"></span><span id="hrStatus">HR not connected</span></div>
      <div class="status"><span id="trainerDot" class="dot"></span><span id="trainerStatus">Trainer not connected</span></div>
    </div>

    <div class="card workout-library-card">
      <button id="openSavedWorkoutsBtn" class="secondary" type="button">Workouts</button>
    </div>

    <div style="display:none" aria-hidden="true">
      <div id="autoErgBanner"></div>
      <span id="ergDot" class="dot"></span>
      <span id="ergStatus"></span>
      <button id="ergOffBtn" type="button"></button>
    </div>
    <div id="ftmsLog" class="log" style="display:none">Debug log hidden</div>

    <input id="zwoInput" type="file" accept=".zwo,.xml" style="display:none;">
    <div style="display:none" aria-hidden="true">
      <span id="zwoDot" class="dot"></span>
      <span id="zwoStatus">No workout loaded</span>
      <span id="blocksTitle">Blocks</span>
      <div id="blockList"></div>
    </div>
  </section>

  <section class="main">
    <span id="speedVal" class="metric-number" style="display:none">--</span>
    <div class="player">
      <div class="timeline">
        <button id="rideModeBtn" type="button" style="display:none" disabled></button>
        <span id="elapsedText" style="display:none">0:00</span>
        <span id="totalText" style="display:none">0:00</span>
        <span id="currentBlockDetailText" style="display:none">--</span>
        <canvas id="graph" width="1200" height="420"></canvas>

        <div class="interval-edit-controls compact-command-strip" id="intervalEditControls" aria-label="Workout command strip">
          <div class="command-group intensity-command-group" aria-label="Intensity control">
            <button id="intensityDownBtn" class="ghost compact-pill-btn" type="button" aria-label="Decrease intensity">−</button>
            <strong id="intensityValue" class="compact-intensity-chip">100%</strong>
            <button id="intensityUpBtn" class="ghost compact-pill-btn" type="button" aria-label="Increase intensity">+</button>
          </div>

          <span class="command-divider" aria-hidden="true"></span>

          <div class="command-group">
            <button id="skipIntervalBtn" class="ghost compact-pill-btn" type="button" disabled>Skip Interval</button>
          </div>

          <span class="command-divider" aria-hidden="true"></span>

          <div class="command-group">
            <button id="extendInterval1Btn" class="ghost compact-pill-btn" type="button" disabled>+1 min</button>
            <button id="extendInterval5Btn" class="ghost compact-pill-btn" type="button" disabled>+5 min</button>
          </div>

          <span class="command-divider" aria-hidden="true"></span>

          <div class="command-group ride-command-group" aria-label="Ride controls">
            <button id="startBtn" class="ride-control-btn compact-pill-btn ride-control-ready" type="button" disabled>▶</button>
            <button class="ride-control-btn compact-pill-btn ride-control-pause" id="pauseBtn" type="button" disabled>❚❚</button>
            <button class="ride-control-btn compact-pill-btn ride-control-stop" id="resetBtn" type="button" disabled>■</button>
          </div>
        </div>

        <div id="timelineOverlay" class="timeline-overlay" style="display:none"></div>
        <section class="timeline-hud-panel" aria-label="Live workout HUD"></section>
      </div>

      <div class="record-grid">
        <strong id="recordSamples" style="display:none">0</strong>
        <strong id="recordDuration" style="display:none">0:00</strong>
        <strong id="recordAvgPower" style="display:none">--</strong>
        <strong id="recordAvgHr" style="display:none">--</strong>
      </div>
    </div>
  </section>`;
})();