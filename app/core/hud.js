// HUD layout module.
// Replaces the older icon-based HUD with a compact inline data strip.
(function(){
  if(window.__veeraHudLoaded) return;
  window.__veeraHudLoaded = true;

  const STORAGE_KEY = 'veeraIntervalTimerMode';

  function fmt(sec){
    if(typeof formatTime === 'function') return formatTime(sec || 0);
    sec = Math.max(0, Math.round(sec || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
  }

  function getMode(){
    try{ return localStorage.getItem(STORAGE_KEY) || 'down'; }catch(e){ return 'down'; }
  }

  function setMode(mode){
    try{ localStorage.setItem(STORAGE_KEY, mode); }catch(e){}
    updateToggleState();
    updateIntervalTimerOverride();
  }

  function injectStyles(){
    if(document.getElementById('veeraHudStyles')) return;
    const style = document.createElement('style');
    style.id = 'veeraHudStyles';
    style.textContent = `
      .timeline-hud-panel{
        padding:8px 10px !important;
      }
      .hud-inline-layout{
        display:grid;
        grid-template-columns:repeat(5,minmax(0,1fr));
        gap:10px;
        align-items:stretch;
        width:100%;
      }
      .hud-inline-item{
        width:100% !important;
        min-width:0;
        min-height:58px;
        margin:0 !important;
        padding:6px 10px !important;
        border-radius:18px !important;
        display:flex !important;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        gap:4px;
        text-align:center;
      }
      .hud-inline-item .metric-icon{
        display:none !important;
      }
      .hud-inline-label{
        display:flex;
        align-items:center;
        justify-content:center;
        gap:5px;
        font-size:10px;
        line-height:1;
        font-weight:900;
        letter-spacing:.13em;
        text-transform:uppercase;
        color:rgba(100,116,139,.82);
        white-space:nowrap;
      }
      body.dark .hud-inline-label{
        color:rgba(203,213,225,.64);
      }
      .hud-inline-value{
        display:flex;
        align-items:baseline;
        justify-content:center;
        gap:4px;
        font-size:26px;
        font-weight:950;
        letter-spacing:-.04em;
        line-height:1.05;
        white-space:nowrap;
      }
      .hud-inline-value .unit{
        font-size:12px;
        font-weight:900;
        color:var(--muted);
        margin:0;
      }
      .hud-timer-toggle{
        appearance:none;
        width:auto !important;
        min-width:0;
        min-height:0;
        height:18px;
        padding:0 5px;
        border-radius:999px;
        border:1px solid rgba(148,163,184,.38);
        background:rgba(255,255,255,.55);
        box-shadow:none;
        color:var(--muted);
        font-size:10px;
        font-weight:950;
        line-height:1;
      }
      .hud-timer-toggle:hover{
        transform:none;
        filter:none;
      }
      .hud-timer-toggle.is-up{
        color:#0f172a;
        background:rgba(125,211,252,.36);
        border-color:rgba(14,165,233,.34);
      }
      body.dark .hud-timer-toggle{
        background:rgba(15,23,42,.54);
        border-color:rgba(148,163,184,.24);
        color:rgba(203,213,225,.76);
      }
      body.dark .hud-timer-toggle.is-up{
        background:rgba(56,189,248,.22);
        color:#e0f2fe;
      }
      .hud-hidden-metric-meta{
        display:none !important;
      }
      @media(max-width:760px){
        .hud-inline-layout{
          grid-template-columns:repeat(5,minmax(58px,1fr));
          gap:6px;
        }
        .hud-inline-item{
          min-height:58px;
          padding:6px 6px !important;
          border-radius:14px !important;
        }
        .hud-inline-label{font-size:8px;letter-spacing:.08em;}
        .hud-inline-value{font-size:19px;}
        .hud-inline-value .unit{font-size:9px;}
      }
    `;
    document.head.appendChild(style);
  }

  function buildHud(){
    const panel = document.querySelector('.timeline-hud-panel');
    if(!panel || panel.dataset.veeraHudInline === 'true') return;

    panel.dataset.veeraHudInline = 'true';
    panel.innerHTML = `
      <div class="hud-inline-layout" aria-label="Live workout data">
        <div class="metric metric-inline hud-inline-item" id="cadenceMetricCard">
          <span class="hud-inline-label">RPM</span>
          <span class="hud-inline-value"><span id="cadenceVal" class="metric-number">--</span><span class="unit">rpm</span></span>
        </div>
        <button class="metric metric-inline hud-inline-item" id="hrMetricCard" type="button" aria-label="Connect heart rate monitor">
          <span class="hud-inline-label">HR</span>
          <span class="hud-inline-value"><span id="hrVal" class="metric-number">--</span><span class="unit">bpm</span></span>
          <span class="hud-hidden-metric-meta" id="avgHrMetric">Avg -- bpm</span>
        </button>
        <button class="metric metric-inline hud-inline-item" id="powerMetricCard" type="button" aria-label="Connect smart trainer">
          <span class="hud-inline-label">Power</span>
          <span class="hud-inline-value"><span id="powerVal" class="metric-number">--</span><span class="unit">w</span></span>
          <span class="hud-hidden-metric-meta" id="avgPowerMetric">Avg --w</span>
          <span class="hud-hidden-metric-meta" id="tssMetric">TSS 0</span>
        </button>
        <div class="timer-text-item primary hud-inline-item hud-interval-item">
          <span class="hud-inline-label">Interval <button id="intervalTimerDirectionBtn" class="hud-timer-toggle" type="button" title="Toggle interval timer count direction">↑↓</button></span>
          <strong id="intervalCountdownText" class="hud-inline-value">0:00</strong>
        </div>
        <div class="timer-text-item hud-inline-item hud-total-item">
          <span class="hud-inline-label">Total</span>
          <strong id="totalCountdownText" class="hud-inline-value">0:00</strong>
        </div>
      </div>`;

    const toggle = document.getElementById('intervalTimerDirectionBtn');
    if(toggle){
      toggle.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        setMode(getMode() === 'up' ? 'down' : 'up');
      });
    }
    updateToggleState();
  }

  function updateToggleState(){
    const btn = document.getElementById('intervalTimerDirectionBtn');
    if(!btn) return;
    const up = getMode() === 'up';
    btn.classList.toggle('is-up', up);
    btn.setAttribute('aria-pressed', up ? 'true' : 'false');
    btn.title = up ? 'Interval timer counts up. Click to count down.' : 'Interval timer counts down. Click to count up.';
  }

  function updateIntervalTimerOverride(){
    if(getMode() !== 'up') return;
    const el = document.getElementById('intervalCountdownText');
    if(!el) return;

    try{
      if(typeof currentElapsed !== 'function' || typeof blockAt !== 'function') return;
      const hit = blockAt(currentElapsed());
      if(!hit) return;
      const local = Math.max(0, currentElapsed() - hit.start);
      el.textContent = fmt(local);
    }catch(e){}
  }

  function init(){
    injectStyles();
    buildHud();
    updateIntervalTimerOverride();
  }

  document.addEventListener('DOMContentLoaded', init);
  setTimeout(init, 50);
  setTimeout(init, 250);
  setTimeout(init, 800);
  setInterval(updateIntervalTimerOverride, 250);
})();
