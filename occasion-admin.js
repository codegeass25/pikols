/* Admin > Settings > Booking & Payments > Promotions & Special Occasions.
   Deliberately separate from existing Settings forms to prevent accidental
   promo saves when editing payment configuration. */
(function(global){'use strict';
 let api,toast,modal,rows=[],venues=[],courts=[];
 const $=(s,r=document)=>r.querySelector(s);
 const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
 const esc=x=>String(x??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
 const money=x=>'₱'+Number(x||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
 const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replace(/\//g,'-');
 const status=p=>p.status!=='published'?p.status:(p.repeat_annually?'Annual':p.start_date>today()?'Scheduled':p.end_date<today()?'Published':'Active');
 const formatted=(type,value)=>Number(value)>0?(type==='percent'?Number(value)+'% OFF':money(value)+' OFF'):'Not included';
 function render(){const host=$('#occasion-promo-list');if(!host)return;
   $('#occasion-promo-count').textContent=rows.length+' configured';
   host.innerHTML=rows.map(p=>'<article class="oc-card"><div class="oc-card-head"><div><span class="oc-eyebrow">SPECIAL OCCASION</span><h3>'+esc(p.public_title)+'</h3><p>'+esc(p.occasion_name)+'</p></div><span class="oc-badge oc-'+esc(p.status)+'">'+esc(status(p))+'</span></div><p>📅 '+esc(p.start_date)+(p.start_date!==p.end_date?' → '+esc(p.end_date):'')+(Number(p.repeat_annually)?' · Every year':'')+'</p><div class="oc-metrics"><div class="oc-metric"><span>Court Booking</span><strong>'+esc(formatted(p.court_discount_type,p.court_discount_value))+'</strong></div><div class="oc-metric"><span>Open Play</span><strong>'+esc(formatted(p.open_play_discount_type,p.open_play_discount_value))+'</strong></div></div><div class="oc-foot"><span class="oc-stat">'+Number(p.active_redemptions||0)+' redemptions · '+money(p.usage_total?.savings||0)+' savings</span><button type="button" class="btn btn-outline btn-sm" data-oc-edit="'+p.id+'">Edit</button></div></article>').join('')||'<div class="oc-empty">No promotions yet. Create a family birthday, anniversary or community celebration discount.</div>';
 }
 function field(id,label,inner){return '<div class="field"><label class="label" for="oc-'+id+'">'+label+'</label>'+inner+'</div>';}
 function input(id,value,type='text',rest=''){return '<input class="input" id="oc-'+id+'" type="'+type+'" value="'+esc(value??'')+'" '+rest+' required>';}
 function select(id,opts,v){return '<select id="oc-'+id+'" class="select">'+opts.map(o=>'<option value="'+o[0]+'"'+(o[0]===v?' selected':'')+'>'+esc(o[1])+'</option>').join('')+'</select>';}
 function checks(name,data,selected){return '<div class="oc-pick" role="group" aria-label="'+esc(name)+'">'+(data.length?data.map(x=>'<label class="oc-check"><input type="checkbox" data-oc-'+name+'="'+Number(x.id)+'"'+(selected.includes(Number(x.id))?' checked':'')+'><span>'+esc(x.name)+'</span></label>').join(''):'<span class="oc-hint">No entries available.</span>')+'</div>';}
 function form(p){p=p||{};const venueIds=p.venue_ids||[],courtIds=p.court_ids||[];
 return '<div class="oc-form"><div class="oc-form-grid">'+field('name','Internal occasion name',input('name',p.occasion_name||'Family Birthday Celebration','text','maxlength="100" placeholder="Visible to admin only"'))+
   field('title','Public promo title',input('title',p.public_title||'PIKOL Family Appreciation Day','text','maxlength="100"'))+
   field('start','Start date',input('start',p.start_date||today(),'date'))+field('end','End date',input('end',p.end_date||today(),'date'))+
   field('status','Promotion status',select('status',[['draft','Draft'],['published','Publish / Schedule'],['paused','Pause'],['ended','End promotion']],p.status||'draft'))+
   field('eligibility','Who receives a discount?',select('eligibility',[['all','All players'],['members','Members only']],p.eligibility||'all'))+'</div>'+ 
   '<label class="oc-check mt-3"><input id="oc-annual" type="checkbox"'+(p.repeat_annually?' checked':'')+'> Repeat every year on these dates</label><p class="oc-hint">Discount applies to the actual play date, not checkout date. Published future dates are available for advance bookings.</p><hr><h3 class="oc-section-title">Discount amounts</h3><div class="oc-form-grid">'+
   field('court-type','Court Booking discount type',select('court-type',[['percent','Percentage (%)'],['fixed','Fixed peso (₱) per booked slot']],p.court_discount_type||'percent'))+
   field('court-value','Court Booking discount value',input('court-value',p.court_discount_value??20,'number','min="0" max="1000000" step="0.01"'))+
   field('open-type','Open Play discount type',select('open-type',[['percent','Percentage (%)'],['fixed','Fixed peso (₱) per registration']],p.open_play_discount_type||'percent'))+
   field('open-value','Open Play discount value',input('open-value',p.open_play_discount_value??15,'number','min="0" max="1000000" step="0.01"'))+'</div><p class="oc-hint">Enter 0 to exclude a service. The best eligible membership or occasion discount wins; discounts never stack.</p><hr><h3 class="oc-section-title">Eligible locations</h3><p class="oc-hint">Leave both selections empty for all venues and courts. Selecting courts restricts only eligible court bookings and mapped Open Play courts.</p><div class="oc-form-grid"><div class="field"><label class="label">Venues (optional)</label>'+checks('venue',venues,venueIds)+'</div><div class="field"><label class="label">Courts (optional)</label>'+checks('court',courts,courtIds)+'</div></div><hr><div class="oc-form-grid">'+field('limit','Max active redemptions (0 = unlimited)',input('limit',p.max_redemptions||0,'number','min="0" max="1000000" step="1"'))+'<div class="field"><label class="label">Booking site announcement</label><label class="oc-check"><input id="oc-announce" type="checkbox"'+(p.announce===undefined||p.announce?' checked':'')+'> Show public occasion banner</label></div></div></div>';
 }
 function read(h){
   const val=id=>$('#oc-'+id,h).value;
   const venue_ids=$$('[data-oc-venue]:checked',h).map(el=>Number(el.dataset.ocVenue));
   const court_ids=$$('[data-oc-court]:checked',h).map(el=>Number(el.dataset.ocCourt));
   const body={occasion_name:val('name').trim(),public_title:val('title').trim(),start_date:val('start'),end_date:val('end'),status:val('status'),repeat_annually:$('#oc-annual',h).checked,eligibility:val('eligibility'),court_discount_type:val('court-type'),court_discount_value:Number(val('court-value')),open_play_discount_type:val('open-type'),open_play_discount_value:Number(val('open-value')),venue_ids,court_ids,max_redemptions:Number(val('limit')),announce:$('#oc-announce',h).checked};
   if(!body.occasion_name||!body.public_title)throw Error('Enter an occasion name and public title');
   if(!body.start_date||!body.end_date||body.start_date>body.end_date)throw Error('Choose a valid start and end date');
   for(const service of ['court','open_play']){const n=body[service+'_discount_value'],t=body[service+'_discount_type'];if(!Number.isFinite(n)||n<0||(t==='percent'&&n>100))throw Error('Percent discounts must be between 0 and 100');}
   if(!body.court_discount_value&&!body.open_play_discount_value)throw Error('Set at least one discount');
   return body;
 }
 function edit(p){if(!locationOptionsReady){toast('Wait for venue and court options to load. Refresh Settings.','warning');return;}modal({title:p?'Edit Special Occasion':'Create Special Occasion',wide:true,confirmText:p?'Save promotion':'Create promotion',body:form(p),onConfirm:async h=>{
   const body=read(h);await api('/api/admin/occasion-promotions'+(p?'/'+p.id:''),{method:p?'PUT':'POST',body});toast('Special occasion saved.','success');await refresh();
 }});}
 let locationOptionsReady=false;
 async function refresh(){if(!$('#occasion-promo-list'))return;
   try {
     const results=await Promise.allSettled([api('/api/admin/occasion-promotions'),api('/api/admin/venues'),api('/api/availability?date='+encodeURIComponent(today()))]);
     if(results[0].status!=='fulfilled')throw results[0].reason;
     rows=results[0].value||[];
     locationOptionsReady=results[1].status==='fulfilled'&&results[2].status==='fulfilled';
     venues=locationOptionsReady?(results[1].value||[]).filter(v=>!v.deleted_at):[];
     courts=locationOptionsReady?(results[2].value?.courts||[]).filter(x=>!x.retired_at).map(x=>({id:x.id,name:x.name})):[];
     render();
     // Prevent saves of a location-specific promotion with a blank scope when
     // one of the dependent catalog APIs temporarily fails.
     const create=$('#occasion-promo-create');if(create)create.disabled=!locationOptionsReady;
     const buttons=$$('[data-oc-edit]');buttons.forEach(b=>b.disabled=!locationOptionsReady);
     const note=$('#occasion-promo-scope-alert');if(note)note.textContent=locationOptionsReady?'':'Venue/court options could not load. Promotions are read-only until you refresh Settings.';
   }catch(e){const host=$('#occasion-promo-list');if(host)host.innerHTML='<div class="oc-empty">Could not load promotions. '+esc(e.message)+'</div>';}
 }
 function init(opts){api=opts.api;toast=opts.toast;modal=opts.modal;
   const create=$('#occasion-promo-create'),host=$('#occasion-promo-list');if(!create||!host)return;
   create.addEventListener('click',()=>edit());host.addEventListener('click',e=>{const b=e.target.closest('[data-oc-edit]');if(b){const p=rows.find(p=>p.id===Number(b.dataset.ocEdit));if(p)edit(p);}});
 }
 global.PikolOccasionAdmin={init,refresh};
})(window);
