(function(global){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  let dialogDepth=0,previousOverflow;
  const DEFAULT_IMAGES={venue:'assets/defaults/venue-default.webp',court:'assets/defaults/court-default.webp'};
  function defaultImage(kind){return DEFAULT_IMAGES[kind==='venue'?'venue':'court'];}
  function photoUrl(url,kind,asset){return url?asset(url):defaultImage(kind);}
  function fallbackAttr(kind){return 'onerror="this.onerror=null;this.src=\''+defaultImage(kind)+'\'"';}
  function dialog(title,body) {
    const d=document.createElement('dialog');d.className='vg-dialog';
    d.innerHTML='<div class="vg-dialog-head"><h2>'+esc(title)+'</h2><button class="btn btn-ghost" data-close aria-label="Close">×</button></div>'+body;
    const previous=document.activeElement;document.body.appendChild(d);if(!dialogDepth++){previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}d.showModal();
    const close=()=>d.close();d.querySelector('[data-close]').onclick=close;
    d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
    d.addEventListener('close',()=>{d.remove();if(!--dialogDepth)document.body.style.overflow=previousOverflow;previous?.focus({preventScroll:true});},{once:true});return d;
  }
  function gallery(court,images,asset) {
    const uploaded=(images||[]).filter(i=>i.image_url),rows=uploaded.length?uploaded:[{image_url:defaultImage('court'),illustrative:true}],reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const d=dialog(court.name,(!uploaded.length?'<p class="vg-illustrative">Illustrative default image · Actual court photos not yet uploaded</p>':'')+(court.description||court.surface?'<p class="vg-gallery-description">'+esc(court.description||court.surface)+'</p>':'')+(rows.length?'<div class="vg-gallery-frame"><img alt="" decoding="async"><button class="vg-prev" aria-label="Previous image">‹</button><button class="vg-next" aria-label="Next image">›</button></div><div class="vg-gallery-foot"><span aria-live="polite"></span><button class="btn btn-outline btn-sm" data-play>Pause slideshow</button></div><div class="vg-gallery-thumbnails" aria-label="Court photo thumbnails"></div>':'<div class="empty"><strong>No photos yet</strong>Court photos will appear here when the venue uploads them.</div>'));d.classList.add('vg-photo-dialog');
    if(!rows.length)return d;
    let index=0,timer=null,playing=!reduced,gesture=null;
    const picture=d.querySelector('img'),count=d.querySelector('.vg-gallery-foot span'),play=d.querySelector('[data-play]');
    function stop(){if(timer)clearInterval(timer);timer=null;}
    function schedule(){stop();if(playing&&!document.hidden&&!d.matches(':hover')&&!d.contains(document.activeElement))timer=setInterval(()=>show(index+1),4500);}
    function show(n){index=(n+rows.length)%rows.length;picture.src=photoUrl(rows[index].illustrative?'':rows[index].image_url,'court',asset);picture.alt=court.name+' — photo '+(index+1);count.textContent=(index+1)+' / '+rows.length;
      d.querySelectorAll('[data-image]').forEach((b,i)=>{b.setAttribute('aria-pressed',String(i===index));if(i===index&&b.scrollIntoView)b.scrollIntoView({block:'nearest',inline:'nearest'});});
      if(rows.length>1){const next=new Image();next.src=photoUrl(rows[(index+1)%rows.length].illustrative?'':rows[(index+1)%rows.length].image_url,'court',asset);} }
    d.querySelector('.vg-gallery-thumbnails').innerHTML=rows.map((r,i)=>'<button data-image="'+i+'" aria-label="Show image '+(i+1)+'"><img src="'+esc(photoUrl(r.illustrative?'':(r.thumbnail_url||r.image_url),'court',asset))+'" alt="" width="96" height="64" loading="lazy"></button>').join('');
    d.querySelector('.vg-prev').onclick=()=>show(index-1);d.querySelector('.vg-next').onclick=()=>show(index+1);
    d.querySelectorAll('[data-image]').forEach(b=>b.onclick=()=>show(Number(b.dataset.image)));
    play.textContent=playing?'Pause slideshow':'Play slideshow';play.onclick=()=>{playing=!playing;play.textContent=playing?'Pause slideshow':'Play slideshow';stop();if(playing)timer=setInterval(()=>show(index+1),4500);};
    const frame=d.querySelector('.vg-gallery-frame');frame.addEventListener('touchstart',e=>{gesture={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
    frame.addEventListener('touchend',e=>{if(!gesture)return;const dx=e.changedTouches[0].clientX-gesture.x,dy=e.changedTouches[0].clientY-gesture.y;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy))show(index+(dx<0?1:-1));gesture=null;},{passive:true});
    d.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();show(index-1);}if(e.key==='ArrowRight'){e.preventDefault();show(index+1);}});
    picture.onerror=()=>{picture.onerror=null;picture.src=defaultImage('court');count.textContent='Illustrative photo · '+(index+1)+' / '+rows.length;};
    const visibility=()=>{stop();if(playing&&!document.hidden)timer=setInterval(()=>show(index+1),4500);};document.addEventListener('visibilitychange',visibility);
    d.addEventListener('pointerenter',stop);d.addEventListener('pointerleave',schedule);
    d.addEventListener('close',()=>{stop();document.removeEventListener('visibilitychange',visibility);},{once:true});show(0);if(playing)timer=setInterval(()=>show(index+1),4500);return d;
  }
  function safeMapsURL(value) {
    try {
      const u=new URL(value),h=u.hostname.toLowerCase();
      const allowed=h==='maps.app.goo.gl'||(h==='goo.gl'&&u.pathname.startsWith('/maps/'))||h==='maps.google.com'||(['google.com','www.google.com','google.com.ph','www.google.com.ph'].includes(h)&&/^\/maps(?:\/|$)/.test(u.pathname));
      return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&allowed&&!u.searchParams.has('url')&&!u.searchParams.has('continue')?u.href:'';
    }catch(_){return '';}
  }
  function maps(venue) {
    venue={...venue,maps_url:safeMapsURL(venue.maps_url)};
    const d=dialog(venue.name,'<p>'+esc(venue.address||'Address not configured')+'</p><p>'+(venue.maps_url?'Open this venue’s official Google Maps location?':'Location is unavailable. Contact the venue for directions.')+'</p><div class="vg-dialog-actions">'+(venue.maps_url?'<a class="btn btn-primary" target="_blank" rel="noopener noreferrer" href="'+esc(venue.maps_url)+'">Open in Google Maps</a>':'')+'<button class="btn btn-outline" data-stay>Stay in App</button></div>');d.querySelector('[data-stay]').onclick=()=>d.close();return d;
  }
  async function optimize(data,kind) {
    if(!data||['receipt','qr'].includes(kind)||!/^data:image\/(jpeg|png|webp);base64,/.test(data)||data.length<500000)return data;
    try {
      const b=await (await fetch(data)).blob(),bmp=await createImageBitmap(b,{imageOrientation:'from-image'});
      if(bmp.width*bmp.height>48000000){bmp.close();return data;}
      const sizes={profile:[512,512],team:[1600,900],logo:[800,800],app_logo:[800,800],boot_logo:[800,800],favicon:[256,256],court:[1600,1200],venue:[1600,1200],poster:[1600,1600],event:[1600,1600],hero:[1920,1200]};
      const size=sizes[kind]||sizes.court,scale=Math.min(1,size[0]/bmp.width,size[1]/bmp.height),canvas=document.createElement('canvas');canvas.width=Math.round(bmp.width*scale);canvas.height=Math.round(bmp.height*scale);canvas.getContext('2d').drawImage(bmp,0,0,canvas.width,canvas.height);bmp.close();
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.86));if(!blob||blob.size>=b.size)return data;
      return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});
    }catch(_){return data;}
  }
  async function prepare(pathname,body) {
    if(!body)return body;
    const result={...body};
    const kind=/\/banner/.test(pathname)?'team':/profile-photo/.test(pathname)?'profile':/\/images/.test(pathname)?'court':/\/venues\//.test(pathname)?'venue':body.asset_type||body.kind;
    if(!kind||kind==='qr')return body;
    if(result.data){result.data=await optimize(result.data,kind);if(/^data:image\//.test(result.data))result.mime=result.data.slice(5,result.data.indexOf(';'));}
    if(result.data_url)result.data_url=await optimize(result.data_url,kind);
    if(result.images)result.images=await Promise.all(result.images.map(async im=>{const data=await optimize(im.data,'court');return {...im,data,mime:/^data:image\//.test(data)?data.slice(5,data.indexOf(';')):im.mime};}));
    return result;
  }
  /* V81: Manila-time attendance gating shared by grouped and individual bookings. */
  const attendanceFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit',
    hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  });
  function manilaNow(date) {
    const parts=attendanceFormatter.formatToParts(date||new Date()).reduce((a,p)=>{
      if(p.type!=='literal')a[p.type]=p.value;return a;
    },{});
    return {date:parts.year+'-'+parts.month+'-'+parts.day,minutes:Number(parts.hour)*60+Number(parts.minute)};
  }
  function attendanceEnded(slot,now) {
    const d=String(slot&&slot.booking_date||''),start=String(slot&&slot.start_time||'').slice(0,5),end=String(slot&&slot.end_time||'').slice(0,5);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!/^\d{2}:\d{2}$/.test(start)||!/^\d{2}:\d{2}$/.test(end))return false;
    const toMinutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3,5));
    const startMin=toMinutes(start),endMin=(end==='00:00'&&startMin>0)?1440:toMinutes(end);
    if(endMin<=startMin)return false;
    const current=now||manilaNow();return d<current.date||(d===current.date&&current.minutes>=endMin);
  }
  function attendanceButtons(slot,grouped) {
    const unlocked=attendanceEnded(slot),locked=!unlocked;
    const why='Available only after this court slot ends (Manila time)';
    return ['completed','no_show'].map(function(status){
      const label=status==='completed'?'Complete':'No-show';
      return '<button type="button" class="btn btn-ghost btn-sm vg-attendance-btn" data-attendance-status="'+status+'" data-attendance-date="'+esc(slot.booking_date)+'" data-attendance-start="'+esc(slot.start_time)+'" data-attendance-end="'+esc(slot.end_time)+'" '+
        (grouped?'data-group-slot="status" data-slot-id="'+Number(slot.id)+'"':'data-status="'+status+'" data-id="'+Number(slot.id)+'"')+
        (locked?' disabled aria-disabled="true" title="'+esc(why)+'"':'')+'>'+(locked?'🔒 ':'')+label+'</button>';
    }).join('')+(locked?'<span class="vg-attendance-hint">Available after slot ends (Manila time)</span>':'');
  }
  function refreshAttendanceButtons(root) {
    const current=manilaNow();(root||document).querySelectorAll('[data-attendance-status]').forEach(function(btn){
      const unlocked=attendanceEnded({booking_date:btn.dataset.attendanceDate,start_time:btn.dataset.attendanceStart,end_time:btn.dataset.attendanceEnd},current);
      btn.disabled=!unlocked;btn.setAttribute('aria-disabled',String(!unlocked));
      btn.title=unlocked?'':'Available only after this court slot ends (Manila time)';
      btn.textContent=(unlocked?'':'🔒 ')+(btn.dataset.attendanceStatus==='completed'?'Complete':'No-show');
      const hint=btn.parentElement&&btn.parentElement.querySelector('.vg-attendance-hint');
      if(hint)hint.hidden=unlocked;
    });
  }
  function segmentsHtml(booking,c) {
    if(!booking?.segments?.length)return '';
    return '<details class="vg-segments"><summary>'+esc(booking.venue_name)+' · '+booking.segments.length+' slots · '+(booking.duration_minutes/60)+' court-hours</summary><ul>'+booking.segments.map(function(slot){
      var controls=(c.adminActions&&slot.status==='confirmed')?'<div class="vg-slot-actions" role="group" aria-label="Actions for slot '+esc(slot.start_time)+'">'+attendanceButtons(slot,true)+'<button type="button" class="btn btn-outline btn-sm" data-group-slot="venue-cancel" data-slot-id="'+slot.id+'">Venue Cancel / Resolve</button><button type="button" class="btn btn-outline btn-sm" data-group-slot="reschedule" data-slot-id="'+slot.id+'">Reschedule</button></div>':'';
      return '<li class="vg-slot-item"><div class="vg-slot-primary"><strong>'+esc(slot.court_name)+'</strong><span>'+esc(slot.booking_date)+' · '+c.humanTime(slot.start_time)+' – '+c.humanTime(slot.end_time)+'</span><strong>'+c.money(slot.amount)+'</strong><span class="vg-slot-status vg-slot-status-'+esc(slot.status)+'">'+esc(String(slot.status||'').replace(/_/g,' '))+'</span></div>'+controls+'</li>';
    }).join('')+'</ul><div class="tiny muted vg-slot-total">Subtotal '+c.money(booking.base_amount)+' · Discount '+c.money(booking.discount_amount||0)+' · Credit '+c.money(booking.credit_used||0)+' · Original group payable '+c.money(booking.amount||0)+'<br><strong>One original payment; individual slot actions do not duplicate payments.</strong></div></details>';
  }
  function timeLabel(b,c){return b.segments?.length?b.segments.length+' slots · '+(b.duration_minutes/60)+' court-hours':c.humanTime(b.start_time)+' – '+c.humanTime(b.end_time);}
  function ratesHtml(ct,c){return (ct.pricing_periods||[]).map(p=>'<span><strong>'+c.money(p.rate)+'</strong><small>/hr · '+esc(p.label)+' '+c.humanTime(p.start)+' – '+c.humanTime(p.end)+'</small></span>').join('');}
  function thumb(url){return /(?:avatar-|team-).*\.webp(?:$|\?)/.test(url||'')?url.replace(/\.webp(?=$|\?)/,'-thumb.webp'):url;}
  global.PikolVenueUI={safeMapsURL,timeLabel,ratesHtml,thumb,dialog,gallery,maps,optimize,prepare,segmentsHtml,attendanceEnded,attendanceButtons,refreshAttendanceButtons,esc,defaultImage,photoUrl,fallbackAttr};
})(window);
