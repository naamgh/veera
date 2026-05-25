// Reset ride/session state whenever a new workout is loaded.
// This keeps old ride traces, timers, completion state and progress from bleeding into the next workout.
(function(){
  function safeCall(fn){
    try{ if(typeof fn === 'function') fn(); }catch(e){ console.warn(e); }
  }

  function setText(id, value){
    const el = document.getElementById(id);
    if(el) el.textContent = value;
  }

  function hardResetWorkoutSessionState(){
    try{
      // Stop active timers/monitors from the previous session.
      clearInterval(timer);
      clearInterval(autoErgInterval);
      clearInterval(autoStartMonitor);
      clearInterval(recordInterval);
      clearInterval(simTimer);

      // Reset ride/run state.
      startedAt = 0;
      elapsedBeforePause = 0;
      playing = false;
      recording = false;
      recordingStartedAt = null;
      recordingStoppedAt = null;
      readyToStart = false;
      workoutPaused = false;
      readyNeedsFreshPedal = false;
      readyPedalReleased = true;
      workoutCompleted = false;
      workoutEndReason = 'completed';
      stopConfirmOpen = false;

      // Reset workout-derived traces and summaries.
      rideSamples = [];
      complianceSamples = [];
      skippedTimelineGaps = [];
      lastCue = '';
      lastCountdownCue = '';
      lastBlockStartCueIndex = -1;
      lastAutoErgWatts = null;
      lastAutoErgSentAt = 0;

      // Reset on-screen session values but keep live connected device values.
      const progress = document.getElementById('progress');
      if(progress) progress.style.width = '0%';
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

      safeCall(closeWorkoutEndModal);
      safeCall(closeStopConfirmModal);
      safeCall(updateRecordingUi);
      safeCall(updateReadyUi);
      safeCall(updateTimelineOverlay);
      safeCall(setControls);
      safeCall(function(){ drawGraph(0); });
    }catch(err){
      console.warn('Workout session reset failed:', err);
    }
  }

  window.hardResetWorkoutSessionState = hardResetWorkoutSessionState;

  // Wrap normal ZWO loading.
  if(typeof parseZwo === 'function' && !parseZwo.__veeraResetWrapped){
    const originalParseZwo = parseZwo;
    parseZwo = function(){
      hardResetWorkoutSessionState();
      return originalParseZwo.apply(this, arguments);
    };
    parseZwo.__veeraResetWrapped = true;
  }

  // Wrap built-in FTP ramp loading.
  if(typeof loadBuiltInFtpRampTest === 'function' && !loadBuiltInFtpRampTest.__veeraResetWrapped){
    const originalRampTest = loadBuiltInFtpRampTest;
    loadBuiltInFtpRampTest = function(){
      hardResetWorkoutSessionState();
      return originalRampTest.apply(this, arguments);
    };
    loadBuiltInFtpRampTest.__veeraResetWrapped = true;
  }
})();
