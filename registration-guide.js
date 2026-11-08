(function () {
  'use strict';

  const version = 1;
  const seenInPage = new Set();
  const names = { openplay: 'Open Play', tournament: 'Tournament' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const strong = value => '<strong>' + esc(value) + '</strong>';
  const note = html => '<p class="guide-callout">' + html + '</p>';
  const steps = rows => '<ol class="guide-steps registration-guide-steps">' + rows.map(([title, content]) =>
    '<li><h3>' + esc(title) + '</h3>' + content + '</li>').join('') + '</ol>';

  function key(kind, player) {
    return 'pikol.registration-guide.v' + version + '.' + player + '.' + kind;
  }
  function seen(kind, player) {
    const id = key(kind, player);
    if (seenInPage.has(id)) return true;
    try { if (window.localStorage.getItem(id) === '1') return true; } catch (_) {}
    try { return window.sessionStorage.getItem(id) === '1'; } catch (_) { return false; }
  }
  function remember(kind, player) {
    const id = key(kind, player);
    seenInPage.add(id);
    try { window.localStorage.setItem(id, '1'); return; } catch (_) {}
    try { window.sessionStorage.setItem(id, '1'); } catch (_) { /* Keep the current-page preference. */ }
  }
  function eventFacts(name, date, venue, fee, capacity) {
    if (!name) return '';
    const facts = [['Date', date], ['Venue', venue], ['Fee', fee], ['Capacity', capacity]].filter(([, value]) => value);
    return '<div class="guide-status"><strong>' + esc(name) + '</strong><dl class="registration-guide-facts">' +
      facts.map(([label, value]) => '<div><dt>' + label + '</dt><dd>' + esc(value) + '</dd></div>').join('') +
      '</dl></div>';
  }
  function divisionsFor(event) {
    return (Array.isArray(event.allowed_divisions) ? event.allowed_divisions :
      String(event.allowed_divisions || '').split('|')).map(name => String(name || '').trim()).filter(Boolean);
  }
  function openPlay(context) {
    const { event, quote, me, date, money, warning } = context;
    const divisions = event ? divisionsFor(event) : [];
    const solo = event && !warning && event.registration_mode !== 'pair';
    const fixed = event && !warning && event.registration_mode !== 'individual';
    const duoRule = event?.playing_mode === 'division' && event.division_matching === 'strict' ?
      'Both players must be in the same Official Division.' : {
        same: 'Both players must be in the same Official Division.',
        adjacent: 'Your Official Divisions must be the same or adjacent.',
        approval: 'If your Official Divisions are more than one division apart, Management must approve the pair.'
      }[event?.pair_divisions];
    const canSearch = fixed && !context.invite && me?.pair?.status !== 'accepted';
    const pairHint = context.invite ? 'You have a partner invitation for this session. Complete your own registration, then check the invitation under <strong>Live Queue &amp; Partner</strong>. Use <strong>Accept Fixed Partner</strong> if it is still waiting for you.' :
      me?.pair?.status === 'accepted' ? 'Your invitation is already accepted. Check your pair under <strong>Live Queue &amp; Partner</strong>.' :
      'Select your partner from the results under <strong>Find registered partner</strong>. An invitation alone does not reserve their place.';
    const setup = event ? '<p>Playing mode: ' + strong(event.playing_mode === 'mix' ? 'Open Mix' : 'Division-Based') + '. ' +
      (event.playing_mode === 'mix' ? 'Eligible divisions can mix during play.' :
        event.division_matching === 'strict' ? 'Matching is restricted to the same Official Division.' : 'The session uses Official Divisions for matching.') + '</p>' +
      (divisions.length ? '<p>Allowed divisions: ' + esc(divisions.join(', ')) + '.</p>' : '') +
      (me?.division ? '<p>Your Official Division: ' + strong(me.division) + '.</p>' : '') :
      '<p>Read <strong>Playing mode</strong> and <strong>Allowed divisions</strong> for the session. These determine who can join and how players may be matched.</p>';
    const special = [];
    if (event?.preset === 'paddle') special.push('<p><strong>Paddle Stacking Open Play</strong> uses a digital paddle rack. Follow the rack and court call in Live Courts. The host applies the selected stacking method and eligibility rules.</p>');
    if (event?.contest?.enabled) special.push('<p><strong>Contest Mode</strong> uses a planned equal-games schedule for the locked roster. Follow the live schedule and the organiser’s instructions. Official results appear after finalization.</p>');
    if (event?.rotation_mode === 'winners_stay' && event.preset !== 'paddle') special.push('<p><strong>Winners Stay</strong> allows the winning pair to stay when the host calls eligible challengers. Check Live Courts for each assignment.</p>');
    const map = window.PikolVenueUI?.safeMapsURL(event?.venue_maps_url);
    const venue = event?.venue_name || event?.location;
    const capacity = Number(event?.capacity) > 0 && event?.slots_left != null ? event.slots_left + ' slot(s) left of ' + event.capacity : '';
    const payment = quote && Number(quote.amount) === 0 ?
      '<p>The current final entrance fee is zero. Check the result after confirming. A receipt is needed only if a payment balance is due.</p>' :
      '<p>If there is a balance, wait for the active payment hold and check <strong>Amount due</strong> and the countdown. Use an available <strong>Payment method</strong>, send the amount shown, attach the <strong>Receipt / screenshot (required)</strong>, then choose <strong>Submit payment</strong>. A submitted receipt keeps your place during review.</p>' +
      note('<strong>If the hold expires</strong>, stop before sending funds. Use <strong>Secure New Payment Hold</strong> in My registrations if offered. If you already sent money, contact Management before paying again.');
    return eventFacts(event?.title, date, venue, quote && money(quote.amount), capacity) + (warning ? note(esc(warning)) : '') + steps([
      ['Open Events & Registrations', '<p>On mobile, tap <strong>Events</strong>, then choose <strong>Open Play</strong>. On desktop, choose <strong>Open Play</strong> in the main navigation.</p>'],
      ['Choose a session', '<p>Browse <strong>Open Play sessions</strong>. Compare the date, time, venue, entry fee and available capacity. Use <strong>Register →</strong> on a card or <strong>Register Now →</strong> in the selected event’s details. A displayed opening can change until you register.</p>'],
      ['Review the playing mode and divisions', setup],
      ['Check Register as', solo || fixed ? '<p>' +
        (solo ? '<strong>Individual (solo)</strong> lets you register on your own.' : '') +
        (solo && fixed ? ' ' : '') + (fixed ? '<strong>With Fixed Partner</strong> is for an eligible pair.' : '') + '</p>' +
        (fixed ? '<p>' + pairHint + '</p><p>' + (duoRule ? esc(duoRule) + ' ' : '') +
          'Both players must complete their own registration and any payment, and the invitation must be accepted before the pair can play together.' +
          (canSearch ? ' For example, choose the matching account in the search results instead of just typing a name.' : '') + '</p>' : '') :
        '<p>' + (event ? 'Check eligibility before attempting to register.' : 'Use the choices actually shown in <strong>Register as</strong>. Follow any partner instructions shown for that session.') + '</p>'],
      ['Review the fee and notes', '<p>Check <strong>Final entrance fee</strong> and any savings. If <strong>Use PIKOL Credit</strong> appears, choose whether to apply it. Credit that covers the fee removes the need to send money. Add relevant information in <strong>Notes (optional)</strong>.</p>'],
      ['Confirm registration', '<p>Recheck the session and your choices, then use <strong>Confirm registration</strong>. The result tells you whether your slot is confirmed or whether payment is due.</p>'],
      ['Pay and submit the receipt if required', payment],
      ['Track My registrations', '<p>Check <strong>My registrations</strong> for <strong>Awaiting payment</strong>, <strong>Payment under review</strong> or <strong>Confirmed</strong>. If payment shows <strong>Action needed</strong>, read any receipt issue and follow the available action.</p>'],
      ['Find the playing venue', '<p>' + (venue ? 'Check in at ' + strong(venue) + '.' : 'Use the venue shown for your session.') +
        (event?.venue_address ? ' ' + esc(event.venue_address) : '') + '</p>' +
        (map ? '<a class="btn btn-outline btn-sm" href="' + esc(map) + '" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>' :
          event ? '<p>Contact Management for directions if needed.</p>' : '<p>Use the venue’s configured map link when one is available.</p>')],
      ['Check in at the venue', '<p>Once your registration is <strong>Confirmed</strong>, scan the <strong>Venue QR</strong> on event day. In <strong>Venue QR · Choose Open Play</strong>, pick your session. Enter the displayed <strong>6-digit venue code</strong> and choose <strong>QR Check-in</strong>.</p>'],
      ['Follow your live status', '<p>From <strong>My registrations</strong>, open <strong>Live Queue &amp; Partner</strong>. <strong>My Open Play · Live Courts</strong> shows waiting status, court calls, <strong>Current Playing Courts</strong>' +
        (event?.preset === 'paddle' ? ' and the digital rack' : ', and the waiting pool when shown') +
        (fixed || !event ? ', along with fixed-partner information when applicable' : '') +
        '. Follow the live assignment before going to a court. Queue positions and rotations can change.</p>' + special.join('')]
    ]);
  }

  function tournament(context) {
    const { event, info, available = [], date, money, warning } = context;
    const formats = { singles: 'Singles', doubles: 'Doubles', mixed_doubles: 'Mixed Doubles' };
    const needsPartner = available.some(division => Number(division.team_size) > 1);
    const canOwe = available.some(division => Number(division.fee) > 0);
    const fees = [...new Set(available.map(division => money(division.fee)))].join(' / ');
    const choices = available.length ? '<ul>' + available.map(division =>
      '<li>' + strong(division.name) + (formats[division.match_type] ? ' · ' + formats[division.match_type] : '') +
      ' · ' + esc(money(division.fee)) + (division.description ? '<br>' + esc(division.description) : '') + '</li>').join('') + '</ul>' : '';
    return eventFacts(event?.name, date, event?.venue_name || event?.venue, fees) + (warning ? note(esc(warning)) : '') + steps([
      ['Find Tournaments', '<p>On mobile, tap <strong>Events</strong> to reach <strong>Events &amp; Registrations</strong>, then choose <strong>Tournaments</strong>. On desktop, choose <strong>Tournaments</strong> in the main navigation.</p>'],
      ['Review the tournament', '<p>Open the event and review its date, venue, published details and registration fee. Check <strong>Overview</strong> for the selected division’s format and any rules supplied by the organiser. Use the event’s <strong>Register Now</strong> button to enter.</p>' +
        (event?.description ? '<p>' + esc(event.description) + '</p>' : '')],
      ['Check your Official Division', '<p>' + (info?.player_division ? 'Your Official Division is ' + strong(info.player_division) + '. ' : '') +
        'You may enter an eligible division that matches your Official Division and still has room. A full or ineligible option cannot be selected. Playing Open Play does not change your Tournament Official Division.</p>'],
      ['Check the format and team requirements', choices +
        (available.some(division => division.match_type === 'singles') ? '<p>For <strong>Singles</strong>, register as one player.</p>' : '') +
        (needsPartner ? '<p>For a two-player division, use <strong>Partner (registered player)</strong> on <strong>Player / Team</strong>. Type at least two characters and select an eligible player from the results. Only players in your current division are offered. Review any rules the organiser lists for your format.</p>' : '') +
        (available.length ? '<p><strong>Team name (optional)</strong> can be left blank.</p>' :
          '<p>' + (info ? 'There are no eligible open options to choose here.' : 'Check the selected division’s team size and follow the partner and optional team-name fields shown in the form.') + '</p>')],
      ['Review and submit', '<p>Choose <strong>Continue to Division →</strong>. Review <strong>Division</strong>, <strong>Registration Fee</strong>, and <strong>Notes for the organiser (optional)</strong>. If <strong>Use PIKOL Credit</strong> is shown, choose whether to apply it. When the details are correct, use <strong>Submit &amp; Continue to Payment →</strong>.</p>'],
      ['Complete payment if required', info && available.length && !canOwe ?
        '<p>The currently available division fees are zero. Follow the registration result for any further instructions.</p>' :
        '<p>If <strong>Amount due</strong> is shown, follow the configured <strong>Payment method</strong> instructions. Upload the <strong>Receipt / screenshot (required)</strong> and choose <strong>Submit payment</strong>. A receipt submission goes to verification. If no balance is due, follow the registration confirmation shown.</p>'],
      ['Read the two statuses', '<p><strong>Pending approval</strong> means the organiser has yet to approve the entry. <strong>Approved</strong> makes the entry official. A <strong>disapproved</strong> entry can show a reason. <strong>Under review</strong>, <strong>Verified</strong> and <strong>Action needed</strong> are payment statuses. If a receipt is rejected, read the receipt issue and use <strong>Choose payment method</strong> when offered.</p>'],
      ['Follow your matches', '<p>Check <strong>My registrations</strong> for approval or receipt updates. Once the draw is generated, use <strong>My Matches</strong> for assigned matches. Open the tournament’s division workspace and check <strong>Schedule</strong> and <strong>Bracket</strong> for current times, courts and matchups.</p>']
    ]);
  }

  function open(modal, kind, context, options = {}) {
    const { first, start, fromForm } = options;
    const body = kind === 'openplay' ? openPlay(context) : tournament(context);
    const dialog = modal({
      title: names[kind] + ' Registration Guide',
      wide: true,
      cancelText: first ? 'Not now' : fromForm ? 'Back to registration' : 'Close',
      confirmText: start ? 'Start registration' : undefined,
      body: '<div class="registration-guide-content"><span class="guide-kicker">Help &amp; User Guide</span>' +
        '<p>' + (first ? 'Review the steps before opening the registration form.' : 'Use this guide to review the registration steps.') +
        '</p>' + body + '</div>',
      onConfirm: () => { dialog.close(); return start(); }
    });
    dialog.host.classList.add('guide-modal-host', 'registration-guide-host');
    const scroll = dialog.host.querySelector('.modal-body');
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', names[kind] + ' registration steps');
    return dialog;
  }

  window.PikolRegistrationGuide = { seen, remember, open, divisionsFor };
})();
