(()=>{
  document.querySelector('main.app').innerHTML = document.querySelector('main.app').innerHTML.replace(`
        <div class="interval-edit-controls" id="intervalEditControls" aria-label="Interval controls">
          <div class="inline-intensity-control" aria-label="Intensity control">
            <label for="intensitySlider">Intensity</label>
            <input id="intensitySlider" type="range" min="50" max="150" value="100">
            <strong id="intensityValue" class="intensity-chip">100%</strong>
            <button id="intensityDownBtn" class="ghost icon-btn inline-intensity-btn" type="button" aria-label="Decrease intensity">−</button>
            <button id="intensityUpBtn" class="ghost icon-btn inline-intensity-btn" type="button" aria-label="Increase intensity">+</button>
          </div>
          <span class="interval-edit-divider inline-intensity-divider" aria-hidden="true"></span>
          <button id="skipIntervalBtn" class="ghost interval-edit-btn" type="button" disabled>Skip interval</button>
          <span class="interval-edit-divider" aria-hidden="true"></span>
          <button id="extendInterval1Btn" class="ghost interval-edit-btn" type="button" disabled>+1:00</button>
          <button id="extendInterval25Btn" class="ghost interval-edit-btn" type="button" disabled>+2:30</button>
          <button id="extendInterval5Btn" class="ghost interval-edit-btn" type="button" disabled>+5:00</button>
        </div>
`,`
        <div class="interval-edit-controls compact-command-strip" id="intervalEditControls" aria-label="Workout command strip">
          <div class="command-group intensity-command-group" aria-label="Intensity control">
            <button id="intensityDownBtn" class="ghost compact-pill-btn" type="button" aria-label="Decrease intensity">−</button>
            <strong id="intensityValue" class="intensity-chip compact-intensity-chip">100%</strong>
            <button id="intensityUpBtn" class="ghost compact-pill-btn" type="button" aria-label="Increase intensity">+</button>
          </div>

          <span class="command-divider" aria-hidden="true"></span>

          <div class="command-group">
            <button id="skipIntervalBtn" class="ghost compact-pill-btn" type="button" disabled>Skip Interval</button>
          </div>

          <span class="command-divider" aria-hidden="true"></span>

          <div class="command-group">
            <button id="extendInterval1Btn" class="ghost compact-pill-btn" type="button" disabled>+1 min</button>
            <button id="extendInterval5Btn" class="ghost compact-pill-btn" type="button" disabled>+5 min</button>
          </div>

          <span class="command-divider" aria-hidden="true"></span>

          <div class="command-group ride-command-group" aria-label="Ride controls">
            <button id="startBtn" class="ride-control-btn compact-pill-btn ride-control-ready" disabled>▶</button>
            <button class="ride-control-btn compact-pill-btn ride-control-pause" id="pauseBtn" disabled>❚❚</button>
            <button class="ride-control-btn compact-pill-btn ride-control-stop" id="resetBtn" disabled>■</button>
          </div>
        </div>
`);
})();