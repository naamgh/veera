// ===== Script block 1 from original Trainer App =====
const $ = id => document.getElementById(id);

const HR_SERVICE = 0x180D;
const HR_MEASUREMENT = 0x2A37;
const FTMS_SERVICE = 0x1826;
const INDOOR_BIKE_DATA = 0x2AD2;
const FTMS_CONTROL_POINT = 0x2AD9;
const FTMS_FEATURE = 0x2ACC;

let workout = [];
let loadedName = "";
let loadedZwoText = "";
let startedAt = 0;
let elapsedBeforePause = 0;
let playing = false;
let timer = null;
let simTimer = null;
let simOn = false;
let currentPower = null;
let trainerService = null;
let ftmsControlPointChar = null;
let ftmsControlReady = false;
let bias = 1.0;
let ergReady = false;
let autoErg = true;
let lastAutoErgWatts = null;
let lastAutoErgSentAt = 0;
let autoErgInterval = null;
let recording = false;
let recordingStartedAt = null;
let recordingStoppedAt = null;
let rideSamples = [];
let recordInterval = null;
let readyToStart = false;
let workoutPaused = false;
let readyNeedsFreshPedal = false;
let readyPedalReleased = true;
let hrConnected = false;
let trainerConnected = false;
let autoStartMonitor = null;
let complianceSamples = [];
let lastCue = "";
let lastCountdownCue = "";
let lastBlockStartCueIndex = -1;
let audioCtx = null;
let workoutCompleted = false;
let workoutEndReason = "completed";
let activeWorkoutKind = "standard";
let rampTestConfig = null;
let stopConfirmOpen = false;

// Phase 13.30 Smart Auto-Pause
const SMART_AUTOPAUSE_CADENCE_THRESHOLD_RPM = 25;
const SMART_AUTOPAUSE_CADENCE_DELAY_MS = 5000;
const SMART_AUTOPAUSE_NO_POWER_DELAY_MS = 3000;
const SMART_AUTOPAUSE_TRANSITION_GRACE_SEC = 8;
const SMART_AUTOPAUSE_NO_POWER_WATTS = 5;
let lowCadenceAutoPauseSince = null;
let noPowerAutoPauseSince = null;



function applyTheme(theme){
  document.body.classList.toggle("dark", theme === "dark");
  try{ localStorage.setItem("indoorTrainerTheme", theme); }catch(e){}
  const toggle = $("darkModeToggle");
  if(toggle) toggle.checked = theme === "dark";
  render();
updateMetricConnectionCards();
}
function toggleDarkMode(){
  applyTheme($("darkModeToggle").checked ? "dark" : "light");
}
function initialiseTheme(){
  let saved = "light";
  try{ saved = localStorage.getItem("indoorTrainerTheme") || "light"; }catch(e){}
  applyTheme(saved);
}



function updateFocusToggle(){
  const btn = $("focusToggleBtn");
  if(!btn) return;
  const collapsed = document.body.classList.contains("sidebar-collapsed");
  const arrow = collapsed ? "›" : "‹";
  btn.innerHTML = `<span class="setup-arrow">${arrow}</span><span class="setup-label">SETUP</span>`;
  btn.title = collapsed ? "Show setup panel" : "Hide setup panel";
  render();
}

function hideSetupPanel(){
  if(!document.body.classList.contains("sidebar-collapsed")){
    toggleFocusPanel();
  }
}
function showSetupPanel(){
  if(document.body.classList.contains("sidebar-collapsed")){
    toggleFocusPanel();
  }
}
function toggleFocusPanel(){
  document.body.classList.add("setup-animating");
  document.body.classList.toggle("sidebar-collapsed");
  redrawGraphDuringLayoutAnimation();
  document.body.classList.remove("panel-peek");
  updateFocusToggle();
  setTimeout(()=>document.body.classList.remove("setup-animating"), 380);
}
function openSavedWorkouts(){
  $("savedWorkoutsModal").classList.add("open");
  $("savedWorkoutsOverlay").classList.add("open");
  renderWorkoutLibrary();
}
function closeSavedWorkouts(){
  $("savedWorkoutsModal").classList.remove("open");
  $("savedWorkoutsOverlay").classList.remove("open");
}


function supportsBluetooth(){ return !!navigator.bluetooth; }
function ftp(){ return Number($("ftpInput").value || 250); }
function escapeJs(str){
  return String(str || "").replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/\n/g," ").replace(/\r/g," ");
}
function formatTime(sec){
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec/3600);
  const m = Math.floor((sec%3600)/60);
  const s = sec%60;
  if(h>0) return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  return `${m}:${String(s).padStart(2,"0")}`;
}
function setStatus(prefix, state, text){
  let cls = "dot";
  if(state === "ok") cls += " ok";
  if(state === "bad") cls += " bad";
  if(state === "warn") cls += " warn";
  $(prefix+"Dot").className = cls;
  $(prefix+"Status").textContent = text;
}
function parseHeartRate(value){
  const flags = value.getUint8(0);
  const rate16 = flags & 0x1;
  return rate16 ? value.getUint16(1, true) : value.getUint8(1);
}

async function connectKnownHR(device){
  try{
    setStatus("hr", "warn", "Connecting to " + (device.name || "previous HR") + "...");
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(HR_SERVICE);
    const char = await service.getCharacteristic(HR_MEASUREMENT);
    await char.startNotifications();
    char.addEventListener("characteristicvaluechanged", e=>{
      hrConnected = true;
      $("hrVal").textContent = parseHeartRate(e.target.value);
      updateMetricConnectionCards();
    });
    hrConnected = true;
    setStatus("hr", "ok", device.name || "Heart-rate monitor connected");
    updateMetricConnectionCards();
    device.addEventListener("gattserverdisconnected", ()=>{
      hrConnected = false;
      setStatus("hr", "bad", "Disconnected");
      $("hrVal").textContent = "--";
      updateMetricConnectionCards();
    });
    return true;
  }catch(err){
    console.error(err);
    setStatus("hr", "bad", "HR connection failed");
    return false;
  }
}

async function connectHR(){
  hrConnected = false;
  if(!supportsBluetooth()){ alert("Web Bluetooth is not available in this browser."); return; }
  try{
    const device = await navigator.bluetooth.requestDevice({ filters:[{services:[HR_SERVICE]}] });
    await connectKnownHR(device);
  }catch(err){
    console.error(err);
    setStatus("hr", "bad", "Connection failed or cancelled");
  }
}

function parseIndoorBikeData(value){
  let offset = 0;
  const flags = value.getUint16(offset, true);
  offset += 2;
  let data = {};
  if(!(flags & 0x0001)){
    data.speed = value.getUint16(offset, true) / 100;
    offset += 2;
  }
  if(flags & 0x0002) offset += 2;
  if(flags & 0x0004){
    data.cadence = value.getUint16(offset, true) / 2;
    offset += 2;
  }
  if(flags & 0x0008) offset += 2;
  if(flags & 0x0010) offset += 3;
  if(flags & 0x0020) offset += 2;
  if(flags & 0x0040){
    data.power = value.getInt16(offset, true);
    offset += 2;
  }
  return data;
}


function logFtms(message){
  const el = $("ftmsLog");
  const stamp = new Date().toLocaleTimeString();
  el.textContent = `[${stamp}] ${message}\n` + el.textContent;
}
function setErgStatus(state, text){
  let cls = "dot";
  if(state === "ok") cls += " ok";
  if(state === "bad") cls += " bad";
  if(state === "warn") cls += " warn";
  $("ergDot").className = cls;
  $("ergStatus").textContent = text;
}
function enableErgButtons(enabled){
  $("ergOffBtn").disabled = !enabled;
}
function bytesHex(dataView){
  return Array.from({length:dataView.byteLength}, (_,i)=>dataView.getUint8(i).toString(16).padStart(2,"0")).join(" ");
}
function parseControlPointResponse(value){
  // FTMS indication format: 0x80, requestOpCode, resultCode
  const op = value.getUint8(0);
  const request = value.byteLength > 1 ? value.getUint8(1) : null;
  const result = value.byteLength > 2 ? value.getUint8(2) : null;
  const resultNames = {
    1:"Success",
    2:"Op Code Not Supported",
    3:"Invalid Parameter",
    4:"Operation Failed",
    5:"Control Not Permitted"
  };
  if(op === 0x80){
    const name = resultNames[result] || `Result ${result}`;
    logFtms(`Control Point response: request 0x${request.toString(16).padStart(2,"0")} — ${name}`);
    if(result === 1) setErgStatus("ok", "Last command accepted");
    else setErgStatus("bad", name);
  }else{
    logFtms("Control Point indication: " + bytesHex(value));
  }
}
async function writeFtmsCommand(bytes, label){
  if(!ftmsControlPointChar){
    setErgStatus("bad", "Control Point unavailable");
    logFtms("Cannot send " + label + ": no Control Point characteristic.");
    return false;
  }
  try{
    const data = new Uint8Array(bytes);
    await ftmsControlPointChar.writeValueWithResponse(data);
    logFtms("Sent " + label + ": " + Array.from(data).map(b=>b.toString(16).padStart(2,"0")).join(" "));
    setErgStatus("warn", "Waiting for trainer response...");
    return true;
  }catch(err){
    console.error(err);
    setErgStatus("bad", label + " failed");
    logFtms(label + " failed: " + err.message);
    return false;
  }
}
async function requestTrainerControl(){
  // FTMS Request Control opcode = 0x00
  await writeFtmsCommand([0x00], "Request Control");
}
async function startTrainerControl(){
  // FTMS Start or Resume opcode = 0x07
  await writeFtmsCommand([0x07], "Start/Resume");
}

async function autoSetupTrainerControl(){
  if(!ftmsControlPointChar) return;
  setErgStatus("warn", "Requesting trainer control...");
  logFtms("Auto setup: requesting trainer control.");
  await requestTrainerControl();
  await new Promise(resolve => setTimeout(resolve, 450));
  setErgStatus("warn", "Starting trainer control...");
  logFtms("Auto setup: starting trainer.");
  await startTrainerControl();
  await new Promise(resolve => setTimeout(resolve, 450));
  setErgStatus("ok", "Trainer ready — Auto ERG will control workout targets");
}
async function sendManualErgTarget(){
  // Manual ERG test input has been removed from the rider UI.
  return;
}

async function sendErgWatts(watts, label="Auto ERG"){
  watts = Math.max(50, Math.min(800, Math.round(watts)));
  const lo = watts & 0xff;
  const hi = (watts >> 8) & 0xff;
  return await writeFtmsCommand([0x05, lo, hi], `${label} ${watts}w`);
}
async function sendCurrentWorkoutTarget(){
  const target = targetAt(currentElapsed());
  if(!target){
    logFtms("No current workout target to send.");
    return;
  }
  await sendErgWatts(target.watts, "Current Target");
}
function updateAutoErgUi(){
  autoErg = true;
  $("autoErgBanner").className = "auto-erg-banner";
  $("autoErgBanner").textContent = "Auto ERG is always on during workouts.";
}
async function autoErgTick(){
  if(!autoErg || !playing || !workout.length) return;
  const target = targetAt(currentElapsed());
  if(!target) return;

  const now = Date.now();
  const watts = Math.round(target.watts);

  // Send when target changes meaningfully or at least every 5 seconds.
  const changed = lastAutoErgWatts === null || Math.abs(watts - lastAutoErgWatts) >= 3;
  const stale = now - lastAutoErgSentAt >= 5000;

  if(changed || stale){
    const ok = await sendErgWatts(watts, "Auto ERG Target");
    if(ok){
      lastAutoErgWatts = watts;
      lastAutoErgSentAt = now;
    }
  }
}
async function ergOffPause(){
  lastAutoErgWatts = null;
  // FTMS Stop or Pause opcode = 0x08, parameter 0x02 = pause.
  // Many trainers accept this as a safe way to release active control.
  await writeFtmsCommand([0x08, 0x02], "Stop/Pause");
  setErgStatus("warn", "Trainer paused — press Ready again to resume control");
}

async function connectKnownTrainer(device){
  try{
    setStatus("trainer", "warn", "Connecting to " + (device.name || "trainer") + "...");
    const server = await device.gatt.connect();
    trainerService = await server.getPrimaryService(FTMS_SERVICE);
    const service = trainerService;
    const char = await service.getCharacteristic(INDOOR_BIKE_DATA);
    await char.startNotifications();
    char.addEventListener("characteristicvaluechanged", e=>{
      const data = parseIndoorBikeData(e.target.value);
      if(Number.isFinite(data.power)){ trainerConnected = true; currentPower = Math.round(data.power); $("powerVal").textContent = currentPower; updateMetricConnectionCards(); updateMetricMotionStates(); }
      if(Number.isFinite(data.cadence)){ $("cadenceVal").textContent = Math.round(data.cadence); updateMetricMotionStates(); }
      if(Number.isFinite(data.speed)){ $("speedVal").textContent = data.speed.toFixed(1); updateMetricMotionStates(); }
      updateFeedback();
    });
    try{
      ftmsControlPointChar = await service.getCharacteristic(FTMS_CONTROL_POINT);
      await ftmsControlPointChar.startNotifications();
      ftmsControlPointChar.addEventListener("characteristicvaluechanged", e=>parseControlPointResponse(e.target.value));
      ftmsControlReady = true;
      enableErgButtons(true);
      setErgStatus("warn", "Control Point found — setting up trainer control...");
      logFtms("FTMS Control Point found. Auto setup starting.");
      autoSetupTrainerControl();
    }catch(cpErr){
      ftmsControlPointChar = null;
      ftmsControlReady = false;
      enableErgButtons(false);
      setErgStatus("bad", "No FTMS Control Point found");
      logFtms("Trainer connected, but Control Point was not found: " + cpErr.message);
    }
    setStatus("trainer", "ok", device.name || "Smart trainer connected");
    device.addEventListener("gattserverdisconnected", ()=>{
      ftmsControlPointChar = null;
      ftmsControlReady = false;
      updateAutoErgUi();
      enableErgButtons(false);
      setErgStatus("bad", "Trainer disconnected");
      setStatus("trainer", "bad", "Disconnected");
      trainerConnected = false;
      currentPower = null;
      $("powerVal").textContent = "--";
      $("cadenceVal").textContent = "--";
      $("speedVal").textContent = "--";
    });
    return true;
  }catch(err){
    console.error(err);
    setStatus("trainer", "bad", "Connection failed");
    return false;
  }
}

async function connectTrainer(){
  trainerConnected = false;
  if(!supportsBluetooth()){ alert("Web Bluetooth is not available in this browser."); return; }
  try{
    const device = await navigator.bluetooth.requestDevice({
      filters:[{services:[FTMS_SERVICE]}],
      optionalServices:[FTMS_SERVICE]
    });
    await connectKnownTrainer(device);
  }catch(err){
    console.error(err);
    setStatus("trainer", "bad", "Connection failed or cancelled");
  }
}

function loadDemo(){
  const demo = `<?xml version="1.0" encoding="UTF-8"?>
<workout_file>
  <name>Demo ZWO Workout</name>
  <sportType>bike</sportType>
  <workout>
    <Warmup Duration="300" PowerLow="0.45" PowerHigh="0.70"/>
    <SteadyState Duration="360" Power="0.78"/>
    <IntervalsT Repeat="4" OnDuration="60" OffDuration="60" OnPower="1.10" OffPower="0.55"/>
    <Cooldown Duration="300" PowerLow="0.65" PowerHigh="0.40"/>
  </workout>
</workout_file>`;
  parseZwo(demo, "Demo ZWO Workout");
}
function getAttr(node, name, fallback=null){
  const v = node.getAttribute(name);
  return v === null ? fallback : v;
}


function rampStepWattsForFtp(baseFtp){
  if(baseFtp < 180) return 15;
  if(baseFtp > 320) return 25;
  return 20;
}
function rampStartWattsForFtp(baseFtp){
  return Math.max(50, Math.round((baseFtp * 0.46) / 5) * 5);
}
function loadBuiltInFtpRampTest(){
  const baseFtp = ftp();
  const step = rampStepWattsForFtp(baseFtp);
  const start = rampStartWattsForFtp(baseFtp);
  const maxWatts = Math.max(start + step * 24, Math.round(baseFtp * 1.85));
  const blocks = [
    {type:"Warmup", duration:300, low:0.45, high:0.65, source:"RampWarmup"},
    {type:"Recovery", duration:120, power:0.50, source:"RampWarmup"}
  ];
  let watts = start;
  let stepIndex = 1;
  while(watts <= maxWatts){
    blocks.push({
      type:`Ramp ${watts}w`,
      duration:60,
      power:watts / baseFtp,
      source:"FtpRampTest",
      rampTestStep:true,
      rampStepIndex:stepIndex,
      rampStepWatts:watts
    });
    watts += step;
    stepIndex++;
  }
  workoutCompleted = false;
  workoutEndReason = "completed";
  closeWorkoutEndModal();
  closeStopConfirmModal();
  workoutPaused = false;
  activeWorkoutKind = "ftpRampTest";
  rampTestConfig = {baseFtp, step, start};
  loadedName = "FTP Ramp Test";
  loadedZwoText = "__BUILT_IN_FTP_RAMP_TEST__";
  workout = blocks;
  skippedTimelineGaps = [];
  elapsedBeforePause = 0;
  playing = false;
  readyToStart = false;
  clearInterval(autoStartMonitor);
  lastCue = "";
  lastCountdownCue = "";
  lastBlockStartCueIndex = -1;
  $("zwoStatus").textContent = `FTP Ramp Test loaded • starts ${start}w • +${step}w/min`;
  $("zwoDot").className = "dot ok";
  $("libraryCategory").value = "Tests";
  $("libraryLabels").value = "ftp, ramp test";
  updateReadyUi();
  updateMetricConnectionCards();
  setControls();
  renderWorkoutLibrary();
  render();
  closeSavedWorkouts();
}
function completedRampStepWatts(elapsed=currentElapsed()){
  if(activeWorkoutKind !== "ftpRampTest") return null;
  let t = 0;
  let best = null;
  for(const b of workout){
    const start = t;
    const end = t + (b.duration || 0);
    if(b.rampTestStep && elapsed >= end){
      best = b.rampStepWatts || Math.round((b.power || 0) * (rampTestConfig?.baseFtp || ftp()));
    }
    t = end;
  }
  return best;
}
function achievedRampFtp(elapsed=currentElapsed()){
  const best = completedRampStepWatts(elapsed);
  return best ? Math.round(best * 0.75) : null;
}
function updateFtpFromRampTest(){
  const estimate = achievedRampFtp(currentElapsed()) || achievedRampFtp(totalDuration());
  if(!estimate){ alert("No completed ramp step was recorded yet."); return; }
  const input = $("ftpInput");
  if(input) input.value = estimate;
  closeWorkoutEndModal();
  render();
  alert(`FTP updated to ${estimate}w.`);
}
function keepCurrentFtpFromRampTest(){
  closeWorkoutEndModal();
}

function startRampCooldownAfterFailure(){
  if(activeWorkoutKind !== "ftpRampTest" || !workout.length) return false;
  if(rampTestConfig && rampTestConfig.cooldownStarted) return false;
  const elapsed = Math.max(0, Math.min(currentElapsed(), totalDuration()));
  const hit = blockAt(elapsed);
  if(!hit || !hit.block || !hit.block.rampTestStep) return false;

  const trimmedDuration = Math.max(1, elapsed - hit.start);
  workout[hit.index].duration = trimmedDuration;
  workout = workout.slice(0, hit.index + 1);
  workout.push({
    type:"Cooldown",
    duration:300,
    power:0.40,
    source:"RampCooldown",
    rampCooldown:true
  });

  rampTestConfig = Object.assign({}, rampTestConfig || {}, {cooldownStarted:true, failedAt:elapsed});
  elapsedBeforePause = elapsed;
  playing = false;
  workoutPaused = false;
  readyToStart = false;
  workoutCompleted = false;
  lastAutoErgWatts = null;
  lastCountdownCue = "";
  lastBlockStartCueIndex = -1;
  clearInterval(timer);
  clearInterval(autoErgInterval);
  clearInterval(autoStartMonitor);
  closeStopConfirmModal();
  armReadyStart({freshPedal:true});
  render();
  setControls();
  return true;
}

function parseZwo(xmlText, fallbackName="Loaded Workout"){
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const parserError = doc.querySelector("parsererror");
  if(parserError){ alert("Could not read this ZWO file."); return; }

  workoutCompleted = false;
  workoutEndReason = "completed";
  closeWorkoutEndModal();
  closeStopConfirmModal();
  workoutPaused = false;
  loadedZwoText = xmlText;
  loadedName = fallbackName || doc.querySelector("name")?.textContent?.trim() || "Workout";
  activeWorkoutKind = "standard";
  rampTestConfig = null;
  const nodes = Array.from(doc.querySelectorAll("workout > *"));
  const blocks = [];

  nodes.forEach(n=>{
    const tag = n.tagName;
    if(tag === "Warmup" || tag === "Cooldown"){
      blocks.push({
        type: tag,
        duration: Number(getAttr(n,"Duration",0)),
        low: Number(getAttr(n,"PowerLow",0.5)),
        high: Number(getAttr(n,"PowerHigh",0.7)),
        source: tag
      });
    }else if(tag === "SteadyState" || tag === "FreeRide"){
      blocks.push({
        type: tag,
        duration: Number(getAttr(n,"Duration",0)),
        power: Number(getAttr(n,"Power",0.6)),
        source: tag
      });
    }else if(tag === "IntervalsT"){
      const repeat = Number(getAttr(n,"Repeat",1));
      const onDur = Number(getAttr(n,"OnDuration",0));
      const offDur = Number(getAttr(n,"OffDuration",0));
      for(let i=0;i<repeat;i++){
        blocks.push({type:`Interval ${i+1} On`, duration:onDur, power:Number(getAttr(n,"OnPower",1.0)), source:"IntervalsT"});
        blocks.push({type:`Interval ${i+1} Off`, duration:offDur, power:Number(getAttr(n,"OffPower",0.5)), source:"IntervalsT"});
      }
    }
  });

  workout = blocks.filter(b => b.duration > 0);
  skippedTimelineGaps = [];
  $("zwoStatus").textContent = loadedName + " loaded";
  $("zwoDot").className = "dot ok";
  elapsedBeforePause = 0;
  playing = false;
  readyToStart = false;
  clearInterval(autoStartMonitor);
  lastCue = "";
  lastCountdownCue = "";
  lastBlockStartCueIndex = -1;
  updateReadyUi();
updateMetricConnectionCards();
  setControls();
  renderWorkoutLibrary();
  render();
}

function totalDuration(){ return workout.reduce((s,b)=>s+b.duration,0); }
function currentElapsed(){
  return playing ? (Date.now()-startedAt)/1000 + elapsedBeforePause : elapsedBeforePause;
}
function blockAt(seconds){
  let t = 0;
  for(let i=0;i<workout.length;i++){
    const b = workout[i];
    if(seconds >= t && seconds < t + b.duration){
      return {block:b, index:i, start:t, end:t+b.duration};
    }
    t += b.duration;
  }
  return null;
}
function targetAt(seconds){
  const hit = blockAt(seconds);
  if(!hit) return null;
  const {block:b,start,end,index} = hit;
  const local = seconds - start;
  let pct = b.power;
  if(b.low !== undefined && b.high !== undefined){
    const p = Math.max(0, Math.min(1, local / b.duration));
    pct = b.low + (b.high-b.low)*p;
  }
  pct *= bias;
  return {block:b, index, pct, watts: Math.round(pct * ftp()), start, end};
}
function nextBlock(index){
  return workout[index+1] || null;
}

function getRideSummary(){
  const avgP = average(rideSamples.map(s=>s.power));
  const avgHr = average(rideSamples.map(s=>s.heartRate));
  const avgCad = average(rideSamples.map(s=>s.cadence));
  const maxP = Math.max(...rideSamples.map(s=>s.power).filter(v=>Number.isFinite(v)), 0);
  const maxHr = Math.max(...rideSamples.map(s=>s.heartRate).filter(v=>Number.isFinite(v)), 0);
  const tss = calculateEstimatedTss ? calculateEstimatedTss() : 0;
  const np = calculateNotionalPower ? calculateNotionalPower() : (Number.isFinite(avgP) ? Math.round(avgP) : null);
  const duration = recordingDurationSec ? recordingDurationSec() : Math.round(totalDuration());
  return {
    avgPower: Number.isFinite(avgP) ? Math.round(avgP) : null,
    avgHr: Number.isFinite(avgHr) ? Math.round(avgHr) : null,
    avgCadence: Number.isFinite(avgCad) ? Math.round(avgCad) : null,
    maxPower: maxP || null,
    maxHr: maxHr || null,
    np,
    tss,
    duration
  };
}
function clearLoadedWorkout(){
  readyToStart = false;
  workoutCompleted = false;
  workoutEndReason = "completed";
  closeWorkoutEndModal();
  closeStopConfirmModal();
  workoutPaused = false;
  clearInterval(autoStartMonitor);
  clearInterval(timer);
  clearInterval(autoErgInterval);
  if(recording) stopRecording();
  resetRecording();

  playing = false;
  elapsedBeforePause = 0;
  workout = [];
  skippedTimelineGaps = [];
  loadedName = "";
  loadedZwoText = "";
  activeWorkoutKind = "standard";
  rampTestConfig = null;
  lastAutoErgWatts = null;
  lastAutoErgSentAt = 0;
  lastCue = "";
  lastCountdownCue = "";
  lastBlockStartCueIndex = -1;

  const zwoInput = $("zwoInput");
  if(zwoInput) zwoInput.value = "";

  $("zwoStatus").textContent = "No workout loaded";
  $("zwoDot").className = "dot";
  $("progress").style.width = "0%";
  $("elapsedText").textContent = "0:00";
  $("totalText").textContent = "0:00";
  updateCountdownTimers(0);
  $("targetPower").textContent = "--";
  $("intervalText").textContent = "Load a workout to begin.";
  $("currentName").textContent = "--";
  $("remainingText").textContent = "--";
  $("nextName").textContent = "--";
  $("rideTargetPower").textContent = "--";
  $("rideBlockTitle").textContent = "Load a workout";
  $("rideSubText").textContent = "Connect trainer, import ZWO, press Ready, then pedal.";
  $("blocksTitle").textContent = "Blocks";
  if($("blockList")) $("blockList").innerHTML = "";
  $("recordSamples").textContent = "0";
  $("recordDuration").textContent = "0:00";
  $("recordAvgPower").textContent = "--";
  $("recordAvgHr").textContent = "--";
  if($("avgPowerMetric")) $("avgPowerMetric").textContent = "Avg --w";
  if($("avgHrMetric")) $("avgHrMetric").textContent = "Avg -- bpm";
  if($("tssMetric")) $("tssMetric").textContent = "TSS 0";

  bindSetupRedrawFallback();
setupGraphResizeRedraw();
drawGraph(0);
  setControls();
  updateReadyUi();
  renderWorkoutLibrary();
}
function drawGraph(elapsed=0){
  const canvas = $("graph");
  const ctx = canvas.getContext("2d");

  // Keep canvas text and line work at native CSS size instead of stretching a fixed 1200px bitmap.
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(320, Math.round(rect.width || canvas.clientWidth || 1200));
  const cssH = Math.max(220, Math.round(rect.height || canvas.clientHeight || 420));
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const targetW = Math.round(cssW * dpr);
  const targetH = Math.round(cssH * dpr);
  if(canvas.width !== targetW || canvas.height !== targetH){
    canvas.width = targetW;
    canvas.height = targetH;
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);

  const w = cssW, h = cssH;
  ctx.clearRect(0,0,w,h);

  const leftPad = 56;
  const rightPad = 34;
  const topPad = 42;
  const bottomPad = 52;
  const plotW = w - leftPad - rightPad;
  const plotH = h - topPad - bottomPad;

  const total = Math.max(1,totalDuration());
  const ftpVal = ftp();
  const dark = document.body.classList.contains("dark");
  const nowMs = performance.now ? performance.now() : Date.now();

  const hardestWorkoutWatts = Math.max(
    100,
    ...workout.map(b => Math.max(b.power || 0, b.low || 0, b.high || 0) * bias * ftpVal)
  );
  const maxWatts = Math.ceil((hardestWorkoutWatts + 50) / 25) * 25;

  function xFor(sec){ return leftPad + (sec / total) * plotW; }
  function yForWatts(watts){ return topPad + plotH - (watts / maxWatts) * plotH; }
  function crossesSkippedGap(a, b){
    if(!skippedTimelineGaps || !skippedTimelineGaps.length) return false;
    const lo = Math.min(a || 0, b || 0);
    const hi = Math.max(a || 0, b || 0);
    return skippedTimelineGaps.some(g => hi > g.start && lo < g.end);
  }
  function drawSkippedVoids(){
    if(!skippedTimelineGaps || !skippedTimelineGaps.length) return;
    ctx.save();
    roundedRect(leftPad, topPad, plotW, plotH, 24);
    ctx.clip();
    skippedTimelineGaps.forEach((gap)=>{
      const start = Math.max(0, Math.min(total, gap.start || 0));
      const end = Math.max(0, Math.min(total, gap.end || 0));
      if(end <= start) return;
      const x1 = xFor(start);
      const x2 = xFor(end);
      const gw = Math.max(8, x2 - x1);
      const gx = x1;
      const mid = x1 + (x2 - x1) / 2;

      const grad = ctx.createLinearGradient(gx, 0, gx + gw, 0);
      grad.addColorStop(0, dark ? 'rgba(15,23,42,0)' : 'rgba(255,255,255,0)');
      grad.addColorStop(.18, dark ? 'rgba(15,23,42,.82)' : 'rgba(255,255,255,.86)');
      grad.addColorStop(.82, dark ? 'rgba(15,23,42,.82)' : 'rgba(255,255,255,.86)');
      grad.addColorStop(1, dark ? 'rgba(15,23,42,0)' : 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(gx - 2, topPad, gw + 4, plotH);

      ctx.save();
      ctx.setLineDash([4, 7]);
      ctx.strokeStyle = dark ? 'rgba(203,213,225,.26)' : 'rgba(100,116,139,.22)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(mid, topPad + 10);
      ctx.lineTo(mid, topPad + plotH - 10);
      ctx.stroke();
      ctx.restore();

      const label = 'Skipped';
      ctx.font = "900 10px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const labelW = Math.max(54, ctx.measureText(label).width + 18);
      const lx = Math.max(leftPad + labelW/2 + 2, Math.min(w - rightPad - labelW/2 - 2, mid));
      const ly = topPad + 22;
      roundedRect(lx - labelW/2, ly - 12, labelW, 24, 999);
      ctx.fillStyle = dark ? 'rgba(15,23,42,.62)' : 'rgba(248,250,252,.78)';
      ctx.fill();
      ctx.strokeStyle = dark ? 'rgba(203,213,225,.14)' : 'rgba(148,163,184,.22)';
      ctx.stroke();
      ctx.fillStyle = dark ? 'rgba(203,213,225,.64)' : 'rgba(71,85,105,.62)';
      ctx.fillText(label, lx, ly + .5);
    });
    ctx.restore();
  }
  function roundedRect(x,y,width,height,r){
    const rr = Math.min(r, width/2, height/2);
    ctx.beginPath();
    ctx.moveTo(x+rr,y);
    ctx.lineTo(x+width-rr,y);
    ctx.quadraticCurveTo(x+width,y,x+width,y+rr);
    ctx.lineTo(x+width,y+height-rr);
    ctx.quadraticCurveTo(x+width,y+height,x+width-rr,y+height);
    ctx.lineTo(x+rr,y+height);
    ctx.quadraticCurveTo(x,y+height,x,y+height-rr);
    ctx.lineTo(x,y+rr);
    ctx.quadraticCurveTo(x,y,x+rr,y);
    ctx.closePath();
  }

  // Open, low-cardness graph surface. No inner border.
  const surface = ctx.createLinearGradient(0, topPad, 0, topPad + plotH);
  surface.addColorStop(0, dark ? "rgba(15,23,42,.22)" : "rgba(255,255,255,.42)");
  surface.addColorStop(1, dark ? "rgba(2,6,23,.08)" : "rgba(248,250,252,.14)");
  ctx.save();
  roundedRect(leftPad, topPad, plotW, plotH, 24);
  ctx.fillStyle = surface;
  ctx.fill();
  ctx.restore();

  // Watt guides only. Vertical grid lines intentionally removed.
  ctx.font = "900 11px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const step = maxWatts <= 250 ? 50 : maxWatts <= 450 ? 75 : 100;
  for(let watts=0; watts<=maxWatts; watts+=step){
    const y = yForWatts(watts);
    ctx.strokeStyle = dark ? "rgba(148,163,184,.10)" : "rgba(148,163,184,.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftPad, y);
    ctx.lineTo(w - rightPad, y);
    ctx.stroke();
    ctx.fillStyle = dark ? "rgba(203,213,225,.58)" : "rgba(71,85,105,.58)";
    ctx.fillText(watts, leftPad - 8, y);
  }

  // Build exact stepped target points and blocks.
  const blocks = [];
  let t = 0;
  workout.forEach((b)=>{
    const p1 = (b.low !== undefined ? b.low : b.power) * bias;
    const p2 = (b.high !== undefined ? b.high : b.power) * bias;
    const w1 = p1 * ftpVal;
    const w2 = p2 * ftpVal;
const visualShiftSec = 1;

blocks.push({
  start:t,
  end:t + b.duration,
  x1:xFor(Math.min(total, t + visualShiftSec)),
  x2:xFor(Math.min(total, t + b.duration + visualShiftSec)),
      y1:yForWatts(w1),
      y2:yForWatts(w2),
      w1,w2,
      avg:(w1+w2)/2,
      active: elapsed >= t && elapsed < t+b.duration,
      complete: t+b.duration < elapsed
    });
    t += b.duration;
  });

  const baseY = topPad + plotH;

  // Rounded interval blocks, with a subtle temporal lift on the active block.
  if(blocks.length){
    const blockGap = 6;
    const blockRadius = 14;
    function zoneColor(avgWatts){
      const pct = avgWatts / Math.max(1, ftpVal * bias);
      if(pct < .56) return dark ? "#93c5fd" : "#bfdbfe";
      if(pct < .76) return dark ? "#7dd3fc" : "#bae6fd";
      if(pct < .91) return dark ? "#c4b5fd" : "#ddd6fe";
      if(pct < 1.06) return dark ? "#a78bfa" : "#c4b5fd";
      if(pct < 1.21) return dark ? "#f9a8d4" : "#fbcfe8";
      return dark ? "#fca5a5" : "#fecdd3";
    }

    ctx.save();
    roundedRect(leftPad, topPad, plotW, plotH, 24);
    ctx.clip();

    blocks.forEach((b)=>{
      const x1 = b.x1 + blockGap / 2;
      const x2 = b.x2 - blockGap / 2;
      const width = Math.max(4, x2 - x1);
      const y1 = yForWatts(Math.max(0, b.w1 || 0));
      const y2 = yForWatts(Math.max(0, b.w2 || 0));
      const color = zoneColor(b.avg || 0);
      const isRamp = Math.abs(y1 - y2) > 1.5;
      const pulse = b.active ? .04 + Math.sin(nowMs / 620) * .025 : 0;

      ctx.save();
      ctx.globalAlpha = b.complete ? .38 : (b.active ? .98 : .86);
      ctx.fillStyle = color;
      if(b.active){
        ctx.shadowColor = dark ? "rgba(186,230,253,.18)" : "rgba(125,211,252,.18)";
        ctx.shadowBlur = 14 + pulse * 80;
        ctx.shadowOffsetY = -2;
      }

      if(!isRamp){
        const y = Math.min(y1, y2) - (b.active ? 2 : 0);
        const height = Math.max(12, baseY - y);
        roundedRect(x1, y, width, height, Math.min(blockRadius, width / 2, height / 2));
        ctx.fill();
      }else{
        ctx.beginPath();
        ctx.moveTo(x1, baseY);
        ctx.lineTo(x1, y1 - (b.active ? 2 : 0));
        ctx.lineTo(x2, y2 - (b.active ? 2 : 0));
        ctx.lineTo(x2, baseY);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      if(b.active){
        // A restrained moving highlight gives the active interval subtle forward momentum.
        const progress = Math.max(0, Math.min(1, (elapsed - b.start) / Math.max(1, b.end - b.start)));
        const hx = x1 + width * progress;
        const grad = ctx.createLinearGradient(hx - 80, 0, hx + 40, 0);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(.58, dark ? "rgba(255,255,255,.11)" : "rgba(255,255,255,.22)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.save();
        roundedRect(x1, topPad, width, plotH, 16);
        ctx.clip();
        ctx.fillStyle = grad;
        ctx.fillRect(hx - 90, topPad, 140, plotH);
        ctx.restore();
      }
    });
    ctx.restore();
  }

  // Skipped interval sections are intentionally blanked, so jumps never draw as fake diagonal work.
  drawSkippedVoids();

  // Time axis: four quarter labels only. No vertical grid lines.
  ctx.font = "900 11px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  [0.25, 0.5, 0.75, 1].forEach((ratio)=>{
    const sec = total * ratio;
    const x = xFor(sec);
    ctx.fillStyle = dark ? "rgba(203,213,225,.62)" : "rgba(71,85,105,.62)";
    ctx.fillText(formatTime(sec), x, topPad + plotH + 16);
  });

  // Actual live power trace. This is rider output, not the expected target line.
  const powerSamples = rideSamples.filter(s => Number.isFinite(s.power) && Number.isFinite(s.elapsedWorkoutSec));
  if(powerSamples.length >= 2){
    const pPoints = powerSamples.map(s => {
      const t = Math.min(total, s.elapsedWorkoutSec);
      return {
        t,
        x: xFor(t),
        y: yForWatts(Math.max(0, Math.min(maxWatts, s.power)))
      };
    });
    ctx.save();
    ctx.strokeStyle = dark ? "rgba(216,180,254,.92)" : "rgba(139,92,246,.82)";
    ctx.lineWidth = 2.6;
    ctx.shadowColor = dark ? "rgba(192,132,252,.36)" : "rgba(167,139,250,.26)";
    ctx.shadowBlur = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    pPoints.forEach((p, i)=>{
      if(i===0) ctx.moveTo(p.x,p.y);
      else{
        const prev = pPoints[i-1];
        if(crossesSkippedGap(prev.t, p.t)){
          ctx.moveTo(p.x,p.y);
        }else{
          const cx = (prev.x+p.x)/2;
          ctx.quadraticCurveTo(prev.x,prev.y,cx,(prev.y+p.y)/2);
        }
      }
    });
    const lastP = pPoints[pPoints.length-1];
    ctx.lineTo(lastP.x,lastP.y);
    ctx.stroke();
    ctx.restore();
  }

  // Cadence trace, scaled to the same numeric axis as power.
  const cadenceSamples = rideSamples.filter(s => Number.isFinite(s.cadence) && Number.isFinite(s.elapsedWorkoutSec));
  if(cadenceSamples.length >= 2){
    const cPoints = cadenceSamples.map(s => {
      const t = Math.min(total, s.elapsedWorkoutSec);
      return {
        t,
        x: xFor(t),
        y: yForWatts(Math.max(0, Math.min(maxWatts, s.cadence)))
      };
    });
    ctx.save();
    ctx.strokeStyle = dark ? "rgba(186,230,253,.78)" : "rgba(14,165,233,.54)";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    cPoints.forEach((p, i)=>{
      if(i===0) ctx.moveTo(p.x,p.y);
      else{
        const prev = cPoints[i-1];
        if(crossesSkippedGap(prev.t, p.t)){
          ctx.moveTo(p.x,p.y);
        }else{
          const cx = (prev.x+p.x)/2;
          ctx.quadraticCurveTo(prev.x,prev.y,cx,(prev.y+p.y)/2);
        }
      }
    });
    const lastC = cPoints[cPoints.length-1];
    ctx.lineTo(lastC.x,lastC.y);
    ctx.stroke();
    ctx.restore();
  }

  // HR trace, scaled to the same numeric watt axis shown on the left.
  const hrSamples = rideSamples.filter(s => Number.isFinite(s.heartRate) && Number.isFinite(s.elapsedWorkoutSec));
  if(hrSamples.length >= 2){
    const hPoints = hrSamples.map(s => {
      const t = Math.min(total, s.elapsedWorkoutSec);
      return {
        t,
        x:xFor(t),
        y:yForWatts(Math.max(0, Math.min(maxWatts, s.heartRate)))
      };
    });
    ctx.save();
    ctx.strokeStyle = dark ? "rgba(249,168,212,.78)" : "rgba(190,24,93,.58)";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    hPoints.forEach((p,i)=>{
      if(i===0) ctx.moveTo(p.x,p.y);
      else{
        const prev = hPoints[i-1];
        if(crossesSkippedGap(prev.t, p.t)){
          ctx.moveTo(p.x,p.y);
        }else{
          const cx = (prev.x+p.x)/2;
          ctx.quadraticCurveTo(prev.x,prev.y,cx,(prev.y+p.y)/2);
        }
      }
    });
    const lastH = hPoints[hPoints.length-1];
    ctx.lineTo(lastH.x,lastH.y);
    ctx.stroke();
    ctx.restore();
  }

  // Current time marker with a soft temporal tail.
  const px = Math.min(w - rightPad, xFor(elapsed));
  ctx.save();
  const tailGrad = ctx.createLinearGradient(px - 92, 0, px, 0);
  tailGrad.addColorStop(0, "rgba(125,211,252,0)");
  tailGrad.addColorStop(1, dark ? "rgba(186,230,253,.13)" : "rgba(14,165,233,.12)");
  ctx.fillStyle = tailGrad;
  ctx.fillRect(Math.max(leftPad, px - 92), topPad, Math.max(0, px - Math.max(leftPad, px - 92)), plotH);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = dark ? "rgba(186,230,253,.84)" : "rgba(14,165,233,.76)";
  ctx.lineWidth = 2;
  ctx.shadowColor = dark ? "rgba(125,211,252,.26)" : "rgba(125,211,252,.22)";
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(px, topPad - 4);
  ctx.lineTo(px, topPad + plotH + 4);
  ctx.stroke();
  ctx.fillStyle = dark ? "rgba(186,230,253,.88)" : "rgba(14,165,233,.78)";
  ctx.beginPath();
  ctx.arc(px, topPad - 6, 3.5, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();

  if(workout.length){
    const blockInfo = getCurrentBlockInfo(elapsed);
    const countdown = formatTime(Math.max(0, Math.round(blockInfo.remaining || 0)));
    ctx.save();
    ctx.font = "820 22px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labelW = Math.max(68, ctx.measureText(countdown).width + 28);
    const labelH = 38;
    const labelX = Math.max(leftPad + labelW/2, Math.min(w - rightPad - labelW/2, px));

    let traceWatts = Number.isFinite(currentPower) ? currentPower : null;
    if(powerSamples.length){
      const nearest = powerSamples.reduce((best, sample)=>{
        const d = Math.abs((sample.elapsedWorkoutSec || 0) - elapsed);
        return !best || d < best.d ? {sample, d} : best;
      }, null);
      if(nearest && Number.isFinite(nearest.sample.power)) traceWatts = nearest.sample.power;
    }
    if(!Number.isFinite(traceWatts)){
      const target = targetAt(elapsed);
      traceWatts = target && Number.isFinite(target.watts) ? target.watts : maxWatts * .72;
    }
    const traceY = yForWatts(Math.max(0, Math.min(maxWatts, traceWatts)));
    const labelY = Math.max(topPad + labelH/2 + 6, Math.min(topPad + plotH - labelH/2 - 6, traceY - 30));

    roundedRect(labelX - labelW/2, labelY - labelH/2, labelW, labelH, 999);
    ctx.fillStyle = dark ? "rgba(15,23,42,.52)" : "rgba(255,255,255,.58)";
    ctx.fill();
    ctx.strokeStyle = dark ? "rgba(186,230,253,.16)" : "rgba(14,165,233,.10)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = dark ? "rgba(224,242,254,.90)" : "rgba(3,105,161,.82)";
    ctx.fillText(countdown, labelX, labelY + 1);
    ctx.restore();
  }

}



function bindSetupRedrawFallback(){
  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('.focus-toggle, [data-action="toggle-setup"], #focusToggle, #setupToggle');
    if(btn) redrawGraphDuringLayoutAnimation();
  });
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'ArrowLeft' || e.key === 'ArrowRight'){
      redrawGraphDuringLayoutAnimation();
    }
  });
}

function setupGraphResizeRedraw(){
  const graph = $("graph");
  if(!graph || !window.ResizeObserver) return;
  const observer = new ResizeObserver(()=>{
    redrawGraphDuringLayoutAnimation(180);
  });
  observer.observe(graph);
  if(graph.parentElement) observer.observe(graph.parentElement);
}

function redrawGraphDuringLayoutAnimation(duration = 460){
  clearTimeout(window.__graphResizeTimer);

  window.__graphResizeTimer = setTimeout(()=>{
    drawGraph(currentElapsed());
  }, duration + 20);
}

function updateFeedback(){
  const target = targetAt(currentElapsed());
  if(!target || currentPower === null){
    $("feedbackTitle").textContent = "Actual vs Target";
    $("feedbackText").textContent = "Connect trainer or use simulate mode.";
    return;
  }
  const diff = currentPower - target.watts;
  const abs = Math.abs(diff);
  if(abs <= 10){
    $("feedbackTitle").textContent = "On Target";
    $("feedbackText").textContent = `${currentPower}w actual / ${target.watts}w target`;
  }else if(diff > 0){
    $("feedbackTitle").textContent = `${abs}w Over`;
    $("feedbackText").textContent = `${currentPower}w actual / ${target.watts}w target`;
  }else{
    $("feedbackTitle").textContent = `${abs}w Under`;
    $("feedbackText").textContent = `${currentPower}w actual / ${target.watts}w target`;
  }
}

function getCurrentBlockInfo(elapsed){
  if(!workout.length) return {index:-1, start:0, end:0, remaining:0};
  let t = 0;
  for(let i=0;i<workout.length;i++){
    const b = workout[i];
    const end = t + b.duration;
    if(elapsed < end){
      return {index:i, start:t, end, remaining:Math.max(0, end-elapsed)};
    }
    t = end;
  }
  return {index:workout.length-1, start:totalDuration(), end:totalDuration(), remaining:0};
}


function rideCompliancePercent(){
  if(!complianceSamples.length) return null;
  const score = complianceSamples.reduce((a,b)=>a+b,0) / complianceSamples.length;
  return Math.round(score * 100);
}
function timelinePreviewDataUrl(elapsedOverride=null){
  const canvas = $("graph");
  if(!canvas) return "";
  const elapsed = elapsedOverride === null ? currentElapsed() : elapsedOverride;
  drawGraph(elapsed);
  return canvas.toDataURL("image/png");
}

function canvasRoundRect(ctx, x, y, w, h, r){
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function workoutShareImageDataUrl(reason="completed"){
  const W = 1600;
  const H = 960;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const summary = getRideSummary();
  const duration = summary.duration || Math.round(currentElapsed()) || totalDuration();
  const total = Math.max(1, totalDuration() || duration || 1);

  const bg = ctx.createLinearGradient(0,0,W,H);
  bg.addColorStop(0,"#f8fbff");
  bg.addColorStop(0.52,"#f5f3ff");
  bg.addColorStop(1,"#ffffff");
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,W,H);

  // Large soft gradient mesh background, replacing obvious circular blobs.
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.filter = "blur(72px)";
  const meshA = ctx.createRadialGradient(120, 40, 80, 420, 210, 760);
  meshA.addColorStop(0, "rgba(125,211,252,.38)");
  meshA.addColorStop(.55, "rgba(186,230,253,.18)");
  meshA.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = meshA;
  ctx.fillRect(-160, -160, W + 320, H + 320);

  const meshB = ctx.createRadialGradient(1500, 80, 120, 1110, 310, 780);
  meshB.addColorStop(0, "rgba(167,139,250,.34)");
  meshB.addColorStop(.58, "rgba(221,214,254,.18)");
  meshB.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = meshB;
  ctx.fillRect(-160, -160, W + 320, H + 320);

  const meshC = ctx.createRadialGradient(820, 1000, 160, 780, 770, 680);
  meshC.addColorStop(0, "rgba(221,214,254,.32)");
  meshC.addColorStop(.48, "rgba(125,211,252,.13)");
  meshC.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = meshC;
  ctx.fillRect(-160, -160, W + 320, H + 320);
  ctx.restore();
  ctx.filter = "none";

  ctx.fillStyle = "rgba(255,255,255,.82)";
  canvasRoundRect(ctx, 56, 52, W - 112, H - 104, 46);
  ctx.fill();
  ctx.strokeStyle = "rgba(203,213,225,.70)";
  ctx.lineWidth = 1;
  ctx.stroke();

  const previewX = 130;
  const previewY = 175;
  const previewW = W - 260;
  const previewH = 470;
  const padX = 46;
  const padY = 44;
  const plotX = previewX + padX;
  const plotY = previewY + padY;
  const plotW = previewW - padX * 2;
  const plotH = previewH - padY * 2;

  ctx.save();
  ctx.shadowColor = "rgba(15,23,42,.10)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = "rgba(255,255,255,.72)";
  canvasRoundRect(ctx, previewX, previewY, previewW, previewH, 36);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(203,213,225,.65)";
  ctx.lineWidth = 1;
  canvasRoundRect(ctx, previewX, previewY, previewW, previewH, 36);
  ctx.stroke();

  // Clip the block preview to one large rounded shape.
  ctx.save();
  canvasRoundRect(ctx, previewX, previewY, previewW, previewH, 36);
  ctx.clip();

  ctx.fillStyle = "rgba(255,255,255,.76)";
  ctx.fillRect(previewX, previewY, previewW, previewH);

  // Rounded interval blocks as the background layer.
  const maxPct = Math.max(1.25, ...workout.map(b => (b.high !== undefined || b.low !== undefined) ? ((Number(b.low || b.power || 0)+Number(b.high || b.power || 0))/2) : Number(b.power || 0)));
  let bx = plotX;
  workout.forEach((b)=>{
    const bw = Math.max(6, ((b.duration || 0) / total) * plotW);
    const pct = (b.high !== undefined || b.low !== undefined) ? ((Number(b.low || b.power || 0)+Number(b.high || b.power || 0))/2) : Number(b.power || 0);
    const bh = Math.max(28, Math.min(plotH, (pct / maxPct) * (plotH - 16)));
    const by = plotY + plotH - bh;
    const color = pct < .56 ? "#bfdbfe" : pct < .76 ? "#bae6fd" : pct < .91 ? "#ddd6fe" : pct < 1.06 ? "#c4b5fd" : pct < 1.21 ? "#fbcfe8" : "#fecdd3";
    ctx.fillStyle = color;
    canvasRoundRect(ctx, bx + 3, by, Math.max(3, bw - 6), bh, 14);
    ctx.fill();
    bx += bw;
  });

  if(skippedTimelineGaps && skippedTimelineGaps.length){
    skippedTimelineGaps.forEach(gap=>{
      const start = Math.max(0, Math.min(total, gap.start || 0));
      const end = Math.max(0, Math.min(total, gap.end || 0));
      if(end <= start) return;
      const x1 = plotX + (start / total) * plotW;
      const x2 = plotX + (end / total) * plotW;
      const mid = x1 + (x2 - x1) / 2;
      const grad = ctx.createLinearGradient(x1, 0, x2, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(.2, 'rgba(255,255,255,.88)');
      grad.addColorStop(.8, 'rgba(255,255,255,.88)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x1 - 3, plotY, Math.max(8, x2 - x1) + 6, plotH);
      ctx.save();
      ctx.setLineDash([7, 10]);
      ctx.strokeStyle = 'rgba(100,116,139,.24)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mid, plotY + 14);
      ctx.lineTo(mid, plotY + plotH - 14);
      ctx.stroke();
      ctx.restore();
    });
  }

  const sampleStart = rideSamples[0] ? new Date(rideSamples[0].time).getTime() : null;
  const sampleValues = rideSamples.map(s=>({
    t: sampleStart ? Math.max(0, (new Date(s.time).getTime() - sampleStart) / 1000) : 0,
    power: Number(s.power),
    hr: Number(s.heartRate)
  }));
  let powerValues = sampleValues.filter(s=>Number.isFinite(s.power)).map(s=>({t:s.t, v:s.power}));
  const hrValues = sampleValues.filter(s=>Number.isFinite(s.hr)).map(s=>({t:s.t, v:s.hr}));

  // If there is no real power trace, use the target trace so the card still has a meaningful fingerprint.
  if(powerValues.length < 2){
    const targetPowerValues = [];
    const step = Math.max(1, total / 240);
    for(let t=0;t<=total;t+=step){
      const target = targetAt(t);
      if(target) targetPowerValues.push({t, v:target.watts});
    }
    powerValues = targetPowerValues;
  }

  function buildTracePoints(values, opts){
    const clean = values.filter(v=>Number.isFinite(v.v) && Number.isFinite(v.t));
    if(clean.length < 2) return [];
    const dataMin = Math.min(...clean.map(v=>v.v));
    const dataMax = Math.max(...clean.map(v=>v.v));
    const lo = opts.minValue !== undefined ? opts.minValue : dataMin;
    const hi = Math.max(opts.maxValue || dataMax, dataMax, lo + 1);
    const span = Math.max(1, hi - lo);
    const raw = clean.map(pt=>({
      t: pt.t,
      x: plotX + Math.max(0, Math.min(1, pt.t / total)) * plotW,
      y: plotY + plotH - ((pt.v - lo) / span) * plotH
    }));
    const pxRadius = Math.max(0, Number(opts.pixelSmoothRadius || 0));
    if(!pxRadius) return raw;
    return raw.map(pt=>{
      const nearby = raw.filter(p=>Math.abs(p.x - pt.x) <= pxRadius);
      return { t: pt.t, x: pt.x, y: average(nearby.map(p=>p.y)) || pt.y };
    });
  }

  function shareTraceCrossesSkippedGap(a, b){
    if(!skippedTimelineGaps || !skippedTimelineGaps.length) return false;
    const lo = Math.min(a || 0, b || 0);
    const hi = Math.max(a || 0, b || 0);
    return skippedTimelineGaps.some(g => hi > g.start && lo < g.end);
  }
  function drawOverlayTrace(values, opts){
    const points = buildTracePoints(values, opts);
    if(points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for(let i=1;i<points.length;i++){
      const prev = points[i-1];
      const cur = points[i];
      if(shareTraceCrossesSkippedGap(prev.t, cur.t)) ctx.moveTo(cur.x, cur.y);
      else ctx.lineTo(cur.x, cur.y);
    }
    ctx.strokeStyle = opts.color;
    ctx.lineWidth = opts.width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }

  const wattAxisMax = Math.max(ftp()*1.35, summary.maxPower || 0, summary.maxHr || 0, 180);

  drawOverlayTrace(powerValues, {
    color:"rgba(109,91,208,.40)",
    width:3,
    pixelSmoothRadius:2,
    minValue:0,
    maxValue:wattAxisMax
  });
  drawOverlayTrace(hrValues, {
    color:"rgba(244,63,94,.52)",
    width:3,
    pixelSmoothRadius:0,
    minValue:0,
    maxValue:wattAxisMax
  });

  ctx.restore();

  // Clean stat strip inspired by the preview mockup: icon, value, label, subtle dividers.
  const stats = [
    {value:formatTime(duration), label:"DURATION", icon:"clock", accent:"#6d5bd0"},
    {value:summary.avgPower ? `${summary.avgPower} w` : "--", label:"AVG POWER", icon:"bolt", accent:"#6d5bd0"},
    {value:summary.np ? `${summary.np} w` : "--", label:"AVG NP", icon:"target", accent:"#6d5bd0"},
    {value:summary.avgHr ? `${summary.avgHr} bpm` : "--", label:"AVG HR", icon:"heart", accent:"#f43f5e"},
    {value:summary.avgCadence ? `${summary.avgCadence} rpm` : "--", label:"AVG CADENCE", icon:"cadence", accent:"#6d5bd0"}
  ];

  function drawShareIcon(type, cx, cy, color){
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = "transparent";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if(type === "clock"){
      ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy-13); ctx.moveTo(cx, cy); ctx.lineTo(cx+11, cy+8); ctx.stroke();
    }else if(type === "bolt"){
      ctx.beginPath();
      ctx.moveTo(cx+4, cy-27); ctx.lineTo(cx-15, cy+3); ctx.lineTo(cx+1, cy+3); ctx.lineTo(cx-4, cy+27); ctx.lineTo(cx+18, cy-6); ctx.lineTo(cx+2, cy-6); ctx.closePath();
      ctx.stroke();
    }else if(type === "target"){
      ctx.beginPath(); ctx.arc(cx, cy, 23, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI*2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI*2); ctx.stroke();
    }else if(type === "bars"){
      const xs = [-18,-6,6,18];
      const hs = [24,38,52,32];
      xs.forEach((off,i)=>{ canvasRoundRect(ctx, cx+off-4, cy+26-hs[i], 8, hs[i], 4); ctx.stroke(); });
    }else if(type === "cadence"){
      ctx.beginPath(); ctx.arc(cx, cy, 24, -Math.PI*.92, Math.PI*.35); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+21, cy-9); ctx.lineTo(cx+27, cy-23); ctx.lineTo(cx+11, cy-21); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI*2); ctx.stroke();
    }else if(type === "heart"){
      ctx.beginPath();
      ctx.moveTo(cx, cy+20);
      ctx.bezierCurveTo(cx-34, cy-2, cx-24, cy-28, cx-5, cy-18);
      ctx.bezierCurveTo(cx, cy-15, cx, cy-15, cx+5, cy-18);
      ctx.bezierCurveTo(cx+24, cy-28, cx+34, cy-2, cx, cy+20);
      ctx.stroke();
    }
    ctx.restore();
  }

  const stripX = 120;
  const stripY = 700;
  const stripW = W - 240;
  const colW = stripW / stats.length;
  stats.forEach((st,i)=>{
    const cx = stripX + colW * i + colW / 2;
    if(i > 0){
      ctx.strokeStyle = "rgba(148,163,184,.22)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(stripX + colW * i, stripY + 24);
      ctx.lineTo(stripX + colW * i, stripY + 164);
      ctx.stroke();
    }
    drawShareIcon(st.icon, cx, stripY + 38, st.accent);
    ctx.fillStyle = "#0f172a";
    ctx.font = "900 36px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(st.value), cx, stripY + 102);
    ctx.fillStyle = "#536079";
    ctx.font = "800 18px Inter, Arial, sans-serif";
    ctx.fillText(st.label, cx, stripY + 144);
  });

  ctx.textAlign = "left";
  return canvas.toDataURL("image/png");
}
function populateWorkoutEndModal(reason="completed"){
  const summary = getRideSummary();
  const duration = summary.duration || Math.round(currentElapsed()) || totalDuration();
  const compliance = rideCompliancePercent();
  const rampEstimate = achievedRampFtp(duration);
  const isRamp = activeWorkoutKind === "ftpRampTest";
  $("workoutEndTitle").textContent = isRamp ? "FTP Ramp Test Complete" : (reason === "stopped" ? "Workout Stopped" : "Workout Complete");
  $("workoutEndSubtitle").textContent = isRamp && rampEstimate ? `Estimated FTP ${rampEstimate}w • Current FTP ${rampTestConfig?.baseFtp || ftp()}w` : `${loadedName || "Workout"} • ${formatTime(duration)}`;
  $("summaryDuration").textContent = formatTime(duration);
  $("summaryAvgPower").textContent = summary.avgPower ? summary.avgPower + "w" : "--";
  $("summaryMaxPower").textContent = summary.maxPower ? summary.maxPower + "w" : "--";
  $("summaryAvgHr").textContent = summary.avgHr ? summary.avgHr + " bpm" : "--";
  $("summaryMaxHr").textContent = summary.maxHr ? summary.maxHr + " bpm" : "--";
  $("summaryTss").textContent = summary.tss || 0;
  $("summaryCompliance").textContent = compliance === null ? "--" : compliance + "%";
  $("summarySamples").textContent = rideSamples.length;
  const ftpActions = $("ftpEndActions");
  const updateFtpBtn = $("updateFtpBtn");
  if(ftpActions) ftpActions.classList.toggle("open", !!isRamp && !!rampEstimate);
  if(updateFtpBtn && rampEstimate) updateFtpBtn.textContent = `Update FTP to ${rampEstimate}w`;
  const img = $("workoutEndTimelineImg");
  if(img) img.src = workoutShareImageDataUrl(reason);
}
function openWorkoutEndModal(reason="completed"){
  workoutEndReason = reason;
  populateWorkoutEndModal(reason);
  const overlay = $("workoutEndOverlay");
  const modal = $("workoutEndModal");
  if(overlay) overlay.classList.add("open");
  if(modal) modal.classList.add("open");
}
function closeWorkoutEndModal(){
  const overlay = $("workoutEndOverlay");
  const modal = $("workoutEndModal");
  if(overlay) overlay.classList.remove("open");
  if(modal) modal.classList.remove("open");
}
function openStopConfirmModal(){
  if(!workout.length) return;
  stopConfirmOpen = true;
  if(playing){
    elapsedBeforePause += (Date.now()-startedAt)/1000;
  }
  playing = false;
  readyToStart = false;
  workoutPaused = true;
  resetSmartAutoPause();
  clearInterval(timer);
  clearInterval(autoErgInterval);
  clearInterval(autoStartMonitor);
  if(ftmsControlPointChar){
    writeFtmsCommand([0x08, 0x02], "Stop Confirm Pause ERG");
    lastAutoErgWatts = null;
  }
  const overlay = $("stopConfirmOverlay");
  const modal = $("stopConfirmModal");
  if(overlay) overlay.classList.add("open");
  if(modal) modal.classList.add("open");
  updateReadyUi();
  updateTimelineOverlay();
  setControls();
  render();
}
function closeStopConfirmModal(){
  stopConfirmOpen = false;
  const overlay = $("stopConfirmOverlay");
  const modal = $("stopConfirmModal");
  if(overlay) overlay.classList.remove("open");
  if(modal) modal.classList.remove("open");
}
function returnToReadyFromStopCancel(){
  closeStopConfirmModal();
  workoutPaused = false;
  readyToStart = false;
  clearInterval(autoStartMonitor);
  armReadyStart({freshPedal:true});
}
function finishWorkout(reason="completed"){
  workoutCompleted = true;
  workoutEndReason = reason;
  playing = false;
  readyToStart = false;
  workoutPaused = false;
  clearInterval(timer);
  clearInterval(autoErgInterval);
  clearInterval(autoStartMonitor);
  if(recording) stopRecording();
  if(ftmsControlPointChar){
    writeFtmsCommand([0x08, 0x02], "Workout End Pause ERG");
    lastAutoErgWatts = null;
  }
  updateCountdownTimers(reason === "completed" ? totalDuration() : currentElapsed());
  setControls();
  updateReadyUi();
  updateTimelineOverlay();
  drawGraph(reason === "completed" ? totalDuration() : currentElapsed());
  openWorkoutEndModal(reason);
}
function saveSummaryScreenshot(){
  const href = workoutShareImageDataUrl(workoutEndReason || "completed");
  if(!href) return;
  const name = (loadedName || "workout-summary").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "workout-summary";
  const a = document.createElement("a");
  a.href = href;
  a.download = `${name}-share.png`;
  a.click();
}

function updateTimelineOverlay(){
  const overlay = $("timelineOverlay");
  if(!overlay) return;

  if(workoutCompleted){
    overlay.style.display = "grid";
    overlay.innerHTML = `
      <div class="timeline-overlay-card">
        <div class="timeline-overlay-title">${workoutEndReason === "stopped" ? "Workout Stopped" : "Workout Complete"}</div>
      </div>
    `;
    return;
  }

  if(!workout.length){
    overlay.style.display = "none";
    overlay.innerHTML = "";
    return;
  }

  if(workoutPaused){
    overlay.style.display = "grid";
    overlay.innerHTML = `
      <div class="timeline-overlay-card">
        <div class="timeline-overlay-title">Paused</div>
        <div class="timeline-overlay-sub">Hit Resume or Press Enter</div>
      </div>
    `;
    return;
  }

  if(readyToStart && !playing){
    overlay.style.display = "grid";
    overlay.innerHTML = `
      <div class="timeline-overlay-card">
        <div class="timeline-overlay-title">Pedal to begin.</div>
      </div>
    `;
    return;
  }

  if(workout.length && !playing && !readyToStart){
    overlay.style.display = "grid";
    overlay.innerHTML = `
      <div class="timeline-overlay-card">
        <div class="timeline-overlay-title">Press Ready or Enter key</div>
      </div>
    `;
    return;
  }

  overlay.style.display = "none";
  overlay.innerHTML = "";
}
function blockPowerWatts(block){
  if(!block) return null;
  const pct = (block.high !== undefined || block.low !== undefined)
    ? ((Number(block.low || block.power || 0) + Number(block.high || block.power || 0)) / 2)
    : Number(block.power || 0);
  return Math.round(pct * bias * ftp());
}
function blockZoneClass(block){
  if(!block) return "zone-recovery";
  const pct = (block.high !== undefined || block.low !== undefined)
    ? ((Number(block.low || block.power || 0) + Number(block.high || block.power || 0)) / 2)
    : Number(block.power || 0);
  const percent = pct * bias * 100;
  if(percent < 56) return "zone-recovery";
  if(percent < 76) return "zone-endurance";
  if(percent < 91) return "zone-tempo";
  if(percent < 106) return "zone-threshold";
  if(percent < 121) return "zone-vo2";
  return "zone-anaerobic";
}
function updateBlockGlance(elapsed){
  const panel = $("currentBlockPanel");
  const curEl = $("currentBlockGlance");
  const curMetaEl = $("currentBlockGlanceMeta");
  const nextEl = $("nextBlockGlance");
  const nextMetaEl = $("nextBlockGlanceMeta");
  const remainingEl = $("blocksRemainingText");
  if(!curEl || !curMetaEl || !nextEl || !nextMetaEl) return;

  const ftpPanel = $("liveFtpPanel");
  const ftpValue = $("liveFtpValue");
  const ftpMeta = $("liveFtpMeta");
  if(!workout.length){
    curEl.textContent = "--";
    curMetaEl.textContent = "Load a workout";
    nextEl.textContent = "--";
    nextMetaEl.textContent = "--";
    if(remainingEl) remainingEl.textContent = "0 blocks remaining";
    if(panel) panel.className = "current-block-panel zone-recovery";
    if(ftpPanel) ftpPanel.style.display = "none";
    return;
  }

  const info = getCurrentBlockInfo(elapsed);
  const current = workout[info.index];
  if(current){
    curEl.textContent = current.type || "Current";
    curMetaEl.textContent = `${formatTime(info.remaining || current.duration || 0)} remaining · ${blockPowerWatts(current)}w`;
    if(panel) panel.className = `current-block-panel ${blockZoneClass(current)}`;
  }else{
    curEl.textContent = "Complete";
    curMetaEl.textContent = "Workout finished";
    if(panel) panel.className = "current-block-panel zone-recovery";
  }

  const next = current ? nextBlock(info.index) : null;
  if(next){
    nextEl.textContent = next.type || "Next";
    nextMetaEl.textContent = `${formatTime(next.duration || 0)} · ${blockPowerWatts(next)}w`;
  }else{
    nextEl.textContent = "Finish";
    nextMetaEl.textContent = "End of workout";
  }

  if(ftpPanel){
    const achieved = achievedRampFtp(elapsed);
    const base = rampTestConfig?.baseFtp || ftp();
    if(activeWorkoutKind === "ftpRampTest"){
      ftpPanel.style.display = "block";
      ftpValue.textContent = achieved ? `${achieved}w` : "--";
      ftpMeta.textContent = `Current FTP ${base}w`;
      ftpPanel.classList.remove("ftp-red","ftp-gold");
      if(achieved){
        ftpPanel.classList.add(achieved >= base ? "ftp-gold" : "ftp-red");
      }
    }else{
      ftpPanel.style.display = "none";
    }
  }

  if(remainingEl){
    const remaining = current ? Math.max(0, workout.length - info.index - 1) : 0;
    remainingEl.textContent = `${remaining} block${remaining === 1 ? "" : "s"} remaining`;
  }
}
function updateCountdownTimers(elapsed){
  const total = totalDuration();
  const totalRemaining = workout.length ? Math.max(0, total - elapsed) : 0;
  const block = getCurrentBlockInfo(elapsed);
  if($("totalCountdownText")) $("totalCountdownText").textContent = formatTime(totalRemaining);
  if($("intervalCountdownText")) $("intervalCountdownText").textContent = formatTime(block.remaining || 0);

  if($("currentBlockDetailText")){
    if(!workout.length || block.index < 0){
      $("currentBlockDetailText").textContent = "--";
    }else{
      const b = workout[block.index];
      const duration = formatTime(b.duration || 0);
      const pct = (b.high !== undefined || b.low !== undefined)
        ? ((Number(b.low || b.power || 0) + Number(b.high || b.power || 0)) / 2)
        : Number(b.power || 0);
      const watts = Math.round(pct * bias * ftp());
      $("currentBlockDetailText").innerHTML = `<span class="block-name">${duration}</span><span class="block-meta">${watts}w</span>`;
    }
  }
  updateBlockGlance(elapsed);
  updateTimelineOverlay();
}
function render(){
  handleSmartAutoPause();
  const elapsed = currentElapsed();
  updateCountdownTimers(elapsed);
  updateTimelineOverlay();
  const total = totalDuration();
  const target = targetAt(elapsed);
  drawGraph(elapsed);
  if($("progress")) $("progress").style.width = total ? Math.min(100,(elapsed/total)*100) + "%" : "0%";
  $("elapsedText").textContent = formatTime(elapsed);
  $("totalText").textContent = formatTime(total);

  if(target){
    $("targetPower").textContent = target.watts;
    $("rideTargetPower").textContent = target.watts;
    $("rideBlockTitle").textContent = target.block.type;
    const remaining = target.end - elapsed;
    $("intervalText").textContent = `${Math.round(target.pct*100)}% FTP • ${formatTime(remaining)} remaining • ${loadedName}`;
    $("rideSubText").textContent = `${formatTime(remaining)} remaining • ${Math.round(target.pct*100)}% FTP • ${loadedName}`;
    $("currentName").textContent = target.block.type;
    $("remainingText").textContent = formatTime(remaining);
    if(playing && target.index !== lastBlockStartCueIndex){
      lastBlockStartCueIndex = target.index;
      lastCountdownCue = "";
      playCue("newBlock");
    }

    const countdownSecond = Math.ceil(remaining);
    const countdownCueKey = `${target.index}-${countdownSecond}`;
    if(playing && countdownSecond >= 1 && countdownSecond <= 3 && lastCountdownCue !== countdownCueKey){
      lastCountdownCue = countdownCueKey;
      playCue("countdown");
    }
    const next = nextBlock(target.index);
    $("nextName").textContent = next ? next.type : "Finish";
  }else if(workout.length && elapsed >= total){
    $("targetPower").textContent = "--";
    $("rideTargetPower").textContent = "--";
    $("rideBlockTitle").textContent = loadedName || "Workout complete";
    $("rideSubText").textContent = "";
    $("intervalText").textContent = "";
    if(lastCue !== "complete"){ lastCue = "complete"; playCue("complete"); }
    $("currentName").textContent = "Complete";
    $("remainingText").textContent = "0:00";
    updateCountdownTimers(total);
    $("nextName").textContent = "--";
    finishWorkout("completed");
    return;
  }else{
    $("targetPower").textContent = "--";
    $("rideTargetPower").textContent = "--";
    $("rideBlockTitle").textContent = workout.length ? "Ready to ride" : "Load a workout";
    $("rideSubText").textContent = workout.length ? "Press Ready, then start pedalling." : "Connect trainer, import ZWO, press Ready, then pedal.";
    $("intervalText").textContent = "Load a workout to begin.";
    $("currentName").textContent = "--";
    $("remainingText").textContent = "--";
    $("nextName").textContent = "--";
  }

  const active = target ? target.index : -1;
  if($("blockList")){
    $("blockList").innerHTML = workout.map((b,i)=>{
      const min = formatTime(b.duration);
      const pct = b.low !== undefined ? `${Math.round(b.low*bias*100)}→${Math.round(b.high*bias*100)}%` : `${Math.round((b.power||0)*bias*100)}%`;
      const watts = b.low !== undefined ? `${Math.round(b.low*bias*ftp())}→${Math.round(b.high*bias*ftp())}w` : `${Math.round((b.power||0)*bias*ftp())}w`;
      return `<div class="block-row ${i===active ? "active" : ""}"><span>${i+1}. ${b.type}</span><span>${min}<br>${pct} / ${watts}</span></div>`;
    }).join("");
  }

  updateFeedback();
  updateReadyUi();
}
function setControls(){
  const has = workout.length > 0;
  const stack = $("rideActionStack");
  if(stack){
    const state = workoutCompleted ? "complete" : playing ? "riding" : workoutPaused ? "paused" : readyToStart ? "ready" : has ? "loaded" : "idle";
    stack.dataset.rideState = state;
  }
  $("startBtn").disabled = !has || playing || readyToStart || workoutCompleted;
  $("startBtn").textContent = readyToStart ? "Ready" : "Ready";
  $("pauseBtn").disabled = !has || workoutCompleted || (!playing && !workoutPaused);
  $("pauseBtn").textContent = workoutPaused ? "Resume" : "Pause";
  $("resetBtn").disabled = !has || workoutCompleted;
  $("resetBtn").textContent = "Stop";
  const canEditInterval = has && !workoutCompleted && (playing || workoutPaused || readyToStart);
  ["skipIntervalBtn","extendInterval1Btn","extendInterval25Btn","extendInterval5Btn"].forEach(id=>{
    const btn = $(id);
    if(btn) btn.disabled = !canEditInterval;
  });
  $("rideModeBtn").disabled = !has;
  updateFullscreenButton();
  if($("exportTimelinePngBtn")) $("exportTimelinePngBtn").disabled = !has;
}
function start(){
  if(workoutCompleted) return;
  resetSmartAutoPause();
  if(workoutPaused){
    resumeFromHardPause();
    return;
  }
  workoutPaused = false;
  autoErg = true;
  updateAutoErgUi();
  if(ftmsControlPointChar) autoSetupTrainerControl();
  armReadyStart();
}
function hardPause(options={}){
  if(!workout.length){
    setControls();
    return;
  }

  if(playing){
    elapsedBeforePause += (Date.now()-startedAt)/1000;
  }

  playing = false;
  readyToStart = false;
  readyNeedsFreshPedal = false;
  readyPedalReleased = true;
  workoutPaused = true;
  clearInterval(timer);
  clearInterval(autoErgInterval);
  clearInterval(autoStartMonitor);

  if(ftmsControlPointChar){
    writeFtmsCommand([0x08, 0x02], "Hard Pause ERG");
    lastAutoErgWatts = null;
  }

  updateReadyUi();
  updateTimelineOverlay();
  setControls();
  render();
}
function resumeFromHardPause(){
  if(!workout.length) return;
  resetSmartAutoPause();
  workoutPaused = false;
  readyToStart = false;
  clearInterval(autoStartMonitor);
  updateReadyUi();
  setControls();
  armReadyStart({freshPedal:true});
}
function pause(){
  if(workoutPaused){
    resumeFromHardPause();
  }else{
    hardPause();
  }
}
function reset(){
  openStopConfirmModal();
}
function skipInterval(){
  resetSmartAutoPause();
  const now = currentElapsed();
  const hit = blockAt(now);
  if(!hit) return;
  const gapStart = Math.max(hit.start, Math.min(now, hit.end));
  const gapEnd = hit.end;
  if(gapEnd - gapStart > 0.5){
    skippedTimelineGaps.push({
      start: gapStart,
      end: gapEnd,
      index: hit.index,
      type: hit.block?.type || 'Interval'
    });
  }
  elapsedBeforePause = hit.end;
  if(playing) startedAt = Date.now();
  lastAutoErgWatts = null;
  render();
  if(autoErg && playing) autoErgTick();
}
function extendCurrentInterval(seconds){
  const hit = blockAt(currentElapsed());
  if(!hit || !Number.isFinite(seconds) || seconds <= 0) return;
  workout[hit.index].duration = Math.max(1, Number(workout[hit.index].duration || 0) + seconds);
  lastAutoErgWatts = null;
  render();
  setControls();
  if(autoErg && playing) autoErgTick();
}
function changeBias(delta){
  bias = Math.max(0.5, Math.min(1.5, bias + delta));
  lastAutoErgWatts = null;
  render();
  if(autoErg && playing) autoErgTick();
}
function resetBias(){
  bias = 1.0;
  lastAutoErgWatts = null;
  render();
  if(autoErg && playing) autoErgTick();
}
function toggleErgReady(){
  // Trainer ready state is now automatic and hidden from the rider UI.
}
function toggleSim(){
  // Simulate Data has been removed from the rider UI.
}

function readNumberFromText(id){
  const v = Number($(id).textContent);
  return Number.isFinite(v) ? v : null;
}
function currentWorkoutTargetForRecording(){
  const target = targetAt(currentElapsed());
  if(!target) return {watts:null, pct:null, interval:""};
  return {
    watts: target.watts,
    pct: Math.round(target.pct * 100),
    interval: target.block.type
  };
}


function updateScoreUi(){
  // Score ring removed from current UI.
}
function playCue(type="beep"){
  const toggle = $("soundToggle");
  if(toggle && !toggle.checked) return;
  try{
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if(!AudioContextClass) return;
    if(!audioCtx) audioCtx = new AudioContextClass();
    if(audioCtx.state === "suspended") audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    const settings = {
      countdown: { frequency: 720, duration: 0.09, volume: 0.084 },
      newBlock: { frequency: 1180, duration: 0.13, volume: 0.12 },
      complete: { frequency: 980, duration: 0.20, volume: 0.114 },
      beep: { frequency: 720, duration: 0.10, volume: 0.09 }
    }[type] || { frequency: 720, duration: 0.10, volume: 0.09 };

    osc.type = "sine";
    osc.frequency.setValueAtTime(settings.frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(settings.volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + settings.duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + settings.duration + 0.02);
  }catch(e){}
}

function updateFullscreenButton(){
  const btn = $("rideModeBtn");
  if(!btn) return;
  const active = !!document.fullscreenElement;
  btn.textContent = active ? "×" : "⛶";
  btn.title = active ? "Exit fullscreen" : "Fullscreen";
}
async function toggleBrowserFullscreen(){
  try{
    if(!document.fullscreenElement){
      const target = document.querySelector(".main") || document.documentElement;
      await target.requestFullscreen();
    }else{
      await document.exitFullscreen();
    }
  }catch(err){
    console.error(err);
    alert("Fullscreen is not available in this browser.");
  }finally{
    updateFullscreenButton();
  }
}
function updateRideModeButton(){
  const btn = $("rideModeBtn");
  if(!btn) return;
  const active = document.body.classList.contains("ride-mode");
  btn.textContent = active ? "×" : "⛶";
  btn.title = active ? "Exit ride mode" : "Fullscreen ride mode";
}
function enterRideMode(){
  document.body.classList.add("ride-mode");
  updateFullscreenButton();
  render();
}
function exitRideMode(){
  document.body.classList.remove("ride-mode");
  updateFullscreenButton();
  render();
}
function toggleRideMode(){
  if(document.body.classList.contains("ride-mode")) exitRideMode();
  else enterRideMode();
}
function updateIntensityFromSlider(){
  const val = Number($("intensitySlider").value || 100);
  bias = val / 100;
  $("intensityValue").textContent = val + "%";
  lastAutoErgWatts = null;
  render();
  if(autoErg && playing) autoErgTick();
}
function adjustIntensity(delta){
  const slider = $("intensitySlider");
  const current = Number(slider.value || 100);
  const next = Math.max(Number(slider.min || 50), Math.min(Number(slider.max || 150), current + delta));
  slider.value = next;
  updateIntensityFromSlider();
}
function startRecording(){
  if(recording) return;
  recording = true;
  complianceSamples = [];
  if(!recordingStartedAt) recordingStartedAt = new Date();
  recordingStoppedAt = null;
  clearInterval(recordInterval);
  captureSample();
  recordInterval = setInterval(captureSample, 1000);
  updateRecordingUi();
}
function stopRecording(){
  if(!recording) return;
  recording = false;
  recordingStoppedAt = new Date();
  clearInterval(recordInterval);
  updateRecordingUi();
}
function resetRecording(){
  recording = false;
  recordingStartedAt = null;
  recordingStoppedAt = null;
  rideSamples = [];
  skippedTimelineGaps = [];
  clearInterval(recordInterval);
  updateRecordingUi();
}
function captureSample(){
  const now = new Date();
  const target = currentWorkoutTargetForRecording();
  const speedText = $("speedVal").textContent;
  const speedKph = Number(speedText);
  const targetInfo = target;
  if(Number.isFinite(currentPower) && Number.isFinite(targetInfo.watts) && targetInfo.watts > 0){
    const diff = Math.abs(currentPower - targetInfo.watts);
    complianceSamples.push(diff <= Math.max(12, targetInfo.watts * 0.08) ? 1 : 0);
  }
  rideSamples.push({
    time: now.toISOString(),
    elapsedWorkoutSec: Math.round(currentElapsed()),
    power: currentPower,
    targetPower: target.watts,
    targetPct: target.pct,
    interval: target.interval,
    heartRate: readNumberFromText("hrVal"),
    cadence: readNumberFromText("cadenceVal"),
    speedKph: Number.isFinite(speedKph) ? speedKph : null
  });
  updateRecordingUi();
}
function average(values){
  const nums = values.filter(v => Number.isFinite(v));
  if(!nums.length) return null;
  return nums.reduce((a,b)=>a+b,0) / nums.length;
}
function recordingDurationSec(){
  if(!recordingStartedAt) return 0;
  const end = recordingStoppedAt || new Date();
  return Math.max(0, Math.round((end - recordingStartedAt) / 1000));
}

function calculateEstimatedTss(){
  const ftpVal = Math.max(1, ftp());
  const powerSamples = rideSamples
    .filter(s => Number.isFinite(s.power))
    .map(s => Math.max(0, s.power));

  if(powerSamples.length < 2) return 0;

  // Simple real-time estimate using average power as an NP proxy.
  // Later we can upgrade this to full Normalized Power.
  const avgPower = average(powerSamples) || 0;
  const durationSec = recordingDurationSec() || powerSamples.length;
  const intensityFactor = avgPower / ftpVal;
  return Math.round((durationSec * avgPower * intensityFactor) / (ftpVal * 3600) * 100);
}

function calculateNotionalPower(){
  const powerSamples = rideSamples
    .filter(s => Number.isFinite(s.power))
    .map(s => Math.max(0, s.power));
  if(powerSamples.length < 2){
    const fallback = average(powerSamples);
    return Number.isFinite(fallback) ? Math.round(fallback) : null;
  }
  // Lightweight Normalized Power-style estimate: 30-s rolling average, fourth-power mean.
  const windowSize = Math.max(1, Math.min(30, powerSamples.length));
  const rolling = powerSamples.map((_, i)=>{
    const start = Math.max(0, i - windowSize + 1);
    return average(powerSamples.slice(start, i + 1)) || 0;
  });
  const fourthMean = average(rolling.map(v=>Math.pow(v, 4)));
  return Number.isFinite(fourthMean) ? Math.round(Math.pow(fourthMean, 0.25)) : null;
}


function animateMetricValue(id){
  const el = $(id);
  if(!el) return;
  const metric = el.closest('.metric-inline');
  if(!metric) return;
  metric.classList.remove('metric-updated');
  void metric.offsetWidth;
  metric.classList.add('metric-updated');
  clearTimeout(metric._metricPopTimer);
  metric._metricPopTimer = setTimeout(()=>metric.classList.remove('metric-updated'), 300);
}
function initMetricAnimations(){
  ['hrVal','powerVal','cadenceVal','speedVal'].forEach(id=>{
    const el = $(id);
    if(!el || el._metricObserver) return;
    let last = el.textContent;
    const observer = new MutationObserver(()=>{
      const next = el.textContent;
      if(next !== last){
        last = next;
        animateMetricValue(id);
        updateMetricMotionStates();
      }
    });
    observer.observe(el, {childList:true, characterData:true, subtree:true});
    el._metricObserver = observer;
  });
}
function updateMetricMotionStates(){
  const hrMetric = $('hrMetricCard');
  const cadenceMetric = $('cadenceMetricCard');
  const powerMetric = $('powerMetricCard');
  const hr = readNumberFromText ? readNumberFromText('hrVal') : Number($('hrVal')?.textContent);
  const cadence = readNumberFromText ? readNumberFromText('cadenceVal') : Number($('cadenceVal')?.textContent);
  if(hrMetric) hrMetric.classList.toggle('metric-live', Number.isFinite(hr) && hr > 0 && hrConnected);
  if(cadenceMetric) cadenceMetric.classList.toggle('metric-live', Number.isFinite(cadence) && cadence > 5);
  if(powerMetric){
    powerMetric.classList.remove('zone-recovery','zone-endurance','zone-tempo','zone-threshold','zone-vo2','zone-anaerobic');
    const target = targetAt ? targetAt(currentElapsed()) : null;
    powerMetric.classList.add(target ? blockZoneClass(target.block) : 'zone-recovery');
  }
}
function updateMetricConnectionCards(){
  const hrCard = $("hrMetricCard");
  const powerCard = $("powerMetricCard");
  const cadenceCard = $("cadenceMetricCard");

  const hrNum = Number($("hrVal")?.textContent);
  const hrLive = hrConnected || (Number.isFinite(hrNum) && hrNum > 0);
  const trainerLive = trainerConnected || (Number.isFinite(currentPower) && currentPower > 0);

  if(hrCard){
    hrCard.classList.toggle("connect-cta", !hrLive);
    hrCard.setAttribute("aria-label", hrLive ? "Heart rate connected" : "Connect heart rate monitor");
    hrCard.style.cursor = hrLive ? "default" : "pointer";

    if(!hrLive){
      if($("hrVal")) $("hrVal").textContent = "Connect HR";
      const unit = hrCard.querySelector(".unit");
      if(unit) unit.style.display = "none";
      if($("avgHrMetric")) $("avgHrMetric").textContent = "";
    }else{
      const unit = hrCard.querySelector(".unit");
      if(unit) unit.style.display = "";
    }
  }

  if(powerCard){
    powerCard.classList.toggle("connect-cta", !trainerLive);
    powerCard.setAttribute("aria-label", trainerLive ? "Trainer connected" : "Connect smart trainer");
    powerCard.style.cursor = trainerLive ? "default" : "pointer";

    if(!trainerLive){
      if($("powerVal")) $("powerVal").textContent = "Connect Trainer";
      const unit = powerCard.querySelector(".unit");
      if(unit) unit.style.display = "none";
      if($("avgPowerMetric")) $("avgPowerMetric").textContent = "";
      if($("tssMetric")) $("tssMetric").textContent = "";
    }else{
      const unit = powerCard.querySelector(".unit");
      if(unit) unit.style.display = "";
    }
  }

  if(cadenceCard){
    cadenceCard.classList.toggle("is-hidden", !trainerLive);
    cadenceCard.setAttribute("aria-hidden", trainerLive ? "false" : "true");
  }

  updateMetricMotionStates();
}
function updateRecordingUi(){
  $("recordDot").className = "rec-dot " + (recording ? "on" : "");
  if($("exportTcxBtn")) $("exportTcxBtn").disabled = rideSamples.length < 2;
  if($("modalExportTcxBtn")) $("modalExportTcxBtn").disabled = rideSamples.length < 2;
  if($("exportTimelinePngBtn")) $("exportTimelinePngBtn").disabled = !workout.length;
  const tss = calculateEstimatedTss();
  $("recordSamples").textContent = tss;
  $("tssMetric").textContent = "TSS " + tss;
  $("recordDuration").textContent = formatTime(recordingDurationSec());
  const avgP = average(rideSamples.map(s=>s.power));
  const avgHr = average(rideSamples.map(s=>s.heartRate));
  const avgPText = avgP ? Math.round(avgP) + "w" : "--";
  const avgHrText = avgHr ? Math.round(avgHr) + " bpm" : "-- bpm";
  $("recordAvgPower").textContent = avgPText;
  $("recordAvgHr").textContent = avgHrText;
  $("avgPowerMetric").textContent = "Avg " + avgPText;
  $("avgHrMetric").textContent = "Avg " + avgHrText;
  updateScoreUi();
  updateMetricConnectionCards();
}

function isPedalling(){
  const power = Number($("powerVal").textContent);
  const cadence = Number($("cadenceVal").textContent);
  const speed = Number($("speedVal").textContent);
  return (
    (Number.isFinite(power) && power > 20) ||
    (Number.isFinite(cadence) && cadence > 5) ||
    (Number.isFinite(speed) && speed > 2)
  );
}
function resetSmartAutoPause(){
  lowCadenceAutoPauseSince = null;
  noPowerAutoPauseSince = null;
}
function inSmartAutoPauseTransitionGrace(elapsed=currentElapsed()){
  if(!workout.length) return true;
  const hit = blockAt(elapsed);
  if(!hit) return true;
  const local = elapsed - hit.start;
  const remaining = hit.end - elapsed;
  return local < SMART_AUTOPAUSE_TRANSITION_GRACE_SEC || remaining < SMART_AUTOPAUSE_TRANSITION_GRACE_SEC;
}
function handleSmartAutoPause(){
  if(!playing || workoutPaused || readyToStart || workoutCompleted || !workout.length){
    resetSmartAutoPause();
    return;
  }

  if(inSmartAutoPauseTransitionGrace()){
    resetSmartAutoPause();
    return;
  }

  const now = Date.now();
  const cadence = readNumberFromText("cadenceVal");
  const powerText = readNumberFromText("powerVal");
  const power = Number.isFinite(currentPower) ? currentPower : powerText;

  const cadenceLow = Number.isFinite(cadence) && cadence < SMART_AUTOPAUSE_CADENCE_THRESHOLD_RPM;
  const noPower = !Number.isFinite(power) || power <= SMART_AUTOPAUSE_NO_POWER_WATTS;

  lowCadenceAutoPauseSince = cadenceLow ? (lowCadenceAutoPauseSince || now) : null;
  noPowerAutoPauseSince = noPower ? (noPowerAutoPauseSince || now) : null;

  const cadenceTimedOut = lowCadenceAutoPauseSince && (now - lowCadenceAutoPauseSince >= SMART_AUTOPAUSE_CADENCE_DELAY_MS);
  const powerTimedOut = noPowerAutoPauseSince && (now - noPowerAutoPauseSince >= SMART_AUTOPAUSE_NO_POWER_DELAY_MS);

  if(cadenceTimedOut || powerTimedOut){
    resetSmartAutoPause();
    hardPause({auto:true});
  }
}
function updateReadyUi(){
  const banner = $("readyBanner");
  if(!banner) return;
  if(workoutCompleted){
    banner.className = "ready-banner on";
    banner.textContent = workoutEndReason === "stopped" ? "Workout stopped. Review your summary." : "Workout complete. Review your summary.";
    $("startBtn").textContent = "Complete";
  }else if(workoutPaused){
    banner.className = "ready-banner on";
    banner.textContent = "Paused. Hit Resume or press Enter to return to Ready state.";
    $("startBtn").textContent = "Resume";
  }else if(readyToStart){
    banner.className = "ready-banner on";
    banner.textContent = "Pedal to begin.";
    $("startBtn").textContent = "Ready...";
  }else if(playing){
    banner.className = "ready-banner";
    banner.textContent = "Workout running.";
    $("startBtn").textContent = "Running";
  }else{
    banner.className = "ready-banner";
    banner.textContent = workout.length ? "Press Ready or Enter key." : "Load a workout, press Ready, then pedal.";
    $("startBtn").textContent = "Ready";
  }
}
function armReadyStart(options={}){
  if(!workout.length || playing || workoutPaused) return;
  readyToStart = true;
  readyNeedsFreshPedal = !!options.freshPedal;
  readyPedalReleased = !isPedalling();
  clearInterval(autoStartMonitor);
  autoStartMonitor = setInterval(()=>{
    if(!readyToStart) return;

    const pedalling = isPedalling();
    if(readyNeedsFreshPedal){
      if(!pedalling) readyPedalReleased = true;
      if(readyPedalReleased && pedalling) beginWorkoutNow();
      return;
    }

    if(pedalling) beginWorkoutNow();
  }, 300);
  updateReadyUi();
  updateTimelineOverlay();
  setControls();
  render();
}
function beginWorkoutNow(){
  if(!workout.length || playing || workoutPaused || workoutCompleted) return;
  resetSmartAutoPause();
  readyToStart = false;
  readyNeedsFreshPedal = false;
  readyPedalReleased = true;
  clearInterval(autoStartMonitor);
  playing = true;
  startedAt = Date.now();
  timer = setInterval(render, 250);
  clearInterval(autoErgInterval);
  autoErg = true;
  updateAutoErgUi();
  if(ftmsControlPointChar) startTrainerControl();
  autoErgInterval = setInterval(autoErgTick, 1000);
  autoErgTick();
  if(!recording && rideSamples.length === 0) startRecording();
  setControls();
  updateReadyUi();
  render();
}
function escapeXml(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&apos;");
}

function exportTimelinePNG(){
  const canvas = $("graph");
  if(!canvas){
    alert("No timeline available to export.");
    return;
  }

  drawGraph(currentElapsed());

  const padding = 96;
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = canvas.width + padding * 2;
  exportCanvas.height = canvas.height + padding * 2;
  const ex = exportCanvas.getContext("2d");

  // Always export with a clean white share-card background.
  ex.fillStyle = "#ffffff";
  ex.fillRect(0,0,exportCanvas.width,exportCanvas.height);

  // Soft shadow behind timeline artwork.
  ex.shadowColor = "rgba(15,23,42,.14)";
  ex.shadowBlur = 36;
  ex.shadowOffsetY = 18;
  ex.fillStyle = "#ffffff";
  ex.beginPath();
  const r = 34;
  const x = padding - 18;
  const y = padding - 18;
  const ww = canvas.width + 36;
  const hh = canvas.height + 36;
  ex.moveTo(x+r,y);
  ex.lineTo(x+ww-r,y);
  ex.quadraticCurveTo(x+ww,y,x+ww,y+r);
  ex.lineTo(x+ww,y+hh-r);
  ex.quadraticCurveTo(x+ww,y+hh,x+ww-r,y+hh);
  ex.lineTo(x+r,y+hh);
  ex.quadraticCurveTo(x,y+hh,x,y+hh-r);
  ex.lineTo(x,y+r);
  ex.quadraticCurveTo(x,y,x+r,y);
  ex.closePath();
  ex.fill();

  ex.shadowColor = "transparent";
  ex.drawImage(canvas, padding, padding);

  const name = (loadedName || "workout-timeline").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "workout-timeline";
  exportCanvas.toBlob(blob=>{
    if(!blob){
      alert("Could not export timeline image.");
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name}-timeline.png`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  }, "image/png");
}
function exportTCX(){
  if(rideSamples.length < 2){
    alert("Record at least a few seconds before exporting.");
    return;
  }
  const valid = rideSamples;
  const startTime = valid[0].time;
  const totalSec = Math.max(1, Math.round((new Date(valid[valid.length-1].time) - new Date(valid[0].time)) / 1000));
  const avgHr = average(valid.map(s=>s.heartRate));
  const maxHr = Math.max(...valid.map(s=>s.heartRate).filter(v=>Number.isFinite(v)), 0);
  const avgPower = average(valid.map(s=>s.power));
  const maxPower = Math.max(...valid.map(s=>s.power).filter(v=>Number.isFinite(v)), 0);
  const avgCad = average(valid.map(s=>s.cadence));
  const maxCad = Math.max(...valid.map(s=>s.cadence).filter(v=>Number.isFinite(v)), 0);
  const distanceMeters = valid.reduce((dist, s, i)=>{
    if(i === 0 || !Number.isFinite(s.speedKph)) return dist;
    const prev = new Date(valid[i-1].time);
    const now = new Date(s.time);
    const dt = Math.max(0, (now - prev) / 1000);
    return dist + (s.speedKph * 1000 / 3600) * dt;
  }, 0);
  const calories = Math.round((avgPower || 120) * totalSec / 4184);

  const laps = [];
let currentLap = null;

valid.forEach(sample => {
  const lapName = sample.interval || "Ride";

  if (!currentLap || currentLap.name !== lapName) {
    currentLap = {
      name: lapName,
      samples: []
    };
    laps.push(currentLap);
  }

  currentLap.samples.push(sample);
});

  console.log(
  "TCX laps:",
  laps.map(l => ({
    name: l.name,
    samples: l.samples.length
  }))
);

  const lapXml = laps.map(lap => {
  const lapStart = lap.samples[0].time;

  const lapDuration = Math.max(
    1,
    Math.round(
      (new Date(lap.samples[lap.samples.length - 1].time) -
       new Date(lap.samples[0].time)) / 1000
    )
  );

  return `
      <Lap StartTime="${lapStart}">
        <TotalTimeSeconds>${lapDuration}</TotalTimeSeconds>
        <DistanceMeters>0</DistanceMeters>
        <Calories>0</Calories>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
          <!-- TRACKPOINTS WILL GO HERE -->
        </Track>
      </Lap>`;
}).join("\n");

console.log("Generated laps:", laps.length);
  
  let cumulativeDistance = 0;
  const trackpoints = valid.map((s, i)=>{
    const hr = Number.isFinite(s.heartRate) ? `<HeartRateBpm><Value>${Math.round(s.heartRate)}</Value></HeartRateBpm>` : "";
    const cad = Number.isFinite(s.cadence) ? `<Cadence>${Math.round(s.cadence)}</Cadence>` : "";
    const spd = Number.isFinite(s.speedKph) ? `<Speed>${(s.speedKph / 3.6).toFixed(3)}</Speed>` : "";
    const pwr = Number.isFinite(s.power) ? `<Watts>${Math.round(s.power)}</Watts>` : "";
    const target = Number.isFinite(s.targetPower) ? `<ns3:TargetWatts>${Math.round(s.targetPower)}</ns3:TargetWatts>` : "";
    const pct = Number.isFinite(s.targetPct) ? `<ns3:TargetFTPPercent>${Math.round(s.targetPct)}</ns3:TargetFTPPercent>` : "";
    const interval = s.interval ? `<ns3:Interval>${escapeXml(s.interval)}</ns3:Interval>` : "";
    if(i > 0 && Number.isFinite(s.speedKph)){
  const prev = valid[i - 1];
  const dt = Math.max(
    0,
    (new Date(s.time) - new Date(prev.time)) / 1000
  );

  cumulativeDistance += (s.speedKph * 1000 / 3600) * dt;
}

const dist = `<DistanceMeters>${cumulativeDistance.toFixed(1)}</DistanceMeters>`;
    const extensions = (spd || pwr || target || pct || interval) ? `
          <Extensions>
            <ns3:TPX>
              ${spd}
              ${pwr}
              ${target}
              ${pct}
              ${interval}
            </ns3:TPX>
          </Extensions>` : "";
return `        <Trackpoint>
  <Time>${s.time}</Time>
  ${dist}
  ${hr}
  ${cad}
  ${extensions}
</Trackpoint>`;
  }).join("\n");

  const name = loadedName || "Indoor Trainer Workout";
  const plannedSec = Math.max(1, Math.round(totalDuration ? totalDuration() : totalSec));
  const skippedCount = Array.isArray(skippedTimelineGaps) ? skippedTimelineGaps.length : 0;
  const skippedSec = Array.isArray(skippedTimelineGaps)
    ? skippedTimelineGaps.reduce((sum, gap)=>sum + Math.max(0, (gap.end || 0) - (gap.start || 0)), 0)
    : 0;
  const summaryLines = [
    `${formatTime(plannedSec)} planned`,
    `${formatTime(totalSec)} completed`
  ];
  if(skippedCount > 0){
    summaryLines.push(`${skippedCount} interval${skippedCount === 1 ? "" : "s"} skipped`);
  }
  const tcxDescription = summaryLines.join("\n");
  const activityNotes = `${name}\n\n${tcxDescription}`;
  const tcx = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
  <Activities>
    <Activity Sport="Biking">
      <Id>${startTime}</Id>
      <Lap StartTime="${startTime}">
        <TotalTimeSeconds>${totalSec}</TotalTimeSeconds>
        <DistanceMeters>${distanceMeters.toFixed(1)}</DistanceMeters>
        <Calories>${calories}</Calories>
        ${avgHr ? `<AverageHeartRateBpm><Value>${Math.round(avgHr)}</Value></AverageHeartRateBpm>` : ""}
        ${maxHr ? `<MaximumHeartRateBpm><Value>${Math.round(maxHr)}</Value></MaximumHeartRateBpm>` : ""}
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
${trackpoints}
        </Track>
        <Extensions>
          <ns3:LX>
            ${avgPower ? `<ns3:AvgWatts>${Math.round(avgPower)}</ns3:AvgWatts>` : ""}
            ${maxPower ? `<ns3:MaxWatts>${Math.round(maxPower)}</ns3:MaxWatts>` : ""}
            ${avgCad ? `<ns3:AvgCadence>${Math.round(avgCad)}</ns3:AvgCadence>` : ""}
            ${maxCad ? `<ns3:MaxCadence>${Math.round(maxCad)}</ns3:MaxCadence>` : ""}
          </ns3:LX>
        </Extensions>
      </Lap>
      <Notes>${escapeXml(activityNotes)}</Notes>
      <Extensions>
        <ns3:TPX>
          <ns3:WorkoutName>${escapeXml(name)}</ns3:WorkoutName>
          <ns3:WorkoutDescription>${escapeXml(tcxDescription)}</ns3:WorkoutDescription>
          <ns3:PlannedSeconds>${plannedSec}</ns3:PlannedSeconds>
          <ns3:CompletedSeconds>${totalSec}</ns3:CompletedSeconds>
          <ns3:SkippedIntervals>${skippedCount}</ns3:SkippedIntervals>
          <ns3:SkippedSeconds>${Math.round(skippedSec)}</ns3:SkippedSeconds>
        </ns3:TPX>
      </Extensions>
      <Creator xsi:type="Device_t">
        <Name>Indoor Trainer Workout Player</Name>
        <UnitId>1</UnitId>
        <ProductID>1</ProductID>
        <Version>
          <VersionMajor>0</VersionMajor>
          <VersionMinor>6</VersionMinor>
          <BuildMajor>0</BuildMajor>
          <BuildMinor>0</BuildMinor>
        </Version>
      </Creator>
    </Activity>
  </Activities>
  <Author xsi:type="Application_t">
    <Name>Indoor Trainer Workout Player</Name>
    <Build>
      <Version>
        <VersionMajor>0</VersionMajor>
        <VersionMinor>6</VersionMinor>
      </Version>
    </Build>
    <LangID>en</LangID>
    <PartNumber>000-00000-00</PartNumber>
  </Author>
</TrainingCenterDatabase>`;

  const safeName = (name || "indoor-workout").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || "indoor-workout";
  const rideDate = new Date(startTime).toISOString().slice(0,10);
  const durationTag = formatTime(totalSec).replace(/:/g,"-");
  const blob = new Blob([tcx], {type:"application/vnd.garmin.tcx+xml"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${safeName}_${rideDate}_${durationTag}.tcx`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}

const WORKOUT_LIBRARY_KEY = "indoorTrainerWorkoutLibrary_v1";
let activeLibraryCategory = "";
let activeLibraryLabel = "";

function getWorkoutLibrary(){
  try{
    return JSON.parse(localStorage.getItem(WORKOUT_LIBRARY_KEY) || "[]");
  }catch(e){
    return [];
  }
}
function setWorkoutLibrary(items){
  localStorage.setItem(WORKOUT_LIBRARY_KEY, JSON.stringify(items));
}
function normaliseLabels(value){
  return String(value || "")
    .split(",")
    .map(v=>v.trim())
    .filter(Boolean);
}
function saveLoadedWorkout(){
  if(!loadedZwoText || !loadedName){
    alert("Load a ZWO workout first.");
    return;
  }
  const category = $("libraryCategory").value.trim() || "Uncategorised";
  const labels = normaliseLabels($("libraryLabels").value);
  const library = getWorkoutLibrary();
  const id = "w_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8);
  const totalSec = totalDuration();
  library.unshift({
    id,
    name: loadedName,
    category,
    labels,
    totalSec,
    zwoText: loadedZwoText,
    savedAt: new Date().toISOString()
  });
  setWorkoutLibrary(library);
  renderWorkoutLibrary();
}

function inferWorkoutCategoryFromBlocks(blocks){
  if(!blocks || !blocks.length) return "Uncategorised";
  const values = blocks.map(b=>{
    if(b.low !== undefined || b.high !== undefined){
      return ((Number(b.low || b.power || 0) + Number(b.high || b.power || 0)) / 2) * 100;
    }
    return Number(b.power || 0) * 100;
  });
  const maxPct = Math.max(...values);
  const avgPct = values.reduce((a,b)=>a+b,0) / values.length;
  if(maxPct >= 120) return "Anaerobic";
  if(maxPct >= 106) return "VO2";
  if(avgPct >= 90 || maxPct >= 95) return "Threshold";
  if(avgPct >= 76) return "Tempo";
  if(avgPct >= 56) return "Endurance";
  return "Recovery";
}
function suggestedLabelsForWorkout(blocks){
  const labels = [];
  const duration = totalDuration();
  if(duration && duration <= 2700) labels.push("short");
  else if(duration >= 5400) labels.push("long");
  if(blocks && blocks.some(b=>String(b.source || "").includes("IntervalsT") || String(b.type || "").includes("Interval"))) labels.push("intervals");
  const maxPct = Math.max(...(blocks || []).map(b=>{
    if(b.low !== undefined || b.high !== undefined){
      return ((Number(b.low || b.power || 0) + Number(b.high || b.power || 0)) / 2) * 100;
    }
    return Number(b.power || 0) * 100;
  }), 0);
  if(maxPct >= 106) labels.push("hard");
  return labels;
}
function saveCurrentLoadedWorkoutToLibrary(options={}){
  if(!loadedZwoText || !loadedName) return false;
  const category = (options.category || $("libraryCategory").value || "Uncategorised").trim() || "Uncategorised";
  const labels = Array.isArray(options.labels) ? options.labels : normaliseLabels($("libraryLabels").value);
  const library = getWorkoutLibrary();
  const id = "w_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8);
  library.unshift({
    id,
    name: loadedName,
    category,
    labels,
    totalSec: totalDuration(),
    zwoText: loadedZwoText,
    savedAt: new Date().toISOString()
  });
  setWorkoutLibrary(library);
  renderWorkoutLibrary();
  return true;
}
function importAndSaveZwoFile(file){
  if(!file) return;
  const fallbackName = file.name.replace(/\.zwo$|\.xml$/i,"");
  const customName = prompt("Name this workout:", fallbackName);
  if(customName === null){
    const input = $("importSaveZwoInput");
    if(input) input.value = "";
    return;
  }
  const finalName = (customName.trim() || fallbackName);
  const status = $("importSaveStatus");
  if(status) status.textContent = "Importing " + finalName + "…";
  const reader = new FileReader();
  reader.onload = e => {
    parseZwo(e.target.result, finalName);
    const category = inferWorkoutCategoryFromBlocks(workout);
    const labels = suggestedLabelsForWorkout(workout);
    $("libraryCategory").value = category;
    $("libraryLabels").value = labels.join(", ");
    const saved = saveCurrentLoadedWorkoutToLibrary({category, labels});
    if(status) status.textContent = saved ? `Saved “${finalName}” to your workout library.` : "Import complete, but save failed.";
    const input = $("importSaveZwoInput");
    if(input) input.value = "";
  };
  reader.readAsText(file);
}
function loadSavedWorkout(id){
  if(id === "__ftp_ramp_test__"){ loadBuiltInFtpRampTest(); return; }
  const item = getWorkoutLibrary().find(w=>w.id === id);
  if(!item) return;
  parseZwo(item.zwoText, item.name);
  $("libraryCategory").value = item.category || "";
  $("libraryLabels").value = (item.labels || []).join(", ");
  closeSavedWorkouts();
}
function deleteSavedWorkout(id){
  if(!confirm("Delete this saved workout?")) return;
  const next = getWorkoutLibrary().filter(w=>w.id !== id);
  setWorkoutLibrary(next);
  renderWorkoutLibrary();
}

function editSavedWorkout(id){
  const row = document.querySelector(`[data-workout-id="${id}"]`);
  if(row) row.classList.add("editing");
}
function cancelEditSavedWorkout(id){
  const row = document.querySelector(`[data-workout-id="${id}"]`);
  if(row) row.classList.remove("editing");
}
function updateSavedWorkout(id){
  const library = getWorkoutLibrary();
  const item = library.find(w=>w.id === id);
  if(!item) return;

  const nameInput = document.getElementById(`editName_${id}`);
  const categoryInput = document.getElementById(`editCategory_${id}`);
  const labelsInput = document.getElementById(`editLabels_${id}`);

  item.name = (nameInput?.value || item.name).trim() || item.name;
  item.category = (categoryInput?.value || "Uncategorised").trim() || "Uncategorised";
  item.labels = normaliseLabels(labelsInput?.value || "");
  item.updatedAt = new Date().toISOString();

  setWorkoutLibrary(library);
  renderWorkoutLibrary();

  if(loadedZwoText === item.zwoText){
    loadedName = item.name;
    $("zwoStatus").textContent = loadedName;
    $("blocksTitle").textContent = loadedName || "Blocks";
    $("libraryCategory").value = item.category || "";
    $("libraryLabels").value = (item.labels || []).join(", ");
    render();
  }
}
function getBlockPctForLibrary(block){
  if(!block) return 0.5;
  if(Number.isFinite(block.power)) return block.power;
  if(Number.isFinite(block.low) && Number.isFinite(block.high)) return (block.low + block.high) / 2;
  return 0.5;
}
function ftpRampPreviewZwo(){
  const base = ftp();
  const start = rampStartWattsForFtp(base);
  const step = rampStepWattsForFtp(base);
  let xml = '<workout_file><name>FTP Ramp Test</name><workout><Warmup Duration="300" PowerLow="0.45" PowerHigh="0.65"/>';
  for(let w=start; w<=start+step*12; w+=step){
    xml += `<SteadyState Duration="60" Power="${(w/base).toFixed(4)}"/>`;
  }
  xml += '</workout></workout_file>';
  return xml;
}
function workoutSparklineSvg(zwoText){
  try{
    const doc = new DOMParser().parseFromString(zwoText || "", "application/xml");
    const parserError = doc.querySelector("parsererror");
    if(parserError) throw new Error("bad xml");
    const nodes = Array.from(doc.querySelectorAll("workout > *"));
    const blocks = [];
    nodes.forEach(n=>{
      const tag = n.tagName;
      if(tag === "Warmup" || tag === "Cooldown"){
        blocks.push({duration:Number(getAttr(n,"Duration",0)), pct:(Number(getAttr(n,"PowerLow",0.5))+Number(getAttr(n,"PowerHigh",0.7)))/2});
      }else if(tag === "SteadyState" || tag === "FreeRide"){
        blocks.push({duration:Number(getAttr(n,"Duration",0)), pct:Number(getAttr(n,"Power",0.6))});
      }else if(tag === "IntervalsT"){
        const repeat = Number(getAttr(n,"Repeat",1));
        const onDur = Number(getAttr(n,"OnDuration",0));
        const offDur = Number(getAttr(n,"OffDuration",0));
        for(let i=0;i<repeat;i++){
          blocks.push({duration:onDur, pct:Number(getAttr(n,"OnPower",1.0))});
          blocks.push({duration:offDur, pct:Number(getAttr(n,"OffPower",0.5))});
        }
      }
    });
    const clean = blocks.filter(b=>b.duration > 0);
    const total = clean.reduce((s,b)=>s+b.duration,0) || 1;
    let x = 0;
    const rects = clean.map(b=>{
      const w = Math.max(2, (b.duration / total) * 120);
      const h = Math.max(5, Math.min(40, b.pct * 34));
      const y = 43 - h;
      const hue = b.pct < .6 ? "#bfdbfe" : b.pct < .76 ? "#bbf7d0" : b.pct < .9 ? "#fde68a" : b.pct < 1.05 ? "#fed7aa" : "#fecdd3";
      const out = `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="2" fill="${hue}"/>`;
      x += w;
      return out;
    }).join("");
    return `<svg viewBox="0 0 120 46" preserveAspectRatio="none" aria-hidden="true"><rect width="120" height="46" fill="transparent"/>${rects}</svg>`;
  }catch(e){
    return `<svg viewBox="0 0 120 46" preserveAspectRatio="none" aria-hidden="true"><path d="M0 35 L25 35 L25 24 L55 24 L55 14 L84 14 L84 31 L120 31" fill="none" stroke="#bae6fd" stroke-width="5" stroke-linejoin="round"/></svg>`;
  }
}
function setLibraryCategoryFilter(category){
  activeLibraryCategory = category || "";
  const legacy = $("libraryCategoryFilter");
  if(legacy) legacy.value = activeLibraryCategory;
  renderWorkoutLibrary();
}
function setLibraryLabelFilter(label){
  activeLibraryLabel = label || "";
  renderWorkoutLibrary();
}
function toggleFavouriteWorkout(id){
  const library = getWorkoutLibrary();
  const item = library.find(w=>w.id === id);
  if(!item) return;
  item.favourite = !item.favourite;
  setWorkoutLibrary(library);
  renderWorkoutLibrary();
}
function renderWorkoutLibrary(){
  const list = $("savedWorkoutList");
  if(!list) return;

  $("saveWorkoutBtn").disabled = !loadedZwoText;

  const userLibrary = getWorkoutLibrary();
  const builtInRamp = {
    id:"__ftp_ramp_test__",
    name:"FTP Ramp Test",
    category:"Tests",
    labels:["ftp","ramp test","built-in"],
    totalSec:0,
    savedAt:"Built-in",
    builtIn:true
  };
  const library = [builtInRamp, ...userLibrary];
  const search = ($("librarySearch")?.value || "").trim().toLowerCase();
  const selectedCategory = activeLibraryCategory || ($("libraryCategoryFilter")?.value || "");
  const selectedLabel = activeLibraryLabel || "";
  const sort = $("librarySort")?.value || "recent";

  const categories = Array.from(new Set(library.map(w=>w.category || "Uncategorised"))).sort();
  const labels = Array.from(new Set(library.flatMap(w=>w.labels || []))).sort();

  const categoryOptions = $("libraryCategoryOptions");
  if(categoryOptions){
    categoryOptions.innerHTML = categories.map(cat=>`<option value="${escapeXml(cat)}"></option>`).join("");
  }

  const legacyFilter = $("libraryCategoryFilter");
  if(legacyFilter){
    legacyFilter.innerHTML = '<option value="">All categories</option>' + categories.map(cat=>{
      const selected = cat === selectedCategory ? " selected" : "";
      return `<option value="${escapeXml(cat)}"${selected}>${escapeXml(cat)}</option>`;
    }).join("");
  }

  const categoryChips = $("libraryCategoryChips");
  if(categoryChips){
    categoryChips.innerHTML = [`<button type="button" class="filter-chip ${!selectedCategory ? "active" : ""}" onclick="setLibraryCategoryFilter('')">All</button>`]
      .concat(categories.map(cat=>`<button type="button" class="filter-chip ${cat === selectedCategory ? "active" : ""}" onclick="setLibraryCategoryFilter('${escapeJs(cat)}')">${escapeXml(cat)}</button>`))
      .join("");
  }

  const labelChips = $("libraryLabelChips");
  if(labelChips){
    if(labels.length){
      labelChips.innerHTML = [`<button type="button" class="filter-chip ${!selectedLabel ? "active" : ""}" onclick="setLibraryLabelFilter('')">All</button>`]
        .concat(labels.map(label=>`<button type="button" class="filter-chip ${label === selectedLabel ? "active" : ""}" onclick="setLibraryLabelFilter('${escapeJs(label)}')">${escapeXml(label)}</button>`))
        .join("");
    }else{
      labelChips.innerHTML = `<span class="small">No labels yet.</span>`;
    }
  }

  let filtered = library.filter(w=>{
    const haystack = [w.name, w.category, ...(w.labels || [])].join(" ").toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    const matchesCategory = !selectedCategory || (w.category || "Uncategorised") === selectedCategory;
    const matchesLabel = !selectedLabel || (w.labels || []).includes(selectedLabel);
    return matchesSearch && matchesCategory && matchesLabel;
  });

  filtered = filtered.slice().sort((a,b)=>{
    if(sort === "name") return String(a.name || "").localeCompare(String(b.name || ""));
    if(sort === "duration_short") return (a.totalSec || 0) - (b.totalSec || 0);
    if(sort === "duration_long") return (b.totalSec || 0) - (a.totalSec || 0);
    if(sort === "category") return String(a.category || "Uncategorised").localeCompare(String(b.category || "Uncategorised")) || String(a.name || "").localeCompare(String(b.name || ""));
    if(sort === "favourite") return Number(!!b.favourite) - Number(!!a.favourite) || String(b.savedAt || "").localeCompare(String(a.savedAt || ""));
    return String(b.savedAt || "").localeCompare(String(a.savedAt || ""));
  });

  if(!filtered.length){
    list.innerHTML = `<div class="library-empty">No saved workouts match this view.</div>`;
    return;
  }

  list.innerHTML = filtered.map(w=>{
    const safeId = escapeXml(w.id);
    const category = w.category || "Uncategorised";
    const labelsHtml = (w.labels || []).map(label=>`<span class="saved-workout-tag">${escapeXml(label)}</span>`).join("");
    const savedDate = w.builtIn ? "Built-in test" : (w.savedAt ? new Date(w.savedAt).toLocaleDateString() : "Saved workout");
    const durationText = w.builtIn ? `Starts ${rampStartWattsForFtp(ftp())}w • +${rampStepWattsForFtp(ftp())}w/min` : formatTime(w.totalSec || 0);
    return `
      <div class="saved-workout-item" data-workout-id="${safeId}">
        <div class="saved-workout-main">
          <div class="saved-workout-row">
            <div class="workout-spark">${w.builtIn ? workoutSparklineSvg(ftpRampPreviewZwo()) : workoutSparklineSvg(w.zwoText)}</div>
            <div>
              <div class="saved-workout-title">${escapeXml(w.name)}</div>
              <div class="saved-workout-meta">${durationText} • ${savedDate}</div>
              <div class="saved-workout-tags">
                <span class="saved-workout-tag category">${escapeXml(category)}</span>
                ${labelsHtml}
              </div>
            </div>
            <div class="saved-workout-actions">
              ${w.builtIn ? `<button type="button" onclick="loadSavedWorkout('${safeId}')">Load</button>` : `<button type="button" class="ghost star-btn" title="Favourite" onclick="toggleFavouriteWorkout('${safeId}')">${w.favourite ? "★" : "☆"}</button>
              <button type="button" onclick="loadSavedWorkout('${safeId}')">Load</button>
              <button type="button" class="ghost" onclick="editSavedWorkout('${safeId}')">Edit</button>
              <button type="button" class="ghost" onclick="deleteSavedWorkout('${safeId}')">Delete</button>`}
            </div>
          </div>
        </div>
        <div class="saved-workout-edit">
          <div>
            <label>Name</label>
            <input id="editName_${safeId}" type="text" value="${escapeXml(w.name)}">
          </div>
          <div>
            <label>Category</label>
            <input id="editCategory_${safeId}" type="text" list="libraryCategoryOptions" value="${escapeXml(category)}">
          </div>
          <div style="grid-column:1 / -1">
            <label>Labels</label>
            <input id="editLabels_${safeId}" type="text" value="${escapeXml((w.labels || []).join(", "))}">
          </div>
          <div class="saved-workout-edit-actions">
            <button type="button" onclick="updateSavedWorkout('${safeId}')">Save</button>
            <button type="button" class="ghost" onclick="cancelEditSavedWorkout('${safeId}')">Cancel</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}
function handleFile(file){
  if(!file) return;
  const fallbackName = file.name.replace(/\.zwo$|\.xml$/i,"");
  const customName = prompt("Name this workout:", fallbackName);
  if(customName === null) return;
  const finalName = (customName.trim() || fallbackName);
  const reader = new FileReader();
  reader.onload = e => parseZwo(e.target.result, finalName);
  reader.readAsText(file);
}

$("focusToggleBtn").addEventListener("click", toggleFocusPanel);
$("openSavedWorkoutsBtn").addEventListener("click", openSavedWorkouts);
$("closeSavedWorkoutsBtn").addEventListener("click", closeSavedWorkouts);
$("savedWorkoutsOverlay").addEventListener("click", closeSavedWorkouts);
$("darkModeToggle").addEventListener("change", toggleDarkMode);
$("ftpInput").addEventListener("change", render);
$("ftpInput").addEventListener("blur", render);
$("connectHrBtn").addEventListener("click", connectHR);
$("connectTrainerBtn").addEventListener("click", connectTrainer);

function handleMetricCardActivate(kind){
  if(kind === "hr"){
    if(!$("hrMetricCard").classList.contains("connect-cta")) return;
    connectHR();
  }else{
    if(!$("powerMetricCard").classList.contains("connect-cta")) return;
    connectTrainer();
  }
}
$("hrMetricCard").addEventListener("click", ()=>handleMetricCardActivate("hr"));
$("powerMetricCard").addEventListener("click", ()=>handleMetricCardActivate("trainer"));
$("hrMetricCard").addEventListener("keydown", e=>{
  if(e.key === "Enter" || e.code === "Space"){
    e.preventDefault();
    handleMetricCardActivate("hr");
  }
});
$("powerMetricCard").addEventListener("keydown", e=>{
  if(e.key === "Enter" || e.code === "Space"){
    e.preventDefault();
    handleMetricCardActivate("trainer");
  }
});

$("zwoInput").addEventListener("change", e=>handleFile(e.target.files[0]));
$("importSaveZwoBtn").addEventListener("click", ()=>$("importSaveZwoInput").click());
$("importSaveZwoInput").addEventListener("change", e=>importAndSaveZwoFile(e.target.files[0]));
$("startBtn").addEventListener("click", start);
$("pauseBtn").addEventListener("click", pause);
$("resetBtn").addEventListener("click", reset);
if($("skipIntervalBtn")) $("skipIntervalBtn").addEventListener("click", skipInterval);
if($("extendInterval1Btn")) $("extendInterval1Btn").addEventListener("click", ()=>extendCurrentInterval(60));
if($("extendInterval25Btn")) $("extendInterval25Btn").addEventListener("click", ()=>extendCurrentInterval(150));
if($("extendInterval5Btn")) $("extendInterval5Btn").addEventListener("click", ()=>extendCurrentInterval(300));
$("closeWorkoutEndBtn").addEventListener("click", closeWorkoutEndModal);
$("workoutEndOverlay").addEventListener("click", closeWorkoutEndModal);
$("saveSummaryScreenshotBtn").addEventListener("click", saveSummaryScreenshot);
if($("exportTcxBtn")) $("exportTcxBtn").addEventListener("click", exportTCX);
if($("modalExportTcxBtn")) $("modalExportTcxBtn").addEventListener("click", exportTCX);
$("logWorkoutBtn").addEventListener("click", ()=>alert("Calendar logging placeholder — coming soon."));
$("uploadStravaBtn").addEventListener("click", ()=>alert("Strava upload placeholder — coming soon."));
$("discardWorkoutBtn").addEventListener("click", clearLoadedWorkout);
$("updateFtpBtn").addEventListener("click", updateFtpFromRampTest);
$("keepFtpBtn").addEventListener("click", keepCurrentFtpFromRampTest);
$("confirmStopYesBtn").addEventListener("click", ()=>{
  if(startRampCooldownAfterFailure()) return;
  closeStopConfirmModal();
  finishWorkout("stopped");
});
$("confirmStopNoBtn").addEventListener("click", returnToReadyFromStopCancel);
$("stopConfirmOverlay").addEventListener("click", returnToReadyFromStopCancel);

const dropZone = $("dropZone");
if(dropZone){
  dropZone.addEventListener("dragover", e=>{e.preventDefault(); dropZone.classList.add("dragover");});
  dropZone.addEventListener("dragleave", ()=>dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", e=>{
    e.preventDefault();
    dropZone.classList.remove("dragover");
    handleFile(e.dataTransfer.files[0]);
  });
  dropZone.addEventListener("click", ()=>{
    importSaveMode = false;
    $("zwoInput").click();
  });
}


// Phase 13.15: automatically shrink HUD text slightly if the panel would clip.
function fitHudPanel(){
  const panel = document.querySelector('.timeline-hud-panel');
  if(!panel) return;
  panel.style.setProperty('--hud-scale', '1');
  // Let layout settle before measuring.
  requestAnimationFrame(()=>{
    let scale = 1;
    const hasOverflow = () => panel.scrollWidth > panel.clientWidth + 2 || panel.scrollHeight > panel.clientHeight + 2;
    while(hasOverflow() && scale > 0.64){
      scale = Math.round((scale - 0.03) * 100) / 100;
      panel.style.setProperty('--hud-scale', String(scale));
    }
  });
}
function initHudAutoscale(){
  fitHudPanel();
  window.addEventListener('resize', fitHudPanel);
  const panel = document.querySelector('.timeline-hud-panel');
  if(panel && 'ResizeObserver' in window){
    const ro = new ResizeObserver(()=>fitHudPanel());
    ro.observe(panel);
    panel._hudResizeObserver = ro;
  }
  ['hrVal','powerVal','cadenceVal','intervalCountdownText','totalCountdownText'].forEach(id=>{
    const el = $(id);
    if(!el || el._hudFitObserver) return;
    const observer = new MutationObserver(()=>fitHudPanel());
    observer.observe(el, {childList:true, characterData:true, subtree:true});
    el._hudFitObserver = observer;
  });
}

if(!supportsBluetooth()){
  setStatus("hr", "bad", "Web Bluetooth unavailable in this browser");
  setStatus("trainer", "bad", "Web Bluetooth unavailable in this browser");
  setErgStatus("bad", "Web Bluetooth unavailable");
}else{
  setStatus("hr", "", "Not connected");
  setStatus("trainer", "", "Not connected");
  setErgStatus("", "Connect trainer first");
}
enableErgButtons(false);
initialiseTheme();
updateAutoErgUi();
updateRecordingUi();
updateScoreUi();
initMetricAnimations();
initHudAutoscale();
renderWorkoutLibrary();
updateReadyUi();
render();
setControls();
setTimeout(()=>{ updateMetricConnectionCards(); fitHudPanel(); }, 0);

document.addEventListener("keydown", e=>{
  const active = document.activeElement;
  const tag = (active && active.tagName || "").toLowerCase();
  const typing = tag === "input" || tag === "textarea" || tag === "select" || (active && active.isContentEditable);

  if(!typing && e.key === "Enter"){
    e.preventDefault();
    if(stopConfirmOpen){ returnToReadyFromStopCancel(); return; }
    if(workout.length && !playing && !workoutCompleted) start();
    return;
  }

  if(!typing && e.code === "Space"){
    e.preventDefault();
    if(workout.length && !workoutCompleted) pause();
    return;
  }

  if(!typing && e.key === "ArrowLeft"){
    e.preventDefault();
    hideSetupPanel();
    return;
  }

  if(!typing && e.key === "ArrowRight"){
    e.preventDefault();
    showSetupPanel();
    return;
  }

  // Allow intensity shortcuts while focus is on the slider, but avoid hijacking text inputs.
  if(typing && active && active.id !== "intensitySlider") return;

  if(e.key === "ArrowUp"){
    e.preventDefault();
    adjustIntensity(1);
    return;
  }

  if(e.key === "ArrowDown"){
    e.preventDefault();
    adjustIntensity(-1);
    return;
  }
});

// ===== Script block 2 from original Trainer App =====
window.futureStravaSummaryFormatter = function(summary){
  const planned = summary?.plannedDuration || "0:00";
  const completed = summary?.completedDuration || "0:00";
  const skipped = summary?.intervalsSkipped || 0;
  const extended = summary?.extendedDuration || null;
  const ftp = summary?.ftpUpdate || null;

  let lines = [
    `${planned} planned`,
    `${completed} completed`
  ];

  if(skipped > 0){
    lines.push(`${skipped} interval${skipped === 1 ? "" : "s"} skipped`);
  }

  if(extended){
    lines.push(`+${extended} extended`);
  }

  if(ftp){
    lines.push(`FTP updated to ${ftp}W`);
  }

  return lines.join("\n");
};

// ===== Script block 3 from original Trainer App =====
(function(){
  function isTypingTarget(el){
    if(!el) return false;
    const tag = (el.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
  }

  function clickIfAvailable(id){
    const el = document.getElementById(id);
    if(el && !el.disabled){
      el.click();
      return true;
    }
    return false;
  }

  function adjustIntensity(delta){
    const slider = document.getElementById("intensitySlider");
    if(slider){
      const current = Number(slider.value || 100);
      const min = Number(slider.min || 50);
      const max = Number(slider.max || 150);
      const next = Math.max(min, Math.min(max, current + delta));
      slider.value = String(next);
      slider.dispatchEvent(new Event("input", {bubbles:true}));
      slider.dispatchEvent(new Event("change", {bubbles:true}));
      return true;
    }

    const chip = document.getElementById("intensityChip");
    if(typeof intensityFactor !== "undefined"){
      intensityFactor = Math.max(.5, Math.min(1.5, intensityFactor + delta / 100));
      if(chip) chip.textContent = `${Math.round(intensityFactor * 100)}%`;
      if(typeof updateTarget === "function") updateTarget();
      return true;
    }
    return false;
  }

  function setSetupVisible(show){
    const body = document.body;
    if(!body) return false;
    body.classList.toggle("sidebar-collapsed", !show);
    try{ localStorage.setItem("sidebarCollapsed", show ? "0" : "1"); }catch(e){}
    return true;
  }

  document.addEventListener("keydown", function(e){
    if(isTypingTarget(e.target)) return;

    const key = e.key;
    let handled = false;

    if(key === "Enter"){
      handled = clickIfAvailable("readyBtn") || clickIfAvailable("resumeBtn") || clickIfAvailable("startBtn");
    }else if(key === " " || key === "Spacebar"){
      handled = clickIfAvailable("pauseBtn");
    }else if(key === "ArrowUp"){
      handled = adjustIntensity(1);
    }else if(key === "ArrowDown"){
      handled = adjustIntensity(-1);
    }else if(key === "ArrowLeft"){
      handled = setSetupVisible(false);
    }else if(key === "ArrowRight"){
      handled = setSetupVisible(true);
    }

    if(handled){
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
})();

// ===== Script block 4 from original Trainer App =====
(function(){
  function lockRideViewport(){
    if(!document.body || !document.body.classList.contains("ride-mode")) return;
    const h = (window.visualViewport && window.visualViewport.height) ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty("--ride-vh", `${h}px`);
    document.documentElement.style.height = `${h}px`;
    document.documentElement.style.maxHeight = `${h}px`;
    document.body.style.height = `${h}px`;
    document.body.style.maxHeight = `${h}px`;
    document.body.style.overflow = "hidden";
  }

  window.addEventListener("resize", lockRideViewport, {passive:true});
  if(window.visualViewport){
    window.visualViewport.addEventListener("resize", lockRideViewport, {passive:true});
    window.visualViewport.addEventListener("scroll", lockRideViewport, {passive:true});
  }
  document.addEventListener("fullscreenchange", lockRideViewport);
  setInterval(lockRideViewport, 750);
  lockRideViewport();
})();

// ===== Script block 5 from original Trainer App =====
(function(){
  function getViewportHeight(){
    if(window.visualViewport && window.visualViewport.height){
      return Math.floor(window.visualViewport.height);
    }
    return Math.floor(window.innerHeight || document.documentElement.clientHeight || 720);
  }

  function fitRideLayout(){
    const root = document.documentElement;
    const body = document.body;
    if(!body) return;

    const ride = body.classList.contains("ride-mode");
    root.classList.toggle("ride-locked", ride);

    if(!ride){
      root.style.removeProperty("--ride-vh");
      root.style.removeProperty("--ride-controls-h");
      root.style.removeProperty("--ride-timeline-h");
      root.style.height = "";
      root.style.maxHeight = "";
      body.style.height = "";
      body.style.maxHeight = "";
      body.style.overflow = "";
      return;
    }

    const vh = getViewportHeight();
    const width = Math.floor(window.innerWidth || document.documentElement.clientWidth || 1200);
    const pad = vh < 640 ? 5 : (vh < 760 ? 6 : 8);
    const gap = vh < 640 ? 5 : (vh < 760 ? 6 : 8);

    let controlsH;
    if(width <= 1100){
      controlsH = Math.min(178, Math.max(150, Math.round(vh * 0.24)));
    }else if(vh < 640){
      controlsH = 62;
    }else if(vh < 760){
      controlsH = Math.min(84, Math.max(66, Math.round(vh * 0.10)));
    }else{
      controlsH = Math.min(108, Math.max(78, Math.round(vh * 0.105)));
    }

    let timelineH = vh - (pad * 2) - gap - controlsH;
    if(timelineH < 260){
      controlsH = Math.max(56, controlsH - (260 - timelineH));
      timelineH = vh - (pad * 2) - gap - controlsH;
    }

    root.style.setProperty("--ride-vh", `${vh}px`);
    root.style.setProperty("--ride-pad", `${pad}px`);
    root.style.setProperty("--ride-gap", `${gap}px`);
    root.style.setProperty("--ride-controls-h", `${controlsH}px`);
    root.style.setProperty("--ride-timeline-h", `${Math.max(220, timelineH)}px`);

    root.style.height = `${vh}px`;
    root.style.maxHeight = `${vh}px`;
    body.style.height = `${vh}px`;
    body.style.maxHeight = `${vh}px`;
    body.style.overflow = "hidden";

    const app = document.querySelector(".app");
    const player = document.querySelector(".player");
    const timeline = document.querySelector(".timeline");
    const controls = document.querySelector(".ride-controls-column");
    const graph = document.getElementById("graph");

    if(app){
      app.style.height = `${vh}px`;
      app.style.maxHeight = `${vh}px`;
      app.style.overflow = "hidden";
    }
    if(player){
      player.style.height = `${vh - pad * 2}px`;
      player.style.maxHeight = `${vh - pad * 2}px`;
      player.style.overflow = "hidden";
      player.style.gridTemplateRows = `${Math.max(220, timelineH)}px ${controlsH}px`;
    }
    if(timeline){
      timeline.style.height = `${Math.max(220, timelineH)}px`;
      timeline.style.maxHeight = `${Math.max(220, timelineH)}px`;
      timeline.style.overflow = "hidden";
    }
    if(controls){
      controls.style.height = `${controlsH}px`;
      controls.style.maxHeight = `${controlsH}px`;
      controls.style.overflow = "hidden";
    }
    if(graph){
      const header = timeline ? timeline.querySelector(".timeline-header, .timeline-header-clean") : null;
      const headerH = header ? Math.ceil(header.getBoundingClientRect().height) : 44;
      const graphH = Math.max(180, Math.max(220, timelineH) - headerH - (pad * 2) - gap);
      graph.style.height = `${graphH}px`;
      graph.style.maxHeight = `${graphH}px`;
    }

    window.scrollTo(0,0);
  }

  window.fitRideLayout = fitRideLayout;
  window.addEventListener("resize", fitRideLayout, {passive:true});
  window.addEventListener("orientationchange", fitRideLayout, {passive:true});
  if(window.visualViewport){
    window.visualViewport.addEventListener("resize", fitRideLayout, {passive:true});
    window.visualViewport.addEventListener("scroll", fitRideLayout, {passive:true});
  }
  document.addEventListener("fullscreenchange", fitRideLayout);
  document.addEventListener("DOMContentLoaded", fitRideLayout);

  const observer = new MutationObserver(fitRideLayout);
  observer.observe(document.documentElement, {attributes:true, childList:false, subtree:false});
  if(document.body){
    observer.observe(document.body, {attributes:true, attributeFilter:["class"]});
  }

  setTimeout(fitRideLayout, 50);
  setTimeout(fitRideLayout, 300);
  setInterval(function(){
    if(document.body && document.body.classList.contains("ride-mode")) fitRideLayout();
  }, 1000);
})();

// ===== Script block 6 from original Trainer App =====
(function(){
  function dockTimelineControls(){
    const timeline = document.querySelector(".timeline");
    const graph = document.getElementById("graph");
    const hud = document.querySelector(".timeline-hud-panel");
    if(!timeline || !graph || !hud) return;

    let dock = document.querySelector(".timeline-control-dock");
    if(!dock){
      dock = document.createElement("div");
      dock.className = "timeline-control-dock";
    }

    const slider = document.getElementById("intensitySlider");
    const chip = document.getElementById("intensityChip");
    const minus = document.getElementById("intensityMinusBtn") || document.querySelector("[data-intensity-minus]");
    const plus = document.getElementById("intensityPlusBtn") || document.querySelector("[data-intensity-plus]");
    const skip = document.getElementById("skipIntervalBtn") || document.querySelector(".skip-interval-btn") || document.querySelector("[data-skip-interval]");

    [slider, chip, minus, plus, skip].forEach(el=>{
      if(el && el.parentElement !== dock){
        dock.appendChild(el);
      }
    });

    if(!dock.parentElement){
      timeline.insertBefore(dock, hud);
    }else if(dock.previousElementSibling !== graph && dock.nextElementSibling !== hud){
      timeline.insertBefore(dock, hud);
    }else{
      timeline.insertBefore(dock, hud);
    }

    if(skip) skip.classList.add("skip-interval-btn");
  }

  document.addEventListener("DOMContentLoaded", dockTimelineControls);
  setTimeout(dockTimelineControls, 100);
  setTimeout(dockTimelineControls, 600);
  window.addEventListener("resize", dockTimelineControls, {passive:true});
})();

// ===== Script block 7 from original Trainer App =====
(function(){
  function dockAllIntervalControls(){
    const timeline = document.querySelector(".timeline");
    const hud = document.querySelector(".timeline-hud-panel");
    if(!timeline || !hud) return;

    let dock = document.querySelector(".timeline-control-dock");
    if(!dock){
      dock = document.createElement("div");
      dock.className = "timeline-control-dock";
      timeline.insertBefore(dock, hud);
    }

    const items = [
      document.getElementById("intensitySlider"),
      document.getElementById("intensityChip"),
      document.getElementById("intensityMinusBtn") || document.querySelector("[data-intensity-minus]"),
      document.getElementById("intensityPlusBtn") || document.querySelector("[data-intensity-plus]"),
      document.getElementById("skipIntervalBtn") || document.querySelector(".skip-interval-btn") || document.querySelector("[data-skip-interval]")
    ];

    const extendButtons = Array.from(document.querySelectorAll("button")).filter(btn=>{
      const text = (btn.textContent || "").replace(/\s+/g," ").trim().toLowerCase();
      return text === "+1min" ||
             text === "+1 min" ||
             text === "+1m" ||
             text === "+2.5min" ||
             text === "+2:30" ||
             text === "+2.5 min" ||
             text === "+5min" ||
             text === "+5 min" ||
             text === "+5m";
    });

    items.concat(extendButtons).forEach(el=>{
      if(el && el.parentElement !== dock){
        dock.appendChild(el);
      }
      if(el && extendButtons.includes(el)){
        el.classList.add("extend-interval-btn");
      }
    });

    const skip = items[4];
    if(skip) skip.classList.add("skip-interval-btn");

    timeline.insertBefore(dock, hud);
  }

  document.addEventListener("DOMContentLoaded", dockAllIntervalControls);
  setTimeout(dockAllIntervalControls, 100);
  setTimeout(dockAllIntervalControls, 600);
  setTimeout(dockAllIntervalControls, 1200);
  window.addEventListener("resize", dockAllIntervalControls, {passive:true});
})();

// ===== Script block 8 from original Trainer App =====
(function(){
  function dockExactIntervalControls(){
    const timeline = document.querySelector(".timeline");
    const hud = document.querySelector(".timeline-hud-panel");
    if(!timeline || !hud) return;

    let dock = document.querySelector(".timeline-control-dock");
    if(!dock){
      dock = document.createElement("div");
      dock.className = "timeline-control-dock";
    }

    const ids = [
      "intensitySlider",
      "intensityValue",
      "intensityDownBtn",
      "intensityUpBtn",
      "skipIntervalBtn",
      "extendInterval1Btn",
      "extendInterval25Btn",
      "extendInterval5Btn"
    ];

    ids.forEach(id=>{
      const el = document.getElementById(id);
      if(el && el.parentElement !== dock){
        dock.appendChild(el);
      }
    });

    timeline.insertBefore(dock, hud);

    const oldInline = document.querySelector(".inline-intensity-control");
    if(oldInline && oldInline.children.length === 0){
      oldInline.style.display = "none";
    }

    document.querySelectorAll(".interval-edit-divider").forEach(el=>{ el.style.display = "none"; });
  }

  document.addEventListener("DOMContentLoaded", dockExactIntervalControls);
  setTimeout(dockExactIntervalControls, 50);
  setTimeout(dockExactIntervalControls, 250);
  setTimeout(dockExactIntervalControls, 800);
  setTimeout(dockExactIntervalControls, 1500);
  window.addEventListener("resize", dockExactIntervalControls, {passive:true});
})();

// ===== Script block 9 from original Trainer App =====
(function(){
  function updateIntensityDisplay(){
    const slider = document.getElementById("intensitySlider");
    const value = document.getElementById("intensityValue");
    if(!slider || !value) return;

    const pct = Math.round(Number(slider.value || 100));
    value.textContent = `${pct}%`;

    if(typeof window.intensityFactor !== "undefined"){
      window.intensityFactor = pct / 100;
    }
  }

  function bindIntensityDisplay(){
    const slider = document.getElementById("intensitySlider");
    const value = document.getElementById("intensityValue");
    const down = document.getElementById("intensityDownBtn");
    const up = document.getElementById("intensityUpBtn");

    if(!slider || !value) return;

    if(!slider.dataset.liveIntensityBound){
      slider.addEventListener("input", updateIntensityDisplay);
      slider.addEventListener("change", updateIntensityDisplay);
      slider.dataset.liveIntensityBound = "true";
    }

    [down, up].forEach(btn=>{
      if(btn && !btn.dataset.liveIntensityBound){
        btn.addEventListener("click", function(){
          setTimeout(updateIntensityDisplay, 0);
          setTimeout(updateIntensityDisplay, 80);
        });
        btn.dataset.liveIntensityBound = "true";
      }
    });

    updateIntensityDisplay();
  }

  document.addEventListener("DOMContentLoaded", bindIntensityDisplay);
  setTimeout(bindIntensityDisplay, 50);
  setTimeout(bindIntensityDisplay, 300);
  setTimeout(bindIntensityDisplay, 900);
  window.addEventListener("resize", bindIntensityDisplay, {passive:true});
})();

// ===== Script block 10 from original Trainer App =====
(function(){
  function rebuildIntervalControlBar(){
    const timeline = document.querySelector(".timeline");
    const hud = document.querySelector(".timeline-hud-panel");
    if(!timeline || !hud) return;

    let dock = document.querySelector(".timeline-control-dock");
    if(!dock){
      dock = document.createElement("div");
      dock.className = "timeline-control-dock";
    }

    const requiredIds = [
      "intensitySlider",
      "intensityValue",
      "intensityDownBtn",
      "intensityUpBtn",
      "skipIntervalBtn",
      "extendInterval1Btn",
      "extendInterval25Btn",
      "extendInterval5Btn"
    ];

    const els = requiredIds.map(id => document.getElementById(id)).filter(Boolean);

    dock.innerHTML = "";
    els.forEach(el => {
      el.style.display = "";
      el.style.visibility = "";
      el.style.opacity = "";
      dock.appendChild(el);
    });

    timeline.insertBefore(dock, hud);

    // Hide old wrappers once their controls have been moved.
    const oldIntervalControls = document.getElementById("intervalEditControls");
    if(oldIntervalControls && oldIntervalControls !== dock){
      oldIntervalControls.style.display = "none";
    }

    const oldInline = document.querySelector(".inline-intensity-control");
    if(oldInline){
      oldInline.style.display = "none";
    }

    // Keep the percentage live and synced with the slider.
    const slider = document.getElementById("intensitySlider");
    const value = document.getElementById("intensityValue");
    if(slider && value){
      const update = () => {
        const pct = Math.round(Number(slider.value || 100));
        value.textContent = `${pct}%`;
      };

      if(!slider.dataset.rebuiltLiveIntensity){
        slider.addEventListener("input", update);
        slider.addEventListener("change", update);
        slider.dataset.rebuiltLiveIntensity = "true";
      }

      ["intensityDownBtn","intensityUpBtn"].forEach(id=>{
        const btn = document.getElementById(id);
        if(btn && !btn.dataset.rebuiltLiveIntensity){
          btn.addEventListener("click", () => {
            setTimeout(update, 0);
            setTimeout(update, 80);
          });
          btn.dataset.rebuiltLiveIntensity = "true";
        }
      });

      update();
    }
  }

  document.addEventListener("DOMContentLoaded", rebuildIntervalControlBar);
  setTimeout(rebuildIntervalControlBar, 50);
  setTimeout(rebuildIntervalControlBar, 250);
  setTimeout(rebuildIntervalControlBar, 800);
  setTimeout(rebuildIntervalControlBar, 1500);
  window.addEventListener("resize", rebuildIntervalControlBar, {passive:true});
})();

// ===== Script block 11 from original Trainer App =====
(function(){
  function $(id){ return document.getElementById(id); }

  function setupSafeHudStates(){
    const hrCard = $("hrMetricCard");
    const powerCard = $("powerMetricCard");
    const cadenceCard = $("cadenceMetricCard");
    const hrVal = $("hrVal");
    const powerVal = $("powerVal");

    if(!hrCard || !powerCard) return;

    const trainerConnectedState = (typeof window.trainerConnected !== "undefined")
      ? !!window.trainerConnected
      : (powerVal && powerVal.textContent.trim() !== "--" && powerVal.textContent.trim() !== "Connect Trainer");

    const hrConnectedState = (typeof window.hrConnected !== "undefined")
      ? !!window.hrConnected
      : (hrVal && hrVal.textContent.trim() !== "--" && hrVal.textContent.trim() !== "Connect HR");

    hrCard.classList.toggle("connect-cta", !hrConnectedState);
    powerCard.classList.toggle("connect-cta", !trainerConnectedState);

    if(!hrConnectedState && hrVal) hrVal.textContent = "Connect HR";
    if(!trainerConnectedState && powerVal) powerVal.textContent = "Connect Trainer";

    if(cadenceCard){
      cadenceCard.classList.toggle("hide-no-trainer", !trainerConnectedState);
    }
  }

  // Do NOT intercept setup button clicks. Original handlers remain:
  // connectHrBtn -> connectHR(), connectTrainerBtn -> connectTrainer()
  // Original HUD card handlers also work because they check .connect-cta.
  document.addEventListener("DOMContentLoaded", setupSafeHudStates);
  setTimeout(setupSafeHudStates, 100);
  setTimeout(setupSafeHudStates, 500);
  setInterval(setupSafeHudStates, 1000);
})();
