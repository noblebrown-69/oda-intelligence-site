/* node tests/engine.test.js  — progression engine + content data checks */
'use strict';
var E = require('../assets/engine.js');
var P = require('../data/program.json');
var pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log('FAIL', m); } }
function eq(a, b, m) { ok(JSON.stringify(a) === JSON.stringify(b), m + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
function S(ex, list, warm) { return list.map(function (x, i) { return { ex: ex, set_no: i + 1, reps: x[0], weight: x[1], warm: !!(warm && warm[i]) }; }); }
function sess(date, sets, effort, extra) { var h = { date: date, program: 'home', workout: 'A', done: true, sets: sets, effort: effort || {} }; for (var k in extra || {}) h[k] = extra[k]; return h; }
var home = { sets: 3, min: 8, max: 12, scheme: 'double' };
var hinge = { sets: 2, min: 10, max: 12, scheme: 'double' };
var gym = { sets: 5, min: 5, max: 5, scheme: '5x5' };
var G = P.exercises.goblet_squat, V = P.exercises.v_squat, PU = P.exercises.pushup, RDL = P.exercises.db_rdl;
var ctx = { phase: { deload: false, comeback: 1 }, levels: P.pushup_levels };

// --- helpers
eq(E.nextLoad('db', 10), 12, 'db ladder 10->12');
eq(E.nextLoad('db', 15), 17.5, 'db ladder 15->17.5');
eq(E.nextLoad(5, 20), 25, 'plate +5');
eq(E.dropLoad(5, 100, 0.10), 90, 'plate drop 10%');
eq(E.dropLoad(5, 20, 0.10), 15, 'plate drop always moves down');
eq(E.dropLoad('db', 15, 0.10), 12, 'db drop one step');
eq(E.volume(S('x', [[10, 10], [10, 10], [5, 5]], [0, 0, 1])), 200, 'volume excludes warm-ups');
eq(E.topSet(S('x', [[12, 5], [8, 15]], [1, 0])), { weight: 15, reps: 8 }, 'top set');
eq(E.topSet(S('x', [[12, 50], [8, 15]], [1, 0])).weight, 15, 'warm-up never top set');
eq(E.daysBetween('2026-11-01', '2026-11-08'), 7, 'daysBetween');

// --- suggest A/B
eq(E.suggestWorkout([], 'home'), 'A', 'first suggest A');
eq(E.suggestWorkout([sess('2026-11-02', [], {}, { workout: 'A' })], 'home'), 'B', 'after A -> B');
eq(E.suggestWorkout([sess('2026-11-02', [], {}, { workout: 'A' }), sess('2026-11-04', [], {}, { workout: 'B' })], 'home'), 'A', 'after B -> A');
eq(E.suggestWorkout([sess('2026-11-02', [], {}, { workout: 'A', program: 'gym' })], 'home'), 'A', 'per program');

// --- home double progression
var r = E.recommend(G, home, [], ctx);
ok(r.estimate && /Guess/.test(r.text), 'no history -> labelled guess');
r = E.recommend(G, home, E.exHistory([sess('2026-11-02', S('goblet_squat', [[12, 15], [12, 15], [12, 15]]))], 'goblet_squat'), ctx);
ok(r.ready && r.weight === 17.5 && r.reps === 8, 'all at ceiling -> next db, back to 8');
eq(r.micro.length, 4, 'micro-steps offered before next db');
ok(/3 seconds/.test(r.micro[1]) && /4 sets/.test(r.micro[0]), 'micro-step order');
r = E.recommend(G, home, E.exHistory([sess('2026-11-02', S('goblet_squat', [[10, 15], [9, 15], [9, 15]]))], 'goblet_squat'), ctx);
ok(!r.ready && r.weight === 15 && r.reps === 10, 'inside range -> same load +1 rep from lowest');
r = E.recommend(G, home, E.exHistory([sess('2026-11-02', S('goblet_squat', [[12, 15], [12, 15], [11, 15]]), { goblet_squat: 'Easy' })], 'goblet_squat'), ctx);
ok(r.ready && r.weight === 17.5, 'Easy + one short of ceiling -> bump faster');
r = E.recommend(G, home, E.exHistory([sess('2026-11-02', S('goblet_squat', [[9, 15], [8, 15], [8, 15]]), { goblet_squat: 'Easy' })], 'goblet_squat'), ctx);
ok(r.reps === 10, 'Easy -> +2 reps target');
r = E.recommend(G, home, E.exHistory([sess('2026-11-02', S('goblet_squat', [[12, 15], [12, 15], [12, 15]]), { goblet_squat: 'Grind' })], 'goblet_squat'), ctx);
ok(r.ready, 'Grind at ceiling still ready (all reps hit)');
r = E.recommend(G, home, E.exHistory([sess('2026-11-02', S('goblet_squat', [[10, 15], [9, 15], [9, 15]]), { goblet_squat: 'Grind' })], 'goblet_squat'), ctx);
ok(r.hold && r.weight === 15 && r.reps === 9, 'Grind -> hold');
var missH = [sess('2026-11-02', S('goblet_squat', [[9, 15], [7, 15], [6, 15]])), sess('2026-11-04', S('goblet_squat', [[8, 15], [7, 15], [7, 15]]))];
r = E.recommend(G, home, E.exHistory(missH, 'goblet_squat'), ctx);
ok(r.drop && r.weight === 12, 'miss rule 2 sessions -> drop one step');
r = E.recommend(G, home, E.exHistory(missH.slice(1), 'goblet_squat'), ctx);
ok(!r.drop, 'one miss session -> no drop');
r = E.recommend(G, home, E.exHistory([sess('2026-11-02', S('goblet_squat', [[12, 5], [12, 15], [12, 15], [12, 15]], [1, 0, 0, 0]))], 'goblet_squat'), ctx);
ok(r.ready && r.weight === 17.5, 'warm-up ignored for top set and progression');
r = E.recommend(RDL, hinge, E.exHistory([sess('2026-11-02', S('db_rdl', [[12, 15], [12, 15]]))], 'db_rdl'), ctx);
ok(r.ready && r.reps === 10, 'hinge restarts at 10');

// --- push-up levels
r = E.recommend(PU, home, E.exHistory([sess('2026-11-02', S('pushup', [[12, 1], [12, 1], [12, 1]]))], 'pushup'), ctx);
ok(r.ready && r.weight === 2 && r.reps === 8 && /Stairs/.test(r.text), 'push-up ceiling -> lower incline');
r = E.recommend(PU, home, E.exHistory([sess('2026-11-02', S('pushup', [[12, 4], [12, 4], [12, 4]]))], 'pushup'), ctx);
ok(r.ready && r.weight === 4 && r.sets === 4, 'floor at 12 -> add set');
r = E.recommend(PU, home, E.exHistory([sess('2026-11-02', S('pushup', [[9, 2], [10, 2], [9, 2]]))], 'pushup'), ctx);
ok(r.weight === 2 && r.reps === 10, 'push-up chase reps');

// --- gym 5x5
var five = function (w, reps) { return S('v_squat', (reps || [5, 5, 5, 5, 5]).map(function (x) { return [x, w]; })); };
r = E.recommend(V, gym, E.exHistory([sess('2026-11-02', five(20))], 'v_squat'), ctx);
ok(r.ready && r.weight === 25 && r.reps === 5, 'gym all 25 clean -> +5');
r = E.recommend(V, gym, E.exHistory([sess('2026-11-02', five(20, [5, 5, 5, 4, 3]))], 'v_squat'), ctx);
ok(r.hold && r.weight === 20, 'gym miss once -> hold');
r = E.recommend(V, gym, E.exHistory([sess('2026-11-02', five(100, [5, 5, 4, 4, 3])), sess('2026-11-04', five(100, [5, 5, 4, 3, 3])), sess('2026-11-06', five(100, [5, 4, 4, 3, 3]))], 'v_squat'), ctx);
ok(r.drop && r.weight === 90, 'gym fail 3 in a row -> -10%');
r = E.recommend(V, gym, E.exHistory([sess('2026-11-02', five(100, [5, 5, 4, 4, 3])), sess('2026-11-04', five(100)), sess('2026-11-06', five(100, [5, 4, 4, 3, 3]))], 'v_squat'), ctx);
ok(r.hold, 'gym fails not consecutive -> hold');
r = E.recommend(P.exercises.db_sldl, { sets: 1, min: 5, max: 5, scheme: '5x5' }, E.exHistory([sess('2026-11-02', S('db_sldl', [[5, 15]]))], 'db_sldl'), ctx);
ok(r.ready && r.weight === 17.5, 'gym DB hinge uses db ladder');

// --- phase: deload + comeback
var hist = [sess('2026-09-01', five(20)), sess('2026-10-06', five(20))];
var ph = E.phase(hist, '2026-10-08');
ok(ph.deload && ph.week === 6, 'week 6 deload');
r = E.recommend(V, gym, E.exHistory(hist, 'v_squat'), { phase: ph, levels: [] });
ok(r.weight === 15 && r.sets === 2 && !r.ready, 'deload cuts load and sets');
ph = E.phase([sess('2026-10-01', five(100))], '2026-10-12');
ok(ph.comeback === 0.9, 'missed week -> 90%');
r = E.recommend(V, gym, E.exHistory([sess('2026-10-01', five(100))], 'v_squat'), { phase: ph, levels: [] });
eq(r.weight, 90, 'comeback 90% load');
ph = E.phase([sess('2026-10-01', five(100))], '2026-10-20');
ok(ph.comeback === 0.8, '2 weeks off -> 80%');
ph = E.phase([sess('2026-11-02', five(100), {}, { flags: { joint_pain: true } })], '2026-11-04');
ok(ph.deload, 'joint pain -> deload');
ph = E.phase([1, 3, 5].map(function (d) { return sess('2026-11-0' + d, five(100), {}, { flags: { low_energy: true } }); }), '2026-11-09');
ok(ph.deload, 'low energy streak -> deload');
var gp = { v_squat: gym };
ok(E.twoFailsInRow([sess('2026-11-02', five(100, [5, 5, 4, 4, 4]), {}, { program: 'gym' }), sess('2026-11-04', five(100, [5, 4, 4, 4, 4]), {}, { program: 'gym' })], 'gym', '2026-11-06', gp), 'two failed lifts in a row');
ok(!E.twoFailsInRow([sess('2026-11-02', five(100), {}, { program: 'gym' }), sess('2026-11-04', five(100, [5, 4, 4, 4, 4]), {}, { program: 'gym' })], 'gym', '2026-11-06', gp), 'one fail is not two');

// --- compare
var c = E.compare(S('a', [[5, 25]]), S('a', [[5, 20]]));
ok(c.dir === 1 && /Heavier/.test(c.text), 'heavier callout');
c = E.compare(S('a', [[4, 20]]), S('a', [[5, 20]]));
ok(c.dir === -1 && /Fewer reps/.test(c.text) && /fine/.test(c.text), 'regression callout, gentle');
c = E.compare(S('a', [[5, 20], [5, 20]]), S('a', [[5, 20]]));
ok(c.dir === 1 && /more total work/i.test(c.text), 'volume up');
c = E.compare(S('a', [[5, 20], [10, 50]], [0, 1]), S('a', [[5, 20]]));
ok(c.dir === 0 && /Matched/.test(c.text), 'warm-ups excluded from compare');
ok(/first time/.test(E.lastTimeLine([], G)), 'last time empty');
ok(/12 @ 15/.test(E.lastTimeLine(E.exHistory([sess('2026-11-02', S('goblet_squat', [[12, 15]]))], 'goblet_squat'), G)), 'last time line');

// --- content data
Object.keys(P.programs).forEach(function (pk) {
  ['A', 'B'].forEach(function (w) {
    var list = P.programs[pk].workouts[w];
    ok(list && list.length >= 3, pk + w + ' has exercises');
    list.forEach(function (it) {
      var d = P.exercises[it.ex];
      ok(!!d, pk + w + ' ' + it.ex + ' defined');
      if (!d) return;
      ok(d.setup && d.steps.length >= 2 && d.feel && d.mistakes.length >= 2 && d.safety && d.start_guess, it.ex + ' card complete');
      ok('media_url' in d && 'video_url' in d, it.ex + ' media slots');
      ok(it.sets > 0 && it.min <= it.max, it.ex + ' plan sane');
    });
  });
});
eq(P.programs.gym.workouts.A.map(function (x) { return x.sets + 'x' + x.max; }), ['5x5', '5x5', '5x5'], 'gym A 5x5');
eq(P.programs.gym.workouts.B[2].sets + 'x' + P.programs.gym.workouts.B[2].max, '1x5', 'gym hinge 1x5');
eq(P.programs.gym.workouts.B[2].learn.max, 8, 'gym hinge learn 1x8');
eq(P.programs.home.workouts.B[2].sets + 'x' + P.programs.home.workouts.B[2].min + '-' + P.programs.home.workouts.B[2].max, '2x10-12', 'home hinge 2x10-12');
ok(P.programs.home.workouts.A.slice(0, 3).every(function (x) { return x.sets === 3 && x.min === 8 && x.max === 12; }), 'home 3x8-12');
eq(P.pushup_levels.length, 4, 'push-up ladder');

console.log('engine tests: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
