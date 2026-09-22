/* cards.js — explicit mobile record-card adapter.
   Only tables marked data-mobile-cards="true" are transformed. */
(function () {
  'use strict';
  var BP = 1024;

  function labels(table) {
    var row = table.tHead && table.tHead.rows[0];
    if (!row) return null;
    return Array.prototype.map.call(row.cells, function (cell) {
      return (cell.textContent || '').trim();
    });
  }

  function clear(table) {
    table.classList.remove('as-cards');
    Array.prototype.forEach.call(table.querySelectorAll('tbody > tr'), function (row) {
      row.classList.remove('is-card', 'is-fullwidth');
      Array.prototype.forEach.call(row.cells, function (cell) {
        cell.classList.remove('cell-actions');
        cell.removeAttribute('data-label');
      });
    });
  }

  function decorate(table) {
    if (window.innerWidth > BP || table.getAttribute('data-mobile-cards') !== 'true') {
      clear(table);
      return;
    }
    var heads = labels(table);
    if (!heads) return;
    table.classList.add('as-cards');
    Array.prototype.forEach.call(table.tBodies, function (body) {
      Array.prototype.forEach.call(body.rows, function (row) {
        if (row.cells.length === 1 && row.cells[0].colSpan > 1) {
          row.classList.add('is-fullwidth');
          return;
        }
        row.classList.add('is-card');
        Array.prototype.forEach.call(row.cells, function (cell, index) {
          var label = heads[index] || '';
          cell.setAttribute('data-label', label);
          if (index === row.cells.length - 1 && (/action/i.test(label) || cell.querySelector('button, a'))) {
            cell.classList.add('cell-actions');
          }
        });
      });
    });
  }

  function scan(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('table.data[data-mobile-cards="true"]'), decorate);
  }

  function boot() {
    scan(document);
    var pending = 0;
    function schedule() {
      if (pending) return;
      pending = requestAnimationFrame(function () {
        pending = 0;
        scan(document);
      });
    }
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
