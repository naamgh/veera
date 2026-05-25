// Restores the timeline intensity, skip and interval extension controls as a visible dock.
// Uses the original control IDs, so existing main.js handlers keep working.
(function(){
  function restoreTimelineControls(){
    const timeline = document.querySelector('.timeline');
    const hud = document.querySelector('.timeline-hud-panel');
    if(!timeline || !hud) return;

    let dock = document.querySelector('.timeline-control-dock');
    if(!dock){
      dock = document.createElement('div');
      dock.className = 'timeline-control-dock';
    }

    const ids = [
      'intensitySlider',
      'intensityValue',
      'intensityDownBtn',
      'intensityUpBtn',
      'skipIntervalBtn',
      'extendInterval1Btn',
      'extendInterval25Btn',
      'extendInterval5Btn'
    ];

    ids.forEach(id=>{
      const el = document.getElementById(id);
      if(!el) return;
      el.style.display = '';
      el.style.visibility = 'visible';
      el.style.opacity = '1';
      el.removeAttribute('hidden');
      if(el.parentElement !== dock) dock.appendChild(el);
    });

    dock.style.display = 'flex';
    dock.style.visibility = 'visible';
    dock.style.opacity = '1';

    timeline.insertBefore(dock, hud);

    const oldControls = document.getElementById('intervalEditControls');
    if(oldControls && oldControls !== dock){
      oldControls.style.display = 'none';
    }
  }

  function injectControlStyles(){
    if(document.getElementById('veeraTimelineControlsRestoreStyles')) return;
    const style = document.createElement('style');
    style.id = 'veeraTimelineControlsRestoreStyles';
    style.textContent = `
      .timeline-control-dock{
        display:flex !important;
        align-items:center;
        justify-content:center;
        gap:10px;
        flex-wrap:wrap;
        width:100%;
        margin:10px auto 12px;
        padding:10px 12px;
        border-radius:18px;
        background:rgba(255,255,255,.72);
        border:1px solid rgba(203,213,225,.65);
        box-shadow:0 10px 24px rgba(15,23,42,.06);
        visibility:visible !important;
        opacity:1 !important;
      }
      body.dark .timeline-control-dock{
        background:rgba(15,23,42,.72);
        border-color:rgba(148,163,184,.24);
        box-shadow:none;
      }
      .timeline-control-dock input[type="range"]{
        display:block !important;
        width:min(260px, 42vw);
        min-width:160px;
      }
      .timeline-control-dock button,
      .timeline-control-dock .intensity-chip{
        display:inline-flex !important;
        align-items:center;
        justify-content:center;
        visibility:visible !important;
        opacity:1 !important;
        min-height:36px;
      }
      .timeline-control-dock .intensity-chip{
        padding:0 10px;
        border-radius:999px;
        background:rgba(15,23,42,.08);
        color:#0f172a;
        font-weight:900;
      }
      body.dark .timeline-control-dock .intensity-chip{
        background:rgba(255,255,255,.12);
        color:#f8fafc;
      }
    `;
    document.head.appendChild(style);
  }

  injectControlStyles();
  document.addEventListener('DOMContentLoaded', restoreTimelineControls);
  setTimeout(restoreTimelineControls, 50);
  setTimeout(restoreTimelineControls, 250);
  setTimeout(restoreTimelineControls, 800);
  setTimeout(restoreTimelineControls, 1600);
  window.addEventListener('resize', restoreTimelineControls, {passive:true});
})();
