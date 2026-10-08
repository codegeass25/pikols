(function(global){
  'use strict';
  function install(c) {
    const {esc,money,humanTime,humanDate,api,toast}=c,host=document.getElementById('venue-booking');
    let venues=[],venueId=null,data=null,selection=new Map(),quote=null,quoteSerial=0,request=0,date=c.date(),busy=false,key=null,quoteTimer=null,requestedCourt=null;
    host.innerHTML='<section class="vg-booking-section vg-venue-section" aria-labelledby="vg-venue-title"><div class="vg-section-head"><span class="vg-step-number" aria-hidden="true">1</span><div><h2 id="vg-venue-title">Select a Venue</h2><p>Choose a venue to see available courts and times.</p></div></div><div class="vg-carousel"><button class="vg-carousel-arrow vg-carousel-prev" data-carousel="-1" aria-label="Previous venues">‹</button><div class="vg-venues" tabindex="0" role="region" aria-label="Venue carousel. Use left and right arrow keys."></div><button class="vg-carousel-arrow vg-carousel-next" data-carousel="1" aria-label="Next venues">›</button></div></section><section class="vg-booking-section vg-schedule-section" aria-labelledby="vg-schedule-title"><div class="vg-section-head"><span class="vg-step-number" aria-hidden="true">2</span><div><h2 id="vg-schedule-title">Court Schedule</h2><p>Select court times. Click a court name or photo to view its gallery.</p></div><div class="vg-date-host"></div></div><div class="vg-legend" aria-label="Availability legend"><span class="vg-key-available">Available</span><span class="vg-key-selected">Selected</span><span class="vg-key-booked">Booked / Event</span><span class="vg-key-held">Held / Pending</span><span class="vg-key-maintenance">Maintenance</span><span class="vg-key-inactive">Inactive</span><span class="vg-key-past">Unavailable</span></div><div class="vg-matrix-scroll" role="region" tabindex="0" aria-label="Court availability. Scroll horizontally for more courts."></div><div class="vg-selection-live" aria-live="polite"></div></section>';
    const dateHost=host.querySelector('.vg-date-host'),fields=document.querySelector('.vg-date-fields'),calendar=document.querySelector('.booking-calendar-details');
    if(fields){fields.previousElementSibling?.remove();dateHost.append(fields);}if(calendar)dateHost.append(calendar);
    const summary=document.getElementById('summary-list'),button=document.getElementById('btn-confirm');
    function token(s){return s.court_id+':'+s.start_time+':'+s.end_time;}
    function selections(){return [...selection.values()].sort((a,b)=>a.start_time.localeCompare(b.start_time)||a.court_id-b.court_id);}
    function clear(){selection.clear();quote=null;key=null;quoteSerial++;render();}
    function changeDate(next){if(next===date)return true;if(selection.size&&!confirm('Changing date clears your selected court times. Continue?'))return false;clear();date=next;return true;}
    function selectVenue(id){if(id===venueId||venues.find(v=>v.id===id)?.status!=='active')return;if(selection.size&&!confirm('Changing venue clears your selected court times. Continue?'))return;selection.clear();quote=null;key=null;quoteSerial++;clearTimeout(quoteTimer);venueId=id;render();}
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
      summary.innerHTML='<div class="summary-row"><dt>Venue</dt><dd>'+esc(v?.name||'Select venue')+'</dd></div><div class="summary-row"><dt>Date</dt><dd>'+humanDate(date)+'</dd></div><div class="summary-row"><dt>Selections</dt><dd>'+list.length+(list.length===1?' slot':' slots')+' · '+(t.minutes/60)+((t.minutes/60)===1?' court-hour':' court-hours')+'</dd></div>'+'<div class="summary-row summary-subtotal"><dt>Subtotal</dt><dd>'+(list.length?money(t.base):'—')+'</dd></div><div class="summary-row summary-discount"><dt>Membership discount</dt><dd>'+(t.discount>0?'−'+money(t.discount):'—')+'</dd></div><div class="summary-row summary-total"><dt>Total</dt><dd><strong>'+(list.length?money(t.amount):'—')+'</strong></dd></div>'+(list.length?'<button class="btn btn-ghost btn-sm" type="button" data-vg-clear>Clear Selection</button>':'');
      button.textContent='Continue to Checkout →';button.disabled=busy||!list.length;
      host.querySelector('.vg-selection-live').textContent=list.length+' court time'+(list.length===1?'':'s')+' selected';
      document.getElementById('summary-card').classList.toggle('vg-has-selection',!!list.length);
    }
    function render(){
      const v=currentVenue(),rail=host.querySelector('.vg-venues'),left=rail.scrollLeft;
      const focused=document.activeElement,focusKey=focused?.dataset?.cell,focusVenue=focused?.dataset?.venue;
      rail.dataset.count=String(venues.length);
      rail.closest('.vg-carousel').dataset.venueCount=String(venues.length);
      rail.innerHTML=venues.map(v=>{
        const selected=v.id===venueId,photo=v.card_image_url||v.image_url;
        const location=v.location_label||v.address||'View location';
        const mapsURL=global.PikolVenueUI.safeMapsURL(v.maps_url);
        const maps='<button type="button" class="vg-location-action" data-location="'+v.id+'"'+(mapsURL?'':' disabled')+' title="'+esc(mapsURL?'View venue location':'Location not configured')+'"><img class="vg-google-pin" src="assets/booking/maps-pin.svg" alt="" aria-hidden="true" width="20" height="26"><span>'+esc(location)+'</span>'+(mapsURL?'<span aria-hidden="true">↗</span>':'')+'</button>';
        const rates=(v.pricing_summary||[]).map(p=>'<div class="vg-rate-period"><span><strong>'+esc(p.label)+'</strong><small>'+humanTime(p.start)+' – '+humanTime(p.end)+'</small></span><b>'+money(p.min_rate)+(p.max_rate>p.min_rate?'–'+money(p.max_rate):'')+'<em>/hr</em></b></div>').join('');
        const pricing=rates?'<div class="vg-venue-pricing" aria-label="All configured hourly prices">'+rates+'</div>':'<p class="vg-rate-empty">No bookable court rates configured</p>';
        return '<article class="vg-venue'+(selected?' is-selected':'')+'" data-card="'+v.id+'"><button type="button" class="vg-venue-select" data-venue="'+v.id+'" aria-pressed="'+selected+'"'+(v.status==='active'?'':' disabled')+'><span class="vg-venue-photo"><img src="'+esc(global.PikolVenueUI.photoUrl(photo,'venue',c.assetUrl))+'" '+global.PikolVenueUI.fallbackAttr('venue')+' alt="'+esc(photo?v.name+' venue':v.name+' illustrative venue image')+'" width="640" height="360" loading="lazy" decoding="async">'+(!photo?'<span class="vg-image-disclaimer">Illustrative image</span>':'')+'<span class="vg-venue-badge '+(selected?'vg-badge-selected':'')+'">'+(selected?'✓ SELECTED':esc(v.status.toUpperCase()))+'</span></span><span class="vg-venue-copy"><strong>'+esc(v.name)+'</strong><span>'+esc(v.description||v.court_count+' configured courts')+'</span></span></button><div class="vg-venue-meta">'+maps+pricing+'</div></article>';
      }).join('')||'<div class="empty">No current venues. Please contact the club.</div>';
      rail.scrollLeft=left;
      host.querySelector('#vg-schedule-title').textContent='Court Schedule'+(v?' at '+v.name:'');
      const courts=eligible(),rows=new Map();
      host.querySelector('.vg-schedule-section').dataset.courtCount=String(courts.length);courts.forEach(ct=>ct.slots.forEach(sl=>rows.set(sl.start+'|'+sl.end,sl)));
      const times=[...rows.values()].sort((a,b)=>a.start.localeCompare(b.start)||global.PikolAvailability.duration(a.start,a.end)-global.PikolAvailability.duration(b.start,b.end));
      host.querySelector('.vg-matrix-scroll').innerHTML=courts.length?'<table class="vg-matrix" style="--vg-courts:'+courts.length+'"><caption class="sr-only">'+esc(v?.name)+' · '+humanDate(date)+'</caption><colgroup><col class="vg-time-col">'+courts.map(()=>'<col>').join('')+'</colgroup><thead><tr><th class="vg-time" scope="col">Time</th>'+courts.map(ct=>{
        const photo=ct.thumbnail_url||ct.image_url;
        return '<th scope="col"><button class="vg-court-header" data-gallery="'+ct.id+'" aria-label="View photos of '+esc(ct.name)+'"><img src="'+esc(global.PikolVenueUI.photoUrl(photo,'court',c.assetUrl))+'" '+global.PikolVenueUI.fallbackAttr('court')+' width="96" height="64" loading="lazy" alt=""><span><strong>'+esc(ct.name)+' <span class="vg-gallery-icon" aria-hidden="true">▧</span></strong><small>'+esc(ct.description||ct.surface||'Court photos')+'</small></span></button></th>';
      }).join('')+'</tr></thead><tbody>'+times.map(sl=>'<tr><th class="vg-time" scope="row"><span>'+humanTime(sl.start)+'</span><small>'+humanTime(sl.end)+'</small></th>'+courts.map(ct=>{
        const cell=ct.slots.find(s=>s.start===sl.start&&s.end===sl.end),s={court_id:ct.id,start_time:sl.start,end_time:sl.end},selected=selection.has(token(s)),status=selected?'selected':cell?.status||'unconfigured';
        const allowed=!!cell?.bookable&&ct.status==='active'&&v?.status==='active';
        const labels={available:'Available',selected:'✓ Selected',booked:'Booked',held:'Held / Pending',pending:'Pending',maintenance:'Maintenance',inactive:'Inactive',past:'Unavailable',unconfigured:'Unavailable',blocked:'Blocked'};
        const label=labels[status]||cell?.status_label||'Unavailable';
        return '<td><button class="vg-cell vg-'+esc(status)+'" data-cell="'+esc(token(s))+'" aria-pressed="'+selected+'" aria-label="'+esc(ct.name)+' '+humanTime(sl.start)+' to '+humanTime(sl.end)+', '+esc(label)+(allowed?', '+money(cell.price):'')+'" title="'+esc(label)+(allowed?' · '+money(cell.price):'')+'"'+(allowed?'':' disabled')+'><span>'+esc(label)+'</span></button></td>';
      }).join('')+'</tr>').join('')+'</tbody></table>':'<div class="empty"><strong>No configured courts</strong>Choose another venue or ask staff to configure its courts.</div>';
      if(courts.length&&!times.length)host.querySelector('.vg-matrix-scroll').innerHTML='<div class="empty">No time slots are configured for this venue.</div>';
      renderSummary();
      if(focusKey)host.querySelector('[data-cell="'+focusKey+'"]')?.focus({preventScroll:true});
      if(focusVenue)host.querySelector('[data-venue="'+focusVenue+'"]')?.focus({preventScroll:true});
    }
    function moveCarousel(direction){const rail=host.querySelector('.vg-venues'),card=rail.querySelector('.vg-venue');rail.scrollBy({left:direction*((card?.getBoundingClientRect().width||300)+16),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
    const rail=host.querySelector('.vg-venues');
    rail.addEventListener('keydown',e=>{if(e.target.closest('[data-location]'))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();moveCarousel(e.key==='ArrowLeft'?-1:1);}});
    rail.addEventListener('wheel',e=>{if(e.shiftKey&&Math.abs(e.deltaY)>Math.abs(e.deltaX)){e.preventDefault();rail.scrollLeft+=e.deltaY;}},{passive:false});
    async function refresh(){
      const ticket=++request,newDate=c.date();
      if(!changeDate(newDate)){c.setDate(date);return;}
      host.setAttribute('aria-busy','true');button.disabled=true;
      try {
        const [vs,availability]=await Promise.all([api('/api/venues'),api('/api/availability?date='+encodeURIComponent(date))]);
        if(ticket!==request)return;venues=vs;data=availability;c.received(data);c.scheduleExpiry(data);
        if(requestedCourt!==null){const target=data.courts.find(ct=>ct.id===requestedCourt);requestedCourt=null;if(target&&venues.some(v=>v.id===target.venue_id))selectVenue(target.venue_id);}
        if(!venues.some(v=>v.id===venueId&&v.status==='active')){venueId=venues.find(v=>v.status==='active')?.id||null;selection.clear();}
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
        c.modal({title:'Review your booking',wide:true,locked:true,body:'<p><strong>'+esc(v.name)+'</strong> · '+humanDate(date)+'</p><ul class="vg-review">'+q.selections.map(s=>'<li><strong>'+esc(s.court_name)+'</strong><span>'+humanTime(s.start_time)+' – '+humanTime(s.end_time)+'</span><strong>'+money(s.amount)+'</strong></li>').join('')+'</ul><dl class="summary-list"><div class="summary-row"><dt>Subtotal</dt><dd>'+money(q.base_amount)+'</dd></div><div class="summary-row"><dt>Membership discount</dt><dd>'+(Number(q.discount_amount)>0?'−'+money(q.discount_amount):'—')+'</dd></div><div class="summary-row"><dt>Total</dt><dd><strong>'+money(q.amount)+'</strong></dd></div></dl>'+c.creditHtml(q.amount,'bk-use-credit')+'<p class="field-hint">Player cancellations and no-shows are non-refundable. PIKOL Credit already used is not restored.</p>',confirmText:'Reserve all selected slots',cancelText:'Go back',onConfirm:async h=>{
          const body={...payload,idempotency_key:requestKey,players:Number(document.getElementById('bk-players').value),notes:document.getElementById('bk-notes').value,use_credit:!!h.querySelector('#bk-use-credit')?.checked};
          const booking=await api('/api/booking-groups',{method:'POST',body});clear();document.getElementById('bk-notes').value='';await c.loadBookings();c.loadCredit();c.goto('bookings');
          toast(booking.payment_required?'All selected times are held. Complete one payment before the timer expires.':'Booking confirmed.','success');
          if(booking.payment_required)setTimeout(()=>c.paymentDialog(booking.id),250);
        }});
      }catch(e){toast(e.message,'warning');refresh();}finally{busy=false;renderSummary();}
    }
    host.addEventListener('click',e=>{
      const locationButton=e.target.closest('[data-location]');if(locationButton){const venue=venues.find(v=>v.id===Number(locationButton.dataset.location));if(venue)global.PikolVenueUI.maps(venue);return;}
      const arrow=e.target.closest('[data-carousel]');if(arrow){moveCarousel(Number(arrow.dataset.carousel));return;}
      const v=e.target.closest('[data-venue]');if(v){selectVenue(Number(v.dataset.venue));return;}
      const b=e.target.closest('[data-cell]');if(b&&!b.disabled){
        const found=eligible().flatMap(ct=>ct.slots.map(sl=>({court_id:ct.id,court_name:ct.name,start_time:sl.start,end_time:sl.end,price:sl.price,bookable:sl.bookable}))).find(s=>token(s)===b.dataset.cell);
        if(!found?.bookable)return;const k=token(found);if(selection.has(k))selection.delete(k);else selection.set(k,found);key=null;queueQuote();render();return;}
      const card=e.target.closest('[data-card]');if(card&&!e.target.closest('[data-venue]')){selectVenue(Number(card.dataset.card));return;}
      const gallery=e.target.closest('[data-gallery]');if(gallery){const ct=eligible().find(ct=>ct.id===Number(gallery.dataset.gallery));global.PikolVenueUI.gallery(ct,ct.images,c.assetUrl);}
      if(e.target.closest('[data-vg-retry]'))refresh();
    });
    summary.addEventListener('click',e=>{if(e.target.closest('[data-vg-clear]'))clear();});button.onclick=checkout;
    return {refresh,render,changeDate,clear,chooseCourt:id=>{const ct=(data?.courts||[]).find(c=>c.id===Number(id));if(ct)selectVenue(ct.venue_id);else requestedCourt=Number(id);},getData:()=>data};
  }
  global.PikolVenueMatrix={install};
})(window);
