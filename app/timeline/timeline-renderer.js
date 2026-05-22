// Timeline renderer visual/audio overrides.
(function(){
  const proto = CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  if(proto && !proto.__veeraTimelineRendererPatched){
    const strokeDesc = Object.getOwnPropertyDescriptor(proto, 'strokeStyle');

    if(strokeDesc && strokeDesc.set && strokeDesc.get){
      Object.defineProperty(proto, 'strokeStyle', {
        get(){ return strokeDesc.get.call(this); },
        set(value){
          let next = value;
          const dark = document.body && document.body.classList.contains('dark');
          if(dark && typeof value === 'string'){
            if(value === 'rgba(216,180,254,.92)') next = 'rgba(255,255,255,.98)';
            if(value === 'rgba(186,230,253,.78)') next = 'rgba(34,211,238,.98)';
            if(value === 'rgba(249,168,212,.78)') next = 'rgba(251,113,133,.98)';
          }
          strokeDesc.set.call(this, next);
        },
        configurable:true,
        enumerable:strokeDesc.enumerable
      });
    }

    proto.__veeraTimelineRendererPatched = true;
  }

  // Louder sound cues.
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
        countdown:{frequency:720,duration:0.09,volume:0.42},
        newBlock:{frequency:1180,duration:0.13,volume:0.60},
        complete:{frequency:980,duration:0.20,volume:0.57},
        beep:{frequency:720,duration:0.10,volume:0.45}
      }[type] || {frequency:720,duration:0.10,volume:0.45};

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
})();
