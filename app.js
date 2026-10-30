"use strict";
// I built this the flowmodoro way. My focus timer counts up while I
// work, with no target time. When I stop, I earn a break worth the focus
// time divided by RATIO. I do not count down focus, because the whole
// point is that a flow ends when it ends, not when a preset rings.
const RATIO = 5;             // I earn 1 second of break for every 5 seconds of focus. If I change this one number, every break length in the app changes with it.
let mode = "idle";           // I am always in exactly one of idle, focus, or break. Every handler below branches on this, so a wrong value here breaks all of them at once.
let startedAt = null;        // Date.now() when the current phase began. I reuse this for focus and for break, so I have to reset it at the moment a phase switches, or the new phase would inherit the old start time.
let breakSeconds = 0;        // The break I earned for the current break only. I recompute it each time focus ends. It is not a running balance.
let ticker = null;           // My one interval handle. startFocus sets it and toIdle clears it. If two intervals ever ran at once, the clock would render twice as often and a break could end twice.
let totalFocus = 0, totalBreak = 0;  // Session totals, in seconds. I only add to them when a phase ends through the break button or through stopBreak. The reset path below does not add to them.

// I look these three up once, at load. That only works because index.html
// puts this script at the end of the body. If I moved the script tag into
// the head, these would be null and the first render would throw.
const $ = (id) => document.getElementById(id);
const clock = $("clock"), phase = $("phase"), status = $("status");

function fmt(sec) {
  // I clamp at 0 and cut the fraction here. A break render can run a
  // moment past the end and hand me a small negative number, and I never
  // want the clock or the log to show a negative time.
  sec = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// I do not count ticks to measure time. I subtract startedAt from the
// wall clock every render. A browser can delay or throttle my interval
// in a background tab, but it cannot change Date.now(), so a throttled
// tab loses smoothness, not accuracy.
function render() {
  // This function does more than draw in break mode. When the countdown
  // reaches 0, I end the break from here. That means render has a side
  // effect, and I must not call it from a place that expects a pure draw.
  if (mode === "focus") {
    clock.textContent = fmt((Date.now() - startedAt) / 1000);
  } else if (mode === "break") {
    const left = breakSeconds - (Date.now() - startedAt) / 1000;
    clock.textContent = fmt(left);
    if (left <= 0) stopBreak(true);
  }
}

function log(text) {
  // I put the newest entry at the top, so the last thing I did is the
  // first thing I see. I set it with textContent, so log text is never
  // read as markup.
  const li = document.createElement("li");
  li.textContent = text;
  $("logList").prepend(li);
}

function totals() {
  // I keep the totals in seconds and only round when I show them. If I
  // stored rounded minutes, a lot of short sessions would each round
  // away their seconds and the totals would drift low.
  $("totals").textContent =
    `Total focus: ${Math.round(totalFocus / 60)} min - Total break: ${Math.round(totalBreak / 60)} min`;
}

function startFocus() {
  // I disable Start while I focus, so I cannot start a second ticker on
  // top of the first. The break button is the only way out of focus.
  mode = "focus";
  startedAt = Date.now();
  phase.textContent = "Focusing";
  status.textContent = "Flow state... stop whenever the flow ends.";
  $("startBtn").disabled = true;
  $("breakBtn").disabled = false;
  ticker = setInterval(render, 250);  // I render 4 times a second so the second hand looks smooth. I do not need it faster, because fmt only shows whole seconds.
  render();
}

// I send every path back to idle through here: break finished, break
// ended early, focus too short to bank a break, and Reset. I used to
// write this block out three times with small differences. That is how
// a button label or a disabled state gets fixed in two places and
// missed in the third. Only the status line differs between my paths,
// so only the status line is a parameter. If I add a fourth way back to
// idle, it goes through here too, or it will leave a button wrong.
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
  // I credit the smaller of what I earned and what I actually used. If
  // I end a break early, I do not get credit for the part I skipped. If
  // the render tick runs late, I also do not get credit past the earned
  // length.
  const used = Math.min(breakSeconds, (Date.now() - startedAt) / 1000);
  totalBreak += used;
  log(`Break: ${fmt(used)}${finished ? " (complete)" : " (ended early)"}`);
  toIdle("Break over. Start the next focus block when ready.");
  totals();
}

$("startBtn").addEventListener("click", startFocus);

// This one button does two different jobs, and mode decides which. In
// focus it banks the break. In break it ends the break early. I changed
// its label in each phase so the button says which job it will do.
$("breakBtn").addEventListener("click", () => {
  if (mode === "focus") {
    const focusSec = (Date.now() - startedAt) / 1000;
    totalFocus += focusSec;
    breakSeconds = Math.floor(focusSec / RATIO);
    log(`Focus: ${fmt(focusSec)} -> earned break: ${fmt(breakSeconds)}`);
    totals();
    // I floor the division above, so under 5 seconds of focus earns 0.
    // I treat that as no break at all instead of starting a 0 second break that ends at once.
    if (breakSeconds < 1) {
      toIdle("Under 5 seconds of focus - no break banked.");
      return;
    }
    mode = "break";
    // I reset startedAt here, at the switch. If I left the focus start
    // time in place, the break countdown would subtract my whole focus
    // session and the break would be over before it began.
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
  // I do not bank or log anything on Reset. I throw the current phase
  // away and go back to idle. That is the behavior as I wrote it, and it
  // means focus time before a Reset never reaches my totals.
  toIdle("Press Start focus and work until your flow ends.");
});

$("loadBtn").addEventListener("click", () => {
  const raw = $("ytInput").value.trim();
  // I accept two shapes only: a URL carrying v=, youtu.be/ or embed/,
  // or a bare 11 character ID as the whole input. My first version of
  // this check made the URL prefix optional. That meant any 11 word
  // characters anywhere in any pasted text counted as a video ID, and a
  // normal sentence could load as a video. I would rather reject a real
  // link in a shape I do not know than accept text that is not a link.
  const match = raw.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/)
    || raw.match(/^([A-Za-z0-9_-]{11})$/);
  if (!match) { status.textContent = "That does not look like a YouTube URL or ID."; return; }
  // I build the player with innerHTML, and the ID is the only user text
  // in it. That is safe here only because the match above limits the ID
  // to exactly 11 characters from letters, digits, dash, and underscore.
  // No quote or angle bracket can reach this string through that check.
  // If I ever loosen the match, I have to stop using innerHTML here.
  $("playerWrap").innerHTML =
    `<iframe src="https://www.youtube.com/embed/${match[1]}?rel=0"
       title="Study ambience" allow="accelerometer; encrypted-media; picture-in-picture"
       allowfullscreen></iframe>`;
});
