(function (root) {
  'use strict';
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function label(value) {
    return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  // Keep lower/upper brackets and each group separate even when their round names match.
  function roundGroups(matches) {
    var groups = {}, result = [];
    (matches || []).forEach(function (match) {
      var key = [match.group_name || '', match.bracket_side || 'winners', match.round_order || 0, match.round || 'round'].join('|');
      if (!groups[key]) {
        var section = match.group_name ? 'Group ' + match.group_name : label(match.bracket_side || match.stage || 'Matches');
        groups[key] = { key: key, label: section + ' · ' + label(match.round || 'Round'), matches: [] };
        result.push(groups[key]);
      }
      groups[key].matches.push(match);
    });
    return result.sort(function (a, b) {
      var x = a.matches[0], y = b.matches[0];
      return Number(x.round_order || 0) - Number(y.round_order || 0) || a.label.localeCompare(b.label);
    });
  }
  function scoreText(match, side) {
    var started = match.status === 'live' || match.status === 'completed' || !!match.started_at || Number(match.score_a) > 0 || Number(match.score_b) > 0;
    return started && match['score_' + side] != null ? String(Number(match['score_' + side])) : '—';
  }
  function renderStandings(division) {
    if (division.competition_format && !['round_robin','group_knockout'].includes(division.competition_format)) return '';
    var groups = Array.isArray(division.group_standings) && division.group_standings.length
      ? division.group_standings
      : [{ group_name: '', standings: division.standings || [] }];
    if (!groups.some(function (g) { return (g.standings || []).length; })) return '';
    return '<section class="tournament-standings stack" aria-label="Division standings"><h4 class="label">Standings</h4>' + groups.map(function (group) {
      var rows = group.standings || [];
      if (!rows.length) return '';
      return '<div class="table-wrap"><table class="data"><caption style="text-align:left;padding:8px 0;font-weight:700">' +
        esc(group.group_name ? 'Group ' + group.group_name : division.name || 'Division') +
        '</caption><thead><tr><th scope="col">Rank</th><th scope="col">Participant</th><th scope="col">Played</th><th scope="col">Won</th><th scope="col">Lost</th><th scope="col">For</th><th scope="col">Against</th><th scope="col">Difference</th><th scope="col">Points</th></tr></thead><tbody>' +
        rows.map(function (row, index) {
          return '<tr><td class="num">' + (index + 1) + '</td><td>' + esc(row.name) + '</td>' +
            ['played', 'wins', 'losses', 'points_for', 'points_against', 'diff', 'points'].map(function (key) {
              return '<td class="num">' + Number(row[key] || 0) + '</td>';
            }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
    }).join('') + '<p class="tiny muted">Completed results only. Ranking follows the tournament tie-break rules.</p></section>';
  }
  root.PikolTournamentUI = { roundGroups: roundGroups, scoreText: scoreText, renderStandings: renderStandings };
})(typeof window !== 'undefined' ? window : globalThis);
