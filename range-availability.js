/* Rendering helpers only. All occupancy and final validation come from the API. */
(function (global) {
  'use strict';
  function minutes(t) { return Number(t.slice(0,2))*60+Number(t.slice(3,5)); }
  function duration(a,b) { return (b==='00:00'?1440:minutes(b))-minutes(a); }
  function ends(court,start) {
    if(!court||!start)return [];
    var result=[],cursor=start,started=false;
    for(var slot of court.slots||[]) {
      if(!started && slot.start!==start)continue;
      started=true;
      if(slot.start!==cursor || !(slot.bookable===undefined?slot.status==='available':slot.bookable))break;
      result.push(slot.end);cursor=slot.end;
    }
    return result;
  }
  function intersection(data,ids) {
    var courts=ids.map(id=>(data.courts||[]).find(c=>Number(c.id)===Number(id)));
    if(!courts.length||courts.some(c=>!c))return {slots:[]};
    return {slots:courts[0].slots.map(slot=>Object.assign({},slot,{
      bookable:courts.every(c=>c.status==='active'&&c.slots.some(s=>s.start===slot.start&&s.end===slot.end&&s.bookable))
    }))};
  }
  function bind(opts) {
    var serial=0,current={slots:[]};
    var start=opts.start,end=opts.end,box=opts.box;
    function validEnds(time) { return ends(current,time).filter(t=>!opts.duration||duration(time,t)===opts.duration); }
    function syncEnd() {
      var previous=end.value,values=validEnds(start.value);
      end.innerHTML='<option value="">Select end time</option>'+values.map(t=>'<option value="'+t+'">'+opts.label(t)+'</option>').join('');
      end.value=values.includes(previous)?previous:(opts.duration&&values.length?values[0]:'');
      end.disabled=!values.length||!!opts.duration;
      paint();
    }
    function paint() {
      if(!box)return;
      box.innerHTML='<div class="range-grid">'+current.slots.map(s=>{
        var selected=start.value&&end.value&&minutes(s.start)>=minutes(start.value)&&minutes(s.start)<(end.value==='00:00'?1440:minutes(end.value));
        return '<span class="range-slot'+(s.bookable?'':' is-unavailable')+(selected?' is-selected':'')+'">'+opts.label(s.start)+'<small>'+(s.bookable?'Available':'Unavailable')+'</small></span>';
      }).join('')+'</div><p class="tiny muted" aria-live="polite">'+(start.value&&end.value?opts.label(start.value)+' – '+opts.label(end.value):'Choose a continuously available range across all selected courts.')+'</p>';
    }
    async function refresh() {
      var ticket=++serial,oldStart=start.value,oldEnd=end.value;
      start.disabled=end.disabled=true;start.innerHTML=end.innerHTML='<option value="">Loading availability…</option>';
      try {
        var data=await opts.load();if(ticket!==serial||!start.isConnected)return;
        current=intersection(data,opts.courts());
        var starts=current.slots.filter(s=>s.bookable&&validEnds(s.start).length).map(s=>s.start);
        start.innerHTML='<option value="">Select start time</option>'+starts.map(t=>'<option value="'+t+'">'+opts.label(t)+'</option>').join('');
        start.disabled=!starts.length;start.value=starts.includes(oldStart)?oldStart:'';
        end.innerHTML='<option value="'+oldEnd+'"></option>';syncEnd();
      } catch(e) {if(ticket!==serial)return;current={slots:[]};start.innerHTML=end.innerHTML='<option value="">Availability unavailable</option>';if(box)box.textContent=e.message;}
    }
    start.addEventListener('change',syncEnd);end.addEventListener('change',paint);
    (opts.watch||[]).forEach(el=>el.addEventListener('change',refresh));
    function live(){if(start.isConnected)refresh();else global.removeEventListener('pikol:availability',live);}
    global.addEventListener('pikol:availability',live);refresh();
    return {refresh:refresh};
  }
  global.PikolAvailability={ends:ends,intersection:intersection,duration:duration,minutes:minutes,bind:bind};
})(window);
