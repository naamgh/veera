// Restores the Trainer App static shell before main.js initialises.
(function(){
  const app = document.querySelector('main.app');
  if(!app || app.children.length) return;

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
        <span><i class="key-icon">ENTER</i> Ready</span>
        <span><i class="key-icon wide">SPACE</i> Pause</span>
        <span><i class="key-icon">F</i> Fullscreen</span>
        <span><i class="key-icon">↑↓</i> +/- intensity</span>
        <span><i class="key-icon">←→</i> Show/Hide Menu</span>
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

        <div class="interval-edit-controls" id="intervalEditControls" aria-label="Interval controls">
          <div class="inline-intensity-control" aria-label="Intensity control">
            <label for="intensitySlider">Intensity</label>
            <input id="intensitySlider" type="range" min="50" max="150" value="100">
            <strong id="intensityValue" class="intensity-chip">100%</strong>
            <button id="intensityDownBtn" class="ghost icon-btn inline-intensity-btn" type="button" aria-label="Decrease intensity">−</button>
            <button id="intensityUpBtn" class="ghost icon-btn inline-intensity-btn" type="button" aria-label="Increase intensity">+</button>
          </div>
          <span class="interval-edit-divider inline-intensity-divider" aria-hidden="true"></span>
          <button id="skipIntervalBtn" class="ghost interval-edit-btn" type="button" disabled>Skip interval</button>
          <span class="interval-edit-divider" aria-hidden="true"></span>
          <button id="extendInterval1Btn" class="ghost interval-edit-btn" type="button" disabled>+1:00</button>
          <button id="extendInterval25Btn" class="ghost interval-edit-btn" type="button" disabled>+2:30</button>
          <button id="extendInterval5Btn" class="ghost interval-edit-btn" type="button" disabled>+5:00</button>
        </div>

        <div id="timelineOverlay" class="timeline-overlay" style="display:none"></div>
        <section class="timeline-hud-panel" aria-label="Live workout HUD">
          <div class="hud-dice-layout">
            <div class="hud-dice-left">
              <button class="metric metric-inline hud-small-item" id="hrMetricCard" type="button" aria-label="Connect heart rate monitor">
                <svg class="metric-icon heart-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.2-4.4-9.2-9.1C1.3 7.5 3.4 4.5 6.7 4.5c1.9 0 3.3 1 4.1 2.3.8-1.3 2.2-2.3 4.1-2.3 3.3 0 5.4 3 3.9 6.4C16.8 15.6 12 20 12 20z"/></svg>
                <span class="metric-copy"><span class="value"><span id="hrVal" class="metric-number">--</span><span class="unit">bpm</span></span><span class="metric-subtle" id="avgHrMetric">Avg -- bpm</span></span>
              </button>
              <div class="metric metric-inline hud-small-item" id="cadenceMetricCard">
                <svg class="metric-icon cadence-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.2a6.8 6.8 0 1 1-4.8 2M12 5.2V2.8M12 5.2l2.7 2.2M7.2 7.2 5.4 5.4M12 12l3.8 2.4"/></svg>
                <span class="metric-copy"><span class="value"><span id="cadenceVal" class="metric-number">--</span><span class="unit">rpm</span></span></span>
              </div>
            </div>

            <div class="hud-dice-center">
              <button class="metric metric-inline hud-power-item" id="powerMetricCard" type="button" aria-label="Connect smart trainer">
                <svg class="metric-icon power-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.2 2.8 5.8 13.1h5.1l-1 8.1 8.3-11.7h-5.4l.4-6.7z"/></svg>
                <span class="metric-copy"><span class="value"><span id="powerVal" class="metric-number">--</span><span class="unit">w</span></span><span class="metric-subtle" id="avgPowerMetric">Avg --w</span><span class="metric-subtle" id="tssMetric">TSS 0</span></span>
              </button>
            </div>

            <div class="hud-dice-right">
              <div class="timer-text-item primary hud-timer-item"><span>Interval</span><strong id="intervalCountdownText">0:00</strong></div>
              <div class="timer-text-item hud-timer-item"><span>Total</span><strong id="totalCountdownText">0:00</strong></div>
            </div>
          </div>
        </section>
      </div>

      <aside class="ride-controls-column">
        <div class="ride-block-card" aria-live="polite">
          <div id="currentBlockPanel" class="current-block-panel zone-recovery">
            <span class="block-card-label">Current block</span>
            <span id="currentBlockGlance" class="block-card-value">--</span>
            <span id="currentBlockGlanceMeta" class="block-card-meta">Load a workout</span>
          </div>
          <div id="liveFtpPanel" class="ftp-live-panel" style="display:none">
            <span class="block-card-label">Live FTP</span>
            <span id="liveFtpValue" class="block-card-value">--</span>
            <span id="liveFtpMeta" class="block-card-meta">Current FTP --</span>
          </div>
          <div class="next-block-panel">
            <span class="block-card-label">Next block</span>
            <span id="nextBlockGlance" class="block-card-value">--</span>
            <span id="nextBlockGlanceMeta" class="block-card-meta">--</span>
          </div>
          <div id="blocksRemainingText" class="blocks-remaining">0 blocks remaining</div>
        </div>

        <div class="main-screen-progress progress-wrap"><div id="progress" class="progress"></div></div>

        <div class="ride-action-stack" id="rideActionStack" data-ride-state="idle">
          <div class="ride-controls-label">Ride Controls</div>
          <div class="controls ride-controls-strip" aria-label="Ride Controls">
            <button id="startBtn" class="ride-control-btn ride-control-ready" disabled>Ready</button>
            <button class="ride-control-btn ride-control-pause" id="pauseBtn" disabled>Pause</button>
            <button class="ride-control-btn ride-control-stop" id="resetBtn" disabled>Stop Workout</button>
          </div>
          <div id="readyBanner" class="ready-banner">Load a workout, press Ready, then pedal.</div>
        </div>

        <div class="mini-controls"></div>

        <div class="recording-panel main-screen-exports" aria-hidden="true">
          <span id="recordDot" class="rec-dot" style="display:none"></span>
          <div class="export-only">
            <button class="green" id="exportTcxBtn" disabled>Export TCX</button>
            <button class="ghost" id="exportTimelinePngBtn" disabled>Export Timeline PNG</button>
          </div>
        </div>
      </aside>

      <div class="record-grid">
        <strong id="recordSamples" style="display:none">0</strong>
        <strong id="recordDuration" style="display:none">0:00</strong>
        <strong id="recordAvgPower" style="display:none">--</strong>
        <strong id="recordAvgHr" style="display:none">--</strong>
      </div>
    </div>
  </section>`;
})();
