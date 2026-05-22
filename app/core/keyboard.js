// Core keyboard shortcuts for Trainer App.
// Loaded before main.js so it can block older duplicate document-level handlers.
(function(){
  if(window.__veeraKeyboardCoreLoaded) return;
  window.__veeraKeyboardCoreLoaded = true;

  const originalDocumentAddEventListener = Document.prototype.addEventListener;

  function isTypingTarget(el){
    if(!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  function clickButton(id){
    const el = document.getElementById(id);
    if(el && !el.disabled){
      el.click();
      return true;
    }
    return false;
  }

  function redrawTimelineSoon(){
    try{
      if(typeof redrawGraphDuringLayoutAnimation === 'function') redrawGraphDuringLayoutAnimation();
      else if(typeof drawGraph === 'function' && typeof currentElapsed === 'function') drawGraph(currentElapsed());
    }catch(e){}
  }

  function setSetupVisible(show){
    try{
      if(show && typeof showSetupPanel === 'function'){
        showSetupPanel();
        return true;
      }
      if(!show && typeof hideSetupPanel === 'function'){
        hideSetupPanel();
        return true;
      }
    }catch(e){}

    if(!document.body) return false;
    document.body.classList.toggle('sidebar-collapsed', !show);
    redrawTimelineSoon();
    return true;
  }

  function adjustIntensity(delta){
    try{
      if(typeof window.adjustIntensity === 'function'){
        window.adjustIntensity(delta);
        return true;
      }
    }catch(e){}

    const slider = document.getElementById('intensitySlider');
    if(!slider) return false;
    const current = Number(slider.value || 100);
    const min = Number(slider.min || 50);
    const max = Number(slider.max || 150);
    const next = Math.max(min, Math.min(max, current + delta));
    slider.value = String(next);
    slider.dispatchEvent(new Event('input', {bubbles:true}));
    slider.dispatchEvent(new Event('change', {bubbles:true}));
    const value = document.getElementById('intensityValue');
    if(value) value.textContent = `${next}%`;
    return true;
  }

  function handleTrainerShortcut(e){
    const typing = isTypingTarget(e.target);
    let handled = false;

    if(!typing && e.key === 'Enter'){
      handled = clickButton('startBtn');
    }else if(!typing && (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar')){
      handled = clickButton('pauseBtn');
    }else if(e.key === 'ArrowUp' && (!typing || e.target.id === 'intensitySlider')){
      handled = adjustIntensity(1);
    }else if(e.key === 'ArrowDown' && (!typing || e.target.id === 'intensitySlider')){
      handled = adjustIntensity(-1);
    }else if(!typing && e.key === 'ArrowLeft'){
      handled = setSetupVisible(false);
    }else if(!typing && e.key === 'ArrowRight'){
      handled = setSetupVisible(true);
    }

    if(handled){
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
    }
  }

  // Register official handler using the original method.
  originalDocumentAddEventListener.call(document, 'keydown', handleTrainerShortcut, true);

  // Block later duplicate document-level shortcut handlers from legacy main.js blocks.
  Document.prototype.addEventListener = function(type, listener, options){
    if(this === document && type === 'keydown' && typeof listener === 'function'){
      const source = Function.prototype.toString.call(listener);
      const looksLikeLegacyShortcut =
        source.includes('ArrowUp') &&
        source.includes('ArrowDown') &&
        (source.includes('startBtn') || source.includes('readyBtn') || source.includes('resumeBtn') || source.includes('adjustIntensity'));

      if(looksLikeLegacyShortcut){
        console.info('Veera: blocked duplicate document keyboard shortcut handler.');
        return;
      }
    }

    return originalDocumentAddEventListener.call(this, type, listener, options);
  };
})();
