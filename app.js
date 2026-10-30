"use strict";
// Flowmodoro: the focus timer counts UP while you work. When you stop,
// your break length is focusTime / RATIO (classic flowmodoro rule).
const RATIO = 5;
let mode = "idle";           // idle | focus | break
let startedAt = null;        // Date.now() when current phase began
let breakSeconds = 0;        // allotted break length
let ticker = null;
let totalFocus = 0, totalBreak = 0;

const $ = (id) => document.getElementById(id);
const clock = $("clock"), phase = $("phase"), status = $("status");

function fmt(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function render() {
  if (mode === "focus") {
    clock.textContent = fmt((Date.now() - startedAt) / 1000);
  } else if (mode === "break") {
    const left = breakSeconds - (Date.now() - startedAt) / 1000;
    clock.textContent = fmt(left);
    if (left <= 0) stopBreak(true);
  }
}

function log(text) {
  const li = document.createElement("li");
  li.textContent = text;
  $("logList").prepend(li);
}

function totals() {
  $("totals").textContent =
    `Total focus: ${Math.round(totalFocus / 60)} min - Total break: ${Math.round(totalBreak / 60)} min`;
}

function startFocus() {
  mode = "focus";
  startedAt = Date.now();
  phase.textContent = "Focusing";
  status.textContent = "Flow state... stop whenever the flow ends.";
  $("startBtn").disabled = true;
  $("breakBtn").disabled = false;
  ticker = setInterval(render, 250);
  render();
}

function stopBreak(finished) {
  const used = Math.min(breakSeconds, (Date.now() - startedAt) / 1000);
  totalBreak += used;
  log(`Break: ${fmt(used)}${finished ? " (complete)" : " (ended early)"}`);
  mode = "idle";
  clearInterval(ticker);
  phase.textContent = "Ready";
  clock.textContent = "00:00";
  status.textContent = "Break over. Start the next focus block when ready.";
  $("startBtn").disabled = false;
  $("breakBtn").disabled = true;
  $("breakBtn").textContent = "Take break";
  totals();
}

$("startBtn").addEventListener("click", startFocus);

$("breakBtn").addEventListener("click", () => {
  if (mode === "focus") {
    const focusSec = (Date.now() - startedAt) / 1000;
    totalFocus += focusSec;
    breakSeconds = Math.floor(focusSec / RATIO);
    log(`Focus: ${fmt(focusSec)} -> earned break: ${fmt(breakSeconds)}`);
    totals();
    if (breakSeconds < 1) {           // too short to bank a break
      clearInterval(ticker);
      mode = "idle";
      phase.textContent = "Ready";
      clock.textContent = "00:00";
      status.textContent = "Under 5 seconds of focus - no break banked.";
      $("startBtn").disabled = false;
      $("breakBtn").disabled = true;
      return;
    }
    mode = "break";
    startedAt = Date.now();
    phase.textContent = "On break";
    status.textContent = "Rest. The timer counts down your earned break.";
    $("breakBtn").textContent = "End break early";
    render();
  } else if (mode === "break") {
    stopBreak(false);
  }
});

$("resetBtn").addEventListener("click", () => {
  clearInterval(ticker);
  mode = "idle";
  phase.textContent = "Ready";
  clock.textContent = "00:00";
  status.textContent = "Press Start focus and work until your flow ends.";
  $("startBtn").disabled = false;
  $("breakBtn").disabled = true;
  $("breakBtn").textContent = "Take break";
});

$("loadBtn").addEventListener("click", () => {
  const raw = $("ytInput").value.trim();
  const match = raw.match(/(?:v=|youtu\.be\/|embed\/)?([A-Za-z0-9_-]{11})/);
  if (!match) { status.textContent = "That does not look like a YouTube URL or ID."; return; }
  $("playerWrap").innerHTML =
    `<iframe src="https://www.youtube.com/embed/${match[1]}?rel=0"
       title="Study ambience" allow="accelerometer; encrypted-media; picture-in-picture"
       allowfullscreen></iframe>`;
});
