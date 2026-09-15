/* PCMS prototype: shared client logic.
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

  function defaultCustomers() {
    return [
      { id: id(), name: 'Rachel Tan',  contact: '012-345 6789', lastVisit: '2026-08-13', sessions: 8 },
      { id: id(), name: 'Marcus Wong', contact: '016-778 2231', lastVisit: '2026-08-10', sessions: 3 },
      { id: id(), name: 'Chloe Ooi',   contact: '019-902 4471', lastVisit: '2026-08-02', sessions: 1 }
    ];
  }

  function seed() {
    return {
      customers: defaultCustomers(),
      bookings: [
        // today (13 Aug): these fill the Appointments list and the Wed column
        { id: id(), date: '2026-08-13', time: '9:00 AM',  customer: 'Rachel Tan',   therapist: 'Dr. Amir Hassan', service: 'Sports massage therapy',      status: 'pending' },
        { id: id(), date: '2026-08-13', time: '10:00 AM', customer: 'Marcus Wong',  therapist: 'Dr. Amir Hassan', service: 'Sports massage therapy',      status: 'confirmed' },
        { id: id(), date: '2026-08-13', time: '11:30 AM', customer: 'Chloe Ooi',    therapist: 'Dr. Priya Nair',  service: 'Chiropractic',               status: 'arrived' },
        { id: id(), date: '2026-08-13', time: '2:00 PM',  customer: 'Kavitha Devi', therapist: 'Dr. Amir Hassan', service: 'Post-surgery rehabilitation', status: 'pending' },
        // rest of the week: fill out the schedule grid
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
  if (!state.customers) { state.customers = defaultCustomers(); save(state); }

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
    customers: function () { return state.customers.slice(); },
    addCustomer: function (c) {
      c.id = id(); c.sessions = c.sessions || 0; c.lastVisit = c.lastVisit || null;
      state.customers.unshift(c); save(state); return c;
    },
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
    var dateInput = document.getElementById('apptDate');
    var head = document.getElementById('apptHead');
    if (!tbody) return;

    // focus on the date just booked (if any), otherwise today
    var focus = sessionStorage.getItem('pcms_appt_date') || TODAY;
    sessionStorage.removeItem('pcms_appt_date');
    if (dateInput) dateInput.value = focus;
    function activeDate() { return (dateInput && dateInput.value) || focus; }

    function render() {
      var d = activeDate();
      if (head) head.textContent = (d === TODAY ? "Today's appointments, " : 'Appointments, ') + prettyDate(d);
      var list = API.bookings().filter(function (b) { return b.date === d; })
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
        'No appointments on this date. <a href="booking.html">Book one</a>.</td></tr>';

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
        toast('Booking confirmed. Reminder sent to ' + b.customer, 'green'); render(); }
      else if (act === 'arrive') { API.updateBooking(bid, { status: 'arrived' });
        toast(b.customer + ' checked in'); render(); }
      else if (act === 'invoice') { API.setInvoice(bid); location.href = 'billing.html'; }
    });

    if (dateInput) dateInput.addEventListener('change', render);

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
      if (!refreshAvail()) { toast('That slot is not available, please pick another', 'red'); return; }
      var b = API.addBooking({
        date: date.value, time: time.value, customer: name,
        therapist: ther.value, service: svc.value, status: 'pending'
      });
      var msg = 'Appointment booked: ' + name + ' with ' + b.therapist +
        ', ' + prettyDate(b.date) + ' ' + b.time;
      sessionStorage.setItem('pcms_flash', msg);
      sessionStorage.setItem('pcms_appt_date', b.date);
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
      // <input type=time> gives 24h "HH:MM", convert to the grid's "h:MM AM/PM"
      var parts = blkFrom.value.split(':'), h = +parts[0], mm = parts[1];
      var ap = h >= 12 ? 'PM' : 'AM', h12 = (h % 12) || 12;
      var t = h12 + ':' + mm + ' ' + ap;
      API.addBlock({ date: blkDate.value, time: t, therapist: ME });
      toast('Time slot blocked for ' + prettyDate(blkDate.value) + ' ' + t, 'green');
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
      toast('Payment recorded, RM ' + money(t.total), 'green');
    });

    render();
  };

  /* ---------- Therapist: treatment record ---------- */
  pages['treatment'] = function () {
    var save = document.getElementById('saveRecord');
    var diag = document.getElementById('trDiagnosis');
    var notes = document.getElementById('trNotes');
    var pain = document.getElementById('trPain');
    var hist = document.getElementById('trHistory');
    if (save) save.addEventListener('click', function (e) {
      e.preventDefault();
      if (diag && !diag.value.trim()) { toast('Enter a diagnosis first', 'red'); diag.focus(); return; }
      if (hist) {
        var body = (notes && notes.value.trim()) || (diag && diag.value.trim()) || 'Session recorded.';
        var card = document.createElement('div');
        card.className = 'history-card';
        card.innerHTML = '<div class="hc-head"><span>' + prettyDate(TODAY) + '</span>' +
          '<span>Pain: ' + ((pain && pain.value) || '0') + '/10</span></div>' +
          '<div class="hc-body">' + esc(body) + '</div>';
        hist.insertBefore(card, hist.firstChild);
      }
      toast('Treatment record saved', 'green');
    });
  };

  /* ---------- Therapist: prescribe medication ---------- */
  pages['medication'] = function () {
    var med = document.getElementById('medName');
    var dose = document.getElementById('medDose');
    var qty = document.getElementById('medQty');
    var add = document.getElementById('medAdd');
    var body = document.getElementById('medRows');
    var inv = document.getElementById('medInv');
    var PRICES = { 'Muscle relief gel': 25, 'Anti-inflammatory tablet': 12, 'Pain relief spray': 18 };
    if (add && body) add.addEventListener('click', function (e) {
      e.preventDefault();
      var name = med.value, d = (dose.value || '').trim() || '-', q = Math.max(1, +qty.value || 1);
      var sub = (PRICES[name] || 0) * q;
      var tr = document.createElement('tr');
      tr.innerHTML = '<td class="name">' + esc(name) + '</td><td>' + esc(d) + '</td>' +
        '<td class="num">' + q + '</td><td class="right num">' + money(sub) + '</td>';
      body.appendChild(tr);
      // deduct the prescribed quantity from the inventory table and update the status pill
      if (inv) {
        [].forEach.call(inv.querySelectorAll('tr'), function (row) {
          if (row.querySelector('.name').textContent === name) {
            var cells = row.querySelectorAll('td');
            var reorder = +cells[2].textContent;
            var stock = Math.max(0, (+cells[1].textContent) - q);
            cells[1].textContent = stock;
            var pill = row.querySelector('.pill');
            if (stock < reorder) { pill.className = 'pill pill-red'; pill.textContent = 'Low stock'; }
            else { pill.className = 'pill pill-green'; pill.textContent = 'OK'; }
          }
        });
      }
      toast('Added ' + name + ' to prescription; stock updated', 'green');
    });
  };

  /* ---------- Register new customer ---------- */
  pages['register'] = function () {
    var save = document.getElementById('saveCustomer');
    var name = document.getElementById('regName');
    var contact = document.getElementById('regContact');
    var ic = document.getElementById('regIc');
    if (save) save.addEventListener('click', function (e) {
      e.preventDefault();
      if (name && !name.value.trim()) { toast('Enter the customer name', 'red'); name.focus(); return; }
      API.addCustomer({
        name: name.value.trim(),
        contact: (contact && contact.value.trim()) || '',
        ic: (ic && ic.value.trim()) || ''
      });
      sessionStorage.setItem('pcms_flash_cust', name.value.trim() + ' registered');
      location.href = 'customers.html';
    });
  };
  pages['customers'] = function () {
    var f = sessionStorage.getItem('pcms_flash_cust');
    if (f) { toast(f, 'green'); sessionStorage.removeItem('pcms_flash_cust'); }
    var body = document.getElementById('custRows');
    var box = document.getElementById('custSearch');
    var btn = document.getElementById('custSearchBtn');
    if (!body) return;

    function render() {
      body.innerHTML = API.customers().map(function (c) {
        return '<tr><td class="name">' + esc(c.name) + '</td>' +
          '<td>' + esc(c.contact || '-') + '</td>' +
          '<td>' + (c.lastVisit ? prettyDate(c.lastVisit) : 'New') + '</td>' +
          '<td class="num">' + (c.sessions || 0) + '</td>' +
          '<td class="right"><a href="#" data-view>View profile</a></td></tr>';
      }).join('');
    }
    function filter() {
      var q = (box.value || '').toLowerCase();
      [].forEach.call(body.querySelectorAll('tr'), function (r) {
        r.style.display = r.textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none';
      });
    }
    body.addEventListener('click', function (e) {
      var el = e.target.closest('[data-view]'); if (!el) return;
      e.preventDefault();
      var td = el.closest('tr').querySelectorAll('td');
      toast(td[0].textContent + ' · ' + td[1].textContent + ' · last visit ' + td[2].textContent + ' · ' + td[3].textContent + ' sessions');
    });
    render();
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

  /* ---------- Owner: report generation ---------- */
  function barChart(rows) {
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; }).concat([1]));
    return '<div class="bar-chart">' + rows.map(function (r) {
      var pct = Math.round(r.value / max * 100);
      return '<div class="bar-row"><div class="bar-label">' + esc(r.label) + '</div>' +
        '<div class="bar-track"><div class="bar-fill"' + (r.green ? ' style="width:' + pct + '%;background:var(--green)"' : ' style="width:' + pct + '%"') + '></div></div>' +
        '<div class="bar-val">' + esc(r.display != null ? r.display : r.value) + '</div></div>';
    }).join('') + '</div>';
  }
  function statRow(cards) {
    return '<div class="stat-grid" style="grid-template-columns:repeat(' + cards.length + ',1fr);">' +
      cards.map(function (c) {
        return '<div class="stat-card"><div class="label">' + esc(c.label) + '</div>' +
          '<div class="value' + (c.cls ? ' ' + c.cls : '') + '">' + esc(c.value) + '</div></div>';
      }).join('') + '</div>';
  }
  pages['reports'] = function () {
    var type = document.getElementById('rpType');
    var from = document.getElementById('rpFrom');
    var to = document.getElementById('rpTo');
    var gen = document.getElementById('rpGenerate');
    var out = document.getElementById('reportOut');
    if (!gen) return;

    // default to the seed demo week
    if (from && !from.value) from.value = '2026-08-11';
    if (to && !to.value) to.value = '2026-08-15';

    function priceOf(b) { return (SERVICES[b.service] || { price: 0 }).price; }
    function minsOf(b) { return (SERVICES[b.service] || { mins: 0 }).mins; }
    function inRange(b) {
      return (!from.value || b.date >= from.value) && (!to.value || b.date <= to.value);
    }
    function heading(title) {
      return '<h2 class="section" style="margin-top:0;">' + esc(title) + ' · ' +
        prettyDate(from.value) + ' to ' + prettyDate(to.value) + '</h2>';
    }
    function empty() {
      return '<div class="banner banner-blue"><span class="ico"><svg class="icon">' +
        '<use href="../icons.svg#info"/></svg></span><span>No records in the selected date range.</span></div>';
    }

    var builders = {
      sales: function (rows) {
        var byService = {};
        rows.forEach(function (b) {
          var s = byService[b.service] = byService[b.service] || { n: 0, rev: 0 };
          s.n++; s.rev += priceOf(b);
        });
        var keys = Object.keys(byService).sort(function (a, b) { return byService[b].rev - byService[a].rev; });
        var total = rows.reduce(function (s, b) { return s + priceOf(b); }, 0);
        var body = keys.map(function (k) {
          return '<tr><td class="name">' + esc(k) + '</td><td class="num">' + byService[k].n +
            '</td><td class="right num">' + money(byService[k].rev) + '</td></tr>';
        }).join('');
        return heading('Sales summary') +
          statRow([
            { label: 'Total sales', value: 'RM ' + money(total) },
            { label: 'Sessions billed', value: String(rows.length) },
            { label: 'Services sold', value: String(keys.length) }
          ]) +
          '<table class="data" style="margin-top:20px;"><thead><tr><th>Service</th><th>Sessions</th>' +
          '<th class="right">Revenue (RM)</th></tr></thead><tbody>' + body +
          '<tr><td class="name">Total</td><td class="num">' + rows.length +
          '</td><td class="right num">' + money(total) + '</td></tr></tbody></table>' +
          '<h2 class="section">Revenue by service</h2>' +
          barChart(keys.map(function (k) { return { label: k, value: byService[k].rev, display: 'RM ' + money(byService[k].rev) }; }));
      },
      appointments: function (rows) {
        var byStatus = {};
        rows.forEach(function (b) { byStatus[b.status] = (byStatus[b.status] || 0) + 1; });
        rows = rows.slice().sort(function (a, b) {
          return a.date === b.date ? toMin(a.time) - toMin(b.time) : (a.date < b.date ? -1 : 1);
        });
        var body = rows.map(function (b) {
          return '<tr><td>' + prettyDate(b.date) + '</td><td><strong>' + esc(b.time) +
            '</strong></td><td class="name">' + esc(b.customer) + '</td><td>' + esc(b.therapist) +
            '</td><td>' + esc(b.service) + '</td><td>' + esc(cap(b.status)) + '</td></tr>';
        }).join('');
        return heading('Appointments') +
          statRow([
            { label: 'Total appointments', value: String(rows.length) },
            { label: 'Confirmed', value: String((byStatus.confirmed || 0) + (byStatus.arrived || 0) + (byStatus.paid || 0)) },
            { label: 'Pending', value: String(byStatus.pending || 0), cls: 'value-red' }
          ]) +
          '<table class="data" style="margin-top:20px;"><thead><tr><th>Date</th><th>Time</th><th>Customer</th>' +
          '<th>Therapist</th><th>Service</th><th>Status</th></tr></thead><tbody>' + body + '</tbody></table>';
      },
      customers: function (rows) {
        var byCust = {};
        rows.forEach(function (b) {
          var c = byCust[b.customer] = byCust[b.customer] || { n: 0, svc: {}, last: b.date };
          c.n++; c.svc[b.service] = 1; if (b.date > c.last) c.last = b.date;
        });
        var keys = Object.keys(byCust).sort(function (a, b) { return byCust[b].n - byCust[a].n; });
        var body = keys.map(function (k) {
          return '<tr><td class="name">' + esc(k) + '</td><td class="num">' + byCust[k].n +
            '</td><td>' + esc(Object.keys(byCust[k].svc).join(', ')) + '</td><td>' + prettyDate(byCust[k].last) + '</td></tr>';
        }).join('');
        return heading('Customer records') +
          statRow([
            { label: 'Customers seen', value: String(keys.length) },
            { label: 'Total visits', value: String(rows.length) }
          ]) +
          '<table class="data" style="margin-top:20px;"><thead><tr><th>Customer</th><th>Sessions</th>' +
          '<th>Services taken</th><th>Last visit</th></tr></thead><tbody>' + body + '</tbody></table>';
      },
      workload: function (rows) {
        var byT = {};
        THERAPISTS.forEach(function (t) { byT[t] = { n: 0, mins: 0, rev: 0 }; });
        rows.forEach(function (b) {
          var t = byT[b.therapist] = byT[b.therapist] || { n: 0, mins: 0, rev: 0 };
          t.n++; t.mins += minsOf(b); t.rev += priceOf(b);
        });
        var keys = Object.keys(byT).filter(function (k) { return byT[k].n > 0; })
          .sort(function (a, b) { return byT[b].n - byT[a].n; });
        var body = keys.map(function (k) {
          return '<tr><td class="name">' + esc(k) + '</td><td class="num">' + byT[k].n +
            '</td><td class="num">' + (byT[k].mins / 60).toFixed(1) + '</td><td class="right num">' +
            money(byT[k].rev) + '</td></tr>';
        }).join('');
        return heading('Therapist workload') +
          '<table class="data" style="margin-top:4px;"><thead><tr><th>Therapist</th><th>Sessions</th>' +
          '<th>Hours</th><th class="right">Revenue (RM)</th></tr></thead><tbody>' + body + '</tbody></table>' +
          '<h2 class="section">Sessions per therapist</h2>' +
          barChart(keys.map(function (k, i) { return { label: k, value: byT[k].n, green: i % 2 === 1 }; }));
      }
    };
    function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

    function generate() {
      if (from.value && to.value && from.value > to.value) {
        out.innerHTML = '<div class="banner banner-red"><span class="ico"><svg class="icon">' +
          '<use href="../icons.svg#warning"/></svg></span><span>The “From” date is after the “To” date.</span></div>';
        return;
      }
      var rows = API.bookings().filter(inRange);
      if (!rows.length) { out.innerHTML = heading(type.options[type.selectedIndex].text) + empty(); return; }
      out.innerHTML = builders[type.value](rows);
      toast('Report generated: ' + type.options[type.selectedIndex].text, 'green');
    }
    gen.addEventListener('click', function (e) { e.preventDefault(); generate(); });
  };

  /* ---------- Owner: services catalogue ---------- */
  pages['services'] = function () {
    var name = document.getElementById('svcName');
    var charge = document.getElementById('svcCharge');
    var dur = document.getElementById('svcDuration');
    var add = document.getElementById('svcAdd');
    var body = document.getElementById('svcRows');
    if (!add || !body) return;
    var addHtml = add.innerHTML, editing = null;

    function setMode(row) {
      editing = row;
      add.innerHTML = row ? 'Update service' : addHtml;
    }
    add.addEventListener('click', function (e) {
      e.preventDefault();
      var n = (name.value || '').trim();
      if (!n) { toast('Enter a service name', 'red'); name.focus(); return; }
      var c = Math.max(0, +charge.value || 0), d = Math.max(0, +dur.value || 0);
      if (editing) {
        var cells = editing.children;
        cells[0].textContent = n; cells[1].textContent = money(c); cells[2].textContent = d + ' min';
        toast('Service updated: ' + n, 'green');
        setMode(null);
      } else {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td class="name">' + esc(n) + '</td><td class="right num">' + money(c) +
          '</td><td>' + d + ' min</td><td class="right"><a href="#" data-edit>Edit</a></td>';
        body.appendChild(tr);
        toast('Service added: ' + n, 'green');
      }
      name.value = ''; charge.value = ''; dur.value = '';
    });
    body.addEventListener('click', function (e) {
      var el = e.target.closest('[data-edit]'); if (!el) return;
      e.preventDefault();
      var tr = el.closest('tr');
      name.value = tr.children[0].textContent;
      charge.value = parseFloat(tr.children[1].textContent) || '';
      dur.value = parseInt(tr.children[2].textContent, 10) || '';
      setMode(tr); name.focus();
      toast('Editing ' + tr.children[0].textContent + ', change the fields and click Update service', 'green');
    });
  };

  /* ---------- Owner: staff accounts ---------- */
  pages['staff'] = function () {
    var name = document.getElementById('stName');
    var role = document.getElementById('stRole');
    var add = document.getElementById('stAdd');
    var body = document.getElementById('staffRows');
    if (!add || !body) return;
    add.addEventListener('click', function (e) {
      e.preventDefault();
      var n = (name.value || '').trim();
      if (!n) { toast('Enter a staff name', 'red'); name.focus(); return; }
      var tr = document.createElement('tr');
      tr.innerHTML = '<td class="name">' + esc(n) + '</td><td>' + esc(role.value) + '</td>' +
        '<td><span class="pill pill-green">Active</span></td>' +
        '<td class="right"><a href="#" data-toggle>Edit</a></td>';
      body.appendChild(tr);
      name.value = '';
      toast('Staff account added: ' + n, 'green');
    });
    body.addEventListener('click', function (e) {
      var el = e.target.closest('[data-toggle]'); if (!el) return;
      e.preventDefault();
      var tr = el.closest('tr'), pill = tr.querySelector('.pill');
      var active = pill.textContent.trim() === 'Active';
      if (active) { pill.className = 'pill pill-grey'; pill.textContent = 'Deactivated'; }
      else { pill.className = 'pill pill-green'; pill.textContent = 'Active'; }
      toast(tr.querySelector('.name').textContent + (active ? ' deactivated' : ' reactivated'), 'green');
    });
  };

  /* ======================================================================
     Global fallback: every remaining button/link does something
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
      toast('"' + label + '" is not available in this prototype');
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
