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

// Every path back to idle (break finished, break ended early, too-short
// focus, Reset) goes through here. This block used to be written out three
// times with small differences, which is how a button label or a disabled
// state gets fixed in two places and missed in the third. Only the status
// line differs between the paths, so only the status line is a parameter.
function toIdle(statusText) {
  clearInterval(ticker);
  mode = "idle";
  phase.textContent = "Ready";
  clock.textContent = "00:00";
  status.textContent = statusText;
  $("startBtn").disabled = false;
  $("breakBtn").disabled = true;
  $("breakBtn").textContent = "Take break";
}

function stopBreak(finished) {
  const used = Math.min(breakSeconds, (Date.now() - startedAt) / 1000);
  totalBreak += used;
  log(`Break: ${fmt(used)}${finished ? " (complete)" : " (ended early)"}`);
  toIdle("Break over. Start the next focus block when ready.");
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
      toIdle("Under 5 seconds of focus - no break banked.");
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
  toIdle("Press Start focus and work until your flow ends.");
});

$("loadBtn").addEventListener("click", () => {
  const raw = $("ytInput").value.trim();
  // Two accepted shapes only: a URL carrying v=, youtu.be/ or embed/, or a
  // bare 11-character ID as the whole input. The first version of this
  // regex made the URL prefix optional, which meant any 11 word characters
  // anywhere in any pasted text "matched" and loaded as a video.
  const match = raw.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/)
    || raw.match(/^([A-Za-z0-9_-]{11})$/);
  if (!match) { status.textContent = "That does not look like a YouTube URL or ID."; return; }
  $("playerWrap").innerHTML =
    `<iframe src="https://www.youtube.com/embed/${match[1]}?rel=0"
       title="Study ambience" allow="accelerometer; encrypted-media; picture-in-picture"
       allowfullscreen></iframe>`;
});
