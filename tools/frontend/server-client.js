
  // ===== Server-Anbindung (SQLite + OIDC) =====
  // Wird vom Patch-Skript angefügt. Aktiv nur, wenn /api/me antwortet; beim Öffnen
  // per file:// oder von einem reinen Dateiserver bleibt der Planer unverändert.
  const server=(()=>{
    const S={enabled:false,planId:null,planName:"",version:0,lastSaved:"",saving:false,conflict:false,dirtySince:null,permission:"owner"};
    const readOnly=()=>S.planId!=null&&S.permission==="viewer";
    const PERM_LABEL={owner:"Besitzer",editor:"Bearbeiter",viewer:"Betrachter"};
    const $q=s=>document.querySelector(s);
    const bar=$q("#serverBar"),statusEl=$q("#serverStatus"),userEl=$q("#serverUser");
    const plansModal=$q("#plansModal"),plansList=$q("#plansList");
    const AUTOSAVE_AFTER_MS=3000,TICK_MS=1500;

    const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
    const fmt=iso=>{try{return new Date(iso).toLocaleString("de-DE",{dateStyle:"short",timeStyle:"short"})}catch(e){return iso||""}};
    const current=()=>JSON.stringify(buildPayload());
    const isDirty=()=>S.planId!=null&&!readOnly()&&current()!==S.lastSaved;
    const nameOf=()=>(state.projectName||"").trim()||S.planName||"Unbenannter Plan";

    function setStatus(text,kind){
      if(!statusEl)return;
      statusEl.textContent=text;
      statusEl.className="server-status"+(kind?" "+kind:"");
    }
    function showRelogin(){
      if(!statusEl)return;
      statusEl.className="server-status err";
      statusEl.textContent="Sitzung abgelaufen – ";
      const a=el("a",null,"neu anmelden");
      a.href="/login?redirect=%2F";a.target="_blank";a.rel="noopener";
      statusEl.append(a);
    }

    async function req(method,url,body){
      const opt={method,credentials:"same-origin",headers:{"X-HV-Client":"1"}};
      if(body!==undefined){opt.headers["Content-Type"]="application/json";opt.body=JSON.stringify(body)}
      const r=await fetch(url,opt);
      let data=null;try{data=await r.json()}catch(e){}
      if(!r.ok){const err=new Error((data&&data.error)||("HTTP "+r.status));err.status=r.status;err.data=data;throw err}
      return data;
    }

    function refreshStatus(){
      if(S.saving||S.conflict)return;
      if(S.planId==null){setStatus(state.devices.length?"Nicht auf dem Server gespeichert":"","dirty");return}
      if(readOnly()){setStatus("Nur lesen – Änderungen werden nicht gespeichert","dirty");return}
      if(current()!==S.lastSaved)setStatus("Ungespeicherte Änderungen","dirty");
    }

    function detach(){
      S.planId=null;S.planName="";S.version=0;S.lastSaved="";S.conflict=false;S.dirtySince=null;S.permission="owner";
      refreshStatus();
    }

    async function save(opts={}){
      if(!S.enabled||S.saving)return false;
      if(readOnly()){setStatus("Nur lesen – Änderungen werden nicht gespeichert","dirty");return false}
      if(S.planId==null&&opts.manual&&!(state.projectName||"").trim()){
        const n=prompt("Name des Plans:","Zählerschrank");
        if(!n||!n.trim())return false;
        state.projectName=n.trim().slice(0,80);els.projectName.value=state.projectName;renderProjectTitles();
      }
      const payload=buildPayload(),str=JSON.stringify(payload);
      S.saving=true;setStatus("Speichern …");
      try{
        let res;
        if(S.planId==null){
          res=await req("POST","/api/plans",{name:nameOf(),data:payload});
          S.planId=res.id;
        }else{
          res=await req("PUT","/api/plans/"+S.planId,{name:nameOf(),data:payload,version:S.version});
        }
        S.version=res.version;S.planName=nameOf();S.lastSaved=str;S.conflict=false;S.dirtySince=null;
        setStatus("Gespeichert "+new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}),"ok");
        return true;
      }catch(e){
        if(e.status===401){showRelogin();return false}
        if(e.status===409){
          S.conflict=true;
          setStatus("Konflikt: Plan wurde anderswo geändert","err");
          if(opts.manual&&confirm("Dieser Plan wurde zwischenzeitlich von jemand anderem oder in einem anderen Tab geändert.\n\nOK = meine Version trotzdem speichern (überschreibt die andere)\nAbbrechen = nichts speichern")){
            S.version=e.data.version;S.saving=false;S.conflict=false;
            return save(opts);
          }
          return false;
        }
        setStatus("Speichern fehlgeschlagen: "+e.message,"err");
        return false;
      }finally{S.saving=false}
    }

    async function openPlan(id,historyId){
      if(S.planId!=null&&isDirty()){
        if(!await save({manual:true})&&!confirm("Der aktuelle Plan konnte nicht gespeichert werden. Trotzdem wechseln?"))return false;
      }else if(S.planId==null&&state.devices.length&&!confirm("Der aktuelle Plan ist nicht auf dem Server gespeichert und geht verloren. Fortfahren?")){
        return false;
      }
      try{
        const p=await req("GET","/api/plans/"+id);
        let data=p.data;
        if(historyId){
          const h=await req("GET","/api/plans/"+id+"/history/"+historyId);
          data=h.data;
        }
        applyLoadedData(data);
        if(!(state.projectName||"").trim()){state.projectName=p.name;els.projectName.value=p.name;renderProjectTitles()}
        S.planId=p.id;S.planName=p.name;S.version=p.version;S.conflict=false;S.dirtySince=null;S.permission=p.permission||"owner";
        // Eine wiederhergestellte Version gilt als geändert und wird beim nächsten Autosave neu gespeichert.
        S.lastSaved=historyId?"":current();
        if(historyId)setStatus("Ältere Version geladen – wird gespeichert …","dirty");
        else if(readOnly())refreshStatus();
        else setStatus("Geladen","ok");
        return true;
      }catch(e){
        if(e.status===401)showRelogin();
        else alert("Plan konnte nicht geladen werden: "+e.message);
        return false;
      }
    }

    function openPlans(){plansModal.hidden=false;document.body.style.overflow="hidden";renderPlans()}
    function closePlans(){plansModal.hidden=true;document.body.style.overflow=""}

    async function renderPlans(){
      plansList.replaceChildren(el("p","hint","Lade …"));
      let list;
      try{list=await req("GET","/api/plans")}
      catch(e){plansList.replaceChildren(el("p","hint","Pläne konnten nicht geladen werden: "+e.message));return}
      plansList.replaceChildren();
      if(!list.length){
        plansList.append(el("p","hint","Noch keine Pläne auf dem Server. Plan im Editor anlegen und „Speichern“ klicken."));
        return;
      }
      for(const p of list){
        const row=el("div","plan-row"+(p.id===S.planId?" current":""));
        const info=el("div","plan-info");
        const title=el("strong",null,p.name);
        info.append(title);
        if(!p.mine)title.append(el("span","plan-badge",PERM_LABEL[p.permission]||""));
        const bits=["Version "+p.version,"geändert "+fmt(p.updated_at)];
        if(p.updated_by)bits.push("von "+p.updated_by);
        if(!p.mine&&p.owner_name)bits.push("Besitzer: "+p.owner_name);
        info.append(el("span","hint",bits.join(" · ")));

        const actions=el("div","plan-actions");
        const openB=el("button",null,p.id===S.planId?"Geöffnet":"Öffnen");
        openB.type="button";openB.disabled=p.id===S.planId;
        openB.onclick=async()=>{if(await openPlan(p.id))closePlans()};
        actions.append(openB);

        const hist=el("div","plan-history");hist.hidden=true;
        if(p.permission!=="viewer"){
          const histB=el("button",null,"Verlauf");histB.type="button";
          histB.onclick=async()=>{
            if(!hist.hidden){hist.hidden=true;return}
            hist.hidden=false;share.hidden=true;hist.replaceChildren(el("span","hint","Lade …"));
            try{
              const versions=await req("GET","/api/plans/"+p.id+"/history");
              hist.replaceChildren();
              if(!versions.length)hist.append(el("span","hint","Noch keine älteren Versionen."));
              for(const v of versions){
                const line=el("div","history-line");
                line.append(el("span",null,"Version "+v.version+" · "+fmt(v.saved_at)+(v.saved_by?" · "+v.saved_by:"")));
                const b=el("button",null,"Wiederherstellen");b.type="button";
                b.onclick=async()=>{
                  if(!confirm("Version "+v.version+" vom "+fmt(v.saved_at)+" wiederherstellen?\nSie wird als neue Version gespeichert; der aktuelle Stand bleibt im Verlauf erhalten."))return;
                  if(await openPlan(p.id,v.id))closePlans();
                };
                line.append(b);hist.append(line);
              }
            }catch(e){hist.replaceChildren(el("span","hint","Fehler: "+e.message))}
          };
          actions.append(histB);
        }

        const share=el("div","plan-history plan-share");share.hidden=true;
        if(p.mine){
          const shareB=el("button",null,"Teilen");shareB.type="button";
          shareB.onclick=()=>{if(!share.hidden){share.hidden=true;return}share.hidden=false;hist.hidden=true;renderShare(p,share)};
          actions.append(shareB);
          const delB=el("button","danger","Löschen");delB.type="button";
          delB.onclick=async()=>{
            if(!confirm("Plan „"+p.name+"“ samt Verlauf und Freigaben unwiderruflich löschen?"))return;
            try{
              await req("DELETE","/api/plans/"+p.id);
              if(p.id===S.planId)detach();
              renderPlans();
            }catch(e){alert("Löschen fehlgeschlagen: "+e.message)}
          };
          actions.append(delB);
        }else{
          const leaveB=el("button","danger","Verlassen");leaveB.type="button";
          leaveB.title="Freigabe für mich entfernen";
          leaveB.onclick=async()=>{
            if(!confirm("Freigabe von „"+p.name+"“ entfernen? Du siehst den Plan danach nicht mehr."))return;
            try{
              await req("DELETE","/api/plans/"+p.id+"/shares/"+encodeURIComponent(S.me.sub));
              if(p.id===S.planId)detach();
              renderPlans();
            }catch(e){alert("Fehlgeschlagen: "+e.message)}
          };
          actions.append(leaveB);
        }
        row.append(info,actions,hist,share);
        plansList.append(row);
      }
    }

    async function renderShare(p,box){
      box.replaceChildren(el("span","hint","Lade …"));
      let shares;
      try{shares=await req("GET","/api/plans/"+p.id+"/shares")}
      catch(e){box.replaceChildren(el("span","hint","Fehler: "+e.message));return}
      const permSelect=value=>{
        const sel=el("select");
        for(const k of ["viewer","editor"]){const o=el("option",null,PERM_LABEL[k]);o.value=k;if(k===value)o.selected=true;sel.append(o)}
        return sel;
      };
      const setShare=async(sub,permission)=>{
        try{await req("PUT","/api/plans/"+p.id+"/shares/"+encodeURIComponent(sub),{permission});renderShare(p,box)}
        catch(e){alert("Teilen fehlgeschlagen: "+e.message)}
      };

      box.replaceChildren(el("strong",null,"Geteilt mit"));
      if(!shares.length)box.append(el("span","hint","Noch mit niemandem geteilt."));
      for(const s of shares){
        const line=el("div","history-line");
        const who=el("span",null,s.name+(s.email?" · "+s.email:""));
        const sel=permSelect(s.permission);
        sel.onchange=()=>setShare(s.sub,sel.value);
        const rm=el("button","danger","Entfernen");rm.type="button";
        rm.onclick=async()=>{
          try{await req("DELETE","/api/plans/"+p.id+"/shares/"+encodeURIComponent(s.sub));renderShare(p,box)}
          catch(e){alert("Fehlgeschlagen: "+e.message)}
        };
        const right=el("span","share-controls");right.append(sel,rm);
        line.append(who,right);box.append(line);
      }

      box.append(el("strong","share-add-title","Nutzer hinzufügen"));
      const search=el("input");search.type="search";search.placeholder="Name oder E-Mail suchen";
      const results=el("div","share-results");
      box.append(search,results);
      let timer=null,seq=0;
      const load=async()=>{
        const my=++seq;
        let users;
        try{users=await req("GET","/api/users?q="+encodeURIComponent(search.value))}
        catch(e){results.replaceChildren(el("span","hint","Fehler: "+e.message));return}
        if(my!==seq)return;
        const have=new Set(shares.map(x=>x.sub));
        const avail=users.filter(u=>!have.has(u.sub));
        results.replaceChildren();
        if(!avail.length){results.append(el("span","hint",users.length?"Alle Treffer sind schon eingetragen.":"Keine Nutzer gefunden. Nutzer erscheinen hier, sobald sie sich einmal angemeldet haben."));return}
        for(const u of avail){
          const line=el("div","history-line");
          line.append(el("span",null,u.name+(u.email?" · "+u.email:"")));
          const sel=permSelect("viewer");
          const add=el("button",null,"Hinzufügen");add.type="button";
          add.onclick=()=>setShare(u.sub,sel.value);
          const right=el("span","share-controls");right.append(sel,add);
          line.append(right);results.append(line);
        }
      };
      search.oninput=()=>{clearTimeout(timer);timer=setTimeout(load,250)};
      load();
    }


    async function init(){
      if(location.protocol==="file:")return;
      let me;
      try{me=await req("GET","/api/me")}catch(e){return}
      S.enabled=true;S.me=me;
      bar.hidden=false;
      userEl.textContent=me.name||"";
      userEl.title=me.email||"";
      $q("#saveBtn").textContent="Export JSON";
      $q("#saveBtn").title="Plan als JSON-Datei herunterladen";
      const importLabel=document.querySelector("label.file-btn");
      if(importLabel&&importLabel.firstChild)importLabel.firstChild.textContent="Import JSON";

      $q("#plansBtn").onclick=openPlans;
      $q("#plansCloseBtn").onclick=closePlans;
      plansModal.onclick=ev=>{if(ev.target===plansModal)closePlans()};
      $q("#serverSaveBtn").onclick=()=>save({manual:true});
      $q("#plansNewBtn").onclick=async()=>{
        if(isDirty())await save({manual:true});
        closePlans();
        els.resetBtn.click(); // fragt nach, leert den Editor und löst die Verknüpfung zum Serverplan
      };
      $q("#logoutBtn").onclick=async()=>{
        if(isDirty()&&!await save({manual:true})&&!confirm("Ungespeicherte Änderungen gehen verloren. Trotzdem abmelden?"))return;
        try{await req("POST","/api/auth/logout")}catch(e){}
        S.enabled=false;
        location.href="/login?loggedout=1";
      };

      document.addEventListener("keydown",ev=>{
        if(ev.key==="Escape"&&!plansModal.hidden)closePlans();
        if((ev.ctrlKey||ev.metaKey)&&ev.key.toLowerCase()==="s"){ev.preventDefault();save({manual:true})}
      });
      window.addEventListener("beforeunload",ev=>{
        if(S.enabled&&(isDirty()||(S.planId==null&&state.devices.length))){ev.preventDefault();ev.returnValue=""}
      });

      // Autosave: Änderungen erkennen, indem der Planstand mit dem zuletzt gespeicherten verglichen wird.
      setInterval(()=>{
        if(!S.enabled||S.saving||S.planId==null)return;
        if(current()===S.lastSaved){S.dirtySince=null;return}
        if(S.dirtySince==null)S.dirtySince=Date.now();
        if(S.conflict){return}
        if(Date.now()-S.dirtySince>=AUTOSAVE_AFTER_MS)save();
        else setStatus("Ungespeicherte Änderungen","dirty");
      },TICK_MS);
      setInterval(()=>{if(S.enabled&&S.planId==null)refreshStatus()},TICK_MS*2);

      if(!state.devices.length)openPlans();
    }

    return {init,detach,_state:S};
  })();
  server.init();
