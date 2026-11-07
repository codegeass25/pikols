(function(){
  'use strict';
  const root='/api/admin/bookings/counter';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label={direct:'Direct · same court',alternate_court:'Immediate · alternate court',later_slot:'Later · wait'};
  const option=(value,text)=>'<option value="'+esc(value)+'">'+esc(text)+'</option>';
  const control=(id,title,input)=>'<div class="field"><label class="label" for="'+id+'">'+title+'</label>'+input+'</div>';
  const select=(id,options)=>'<select class="select" id="'+id+'">'+options+'</select>';
  const button=(id,text,primary=false)=>'<button type="button" id="'+id+'" class="btn '+(primary?'btn-primary':'btn-outline')+'">'+text+'</button>';
  const time=stamp=>stamp?new Intl.DateTimeFormat('en-PH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Manila'}).format(new Date(stamp))+' Manila time':'';
  const amount=(value,currency)=>new Intl.NumberFormat('en-PH',{style:'currency',currency:currency||'PHP'}).format(Number(value));
  const newKey=()=>Array.from(crypto.getRandomValues(new Uint8Array(18)),b=>b.toString(16).padStart(2,'0')).join('');
  const can=(user,kind)=>!!user&&['admin','booking_manager'].includes(user.role)&&Boolean(user[kind==='extension'?'can_extend_booking':'can_walkin_book']);
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
      renderRow('Schedule',row.venue_name+' · '+row.court_name+' · '+row.date+' '+row.start_time+'–'+row.end_time)+
      renderRow('Booking reference',row.reference)+renderRow('Full amount',amount(row.amount,row.currency))+
      renderRow('Method',row.method_label)+renderRow('Status',row.paid?'Paid · '+row.status:row.resolution||row.status)+
      (row.source_reference?renderRow('Original booking',row.source_reference):'')+
      (row.verified_at?renderRow('Verified by',row.verifier+' · '+time(row.verified_at)):'')+
      (row.received!=null?renderRow('Cash tender / change',amount(row.received,row.currency)+' / '+amount(row.change,row.currency)):'')+'</dl>';
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
      const host=modal({title:'Counter payment · '+row.reference,wide:true,body:'<div class="counter-flow">'+info(row)+
        '<p id="counter-timer" class="counter-notice"></p><div id="counter-verification">'+destination+
        (!dest?'<p class="counter-notice">The receiving account changed. Release this hold and reconcile any funds already received.</p>':
        (cash?control('counter-tender','Cash received','<input class="input" id="counter-tender" type="number" min="'+row.amount+'" step="0.01" inputmode="decimal" value="'+row.amount+'"><p id="counter-change" aria-live="polite"></p>'):
          '<p>Check the actual receiving account. Confirm only after the full amount has been credited.</p>'+
          control('counter-transfer','Transfer reference (optional)','<input class="input" id="counter-transfer" maxlength="100" autocomplete="off">'))+
        '<label class="counter-check"><input type="checkbox" id="counter-attest">'+
          (cash?'I physically received the full cash payment.':'I verified that the full payment was credited to the official receiving account.')+'</label>')+
        '</div><p id="counter-expiry-message" role="status"></p><div class="counter-actions">'+
        button('counter-release','Release unpaid hold')+button('counter-resolve','Counter Holds')+
        button('counter-confirm','Verify Payment &amp; Confirm Booking',true)+'</div></div>'});
      const $=id=>host.querySelector('#'+id),confirm=$('counter-confirm'),ack=$('counter-attest'),tender=$('counter-tender');
      const deadline=performance.now()+Math.max(0,Date.parse(row.expires_at)-row.server_now);
      let sending=false,timer;
      function sync(){
        if(!host.isConnected){clearInterval(timer);return;}
        const left=Math.max(0,Math.ceil((deadline-performance.now())/1000));
        const received=tender?.valueAsNumber;
        $('counter-timer').textContent=left?'Unpaid hold · '+Math.floor(left/60)+'m '+String(left%60).padStart(2,'0')+'s remaining':'Unpaid hold expired';
        if(tender)$('counter-change').textContent=Number.isFinite(received)&&received>=row.amount?'Change '+amount(received-row.amount,row.currency):'Receive at least the full fee.';
        confirm.disabled=sending||!left||!ack?.checked||!dest||(cash&&(!Number.isFinite(received)||received<row.amount));
        $('counter-release').disabled=sending||!left;
        if(!left){
          $('counter-verification').hidden=true;
          $('counter-expiry-message').textContent='Do not send funds. If payment arrived, open Counter Holds to reconcile it.';
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
        if(!window.confirm('Release this unpaid hold? Use reconciliation if funds arrived.'))return;
        await locked(e.currentTarget,async()=>{
          const released=await post('/'+row.id+'/cancel',{});
          host.remove();onChange();resolve(released);
        });
      });
      bind(host,'counter-resolve',()=>{host.remove();showHolds(row.kind);});
    }
    async function form(kind,sourceId,previous){
      const config=await get('/config',{kind});
      const extension=kind==='extension';
      const host=modal({title:extension?'Extend Booking':'New Walk-In Booking',wide:true,body:'<div class="counter-flow">'+
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
        '<p id="counter-quote-value" class="counter-notice" role="status">Choose a court and time for a server quote.</p>'+
        '<div class="counter-actions">'+button('counter-refresh','Refresh available slots')+button('counter-quote','Quote full price')+
        button('counter-hold','Hold Slot &amp; Prepare Payment',true)+'</div></div>'});
      const $=id=>host.querySelector('#'+id);
      let schedule=null,quote=null,key,request=0;
      if(previous){
        const index=config.methods.findIndex(m=>m.key===previous.method&&m.option_id===(previous.option_id??null)&&m.label===previous.method_label);
        if(index>=0)$('counter-method').value=String(index);
      }
      function invalidate(){
        quote=null;
        $('counter-hold').disabled=true;
        $('counter-quote-value').textContent='Choose a court and time for a server quote.';
      }
      function fillTimes(){
        const list=schedule.slots.filter(s=>s.court_id===Number($('counter-court').value));
        const start=$('counter-start'),old=start.value;
        start.innerHTML=option('','Select start time')+list.map(s=>option(s.start_time,s.start_time)).join('');
        if(list.some(s=>s.start_time===old))start.value=old;
        fillEnds();
      }
      function fillEnds(){
        const start=$('counter-start').value,end=$('counter-end'),choices=[];
        if(start){
          const list=schedule.slots.filter(s=>s.court_id===Number($('counter-court').value));
          let cursor=start;
          for(let i=0;i<list.length;i++){
            const slot=list.find(s=>s.start_time===cursor);
            if(!slot)break;
            choices.push(option(slot.end_time,slot.end_time));
            cursor=slot.end_time;
            if(cursor==='00:00')break;
          }
        }
        end.innerHTML=choices.length?choices.join(''):option('','Select end time');
        invalidate();
      }
      async function slots(){
        const n=++request;
        invalidate();schedule=null;$('counter-slots').textContent='';
        const params={kind};
        if(extension)params.source_id=sourceId;
        else if(previous)params.recovery_id=previous.id;
        else{
          if(!$('counter-venue').value||!$('counter-date').value)return;
          params.venue_id=$('counter-venue').value;params.date=$('counter-date').value;
        }
        const result=await get('/slots',params);
        if(n!==request||!host.isConnected)return;
        schedule=result;
        if(extension)$('counter-original').textContent=result.source_reference+' · '+result.customer_name+' · '+result.venue.name+' · '+result.date+'. Any waiting gap is unreserved.';
        if(!result.slots.length){$('counter-slots').textContent='No eligible free slots. Refresh or select another date for Walk-In.';return;}
        if(extension){
          $('counter-slots').innerHTML=control('counter-slot','Same-venue options',select('counter-slot',result.slots.map((s,i)=>option(i,
            label[s.extension_kind]+' · '+s.court_name+' · '+s.start_time+'–'+s.end_time+
            (s.gap?' · wait '+s.gap+' min':'')+' · '+amount(s.amount,result.currency))).join('')));
          $('counter-slot').onchange=invalidate;
        }else{
          const courts=new Map(result.slots.map(s=>[s.court_id,s.court_name]));
          $('counter-slots').innerHTML='<div class="counter-grid">'+control('counter-court','Court',select('counter-court',[...courts].map(([id,name])=>option(id,name)).join('')))+
            control('counter-start','Start time',select('counter-start',''))+control('counter-end','End time',select('counter-end',''))+'</div>';
          $('counter-court').onchange=fillTimes;$('counter-start').onchange=fillEnds;$('counter-end').onchange=invalidate;fillTimes();
        }
      }
      function input(){
        if(!schedule?.slots.length)throw Error('Select an available court and time.');
        const out={kind,...(previous?{recovery_id:previous.id}:{})};
        if(extension){
          const s=schedule.slots[Number($('counter-slot').value)];
          return {...out,source_id:sourceId,court_id:s.court_id,start_time:s.start_time,end_time:s.end_time};
        }
        if(!$('counter-start').value||!$('counter-end').value)throw Error('Select start and end times.');
        Object.assign(out,{venue_id:schedule.venue.id,date:schedule.date,court_id:Number($('counter-court').value),
          start_time:$('counter-start').value,end_time:$('counter-end').value});
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
      bind(host,'counter-refresh',e=>locked(e.currentTarget,slots));
      bind(host,'counter-quote',e=>locked(e.currentTarget,async()=>{
        const body=input(),result=await post('/quote',body);
        if(JSON.stringify(input())!==JSON.stringify(body))return;
        quote={body,result};key=newKey();
        $('counter-quote-value').textContent=result.customer_name+' · '+result.court_name+' · '+result.start_time+'–'+result.end_time+
          ' · Full amount '+amount(result.amount,result.currency)+(result.gap?' · '+result.gap+' min wait (unreserved)':'');
        $('counter-hold').disabled=false;
      }));
      bind(host,'counter-hold',e=>locked(e.currentTarget,async()=>{
        if(!quote)throw Error('Request a current server quote.');
        const method=config.methods[Number($('counter-method').value)];
        const out=await post('/hold',{...quote.body,quote_token:quote.result.quote_token,idempotency_key:key,payment_method:method.key,option_id:method.option_id});
        host.remove();onChange();payment(out);
      }));
      invalidate();await slots();
    }
    function resolve(row){
      const admin=getUser()?.role==='admin';
      const host=modal({title:'Reconcile Counter Hold · '+row.reference,body:'<div class="counter-flow">'+info(row)+
        '<p>Verify whether funds arrived. An expired or released hold carries no paid booking. Rebook a free slot with the same customer, amount and receiving account, or record the completed external refund.</p>'+
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
    async function showHolds(only){
      try{
        const kinds=only?[only]:['walk_in','extension'].filter(k=>can(getUser(),k));
        const all=(await Promise.all(kinds.map(kind=>get('/holds',{kind})))).flat();
        const host=modal({title:'Counter Holds',wide:true,body:'<div class="counter-flow"><p>Resume an unpaid hold or reconcile expired or released funds.</p>'+
          (all.length?all.map(row=>'<div class="counter-hold-row"><div><strong>'+esc(row.reference)+' · '+esc(row.customer_name)+'</strong><p>'+
            esc(row.venue_name+' · '+row.date+' '+row.start_time+'–'+row.end_time+' · '+(row.resolution||row.status))+'</p></div>'+
            '<button type="button" class="btn btn-outline" data-counter-resume="'+row.id+'">'+(row.status==='checkout_hold'?'Resume Hold':'Reconcile')+'</button></div>').join(''):
            '<p>No unpaid or unresolved counter holds.</p>')+'</div>'});
        host.addEventListener('click',e=>{
          const b=e.target.closest('[data-counter-resume]');
          if(b)locked(b,async()=>{const row=await get('/'+b.dataset.counterResume+'/hold');host.remove();payment(row);});
        });
      }catch(error){showError(error);}
    }
    async function adjustPayment(id){
      const row=await get('/'+id+'/acknowledgment');
      modal({title:'Adjust Counter Payment',confirmText:'Record Adjustment',danger:true,body:'<div class="counter-flow">'+info(row)+
        control('counter-adjust-type','Resolution','<select class="select" id="counter-adjust-type"><option value="">Choose a resolution</option><option value="refunded">Full refund already completed outside PIKOL</option><option value="voided">Payment was never received after independent verification</option></select>')+
        control('counter-adjust-note','Reconciliation note','<textarea class="textarea" id="counter-adjust-note" maxlength="400"></textarea>')+
        '<label class="counter-check"><input type="checkbox" id="counter-adjust-confirm"> I verified this resolution for the full amount and understand that it cancels this booking.</label></div>',
        onConfirm:async host=>{
          await post('/'+id+'/adjust-payment',{resolution:host.querySelector('#counter-adjust-type').value,amount:row.amount,
            confirmed:host.querySelector('#counter-adjust-confirm').checked,note:host.querySelector('#counter-adjust-note').value});
          onChange();toast('Counter payment adjustment recorded.','success');
        }});
    }
    document.addEventListener('click',e=>{
      if(e.target.closest('#btn-counter-walk'))form('walk_in').catch(showError);
      if(e.target.closest('#btn-counter-holds'))showHolds();
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
