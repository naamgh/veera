# Trainer App Spring Clean Plan

This document tracks the cleanup path for `/app` so we can reduce fragile override layers without breaking the live Trainer App.

## Current state

`/app/index.html` is now a lightweight loader. The UI is currently assembled from several scripts:

- `app-shell.js` — injects the main Trainer App layout.
- `app-modal-shell.js` — injects modal markup required by `main.js` event bindings.
- `main.js` — original app logic, rendering, trainer control, workout library and exports.
- `keyboard-guard.js` — blocks one duplicate legacy keyboard handler.
- `keyboard-shortcuts-fix.js` — reliable keyboard shortcut override.
- `timeline-controls-restore.js` — restores missing intensity/skip/extend controls.
- `trainer-visual-sound-fixes.js` — runtime visual/audio overrides.
- `share-card-strong.js` — stronger 3:2 Strava share-card export.
- `workout-reset.js` — hard-resets session state when loading new workouts.

This works, but it is messy because multiple files now patch or override behaviour after `main.js` loads.

## Redundant / risky code areas

### 1. Ride mode legacy code
Likely safe to remove once fullscreen/setup layout is confirmed stable:

- `body.ride-mode` CSS
- `ride-hero` styles
- `floating-exit`
- `enterRideMode()`
- `exitRideMode()`
- `toggleRideMode()`
- `updateRideModeButton()`
- visual viewport lock helpers that only apply to `ride-mode`

### 2. Keyboard shortcuts
Current issue:

- original keyboard handler still exists in `main.js`
- legacy duplicate keyboard handler still exists near the bottom of `main.js`
- `keyboard-guard.js` blocks one duplicate handler
- `keyboard-shortcuts-fix.js` adds final reliable behaviour

Cleanup target:

- move one clean shortcut handler into a future `keyboard.js`
- delete `keyboard-guard.js`
- delete `keyboard-shortcuts-fix.js`
- remove duplicate handlers from `main.js`

### 3. Timeline controls
Current issue:

- controls are created in shell markup
- moved/docked multiple times by legacy script blocks in `main.js`
- restored again by `timeline-controls-restore.js`

Cleanup target:

- keep one official timeline controls dock
- remove old docking scripts from `main.js`
- delete `timeline-controls-restore.js`

### 4. Visual/audio overrides
Current issue:

- `trainer-visual-sound-fixes.js` patches canvas/audio behaviour at runtime

Cleanup target:

- move dark trace colours, ticker-tail removal and louder audio values directly into official renderer/audio code
- delete `trainer-visual-sound-fixes.js`

### 5. Share card
Current issue:

- old share-card generator still exists in `main.js`
- stronger 3:2 version overrides it in `share-card-strong.js`

Cleanup target:

- make the stronger 3:2 share card the official generator
- delete old share-card function from `main.js`
- delete `share-card-strong.js`

### 6. Workout reset
Current issue:

- `workout-reset.js` wraps load functions to hard reset state

Cleanup target:

- create one official `resetWorkoutSessionState()` in core logic
- call it inside workout loading functions
- delete `workout-reset.js`

## Recommended cleanup order

1. Stabilise current app and confirm deploy works.
2. Move modal/shell injection back into stable static HTML or a single `ui-shell.js`.
3. Consolidate keyboard shortcuts.
4. Consolidate timeline controls.
5. Consolidate visual/audio fixes.
6. Consolidate share-card export.
7. Remove ride-mode legacy code.
8. Split `main.js` into proper modules.

## Target architecture

```text
/app
  index.html
  styles.css

  /core
    state.js
    app.js
    render.js
    keyboard.js
    audio.js

  /timeline
    timeline-renderer.js
    timeline-controls.js
    timeline-traces.js

  /trainer
    bluetooth.js
    erg.js
    sensors.js

  /workout
    parser.js
    library.js
    workout-state.js

  /ui
    shell.js
    modals.js
    theme.js
    share-card.js
```

## Cleanup rule

Make only one cleanup change at a time and verify:

- page loads
- buttons work
- keyboard shortcuts work
- workout library opens
- timeline renders
- share card exports
- workout loading resets session state
