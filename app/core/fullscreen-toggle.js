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

    async function toggleFullscreen(){
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
    }

    btn.addEventListener('click', toggleFullscreen);

    document.addEventListener('keydown', async (e)=>{
      const tag = (document.activeElement?.tagName || '').toLowerCase();

      if(tag === 'input' || tag === 'textarea') return;

      if(e.key.toLowerCase() === 'f'){
        e.preventDefault();
        toggleFullscreen();
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