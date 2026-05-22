// Timeline controls module.
// Owns the intensity slider, skip interval and interval extension control dock.
// Loaded before main.js so it can block older duplicate docking scripts.
(function(){
  if(window.__veeraTimelineControlsLoaded) return;
  window.__veeraTimelineControlsLoaded = true;

  const originalDocumentAddEventListener = Document.prototype.addEventListener;
  const originalWindowAddEventListener = Window.prototype.addEventListener;
  const originalSetTimeout = window.setTimeout;

  function looksLikeLegacyTimelineDocker(fn){
    if(typeof fn !== 'function') return false;
    const source = Function.prototype.toString.call(fn);
    return source.includes('timeline-control-dock') &&
      (
        source.includes('dockTimelineControls') ||
        source.includes('dockAllIntervalControls') ||
        source.includes('dockExactIntervalControls') ||
        source.includes('rebuildIntervalControlBar') ||
        source.includes('intensityMinusBtn') ||
        source.includes('intensityChip')
      );
  }

  Document.prototype.addEventListener = function(type, listener, options){
    if(this === document && (type === 'DOMContentLoaded' || type === 'keydown') && looksLikeLegacyTimelineDocker(listener)){
      console.info('Veera: blocked duplicate legacy timeline controls listener.');
      return;
    }
    return originalDocumentAddEventListener.call(this, type, listener, options);
  };

  Window.prototype.addEventListener = function(type, listener, options){
    if(this === window && type === 'resize' && looksLikeLegacyTimelineDocker(listener)){
      console.info('Veera: blocked duplicate legacy timeline resize listener.');
      return;
    }
    return originalWindowAddEventListener.call(this, type, listener, options);
  };

  window.setTimeout = function(handler, timeout){
    if(looksLikeLegacyTimelineDocker(handler)){
      console.info('Veera: blocked duplicate legacy timeline timeout.');
      return 0;
    }
    return originalSetTimeout.apply(this, arguments);
  };

  function injectStyles(){
    if(document.getElementById('veeraTimelineControlsModuleStyles')) return;
    const style = document.createElement('style');
    style.id = 'veeraTimelineControlsModuleStyles';
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
        width:min(260px,42vw);
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
      #intervalEditControls{
        display:none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function syncIntensityDisplay(){
    const slider = document.getElementById('intensitySlider');
    const value = document.getElementById('intensityValue');
    if(!slider || !value) return;
    value.textContent = `${Math.round(Number(slider.value || 100))}%`;
  }

  function bindIntensitySync(){
    const slider = document.getElementById('intensitySlider');
    if(!slider || slider.dataset.veeraTimelineControlBound) return;
    slider.addEventListener('input', syncIntensityDisplay);
    slider.addEventListener('change', syncIntensityDisplay);
    slider.dataset.veeraTimelineControlBound = 'true';
  }

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

    bindIntensitySync();
    syncIntensityDisplay();
  }

  injectStyles();
  originalDocumentAddEventListener.call(document, 'DOMContentLoaded', restoreTimelineControls);
  originalWindowAddEventListener.call(window, 'resize', restoreTimelineControls, {passive:true});
  originalSetTimeout(restoreTimelineControls, 50);
  originalSetTimeout(restoreTimelineControls, 250);
  originalSetTimeout(restoreTimelineControls, 800);
})();
