(function(){
  function bindFullscreenToggle(){
    const setupToggles = document.querySelector('.setup-toggles');
    if(!setupToggles || document.getElementById('fullscreenToggleBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'fullscreenToggleBtn';
    btn.className = 'ghost icon-btn';
    btn.type = 'button';
    btn.title = 'Toggle fullscreen';
    btn.setAttribute('aria-label','Toggle fullscreen');
    btn.textContent = '⛶';

    btn.addEventListener('click', async ()=>{
      try{
        if(!document.fullscreenElement){
          await document.documentElement.requestFullscreen();
          btn.classList.add('active');
        }else{
          await document.exitFullscreen();
          btn.classList.remove('active');
        }
      }catch(err){
        console.warn('Fullscreen toggle failed', err);
      }
    });

    document.addEventListener('fullscreenchange', ()=>{
      btn.classList.toggle('active', !!document.fullscreenElement);
    });

    setupToggles.appendChild(btn);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bindFullscreenToggle);
  }else{
    bindFullscreenToggle();
  }
})();