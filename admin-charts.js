/* Admin presentation helpers. No dependencies, requests or data mutations. */
(function (root) {
  'use strict';
  var sequence = 0;
  var palette = ['#008979', '#30b777', '#b5ed3d', '#43b4c1', '#eadb4d', '#6b84bc'];
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function number(value) { var n = Number(value); return Number.isFinite(n) && n > 0 ? n : 0; }
  function dataTable(rows, label, format) {
    return '<details class="admin-chart-data"><summary>View chart data</summary><div class="table-wrap"><table class="data"><caption class="sr-only">' + esc(label) + '</caption><thead><tr><th scope="col">' + esc(rows.length && rows[0].date ? 'Date' : 'Category') + '</th><th scope="col">Value</th></tr></thead><tbody>' + rows.map(function (r) { return '<tr><th scope="row">' + esc(r.date || r.name) + '</th><td class="num">' + esc(format(number(r.total))) + '</td></tr>'; }).join('') + '</tbody></table></div></details>';
  }
  function empty(text) { return '<div class="empty"><strong>No data yet</strong>' + esc(text || 'Activity will appear here.') + '</div>'; }
  function dates(rows, from, to) {
    var map = Object.create(null);
    (rows || []).forEach(function (r) { if (/^\d{4}-\d{2}-\d{2}$/.test(r.date)) map[r.date] = number(r.total); });
    var start = Date.parse(from + 'T00:00:00Z'), end = Date.parse(to + 'T00:00:00Z');
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start > 3660 * 86400000) return (rows || []).map(function (r) { return {date: r.date, total: number(r.total)}; });
    var result = [];
    for (var day = start; day <= end; day += 86400000) { var date = new Date(day).toISOString().slice(0, 10); result.push({date: date, total: map[date] || 0}); }
    return result;
  }
  function bars(rows, options) {
    options = options || {};
    var values = dates(rows, options.from, options.to);
    if (!values.length || !values.some(function (r) { return r.total > 0; })) return empty(options.empty || 'No bookings in this period.');
    var id = 'admin-chart-' + (++sequence), width = Math.max(520, values.length * 13 + 60), height = 224;
    var left = 42, top = 18, bottom = 181, area = width - left - 14;
    var max = Math.max.apply(null, values.map(function (r) { return r.total; })), ceiling = Math.ceil(max / 4) * 4;
    var grid = '', bars = '', labels = '', step = area / values.length, labelEvery = Math.max(1, Math.ceil(values.length / 8));
    for (var i = 0; i <= 4; i++) { var y = bottom - i / 4 * (bottom - top); grid += '<line x1="' + left + '" y1="' + y + '" x2="' + (width - 14) + '" y2="' + y + '" stroke="currentColor" opacity=".10"/><text x="' + (left - 9) + '" y="' + (y + 4) + '" text-anchor="end" fill="currentColor" font-size="11">' + (ceiling * i / 4) + '</text>'; }
    values.forEach(function (r, i) {
      var h = r.total / ceiling * (bottom - top), x = left + step * i + step * .2;
      bars += '<rect x="' + x.toFixed(2) + '" y="' + (bottom - h).toFixed(2) + '" width="' + (step * .6).toFixed(2) + '" height="' + h.toFixed(2) + '" rx="2" fill="url(#' + id + '-fill)"><title>' + esc(r.date) + ': ' + r.total + ' bookings</title></rect>';
      if (i % labelEvery === 0 || i === values.length - 1) labels += '<text x="' + (left + step * (i + .5)).toFixed(2) + '" y="204" text-anchor="middle" fill="currentColor" font-size="10">' + esc(r.date.slice(5)) + '</text>';
    });
    return '<div class="admin-bar-chart"><div class="admin-chart-scroll"><svg class="admin-chart-svg" viewBox="0 0 ' + width + ' ' + height + '" style="min-width:' + Math.min(width, 700) + 'px" role="img" aria-labelledby="' + id + '-title ' + id + '-desc"><title id="' + id + '-title">' + esc(options.label || 'Bookings per day') + '</title><desc id="' + id + '-desc">' + values.reduce(function (sum, r) { return sum + r.total; }, 0) + ' bookings across ' + values.length + ' days. Exact values are available in View chart data below.</desc><defs><linearGradient id="' + id + '-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#0b9b86"/><stop offset="100%" stop-color="#006557"/></linearGradient></defs>' + grid + bars + labels + '</svg></div><div class="admin-chart-caption"><i class="admin-legend-swatch" style="background:#008979"></i> Court bookings</div>' + dataTable(values, options.label || 'Bookings per day', String) + '</div>';
  }
  function donut(rows, options) {
    options = options || {};
    var values = (rows || []).map(function (r) { return {name: r.name, total: number(r.total)}; }), total = values.reduce(function (sum, r) { return sum + r.total; }, 0);
    if (!values.length || !total) return empty(options.empty || 'No activity for this period.');
    var id = 'admin-chart-' + (++sequence), circumference = 2 * Math.PI * 65, offset = 0, arcs = '';
    var format = options.format || String;
    values.forEach(function (r, i) { var length = r.total / total * circumference; if (length > 0) arcs += '<circle cx="90" cy="90" r="65" fill="none" stroke="' + palette[i % palette.length] + '" stroke-width="27" stroke-dasharray="' + length.toFixed(3) + ' ' + (circumference - length).toFixed(3) + '" stroke-dashoffset="' + (-offset).toFixed(3) + '" transform="rotate(-90 90 90)"><title>' + esc(r.name) + ': ' + esc(format(r.total)) + '</title></circle>'; offset += length; });
    return '<div class="admin-donut-layout"><div class="admin-donut"><svg viewBox="0 0 180 180" role="img" aria-labelledby="' + id + '-title"><title id="' + id + '-title">' + esc(options.label || 'Court activity') + ', total ' + esc(format(total)) + '</title>' + arcs + '</svg><div class="admin-donut-total"><strong class="num">' + esc(format(total)) + '</strong><span>' + esc(options.totalLabel || 'Total bookings') + '</span></div></div><div class="admin-chart-legend">' + values.map(function (r, i) { return '<div class="admin-legend-row"><i class="admin-legend-swatch" style="background:' + palette[i % palette.length] + '"></i><span>' + esc(r.name) + '</span><strong class="num">' + esc(format(r.total)) + '</strong><span class="muted num">' + Math.round(r.total / total * 100) + '%</span></div>'; }).join('') + '</div></div>';
  }
  root.AdminCharts = Object.freeze({bars: bars, donut: donut, dates: dates});
})(window);
