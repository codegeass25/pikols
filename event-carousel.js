/* PIKOL event selectors: native scroll-snap, shared by Open Play and Tournament.
   No API calls, registration logic, or server changes. */
(function(root){
  'use strict';
  const mobile=()=>root.matchMedia('(max-width:767px)').matches;
  const motion=()=>root.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
  const visible=(track,selector)=>Array.from(track.querySelectorAll(selector)).filter(el=>!el.hidden&&root.getComputedStyle(el).display!=='none');
  function mount(options){
    const track=options.track;
    if(!track)return null;
    if(track._pikolEventPeek){track._pikolEventPeek.refresh(options);return track._pikolEventPeek;}
    track.classList.add('pikol-peek-track');
    track.setAttribute('aria-label',options.label+' event selector');
    const nav=document.createElement('div');
    nav.className='pikol-peek-nav';
    nav.setAttribute('aria-label',options.label+' carousel navigation');
    nav.innerHTML='<strong class="pikol-peek-total"></strong><div class="pikol-peek-controls"><button type="button" class="pikol-peek-arrow" data-peek-prev aria-label="Previous event">&#8249;</button><span class="pikol-peek-dots" role="group" aria-label="Choose event"></span><button type="button" class="pikol-peek-arrow" data-peek-next aria-label="Next event">&#8250;</button></div><span class="pikol-peek-position" aria-live="polite"></span>';
    track.insertAdjacentElement('afterend',nav);
    let opts=options, current='',timer=null, programmatic=false, guard=0, touch=null;
    const cards=()=>visible(track,opts.cardSelector);
    const id=card=>String(card?.dataset.peekId||'');
    function index(){const found=cards().findIndex(c=>id(c)===current);return found<0?0:found;}
    function updateUI(){
      const all=cards(),n=all.length,i=n?index():0;
      nav.querySelector('.pikol-peek-total').textContent=n+' '+opts.label+(n===1?'':'s');
      nav.querySelector('.pikol-peek-position').textContent=n?(i+1)+' / '+n:'0 / 0';
      const controls=nav.querySelector('.pikol-peek-controls');
      controls.hidden=n<=1;
      nav.querySelector('[data-peek-prev]').disabled=!n||i===0;
      nav.querySelector('[data-peek-next]').disabled=!n||i===n-1;
      const dots=nav.querySelector('.pikol-peek-dots');
      dots.replaceChildren();
      // Limit dot rows on unusually large event lists; numeric counter always shows all.
      if(n<=12)all.forEach((card,j)=>{
        const b=document.createElement('button');b.type='button';b.className='pikol-peek-dot';
        b.dataset.peekIndex=String(j);b.setAttribute('aria-label','Show '+opts.label+' '+(j+1)+' of '+n);
        b.setAttribute('aria-current',String(i===j));dots.appendChild(b);
      });
      Array.from(track.querySelectorAll(opts.cardSelector)).forEach(card=>{
        const active=!card.hidden&&id(card)===current;
        card.classList.toggle('is-selected',active);
        card.setAttribute('aria-current',active?'true':'false');
      });
    }
    function activate(card,notify){
      if(!card)return;
      const next=id(card),changed=current!==next;
      current=next;
      updateUI();
      if(changed&&notify&&typeof opts.onSelect==='function')opts.onSelect(next);
    }
    function align(card,behavior){
      if(!mobile()||!card)return;
      const left=track.scrollLeft+card.getBoundingClientRect().left-track.getBoundingClientRect().left;
      if(Math.abs(left-track.scrollLeft)>2){programmatic=true;track.scrollTo({left:Math.max(0,left),behavior:behavior||'auto'});
        root.clearTimeout(timer);timer=root.setTimeout(()=>{programmatic=false;},behavior==='smooth'?550:70);}
    }
    function at(i){const all=cards(),card=all[Math.max(0,Math.min(i,all.length-1))];if(!card)return;activate(card,true);align(card,motion());}
    function updateFromScroll(){
      if(programmatic||!mobile())return;
      const all=cards();if(!all.length)return;
      const left=track.getBoundingClientRect().left;
      let found=all[0],distance=Infinity;
      for(const card of all){const d=Math.abs(card.getBoundingClientRect().left-left);if(d<distance){distance=d;found=card;}}
      activate(found,true);
    }
    track.addEventListener('scroll',()=>{if(!mobile()||programmatic)return;root.clearTimeout(timer);timer=root.setTimeout(updateFromScroll,90);},{passive:true});
    // On Android Chrome/PWA, a horizontal gesture must never trigger card navigation.
    track.addEventListener('touchstart',e=>{if(e.touches.length===1){touch={x:e.touches[0].clientX,y:e.touches[0].clientY};programmatic=false;}},{passive:true});
    track.addEventListener('touchmove',e=>{if(!touch||e.touches.length!==1)return;const x=Math.abs(e.touches[0].clientX-touch.x),y=Math.abs(e.touches[0].clientY-touch.y);if(x>9&&x>y*1.2)guard=Date.now()+420;},{passive:true});
    track.addEventListener('touchend',()=>{touch=null;},{passive:true});
    track.addEventListener('click',e=>{if(Date.now()<guard&&e.target.closest(opts.cardSelector)){e.preventDefault();e.stopImmediatePropagation();}},true);
    nav.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.hasAttribute('data-peek-prev'))at(index()-1);
      else if(b.hasAttribute('data-peek-next'))at(index()+1);
      else if(b.hasAttribute('data-peek-index'))at(Number(b.dataset.peekIndex));
    });
    const ctrl={
      refresh(newOpts){opts=newOpts;const all=cards();
        const chosen=all.find(c=>id(c)===String(opts.selectedId||current))||all.find(c=>id(c)===current)||all[0];
        current=id(chosen);updateUI();align(chosen,'auto');
        if(chosen&&String(opts.selectedId||'')!==current&&typeof opts.onSelect==='function')opts.onSelect(current);
      },
      select(next,scroll=true){const chosen=cards().find(c=>id(c)===String(next));if(!chosen)return;activate(chosen,false);if(scroll)align(chosen,motion());},
      filterChanged(){const all=cards(),chosen=all.find(c=>id(c)===current)||all[0];if(!chosen){current='';updateUI();return;}activate(chosen,true);align(chosen,'auto');},
      get selectedId(){return current;}
    };
    track._pikolEventPeek=ctrl;ctrl.refresh(options);
    return ctrl;
  }
  // Keep horizontal touch gestures enabled only while the Events sheet is visible.
  function syncTouch(){
    const sheet=document.getElementById('tab-tournaments'),overlay=document.getElementById('site-overlay');
    if(!sheet||!overlay)return;
    const active=!sheet.classList.contains('hidden')&&!overlay.classList.contains('hidden');
    document.body.classList.toggle('pikol-event-peek-active',active);
    overlay.classList.toggle('pikol-event-peek-active',active);
  }
  function watch(){
    const sheet=document.getElementById('tab-tournaments'),overlay=document.getElementById('site-overlay');
    if(!sheet||!overlay)return;
    const observer=new MutationObserver(syncTouch);
    observer.observe(sheet,{attributes:true,attributeFilter:['class']});
    observer.observe(overlay,{attributes:true,attributeFilter:['class']});
    syncTouch();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();
  root.PikolEventPeek={mount};
})(window);
