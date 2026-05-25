// Workout session lifecycle reset module.
// Owns clearing live ride/session state before loading a new workout.
(function(){
  if(window.__veeraSessionResetPatched) return;
  window.__veeraSessionResetPatched = true;

  let resetDepth = 0;
  let lastResetAt = 0;

  function setText(id, value){
    const el = document.getElementById(id);
    if(el) el.textContent = value;
  }

  function setWidth(id, value){
    const el = document.getElementById(id);
    if(el) el.style.width = value;
  }

  function closeModal(id){
    const el = document.getElementById(id);
    if(el) el.classList.remove('open');
  }

  function resetWorkoutSessionState(){
    const now = Date.now();

    // Prevent duplicate resets when one loader calls another internally.
    if(resetDepth > 0 || now - lastResetAt < 120) return;
    lastResetAt = now;

    try{
      // Timers / playback state.
      if(typeof playing !== 'undefined') playing = false;
      if(typeof readyToStart !== 'undefined') readyToStart = false;
      if(typeof workoutPaused !== 'undefined') workoutPaused = false;
      if(typeof workoutCompleted !== 'undefined') workoutCompleted = false;
      if(typeof workoutEndReason !== 'undefined') workoutEndReason = 'completed';
      if(typeof stopConfirmOpen !== 'undefined') stopConfirmOpen = false;
      if(typeof elapsedBeforePause !== 'undefined') elapsedBeforePause = 0;
      if(typeof startedAt !== 'undefined') startedAt = 0;
      if(typeof readyNeedsFreshPedal !== 'undefined') readyNeedsFreshPedal = false;
      if(typeof readyPedalReleased !== 'undefined') readyPedalReleased = true;

      // Recording / live data.
      if(typeof recording !== 'undefined') recording = false;
      if(typeof recordingStartedAt !== 'undefined') recordingStartedAt = null;
      if(typeof recordingStoppedAt !== 'undefined') recordingStoppedAt = null;
      if(typeof rideSamples !== 'undefined' && Array.isArray(rideSamples)) rideSamples.length = 0;
      if(typeof complianceSamples !== 'undefined' && Array.isArray(complianceSamples)) complianceSamples.length = 0;
      if(typeof skippedTimelineGaps !== 'undefined' && Array.isArray(skippedTimelineGaps)) skippedTimelineGaps.length = 0;

      // ERG / cue state.
      if(typeof lastAutoErgWatts !== 'undefined') lastAutoErgWatts = null;
      if(typeof lastAutoErgSentAt !== 'undefined') lastAutoErgSentAt = 0;
      if(typeof lastCue !== 'undefined') lastCue = '';
      if(typeof lastCountdownCue !== 'undefined') lastCountdownCue = '';
      if(typeof lastBlockStartCueIndex !== 'undefined') lastBlockStartCueIndex = -1;
      if(typeof lowCadenceAutoPauseSince !== 'undefined') lowCadenceAutoPauseSince = null;
      if(typeof noPowerAutoPauseSince !== 'undefined') noPowerAutoPauseSince = null;

      // Clear known intervals. Direct identifiers are used because these are legacy top-level lets.
      try{ if(typeof timer !== 'undefined'){ clearInterval(timer); timer = null; } }catch(e){}
      try{ if(typeof simTimer !== 'undefined'){ clearInterval(simTimer); simTimer = null; } }catch(e){}
      try{ if(typeof autoErgInterval !== 'undefined'){ clearInterval(autoErgInterval); autoErgInterval = null; } }catch(e){}
      try{ if(typeof autoStartMonitor !== 'undefined'){ clearInterval(autoStartMonitor); autoStartMonitor = null; } }catch(e){}
      try{ if(typeof recordInterval !== 'undefined'){ clearInterval(recordInterval); recordInterval = null; } }catch(e){}

      // Reset visible session UI only. Do not clear loadedName/workout here; the loader owns that.
      setWidth('progress', '0%');
      setText('elapsedText', '0:00');
      setText('totalText', '0:00');
      setText('intervalCountdownText', '0:00');
      setText('totalCountdownText', '0:00');
      setText('recordSamples', '0');
      setText('recordDuration', '0:00');
      setText('recordAvgPower', '--');
      setText('recordAvgHr', '--');
      setText('avgPowerMetric', 'Avg --w');
      setText('avgHrMetric', 'Avg -- bpm');
      setText('tssMetric', 'TSS 0');

      closeModal('workoutEndOverlay');
      closeModal('workoutEndModal');
      closeModal('stopConfirmOverlay');
      closeModal('stopConfirmModal');

      if(typeof updateRecordingUi === 'function') updateRecordingUi();
      if(typeof updateReadyUi === 'function') updateReadyUi();
      if(typeof updateTimelineOverlay === 'function') updateTimelineOverlay();
      if(typeof setControls === 'function') setControls();
      if(typeof drawGraph === 'function') drawGraph(0);
    }catch(err){
      console.warn('Veera session reset failed:', err);
    }
  }

  window.resetWorkoutSessionState = resetWorkoutSessionState;

  function wrapLoader(name){
    const original = window[name];
    if(typeof original !== 'function' || original.__veeraResetWrapped) return;

    const wrapped = function(){
      if(resetDepth === 0) resetWorkoutSessionState();
      resetDepth++;
      try{
        return original.apply(this, arguments);
      }finally{
        resetDepth = Math.max(0, resetDepth - 1);
      }
    };

    wrapped.__veeraResetWrapped = true;
    wrapped.__veeraOriginal = original;
    window[name] = wrapped;
  }

  // Active workout-loading entry points in main.js.
  wrapLoader('parseZwo');
  wrapLoader('loadSavedWorkout');
  wrapLoader('loadBuiltInFtpRampTest');
  wrapLoader('handleFile');
  wrapLoader('importAndSaveZwoFile');
})();
