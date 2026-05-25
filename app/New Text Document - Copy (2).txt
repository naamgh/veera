// Timeline renderer visual overrides.
// Owns dark-mode trace rendering behaviour.
(function(){
  if(window.__veeraTimelineRendererLoaded) return;
  window.__veeraTimelineRendererLoaded = true;

  const proto = CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  if(!proto || proto.__veeraTimelineRendererPatched) return;

  const strokeDesc = Object.getOwnPropertyDescriptor(proto, 'strokeStyle');

  if(strokeDesc && strokeDesc.set && strokeDesc.get){
    Object.defineProperty(proto, 'strokeStyle', {
      get(){
        return strokeDesc.get.call(this);
      },
      set(value){
        let next = value;
        const dark = document.body && document.body.classList.contains('dark');

        if(dark && typeof value === 'string'){
          // Power trace.
          if(value === 'rgba(216,180,254,.92)') next = 'rgba(255,255,255,.98)';

          // Heart-rate trace.
          if(value === 'rgba(186,230,253,.78)') next = 'rgba(34,211,238,.98)';

          // Cadence trace.
          if(value === 'rgba(249,168,212,.78)') next = 'rgba(251,113,133,.98)';
        }

        strokeDesc.set.call(this, next);
      },
      configurable:true,
      enumerable:strokeDesc.enumerable
    });
  }

  proto.__veeraTimelineRendererPatched = true;
})();
