// Trainer visual + sound overrides.
// Keeps the large main.js untouched while improving live trace contrast, removing ticker tail glow,
// and making sound cues much louder.
(function(){
  // Improve dark-mode contrast for the three canvas live traces.
  const proto = CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  if(proto && !proto.__veeraTraceContrastPatched){
    const strokeDesc = Object.getOwnPropertyDescriptor(proto, 'strokeStyle');
    const shadowDesc = Object.getOwnPropertyDescriptor(proto, 'shadowColor');

    if(strokeDesc && strokeDesc.set && strokeDesc.get){
      Object.defineProperty(proto, 'strokeStyle', {
        get(){ return strokeDesc.get.call(this); },
        set(value){
          let next = value;
          const dark = document.body && document.body.classList.contains('dark');
          if(dark && typeof value === 'string'){
            if(value === 'rgba(216,180,254,.92)') next = 'rgba(255,255,255,.98)';       // power trace
            if(value === 'rgba(186,230,253,.78)') next = 'rgba(34,211,238,.98)';        // cadence trace
            if(value === 'rgba(249,168,212,.78)') next = 'rgba(251,113,133,.98)';       // HR trace
          }
          strokeDesc.set.call(this, next);
        },
        configurable:true,
        enumerable:strokeDesc.enumerable
      });
    }

    // Remove the glow/shadow that follows the current workout ticker.
    if(shadowDesc && shadowDesc.set && shadowDesc.get){
      Object.defineProperty(proto, 'shadowColor', {
        get(){ return shadowDesc.get.call(this); },
        set(value){
          let next = value;
          if(typeof value === 'string'){
            if(value === 'rgba(125,211,252,.26)' || value === 'rgba(125,211,252,.22)'){
              next = 'rgba(0,0,0,0)';
            }
          }
          shadowDesc.set.call(this, next);
        },
        configurable:true,
        enumerable:shadowDesc.enumerable
      });
    }

    const originalCreateLinearGradient = proto.createLinearGradient;
    const originalAddColorStop = CanvasGradient.prototype.addColorStop;

    proto.createLinearGradient = function(){
      const gradient = originalCreateLinearGradient.apply(this, arguments);
      gradient.__veeraMaybeTickerTail = true;
      return gradient;
    };

    CanvasGradient.prototype.addColorStop = function(offset, color){
      let next = color;
      if(this.__veeraMaybeTickerTail && typeof color === 'string'){
        const tickerTailColour =
          color === 'rgba(125,211,252,0)' ||
          color === 'rgba(186,230,253,.13)' ||
          color === 'rgba(14,165,233,.12)';
        if(tickerTailColour) next = 'rgba(0,0,0,0)';
      }
      return originalAddColorStop.call(this, offset, next);
    };

    proto.__veeraTraceContrastPatched = true;
  }

  // Replace sound cues with a 5x louder version.
  window.playCue = function(type='beep'){
    const toggle = document.getElementById('soundToggle');
    if(toggle && !toggle.checked) return;
    try{
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if(!AudioContextClass) return;
      if(!window.audioCtx) window.audioCtx = new AudioContextClass();
      if(window.audioCtx.state === 'suspended') window.audioCtx.resume();

      const now = window.audioCtx.currentTime;
      const osc = window.audioCtx.createOscillator();
      const gain = window.audioCtx.createGain();
      const settings = {
        countdown: { frequency: 720, duration: 0.09, volume: 0.42 },
        newBlock: { frequency: 1180, duration: 0.13, volume: 0.60 },
        complete: { frequency: 980, duration: 0.20, volume: 0.57 },
        beep: { frequency: 720, duration: 0.10, volume: 0.45 }
      }[type] || { frequency: 720, duration: 0.10, volume: 0.45 };

      osc.type = 'sine';
      osc.frequency.setValueAtTime(settings.frequency, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(settings.volume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + settings.duration);
      osc.connect(gain);
      gain.connect(window.audioCtx.destination);
      osc.start(now);
      osc.stop(now + settings.duration + 0.02);
    }catch(e){}
  };

  // Redraw graph once the patch is loaded so colour changes apply immediately.
  setTimeout(()=>{
    try{
      if(typeof drawGraph === 'function' && typeof currentElapsed === 'function') drawGraph(currentElapsed());
    }catch(e){}
  }, 80);
})();
