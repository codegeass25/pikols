(function(global){
  'use strict';
  function install(c) {
    const {api,esc,money,toast}=c,UI=global.PikolVenueUI,host=document.getElementById('courts-grid');
    let venues=[],courts=[],periods=[],selected=null;
    const value=(d,id)=>d.querySelector('#'+id).value;
    const field=(id,label,val='',type='text')=>'<label class="vg-field"><span>'+esc(label)+'</span><input class="input" id="'+id+'" type="'+type+'" value="'+esc(val)+'"></label>';
    async function load(){
      const [vs,cs,ps]=await Promise.all([api('/api/admin/venues'),api('/api/courts'),api('/api/pricing')]);venues=vs;courts=cs;periods=ps.periods;c.setCourts(cs);
      if(!venues.some(v=>v.id===selected))selected=venues[0]?.id;render();return cs;
    }
    function render(){
      host.innerHTML='<div class="vg-admin-toolbar"><p class="muted">Manage venues, court schedules, rates and galleries.</p><button class="btn btn-primary btn-sm" data-new-venue>＋ Add venue</button></div>'+venues.map(v=>'<details class="vg-venue-card" data-venue-card="'+v.id+'"'+(selected===v.id?' open':'')+'><summary><span><strong>'+esc(v.name)+'</strong><small>'+esc(v.address||'Address not configured')+'</small></span><span class="badge">'+v.court_count+' courts · '+esc(v.status)+'</span></summary><div class="vg-venue-content"><div class="vg-admin-toolbar"><p class="tiny muted">'+esc(v.description||'')+'</p><button class="btn btn-outline btn-sm" data-edit-venue="'+v.id+'">Venue Settings</button><button class="btn btn-outline btn-sm" data-venue-map="'+v.id+'">📍 Location</button></div>'+courts.filter(ct=>ct.venue_id===v.id).map(ct=>'<article class="vg-court-row">'+(ct.thumbnail_url?'<img src="'+esc(c.assetUrl(ct.thumbnail_url))+'" alt="" width="76" height="60" loading="lazy">':'<span class="vg-photo-placeholder" aria-hidden="true">▧</span>')+'<div class="vg-court-title"><strong>'+esc(ct.name)+'</strong><small>'+esc(ct.surface||'Surface not set')+' · '+esc(ct.status)+'</small><span class="vg-rate-tag">'+(ct.use_custom_pricing?(ct.legacy_pricing_json?'Preserved legacy pricing':'Custom court pricing'):'Inherits global pricing')+'</span></div><div class="vg-court-actions"><button class="btn btn-outline btn-sm" data-config-court="'+ct.id+'">Settings</button><button class="btn btn-outline btn-sm" data-court-times="'+ct.id+'">Time Slots</button><button class="btn btn-outline btn-sm" data-gallery-manage="'+ct.id+'">Photos ('+(ct.images||[]).length+')</button></div></article>').join('')+'<button class="btn btn-outline btn-sm" data-new-venue-court="'+v.id+'">＋ Add court here</button></div></details>').join('');
      host.querySelectorAll('details[data-venue-card]').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)selected=Number(d.dataset.venueCard);}));
    }
    function saveButton(d,fn){
      const button=d.querySelector('[data-save]');button.onclick=async()=>{button.disabled=true;try{await fn();d.close();await load();toast('Saved.','success');c.signal();}catch(e){toast(e.message,'error');}finally{button.disabled=false;}};
    }
    function venueDialog(v={}) {
      const d=UI.dialog(v.id?'Venue Settings':'Add Venue',field('v-name','Venue name',v.name)+field('v-address','Complete address',v.address)+field('v-description','Description',v.description)+field('v-maps','Google Maps Location URL',v.maps_url,'url')+field('v-order','Display order',v.display_order||0,'number')+'<label class="vg-field"><span>Status</span><select class="select" id="v-status">'+['active','inactive','archived'].map(s=>'<option '+(v.status===s?'selected':'')+'>'+s+'</option>').join('')+'</select></label>'+(v.id?'<label class="vg-field">Venue photo<input type="file" id="v-photo" accept="image/png,image/jpeg,image/webp"></label>':'')+'<div class="vg-dialog-actions"><button class="btn btn-primary" data-save>Save venue</button></div>');
      saveButton(d,async()=>{const body={name:value(d,'v-name'),address:value(d,'v-address'),description:value(d,'v-description'),maps_url:value(d,'v-maps'),display_order:Number(value(d,'v-order')),status:value(d,'v-status')};const saved=await api('/api/admin/venues'+(v.id?'/'+v.id:''),{method:v.id?'PUT':'POST',body});selected=saved.id;
        const file=d.querySelector('#v-photo')?.files[0];if(file){const data=await readFile(file);await api('/api/admin/venues/'+saved.id+'/image',{method:'POST',body:{data,mime:file.type}});}});
    }
    function courtDialog(ct={},venueId=selected) {
      const existing=!!ct.id;
      const rates=JSON.parse(ct.pricing_overrides||'{}');
      const d=UI.dialog(existing?'Court Settings · '+ct.name:'Add Court',field('c-name','Court name',ct.name)+field('c-surface','Surface',ct.surface)+field('c-description','Description',ct.description)+'<label class="vg-field"><span>Venue</span><select class="select" id="c-venue">'+venues.filter(v=>v.status!=='archived'||v.id===ct.venue_id).map(v=>'<option value="'+v.id+'"'+(v.id===(ct.venue_id||venueId)?' selected':'')+'>'+esc(v.name)+'</option>').join('')+'</select></label>'+field('c-order','Court display order',ct.display_order||0,'number')+'<label class="vg-field"><span>Status</span><select class="select" id="c-status">'+['active','maintenance','inactive'].map(s=>'<option'+(ct.status===s?' selected':'')+'>'+s+'</option>').join('')+'</select></label><label class="vg-custom-toggle"><input id="c-custom" type="checkbox"'+(ct.use_custom_pricing?' checked':'')+'> Use Custom Court Pricing</label>'+(ct.legacy_pricing_json?'<p class="notice warning">The original two-period rates are preserved. Saving the rates below switches this court to the displayed three-period overrides.</p>':'')+'<div class="vg-court-rates">'+periods.map(p=>{const old=(ct.pricing_periods||[]).find(r=>r.id===p.id);return field('rate-'+p.id,p.label+' · '+p.start+' – '+p.end,rates[p.id]??old?.rate??p.rate,'number');}).join('')+'</div><p class="tiny muted">With custom pricing off, future reservations inherit the global schedule. Existing bookings keep their price and venue snapshots.</p><div class="vg-dialog-actions"><button class="btn btn-primary" data-save>Save court</button>'+(existing?'<button class="btn btn-outline" data-archive>Archive court</button>':'')+'</div>');
      const toggle=d.querySelector('#c-custom');function sync(){d.querySelectorAll('.vg-court-rates input').forEach(i=>{i.disabled=!toggle.checked;i.min=0;i.step='0.01';});}toggle.onchange=sync;sync();
      saveButton(d,async()=>{
        const body={name:value(d,'c-name'),surface:value(d,'c-surface'),description:value(d,'c-description'),venue_id:Number(value(d,'c-venue')),display_order:Number(value(d,'c-order')),status:value(d,'c-status'),use_custom_pricing:toggle.checked,rates:Object.fromEntries(periods.map(p=>[p.id,Number(value(d,'rate-'+p.id))]))};
        await api('/api/admin/venue-courts'+(ct.id?'/'+ct.id:''),{method:ct.id?'PUT':'POST',body});
      });
      if(existing)d.querySelector('[data-archive]').onclick=async()=>{if(!confirm('Archive this court? Historical reservations are preserved.'))return;try{await api('/api/admin/courts/'+ct.id,{method:'DELETE'});d.close();await load();c.signal();}catch(e){toast(e.message,'error');}};
    }
    async function slotDialog(ct) {
      const d=UI.dialog('Time Slots · '+ct.name,'<div class="vg-slot-list" aria-live="polite">Loading…</div><div class="vg-admin-toolbar">'+field('slot-start','Add start time','','time')+'<button class="btn btn-primary btn-sm" data-slot-add>Add slot</button></div><p class="tiny muted">Each configured start uses the current facility slot duration. Removing a time stops future selections and preserves existing reservations.</p>');
      async function refresh(){const result=await api('/api/admin/courts/'+ct.id+'/slots');d.querySelector('.vg-slot-list').innerHTML=result.slots.map(s=>'<span>'+c.humanTime(s.start_time)+' – '+c.humanTime(s.end_time)+'<button data-slot-remove="'+s.start_time+'" aria-label="Remove '+s.start_time+'">×</button></span>').join('')||'<p>No slots configured.</p>';}
      d.querySelector('[data-slot-add]').onclick=async()=>{try{await api('/api/admin/courts/'+ct.id+'/slots',{method:'POST',body:{start_time:value(d,'slot-start')}});await refresh();c.signal();}catch(e){toast(e.message,'error');}};
      d.addEventListener('click',async e=>{const b=e.target.closest('[data-slot-remove]');if(!b)return;b.disabled=true;try{await api('/api/admin/courts/'+ct.id+'/slots?start_time='+encodeURIComponent(b.dataset.slotRemove),{method:'DELETE'});await refresh();c.signal();}catch(e){toast(e.message,'error');b.disabled=false;}});try{await refresh();}catch(e){toast(e.message,'error');}
    }
    function readFile(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Image could not be read'));r.readAsDataURL(file);});}
    async function galleryDialog(ct) {
      let rows=[];
      const d=UI.dialog('Court Photos · '+ct.name,'<label class="vg-field">Add court photos<input type="file" id="gallery-files" multiple accept="image/png,image/jpeg,image/webp"></label><progress id="gallery-progress" max="100" value="0" hidden></progress><p id="gallery-status" role="status"></p><div class="vg-gallery-admin"></div><div class="vg-dialog-actions"><button class="btn btn-outline" data-preview>Slideshow Preview</button><button class="btn btn-primary" data-gallery-save>Save order & cover</button></div>');
      async function refresh(){rows=await api('/api/courts/'+ct.id+'/images');paint();}
      function paint(){d.querySelector('.vg-gallery-admin').innerHTML=rows.map((im,i)=>'<article data-image-id="'+im.id+'"><img src="'+esc(c.assetUrl(im.thumbnail_url||im.image_url))+'" alt="Court photo '+(i+1)+'" loading="lazy"><label><input type="radio" name="gallery-cover" value="'+im.id+'"'+(im.is_cover?' checked':'')+'> Cover</label><div><button class="btn btn-ghost btn-sm" data-up="'+im.id+'"'+(i===0?' disabled':'')+' aria-label="Move photo earlier">↑</button><button class="btn btn-ghost btn-sm" data-down="'+im.id+'"'+(i===rows.length-1?' disabled':'')+' aria-label="Move photo later">↓</button><button class="btn btn-ghost btn-sm" data-remove-image="'+im.id+'">Remove</button></div></article>').join('')||'<p class="muted">No photos yet. Existing images remain available until removed.</p>';}
      const progress=d.querySelector('progress'),status=d.querySelector('#gallery-status');
      d.querySelector('#gallery-files').onchange=async function(){const files=[...this.files];if(!files.length)return;this.disabled=true;progress.hidden=false;status.textContent='Preparing photos…';
        try {if(files.length>8)throw new Error('Upload up to eight photos per batch');const payload=[];for(let i=0;i<files.length;i++){const file=files[i];if(file.size>12*1024*1024)throw new Error('Each image must be at most 12 MB');const raw=await readFile(file),data=await UI.optimize(raw,'court');payload.push({data,mime:data.slice(5,data.indexOf(';'))});progress.value=(i+1)/files.length*30;}
          const xhr=new XMLHttpRequest();xhr.open('POST',c.apiBase()+'/api/admin/courts/'+ct.id+'/images');xhr.setRequestHeader('Content-Type','application/json');xhr.setRequestHeader('Authorization','Bearer '+c.token());xhr.upload.onprogress=e=>{if(e.lengthComputable)progress.value=30+e.loaded/e.total*65;status.textContent='Uploading photos… '+Math.round(progress.value)+'%';};
          await new Promise((resolve,reject)=>{xhr.onload=()=>{let out;try{out=JSON.parse(xhr.responseText);}catch(_){out={};}xhr.status>=200&&xhr.status<300?resolve(out):reject(new Error(out.error||'Upload failed'));};xhr.onerror=()=>reject(new Error('Upload connection failed'));xhr.send(JSON.stringify({images:payload}));});progress.value=100;status.textContent='Photos optimized and saved.';await refresh();await load();c.signal();
        }catch(e){status.textContent=e.message;toast(e.message,'error');}finally{this.disabled=false;this.value='';}
      };
      d.addEventListener('change',e=>{if(e.target.name==='gallery-cover')rows.forEach(i=>i.is_cover=i.id===Number(e.target.value)?1:0);});
      d.addEventListener('click',async e=>{
        const up=e.target.closest('[data-up]'),down=e.target.closest('[data-down]'),remove=e.target.closest('[data-remove-image]');
        if(up||down){const id=Number((up||down).dataset[up?'up':'down']),i=rows.findIndex(im=>im.id===id),j=i+(up?-1:1);[rows[i],rows[j]]=[rows[j],rows[i]];paint();}
        if(remove){try{rows=await api('/api/admin/courts/'+ct.id+'/images/'+remove.dataset.removeImage,{method:'DELETE'});paint();await load();c.signal();}catch(e){toast(e.message,'error');}}
      });
      d.querySelector('[data-preview]').onclick=()=>UI.gallery(ct,rows,c.assetUrl);
      d.querySelector('[data-gallery-save]').onclick=async()=>{try{if(!rows.length)return;const cover=rows.find(im=>im.is_cover)||rows[0];await api('/api/admin/courts/'+ct.id+'/images/order',{method:'PUT',body:{ids:rows.map(im=>im.id),cover_id:cover.id}});await refresh();await load();c.signal();toast('Gallery order and cover saved.','success');}catch(e){toast(e.message,'error');}};
      try{await refresh();}catch(e){toast(e.message,'error');}
    }
    host.addEventListener('click',e=>{
      if(e.target.closest('[data-new-venue]'))venueDialog();
      const v=e.target.closest('[data-edit-venue]');if(v)venueDialog(venues.find(vn=>vn.id===Number(v.dataset.editVenue)));
      const m=e.target.closest('[data-venue-map]');if(m)UI.maps(venues.find(vn=>vn.id===Number(m.dataset.venueMap)));
      const n=e.target.closest('[data-new-venue-court]');if(n)courtDialog({},Number(n.dataset.newVenueCourt));
      const ct=e.target.closest('[data-config-court]');if(ct)courtDialog(courts.find(c=>c.id===Number(ct.dataset.configCourt)));
      const slots=e.target.closest('[data-court-times]');if(slots)slotDialog(courts.find(c=>c.id===Number(slots.dataset.courtTimes)));
      const gallery=e.target.closest('[data-gallery-manage]');if(gallery)galleryDialog(courts.find(c=>c.id===Number(gallery.dataset.galleryManage)));
    });
    document.getElementById('btn-new-court').onclick=()=>courtDialog();
    async function loadPricing(){
      const ps=await api('/api/pricing');periods=ps.periods;const box=document.getElementById('venue-pricing-editor');
      box.innerHTML='<div class="vg-admin-toolbar"><div><h3>Court Pricing · Three Periods</h3><p class="tiny muted">Active global configuration · Asia/Manila · Default inheritance for new courts</p></div><span class="badge">ACTIVE</span></div><div class="vg-pricing-hours">'+field('vg-open','Opening time',ps.open_time,'time')+field('vg-close','Closing time (00:00 = midnight)',ps.close_time,'time')+'</div><div class="vg-pricing-table"><div class="vg-pricing-row vg-pricing-heading"><span>Period label</span><span>Start</span><span>End</span><span>Hourly rate · PHP</span></div>'+ps.periods.map(p=>'<div class="vg-pricing-row" data-period="'+p.id+'">'+field('label-'+p.id,'Label',p.label)+field('start-'+p.id,'Start',p.start,'time')+field('end-'+p.id,'End',p.end,'time')+field('global-rate-'+p.id,'Rate',p.rate,'number')+'</div>').join('')+'</div><p class="tiny muted">The three periods must cover all operating hours, without gaps or overlaps. Custom court overrides and historical prices are preserved.</p><button class="btn btn-primary" type="button" data-save-pricing>Save global pricing</button>';
      box.querySelector('[data-save-pricing]').onclick=async function(){this.disabled=true;try{const body={open_time:value(box,'vg-open'),close_time:value(box,'vg-close'),periods:ps.periods.map(p=>({id:p.id,label:value(box,'label-'+p.id),start:value(box,'start-'+p.id),end:value(box,'end-'+p.id),rate:Number(value(box,'global-rate-'+p.id))}))};await api('/api/admin/pricing',{method:'PUT',body});await c.refreshSettings();await loadPricing();c.signal();toast('Global pricing saved.','success');}catch(e){toast(e.message,'error');}finally{this.disabled=false;}};
      box.querySelectorAll('input[type=number]').forEach(i=>{i.min=0;i.step='0.01';});
    }
    return {load,loadPricing};
  }
  global.PikolVenueAdmin={install};
})(window);
