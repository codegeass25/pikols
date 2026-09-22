/* PIKOL centralized deployment configuration.
   GitHub Pages frontend -> Cloudflare Tunnel backend. */
(function () {
  'use strict';
  var DEFAULT_API_BASE = 'https://pikol.mdmsportal.uk';
  var configured = (window.PIKOL_CONFIG && window.PIKOL_CONFIG.apiBase) || DEFAULT_API_BASE;
  var base = String(configured || DEFAULT_API_BASE).trim().replace(/\/+$/, '');
  window.PIKOL_API_BASE = base;
  window.pikolApiUrl = function (path) {
    var value = String(path == null ? '' : path).trim();
    if (/^https?:\/\//i.test(value)) return value;
    if (value.charAt(0) !== '/') value = '/' + value;
    return base + value;
  };
})();
