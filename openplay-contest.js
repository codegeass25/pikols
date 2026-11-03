(function () {
  'use strict';
  var defaults = {
    'playing-mode':'division','division-matching':'adjacent','reg-mode':'both','pair-div':'approval',
    rotation:'fair',warmup:'1',grace:'3','auto-dispatch':'1'
  };
  var names = {
    standard:'Standard Smart Open Play',social:'Social Open Mix',fixed:'Fixed Partner Play',
    winners:'Winners Stay',custom:'Custom Configuration'
  };
  var presets = {
    standard:defaults,
    social:Object.assign({},defaults,{'playing-mode':'mix','pair-div':'any'}),
    fixed:Object.assign({},defaults,{'reg-mode':'pair'}),
    winners:Object.assign({},defaults,{rotation:'winners_stay','auto-dispatch':'0'})
  };
  var fields = {
    'playing-mode':'playing_mode','division-matching':'division_matching','reg-mode':'registration_mode',
    'pair-div':'pair_divisions',rotation:'rotation_mode',warmup:'warmup_games',grace:'call_grace_minutes','auto-dispatch':'auto_dispatch'
  };
  function presetFor(event) {
    return Object.keys(presets).find(function (key) {
      return Object.keys(defaults).every(function (field) {
        return String(event[fields[field]] ?? defaults[field]) === presets[key][field];
      });
    }) || 'custom';
  }
  function options(event) {
    var selected=presetFor(event);
    return Object.keys(names).map(function (key) {
      return '<option value="'+key+'"'+(selected===key?' selected':'')+'>'+names[key]+'</option>';
    }).join('');
  }
  function settings(event) {
    var c=event.contest||{}, disabled=c.prizes_locked?' disabled':'';
    return '<section class="op3-settings op-contest-settings"><label class="label"><input id="op-contest-enabled" type="checkbox"'+(c.enabled?' checked':'')+disabled+'> Enable Contest Mode</label>'+
      '<div id="op-contest-settings"'+(c.enabled?'':' hidden')+'>'+
      '<label class="op3-label" for="op-contest-target">Games per player</label><select id="op-contest-target" class="op3-select">'+
      [3,4,5,6,7].map(function(n){return '<option'+(n===(c.games_per_player||5)?' selected':'')+'>'+n+'</option>';}).join('')+'</select>'+
      '<p class="op3-small">Confirm eligible attendance and review a complete equal-games schedule in Live Courts before starting.</p>'+
      '<p id="op-contest-warning" class="op3-alert" hidden>Contest Mode requires Fair Smart rotation. Choose Fair Smart or turn off Contest Mode.</p>'+
      '<label class="label"><input id="op-prizes-enabled" type="checkbox"'+(c.cash_prizes?' checked':'')+disabled+'> Enable cash prizes</label>'+
      '<div id="op-prize-settings"'+(c.cash_prizes?'':' hidden')+'><div class="op3-grid">'+[1,2,3].map(function(n){
        return '<label class="op3-label">Top '+n+' (₱)<input class="input" id="op-prize-'+n+'" type="number" min="0" max="99999999.99" step="0.01" value="'+Number((c.prizes||[])[n-1]||0)+'"'+disabled+'></label>';
      }).join('')+'</div><p class="op3-small" id="op-prize-budget"></p>'+(c.prizes_locked?'<p class="op3-small">Advertised prizes are locked.</p>':'')+'</div></div></section>';
  }
  function read(host) {
    var get=id=>host.querySelector('#op-'+id);
    return {enabled:get('contest-enabled').checked,games_per_player:Number(get('contest-target').value),
      cash_prizes:get('prizes-enabled').checked,prizes:[1,2,3].map(n=>get('prize-'+n).value)};
  }
  function wire(host,money) {
    var get=id=>host.querySelector('#op-'+id), preset=get('preset');
    function update() {
      var c=read(host);
      get('contest-settings').hidden=!c.enabled;
      get('prize-settings').hidden=!c.cash_prizes;
      get('contest-warning').hidden=!c.enabled||get('rotation').value==='fair';
      describePreset(host);
      var prizes=c.prizes.reduce((sum,x)=>sum+(Number(x)||0),0);
      var collections=(Number(get('fee').value)||0)*(Number(get('capacity').value)||0);
      get('prize-budget').textContent='Prize pool '+money(prizes)+' · Maximum registration collections '+money(collections)+
        ' · '+(collections>=prizes?'Collections above prize budget ':'Prize budget above maximum collections ')+money(Math.abs(collections-prizes))+'.';
    }
    preset.addEventListener('change',function(){
      var config=presets[preset.value];
      if(config) Object.keys(config).forEach(id=>{get(id).value=config[id];});
      update();
    });
    host.addEventListener('change',function(ev){
      if(ev.target.closest('#op-advanced')){
        var rules={};
        Object.keys(fields).forEach(id=>{rules[fields[id]]=get(id).value;});
        preset.value=presetFor(rules);
      }
      update();
    });
    host.addEventListener('input',update);
    update();
  }

  // Self-contained help content for the Admin's selected preset.
  // This is informational only: the original settings, read(), and APIs own the rules.
  var presetHelp = {
    standard: {
      summary:'An organized, fair Open Play for players of similar skill levels. Best for regular club sessions and mixed groups of solo players or accepted partners.',
      matching:'Division-Based: players are matched within the same or adjacent eligible official divisions.',
      registration:'Individual players may join alone; accepted fixed pairs may also register.',
      rotation:'Fair Smart: the queue prioritizes players with fewer games played and those who have been ready/waiting longer.',
      dispatch:'Automatic court assignment when an eligible group and available court are ready.',
      example:'Example: A Beginner is usually grouped with Beginner or adjacent eligible divisions. After a match, waiting players with fewer games receive priority.',
      contest:'Compatible with Contest Mode when Fair Smart rotation is selected. Contest uses a separate schedule so every participating player completes the same number of games.'
    },
    social: {
      summary:'A friendly social session where eligible players from different official divisions can meet and play together. Best for community mixers.',
      matching:'Open Mix: players from the enabled divisions may be mixed across skill levels rather than limited to adjacent divisions.',
      registration:'Players may register individually or with an accepted fixed partner.',
      rotation:'Fair Smart: court rotation considers games played and waiting time, even when skill divisions are mixed.',
      dispatch:'Automatic court assignment for the next eligible group.',
      example:'Example: A Beginner and an Intermediate can be called together if both divisions are allowed and the event’s registration requirements are met.',
      contest:'Compatible with Contest Mode under Fair Smart rotation. The fixed contest schedule enforces equal games despite mixed divisions.'
    },
    fixed: {
      summary:'A doubles session for players who want to stay with their chosen partner throughout play. Best for practicing team coordination.',
      matching:'Division-Based: pair eligibility follows the configured official-division and fixed-partner rules.',
      registration:'Fixed Pair Only: both teammates must complete registration, accept the partnership, and meet payment/check-in requirements.',
      rotation:'Fair Smart: accepted pairs are rotated fairly; the registered teammates stay together.',
      dispatch:'Automatic court assignment when two eligible confirmed pairs and a court are ready.',
      example:'Example: Player A registers with Player B, who accepts. They play as one pair against other eligible pairs rather than being split into different teams.',
      contest:'Compatible with Contest Mode under Fair Smart rotation. Each player receives the same game quota; competition ranks complete pairs.'
    },
    winners: {
      summary:'A host-managed competitive casual session where the winning pair can defend its place on court.',
      matching:'Division-Based: only eligible players or pairs may be called as opponents.',
      registration:'Solo players and accepted fixed pairs can register according to normal Open Play rules.',
      rotation:'Winners Stay: after a scored game, the winning pair may remain while the Host selects the next eligible challengers.',
      dispatch:'Host-controlled: the Host manages the next court assignments instead of normal automatic Fair Smart dispatch.',
      example:'Example: Team A wins and may stay on the court. The Host calls the next eligible pair to challenge them.',
      contest:'Not compatible with strict equal-games Contest Mode, because winners remaining on court can create unequal game counts.'
    }
  };
  function guideEscape(v){return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function selectedText(el){return el && el.selectedOptions && el.selectedOptions[0] ? el.selectedOptions[0].textContent.trim() : 'Not selected';}
  function describePreset(host) {
    var target=host.querySelector('#op-preset-guide');
    if(!target)return;
    var get=id=>host.querySelector('#op-'+id), key=get('preset').value;
    var info=presetHelp[key], custom=!info, contest=get('contest-enabled').checked;
    // Input/fee edits also call update(); avoid rebuilding a large live region unnecessarily.
    var signature=[key,contest,get('rotation').value].concat(custom?Object.keys(fields).map(function(id){return get(id).value;}):[]).join('|');
    if(target.dataset.guideSignature===signature)return;
    target.dataset.guideSignature=signature;
    if(custom){
      var playing=get('playing-mode').value, rotating=get('rotation').value, reg=get('reg-mode').value;
      info={
        summary:'This event uses custom Advanced Settings. The details below reflect the actual current selections, not an automatic preset. Changing the advanced fields changes these explanations immediately.',
        matching:playing==='mix'?'Open Mix: players may mix across allowed official divisions.':selectedText(get('division-matching'))+': eligible divisions are matched according to this rule.',
        registration:selectedText(get('reg-mode'))+(reg!=='individual'?' · Partner rule: '+selectedText(get('pair-div')):' · No fixed-partner registration.'),
        rotation:selectedText(get('rotation'))+(rotating==='four_off'?' — Existing Four On / Four Off behavior is preserved; it has not been replaced by Fair Smart.':rotating==='fair'?' — Balances completed games and waiting time.':' — The winning team may remain on court.'),
        dispatch:selectedText(get('auto-dispatch'))+' · Warm-up: '+selectedText(get('warmup'))+' · Call grace: '+selectedText(get('grace'))+'.',
        example:'Example: The Host can customize matching, registration, and rotation rules in Advanced Settings. Review these rules carefully before publishing.',
        contest:rotating==='fair'?'Fair Smart is compatible with the optional strict equal-games Contest Mode.': 'Contest Mode requires Fair Smart Rotation. Select Fair Smart or disable Contest Mode before creating a contest.'
      };
    }
    var title=names[key]||names.custom;
    var rows=[['Player matching',info.matching],['Registration & partners',info.registration],['Court rotation',info.rotation],['Court dispatch',info.dispatch]];
    target.innerHTML='<div class="op-preset-guide-heading"><span class="op-preset-guide-symbol" aria-hidden="true">ⓘ</span><div><h3>'+guideEscape(title)+'</h3><p class="op-preset-guide-intro">'+guideEscape(info.summary)+'</p></div></div>'+
      '<div class="op-preset-guide-rows">'+rows.map(function(row){return '<div class="op-preset-guide-row"><div class="op-preset-guide-label">'+guideEscape(row[0])+'</div><div class="op-preset-guide-detail">'+guideEscape(row[1])+'</div></div>';}).join('')+'</div>'+
      '<div class="op-preset-guide-example"><strong>Example in practice</strong><p>'+guideEscape(info.example)+'</p></div>'+
      '<div class="op-preset-guide-contest'+(contest && get('rotation').value!=='fair'?' is-warning':'')+'"><strong>Contest compatibility'+(contest?' · Contest is ON':'')+'</strong><p>'+guideEscape(info.contest)+'</p></div>'+
      '<p class="op-preset-guide-footnote">Allowed divisions, partner restrictions, warm-up alerts and call grace can still be reviewed in Advanced Settings. Four On / Four Off remains available there.</p>';
  }

  function table(rows,esc) {
    return '<div class="op-contest-table"><table><thead><tr><th>Rank</th><th>Player / Pair</th><th>GP</th><th>W</th><th>L</th>'+
      '<th>Win %</th><th>PF</th><th>PA</th><th>Diff</th><th>Opp. win %</th></tr></thead><tbody>'+
      rows.map(r=>'<tr><td>'+r.rank+'</td><th scope="row">'+esc(r.name)+'</th><td>'+r.games+'</td><td>'+r.wins+'</td><td>'+r.losses+
        '</td><td>'+Number(r.win_percent).toFixed(1)+'</td><td>'+r.points_for+'</td><td>'+r.points_against+'</td><td>'+r.differential+
        '</td><td>'+Number(r.strength_of_schedule).toFixed(1)+'</td></tr>').join('')+'</tbody></table></div>';
  }
  function button(action,label,id) {
    return '<button type="button" class="op3-btn secondary" data-op-contest-action="'+action+'"'+(id?' data-op-subject="'+Number(id)+'"':'')+'>'+label+'</button>';
  }
  function board(c,esc,money,admin) {
    if(!c)return '';
    var official=c.official, running=c.status==='IN_PROGRESS', paused=c.status==='PAUSED', complete=c.status==='COMPLETED';
    return '<section class="op3-settings op-contest-board"><h3>Equal-games contest · '+esc(c.status.replaceAll('_',' '))+'</h3>'+
      '<p class="op3-small">'+(c.locked_target||c.games_per_player)+' games per player'+(c.required?' · '+c.completed+' of '+c.required+' matches complete · '+c.remaining+' remaining':'')+'</p>'+
      (c.pause?'<p class="op3-alert">'+esc(c.pause.reason)+(c.pause.matches.length?' · Affected matches '+c.pause.matches.join(', '):'')+'</p>':'')+
      (c.cash_prizes?'<p class="op3-small">Cash prizes '+c.prizes.map((x,i)=>'Top '+(i+1)+' '+esc(money(x))).join(' · ')+'</p>':'')+
      (admin?'<div class="op3-inline-actions">'+
        (['CONFIGURING','READY'].includes(c.status)?button('prepare','Prepare full schedule'):'')+
        (running?button('pause','Pause contest'):'')+
        (paused?button('resume','Resume contest')+button('extend','Extend reserved end time'):'')+
        (complete?button('finalize','Finalize official results'):'')+
        (official?button('reopen','Reopen results'):'')+'</div><div id="op-contest-preview"></div>':'')+
      (official?'<h4>Official Top 3</h4><ol>'+official.top_three.map(r=>'<li><strong>Top '+r.rank+' · '+esc(r.name)+'</strong> · '+r.wins+'/'+r.games+' wins'+
        (official.prizes[r.rank-1]?' · '+esc(money(official.prizes[r.rank-1])):'')+'</li>').join('')+'</ol>'+
        button('results','Download official results PNG'):'')+
      (c.standings.length?'<h4>'+ (official?'Official leaderboard':'Provisional leaderboard')+'</h4>'+table(official?official.rankings:c.standings,esc):'')+
      '<p class="op3-small">'+esc(c.tie_rule)+'</p>'+
      (c.players.length?'<details><summary>Player game counts</summary>'+c.players.map(p=>'<div class="op3-row"><span>'+esc(p.name)+'</span><span>'+
        p.completed+' / '+c.locked_target+'</span>'+(admin&&(running||paused)?button('withdraw','Mark withdrawn',p.id):'')+
        (admin&&paused?button('return','Authorize venue re-check-in',p.id):'')+'</div>').join('')+'</details>':'')+
      (c.matches.length?'<details><summary>Match schedule and scores</summary>'+c.matches.map(m=>'<div class="op3-row op-contest-match"><span>#'+m.sequence+' · Wave '+m.wave+' · '+esc(m.court_name)+
        '<br>'+m.teams.map(t=>t.map(p=>esc(p.name)).join(' + ')).join(' vs ')+'</span><span>'+esc(m.state)+
        (m.state==='completed'?' · '+m.score_a+'–'+m.score_b:'')+'</span>'+
        (admin&&complete&&m.state==='completed'?button('correct','Correct score',m.id):'')+
        (admin&&paused&&['called','playing'].includes(m.state)?button('requeue','Requeue match',m.id):'')+
        (admin&&paused&&m.state==='scheduled'?button('reschedule','Move to court',m.id):'')+'</div>').join('')+'</details>':'')+
      (admin&&c.payouts&&c.payouts.length?'<details><summary>Cash prize payouts</summary>'+c.payouts.map(p=>'<div class="op3-row"><span>Top '+p.rank+' · '+esc(p.name)+' · '+esc(money(p.amount))+'</span><span>'+
        (p.amount<=0?'No payout':p.status==='paid'?'Paid '+esc(String(p.paid_at||'').slice(0,10))+(p.paid_by?' by staff #'+p.paid_by:''):'Pending payout')+(p.notes?' · '+esc(p.notes):'')+'</span>'+
        (p.amount>0?button(p.status==='paid'?'reverse':'payout',p.status==='paid'?'Record payout reversal':'Record paid',p.rank):'')+'</div>').join('')+'</details>':'')+'</section>';
  }
  function preview(p,esc,money) {
    return '<div class="op-contest-preview"><h4>Attendance and schedule review</h4><p>'+p.players.length+' eligible and checked in · '+p.confirmed+' confirmed registrations</p>'+
      '<p>'+p.players.map(x=>esc(x.name)).join(', ')+'</p>'+
      (p.error?'<p class="op3-alert">'+esc(p.error)+'</p>':
        (p.adjustment?'<p class="op3-alert">'+esc(p.adjustment)+'</p>':'')+
        '<p>'+p.target+' games each · '+p.matches.length+' matches · '+p.waves+' waves · estimated '+p.estimated_minutes+' minutes at 15 minutes per wave.</p>'+
        (p.notice?'<p class="op3-alert">'+esc(p.notice)+'</p><label><input type="checkbox" id="op-contest-confirm-time"> I have reviewed the estimate and court reservation.</label>':'')+
        '<details><summary>Review every court assignment</summary>'+p.matches.map(m=>'<p>#'+m.sequence+' · Wave '+m.wave+' · '+esc((p.courts.find(c=>c.id===m.court_id)||{}).name||'Court')+'<br>'+
          m.teams.map(t=>t.map(x=>esc(x.name)).join(' + ')).join(' vs ')+'</p>').join('')+'</details>'+
        '<p>'+esc(p.tie_rule)+'</p><label><input type="checkbox" id="op-contest-confirm-format"> I confirm attendance, '+p.target+' games per player, and the tie rule.</label>'+
        (p.configured_prizes.some(n=>n>0)?'<p>Advertised prizes '+p.configured_prizes.map(n=>esc(money(n))).join(' / ')+'</p>':'')+
        (p.cash_prizes?'<label><input type="checkbox" id="op-contest-confirm-prizes"> I reviewed the advertised prize amounts and will honor them.</label>':'')+
        button('start','Start contest with '+p.target+' games each'))+'</div>';
  }

  function loadLogo(url) {
    return new Promise(function(resolve,reject){
      var img=new Image();
      img.crossOrigin='anonymous';img.onload=function(){resolve(img);};img.onerror=reject;img.src=url;
    });
  }
  async function poster(event,official,brand,registrationUrl) {
    var fallback='icons/wenjelly-v73-512.png';
    var logo=await loadLogo(brand.logo||fallback).catch(()=>loadLogo(fallback));
    var canvas=document.createElement('canvas');
    canvas.width=1200;canvas.height=1500;
    var ctx=canvas.getContext('2d');
    if(!ctx)throw Error('This browser does not support poster rendering.');
    var bg=ctx.createLinearGradient(0,0,1200,1500);
    bg.addColorStop(0,'#061d29');bg.addColorStop(1,'#143e42');
    ctx.fillStyle=bg;ctx.fillRect(0,0,1200,1500);
    ctx.strokeStyle='#6dd2b7';ctx.lineWidth=4;ctx.strokeRect(45,45,1110,1410);
    var scale=Math.min(170/logo.width,170/logo.height);
    ctx.drawImage(logo,90,90,logo.width*scale,logo.height*scale);
    function text(value,x,y,size,color,max,weight){
      ctx.fillStyle=color;ctx.font=(weight||600)+' '+size+'px system-ui, sans-serif';
      ctx.fillText(String(value),x,y,max||1000);
    }
    function lines(value,y,size,maxLines){
      ctx.font='750 '+size+'px system-ui, sans-serif';
      var words=String(value||'').trim().split(/\s+/), output=[], line='';
      words.forEach(function(word){
        if(line&&ctx.measureText(line+' '+word).width>1010){output.push(line);line=word;}
        else line+=(line?' ':'')+word;
      });
      if(line)output.push(line);
      if(output.length>maxLines)output[maxLines-1]=output[maxLines-1]+'…';
      output.slice(0,maxLines).forEach((str,i)=>text(str,90,y+i*(size+9),size,'#f7fbfa',1010,750));
      return y+Math.min(output.length,maxLines)*(size+9);
    }
    text(brand.name||'WenJelly Sports Center',285,175,42,'#f7fbfa',795);
    text(official?'OFFICIAL CONTEST RESULTS':'PIKOL SMART OPEN PLAY',90,335,31,'#a6f5a5',1000,750);
    var y=lines(event.title,450,76,3)+20;
    text([event.event_date,event.start_time&&event.end_time?event.start_time+'–'+event.end_time+' PHT':''].filter(Boolean).join('  ·  '),90,y,42,'#b8d9d9');
    y+=100;
    if(official){
      official.top_three.forEach(function(r,i){
        text('TOP '+r.rank,90,y,38,'#a6f5a5',140,750);
        text(r.name,252,y,50,'#f7fbfa',850,750);
        text(r.wins+' wins / '+r.games+' games'+(official.prizes[i]?'   ·   ₱'+Number(official.prizes[i]).toFixed(2):''),252,y+48,32,'#b8d9d9',850);
        y+=142;
      });
    }else{
      text(event.venue_name||event.location||brand.name,90,y,46,'#f7fbfa');
      text('₱'+Number(event.entrance_fee||0).toFixed(2)+' entry  ·  Maximum '+(Number(event.capacity)||12)+' players',90,y+74,38,'#f7fbfa');
      text(event.preset_name||names[presetFor(event)],90,y+148,39,'#a6f5a5');
      if(event.contest?.enabled){
        text('Equal-games contest  ·  Target '+(event.contest.locked_target||event.contest.games_per_player)+' games each',90,y+222,36,'#f7fbfa');
        if(event.contest.cash_prizes)text('Cash prizes  ·  '+event.contest.prizes.map((p,i)=>'Top '+(i+1)+' ₱'+Number(p).toFixed(2)).join('  /  '),90,y+294,33,'#a6f5a5');
      }
      if(registrationUrl)text(registrationUrl,90,1360,29,'#b8d9d9');
    }
    return canvas;
  }
  function download(canvas,filename) {
    var a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=filename;
    document.body.appendChild(a);a.click();a.remove();
  }
  window.PikolOpenPlay={names,presets,presetFor,options,settings,read,wire,board,preview,poster,download};
})();
