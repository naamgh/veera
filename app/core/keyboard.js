(function(){
  function isTypingTarget(el){
    if(!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  function clickButton(id){
    const el = document.getElementById(id);
    if(el && !el.disabled){ el.click(); return true; }
    return false;
  }

  document.addEventListener('keydown', function(e){
    const typing = isTypingTarget(e.target);
    let handled = false;

    if(!typing && e.key === 'Enter') handled = clickButton('startBtn');
    else if(!typing && (e.code === 'Space' || e.key === ' ')) handled = clickButton('pauseBtn');
    else if(!typing && e.key === 'ArrowLeft'){
      document.body.classList.add('sidebar-collapsed');
      handled = true;
    }
    else if(!typing && e.key === 'ArrowRight'){
      document.body.classList.remove('sidebar-collapsed');
      handled = true;
    }

    if(handled){
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
})();
