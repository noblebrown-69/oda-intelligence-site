/* Oniko Fit progression engine. Pure functions, no DOM. Shared by the page and the node tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OnikoEngine = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DB = [2, 3, 5, 8, 10, 12, 15, 17.5, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80];
  var MICRO = [
    'Add 1 more set (4 sets) at 12 reps',
    'Slow the lowering to 3 seconds',
    'Pause 1 second at the bottom',
    'Use a thicker band, or add a second band'
  ];

  function num(x) { var n = Number(x); return isFinite(n) ? n : 0; }
  function round(x, step) { return Math.round(x / step) * step; }
  function fmt(w) { w = Math.round(w * 10) / 10; return (w % 1 === 0) ? String(w) : w.toFixed(1); }

  function working(sets) { return (sets || []).filter(function (s) { return !s.warm; }); }

  function topSet(sets) {
    var t = null;
    working(sets).forEach(function (s) {
      var w = num(s.weight), r = num(s.reps);
      if (!t || w > t.weight || (w === t.weight && r > t.reps)) t = { weight: w, reps: r };
    });
    return t;
  }

  /* Volume = sets x reps x weight, warm-ups excluded. Body-weight/level moves count reps. */
  function volume(sets, kind) {
    return working(sets).reduce(function (a, s) {
      return a + num(s.reps) * (kind === 'level' ? 1 : num(s.weight));
    }, 0);
  }

  function nextLoad(step, w) {
    w = num(w);
    if (step === 'db' || step === 'band') {
      for (var i = 0; i < DB.length; i++) if (DB[i] > w + 0.01) return DB[i];
      return w + 5;
    }
    var st = num(step) || 5;
    return round(w, st) + st;
  }

  function dropLoad(step, w, frac) {
    w = num(w);
    var target = w * (1 - frac);
    if (step === 'db' || step === 'band') {
      var best = DB[0];
      for (var i = 0; i < DB.length; i++) if (DB[i] <= target + 0.01) best = DB[i];
      if (best >= w) { for (var j = DB.length - 1; j >= 0; j--) if (DB[j] < w) return DB[j]; return DB[0]; }
      return best;
    }
    var st = num(step) || 5;
    var r = Math.floor(target / st) * st;
    if (r >= w) r = w - st;
    return Math.max(0, r);
  }

  function daysBetween(a, b) {
    var da = Date.parse(a + 'T12:00:00Z'), db = Date.parse(b + 'T12:00:00Z');
    return Math.round((db - da) / 86400000);
  }

  /* Next workout letter: strict A/B alternation from the last completed session of this program. */
  function suggestWorkout(history, program) {
    var last = null;
    (history || []).forEach(function (h) { if (h.program === program && h.done) last = h; });
    if (!last) return 'A';
    return last.workout === 'A' ? 'B' : 'A';
  }

  /* Sessions for one exercise, newest last, each with only that exercise's sets. */
  function exHistory(history, exId, beforeDate) {
    var out = [];
    (history || []).forEach(function (h) {
      if (beforeDate && h.date >= beforeDate) return;
      var sets = (h.sets || []).filter(function (s) { return s.ex === exId; });
      if (working(sets).length) out.push({ date: h.date, sets: sets, effort: (h.effort || {})[exId] || '', flags: h.flags || {} });
    });
    out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return out;
  }

  function hitAll(sets, plan, reps) {
    var w = working(sets);
    if (w.length < plan.sets) return false;
    for (var i = 0; i < w.length; i++) if (num(w[i].reps) < reps) return false;
    return true;
  }

  function missedBottom(sets, plan) {
    var n = 0;
    working(sets).forEach(function (s) { if (num(s.reps) < plan.min) n++; });
    return n >= 2;
  }

  /* Session-level state: deload and comeback after a break. */
  function phase(history, today) {
    var dates = (history || []).filter(function (h) { return h.done; }).map(function (h) { return h.date; }).filter(function (d) { return d < today; }).sort();
    var res = { week: 1, deload: false, reason: '', comeback: 1, comebackText: '' };
    if (!dates.length) return res;
    var first = dates[0], last = dates[dates.length - 1];
    res.week = Math.floor(daysBetween(first, today) / 7) + 1;
    var gap = daysBetween(last, today);
    if (gap >= 14) { res.comeback = 0.8; res.comebackText = 'Welcome back! After 2 weeks or more off, start at about 80% of your last weight.'; }
    else if (gap >= 8) { res.comeback = 0.9; res.comebackText = 'Welcome back! After a week off, start at about 90% of your last weight.'; }
    if (res.week % 6 === 0) { res.deload = true; res.reason = 'Week ' + res.week + ' is an easy week.'; }
    var recent = (history || []).filter(function (h) { return h.done && h.date < today && daysBetween(h.date, today) <= 14; });
    if (recent.some(function (h) { return h.flags && h.flags.joint_pain; })) { res.deload = true; res.reason = 'You reported joint pain recently.'; }
    var tired = recent.filter(function (h) { return h.flags && h.flags.low_energy; });
    if (recent.length >= 3 && tired.length === recent.length) { res.deload = true; res.reason = 'You reported low energy for 2 weeks.'; }
    return res;
  }

  /* Two failed lifts in a row (any exercise missed its target in each of the last two sessions). */
  function twoFailsInRow(history, program, today, plansByEx) {
    var done = (history || []).filter(function (h) { return h.done && h.program === program && h.date < today; });
    done.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var last2 = done.slice(-2);
    if (last2.length < 2) return false;
    return last2.every(function (h) {
      return Object.keys(plansByEx).some(function (ex) {
        var sets = (h.sets || []).filter(function (s) { return s.ex === ex; });
        if (!working(sets).length) return false;
        var p = plansByEx[ex];
        return !hitAll(sets, p, p.scheme === '5x5' ? p.max : p.min);
      });
    });
  }

  /*
   * recommend(def, plan, exSessions, ctx)
   *   def  exercise definition from program.json
   *   plan {sets,min,max,scheme:'5x5'|'double'}
   *   exSessions previous sessions for this exercise (newest last), from exHistory()
   *   ctx  {phase, levels}
   * Returns {weight, reps, sets, ready, estimate, hold, drop, text, micro[]}
   */
  function recommend(def, plan, exSessions, ctx) {
    ctx = ctx || {};
    var ph = ctx.phase || { deload: false, comeback: 1 };
    var levels = ctx.levels || [];
    var unit = def.kind === 'level' ? '' : ' ' + (def.unit || 'lb');
    var out = { weight: null, reps: plan.min, sets: plan.sets, ready: false, estimate: false, hold: false, drop: false, text: '', micro: [] };
    var last = exSessions[exSessions.length - 1];
    if (!last) {
      out.estimate = true;
      out.text = 'Guess for your first time: ' + (def.start_guess || 'start light') + ' Pick a weight you can do 12 clean reps with and could do 4 more.';
      return out;
    }
    var top = topSet(last.sets);
    var w = top ? top.weight : 0;
    var effort = last.effort;

    if (plan.scheme === '5x5') {
      var clean = hitAll(last.sets, plan, plan.max);
      var fails = 0;
      for (var i = exSessions.length - 1; i >= 0; i--) {
        if (hitAll(exSessions[i].sets, plan, plan.max)) break;
        fails++;
      }
      if (clean && effort !== 'Grind') {
        out.ready = true; out.weight = nextLoad(def.step, w);
        out.text = 'All ' + (plan.sets * plan.max) + ' reps were clean. Ready for more weight: ' + fmt(out.weight) + unit + ', ' + plan.sets + ' x ' + plan.max + '.';
      } else if (fails >= 3) {
        out.drop = true; out.weight = dropLoad(def.step, w, 0.10);
        out.text = 'Three tough sessions in a row on this one. That happens. Drop to ' + fmt(out.weight) + unit + ' and build back up.';
      } else {
        out.hold = true; out.weight = w;
        out.text = clean ? 'All reps done, but it felt like a grind. Stay at ' + fmt(w) + unit + ' and own it.' : 'Stay at ' + fmt(w) + unit + ' and go for all ' + plan.sets + ' x ' + plan.max + '.';
      }
      out.reps = plan.max;
    } else {
      var reps = working(last.sets).map(function (s) { return num(s.reps); });
      var minR = reps.length ? Math.min.apply(null, reps) : 0;
      var ready = hitAll(last.sets, plan, plan.max) || (effort === 'Easy' && hitAll(last.sets, plan, plan.max - 1));
      var prev = exSessions[exSessions.length - 2];
      var miss = missedBottom(last.sets, plan) && prev && missedBottom(prev.sets, plan) && topSet(prev.sets).weight === w;
      if (def.kind === 'level') {
        var lvl = Math.max(1, Math.round(w || 1));
        if (ready && lvl < levels.length) {
          out.ready = true; out.weight = lvl + 1; out.reps = plan.min;
          out.text = 'Ready for a harder push-up: ' + (levels[lvl] || ('level ' + (lvl + 1))) + '. Start at ' + plan.min + ' reps.';
        } else if (ready) {
          out.ready = true; out.weight = lvl; out.sets = plan.sets + 1; out.reps = plan.max;
          out.text = 'Full push-ups for 12! Add a set next time (' + out.sets + ' sets).';
        } else if (miss && lvl > 1) {
          out.drop = true; out.weight = lvl - 1;
          out.text = 'Move up one surface (' + (levels[lvl - 2] || '') + ') and build the reps back.';
        } else {
          out.weight = lvl; out.hold = effort === 'Grind';
          out.reps = out.hold ? Math.max(plan.min, minR) : Math.min(plan.max, Math.max(plan.min, minR + 1));
          out.text = out.hold ? 'Same surface. Aim for the same reps and smoother form.' : 'Same surface. Aim for ' + out.reps + ' reps on every set.';
        }
      } else if (ready) {
        out.ready = true; out.weight = nextLoad(def.step, w); out.reps = plan.min;
        out.text = 'Ready for more weight: ' + fmt(out.weight) + unit + ' for ' + plan.sets + ' x ' + plan.min + '. Build back up to ' + plan.max + '.';
        if (effort === 'Easy') out.text += ' It felt easy, so this jump is earned.';
        if (def.step === 'db' || def.step === 'band') out.micro = MICRO.slice();
      } else if (miss) {
        out.drop = true; out.weight = dropLoad(def.step, w, 0.10);
        out.text = 'Two sessions below ' + plan.min + ' reps. Drop to ' + fmt(out.weight) + unit + ' and build back up. Totally normal.';
      } else if (effort === 'Grind') {
        out.hold = true; out.weight = w; out.reps = Math.max(plan.min, minR);
        out.text = 'Felt like a grind. Same weight (' + fmt(w) + unit + '), same reps, smoother form.';
      } else {
        out.weight = w;
        var bump = effort === 'Easy' ? 2 : 1;
        out.reps = Math.min(plan.max, Math.max(plan.min, minR + bump));
        out.text = 'Same weight (' + fmt(w) + unit + '). Aim for ' + out.reps + ' reps on every set.';
      }
    }

    if (def.kind !== 'level' && out.weight !== null) {
      if (ph.comeback && ph.comeback < 1) {
        out.weight = dropLoad(def.step, w, 1 - ph.comeback);
        out.ready = false;
        out.text = ph.comebackText + ' Use ' + fmt(out.weight) + unit + '.';
      } else if (ph.deload) {
        out.weight = dropLoad(def.step, w, 0.12);
        out.sets = Math.min(out.sets, 2);
        out.ready = false;
        out.text = 'Easy week. ' + (ph.reason || '') + ' Use ' + fmt(out.weight) + unit + ' for ' + out.sets + ' sets, then back to normal.';
      }
    }
    return out;
  }

  /* Compare today vs last time: top set and volume, warm-ups excluded. */
  function compare(todaySets, lastSets, kind) {
    var t = topSet(todaySets), l = topSet(lastSets);
    if (!t || !l) return { dir: 0, text: t ? 'First time logged. Nice start.' : '' };
    var tv = volume(todaySets, kind), lv = volume(lastSets, kind);
    var unit = kind === 'level' ? '' : ' lb';
    var parts = [], dir = 0;
    if (t.weight > l.weight) { dir = 1; parts.push('Heavier top set: ' + fmt(t.weight) + unit + ' (was ' + fmt(l.weight) + ')'); }
    else if (t.weight < l.weight) { dir = -1; parts.push('Lighter top set: ' + fmt(t.weight) + unit + ' (was ' + fmt(l.weight) + ')'); }
    else if (t.reps > l.reps) { dir = 1; parts.push('More reps on your top set: ' + t.reps + ' (was ' + l.reps + ')'); }
    else if (t.reps < l.reps) { dir = -1; parts.push('Fewer reps on your top set: ' + t.reps + ' (was ' + l.reps + ')'); }
    if (tv > lv) { if (dir === 0) dir = 1; parts.push('more total work (' + fmt(tv) + ' vs ' + fmt(lv) + ')'); }
    else if (tv < lv) { if (dir === 0) dir = -1; parts.push('less total work (' + fmt(tv) + ' vs ' + fmt(lv) + ')'); }
    if (!parts.length) return { dir: 0, text: 'Matched last time. Steady is good.' };
    var text = parts.join(', ') + '.';
    if (dir < 0) text += ' Some days are lighter. That is fine.';
    return { dir: dir, text: text.charAt(0).toUpperCase() + text.slice(1) };
  }

  function lastTimeLine(exSessions, def) {
    var last = exSessions[exSessions.length - 1];
    if (!last) return 'Last time: nothing yet. This is your first time.';
    var w = working(last.sets);
    var unit = def.kind === 'level' ? '' : (def.unit || 'lb');
    var bits = w.map(function (s) { return def.kind === 'level' ? String(s.reps) : (s.reps + ' @ ' + fmt(num(s.weight))); });
    return 'Last time (' + last.date + '): ' + bits.join(', ') + (unit && def.kind !== 'level' ? ' ' + unit : '') + (last.effort ? ' · felt ' + last.effort : '');
  }

  return {
    DB: DB, MICRO: MICRO, working: working, topSet: topSet, volume: volume, nextLoad: nextLoad, dropLoad: dropLoad,
    daysBetween: daysBetween, suggestWorkout: suggestWorkout, exHistory: exHistory, phase: phase,
    twoFailsInRow: twoFailsInRow, recommend: recommend, compare: compare, lastTimeLine: lastTimeLine, fmt: fmt
  };
}));
