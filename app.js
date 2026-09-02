/* PCMS prototype — shared client logic.
   No dependencies, no backend. State lives in sessionStorage so it survives
   navigation between pages, but is wiped on a genuine page RELOAD (see below),
   which resets the app to its seed demo data. Close the tab and it's gone too. */
(function () {
  'use strict';

  var KEY = 'pcms_state';
  var TODAY = '2026-08-13';        // "today" for the appointments view (a Wednesday)
  var WEEK_START = '2026-08-11';   // Monday of the schedule week ("week of 11 Aug")

  /* ---- reload detection: clear state on F5 / reload, keep it on navigation ---- */
  function isReload() {
    try {
      var nav = performance.getEntriesByType('navigation')[0];
      if (nav && nav.type) return nav.type === 'reload';
      if (performance.navigation) return performance.navigation.type === 1;
    } catch (e) {}
    return false;
  }
  if (isReload()) { try { sessionStorage.removeItem(KEY); } catch (e) {} }

  /* ---- persistence ---- */
  function load() { try { return JSON.parse(sessionStorage.getItem(KEY)); } catch (e) { return null; } }
  function save(s) { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

  var uid = 0;
  function id() { return 'b' + (++uid) + '_' + Date.now().toString(36); }

  function seed() {
    return {
      bookings: [
        // --- today (13 Aug) — these populate the Appointments list AND the Wed column ---
        { id: id(), date: '2026-08-13', time: '9:00 AM',  customer: 'Rachel Tan',   therapist: 'Dr. Amir Hassan', service: 'Sports massage therapy',      status: 'pending' },
        { id: id(), date: '2026-08-13', time: '10:00 AM', customer: 'Marcus Wong',  therapist: 'Dr. Amir Hassan', service: 'Sports massage therapy',      status: 'confirmed' },
        { id: id(), date: '2026-08-13', time: '11:30 AM', customer: 'Chloe Ooi',    therapist: 'Dr. Priya Nair',  service: 'Chiropractic',               status: 'arrived' },
        { id: id(), date: '2026-08-13', time: '2:00 PM',  customer: 'Kavitha Devi', therapist: 'Dr. Amir Hassan', service: 'Post-surgery rehabilitation', status: 'pending' },
        // --- rest of the week — fill out the schedule grid ---
        { id: id(), date: '2026-08-11', time: '10:00 AM', customer: 'Jason Lee',     therapist: 'Dr. Amir Hassan', service: 'Sports massage therapy', status: 'confirmed' },
        { id: id(), date: '2026-08-11', time: '10:00 AM', customer: 'Michelle Wong', therapist: 'Dr. Priya Nair',  service: 'Chiropractic',           status: 'confirmed' },
        { id: id(), date: '2026-08-12', time: '11:30 AM', customer: 'Rachel Tan',    therapist: 'Dr. Amir Hassan', service: 'Sports massage therapy', status: 'confirmed' },
        { id: id(), date: '2026-08-15', time: '11:30 AM', customer: 'Chloe Ooi',     therapist: 'Dr. Priya Nair',  service: 'Chiropractic',           status: 'confirmed' }
      ],
      blocks: [
        { id: id(), date: '2026-08-14', time: '9:00 AM',  therapist: 'Dr. Amir Hassan' },
        { id: id(), date: '2026-08-14', time: '10:00 AM', therapist: 'Dr. Amir Hassan' }
      ]
    };
  }

  var state = load();
  if (!state) { state = seed(); save(state); }

  /* ---- reference data ---- */
  var SERVICES = {
    'Sports massage therapy':      { price: 120, mins: 60 },
    'Post-surgery rehabilitation': { price: 150, mins: 75 },
    'Chiropractic':                { price: 90,  mins: 45 },
    'Scoliosis treatment':         { price: 200, mins: 60 }
  };
  var THERAPISTS = ['Dr. Amir Hassan', 'Dr. Priya Nair'];

  /* ---- helpers ---- */
  function toMin(t) {
    var m = String(t).trim().match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return 0;
    var h = (+m[1]) % 12; if (/pm/i.test(m[3])) h += 12;
    return h * 60 + (+m[2]);
  }
  function dayIdx(dateStr) {
    var a = new Date(dateStr + 'T00:00'), b = new Date(WEEK_START + 'T00:00');
    return Math.round((a - b) / 86400000); // 0 = Mon ... 4 = Fri
  }
  function shortName(n) {
    n = String(n).replace(/^Dr\.?\s+/i, '').trim();
    var p = n.split(/\s+/);
    return p.length === 1 ? n : p[0].charAt(0) + '. ' + p.slice(1).join(' ');
  }
  function prettyDate(d) {
    try {
      return new Date(d + 'T00:00').toLocaleDateString('en-GB',
        { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) { return d; }
  }
  function money(n) { return n.toFixed(2); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---- toast ---- */
  var toastTimer;
  function toast(msg, kind) {
    var host = document.getElementById('pcms-toast');
    if (!host) { host = document.createElement('div'); host.id = 'pcms-toast'; document.body.appendChild(host); }
    host.className = 'pcms-toast' + (kind ? ' pcms-toast-' + kind : '') + ' show';
    host.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { host.className = host.className.replace(' show', ''); }, 2800);
  }

  /* ---- public API ---- */
  var API = {
    TODAY: TODAY,
    SERVICES: SERVICES,
    THERAPISTS: THERAPISTS,
    state: function () { return state; },
    bookings: function () { return state.bookings.slice(); },
    blocks: function () { return state.blocks.slice(); },
    toast: toast,
    money: money,
    prettyDate: prettyDate,
    shortName: shortName,
    isAvailable: function (therapist, date, time, ignoreId) {
      var clash = function (arr) {
        return arr.some(function (x) {
          return x.id !== ignoreId && x.therapist === therapist && x.date === date && x.time === time;
        });
      };
      return !clash(state.bookings) && !clash(state.blocks);
    },
    addBooking: function (b) {
      b.id = id(); b.status = b.status || 'pending';
      state.bookings.push(b); save(state); return b;
    },
    updateBooking: function (bid, patch) {
      var b = state.bookings.filter(function (x) { return x.id === bid; })[0];
      if (b) { for (var k in patch) b[k] = patch[k]; save(state); }
      return b;
    },
    getBooking: function (bid) {
      return state.bookings.filter(function (x) { return x.id === bid; })[0];
    },
    addBlock: function (bl) { bl.id = id(); state.blocks.push(bl); save(state); return bl; },
    setInvoice: function (bid) { try { sessionStorage.setItem('pcms_invoice', bid); } catch (e) {} },
    takeInvoice: function () {
      try { var v = sessionStorage.getItem('pcms_invoice'); return v; } catch (e) { return null; }
    }
  };
  window.PCMS = API;

  /* ======================================================================
     Grid rendering (shared by both schedule pages)
     ====================================================================== */
  function renderGrid(tbody, opts) {
    var bookings = opts.bookings || [];
    var blocks = opts.blocks || [];
    var rows = {}, times = [];
    function ensure(t) { if (!(t in rows)) { rows[t] = {}; times.push(t); } return rows[t]; }

    bookings.forEach(function (b) {
      var ci = dayIdx(b.date); if (ci < 0 || ci > 4) return;
      var r = ensure(b.time); (r[ci] = r[ci] || []).push({ type: 'book', b: b });
    });
    blocks.forEach(function (bl) {
      var ci = dayIdx(bl.date); if (ci < 0 || ci > 4) return;
      var r = ensure(bl.time); (r[ci] = r[ci] || []).push({ type: 'block', b: bl });
    });
    times.sort(function (a, b) { return toMin(a) - toMin(b); });

    if (!times.length) {
      tbody.innerHTML = '<tr><td class="time"></td><td colspan="5" class="muted" ' +
        'style="text-align:center;padding:26px;">No sessions scheduled this week.</td></tr>';
      return;
    }
    var html = '';
    times.forEach(function (t) {
      html += '<tr><td class="time">' + esc(t) + '</td>';
      for (var ci = 0; ci < 5; ci++) {
        html += '<td>' + (rows[t][ci] || []).map(function (e) { return slotHtml(e, opts); }).join(' ') + '</td>';
      }
      html += '</tr>';
    });
    tbody.innerHTML = html;
  }
  function slotHtml(entry, opts) {
    if (entry.type === 'block') return '<span class="slot slot-blocked">Blocked</span>';
    var b = entry.b;
    var cls = b.therapist.indexOf('Priya') >= 0 ? 'slot-green' : 'slot-booked';
    var inner = (opts.showTherapist ? shortName(b.therapist) + '<br>' : '') + shortName(b.customer);
    return '<span class="slot ' + cls + ' two" title="' + esc(b.service) + '">' + inner + '</span>';
  }

  /* ======================================================================
     Per-page modules
     ====================================================================== */
  var pages = {};

  /* ---------- Appointments (receptionist) ---------- */
  pages.appointments = function () {
    var tbody = document.getElementById('apptRows');
    var chipPending = document.getElementById('chipPending');
    var chipConfirmed = document.getElementById('chipConfirmed');
    if (!tbody) return;

    function render() {
      var list = API.bookings().filter(function (b) { return b.date === TODAY; })
        .sort(function (a, b) { return toMin(a.time) - toMin(b.time); });

      var nP = 0, nC = 0;
      tbody.innerHTML = list.map(function (b) {
        if (b.status === 'pending') nP++;
        if (b.status === 'confirmed') nC++;
        var action;
        if (b.status === 'pending')
          action = '<button class="btn" data-act="confirm" data-id="' + b.id + '">Confirm</button>';
        else if (b.status === 'confirmed')
          action = '<button class="btn btn-dark" data-act="arrive" data-id="' + b.id + '">Mark arrived</button>';
        else if (b.status === 'arrived')
          action = '<button class="btn" data-act="invoice" data-id="' + b.id + '">Generate invoice</button>';
        else
          action = '<span class="chk">Paid · invoice closed</span>';

        return '<tr><td><strong>' + esc(b.time) + '</strong></td>' +
          '<td class="name">' + esc(b.customer) + '</td>' +
          '<td>' + esc(b.therapist) + '</td>' +
          '<td>' + pill(b.status) + '</td>' +
          '<td class="right">' + action + '</td></tr>';
      }).join('') || '<tr><td colspan="5" class="muted" style="text-align:center;padding:26px;">' +
        'No appointments today. <a href="booking.html">Book one</a>.</td></tr>';

      if (chipPending) chipPending.textContent = nP + ' pending';
      if (chipConfirmed) chipConfirmed.textContent = nC + ' confirmed';
    }
    function pill(s) {
      var map = { pending: ['pill-amber', 'Pending'], confirmed: ['pill-green', 'Confirmed'],
        arrived: ['pill-grey', 'Arrived'], paid: ['pill-green', 'Paid'] };
      var m = map[s] || ['pill-grey', s];
      return '<span class="pill ' + m[0] + '">' + m[1] + '</span>';
    }

    tbody.addEventListener('click', function (e) {
      var el = e.target.closest('[data-act]'); if (!el) return;
      e.preventDefault();
      var act = el.dataset.act, bid = el.dataset.id, b = API.getBooking(bid);
      if (!b) return;
      if (act === 'confirm') { API.updateBooking(bid, { status: 'confirmed' });
        toast('Booking confirmed — reminder sent to ' + b.customer, 'green'); render(); }
      else if (act === 'arrive') { API.updateBooking(bid, { status: 'arrived' });
        toast(b.customer + ' checked in'); render(); }
      else if (act === 'invoice') { API.setInvoice(bid); location.href = 'billing.html'; }
    });

    if (sessionStorage.getItem('pcms_flash')) {
      toast(sessionStorage.getItem('pcms_flash'), 'green');
      sessionStorage.removeItem('pcms_flash');
    }
    render();
  };

  /* ---------- Booking (receptionist) ---------- */
  pages.booking = function () {
    var cust = document.getElementById('bkCustomer');
    var svc = document.getElementById('bkService');
    var date = document.getElementById('bkDate');
    var time = document.getElementById('bkTime');
    var ther = document.getElementById('bkTherapist');
    var avail = document.getElementById('bkAvail');
    var confirm = document.getElementById('bkConfirm');
    if (!confirm) return;

    if (date && !date.value) date.value = TODAY;

    function refreshAvail() {
      if (!avail) return true;
      var ok = API.isAvailable(ther.value, date.value, time.value);
      avail.className = 'banner ' + (ok ? 'banner-green' : 'banner-red');
      avail.querySelector('.msg').textContent = ok
        ? ther.value + ' is available at this time.'
        : ther.value + ' is already booked at ' + time.value + ' on ' + prettyDate(date.value) + '.';
      return ok;
    }
    [svc, date, time, ther].forEach(function (el) { if (el) el.addEventListener('change', refreshAvail); });
    refreshAvail();

    confirm.addEventListener('click', function (e) {
      e.preventDefault();
      var name = (cust.value || '').trim();
      if (!name) { toast('Enter a customer name first', 'red'); cust.focus(); return; }
      if (!refreshAvail()) { toast('That slot is not available — pick another', 'red'); return; }
      var b = API.addBooking({
        date: date.value, time: time.value, customer: name,
        therapist: ther.value, service: svc.value, status: 'pending'
      });
      var msg = 'Appointment booked: ' + name + ' with ' + b.therapist +
        ', ' + prettyDate(b.date) + ' ' + b.time;
      sessionStorage.setItem('pcms_flash', msg);
      location.href = 'appointments.html';
    });
  };

  /* ---------- Receptionist schedule (all therapists) ---------- */
  pages['recept-schedule'] = function () {
    var tbody = document.getElementById('schedBody');
    var filter = document.getElementById('schedFilter');
    if (!tbody) return;
    function render() {
      var f = filter ? filter.value : 'All therapists';
      var bk = API.bookings().filter(function (b) { return f === 'All therapists' || b.therapist === f; });
      renderGrid(tbody, { bookings: bk, showTherapist: true });
    }
    if (filter) filter.addEventListener('change', render);
    render();
  };

  /* ---------- Therapist schedule (own view + block a slot) ---------- */
  pages['ther-schedule'] = function () {
    var tbody = document.getElementById('therSchedBody');
    var ME = 'Dr. Amir Hassan';
    if (!tbody) return;
    function render() {
      renderGrid(tbody, {
        bookings: API.bookings().filter(function (b) { return b.therapist === ME; }),
        blocks: API.blocks().filter(function (b) { return b.therapist === ME; }),
        showTherapist: false
      });
    }
    var blkDate = document.getElementById('blkDate');
    var blkFrom = document.getElementById('blkFrom');
    var blkAdd = document.getElementById('blkAdd');
    if (blkAdd) blkAdd.addEventListener('click', function (e) {
      e.preventDefault();
      if (!blkDate.value || !blkFrom.value) { toast('Pick a date and a start time', 'red'); return; }
      // <input type=time> gives 24h "HH:MM" — convert to the grid's "h:MM AM/PM"
      var parts = blkFrom.value.split(':'), h = +parts[0], mm = parts[1];
      var ap = h >= 12 ? 'PM' : 'AM', h12 = (h % 12) || 12;
      var t = h12 + ':' + mm + ' ' + ap;
      API.addBlock({ date: blkDate.value, time: t, therapist: ME });
      toast('Time slot blocked — ' + prettyDate(blkDate.value) + ' ' + t, 'green');
      render();
    });
    render();
  };

  /* ---------- Billing / invoice ---------- */
  pages.billing = function () {
    var head = document.getElementById('billHead');
    var rowsEl = document.getElementById('billRows');
    var subEl = document.getElementById('billSub');
    var totEl = document.getElementById('billTotal');
    var payMethod = document.getElementById('payMethod');
    var actions = document.getElementById('billActions');
    var btnPrint = document.getElementById('btnPrint');
    var btnPay = document.getElementById('btnPay');
    if (!rowsEl) return;

    var invBooking = null;
    var invId = API.takeInvoice();
    if (invId) invBooking = API.getBooking(invId);

    var customer = invBooking ? invBooking.customer : 'Rachel Tan';
    var service = invBooking ? invBooking.service : 'Sports massage therapy';
    var when = invBooking ? (prettyDate(invBooking.date) + ', ' + invBooking.time) : '13 Aug 2026, 11:30 AM';
    var svc = SERVICES[service] || { price: 120, mins: 60 };

    var items = [
      { label: service + ' (' + svc.mins + ' min)', amount: svc.price, fixed: true },
      { label: 'Muscle relief gel', amount: 25 }
    ];

    if (head) head.textContent = 'Customer: ' + customer + ' · Session: ' + when;

    function totals() {
      var sub = items.reduce(function (s, i) { return s + i.amount; }, 0);
      var disc = Math.round(sub * 0.10 * 100) / 100;
      return { sub: sub, disc: disc, total: sub - disc };
    }
    function render() {
      var t = totals();
      rowsEl.innerHTML = items.map(function (i, idx) {
        var rm = i.fixed ? '' :
          '<button class="linedel" data-idx="' + idx + '" title="Remove item" aria-label="Remove item">&times;</button>';
        return '<tr><td class="name">' + esc(i.label) + '</td>' +
          '<td class="right num">' + money(i.amount) + ' ' + rm + '</td></tr>';
      }).join('') +
        '<tr><td>Membership discount (10%)</td><td class="right num amt-red">-' + money(t.disc) + '</td></tr>';
      if (subEl) subEl.textContent = 'RM ' + money(t.sub);
      if (totEl) totEl.textContent = 'RM ' + money(t.total);
    }
    rowsEl.addEventListener('click', function (e) {
      var el = e.target.closest('.linedel'); if (!el) return;
      e.preventDefault();
      items.splice(+el.dataset.idx, 1); render();
    });

    if (btnPrint) btnPrint.addEventListener('click', function (e) {
      e.preventDefault(); window.print();
    });
    if (btnPay) btnPay.addEventListener('click', function (e) {
      e.preventDefault();
      var t = totals();
      var method = payMethod ? payMethod.value : 'Card';
      if (invBooking) API.updateBooking(invBooking.id, { status: 'paid' });
      if (actions) {
        actions.innerHTML = '<div class="banner banner-green" style="margin:0;flex:1;">' +
          '<span class="ico"><svg class="icon"><use href="../icons.svg#check"/></svg></span>' +
          '<span>Payment of <strong>RM ' + money(t.total) + '</strong> received via ' + esc(method) +
          '. Invoice closed for ' + esc(customer) + '.</span></div>' +
          '<a class="btn" href="appointments.html">Back to appointments</a>';
      }
      toast('Payment recorded — RM ' + money(t.total), 'green');
    });

    render();
  };

  /* ---------- Therapist: treatment record ---------- */
  pages['treatment'] = function () {
    var save = document.getElementById('saveRecord');
    if (save) save.addEventListener('click', function (e) {
      e.preventDefault(); toast('Treatment record saved', 'green');
    });
  };

  /* ---------- Therapist: prescribe medication ---------- */
  pages['medication'] = function () {
    var med = document.getElementById('medName');
    var dose = document.getElementById('medDose');
    var qty = document.getElementById('medQty');
    var add = document.getElementById('medAdd');
    var body = document.getElementById('medRows');
    var PRICES = { 'Muscle relief gel': 25, 'Anti-inflammatory tablet': 12, 'Pain relief spray': 18 };
    if (add && body) add.addEventListener('click', function (e) {
      e.preventDefault();
      var name = med.value, d = (dose.value || '').trim() || '—', q = Math.max(1, +qty.value || 1);
      var sub = (PRICES[name] || 0) * q;
      var tr = document.createElement('tr');
      tr.innerHTML = '<td class="name">' + esc(name) + '</td><td>' + esc(d) + '</td>' +
        '<td class="num">' + q + '</td><td class="right num">' + money(sub) + '</td>';
      body.appendChild(tr);
      toast('Added ' + name + ' to prescription', 'green');
    });
  };

  /* ---------- Register new customer ---------- */
  pages['register'] = function () {
    var save = document.getElementById('saveCustomer');
    var name = document.getElementById('regName');
    if (save) save.addEventListener('click', function (e) {
      e.preventDefault();
      if (name && !name.value.trim()) { toast('Enter the customer name', 'red'); name.focus(); return; }
      sessionStorage.setItem('pcms_flash_cust', (name ? name.value.trim() : 'Customer') + ' registered');
      location.href = 'customers.html';
    });
  };
  pages['customers'] = function () {
    var f = sessionStorage.getItem('pcms_flash_cust');
    if (f) { toast(f, 'green'); sessionStorage.removeItem('pcms_flash_cust'); }
    var box = document.getElementById('custSearch');
    var btn = document.getElementById('custSearchBtn');
    var rows = document.querySelectorAll('#custRows tr');
    function filter() {
      var q = (box.value || '').toLowerCase();
      rows.forEach(function (r) {
        r.style.display = r.textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none';
      });
    }
    if (box) box.addEventListener('input', filter);
    if (btn) btn.addEventListener('click', function (e) { e.preventDefault(); filter(); });
  };

  /* ---------- Login ---------- */
  pages['login'] = function () {
    var forgot = document.getElementById('forgot');
    if (forgot) forgot.addEventListener('click', function (e) {
      e.preventDefault();
      toast('Prototype: password for every account is "password"');
    });
  };

  /* ======================================================================
     Global fallback — every remaining button/link does *something*
     ====================================================================== */
  function wireFallback() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('a, button');
      if (!el || e.defaultPrevented) return;
      if (el.disabled) return;
      // leave real form submits alone (their own handler cancels/submits)
      if (el.tagName === 'BUTTON' && (el.type === 'submit' || el.type === 'reset')) return;
      var href = el.getAttribute('href');
      // real navigation links: let them through
      if (el.tagName === 'A' && href && href.charAt(0) !== '#') return;
      // in-page anchor that exists: let it scroll
      if (href && href.length > 1 && href.charAt(0) === '#') {
        try { if (document.querySelector(href)) return; } catch (err) {}
      }
      // submit buttons handled by their own module already will have preventDefault'd
      var label = (el.textContent || '').replace(/\s+/g, ' ').trim() || 'This control';
      e.preventDefault();
      toast('"' + label + '" — not wired in this prototype');
    });
  }

  /* ---- boot ---- */
  function boot() {
    var appEl = document.querySelector('[data-page]');
    var page = appEl ? appEl.getAttribute('data-page') : null;
    if (page && pages[page]) { try { pages[page](); } catch (e) { console.error(e); } }
    wireFallback();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
