(function(){
  'use strict';
  const root='/api/admin/bookings/counter';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const option=(value,text)=>'<option value="'+esc(value)+'">'+esc(text)+'</option>';
  const control=(id,title,input)=>'<div class="field"><label class="label" for="'+id+'">'+title+'</label>'+input+'</div>';
  const select=(id,options)=>'<select class="select" id="'+id+'">'+options+'</select>';
  const button=(id,text,primary=false)=>'<button type="button" id="'+id+'" class="btn '+(primary?'btn-primary':'btn-outline')+'">'+text+'</button>';
  const time=stamp=>stamp?new Intl.DateTimeFormat('en-PH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Manila'}).format(new Date(stamp))+' Manila time':'';
  const amount=(value,currency)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:currency||'PHP'}).format(Number(value));
  const newKey=()=>Array.from(crypto.getRandomValues(new Uint8Array(18)),b=>b.toString(16).padStart(2,'0')).join('');
  const can=(user,kind)=>!!user&&(user.role==='admin'||user.staff_permissions?.includes(kind==='extension'?'extend':'walkin')||
    (!user.staff_permissions&&user[kind==='extension'?'can_extend_booking':'can_walkin_book']));
  const canVerify=user=>!!user&&(user.role==='admin'||user.staff_permissions?.includes('verify_counter_payments')||
    (!user.staff_permissions&&(user.can_walkin_book||user.can_extend_booking)));
  const slotKey=slot=>[slot.court_id,slot.start_time,slot.end_time].join(':');
  function slotGrid(slots,selected) {
    const courts=[...new Map(slots.map(s=>[s.court_id,s.court_name]))];
    const times=[...new Map(slots.map(s=>[s.start_time+'–'+s.end_time,s])).keys()].sort();
    const bySlot=new Map(slots.map(s=>[slotKey(s),s]));
    return '<div class="counter-slot-grid" tabindex="0" role="region" aria-label="Court availability. Scroll for more courts.">'+
      '<table><caption>Select one or more available slots</caption><thead><tr><th scope="col">Time</th>'+
      courts.map(([,name])=>'<th scope="col">'+esc(name)+'</th>').join('')+'</tr></thead><tbody>'+
      times.map(range=>'<tr><th scope="row">'+esc(range)+'</th>'+courts.map(([id,name])=>{
        const [start,end]=range.split('–'),key=[id,start,end].join(':'),s=bySlot.get(key);
        return '<td>'+(s?'<button type="button" data-counter-slot="'+esc(key)+'" aria-label="'+esc(name+' '+range)+
          '" aria-pressed="'+selected.has(key)+'">'+(selected.has(key)?'Selected':'Available')+'</button>':'<span aria-label="Unavailable">—</span>')+'</td>';
      }).join('')+'</tr>').join('')+'</tbody></table></div>';
  }
  function safeImage(value){
    try{
      const url=new URL(value,location.href);
      return ['https:','http:'].includes(url.protocol)?url.href:'';
    }catch{return '';}
  }
  function init({api,modal,toast,getUser,onChange}){
    const get=(path,params)=>api(root+path+(params?'?'+new URLSearchParams(params):''));
    const post=(path,body)=>api(root+path,{method:'POST',body});
    const renderRow=(name,value)=>'<dt>'+esc(name)+'</dt><dd>'+esc(value)+'</dd>';
    const info=(row)=>'<dl class="counter-summary">'+renderRow('Customer',row.customer_name+' · '+(row.customer_type==='guest'?'Guest (No Account)':'Registered Player'))+
      renderRow('Schedule',row.venue_name+' · '+(row.segments?.length?row.segments.length+' slots':row.court_name+' · '+row.date+' '+row.start_time+'–'+row.end_time))+
      renderRow('Booking reference',row.reference)+renderRow('Full amount',amount(row.amount,row.currency))+
      renderRow('Method',row.method_label)+renderRow('Status',row.paid?'Paid · '+row.status:row.resolution||row.status)+
      (row.source_reference?renderRow('Original booking',row.source_reference):'')+
      (row.verified_at?renderRow('Verified by',row.verifier+' · '+time(row.verified_at)):'')+
      (row.received!=null?renderRow('Cash tender / change',amount(row.received,row.currency)+' / '+amount(row.change,row.currency)):'')+'</dl>'+
      (row.segments?.length?'<ul class="counter-slot-summary">'+row.segments.map(s=>'<li>'+esc(s.court_name+' · '+s.booking_date+' '+s.start_time+'–'+s.end_time)+' · '+esc(amount(s.amount,row.currency))+'</li>').join('')+'</ul>':'');
    const showError=error=>toast(error.message,'error');
    function bind(host,id,fn){host.querySelector('#'+id).addEventListener('click',fn);}
    async function locked(btn,fn){
      if(btn.disabled)return;
      btn.disabled=true;
      try{await fn();}catch(error){showError(error);}
      finally{if(btn.isConnected)btn.disabled=false;}
    }
    function print(id){
      const page=window.open('','_blank','width=650,height=700');
      if(!page){toast('Allow pop-ups to print the payment acknowledgment.','error');return;}
      page.opener=null;
      get('/'+id+'/acknowledgment').then(row=>{
        page.document.open();
        page.document.write('<!doctype html><html lang="en"><meta charset="utf-8"><title>PIKOL payment acknowledgment</title><style>body{font:16px system-ui;margin:2rem}dt{font-weight:bold}dd{margin:0 0 1rem}</style><h1>PIKOL payment acknowledgment</h1>'+
          info(row)+'<p>Generated from the PIKOL payment ledger.</p></html>');
        page.document.close();page.focus();page.print();
      }).catch(error=>{page.close();showError(error);});
    }
    function success(row){
      const host=modal({title:row.paid?'Booking Confirmed · Payment Paid':'Counter Booking',body:'<div class="counter-flow">'+info(row)+
        '<div class="counter-actions">'+button('counter-view','View Booking')+button('counter-print','Print Payment Acknowledgment',true)+'</div></div>'});
      bind(host,'counter-print',()=>print(row.id));
      bind(host,'counter-view',()=>get('/'+row.id+'/acknowledgment').then(data=>modal({title:'Booking · '+data.reference,body:info(data)})).catch(showError));
    }
    function payment(row){
      if(row.settled||row.paid){success(row);return;}
      if(row.status!=='checkout_hold'){resolve(row);return;}
      const dest=row.destination,cash=row.method==='cash';
      const destination=dest&&!cash?'<section class="counter-destination"><h3>Official receiving account</h3><p><strong>'+
        esc(dest.account_name||dest.label)+'</strong> '+esc(dest.account_number)+'</p><p>'+esc(dest.instructions)+'</p>'+
        (dest.images||[]).map(safeImage).filter(Boolean).map(url=>'<img src="'+esc(url)+'" alt="Official '+esc(dest.label)+' payment QR or instructions">').join('')+'</section>':'';
      const host=modal({title:'Counter payment · '+row.reference,wide:true,locked:true,body:'<div class="counter-flow">'+info(row)+
        '<p id="counter-timer" class="counter-notice"></p><div id="counter-verification">'+destination+
        (!dest?'<p class="counter-notice">The receiving account changed. Release this hold and reconcile any funds already received.</p>':
        (cash?control('counter-tender','Cash received','<input class="input" id="counter-tender" type="number" min="'+row.amount+'" step="0.01" inputmode="decimal" value="'+row.amount+'"><p id="counter-change" aria-live="polite"></p>'):
          '<p>Check the actual receiving account. Confirm only after the full amount has been credited.</p>'+
          control('counter-transfer','Transfer reference (optional)','<input class="input" id="counter-transfer" maxlength="100" autocomplete="off">'))+
        '<label class="counter-check"><input type="checkbox" id="counter-attest">'+
          (cash?'I physically received the full cash payment.':'I verified that the full payment was credited to the official receiving account.')+'</label>')+
        '</div><p id="counter-expiry-message" role="status"></p><div class="counter-actions">'+
        button('counter-release','Cancel checkout')+
        button('counter-confirm','Verify Payment &amp; Confirm Booking',true)+'</div></div>'});
      const $=id=>host.querySelector('#'+id),confirm=$('counter-confirm'),ack=$('counter-attest'),tender=$('counter-tender');
      const deadline=performance.now()+Math.max(0,Date.parse(row.expires_at)-row.server_now);
      let sending=false,timer;
      function sync(){
        if(!host.isConnected){clearInterval(timer);return;}
        const left=Math.max(0,Math.ceil((deadline-performance.now())/1000));
        const received=tender?.valueAsNumber;
        $('counter-timer').textContent=left?'Time to pay · '+Math.floor(left/60)+'m '+String(left%60).padStart(2,'0')+'s remaining':'Reservation expired';
        if(tender)$('counter-change').textContent=Number.isFinite(received)&&received>=row.amount?'Change '+amount(received-row.amount,row.currency):'Receive at least the full fee.';
        confirm.disabled=sending||!left||!ack?.checked||!dest||!canVerify(getUser())||(cash&&(!Number.isFinite(received)||received<row.amount));
        $('counter-release').disabled=sending||!left;
        if(!left){
          $('counter-verification').hidden=true;
          $('counter-expiry-message').textContent='If funds arrived, go to Payments → Issues to reconcile them.';
          clearInterval(timer);
        }
      }
      ack?.addEventListener('change',sync);tender?.addEventListener('input',sync);
      timer=setInterval(sync,1000);sync();
      bind(host,'counter-confirm',async()=>{
        if(confirm.disabled)return;
        sending=true;sync();
        try{
          const verified=await post('/'+row.id+'/verify-and-confirm',{
            verified_received:ack.checked,verified_amount:row.amount,
            ...(cash?{cash_received:tender.valueAsNumber}:{transfer_reference:$('counter-transfer').value.trim()})
          });
          host.remove();onChange();success(verified);
        }catch(error){
          $('counter-expiry-message').textContent=error.message;
          // A lost response is safe to retry with the same checkout.
          try{
            const fresh=await get('/'+row.id+'/hold');
            if(fresh.settled||fresh.status!=='checkout_hold'||!fresh.destination){host.remove();payment(fresh);}
          }catch(_){}
        }finally{sending=false;sync();}
      });
      bind(host,'counter-release',async e=>{
        if(!window.confirm('Cancel this checkout? Only cancel here if no funds were received.'))return;
        await locked(e.currentTarget,async()=>{
          await post('/'+row.id+'/cancel',{});
          host.remove();onChange();toast('Checkout cancelled.','success');
        });
      });
    }
    async function form(kind,sourceId,previous){
      const config=await get('/config',{kind});
      const extension=kind==='extension';
      const host=modal({title:extension?'Extend Booking':'Walk-In Booking',wide:true,body:'<div class="counter-flow">'+
        (previous?'<p class="counter-notice">Rebook '+esc(previous.customer_name)+' using funds from '+esc(previous.reference)+'. Keep the same receiving account and amount.</p>':'')+
        (!extension&&!previous?control('counter-type','Customer type',select('counter-type',option('guest','Guest (No Account)')+option('registered','Registered Player')))+
          '<div id="counter-guest">'+control('counter-name','Guest full name','<input class="input" id="counter-name" maxlength="120" autocomplete="off">')+
          control('counter-contact','Guest contact (optional)','<input class="input" id="counter-contact" maxlength="50" autocomplete="off">')+'</div>'+
          '<div id="counter-player-box" hidden>'+control('counter-search','Search active players','<input class="input" id="counter-search" autocomplete="off">')+
          button('counter-find','Search')+control('counter-player','Registered player',select('counter-player',option('','Select a player')))+
          '<label class="counter-check"><input type="checkbox" id="counter-identity"> I confirmed this player’s identity.</label></div>':'')+
        (!extension&&!previous?'<div class="counter-grid">'+control('counter-venue','Venue',select('counter-venue',option('','Choose venue')+config.venues.map(v=>option(v.id,v.name)).join('')))+
          control('counter-date','Date','<input class="input" id="counter-date" type="date" min="'+esc(config.date)+'" value="'+esc(config.date)+'">')+
          control('counter-players','Players','<input class="input" id="counter-players" type="number" min="1" max="'+config.maximum_players+'" value="2" inputmode="numeric">')+'</div>':'')+
        '<p id="counter-original" role="status"></p><div id="counter-slots"></div>'+
        control('counter-method','Payment method',select('counter-method',config.methods.map((m,i)=>option(i,m.label)).join('')))+
        '<p id="counter-quote-value" class="counter-notice" role="status">Select court times to calculate the full amount.</p>'+
        '<div id="counter-cash-fields">'+
        control('counter-cash-tender','Cash received','<input class="input" id="counter-cash-tender" type="number" min="0" step="0.01" inputmode="decimal">')+
        '<p id="counter-cash-change" aria-live="polite"></p>'+
        '<label class="counter-check"><input type="checkbox" id="counter-cash-attest"> I physically received the full cash payment.</label></div>'+
        '<div class="counter-actions">'+button('counter-submit','Confirm booking',true)+'</div></div>'});
      const $=id=>host.querySelector('#'+id);
      let schedule=null,quote=null,key,request=0,quoteSerial=0,quoteTimer=null,sending=false,refreshing=false;
      const selection=new Map();
      if(previous){
        const index=config.methods.findIndex(m=>m.key===previous.method&&m.option_id===(previous.option_id??null)&&m.label===previous.method_label);
        if(index>=0)$('counter-method').value=String(index);
      }
      function syncPayment(){
        const method=config.methods[Number($('counter-method').value)],cash=method?.key==='cash';
        const immediate=cash&&canVerify(getUser()),tender=$('counter-cash-tender').valueAsNumber;
        $('counter-cash-fields').hidden=!immediate;
        $('counter-submit').textContent=immediate?'Verify cash & Confirm booking':'Continue to payment';
        $('counter-submit').disabled=sending||!quote||(immediate&&(!$('counter-cash-attest').checked||
          !Number.isFinite(tender)||tender<quote.result.amount));
        $('counter-cash-change').textContent=quote&&Number.isFinite(tender)&&tender>=quote.result.amount?
          'Change '+amount(tender-quote.result.amount,quote.result.currency):'';
      }
      function invalidate(){
        quote=null;key=null;quoteSerial++;clearTimeout(quoteTimer);syncPayment();
        $('counter-quote-value').textContent=selection.size?'Calculating the full amount…':'Select court times to calculate the full amount.';
        quoteTimer=setTimeout(updateQuote,180);
      }
      async function updateQuote(){
        const serial=++quoteSerial;
        let body;
        try{body=input();}catch(error){$('counter-quote-value').textContent=error.message;return;}
        try{
          const result=await post('/quote',body);
          if(serial!==quoteSerial||!host.isConnected)return;
          quote={body,result};key=newKey();
          $('counter-quote-value').textContent=result.customer_name+' · '+result.selections.length+' selected slots · Full amount '+amount(result.amount,result.currency);
          syncPayment();
        }catch(error){if(serial===quoteSerial&&host.isConnected){quote=null;$('counter-quote-value').textContent=error.message;syncPayment();}}
      }
      async function slots(keep=false){
        if(keep&&refreshing)return;
        refreshing=true;
        const n=++request;
        if(!keep){selection.clear();invalidate();schedule=null;$('counter-slots').textContent='';}
        const params={kind};
        if(extension)params.source_id=sourceId;
        else if(previous)params.recovery_id=previous.id;
        else{
          if(!$('counter-venue').value||!$('counter-date').value){refreshing=false;return;}
          params.venue_id=$('counter-venue').value;params.date=$('counter-date').value;
        }
        try{
          const result=await get('/slots',params);
          if(n!==request||!host.isConnected)return;
          const same=keep&&JSON.stringify(result.slots)===JSON.stringify(schedule?.slots);
          const available=new Map(result.slots.map(s=>[slotKey(s),s]));
          let changed=false;
          for(const key of selection.keys())if(!available.has(key)){selection.delete(key);changed=true;}
          if(changed||!keep)invalidate();
          schedule=result;
          if(same)return;
          if(extension)$('counter-original').textContent=result.source_reference+' · '+result.customer_name+' · '+result.venue.name+' · '+result.date+'. Waiting gaps stay available for other bookings.';
          $('counter-slots').innerHTML=result.slots.length?slotGrid(result.slots,selection):'<p>No available slots for this date and venue.</p>';
        }finally{if(n===request)refreshing=false;}
      }
      function input(){
        if(!schedule?.slots.length||!selection.size)throw Error('Select one or more available court times.');
        const out={kind,...(previous?{recovery_id:previous.id}:{})};
        out.selections=[...selection.values()].map(({court_id,start_time,end_time})=>({court_id,start_time,end_time}))
          .sort((a,b)=>a.start_time.localeCompare(b.start_time)||a.court_id-b.court_id);
        if(extension)return {...out,source_id:sourceId};
        Object.assign(out,{venue_id:schedule.venue.id,date:schedule.date});
        if(!previous){
          out.players=$('counter-players').valueAsNumber;
          if($('counter-type').value==='registered'){
            if(!$('counter-identity').checked||!Number($('counter-player').value))throw Error('Select a real player and confirm their identity.');
            out.customer={type:'registered',user_id:Number($('counter-player').value)};
          }else{
            const name=$('counter-name').value.trim();
            if(name.length<2)throw Error('Enter the guest’s full name.');
            out.customer={type:'guest',name,contact:$('counter-contact').value.trim()};
          }
        }
        return out;
      }
      if(!extension&&!previous){
        $('counter-type').onchange=()=>{
          const guest=$('counter-type').value==='guest';
          $('counter-guest').hidden=!guest;$('counter-player-box').hidden=guest;invalidate();
        };
        bind(host,'counter-find',e=>locked(e.currentTarget,async()=>{
          const q=$('counter-search').value.trim();
          if(q.length<2)throw Error('Enter at least two letters or digits.');
          const results=await get('/players',{q});
          $('counter-player').innerHTML=option('',results.length?'Select a player':'No active players found')+
            results.map(p=>option(p.id,p.full_name+' · '+p.email)).join('');
          $('counter-identity').checked=false;invalidate();
        }));
        $('counter-search').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('counter-find').click();}};
        $('counter-player').onchange=()=>{$('counter-identity').checked=false;invalidate();};
        for(const id of ['counter-name','counter-contact','counter-players','counter-identity'])$(id).addEventListener('input',invalidate);
        $('counter-venue').onchange=$('counter-date').onchange=()=>slots().catch(showError);
      }
      host.querySelector('#counter-slots').addEventListener('click',event=>{
        const button=event.target.closest('[data-counter-slot]');
        if(!button||sending)return;
        const key=button.dataset.counterSlot,s=schedule.slots.find(s=>slotKey(s)===key);
        if(!s)return;
        if(selection.has(key))selection.delete(key);else selection.set(key,s);
        button.setAttribute('aria-pressed',String(selection.has(key)));
        button.textContent=selection.has(key)?'Selected':'Available';
        invalidate();
      });
      $('counter-method').onchange=syncPayment;
      $('counter-cash-tender').oninput=$('counter-cash-attest').onchange=syncPayment;
      bind(host,'counter-submit',async()=>{
        if(!quote||sending)return;
        const method=config.methods[Number($('counter-method').value)],cash=method.key==='cash'&&canVerify(getUser());
        const requestKey=key;
        const body={...quote.body,quote_token:quote.result.quote_token,idempotency_key:requestKey,payment_method:method.key,option_id:method.option_id};
        sending=true;syncPayment();
        try{
          const out=await post(cash?'/checkout':'/hold',cash?{...body,verified_received:$('counter-cash-attest').checked,
            verified_amount:quote.result.amount,cash_received:$('counter-cash-tender').valueAsNumber}:body);
          host.remove();onChange();if(out.paid)success(out);else payment(out);
        }catch(error){
          if(!error.status){
            try{
              const recovered=await get('/checkout-status',{kind,key:requestKey});
              if(recovered){host.remove();onChange();payment(recovered);return;}
            }catch(_){}
          }
          showError(error);
          if(error.status===409){await slots(true).catch(showError);invalidate();}
        }
        finally{sending=false;if(host.isConnected)syncPayment();}
      });
      function refreshAvailability(){if(host.isConnected&&!document.hidden&&!sending)slots(true).catch(showError);}
      document.addEventListener('pikol:availability',refreshAvailability);
      window.addEventListener('pikol:availability',refreshAvailability);
      const timer=setInterval(()=>{
        if(!host.isConnected){clearInterval(timer);clearTimeout(quoteTimer);document.removeEventListener('pikol:availability',refreshAvailability);window.removeEventListener('pikol:availability',refreshAvailability);return;}
        refreshAvailability();
      },20000);
      invalidate();await slots();
    }
    function resolve(row){
      const admin=getUser()?.role==='admin';
      const host=modal({title:'Payment recovery · '+row.reference,body:'<div class="counter-flow">'+info(row)+
        '<p>Verify whether funds arrived for this expired or cancelled checkout. Rebook available slots using the same customer, amount and receiving account, or record a completed external refund.</p>'+
        control('counter-note','Reconciliation note','<textarea class="textarea" id="counter-note" maxlength="400"></textarea>')+
        '<label class="counter-check"><input type="checkbox" id="counter-received"> I confirmed the funds actually arrived.</label>'+
        '<div class="counter-actions">'+button('counter-review','Flag for Management')+
        (admin?button('counter-refund','Record Completed External Refund'):'')+button('counter-rebook','Requote a Free Slot',true)+'</div></div>'});
      const save=resolution=>async e=>locked(e.currentTarget,async()=>{
        if(resolution==='refunded'&&!window.confirm('Record only a refund that was actually returned outside PIKOL. Continue?'))return;
        await post('/'+row.id+'/reconcile',{resolution,note:host.querySelector('#counter-note').value,verified_received:host.querySelector('#counter-received').checked});
        host.remove();onChange();toast('Reconciliation recorded.','success');
      });
      bind(host,'counter-review',save('review'));
      if(admin)bind(host,'counter-refund',save('refunded'));
      bind(host,'counter-rebook',()=>{host.remove();form(row.kind,row.source_id,row).catch(showError);});
    }
    async function renderIssues(target,status){
      try{
        target.hidden=!['issues','for_review'].includes(status);
        if(target.hidden)return;
        const kinds=['walk_in','extension'].filter(k=>can(getUser(),k)||canVerify(getUser()));
        const rows=(await Promise.all(kinds.map(kind=>get('/holds',{kind,issues:status==='issues'?'1':'0'})))).flat();
        if(!target.isConnected)return;
        const visible=rows.filter(row=>status==='issues'?row.status!=='checkout_hold'||row.resolution==='review':
          row.status==='checkout_hold'&&row.resolution!=='review');
        target.innerHTML='<h3 class="section-title">'+(status==='issues'?'Counter payment recovery':'Counter payments awaiting verification')+'</h3>'+
          '<p class="tiny muted">'+(status==='issues'?'Review funds received for an expired or cancelled checkout.':'Confirm only after the full funds arrived.')+'</p>'+
          (visible.length?visible.map(row=>'<div class="counter-hold-row"><div><strong>'+esc(row.reference)+' · '+esc(row.customer_name)+'</strong><p>'+
            esc(row.venue_name+' · '+row.date+' · '+amount(row.amount,row.currency)+' · '+(row.resolution||row.status))+'</p></div>'+
            '<button type="button" class="btn btn-outline" data-counter-resume="'+row.id+'">'+(row.status==='checkout_hold'?'Review payment':'Reconcile')+'</button></div>').join(''):
            '<p class="tiny muted">No counter payments need attention.</p>');
        target.onclick=e=>{
          const b=e.target.closest('[data-counter-resume]');
          if(b)locked(b,async()=>payment(await get('/'+b.dataset.counterResume+'/hold')));
        };
      }catch(error){showError(error);}
    }
    async function adjustPayment(id){
      const row=await get('/'+id+'/acknowledgment');
      modal({title:'Refund / Void',confirmText:'Record resolution',danger:true,body:'<div class="counter-flow">'+info(row)+
        control('counter-adjust-type','Resolution','<select class="select" id="counter-adjust-type"><option value="">Choose a resolution</option><option value="refunded">Full refund already completed outside PIKOL</option><option value="voided">Payment was never received after independent verification</option></select>')+
        control('counter-adjust-note','Reconciliation note','<textarea class="textarea" id="counter-adjust-note" maxlength="400"></textarea>')+
        '<label class="counter-check"><input type="checkbox" id="counter-adjust-confirm"> I verified this resolution for the full amount and understand that it cancels this booking.</label></div>',
        onConfirm:async host=>{
          await post('/'+id+'/adjust-payment',{resolution:host.querySelector('#counter-adjust-type').value,amount:row.amount,
            confirmed:host.querySelector('#counter-adjust-confirm').checked,note:host.querySelector('#counter-adjust-note').value});
          onChange();toast('Counter payment adjustment recorded.','success');
        }});
    }
    async function extensionPicker(){
      const host=modal({title:'Select a booking to extend',wide:true,body:control('counter-extension-search','Find today’s booking',
        '<input class="input" id="counter-extension-search" placeholder="Customer name or booking reference" autocomplete="off">')+
        '<div id="counter-extension-sources" aria-live="polite"></div>'});
      const input=host.querySelector('#counter-extension-search'),list=host.querySelector('#counter-extension-sources');
      let serial=0,timer;
      async function load(){
        const request=++serial;
        const rows=await get('/extension-sources',{q:input.value.trim()});
        if(request!==serial||!host.isConnected)return;
        list.innerHTML=rows.length?rows.map(row=>'<button class="counter-source" type="button" data-source="'+row.id+'"><strong>'+
          esc(row.customer_name)+' · '+esc(row.reference)+'</strong><span>'+esc(row.venue_name+' · '+row.court_name+' '+row.start_time+'–'+row.end_time)+'</span></button>').join(''):
          '<p>No eligible bookings for today match this search.</p>';
      }
      input.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>load().catch(showError),200);};
      list.onclick=event=>{const button=event.target.closest('[data-source]');if(button){host.remove();form('extension',Number(button.dataset.source)).catch(showError);}};
      await load();
    }
    function newBooking(){
      const host=modal({title:'New Booking',body:'<div class="counter-actions">'+
        (can(getUser(),'walk_in')?button('counter-new-walk','Walk-In',true):'')+
        (can(getUser(),'extension')?button('counter-new-extension','Extend'):'')+'</div>'});
      host.querySelector('#counter-new-walk')?.addEventListener('click',()=>{host.remove();form('walk_in').catch(showError);});
      host.querySelector('#counter-new-extension')?.addEventListener('click',()=>{host.remove();extensionPicker().catch(showError);});
    }
    window.PikolCounter.renderIssues=renderIssues;
    document.addEventListener('click',e=>{
      if(e.target.closest('#btn-new-booking'))newBooking();
      const paymentButton=e.target.closest('[data-counter-payment]');
      if(paymentButton)get('/'+Number(paymentButton.dataset.counterPayment)+'/hold').then(payment).catch(showError);
      const extend=e.target.closest('[data-counter-extend]');
      if(extend)form('extension',Number(extend.dataset.counterExtend)).catch(showError);
      const ack=e.target.closest('[data-counter-print]');
      if(ack)print(Number(ack.dataset.counterPrint));
      const adjustment=e.target.closest('[data-counter-adjust]');
      if(adjustment)adjustPayment(Number(adjustment.dataset.counterAdjust)).catch(showError);
    });
  }
  window.PikolCounter={init,can};
})();
