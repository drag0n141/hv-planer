  // Touch: Geräte per langem Drücken greifen und auf eine Reihe ziehen (HTML5-Drag&Drop funktioniert auf Touch-Geräten nicht zuverlässig)
  function attachTouchDrag(el,d){
    let timer=null,active=false,sx=0,sy=0,target=null;
    const railAt=(x,y)=>{const e=document.elementFromPoint(x,y);return e&&e.closest?e.closest(".rail"):null};
    const calc=(rail,clientX,f,r)=>{
      const rect=rail.getBoundingClientRect();
      let x=snapX(d,(clientX-rect.left)/screenPxPerMM());
      x=magneticSnapToEdges(d,f,r,x,d.id);
      return Math.max(0,Math.min(railMM()-widthMM(d),x));
    };
    const end=()=>{clearTimeout(timer);timer=null;if(active){active=false;el.classList.remove("touch-dragging");clearSnapGuides()}target=null};
    el.addEventListener("touchstart",ev=>{
      if(ev.touches.length!==1)return;
      el.draggable=false;
      const t=ev.touches[0];sx=t.clientX;sy=t.clientY;
      timer=setTimeout(()=>{active=true;el.classList.add("touch-dragging");state.selectedDeviceId=d.id;if(navigator.vibrate)try{navigator.vibrate(15)}catch(e){}},300);
    },{passive:true});
    el.addEventListener("touchmove",ev=>{
      const t=ev.touches[0];
      if(!active){if(Math.hypot(t.clientX-sx,t.clientY-sy)>8){clearTimeout(timer);timer=null}return}
      ev.preventDefault();
      const rail=railAt(t.clientX,t.clientY);
      if(rail&&rail.dataset.field!==undefined){
        const f=Number(rail.dataset.field),r=Number(rail.dataset.row);
        target={f,r,x:calc(rail,t.clientX,f,r)};showSnapGuide(rail,target.x);
      }else{target=null;clearSnapGuides()}
    },{passive:false});
    el.addEventListener("touchend",ev=>{
      const hit=active&&target?target:null;
      if(active)ev.preventDefault();
      end();
      if(hit)moveDevice(d,hit.f,hit.r,hit.x);
    });
    el.addEventListener("touchcancel",end);
    el.addEventListener("contextmenu",ev=>{if(active||timer)ev.preventDefault()});
  }
