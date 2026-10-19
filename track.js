/* =====================================================================
   BGW tracking: Meta Pixel, GA4, Google Ads, HubSpot + ad-source capture
   ---------------------------------------------------------------------
   FILL IN THE IDS BELOW. Anything left blank is simply not loaded.
   ===================================================================== */
window.BGW_CONFIG = {
  metaPixelId:   '972349529038336',   // Meta Pixel (already live)
  ga4Id:         'G-Z08MJGQLNM',       // GA4: Rocco and Liam BGW Website
  googleAdsId:   'AW-18516260978',    // Google Ads
  adsLeadLabel:  '',                  // conversion label for "Website enquiry", e.g. 'AbCdEfGh123'
  adsBookLabel:  '',                  // conversion label for "Booked consultation"
  hubspotPortal: '442402715',         // HubSpot (Boston Global Wealth, AP1 region)
  hubspotRegion: 'ap1',
  calendlyUrl:   'https://calendly.com/liam-bostonglobalwealth/30min',
  // Campaign Monitor (Market Wrap mailing list). From Campaign Monitor: Lists & subscribers >
  // your list > Signup forms > "Copy/paste a form to your site". Paste the form's action URL
  // and the email field's name (looks like 'cm-abcdef-abcdef'). Leave blank to skip.
  cmFormAction:  '',
  cmEmailField:  '',
  cmNameField:   ''                   // the name field's name, e.g. 'cm-name' (optional)
};

(function () {
  var C = window.BGW_CONFIG;

  /* ---------- Ad-source capture (first touch + last touch) ---------- */
  var KEYS = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','gbraid','wbraid','fbclid','msclkid','li_fat_id'];
  function store(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function read(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  var qs = new URLSearchParams(location.search), touch = {}, has = false;
  KEYS.forEach(function (k) { var v = qs.get(k); if (v) { touch[k] = v.slice(0, 200); has = true; } });
  var ref = document.referrer && document.referrer.indexOf(location.host) === -1 ? document.referrer : '';
  if (has || ref) {
    touch.landing_page = location.pathname + location.search;
    touch.referrer = ref;
    touch.ts = new Date().toISOString();
    if (!read('bgw_ft')) store('bgw_ft', touch);  // first touch is kept forever
    store('bgw_lt', touch);                       // last touch is overwritten
  }
  window.BGW_ATTR = function () {
    var lt = read('bgw_lt') || {}, ft = read('bgw_ft') || {};
    var out = {};
    KEYS.forEach(function (k) { out[k] = lt[k] || ''; });
    out.landing_page = lt.landing_page || ft.landing_page || location.pathname;
    out.referrer = lt.referrer || ft.referrer || '';
    out.first_source = ft.utm_source ? [ft.utm_source, ft.utm_medium, ft.utm_campaign].filter(Boolean).join(' / ')
                                     : (ft.gclid ? 'google / cpc (gclid)' : ft.fbclid ? 'meta (fbclid)' : (ft.referrer || 'direct'));
    return out;
  };

  /* ---------- Meta Pixel ---------- */
  if (C.metaPixelId) {
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', C.metaPixelId);
    fbq('track', 'PageView');
  }

  /* ---------- GA4 + Google Ads (one gtag) ---------- */
  var gtagId = C.ga4Id || C.googleAdsId;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  if (gtagId) {
    var g = document.createElement('script'); g.async = true;
    g.src = 'https://www.googletagmanager.com/gtag/js?id=' + gtagId;
    document.head.appendChild(g);
    gtag('js', new Date());
    if (C.ga4Id) gtag('config', C.ga4Id);
    if (C.googleAdsId) gtag('config', C.googleAdsId);
  }

  /* ---------- HubSpot tracking (also powers "collected forms") ---------- */
  window._hsq = window._hsq || [];
  if (C.hubspotPortal) {
    var h = document.createElement('script'); h.async = true; h.defer = true; h.id = 'hs-script-loader';
    h.src = 'https://js' + (C.hubspotRegion ? '-' + C.hubspotRegion : '') + '.hs-scripts.com/' + C.hubspotPortal + '.js';
    document.head.appendChild(h);
  }

  /* ---------- One function every conversion goes through ---------- */
  // type: 'lead' | 'booking' | 'contact' | 'booking_open'
  window.BGW_TRACK = function (type, data) {
    data = data || {};
    var id = data.event_id || ('bgw-' + type + '-' + Date.now());
    try {
      if (window.fbq) {
        if (type === 'lead')         fbq('track', 'Lead', { content_name: data.label || 'Website enquiry' }, { eventID: id });
        if (type === 'booking')      fbq('track', 'Schedule', { content_name: 'Consultation booked' }, { eventID: id });
        if (type === 'contact')      fbq('track', 'Contact', { content_name: data.label || '' });
        if (type === 'booking_open') fbq('trackCustom', 'BookingOpened', { location: data.label || '' });
        if (type === 'signup')       fbq('track', 'CompleteRegistration', { content_name: 'Market Wrap' }, { eventID: id });
      }
      if (gtagId) {
        if (type === 'lead')         gtag('event', 'generate_lead', { form_name: data.label || 'enquiry', value: 1, currency: 'AUD' });
        if (type === 'booking')      gtag('event', 'book_appointment', { method: 'calendly' });
        if (type === 'contact')      gtag('event', 'contact_click', { link_type: data.label || '' });
        if (type === 'booking_open') gtag('event', 'booking_open', { location: data.label || '' });
        if (type === 'signup')       gtag('event', 'sign_up', { method: 'market_wrap' });
        if (C.googleAdsId && type === 'lead' && C.adsLeadLabel)
          gtag('event', 'conversion', { send_to: C.googleAdsId + '/' + C.adsLeadLabel, transaction_id: id });
        if (C.googleAdsId && type === 'booking' && C.adsBookLabel)
          gtag('event', 'conversion', { send_to: C.googleAdsId + '/' + C.adsBookLabel, transaction_id: id });
      }
      if (window._hsq && (type === 'lead' || type === 'booking' || type === 'signup')) {
        if (data.email) {
          var p = { email: data.email };
          if (data.firstname) p.firstname = data.firstname;
          if (data.lastname)  p.lastname  = data.lastname;
          if (data.phone)     p.phone     = data.phone;
          _hsq.push(['identify', p]);
        }
        _hsq.push(['trackPageView']); // sends the identify to HubSpot
      }
    } catch (e) { /* never let tracking break the page */ }
  };
})();
