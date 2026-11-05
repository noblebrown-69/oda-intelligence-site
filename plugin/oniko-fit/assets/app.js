/* Oniko Fit page app. Vanilla JS, no network calls except same-site WordPress REST. */
(function () {
  'use strict';
  var CFG = window.ONIKO_CFG, E = window.OnikoEngine;
  var root = document.getElementById('oniko-app');
  if (!CFG || !E || !root) return;
  var P = CFG.program, EX = P.exercises;
  var EFFORTS = ['Easy', 'Good', 'Hard', 'Grind'];
  var qd = (location.search.match(/[?&]d=(\d{4}-\d{2}-\d{2})/) || [])[1];
  var st = { date: (qd && qd <= CFG.today) ? qd : CFG.today, day: null, program: '', workout: '', busy: false, view: 'log', result: null, msg: '' };

  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    for (var k in (attrs || {})) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    (kids || []).forEach(function (c) { if (c === null || c === undefined || c === false) return; el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  function mask(big) {
    var t = document.createElement('template');
    t.innerHTML = '<svg class="oniko-mask' + (big ? ' big' : '') + '" viewBox="0 0 64 64" aria-hidden="true"><path d="M14 22 C8 14 8 6 12 2 C12 10 16 15 22 18 Z" fill="#e11d2e"/><path d="M50 22 C56 14 56 6 52 2 C52 10 48 15 42 18 Z" fill="#e11d2e"/><path d="M32 14 C18 14 12 24 12 34 C12 48 22 60 32 60 C42 60 52 48 52 34 C52 24 46 14 32 14 Z" fill="#c1121f" stroke="#ff3b4a" stroke-width="1.5"/><path d="M18 30 L28 34 L19 37 Z" fill="#0b0709"/><path d="M46 30 L36 34 L45 37 Z" fill="#0b0709"/><circle cx="22.5" cy="34" r="1.6" fill="#ffd2d6"/><circle cx="41.5" cy="34" r="1.6" fill="#ffd2d6"/><path d="M22 46 Q32 52 42 46 L40 50 Q32 55 24 50 Z" fill="#0b0709"/><path d="M25 47 L26.5 50.5 L28 47.8 Z M39 47 L37.5 50.5 L36 47.8 Z" fill="#f4eef0"/><path d="M24 24 Q32 20 40 24" stroke="#0b0709" stroke-width="2" fill="none"/></svg>';
    return t.content.firstChild;
  }

  function api(method, path, body) {
    var url = CFG.root + path;
    var opt = { method: method, credentials: 'same-origin', headers: { 'X-WP-Nonce': CFG.nonce }, cache: 'no-store' };
    if (body) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    return fetch(url, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error((j && j.message) || ('Error ' + r.status)); e.status = r.status; throw e; }
        return j;
      });
    });
  }

  function addDays(d, n) {
    var t = new Date(Date.parse(d + 'T12:00:00Z') + n * 86400000);
    return t.toISOString().slice(0, 10);
  }
  function niceDate(d) {
    var t = new Date(Date.parse(d + 'T12:00:00Z'));
    return t.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  function load(date) {
    st.date = date; st.busy = true; st.msg = '';
    return api('GET', 'day?date=' + encodeURIComponent(date)).then(function (d) {
      st.day = d; st.busy = false;
      var s = d.session;
      var prog = (s && s.program) || d.prefs.program || st.program || 'gym';
      st.program = prog;
      st.workout = (s && s.workout) || E.suggestWorkout(d.history, prog);
      st.view = (s && s.done) ? 'done' : 'log';
      st.result = null;
      render();
    }).catch(fail);
  }
  function fail(e) {
    st.busy = false;
    st.msg = e.status === 401 || e.status === 403 ? 'Your sign-in expired. Reload the page and sign in again.' : (e.message || 'Something went wrong. Try again.');
    render();
  }

  function todaySets() { return (st.day && st.day.session && st.day.session.sets) || []; }
  function effortMap() { return (st.day && st.day.session && st.day.session.effort) || {}; }
  function plan(item) {
    var pr = P.programs[st.program];
    var p = { sets: item.sets, min: item.min, max: item.max, scheme: pr.scheme };
    if (item.learn && learnOn(item)) { p.sets = item.learn.sets; p.min = item.learn.min; p.max = item.learn.max; }
    return p;
  }
  function learnKey(item) { return 'oniko_learn_' + item.ex; }
  function learnOn(item) {
    if (!item.learn) return false;
    var v = localStorage.getItem(learnKey(item));
    if (v === null) return phaseNow().week <= item.learn.weeks;
    return v === '1';
  }
  function phaseNow() {
    var h = st.day ? st.day.history : [];
    var ph = E.phase(h, st.date);
    var plans = {};
    P.programs[st.program].workouts[st.workout].forEach(function (it) { plans[it.ex] = { sets: it.sets, min: it.min, max: it.max, scheme: P.programs[st.program].scheme }; });
    if (!ph.deload && E.twoFailsInRow(h, st.program, st.date, plans)) { ph.deload = true; ph.reason = 'Two tough sessions in a row.'; }
    return ph;
  }

  function post(path, body) {
    if (st.busy) return Promise.resolve();
    st.busy = true; render();
    return api('POST', path, body).then(function (r) { st.busy = false; return r; }, function (e) { fail(e); throw e; });
  }

  function selectWorkout(prog, w) {
    st.program = prog; st.workout = w;
    var has = todaySets().length || (st.day && st.day.session);
    render();
    var p = has ? post('select', { date: st.date, program: prog, workout: w }) : post('prefs', { program: prog });
    p.then(function (r) { if (r && r.session && st.day.session) { st.day.session.program = prog; st.day.session.workout = w; } render(); }).catch(function () {});
  }

  function logSet(item, repsEl, wEl, warm) {
    var reps = parseInt(repsEl.value, 10);
    var w = parseFloat(wEl.value);
    if (!(reps >= 0 && reps <= 100)) { repsEl.focus(); st.msg = 'Type how many reps you did.'; render(); return; }
    if (isNaN(w)) w = 0;
    post('set', { date: st.date, program: st.program, workout: st.workout, ex: item.ex, reps: reps, weight: w, warm: !!warm }).then(function (r) {
      if (!st.day.session) st.day.session = { program: st.program, workout: st.workout, effort: {}, flags: {}, sets: [] };
      st.day.session.sets = r.sets; st.msg = warm ? 'Warm-up logged. It will not count toward progress.' : 'Set logged. Rest ' + restText() + '.';
      render();
    }).catch(function () {});
  }
  function restText() { return st.program === 'gym' ? '2 to 3 minutes' : '90 seconds to 2 minutes'; }
  function undo(item) {
    post('undo', { date: st.date, ex: item.ex }).then(function (r) { st.day.session.sets = r.sets; st.msg = 'Last set removed.'; render(); }).catch(function () {});
  }
  function setEffort(item, tap) {
    post('effort', { date: st.date, ex: item.ex, tap: tap }).then(function (r) { st.day.session.effort = r.effort; render(); }).catch(function () {});
  }

  function exPrev(exId) { return E.exHistory(st.day.history, exId, st.date); }

  function analyse(item) {
    var def = EX[item.ex], p = plan(item);
    var prev = exPrev(item.ex);
    var ph = phaseNow();
    var target = E.recommend(def, p, prev, { phase: ph, levels: P.pushup_levels });
    var mine = todaySets().filter(function (s) { return s.ex === item.ex; });
    var work = E.working(mine);
    var res = { def: def, plan: p, prev: prev, target: target, sets: mine, work: work };
    if (work.length) {
      var withToday = prev.concat([{ date: st.date, sets: mine, effort: effortMap()[item.ex] || '' }]);
      res.next = E.recommend(def, p, withToday, { phase: { deload: false, comeback: 1 }, levels: P.pushup_levels });
      res.cmp = prev.length ? E.compare(mine, prev[prev.length - 1].sets, def.kind) : { dir: 0, text: 'First time logged. Nice start.' };
    }
    return res;
  }

  function unitLabel(def) { return def.kind === 'level' ? 'Surface' : 'Weight (' + def.unit + ')'; }
  function setText(def, s) {
    if (def.kind === 'level') return s.reps + ' reps · ' + (P.pushup_levels[(s.weight | 0) - 1] || 'level ' + s.weight);
    return s.reps + ' reps @ ' + E.fmt(s.weight) + ' ' + def.unit;
  }

  function howTo(def) {
    var media = def.media_url
      ? h('img', { class: 'media', src: def.media_url, alt: def.name + ' diagram', loading: 'lazy' })
      : h('div', { class: 'media placeholder', text: 'Diagram coming soon' });
    return h('details', { class: 'howto' }, [
      h('summary', { text: 'How to do it' }),
      media,
      def.video_url ? h('p', {}, [h('a', { href: def.video_url, rel: 'noopener noreferrer', target: '_blank', text: 'Watch a video' })]) : null,
      h('h4', { text: 'Setup' }), h('p', { text: def.setup }),
      h('h4', { text: 'Do it' }), h('ol', {}, def.steps.map(function (s) { return h('li', { text: s }); })),
      h('h4', { text: 'What you should feel' }), h('p', { class: 'feel', text: def.feel }),
      h('h4', { text: 'Common mistakes' }), h('ul', {}, def.mistakes.map(function (s) { return h('li', { text: s }); })),
      def.alternatives && def.alternatives.length ? h('h4', { text: 'Options' }) : null,
      def.alternatives && def.alternatives.length ? h('ul', { class: 'alts' }, def.alternatives.map(function (a) { return h('li', {}, [h('b', { text: a.name + ': ' }), a.cue]); })) : null,
      h('p', { class: 'safety', text: def.safety })
    ]);
  }

  function exCard(item, idx) {
    var a = analyse(item), def = a.def, p = a.plan;
    var rng = p.min === p.max ? p.sets + ' x ' + p.max : p.sets + ' x ' + p.min + '–' + p.max;
    var card = h('article', { class: 'card ex' + (item.optional ? ' optional' : ''), id: 'ex-' + item.ex });
    card.appendChild(h('div', { class: 'ex-head' }, [
      h('h2', { text: def.name }),
      h('span', { class: 'plan', text: rng + (def.kind === 'level' ? ' reps' : ' reps') })
    ]));
    if (item.learn) {
      var on = learnOn(item);
      card.appendChild(h('div', { class: 'learn' }, [
        h('p', { text: item.learn.text }),
        h('button', { class: 'btn ghost small', type: 'button', onclick: function () { localStorage.setItem(learnKey(item), on ? '0' : '1'); render(); }, text: on ? 'Switch to 1 x 5' : 'Use learning set (1 x 8)' })
      ]));
    }
    card.appendChild(h('p', { class: 'last', text: E.lastTimeLine(a.prev, def) }));
    var t = a.target;
    card.appendChild(h('div', { class: 'rec' + (t.estimate ? ' est' : '') + (t.ready ? ' ready' : '') }, [
      h('span', { class: 'tag', text: t.estimate ? 'Guess' : (t.ready ? 'Ready for more weight' : 'Today') }),
      h('span', { text: ' ' + t.text })
    ]));
    if (t.micro && t.micro.length) {
      card.appendChild(h('details', { class: 'micro' }, [h('summary', { text: 'Not ready for a heavier dumbbell? Try these first, in order' }), h('ol', {}, t.micro.map(function (m) { return h('li', { text: m }); }))]));
    }
    card.appendChild(howTo(def));

    if (a.sets.length) {
      card.appendChild(h('ol', { class: 'logged' }, a.sets.map(function (s) {
        return h('li', { class: s.warm ? 'warm' : '' }, [h('span', { class: 'sn', text: s.warm ? 'W' : String(s.set_no) }), h('span', { text: setText(def, s) }), s.warm ? h('span', { class: 'wtag', text: 'warm-up' }) : null]);
      })));
    }
    var nextNo = a.work.length + 1;
    var last = a.sets[a.sets.length - 1];
    var defW = last ? last.weight : (t.weight !== null && t.weight !== undefined ? t.weight : '');
    var defR = t.reps || p.min;
    var repsIn = h('input', { type: 'number', inputmode: 'numeric', pattern: '[0-9]*', min: '0', max: '100', value: String(defR), 'aria-label': 'Reps', id: 'reps-' + item.ex });
    var wIn;
    if (def.kind === 'level') {
      wIn = h('select', { 'aria-label': 'Surface', id: 'w-' + item.ex }, P.pushup_levels.map(function (l, i) { return h('option', { value: String(i + 1), text: l, selected: String(defW || 1) === String(i + 1) }); }));
    } else {
      wIn = h('input', { type: 'number', inputmode: 'decimal', step: '0.5', min: '0', max: '2000', value: defW === '' ? '' : String(defW), placeholder: '0', 'aria-label': unitLabel(def), id: 'w-' + item.ex });
    }
    var doneAll = a.work.length >= p.sets;
    card.appendChild(h('div', { class: 'entry' }, [
      h('div', { class: 'setno', text: doneAll ? 'Extra set' : 'Set ' + nextNo + ' of ' + p.sets }),
      h('label', {}, [h('span', { text: 'Reps' }), repsIn]),
      h('label', {}, [h('span', { text: unitLabel(def) }), wIn]),
      h('button', { class: 'btn primary log', type: 'button', disabled: st.busy, onclick: function () { logSet(item, repsIn, wIn, false); }, text: 'Log set' }),
      h('div', { class: 'row2' }, [
        h('button', { class: 'btn ghost', type: 'button', disabled: st.busy, onclick: function () { logSet(item, repsIn, wIn, true); }, text: 'Warm-up' }),
        h('button', { class: 'btn ghost', type: 'button', disabled: st.busy || !a.sets.length, onclick: function () { undo(item); }, text: 'Undo last' })
      ])
    ]));
    if (a.work.length && (doneAll || a.work.length >= 1)) {
      var cur = effortMap()[item.ex] || '';
      card.appendChild(h('div', { class: 'effort' }, [
        h('p', { text: doneAll ? 'How hard did the last set feel?' : 'After your last set: how hard did it feel?' }),
        h('div', { class: 'taps' }, EFFORTS.map(function (e) {
          return h('button', { type: 'button', class: 'tap' + (cur === e ? ' on' : ''), 'aria-pressed': cur === e ? 'true' : 'false', disabled: st.busy, onclick: function () { setEffort(item, cur === e ? '' : e); }, text: e });
        }))
      ]));
    }
    if (a.cmp && a.cmp.text) card.appendChild(h('p', { class: 'cmp ' + (a.cmp.dir > 0 ? 'up' : a.cmp.dir < 0 ? 'down' : 'even'), text: a.cmp.text }));
    if (a.next && doneAll) {
      card.appendChild(h('div', { class: 'rec next' + (a.next.ready ? ' ready' : '') }, [h('span', { class: 'tag', text: a.next.ready ? 'Ready for more weight' : 'Next time' }), h('span', { text: ' ' + a.next.text })]));
    }
    return card;
  }

  function topBar() {
    return h('header', { class: 'top' }, [
      mask(false),
      h('div', {}, [h('h1', { class: 'neon', text: 'Oniko Fit' }), h('p', { class: 'hi', text: 'Hi ' + (CFG.name || 'there') + '. One set at a time.' })])
    ]);
  }

  function dateBar() {
    var input = h('input', { type: 'date', value: st.date, max: CFG.today, 'aria-label': 'Workout date', onchange: function (e) { if (e.target.value) load(e.target.value); } });
    return h('div', { class: 'datebar' }, [
      h('button', { class: 'btn ghost sq', type: 'button', 'aria-label': 'Previous day', onclick: function () { load(addDays(st.date, -1)); }, text: '‹' }),
      h('div', { class: 'dwrap' }, [h('span', { class: 'dlabel', text: st.date === CFG.today ? 'Today · ' + niceDate(st.date) : niceDate(st.date) }), input]),
      h('button', { class: 'btn ghost sq', type: 'button', 'aria-label': 'Next day', disabled: st.date >= CFG.today, onclick: function () { load(addDays(st.date, 1)); }, text: '›' })
    ]);
  }

  function picker() {
    var sug = E.suggestWorkout(st.day.history, st.program);
    var seg = function (opts, cur, fn) {
      return h('div', { class: 'seg', role: 'group' }, opts.map(function (o) {
        return h('button', { type: 'button', class: cur === o[0] ? 'on' : '', 'aria-pressed': cur === o[0] ? 'true' : 'false', onclick: function () { fn(o[0]); } }, [o[1], o[2] ? h('small', { text: o[2] }) : null]);
      }));
    };
    return h('section', { class: 'card picker' }, [
      h('h3', { text: 'Where are you training?' }),
      seg([['gym', 'Gym'], ['home', 'Home']], st.program, function (v) { selectWorkout(v, E.suggestWorkout(st.day.history, v)); }),
      h('h3', { text: 'Which workout?' }),
      seg([['A', 'Workout A', sug === 'A' ? 'Up next' : ''], ['B', 'Workout B', sug === 'B' ? 'Up next' : '']], st.workout, function (v) { selectWorkout(st.program, v); }),
      h('p', { class: 'muted', text: P.programs[st.program].blurb }),
      h('p', { class: 'muted small', text: P.programs[st.program].rest + ' ' + P.programs[st.program].length })
    ]);
  }

  function infoCards() {
    var out = [];
    var ph = phaseNow();
    if (ph.comebackText) out.push(h('div', { class: 'banner', text: ph.comebackText }));
    else if (ph.deload) out.push(h('div', { class: 'banner', text: 'Easy week. ' + ph.reason + ' Use about 10 to 15% less weight (or just 2 sets) this week, then back to normal.' }));
    var firstTime = !st.day.history.some(function (x) { return x.done; });
    var sg = P.start_guide;
    out.push(h('details', { class: 'card info', open: firstTime ? true : null }, [h('summary', { text: sg.title }), h('p', { text: sg.text }), h('ul', {}, sg.notes.map(function (n) { return h('li', { text: n }); }))]));
    out.push(h('details', { class: 'card info' }, [h('summary', { text: P.warmup.title }), h('ol', {}, P.warmup.steps.map(function (n) { return h('li', { text: n }); }))]));
    out.push(h('details', { class: 'card info' }, [h('summary', { text: 'Schedule and safety' }), h('p', { text: P.schedule }), h('p', { text: P.programs[st.program].rest }), h('p', { class: 'safety', text: P.safety })]));
    return out;
  }

  function otherSets() {
    var items = P.programs[st.program].workouts[st.workout].map(function (i) { return i.ex; });
    var other = todaySets().filter(function (s) { return items.indexOf(s.ex) === -1 || s.program !== st.program; }).filter(function (s) { return items.indexOf(s.ex) === -1; });
    if (!other.length) return null;
    return h('section', { class: 'card other' }, [
      h('h3', { text: 'Also logged today' }),
      h('p', { class: 'muted small', text: 'You switched workouts. These sets are kept and will be in your log.' }),
      h('ul', {}, other.map(function (s) { return h('li', { text: (EX[s.ex] ? EX[s.ex].name : s.ex) + ': ' + setText(EX[s.ex] || { kind: 'load', unit: 'lb' }, s) + (s.warm ? ' (warm-up)' : '') + ' · ' + s.program + ' ' + s.workout }); }))
    ]);
  }

  function highlights() {
    var out = [];
    P.programs[st.program].workouts[st.workout].forEach(function (item) {
      var a = analyse(item);
      if (!a.work.length) return;
      if (a.cmp && a.cmp.text) out.push(a.def.name + ': ' + a.cmp.text);
      if (a.next) out.push(a.def.name + ' next time: ' + a.next.text);
    });
    return out;
  }

  function finishBox() {
    var notes = h('textarea', { maxlength: '1000', rows: '3', placeholder: 'Anything to tell your coach? (optional)', id: 'oniko-notes' });
    if (st.day.session && st.day.session.notes) notes.value = st.day.session.notes;
    var fl = (st.day.session && st.day.session.flags) || {};
    var le = h('input', { type: 'checkbox', id: 'fl-le', checked: fl.low_energy ? true : null });
    var jp = h('input', { type: 'checkbox', id: 'fl-jp', checked: fl.joint_pain ? true : null });
    var n = E.working(todaySets()).length;
    return h('section', { class: 'card finish' }, [
      h('h3', { text: 'All done?' }),
      notes,
      h('label', { class: 'check' }, [le, h('span', { text: 'Low energy today' })]),
      h('label', { class: 'check' }, [jp, h('span', { text: 'Something hurt in a joint' })]),
      h('button', { class: 'btn primary big', type: 'button', disabled: st.busy || !todaySets().length, onclick: function () {
        post('complete', { date: st.date, notes: notes.value, flags: { low_energy: le.checked, joint_pain: jp.checked }, highlights: highlights() }).then(function (r) {
          st.result = r; return load(st.date);
        }).then(function () { st.view = 'done'; render(); window.scrollTo(0, 0); }).catch(function () {});
      }, text: 'Log workout' }),
      h('p', { class: 'muted small', text: n ? n + ' working sets so far.' : 'Log a set first.' })
    ]);
  }

  function summary() {
    var items = P.programs[st.program].workouts[st.workout];
    var kids = [h('h2', { class: 'neon', text: 'Workout logged!' }),
      h('p', { class: 'lead', text: 'Great work. ' + P.programs[st.program].label + ' ' + st.workout + ' · ' + niceDate(st.date) })];
    if (st.result) kids.push(h('p', { class: 'muted small', text: st.result.mailed ? 'Sent to your coach bots.' : 'Saved. Your coach bots will pick it up shortly.' }));
    var anyReady = false;
    items.forEach(function (item) {
      var a = analyse(item);
      if (!a.work.length) return;
      var vol = E.volume(a.sets, a.def.kind), top = E.topSet(a.sets);
      if (a.next && a.next.ready) anyReady = true;
      kids.push(h('div', { class: 'sum-ex' }, [
        h('h3', { text: a.def.name }),
        h('p', { text: a.work.length + ' sets · top set ' + setText(a.def, top) + ' · total ' + E.fmt(vol) + (a.def.kind === 'level' ? ' reps' : ' lb') + (effortMap()[item.ex] ? ' · felt ' + effortMap()[item.ex] : '') }),
        a.cmp ? h('p', { class: 'cmp ' + (a.cmp.dir > 0 ? 'up' : a.cmp.dir < 0 ? 'down' : 'even'), text: a.cmp.text }) : null,
        a.next ? h('p', { class: 'rec next' + (a.next.ready ? ' ready' : '') }, [h('span', { class: 'tag', text: a.next.ready ? 'Ready for more weight' : 'Next time' }), ' ' + a.next.text]) : null
      ]));
    });
    if (anyReady) kids.splice(2, 0, h('div', { class: 'banner ready', text: 'Ready for more weight on at least one lift next time!' }));
    var nextW = st.workout === 'A' ? 'B' : 'A';
    kids.push(h('p', { text: 'Next up: ' + P.programs[st.program].label + ' ' + nextW + '. Rest a day in between.' }));
    kids.push(h('button', { class: 'btn ghost', type: 'button', onclick: function () { st.view = 'log'; render(); }, text: 'Edit this day' }));
    return h('section', { class: 'card summary' }, kids);
  }

  function render() {
    var y = window.scrollY;
    root.textContent = '';
    root.appendChild(topBar());
    if (!st.day) { root.appendChild(h('p', { class: 'msg', text: st.msg || 'Loading…' })); return; }
    root.appendChild(dateBar());
    if (st.msg) root.appendChild(h('p', { class: 'msg', role: 'status', text: st.msg }));
    if (st.view === 'done') {
      root.appendChild(summary());
    } else {
      root.appendChild(picker());
      infoCards().forEach(function (c) { root.appendChild(c); });
      var o = otherSets(); if (o) root.appendChild(o);
      P.programs[st.program].workouts[st.workout].forEach(function (it, i) { root.appendChild(exCard(it, i)); });
      root.appendChild(finishBox());
    }
    root.appendChild(h('footer', {}, [h('a', { href: CFG.logout, text: 'Sign out' })]));
    window.scrollTo(0, y);
  }

  if ('serviceWorker' in navigator && CFG.sw && location.protocol === 'https:') {
    navigator.serviceWorker.register(CFG.sw, { scope: CFG.scope }).catch(function () {});
  }
  window.OnikoApp = { state: st, load: load, render: render };
  render();
  load(st.date);
})();
