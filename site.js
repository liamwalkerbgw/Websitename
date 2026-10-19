/* BGW site behaviour: Calendly booking, enquiry form, mobile booking bar, click tracking */
(function () {
  var C = window.BGW_CONFIG || {};
  var CAL_URL = C.calendlyUrl || 'https://calendly.com/liam-bostonglobalwealth/30min';
  var track = window.BGW_TRACK || function () {};
  var attr = window.BGW_ATTR || function () { return {}; };

  function ss(k, v) { try { if (v === undefined) return JSON.parse(sessionStorage.getItem(k) || 'null'); sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }

  /* ---------------- Calendly (popup on the homepage, inline on thank-you) ---------------- */
  var calLoading = null;
  function loadCalendly() {
    if (window.Calendly) return Promise.resolve();
    if (calLoading) return calLoading;
    calLoading = new Promise(function (res, rej) {
      var css = document.createElement('link'); css.rel = 'stylesheet';
      css.href = 'https://assets.calendly.com/assets/external/widget.css'; document.head.appendChild(css);
      var s = document.createElement('script'); s.src = 'https://assets.calendly.com/assets/external/widget.js';
      s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
    return calLoading;
  }
  function calOptions() {
    var a = attr(), who = ss('bgw_lead') || {};
    var o = { url: CAL_URL + '?hide_gdpr_banner=1&primary_color=e36b43',
      utm: { utmSource: a.utm_source || (a.gclid ? 'google' : a.fbclid ? 'meta' : 'website'),
             utmMedium: a.utm_medium || '', utmCampaign: a.utm_campaign || '',
             utmContent: a.utm_content || '', utmTerm: a.utm_term || '' } };
    if (who.email) o.prefill = { name: [who.firstname, who.lastname].filter(Boolean).join(' '), email: who.email };
    return o;
  }
  window.BGW_openBooking = function (where) {
    track('booking_open', { label: where || 'button' });
    loadCalendly().then(function () { Calendly.initPopupWidget(calOptions()); })
      .catch(function () { window.open(CAL_URL, '_blank', 'noopener'); }); // fallback: never lose the lead
  };
  window.BGW_inlineBooking = function (el) {
    loadCalendly().then(function () {
      var o = calOptions(); o.parentElement = el; Calendly.initInlineWidget(o);
    }).catch(function () {
      el.innerHTML = '<p style="padding:24px"><a class="btn btn-primary" href="' + CAL_URL + '" target="_blank" rel="noopener">Open the booking calendar</a></p>';
    });
  };

  var booked = false;
  window.addEventListener('message', function (e) {
    if (!e.origin || e.origin.indexOf('calendly.com') === -1 || !e.data || !e.data.event) return;
    if (e.data.event === 'calendly.event_scheduled' && !booked) {
      booked = true;
      var who = ss('bgw_lead') || {};
      ss('bgw_conv', { type: 'booking', fired: true });
      track('booking', who);
      // homepage: move them to the confirmation page; thank-you page shows its own message
      if (!document.body.hasAttribute('data-thankyou')) {
        setTimeout(function () { location.href = '/thank-you/?t=booking'; }, 2500);
      } else if (window.BGW_onBooked) { window.BGW_onBooked(); }
    }
  });

  // Every Calendly link becomes an on-page popup (the href stays as a no-JS fallback)
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    if (a.hasAttribute('data-book')) { e.preventDefault(); window.BGW_openBooking(a.getAttribute('data-book')); return; }
    var href = a.getAttribute('href') || '';
    if (href.indexOf('tel:') === 0)    track('contact', { label: 'phone' });
    if (href.indexOf('mailto:') === 0) track('contact', { label: 'email' });
  });
  // warm up Calendly once the page is idle so the popup opens instantly
  (window.requestIdleCallback || function (f) { setTimeout(f, 2500); })(function () { if (document.querySelector('[data-book]')) loadCalendly().catch(function(){}); });

  /* ---------------- Enquiry form ---------------- */
  var form = document.getElementById('enquiry-form');
  if (form) {
    var started = Date.now();
    var a = attr();
    Object.keys(a).forEach(function (k) { var f = form.querySelector('[name="' + k + '"]'); if (f) f.value = a[k]; });
    var pg = form.querySelector('[name="page"]'); if (pg) pg.value = location.href.split('#')[0];

    var status = document.getElementById('form-status');
    var btn = form.querySelector('button[type="submit"]');
    function say(msg, bad) { status.textContent = msg; status.className = 'form-status' + (bad ? ' bad' : ' ok'); }

    var firstTouch = false;
    form.addEventListener('focusin', function () { if (!firstTouch) { firstTouch = true; try { gtag('event', 'form_start', { form_name: 'enquiry' }); } catch (e) {} } });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var fd = new FormData(form);
      var lead = { firstname: fd.get('firstname'), lastname: fd.get('lastname'), email: fd.get('email'), phone: fd.get('phone') };
      // spam: honeypot filled or submitted inhumanly fast -> pretend success, send nothing
      if (fd.get('bot-field') || Date.now() - started < 1200) { location.href = '/thank-you/?t=enquiry'; return; }
      btn.disabled = true; btn.textContent = 'Sending…'; say('');
      fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                   body: new URLSearchParams(fd).toString() })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          ss('bgw_lead', lead);
          ss('bgw_conv', { type: 'lead', id: 'bgw-lead-' + Date.now() }); // fired once on the thank-you page
          location.href = '/thank-you/?t=enquiry';
        })
        .catch(function () {
          btn.disabled = false; btn.textContent = 'Send Enquiry';
          say('Sorry, that didn’t go through. Please try again, call (02) 8348 3489 or email liam@bostonglobalwealth.com.au.', true);
        });
    });
  }

  /* ---------------- Market Wrap newsletter signup ---------------- */
  var nl = document.getElementById('newsletter-form');
  if (nl) {
    var nlStart = Date.now();
    var nlA = attr();
    Object.keys(nlA).forEach(function (k) { var f = nl.querySelector('[name="' + k + '"]'); if (f) f.value = nlA[k]; });
    var nlStatus = document.getElementById('nl-status'), nlBtn = nl.querySelector('button[type="submit"]');
    nl.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!nl.checkValidity()) { nl.reportValidity(); return; }
      var fd = new FormData(nl);
      var who = { email: String(fd.get('email') || '').trim(), firstname: String(fd.get('firstname') || '').trim() };
      function done() {
        nl.innerHTML = '<p class="nl-done">You’re subscribed' + (who.firstname ? ', ' + who.firstname.replace(/[<>&"]/g, '').slice(0, 40) : '') +
          '. The next Market Wrap will land in your inbox.</p>';
      }
      if (fd.get('bot-field') || Date.now() - nlStart < 1200) { done(); return; }
      nlBtn.disabled = true; nlBtn.textContent = 'Subscribing…';
      // 1) Netlify Forms (backup copy + HubSpot collected-forms capture)
      var p1 = fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fd).toString() });
      // 2) Campaign Monitor list (sends the Market Wrap)
      if (C.cmFormAction && C.cmEmailField) {
        var cm = new URLSearchParams(); cm.append(C.cmEmailField, who.email);
        if (C.cmNameField && who.firstname) cm.append(C.cmNameField, who.firstname);
        fetch(C.cmFormAction, { method: 'POST', mode: 'no-cors', body: cm }).catch(function () {});
      }
      p1.then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        track('signup', who);   // Meta CompleteRegistration, GA4 sign_up, HubSpot identify
        done();
      }).catch(function () {
        nlBtn.disabled = false; nlBtn.textContent = 'Subscribe';
        nlStatus.textContent = 'Sorry, that didn’t go through. Please try again.';
      });
    });
  }

  /* ---------------- Mobile "Book a call" bar ---------------- */
  var bar = document.getElementById('mobile-cta');
  if (bar && 'IntersectionObserver' in window) {
    var hero = document.querySelector('.hero'), contact = document.getElementById('contact');
    var heroVisible = true, contactVisible = false;
    function update() { bar.classList.toggle('show', !heroVisible && !contactVisible); }
    new IntersectionObserver(function (en) { heroVisible = en[0].isIntersecting; update(); }, { threshold: 0.15 }).observe(hero);
    new IntersectionObserver(function (en) { contactVisible = en[0].isIntersecting; update(); }, { threshold: 0.05 }).observe(contact);
  }
})();
