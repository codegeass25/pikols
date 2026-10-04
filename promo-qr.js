/* Exact approved master pixels; only the measured inner QR rectangle is replaced. */
(function(root){
  'use strict';
  const base='assets/promo-qr/';
  // Native 1672 x 941. Dark/antialiased sample matrix bounds were measured per master:
  // tournament [1116,175,1530,594], open-play [1188,303,1558,662], booking [1159,125,1584,552].
  // Each square includes 4px minimum clearance inside the existing white card, preserving its frame.
  const templates={
    booking:{name:'Booking Site',view:'booking',file:'booking-site',x:1154,y:121,size:435,logoWidth:155},
    tournament:{name:'Tournament Registration',view:'events',tab:'tournament',file:'tournament-registration',x:1109,y:171,size:427,logoWidth:152},
    'open-play':{name:'Open Play Registration',view:'events',tab:'open-play',file:'open-play-registration',x:1184,y:293,size:378,logoWidth:143}
  };
  function destinationUrl(website,type){
    const d=templates[type];if(!d)throw new Error('Select a supported destination.');
    let raw=String(website||'').trim();if(!raw)throw new Error('Save your official Website under Settings → Club first.');
    if(!/^https?:\/\//i.test(raw))raw='https://'+raw;
    let url;try{url=new URL(raw);}catch(_){throw new Error('Save a valid official Website URL.');}
    if(!/^https?:$/.test(url.protocol)||url.username||url.password)throw new Error('Use an HTTP or HTTPS public Website URL without credentials.');
    if(/\/[^/]+\.html?$/i.test(url.pathname))url.pathname=url.pathname.replace(/[^/]+$/,'index.html');
    else url.pathname=url.pathname.replace(/\/?$/,'/')+'index.html';
    url.search='';url.hash='';url.searchParams.set('view',d.view);if(d.tab)url.searchParams.set('tab',d.tab);
    return url.href;
  }
  const images=new Map();
  function loadImage(src){
    if(!images.has(src))images.set(src,new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>{images.delete(src);reject(new Error('The approved artwork could not load. Connect once and try again.'));};im.src=src;}));
    return images.get(src);
  }
  function verifies(canvas,url){const c=canvas.getContext('2d',{willReadFrequently:true}),p=c.getImageData(0,0,canvas.width,canvas.height);return root.jsQR(p.data,p.width,p.height,{inversionAttempts:'dontInvert'})?.data===url;}
  function resized(canvas,width){const out=document.createElement('canvas');out.width=width;out.height=width;const c=out.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(canvas,0,0,width,width);return out;}
  async function composite(canvas,type,url,stillCurrent){
    const d=templates[type];if(!root.PIKOL_QR?.canvas||!root.jsQR)throw new Error('The QR generator could not load. Refresh the app and try again.');
    const [master,logo]=await Promise.all([loadImage(base+d.file+'-master.png'),loadImage(base+d.file+'-qr-logo.png')]);
    if(master.naturalWidth!==1672||master.naturalHeight!==941)throw new Error('The approved master dimensions changed. Restore the supplied artwork.');
    const qr=document.createElement('canvas');qr.width=qr.height=d.size;let metadata=null,width=d.logoWidth;
    // Try the measured sample size first, then reduce only the center emblem one pixel at a time.
    // H correction and independent local decoding protect long/custom deployment URLs too.
    for(;width>=Math.ceil(d.size*.15);width--){
      if(!stillCurrent())return null;
      try{metadata=root.PIKOL_QR.canvas(url,qr,logo,{logoWidth:width});}catch(error){if(!/finder clearance/.test(error.message))throw error;continue;}
      if(verifies(qr,url)&&verifies(resized(qr,Math.round(d.size*960/1672)),url)&&verifies(resized(qr,240),url))break;
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(width<Math.ceil(d.size*.15))throw new Error('This Website link cannot be verified with the approved logo. Save a shorter official Website URL.');
    if(!stillCurrent())return null;
    canvas.width=master.naturalWidth;canvas.height=master.naturalHeight;
    const c=canvas.getContext('2d');c.drawImage(master,0,0);c.imageSmoothingEnabled=false;c.drawImage(qr,d.x,d.y);
    const only=document.createElement('canvas');only.width=only.height=1080;root.PIKOL_QR.canvas(url,only,logo,{logoWidth:width*1080/d.size});
    canvas.dataset.destination=url;canvas.dataset.template=type;canvas.dataset.logoWidth=String(width);
    return {qr:only,metadata:{...metadata,sampleLogoWidth:d.logoWidth,verifiedAt:['native','960px poster equivalent','240px QR phone preview']}};
  }
  function init(context){
    const q=id=>document.getElementById(id),select=q('promo-qr-destination'),generate=q('btn-generate-promo-qr'),download=q('btn-download-promo-qr'),copy=q('btn-copy-promo-link'),qrOnly=q('btn-download-qr-only'),canvas=q('promo-qr-canvas'),result=q('promo-qr-result'),status=q('promo-qr-status');
    if(!select)return;let ready=null,epoch=0;
    // The approved artwork owns its fixed branding. Only the saved public Website is dynamic.
    const snapshot=()=>String(context.getSettings().website||'');
    function invalidate(){++epoch;ready=null;result.hidden=true;download.disabled=copy.disabled=qrOnly.disabled=true;q('promo-qr-link').removeAttribute('href');q('promo-qr-link').textContent='';status.textContent='Generate the approved '+templates[select.value].name+' artwork.';}
    function current(){if(!ready||ready.type!==select.value||ready.snapshot!==snapshot()){invalidate();context.toast('Generate the current destination with your saved Website first.','info');return null;}return ready;}
    select.addEventListener('change',invalidate);
    generate.onclick=async()=>{
      invalidate();const version=epoch,type=select.value,stamp=snapshot();generate.disabled=true;generate.textContent='Generating…';status.textContent='Loading approved artwork and checking the QR…';
      const stillCurrent=()=>version===epoch&&type===select.value&&stamp===snapshot();
      try{
        const url=destinationUrl(stamp,type),output=await composite(canvas,type,url,stillCurrent);if(!output)return;
        ready={type,url,snapshot:stamp,...output};q('promo-qr-title').textContent=templates[type].name+' · '+canvas.width+' × '+canvas.height;
        q('promo-qr-link').href=url;q('promo-qr-link').textContent=url;result.hidden=false;download.disabled=copy.disabled=qrOnly.disabled=false;
        status.textContent='Ready · Approved artwork · QR verified at full and reduced sizes.';
      }catch(error){if(version===epoch){ready=null;status.textContent=error.message;context.toast(error.message,'error');}}
      finally{generate.disabled=false;generate.textContent='Generate Advertisement';}
    };
    function save(target,name){target.toBlob(blob=>{if(!blob){context.toast('PNG export failed. Generate again.','error');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.download=name;a.href=url;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);},'image/png');}
    download.onclick=()=>{const r=current();if(r)save(canvas,'PIKOL-'+r.type.toUpperCase()+'-'+canvas.width+'x'+canvas.height+'.png');};
    qrOnly.onclick=()=>{const r=current();if(r)save(r.qr,'PIKOL-'+r.type.toUpperCase()+'-QR.png');};
    copy.onclick=async()=>{const r=current();if(!r)return;try{await navigator.clipboard.writeText(r.url);context.toast('Destination link copied.','success');}catch(_){context.toast('Select and copy the destination link below the preview.','info');}};
    setInterval(()=>{if(ready&&ready.snapshot!==snapshot())invalidate();},1000);
    root.PikolPromo.invalidate=invalidate;
  }
  root.PikolPromo={init,destinationUrl,templates,composite};
})(window);
