// Ensures loading a new workout clears live session state.
(function(){
  if(window.__veeraSessionResetPatched) return;
  window.__veeraSessionResetPatched = true;

  function resetSession(){
    try{
      if(Array.isArray(window.rideSamples)) window.rideSamples.length = 0;
      if(typeof elapsedOverride !== 'undefined') elapsedOverride = 0;
      if(typeof pausedAccum !== 'undefined') pausedAccum = 0;
      if(typeof startTs !== 'undefined') startTs = 0;
      if(typeof pausedAt !== 'undefined') pausedAt = 0;
      if(typeof currentBlockIndex !== 'undefined') currentBlockIndex = 0;
      if(typeof workoutDone !== 'undefined') workoutDone = false;
      if(typeof liveTss !== 'undefined') liveTss = 0;
      if(typeof graphOffset !== 'undefined') graphOffset = 0;

      const progress = document.getElementById('progress');
      if(progress) progress.style.width = '0%';

      if(typeof drawGraph === 'function') drawGraph(0);
    }catch(e){}
  }

  const originalLoadWorkout = window.loadWorkout;
  if(typeof originalLoadWorkout === 'function'){
    window.loadWorkout = function(){
      resetSession();
      return originalLoadWorkout.apply(this, arguments);
    };
  }
})();
