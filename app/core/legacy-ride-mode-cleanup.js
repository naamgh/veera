// Legacy ride-mode cleanup.
// Ride mode is no longer part of the product UI. This module blocks old ride-mode
// viewport/layout listeners without removing trainer, workout or fullscreen logic.
(function(){
  if(window.__veeraLegacyRideModeCleanupLoaded) return;
  window.__veeraLegacyRideModeCleanupLoaded = true;

  const originalWindowAddEventListener = Window.prototype.addEventListener;
  const originalDocumentAddEventListener = Document.prototype.addEventListener;
  const originalSetInterval = window.setInterval;
  const originalClassListAdd = DOMTokenList.prototype.add;
  const originalClassListToggle = DOMTokenList.prototype.toggle;

  function looksLikeRideModeLegacy(fn){
    if(typeof fn !== 'function') return false;
    const source = Function.prototype.toString.call(fn);
    return source.includes('ride-mode') ||
      source.includes('ride-locked') ||
      source.includes('fitRideLayout') ||
      source.includes('lockRideViewport') ||
      source.includes('--ride-vh') ||
      source.includes('--ride-timeline-h');
  }

  Window.prototype.addEventListener = function(type, listener, options){
    if((type === 'resize' || type === 'orientationchange') && looksLikeRideModeLegacy(listener)){
      console.info('Veera: blocked legacy ride-mode window listener.');
      return;
    }
    return originalWindowAddEventListener.call(this, type, listener, options);
  };

  Document.prototype.addEventListener = function(type, listener, options){
    if((type === 'fullscreenchange' || type === 'DOMContentLoaded') && looksLikeRideModeLegacy(listener)){
      console.info('Veera: blocked legacy ride-mode document listener.');
      return;
    }
    return originalDocumentAddEventListener.call(this, type, listener, options);
  };

  window.setInterval = function(handler, timeout){
    if(looksLikeRideModeLegacy(handler)){
      console.info('Veera: blocked legacy ride-mode interval.');
      return 0;
    }
    return originalSetInterval.apply(this, arguments);
  };

  DOMTokenList.prototype.add = function(){
    const tokens = Array.from(arguments).filter(token => token !== 'ride-mode' && token !== 'ride-locked');
    if(!tokens.length) return;
    return originalClassListAdd.apply(this, tokens);
  };

  DOMTokenList.prototype.toggle = function(token, force){
    if(token === 'ride-mode' || token === 'ride-locked'){
      this.remove(token);
      return false;
    }
    return originalClassListToggle.call(this, token, force);
  };

  function clearRideModeState(){
    document.documentElement.classList.remove('ride-locked');
    document.body?.classList.remove('ride-mode');
    const root = document.documentElement;
    ['--ride-vh','--ride-pad','--ride-gap','--ride-controls-h','--ride-timeline-h'].forEach(prop=>root.style.removeProperty(prop));
    root.style.height = '';
    root.style.maxHeight = '';
    if(document.body){
      document.body.style.height = '';
      document.body.style.maxHeight = '';
      document.body.style.overflow = '';
    }
  }

  document.addEventListener('DOMContentLoaded', clearRideModeState);
  setTimeout(clearRideModeState, 50);
  setTimeout(clearRideModeState, 500);

  window.disableRideMode = clearRideModeState;
})();
