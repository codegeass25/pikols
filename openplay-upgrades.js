(function(){
 'use strict';
 function mount(host,o){
  var root=host.querySelector('[data-op-group]'),e=o.event,q=o.quote,locked=!!q.locked_price;
  var people=(q.companions||[]).map(function(p){return Object.assign({},p);}),serial=0,timer,requestKey=crypto.randomUUID(),initialOwner=q.lines?.[0]?.amount??Number(q.amount||0),displayAmount=Number(q.amount||0);
  var mode=host.querySelector('#op3-join-mode'),creditRoot=host.querySelector('[data-op-group-credit]');
  if(locked&&q.join_mode)mode.value=q.join_mode;
  if(locked)mode.disabled=true;
  var oldPrice=host.querySelector('.oc-price');if(oldPrice)oldPrice.hidden=true;
  root.innerHTML='<section class="op-group-friends"><h3>Bringing friends?</h3><p class="op3-small">You are Person 1. Add your companions’ complete names and divisions.</p><div data-group-people></div><button type="button" class="btn btn-outline" data-group-add>Add Guest</button><p data-group-progress aria-live="polite"></p><p class="op3-small" data-group-pair-note></p></section><section class="op-group-total" aria-live="polite"><div data-group-lines></div><strong data-group-total></strong><p role="status" data-group-message></p></section>';
  var container=root.querySelector('[data-group-people]'),message=root.querySelector('[data-group-message]');
  function read(){return Array.from(container.querySelectorAll('[data-group-person]')).map(function(row){return {key:row.dataset.groupPerson,name:row.querySelector('input').value.trim(),division:row.querySelector('select').value};});}
  function draw(){
   container.innerHTML=people.map(function(p,i){return '<div class="op-group-person" data-group-person="'+o.esc(p.key)+'"><span class="op-group-number">'+(i+2)+'</span><div><label class="sr-only" for="op-companion-'+i+'">Person '+(i+2)+' complete name</label><input class="input" id="op-companion-'+i+'" maxlength="100" required placeholder="Person '+(i+2)+' complete name" value="'+o.esc(p.name||'')+'"'+(locked?' disabled':'')+'><label class="sr-only" for="op-companion-division-'+i+'">Person '+(i+2)+' division</label><select class="input" id="op-companion-division-'+i+'"'+(locked?' disabled':'')+'><option value="">Select division</option>'+(e.allowed_divisions||[]).map(function(v){return '<option value="'+o.esc(v)+'"'+(p.division===v?' selected':'')+'>'+o.esc(v)+'</option>';}).join('')+'</select></div><button type="button" class="btn btn-ghost" data-group-remove="'+i+'" aria-label="Remove Person '+(i+2)+'"'+(locked?' disabled':'')+'>×</button></div>';}).join('');
   sync();
  }
  function sync(){
   var size=people.length+1,left=e.slots_left==null?null:Math.max(0,Number(e.slots_left)-size);
   root.querySelector('[data-group-progress]').textContent=size+' people total'+(left==null?'':' · '+left+' spots remaining after this group');
   root.querySelector('[data-group-add]').disabled=locked||size>=200||(e.slots_left!=null&&size>=Number(e.slots_left));
   root.querySelector('[data-group-pair-note]').textContent=mode.value==='pair'&&people.length?'Group fixed pairs are Person 1 + Person 2, Person 3 + Person 4, and so on. Each pair must meet the event rules.':locked?'Your accepted group and price are locked for this payment retry.':'';
   o.onChange(people.length);
   totals();
  }
  function totals(){
   var owner=q.lines?.[0]||{amount:initialOwner,discount_source:q.discount_source},guestPrice=q.companion_unit_price||q.lines?.[1]||{amount:Number(e.entrance_fee||0)};
   var lines=[owner].concat(people.map(function(){return guestPrice;}));
   displayAmount=lines.reduce(function(sum,p){return sum+Math.round(Number(p.amount||0)*100);},0)/100;
   root.querySelector('[data-group-lines]').innerHTML=lines.map(function(p,i){return '<div class="op-group-price-line"><span>Person '+(i+1)+(p.discount_source&&p.discount_source!=='none'?' · '+o.esc(p.discount_source):'')+'</span><span>'+o.money(p.amount)+'</span></div>';}).join('');
   root.querySelector('[data-group-total]').textContent='Session fee ('+(people.length+1)+' people) · Total '+o.money(displayAmount);
   if(creditRoot){var previous=creditRoot.querySelector('input')?.checked;creditRoot.innerHTML=o.creditHtml(displayAmount,'op-use-credit');var checkbox=creditRoot.querySelector('input');if(checkbox)checkbox.checked=!!previous;}
  }
  async function refresh(){
   clearTimeout(timer);people=read();sync();
   if(people.some(function(p){return !p.name||!p.division;}))throw Error('Enter the complete name and division of every companion.');
   var current=++serial,manifest=JSON.stringify({companions:people,join_mode:mode.value});
   message.textContent='Updating group quote…';
   try{
    var fresh=await o.api('/api/open-play/'+e.id+'/quote',{method:'POST',body:JSON.parse(manifest)});
    if(current!==serial||!host.isConnected)throw Error('Group details changed. Review the latest quote.');
    if(manifest!==JSON.stringify({companions:read(),join_mode:mode.value}))throw Error('Group details changed. Review the latest quote.');
    Object.assign(q,fresh);if(fresh.capacity)e.slots_left=fresh.capacity.slots_left;
    if(e.capacity&&fresh.capacity?.registered+people.length+1>e.capacity&&!locked)throw Error('There are no longer enough places for the whole group.');
    message.textContent='Quote updated. Places are reserved only after confirmation.';totals();sync();return q;
   }catch(error){if(current===serial&&host.isConnected)message.textContent=error.message;throw error;}
  }
  function queue(){clearTimeout(timer);message.textContent='Complete the guest details to update the total.';timer=setTimeout(function(){if(host.isConnected)refresh().catch(function(){});},300);}
  root.addEventListener('input',function(){people=read();queue();});
  root.addEventListener('change',function(){people=read();queue();});
  root.addEventListener('click',function(ev){
   if(locked)return;
   if(ev.target.closest('[data-group-add]')){people=read();people.push({key:crypto.randomUUID(),name:'',division:''});draw();container.lastElementChild?.querySelector('input')?.focus();queue();}
   var remove=ev.target.closest('[data-group-remove]');if(remove){people=read();people.splice(Number(remove.dataset.groupRemove),1);draw();queue();}
  });
  mode.addEventListener('change',queue);draw();totals();
  return {ready:async function(){var reviewed=displayAmount;await refresh();if(Math.round(reviewed*100)!==Math.round(Number(q.amount)*100))throw Error('The group price changed. Review the updated total and confirm again.');return {companions:read(),idempotency_key:requestKey,expected_manifest:q.manifest_digest};},count:function(){return people.length;}};
 }
 function roster(v,o){
  var locked=v.contest&&['IN_PROGRESS','PAUSED','COMPLETED','FINALIZED','CANCELLED'].includes(v.contest.status);
  var rows=v.participants||[];
  return '<section class="op-participant-roster"><h3 class="op3-section">Participants &amp; Live Queue</h3><label class="op3-label">Show participants<select class="op3-select" data-participant-filter><option value="all">All ('+rows.length+')</option><option value="not_checked_in">Not checked in</option><option value="ready">Ready</option><option value="playing">On court</option><option value="absent">Absent / checked out</option></select></label><div data-participant-rows>'+rows.map(function(p){
   var state=p.queue_status,busy=['called','playing'].includes(state),actions='',notIn=!p.attendance||state==='checked_in';
   if(p.eligible&&!locked&&!busy&&!v.event.ended){
    if(p.absent||state==='left')actions+='<button type="button" class="op3-btn" data-participant-action="restore" data-participant="'+p.id+'">Restore</button>';
    else if(notIn)actions+='<button type="button" class="op3-btn" data-participant-action="check-in" data-participant="'+p.id+'">Check In'+(p.type==='registered'&&rows.some(function(x){return x.type==='companion'&&x.registration_id===p.registration_id;})?' + companions':'')+'</button>';
    if(!p.absent&&state!=='left')actions+='<button type="button" class="op3-btn secondary" data-participant-action="absent" data-participant="'+p.id+'">Mark Absent</button>';
    if(p.type==='direct_guest'&&p.attendance&&state!=='left'&&o.admin)actions+='<button type="button" class="op3-btn secondary" data-direct-checkout="'+(-p.id)+'">Check out</button>';
   }
   if(o.payments){if(p.type==='direct_guest')actions+='<button type="button" class="op3-btn secondary" data-participant-payment="'+p.guest_booking_id+'">Group payment</button>';
    if(p.type==='registered')actions+='<button type="button" class="op3-btn secondary" data-participant-registration="'+p.registration_id+'">Booking / payment</button>';}
   if(o.admin&&p.type==='direct_guest'&&p.registration_status==='held'&&p.hold_active)actions+='<button type="button" class="op3-btn secondary" data-participant-release="'+p.guest_booking_id+'">Release hold</button>';
   var progress=window.PikolOpenPlay.playerProgress(v.contest,p.id);
   return '<div class="op-participant-card" data-roster-state="'+o.esc(state)+'"><div><strong>'+o.esc(p.name)+'</strong><small>'+o.esc(({registered:'Registered player',companion:'Accompanying guest',direct_guest:'Direct guest'})[p.type])+' · '+o.esc(p.division)+(p.type!=='registered'?' · With '+o.esc(p.owner_name||''):'' )+'</small><small>'+o.esc(p.registration_status)+' · '+o.esc(p.payment_status||'')+(progress?' · Completed Games: '+progress.completed+' / '+progress.quota:'')+'</small></div><div><b>'+o.esc(state.replaceAll('_',' '))+'</b>'+(p.absence_reason?'<small>'+o.esc(p.absence_reason)+'</small>':'')+'<div class="op-participant-actions">'+actions+'</div></div></div>';
  }).join('')+'</div></section>';
 }
 setInterval(function(){document.querySelectorAll('[data-cancel-until]').forEach(function(button){var end=Date.parse(button.dataset.cancelUntil);if(Number.isFinite(end)&&Date.now()>=end)button.remove();});},1000);
 window.PikolOpenPlayUpgrades={mount:mount,roster:roster};
})();
