(function(global){
  'use strict';
  function install(c) {
    const {esc,money,humanTime,humanDate,api,toast}=c,host=document.getElementById('venue-booking');
    let venues=[],venueId=null,data=null,selection=new Map(),quote=null,quoteSerial=0,request=0,date=c.date(),busy=false,key=null,quoteTimer=null,requestedCourt=null;
    host.innerHTML='<div class="vg-step-label">1 · SELECT VENUE</div><div class="vg-venues" aria-label="Choose venue"></div><div class="vg-venue-info"></div><div class="vg-date-host"></div><div class="vg-step-label">3 · SELECT COURT TIMES</div><div class="vg-legend"><span>● Available</span><span>✓ Selected</span><span>◷ Held / Pending</span><span>■ Booked / Event</span><span>— Unavailable</span></div><div class="vg-matrix-scroll" role="region" tabindex="0" aria-label="Court availability. Scroll horizontally for more courts."></div><div class="vg-selection-live" aria-live="polite"></div>';
    const dateHost=host.querySelector('.vg-date-host'),fields=document.querySelector('.vg-date-fields'),calendar=document.querySelector('.booking-calendar-details');
    if(fields){dateHost.append(fields.previousElementSibling);dateHost.append(fields);}if(calendar)dateHost.append(calendar);
    const summary=document.getElementById('summary-list'),button=document.getElementById('btn-confirm');
    function token(s){return s.court_id+':'+s.start_time+':'+s.end_time;}
    function selections(){return [...selection.values()].sort((a,b)=>a.start_time.localeCompare(b.start_time)||a.court_id-b.court_id);}
    function clear(){selection.clear();quote=null;key=null;quoteSerial++;render();}
    function changeDate(next){if(next===date)return true;if(selection.size&&!confirm('Changing date clears your selected court times. Continue?'))return false;clear();date=next;return true;}
    function selectVenue(id){if(id===venueId)return;if(selection.size&&!confirm('Changing venue clears your selected court times. Continue?'))return;selection.clear();quote=null;key=null;quoteSerial++;clearTimeout(quoteTimer);venueId=id;render();}
    function currentVenue(){return venues.find(v=>v.id===venueId);}
    function eligible(){return (data?.courts||[]).filter(ct=>ct.venue_id===venueId);}
    function expected(){return {date,venue_id:venueId,selections:selections().map(s=>({court_id:s.court_id,start_time:s.start_time,end_time:s.end_time}))};}
    function totals(){const list=selections();return {amount:quote?.amount??list.reduce((n,s)=>n+s.price,0),minutes:list.reduce((n,s)=>n+global.PikolAvailability.duration(s.start_time,s.end_time),0),base:quote?.base_amount??list.reduce((n,s)=>n+s.price,0),discount:quote?.discount_amount||0};}
    async function refreshQuote(){
      const serial=++quoteSerial;if(!selection.size||!c.signedIn())return;
      try {const q=await api('/api/booking-groups/quote',{method:'POST',body:expected()});if(serial!==quoteSerial)return;quote=q;renderSummary();}
      catch(e){if(serial===quoteSerial){quote=null;toast(e.message,'warning');button.disabled=true;}}
    }
    function queueQuote(){quote=null;quoteSerial++;clearTimeout(quoteTimer);quoteTimer=setTimeout(refreshQuote,180);}
    function renderSummary(){
      const list=selections(),t=totals(),v=currentVenue();
      summary.innerHTML='<div class="summary-row"><dt>Venue</dt><dd>'+esc(v?.name||'Select venue')+'</dd></div><div class="summary-row"><dt>Date</dt><dd>'+humanDate(date)+'</dd></div><div class="summary-row"><dt>Selections</dt><dd>'+list.length+' slots · '+(t.minutes/60)+' court-hours</dd></div>'+(quote?'<div class="summary-row"><dt>Subtotal</dt><dd>'+money(t.base)+'</dd></div><div class="summary-row"><dt>Membership discount</dt><dd>−'+money(t.discount)+'</dd></div>':'')+'<div class="summary-row"><dt>'+(quote?'Total':'Estimated total')+'</dt><dd><strong>'+money(t.amount)+'</strong></dd></div>'+(list.length?'<button class="btn btn-ghost btn-sm" type="button" data-vg-clear>Clear Selection</button>':'');
      button.textContent='Continue to Checkout →';button.disabled=busy||!list.length;
      host.querySelector('.vg-selection-live').textContent=list.length+' court time'+(list.length===1?'':'s')+' selected';
      document.getElementById('summary-card').classList.toggle('vg-has-selection',!!list.length);
    }
    function render(){
      const v=currentVenue();host.querySelector('.vg-venues').innerHTML=venues.map(v=>'<button class="vg-venue'+(v.id===venueId?' is-selected':'')+'" data-venue="'+v.id+'" aria-pressed="'+(v.id===venueId)+'">'+(v.thumbnail_url?'<img src="'+esc(c.assetUrl(v.thumbnail_url))+'" alt="" width="44" height="44" loading="lazy">':'')+'<strong>'+esc(v.name)+'</strong><span>'+Number(v.court_count)+' courts</span></button>').join('')||'<div class="empty">No active venues</div>';
      host.querySelector('.vg-venue-info').innerHTML=v?'<strong>'+esc(v.name)+'</strong><button class="btn btn-ghost btn-sm" data-location aria-label="View '+esc(v.name)+' location">📍 '+(v.maps_url?'Location':'Location unavailable')+'</button><p class="tiny muted">'+esc(v.address||v.description||'Choose any available time below.')+'</p>':'';
      const courts=eligible(),rows=new Map();courts.forEach(ct=>ct.slots.forEach(sl=>rows.set(sl.start+'|'+sl.end,sl)));
      const times=[...rows.values()].sort((a,b)=>a.start.localeCompare(b.start)||global.PikolAvailability.duration(a.start,a.end)-global.PikolAvailability.duration(b.start,b.end));
      host.querySelector('.vg-matrix-scroll').innerHTML=courts.length?'<table class="vg-matrix" style="min-width:'+(112+courts.length*150)+'px"><caption class="sr-only">'+esc(v?.name)+' · '+humanDate(date)+'</caption><thead><tr><th class="vg-time" scope="col">TIME</th>'+courts.map(ct=>'<th scope="col"><button data-gallery="'+ct.id+'">'+esc(ct.name)+' <span aria-hidden="true">▧</span></button><small>'+esc(ct.surface||'')+'</small></th>').join('')+'</tr></thead><tbody>'+times.map(sl=>'<tr><th class="vg-time" scope="row"><span>'+humanTime(sl.start)+'</span><small>'+humanTime(sl.end)+'</small></th>'+courts.map(ct=>{
        const cell=ct.slots.find(s=>s.start===sl.start&&s.end===sl.end),s={court_id:ct.id,start_time:sl.start,end_time:sl.end},selected=selection.has(token(s)),status=selected?'selected':cell?.status||'unconfigured';
        const allowed=!!cell?.bookable&&ct.status==='active';const label=selected?'SELECTED':cell?.status_label||'UNCONFIGURED';
        return '<td><button class="vg-cell vg-'+esc(status)+'" data-cell="'+esc(token(s))+'" aria-pressed="'+selected+'" aria-label="'+esc(ct.name)+' '+humanTime(sl.start)+' to '+humanTime(sl.end)+', '+esc(label)+(allowed?', '+money(cell.price):'')+'"'+(allowed?'':' disabled')+'><span>'+esc(label)+'</span><small>'+(allowed?money(cell.price):'—')+'</small></button></td>';
      }).join('')+'</tr>').join('')+'</tbody></table>':'<div class="empty"><strong>No configured courts</strong>Choose another venue or ask staff to configure its courts.</div>';
      if(courts.length&&!times.length)host.querySelector('.vg-matrix-scroll').innerHTML='<div class="empty">No time slots are configured for this venue.</div>';
      renderSummary();
    }
    async function refresh(){
      const ticket=++request,newDate=c.date();
      if(!changeDate(newDate)){c.setDate(date);return;}
      host.setAttribute('aria-busy','true');button.disabled=true;
      try {
        const [vs,availability]=await Promise.all([api('/api/venues'),api('/api/availability?date='+encodeURIComponent(date))]);
        if(ticket!==request)return;venues=vs;data=availability;c.received(data);c.scheduleExpiry(data);
        if(requestedCourt!==null){const target=data.courts.find(ct=>ct.id===requestedCourt);requestedCourt=null;if(target&&venues.some(v=>v.id===target.venue_id))selectVenue(target.venue_id);}
        if(!venues.some(v=>v.id===venueId)){venueId=venues[0]?.id||null;selection.clear();}
        let lost=0;
        for(const [k,s] of selection){const ct=eligible().find(ct=>ct.id===s.court_id),cell=ct?.slots.find(sl=>sl.start===s.start_time&&sl.end===s.end_time&&sl.bookable);if(!cell){selection.delete(k);lost++;}else{s.price=cell.price;s.court_name=ct.name;}}
        if(lost){quote=null;key=null;quoteSerial++;clearTimeout(quoteTimer);toast(lost+' selected time'+(lost===1?' is':'s are')+' no longer available. Your selection has been updated.','warning');}
        render();if(selection.size)queueQuote();
      }catch(e){if(ticket!==request)return;data=null;button.disabled=true;host.querySelector('.vg-matrix-scroll').innerHTML='<div class="empty"><strong>Availability could not load</strong><p>'+esc(e.message)+'</p><button class="btn btn-outline" data-vg-retry>Retry</button></div>';}
      finally{if(ticket===request)host.setAttribute('aria-busy','false');}
    }
    async function checkout(){
      if(!c.requirePlayer(()=>checkout()))return;
      if(!selection.size||busy)return;
      busy=true;renderSummary();
      try {
        const payload=expected(),q=await api('/api/booking-groups/quote',{method:'POST',body:payload});await c.loadCredit();
        quote=q;const v=currentVenue();if(!key)key=crypto.randomUUID?crypto.randomUUID():Date.now()+'_'+Math.random().toString(36).slice(2);
        const requestKey=key;
        c.modal({title:'Review your booking',wide:true,locked:true,body:'<p><strong>'+esc(v.name)+'</strong> · '+humanDate(date)+'</p><ul class="vg-review">'+q.selections.map(s=>'<li><strong>'+esc(s.court_name)+'</strong><span>'+humanTime(s.start_time)+' – '+humanTime(s.end_time)+'</span><strong>'+money(s.amount)+'</strong></li>').join('')+'</ul><dl class="summary-list"><div class="summary-row"><dt>Subtotal</dt><dd>'+money(q.base_amount)+'</dd></div><div class="summary-row"><dt>Membership discount</dt><dd>−'+money(q.discount_amount)+'</dd></div><div class="summary-row"><dt>Total</dt><dd><strong>'+money(q.amount)+'</strong></dd></div></dl>'+c.creditHtml(q.amount,'bk-use-credit')+'<p class="field-hint">Player cancellations and no-shows are non-refundable. PIKOL Credit already used is not restored.</p>',confirmText:'Reserve all selected slots',cancelText:'Go back',onConfirm:async h=>{
          const body={...payload,idempotency_key:requestKey,players:Number(document.getElementById('bk-players').value),notes:document.getElementById('bk-notes').value,use_credit:!!h.querySelector('#bk-use-credit')?.checked};
          const booking=await api('/api/booking-groups',{method:'POST',body});clear();document.getElementById('bk-notes').value='';await c.loadBookings();c.loadCredit();c.goto('bookings');
          toast(booking.payment_required?'All selected times are held. Complete one payment before the timer expires.':'Booking confirmed.','success');
          if(booking.payment_required)setTimeout(()=>c.paymentDialog(booking.id),250);
        }});
      }catch(e){toast(e.message,'warning');refresh();}finally{busy=false;renderSummary();}
    }
    host.addEventListener('click',e=>{
      const v=e.target.closest('[data-venue]');if(v){selectVenue(Number(v.dataset.venue));return;}
      const b=e.target.closest('[data-cell]');if(b&&!b.disabled){
        const found=eligible().flatMap(ct=>ct.slots.map(sl=>({court_id:ct.id,court_name:ct.name,start_time:sl.start,end_time:sl.end,price:sl.price,bookable:sl.bookable}))).find(s=>token(s)===b.dataset.cell);
        if(!found?.bookable)return;const k=token(found);if(selection.has(k))selection.delete(k);else selection.set(k,found);key=null;queueQuote();render();return;}
      if(e.target.closest('[data-location]'))global.PikolVenueUI.maps(currentVenue());
      const gallery=e.target.closest('[data-gallery]');if(gallery){const ct=eligible().find(ct=>ct.id===Number(gallery.dataset.gallery));global.PikolVenueUI.gallery(ct,ct.images,c.assetUrl);}
      if(e.target.closest('[data-vg-retry]'))refresh();
    });
    summary.addEventListener('click',e=>{if(e.target.closest('[data-vg-clear]'))clear();});button.onclick=checkout;
    return {refresh,render,changeDate,clear,chooseCourt:id=>{const ct=(data?.courts||[]).find(c=>c.id===Number(id));if(ct)selectVenue(ct.venue_id);else requestedCourt=Number(id);},getData:()=>data};
  }
  global.PikolVenueMatrix={install};
})(window);
