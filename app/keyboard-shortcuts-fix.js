// Reliable keyboard shortcuts for the Trainer App.
// Loaded after main.js so it can call the current app functions/buttons directly.
(function(){
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

  function setSetupVisible(show){
    if(typeof window.showSetupPanel === 'function' && show){
      window.showSetupPanel();
      return true;
    }
    if(typeof window.hideSetupPanel === 'function' && !show){
      window.hideSetupPanel();
      return true;
    }

    const body = document.body;
    if(!body) return false;
    const currentlyCollapsed = body.classList.contains('sidebar-collapsed');
    if(show && currentlyCollapsed){
      const btn = document.getElementById('focusToggleBtn');
      if(btn){ btn.click(); return true; }
      body.classList.remove('sidebar-collapsed');
      return true;
    }
    if(!show && !currentlyCollapsed){
      const btn = document.getElementById('focusToggleBtn');
      if(btn){ btn.click(); return true; }
      body.classList.add('sidebar-collapsed');
      return true;
    }
    return true;
  }

  function adjustIntensity(delta){
    if(typeof window.changeBias === 'function'){
      window.changeBias(delta / 100);
      const slider = document.getElementById('intensitySlider');
      const value = document.getElementById('intensityValue');
      if(slider && typeof window.bias !== 'undefined') slider.value = String(Math.round(window.bias * 100));
      if(value && slider) value.textContent = `${Math.round(Number(slider.value || 100))}%`;
      return true;
    }

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

  document.addEventListener('keydown', function(e){
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
  }, true);
})();
