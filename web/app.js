
(() => {
  const TE_MM = 18;
  const TE_PX = window.innerWidth >= 2200 ? 56 : 48;
  document.documentElement.style.setProperty("--tew", `${TE_PX}px`);
  const PX_PER_MM = TE_PX / TE_MM;
  const ZOOM_PX_PER_MM = 4.0;

  const palette = Array.isArray(window.HV_COMPONENTS) ? window.HV_COMPONENTS : [];

  if(!palette.length){
    throw new Error("HV-Komponentenbibliothek components.js konnte nicht geladen werden.");
  }

  const state={fields:2,rows:5,te:12,viewScale:100,autoJump:true,insertStatus:"existing",projectName:"",externalSources:[],nextSourceId:-1,selectedPalette:null,selectedDeviceId:null,devices:[],nextId:1,
    openPaletteCategories:new Set(["Schutzgeräte"]),phaseStarts:{},rowRailModes:{}};

  const $=s=>document.querySelector(s);
  const els={
    fieldCount:$("#fieldCount"),rowCount:$("#rowCount"),teCount:$("#teCount"),projectName:$("#projectName"),sourcesBtn:$("#sourcesBtn"),sourcesCount:$("#sourcesCount"),sourcesModal:$("#sourcesModal"),sourcesList:$("#sourcesList"),addSourceBtn:$("#addSourceBtn"),closeSourcesBtn:$("#closeSourcesBtn"),viewScale:$("#viewScale"),viewScaleValue:$("#viewScaleValue"),viewScaleReset:$("#viewScaleReset"),autoJump:$("#autoJump"),insertStatus:$("#insertStatus"),balancePhasesBtn:$("#balancePhasesBtn"),
    paletteList:$("#paletteList"),board:$("#board"),statusBar:$("#statusBar"),selectionInfo:$("#selectionInfo"),
    deviceTableBody:$("#deviceTableBody"),deviceCountBadge:$("#deviceCountBadge"),printListTitle:$("#printListTitle"),zoomRail:$("#zoomRail"),zoomRailWrap:$("#zoomRailWrap"),zoomRailTitle:$("#zoomRailTitle"),
    emptyProps:$("#emptyProps"),propsForm:$("#propsForm"),propLabel:$("#propLabel"),propTech:$("#propTech"),propStatus:$("#propStatus"),
    propWidth:$("#propWidth"),propWidthMM:$("#propWidthMM"),teWidthLabel:$("#teWidthLabel"),mmWidthLabel:$("#mmWidthLabel"),customWidthControls:$("#customWidthControls"),widthMinusBtn:$("#widthMinusBtn"),widthPlusBtn:$("#widthPlusBtn"),
    propGroup:$("#propGroup"),propPhase:$("#propPhase"),propInputFrom:$("#propInputFrom"),singleInputLabel:$("#singleInputLabel"),changeInputs:$("#changeInputs"),neutralBinding:$("#neutralBinding"),outputTargets:$("#outputTargets"),
    duplicateBtn:$("#duplicateBtn"),deleteBtn:$("#deleteBtn"),summary:$("#summary"),undoBtn:$("#undoBtn"),redoBtn:$("#redoBtn"),checkBtn:$("#checkBtn"),checkModal:$("#checkModal"),checkContent:$("#checkContent"),closeCheckBtn:$("#closeCheckBtn"),
    saveBtn:$("#saveBtn"),loadInput:$("#loadInput"),printListBtn:$("#printListBtn"),bomBtn:$("#bomBtn"),bomModal:$("#bomModal"),bomContent:$("#bomContent"),bomCsvBtn:$("#bomCsvBtn"),bomOnlyNew:$("#bomOnlyNew"),printBomBtn:$("#printBomBtn"),closeBomBtn:$("#closeBomBtn"),schematicBtn:$("#schematicBtn"),schematicModal:$("#schematicModal"),schematicContent:$("#schematicContent"),printSchematicBtn:$("#printSchematicBtn"),closeSchematicBtn:$("#closeSchematicBtn"),circuitBtn:$("#circuitBtn"),circuitModal:$("#circuitModal"),circuitContent:$("#circuitContent"),printCircuitBtn:$("#printCircuitBtn"),closeCircuitBtn:$("#closeCircuitBtn"),helpBtn:$("#helpBtn"),helpModal:$("#helpModal"),closeHelpBtn:$("#closeHelpBtn"),aboutBtn:$("#aboutBtn"),aboutModal:$("#aboutModal"),closeAboutBtn:$("#closeAboutBtn"),resetBtn:$("#resetBtn")
  };

  const history={undo:[],redo:[],limit:80,lastKey:"",lastAt:0,restoring:false};
  function historyState(){return {fields:state.fields,rows:state.rows,te:state.te,projectName:state.projectName,externalSources:structuredClone(state.externalSources||[]),nextSourceId:state.nextSourceId,phaseStarts:structuredClone(state.phaseStarts||{}),rowRailModes:structuredClone(state.rowRailModes||{}),devices:structuredClone(state.devices||[]),nextId:state.nextId,insertStatus:state.insertStatus};}
  function historyJson(){return JSON.stringify(historyState())}
  function pushHistory(key="",coalesceMs=0){
    if(history.restoring)return;
    const now=Date.now();
    if(coalesceMs&&history.lastKey===key&&now-history.lastAt<coalesceMs){history.lastAt=now;return}
    const snap=historyJson();
    if(history.undo[history.undo.length-1]!==snap) history.undo.push(snap);
    if(history.undo.length>history.limit) history.undo.shift();
    history.redo=[];history.lastKey=key;history.lastAt=now;updateHistoryButtons();
  }
  function restoreHistorySnapshot(raw){
    const s=JSON.parse(raw);history.restoring=true;
    state.fields=s.fields;state.rows=s.rows;state.te=s.te;state.projectName=s.projectName||"";state.externalSources=s.externalSources||[];state.nextSourceId=Number(s.nextSourceId)||-1;state.phaseStarts=s.phaseStarts||{};state.rowRailModes=s.rowRailModes||{};state.devices=s.devices||[];state.nextId=s.nextId||1;state.insertStatus=s.insertStatus||"existing";state.selectedDeviceId=null;
    els.projectName.value=state.projectName;els.fieldCount.value=String(state.fields);els.rowCount.value=String(state.rows);els.teCount.value=String(state.te);if(els.insertStatus)els.insertStatus.value=state.insertStatus;renderProjectTitles();renderAll();history.restoring=false;updateHistoryButtons();
  }
  function undo(){if(!history.undo.length)return;history.redo.push(historyJson());restoreHistorySnapshot(history.undo.pop())}
  function redo(){if(!history.redo.length)return;history.undo.push(historyJson());restoreHistorySnapshot(history.redo.pop())}
  function updateHistoryButtons(){if(els.undoBtn)els.undoBtn.disabled=!history.undo.length;if(els.redoBtn)els.redoBtn.disabled=!history.redo.length}

  function paletteMeta(type){return palette.find(p=>p.type===type)||{}}
  function isSurgeDevice(d){return !!d && paletteMeta(d.type).colorRole==="surge"}
  function isTerminal(d){
    return !!d && !!paletteMeta(d.type).terminal;
  }
  function usesMMWidth(d){
    if(!d) return false;
    const meta=d.type ? paletteMeta(d.type) : d;
    const own=Number(d.widthMM);
    const preset=Number(meta.widthMM);
    return Number.isFinite(own) && own>0 || Number.isFinite(preset) && preset>0;
  }
  function railMM(){return state.te*TE_MM}
  function viewScaleFactor(){return Math.max(.6,Math.min(2.5,Number(state.viewScale||100)/100))}
  function screenPxPerMM(){return PX_PER_MM*viewScaleFactor()}
  function applyBoardViewScale(){
    const pct=Math.max(60,Math.min(250,Math.round(Number(state.viewScale||100)/5)*5));
    state.viewScale=pct;
    if(els.board) els.board.style.zoom=String(pct/100);
    if(els.viewScale) els.viewScale.value=String(pct);
    if(els.viewScaleValue) els.viewScaleValue.textContent=`${pct} %`;
  }
  function widthMM(d){
    if(usesMMWidth(d)){
      const own=Number(d.widthMM);
      if(Number.isFinite(own) && own>0) return own;
      const preset=Number(paletteMeta(d.type).widthMM);
      if(Number.isFinite(preset) && preset>0) return preset;
    }
    return Number(d.widthTE||paletteMeta(d.type).widthTE||1)*TE_MM;
  }
  function xMM(d){return Number(d.xMM||0)}
  function getDevice(id){return state.devices.find(d=>d.id===id) || state.externalSources.find(d=>d.id===id)}
  function isExternalSource(d){return !!d && d.externalSource===true}
  function externalSourcePorts(){return [
    {id:"L1",label:"L1",phase:"L1",maxTargets:Infinity},
    {id:"L2",label:"L2",phase:"L2",maxTargets:Infinity},
    {id:"L3",label:"L3",phase:"L3",maxTargets:Infinity},
    {id:"N",label:"N",phase:"N",maxTargets:Infinity},
    {id:"PE",label:"PE",phase:"PE",maxTargets:Infinity}
  ]}
  function sourceCandidates(excludeId=null){return [...state.externalSources,...orderedDevices()].filter(x=>x.id!==excludeId)}
  function sourceUiPrefix(src){return isExternalSource(src)?"Quelle":`F${src.field+1} R${src.row+1}`}

  function effectiveGroup(d, visited=new Set()){
    if(!d) return "";

    // Eine manuell gesetzte Gruppe hat Vorrang.
    const own=(d.group||"").trim();
    if(own) return own;

    // Schutz vor Schleifen.
    if(visited.has(d.id)) return "";
    visited.add(d.id);

    // Sonst die Gruppe entlang der logischen Einspeisung rückwärts übernehmen.
    if(d.inputFrom!=null){
      const src=getDevice(d.inputFrom);
      if(src) return effectiveGroup(src,new Set(visited));
    }

    return "";
  }
  function rcdForGroup(group){
    const g=String(group||"").trim();
    if(!g) return null;
    return orderedDevices().find(d=>
      (d.type==="rcd2" || d.type==="rcd4") &&
      effectiveGroup(d)===g
    ) || null;
  }

  function terminalNeedsRcdNeutral(d){
    return !!d && (d.type==="term3" || d.type==="termN");
  }

  function terminalNeutralSource(d){
    if(!terminalNeedsRcdNeutral(d)) return null;
    return rcdForGroup(effectiveGroup(d));
  }

  function phaseCompatibleForInput(target, inp, sourcePort){
    if(!inp || !sourcePort) return true;
    const meta=paletteMeta(target?.type);

    // Bei dafür freigegebenen 4-poligen Geräten dürfen die drei Außenleiter
    // untereinander auf L1/L2/L3 aufgelegt werden. N bleibt strikt N.
    if(meta.allowPhasePermutation){
      if(inp.phase==="N") return !sourcePort.phase || sourcePort.phase==="N";
      if(["L1","L2","L3"].includes(inp.phase)){
        return !sourcePort.phase || ["L1","L2","L3"].includes(sourcePort.phase);
      }
    }

    return !sourcePort.phase || !inp.phase || sourcePort.phase===inp.phase;
  }

  function repairGroupedHlakRcdInputs(d){
    if(!d?.multiInputs || !paletteMeta(d.type).allowPhasePermutation) return false;

    const nConn=d.multiInputs.N;
    if(!nConn) return false;
    const src=getDevice(Number(nConn.sourceId));
    if(!src || !["hlak5_1to3","hlak5_1to3_compact"].includes(src.type)) return false;

    const nMatch=String(nConn.sourcePort||"").match(/^N\.(\d+)$/);
    if(!nMatch) return false;
    const group=nMatch[1];

    const phases=["L1","L2","L3"];
    const conns=phases.map(ph=>d.multiInputs[ph]);
    if(conns.some(c=>!c || Number(c.sourceId)!==src.id)) return false;

    // Eine absichtliche Phasenpermutation benutzt weiterhin EINEN kompletten
    // Abgangssatz, z.B. L1<-L3.2, L2<-L1.2, L3<-L2.2. Das bleibt erhalten.
    const allSameGroup=conns.every(c=>String(c.sourcePort||"").endsWith(`.${group}`));
    if(allSameGroup) return false;

    // V6.38/V6.39 konnten alte Zuordnungen wie L1.1/L1.2/L1.3 auf einen
    // einzelnen RCD enthalten. Der N-Leiter (N.1/N.2/N.3) verrät eindeutig,
    // welcher komplette HLAK-Abgang gemeint war. Nur diesen klaren Altfall
    // korrigieren wir automatisch.
    const ports=conns.map(c=>String(c.sourcePort||""));
    const validLegacy=ports.every(pid=>/^(L1|L2|L3)\.\d+$/.test(pid));
    if(!validLegacy) return false;

    for(const ph of phases){
      d.multiInputs[ph]={sourceId:src.id,sourcePort:`${ph}.${group}`};
    }
    return true;
  }

  function mappedInputPhase(d, inputId, visited=new Set()){
    repairGroupedHlakRcdInputs(d);
    if(!d?.multiInputs) return null;
    const conn=d.multiInputs[inputId];
    if(!conn || visited.has(d.id)) return null;
    visited.add(d.id);

    const src=getDevice(Number(conn.sourceId));
    if(!src) return null;
    const port=sourcePorts(src,visited).find(p=>p.id===(conn.sourcePort||"OUT"));
    return port?.phase || null;
  }

  function sourcePorts(d, visited=new Set()){
    if(!d) return [{id:"OUT", label:"OUT", phase:null, maxTargets:1}];
    if(isExternalSource(d)) return externalSourcePorts();

    const meta=paletteMeta(d.type);
    const configured=Array.isArray(meta.outputs) && meta.outputs.length
      ? meta.outputs
      : [{id:"OUT", label:"OUT", phase:null, maxTargets:"unlimited"}];

    return configured.map(port=>{
      let phase=port.phase ?? null;
      if(phase==="source"){
        const p=devicePhase(d);
        phase=["L1","L2","L3","N"].includes(p)?p:null;
      }

      // Durchgangs-/Verteilbauteile (z. B. 5P-HLAK) übernehmen die reale
      // Phase ihres jeweiligen Eingangsleiters. Ein Ausgang L2.2 gehört zum
      // Eingangsleiter L2 und führt deshalb genau die Phase weiter, die am
      // HLAK-Eingang L2 tatsächlich anliegt. So bleibt die Phasenidentität
      // über vorgelagerte Geräte hinweg erhalten.
      if(meta.passthroughByConductor){
        const conductor=String(port.id||"").split(".")[0];
        if(["L1","L2","L3","N","PE"].includes(conductor)){
          phase=mappedInputPhase(d,conductor,new Set(visited)) || phase;
        }
      }

      // Bei einem RCD mit erlaubter Phasenpermutation trägt der Ausgang die
      // tatsächlich am gleichnamigen Eingang anliegende Phase. Beispiel:
      // Eingangsklemme L1 <- echte L3 => Ausgangsklemme L1 führt echte L3.
      if(meta.allowPhasePermutation && ["L1","L2","L3","N"].includes(port.id)){
        phase=mappedInputPhase(d,port.id,new Set(visited)) || phase;
      }

      return {
        ...port,
        phase,
        maxTargets:port.maxTargets==="unlimited" ? Infinity : Number(port.maxTargets ?? 1)
      };
    });
  }

  function inputPorts(d){
    if(!d || isExternalSource(d)) return [];
    const inputs=paletteMeta(d.type).inputs;
    return Array.isArray(inputs) ? inputs.map(port=>({...port})) : [];
  }

  function hasMultiInputs(dOrMeta){
    if(!dOrMeta) return false;
    const meta=dOrMeta.type ? paletteMeta(dOrMeta.type) : dOrMeta;
    return Array.isArray(meta.inputs) && meta.inputs.length>0;
  }

  function portUsageCount(srcId, portId, ignoreTargetId=null){
    let count=state.devices.filter(d =>
      d.id !== ignoreTargetId &&
      d.inputFrom === srcId &&
      (d.inputPort || "OUT") === portId
    ).length;

    // Mehrfacheingänge des Umschalters ebenfalls mitzählen.
    for(const d of state.devices){
      if(d.id===ignoreTargetId || !d.multiInputs) continue;

      for(const conn of Object.values(d.multiInputs)){
        if(conn && conn.sourceId===srcId && (conn.sourcePort||"OUT")===portId){
          count++;
        }
      }
    }

    return count;
  }

  function portAvailable(src, port, targetId=null){
    if(!src || !port) return false;
    if(port.maxTargets === Infinity) return true;
    return portUsageCount(src.id, port.id, targetId) < port.maxTargets;
  }

  function selectedSourcePortPhase(target, src){
    if(!target || !src) return null;

    // 1. Ein explizit gewählter Ausgangsport (L1/L2/L3/N) gewinnt immer.
    const portId = target.inputPort || "OUT";
    const port = sourcePorts(src).find(p=>p.id===portId);
    if(port && port.phase) return port.phase;

    // 2. Rückwärtskompatibilität / Automatik:
    // Ältere Pläne haben hinter einem 3-/4-poligen Gerät teilweise noch "OUT"
    // gespeichert. Bei einem 1-poligen Folgegerät bestimmen wir die Phase dann
    // wieder aus der Leiterfolge hinter dem mehrpoligen Gerät.
    const srcPhase=devicePhase(src);
    const meta=paletteMeta(target.type);
    const ownPoles=Number(target.widthTE||meta.widthTE||1);

    if(srcPhase==="3P" && ownPoles<3 && !isTerminal(target)){
      return phaseForRailSlot(
        target.field,
        target.row,
        Math.round(xMM(target)/TE_MM)
      );
    }

    return null;
  }
  function orderedDevices(){return [...state.devices].sort((a,b)=>a.field-b.field||a.row-b.row||xMM(a)-xMM(b)||a.id-b.id)}

  function renderPalette(){
    els.paletteList.innerHTML="";
    const groups=new Map();
    palette.forEach((p,idx)=>{
      const category=p.category||"Sonstiges";
      if(!groups.has(category)) groups.set(category,[]);
      groups.get(category).push({p,idx});
    });

    groups.forEach((items,category)=>{
      const details=document.createElement("details");
      details.className="palette-category";
      details.open=state.openPaletteCategories.has(category) || items.some(({idx})=>state.selectedPalette===idx);
      const summary=document.createElement("summary");
      summary.innerHTML=`<span>${esc(category)}</span><span class="category-count">${items.length}</span>`;
      details.appendChild(summary);
      const body=document.createElement("div");
      body.className="palette-category-items";

      items.forEach(({p,idx})=>{
        const div=document.createElement("div");
        div.className="palette-item"+(state.selectedPalette===idx?" active":"");
        const widthText=Number.isFinite(Number(p.widthMM))?`${Number(p.widthMM).toFixed(1)} mm`:`${p.widthTE} TE`;
        div.innerHTML=`<strong>${esc(p.label)}</strong><small>${esc(p.tech)} · ${widthText}</small>`;
        div.onclick=()=>{
          state.selectedPalette=state.selectedPalette===idx?null:idx;
          state.openPaletteCategories.add(category);
          renderPalette();renderStatus();
        };
        body.appendChild(div);
      });
      details.appendChild(body);
      details.addEventListener("toggle",()=>{
        if(details.open) state.openPaletteCategories.add(category);
        else state.openPaletteCategories.delete(category);
      });
      els.paletteList.appendChild(details);
    });
  }

  const PHASES=["L1","L2","L3"];
  function phaseStartKey(field,row){return `${field}:${row}`}
  function rowPhaseStart(field,row){
    const p=state.phaseStarts?.[phaseStartKey(field,row)];
    return PHASES.includes(p)?p:"L1";
  }
  function setRowPhaseStart(field,row,phase){
    if(!state.phaseStarts) state.phaseStarts={};
    state.phaseStarts[phaseStartKey(field,row)]=PHASES.includes(phase)?phase:"L1";
  }
  function rowRailMode(field,row){
    const mode=state.rowRailModes?.[phaseStartKey(field,row)];
    return ["none","1P","3P"].includes(mode)?mode:"none";
  }
  function setRowRailMode(field,row,mode){
    if(!state.rowRailModes) state.rowRailModes={};
    state.rowRailModes[phaseStartKey(field,row)]=["none","1P","3P"].includes(mode)?mode:"none";
  }
  function repeatingPhase(index,start="L1"){
    const offset=Math.max(0,PHASES.indexOf(start));
    const m=((index+offset)%3+3)%3;
    return PHASES[m];
  }
  function isFourPoleWithN(d){return !!paletteMeta(d.type).fourPoleWithN}

  function phaseForRailSlot(field,row,slotTE){
    const railMode=rowRailMode(field,row);
    if(railMode==="none") return "none";
    const startPhase=rowPhaseStart(field,row);
    if(railMode==="1P") return startPhase;
    const anchors=state.devices.filter(d=>d.field===field&&d.row===row&&isFourPoleWithN(d)).sort((a,b)=>xMM(a)-xMM(b));
    const slotStartMM=slotTE*TE_MM;

    // Auf den vier TE eines 4-poligen Geräts zeigt die Farbtabelle die
    // TATSÄCHLICH an den Eingangsklemmen anliegende Leiterbelegung.
    // Beispiel: RCD-Klemme L1 <- HLAK-Ausgang L3.1 => erster TE wird als L3
    // dargestellt. Die Klemmenbezeichnungen L1/L2/L3/N am Gerät bleiben davon
    // unberührt; dargestellt wird hier bewusst die reale elektrische Phase.
    for(const d of anchors){
      const startTE=Math.round(xMM(d)/TE_MM);
      const wTE=Math.round(widthMM(d)/TE_MM);
      if(slotTE>=startTE&&slotTE<startTE+wTE){
        const rel=slotTE-startTE;
        const terminalId=rel===0?"L1":rel===1?"L2":rel===2?"L3":"N";
        const actual=mappedInputPhase(d,terminalId);
        if(actual && ["L1","L2","L3","N"].includes(actual)) return actual;
        return terminalId;
      }
    }

    const preceding=anchors.filter(d=>xMM(d)+widthMM(d)<=slotStartMM+0.001);
    if(preceding.length){
      const a=preceding[preceding.length-1];
      const endTE=Math.round((xMM(a)+widthMM(a))/TE_MM);

      // Hinter einem 4-poligen Gerät folgt die Farbtabelle der TATSÄCHLICHEN
      // Phasenbelegung seiner drei Außenleiter-Ausgänge. Werden am RCD z. B.
      // L1<-L3, L2<-L1, L3<-L2 eingespeist, lautet die reale Folge hinter
      // dem RCD L3/L1/L2 und genau diese Folge wird auch farblich dargestellt.
      const actualByTerminal={};
      for(const id of PHASES){
        // Die reale Phase direkt aus der Eingangszuleitung des 4P-Geräts
        // ableiten. Damit bleibt z.B. L1<-L2, L2<-L3, L3<-L1 auch
        // hinter dem RCD exakt L2/L3/L1 – unabhängig von Klemmenname
        // oder gespeicherter Standardphase des Ausgangsports.
        const mapped=mappedInputPhase(a,id);
        actualByTerminal[id]=mapped && PHASES.includes(mapped) ? mapped : id;
      }
      const startIdx=Math.max(0,PHASES.indexOf(startPhase));
      const physicalOrder=[...PHASES.slice(startIdx),...PHASES.slice(0,startIdx)];
      const actualOrder=physicalOrder.map(id=>actualByTerminal[id]);
      const i=((slotTE-endTE)%3+3)%3;
      return actualOrder[i] || repeatingPhase(slotTE-endTE,startPhase);
    }
    return repeatingPhase(slotTE,startPhase);
  }

  function requiredInputPhase(d){
    if(!d) return null;
    const meta=paletteMeta(d.type);
    if(meta.colorRole==="neutral" || d.phase==="N") return "N";
    if(["L1","L2","L3"].includes(d.phase)) return d.phase;
    if(d.phase==="3P" || meta.phase==="3P") return null;
    if(d.phase==="auto" || meta.phase==="auto") {
      const railPhase=phaseForRailSlot(d.field,d.row,Math.round(xMM(d)/TE_MM));
      return PHASES.includes(railPhase)?railPhase:null;
    }
    return null;
  }

  function remapRowRcdOutputs(field,row){
    // Wenn die Abgangsschiene gedreht wird, müssen einphasige Verbraucher hinter
    // einem 4P-RCD auf den physisch passenden RCD-Ausgang umgehängt werden.
    // Beispiel Schienenstart L3: erster LS bekommt RCD-L3, danach L1, dann L2.
    const anchors=state.devices.filter(d=>d.field===field&&d.row===row&&isFourPoleWithN(d));
    for(const a of anchors){
      const ports=sourcePorts(a);
      for(const d of state.devices.filter(x=>x.field===field&&x.row===row&&x.inputFrom===a.id)){
        const need=requiredInputPhase(d);
        if(!need || need==="N") continue;
        const match=ports.find(p=>p.phase===need);
        if(match) d.inputPort=match.id;
      }
    }
  }

  function devicePhase(d, visited=new Set()){
    if(!d) return "none";
    if(isExternalSource(d)) return "3P";
    if(paletteMeta(d.type).colorRole==="neutral") return "N";

    // Reihenklemmen mit einer logischen Einspeisung folgen immer der Quelle,
    // solange keine konkrete manuelle Außenleiterphase (L1/L2/L3/N/3P) gesetzt ist.
    const terminalAuto = isTerminal(d) && d.inputFrom!=null && (d.phase==="auto" || d.phase==="none");

    // Bei normalen Geräten hat eine manuelle Vorgabe Vorrang.
    if(!terminalAuto && d.phase!=="auto") return d.phase;

    // Schutz vor versehentlichen Verdrahtungs-Schleifen.
    if(visited.has(d.id)){
      return isTerminal(d) ? "none" : phaseForRailSlot(d.field,d.row,Math.round(xMM(d)/TE_MM));
    }
    visited.add(d.id);

    if(d.inputFrom!=null){
      const src=getDevice(d.inputFrom);
      if(src){
        // Konkreter Ausgang (z.B. L1/L2/L3 eines 3-poligen LS) hat höchste Priorität.
        const portPhase = selectedSourcePortPhase(d, src);
        if(portPhase) return portPhase;

        const srcPhase=devicePhase(src,new Set(visited));

        // Eindeutige einphasige Quelle direkt übernehmen.
        if(["L1","L2","L3","N"].includes(srcPhase)) return srcPhase;

        // 3-phasige Quelle:
        // - 3-poliges Folgegerät bleibt 3P
        // - einphasiges Standardgerät folgt weiterhin seiner Position
        // - eine Reihenklemme ohne konkreten Port kann 3P darstellen
        if(srcPhase==="3P"){
          if(isTerminal(d)) return "3P";

          const meta=paletteMeta(d.type);
          const ownPoles=Number(d.widthTE||meta.widthTE||1);
          if(ownPoles>=3) return "3P";

          return phaseForRailSlot(d.field,d.row,Math.round(xMM(d)/TE_MM));
        }
      }
    }

    // Unverbundene Reihenklemme: keine Phase erfinden.
    if(isTerminal(d)) return "none";

    return phaseForRailSlot(d.field,d.row,Math.round(xMM(d)/TE_MM));
  }

  function rectFree(field,row,x,w,ignoreId=null){
    if(x<-.001||x+w>railMM()+.001)return false;
    return !state.devices.some(d=>d.id!==ignoreId&&d.field===field&&d.row===row&&!(x+w<=xMM(d)+.001||x>=xMM(d)+widthMM(d)-.001));
  }

  function devicesOnRail(field,row,ignoreId=null){
    return state.devices.filter(d=>d.field===field&&d.row===row&&d.id!==ignoreId).sort((a,b)=>xMM(a)-xMM(b));
  }

  function snapX(metaOrDevice,rawMM){
    const exactMM=usesMMWidth(metaOrDevice);
    return exactMM?Math.round(rawMM*10)/10:Math.round(rawMM/TE_MM)*TE_MM;
  }

  function magneticSnapToEdges(device, field, row, rawX, ignoreId=null){
    if(!usesMMWidth(device)) return rawX;

    // Reihenklemmen "magnetisch" an benachbarte Elementkanten ziehen.
    // 2 mm Fangbereich in der Detailansicht/Normalansicht.
    const threshold=2.0;
    const w=widthMM(device);
    let best=rawX;
    let bestDist=threshold+0.001;

    const candidates=devicesOnRail(field,row,ignoreId);

    for(const other of candidates){
      const left=xMM(other);
      const right=left+widthMM(other);

      // linke Kante der Klemme an rechte Kante des Nachbarn
      const d1=Math.abs(rawX-right);
      if(d1<bestDist){
        best=right;
        bestDist=d1;
      }

      // rechte Kante der Klemme an linke Kante des Nachbarn
      const proposed=left-w;
      const d2=Math.abs(rawX-proposed);
      if(d2<bestDist){
        best=proposed;
        bestDist=d2;
      }
    }

    return Math.round(best*10)/10;
  }

  function makeSpaceByPushingRight(field,row,x,w,ignoreId=null){
    const ds=devicesOnRail(field,row,ignoreId);
    const intersects=ds.some(d=>!(x+w<=xMM(d)+.001||x>=xMM(d)+widthMM(d)-.001));
    if(!intersects)return true;
    let cursor=x+w; const updates=[];
    for(const d of ds){
      if(xMM(d)+widthMM(d)<=x+.001)continue;
      if(xMM(d)<cursor-.001){
        let nx=usesMMWidth(d)?Math.round(cursor*10)/10:Math.ceil(cursor/TE_MM)*TE_MM;
        updates.push([d,nx]); cursor=nx+widthMM(d);
      } else cursor=xMM(d)+widthMM(d);
    }
    if(cursor>railMM()+.001)return false;
    updates.forEach(([d,nx])=>d.xMM=nx);
    return true;
  }

  function placeNew(field,row,rawMM){
    if(state.selectedPalette==null)return;
    pushHistory("place");
    const p=palette[state.selectedPalette];
    const exactMM=Number.isFinite(Number(p.widthMM)) && Number(p.widthMM)>0;
    const w=exactMM?Number(p.widthMM):Number(p.widthTE||1)*TE_MM;
    let x=snapX(p,rawMM);
    if(exactMM){
      const pseudo={type:p.type,mode:"mm",widthMM:Number(p.widthMM)};
      x=magneticSnapToEdges(pseudo,field,row,x,null);
    }
    x=Math.max(0,Math.min(railMM()-w,x));
    if(!rectFree(field,row,x,w)&&!makeSpaceByPushingRight(field,row,x,w)){flash("Nicht genug Platz auf dieser Reihe.");return}
    const d={id:state.nextId++,type:p.type,label:p.label,tech:p.tech,mode:exactMM?"mm":"te",widthTE:exactMM?null:p.widthTE,widthMM:exactMM?Number(p.widthMM):null,phase:p.phase,group:"",inputFrom:null,inputPort:"OUT",multiInputs:hasMultiInputs(p)?{}:null,installStatus:state.insertStatus||"existing",field,row,xMM:x};
    state.devices.push(d);
    if(isFourPoleWithN(d) && rowRailMode(field,row)==="none") setRowRailMode(field,row,"3P");
    state.selectedDeviceId=d.id;renderAll();scrollSelectedRowIntoView();
  }

  function railUsageText(f,r){
    const used=state.devices.filter(d=>d.field===f&&d.row===r).reduce((s,d)=>s+widthMM(d),0);
    const hasT=state.devices.some(d=>d.field===f&&d.row===r&&usesMMWidth(d));
    return hasT?`${used.toFixed(1)} / ${railMM()} mm`:`${(used/TE_MM).toFixed(0)} / ${state.te} TE`;
  }


  let dragDeviceId=null;
  function clearSnapGuides(){document.querySelectorAll(".snap-guide").forEach(e=>e.remove())}
  function showSnapGuide(rail,xMMValue){clearSnapGuides();const g=document.createElement("div");g.className="snap-guide";g.style.left=`${xMMValue*PX_PER_MM}px`;rail.appendChild(g)}

  function renderBoard(){
    els.board.innerHTML="";
    const board=document.createElement("div");board.className="board";
    for(let f=0;f<state.fields;f++){
      const field=document.createElement("div");field.className="field";field.style.width=`${state.te*TE_PX+22}px`;
      field.innerHTML=`<div class="field-title"><span>Feld ${f+1}</span><span>${state.rows} Reihen · ${state.te} TE</span></div>`;
      for(let r=0;r<state.rows;r++){
        const wrap=document.createElement("div");wrap.className="rail-row";
        const railLabel=document.createElement("div");railLabel.className="rail-label";
        railLabel.innerHTML=`<span>Reihe ${r+1}</span><span class="rail-label-actions"><label>Stromschiene <select class="row-rail-select" aria-label="Stromschiene Feld ${f+1} Reihe ${r+1}"><option value="none">Keine</option><option value="1P">1-phasig</option><option value="3P">3-phasig</option></select></label><label>Start <select class="row-phase-select" aria-label="Schienenstart Feld ${f+1} Reihe ${r+1}"><option value="L1">L1</option><option value="L2">L2</option><option value="L3">L3</option></select></label><span>${railUsageText(f,r)}</span></span>`;
        const railSelect=railLabel.querySelector(".row-rail-select");
        const phaseSelect=railLabel.querySelector(".row-phase-select");
        railSelect.value=rowRailMode(f,r);
        phaseSelect.value=rowPhaseStart(f,r);
        phaseSelect.disabled=railSelect.value==="none";
        railSelect.onchange=ev=>{ev.stopPropagation();pushHistory("rail-mode");setRowRailMode(f,r,ev.target.value);if(ev.target.value!=="none")remapRowRcdOutputs(f,r);renderAll();};
        phaseSelect.onchange=ev=>{ev.stopPropagation();pushHistory("rail-phase");setRowPhaseStart(f,r,ev.target.value);remapRowRcdOutputs(f,r);renderAll();};
        railSelect.onclick=ev=>ev.stopPropagation();
        phaseSelect.onclick=ev=>ev.stopPropagation();
        wrap.appendChild(railLabel);
        const railWrap=document.createElement("div");railWrap.className="rail-wrap";
        const railMode=rowRailMode(f,r);
        const rail=document.createElement("div");rail.className="rail";rail.style.width=`${state.te*TE_PX}px`;
        rail.onclick=ev=>{if(ev.target.closest(".device"))return;const rect=rail.getBoundingClientRect();placeNew(f,r,(ev.clientX-rect.left)/screenPxPerMM())};
        rail.ondragover=ev=>{ev.preventDefault();const d=getDevice(dragDeviceId);if(!d)return;const rect=rail.getBoundingClientRect();let raw=(ev.clientX-rect.left)/screenPxPerMM();let x=snapX(d,raw);x=magneticSnapToEdges(d,f,r,x,d.id);x=Math.max(0,Math.min(railMM()-widthMM(d),x));showSnapGuide(rail,x);};
        rail.ondragleave=()=>clearSnapGuides();
        rail.ondrop=ev=>{
          ev.preventDefault();const id=Number(ev.dataTransfer.getData("text/plain"));const d=getDevice(id);if(!d)return;
          const rect=rail.getBoundingClientRect();
          let x=snapX(d,(ev.clientX-rect.left)/screenPxPerMM());
          x=magneticSnapToEdges(d,f,r,x,d.id);
          x=Math.max(0,Math.min(railMM()-widthMM(d),x));
          clearSnapGuides();moveDevice(d,f,r,x);
        };

        state.devices.filter(d=>d.field===f&&d.row===r).forEach(d=>{
          const el=document.createElement("div");
          el.className="device"+(isTerminal(d)?" terminal":"")+(paletteMeta(d.type).colorRole==="neutral"?" termN":"")+(isSurgeDevice(d)?" surge":"")+(d.installStatus==="new"?" is-new":"")+(state.selectedDeviceId===d.id?" selected":"");
          el.draggable=true;el.dataset.deviceId=d.id;el.style.left=`${xMM(d)*PX_PER_MM}px`;el.style.width=`${Math.max(5,widthMM(d)*PX_PER_MM-1)}px`;
          const ph=devicePhase(d),pc=ph==="3P"?"P3":ph,dim=usesMMWidth(d)?`${widthMM(d).toFixed(1)} mm`:`${(widthMM(d)/TE_MM).toFixed(1).replace(/\.0$/," ").trim()} TE`;
          el.innerHTML=`<div class="tech">${esc(d.tech)}</div><div class="label">${esc(d.label)}</div><div class="meta">${dim}${effectiveGroup(d)?" · RCD "+esc(effectiveGroup(d)):""}</div>${["L1","L2","L3","N","3P"].includes(ph)?`<i class="phase-dot ${pc}"></i>`:""}`;
          el.title=`${d.label}\n${d.tech}\n${dim}\n${ph}`;
          el.onclick=ev=>{ev.stopPropagation();selectDevice(d.id,true)};
          el.ondragstart=ev=>{ev.dataTransfer.setData("text/plain",String(d.id));dragDeviceId=d.id;state.selectedDeviceId=d.id};
          rail.appendChild(el);
        });

        railWrap.appendChild(rail);
        const ps=document.createElement("div");ps.className="phase-strip"+(railMode==="none"?" placeholder":"");ps.style.gridTemplateColumns=`repeat(${state.te}, ${TE_PX}px)`;
        for(let slot=0;slot<state.te;slot++){const c=document.createElement("div");c.className="phase-cell "+String(phaseForRailSlot(f,r,slot)||"none").toLowerCase();ps.appendChild(c)}
        railWrap.appendChild(ps);
        wrap.appendChild(railWrap);field.appendChild(wrap);
      }
      board.appendChild(field);
    }
    els.board.appendChild(board);
    applyBoardViewScale();
  }

  function moveDevice(d,field,row,x){
    pushHistory("move");
    const snap=state.devices.map(v=>({...v}));
    if(!rectFree(field,row,x,widthMM(d),d.id)&&!makeSpaceByPushingRight(field,row,x,widthMM(d),d.id)){
      state.devices=snap;flash("Nicht genug Platz auf dieser Reihe.");renderAll();return;
    }
    const m=getDevice(d.id);m.field=field;m.row=row;m.xMM=x;renderAll();scrollSelectedRowIntoView();
  }

  function deviceDisplayName(d){
    if(isExternalSource(d)) return (d.label||"Externe Quelle").trim();
    const fb=paletteMeta(d.type).label||d.type,lab=(d.label||"").trim();
    return lab?`${lab} [${d.tech}]`:`${fb} [${d.tech}]`;
  }
  function connectionNameForTarget(target){
    if(target.inputFrom==null) return "—";
    const src=getDevice(target.inputFrom);
    if(!src) return "—";
    const port=target.inputPort||"OUT";
    const suffix = sourcePorts(src).length>1 ? ` → ${port}` : "";
    const grp=effectiveGroup(target); return deviceDisplayName(src)+suffix+(grp?` · RCD ${grp}`:"");
  }
  function outputNames(d){
    const t=orderedDevices().filter(x=>x.inputFrom===d.id);
    if(!t.length) return "—";
    const multi = sourcePorts(d).length>1;
    return t.map(x=>{
      const prefix = multi ? `${x.inputPort||"OUT"} → ` : "";
      return prefix + deviceDisplayName(x);
    }).join(", ");
  }

  function renderDeviceTable(){
    els.deviceTableBody.innerHTML="";const list=orderedDevices();els.deviceCountBadge.textContent=String(list.length);
    if(!list.length){const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=6;td.className="hint";td.textContent="Noch keine Elemente gesetzt.";tr.appendChild(td);els.deviceTableBody.appendChild(tr);return}
    list.forEach(d=>{
      const tr=document.createElement("tr");tr.dataset.deviceId=d.id;if(state.selectedDeviceId===d.id)tr.classList.add("selected");
      const start=xMM(d),end=start+widthMM(d);
      const pos=usesMMWidth(d)?`F${d.field+1} R${d.row+1} · ${start.toFixed(1)}–${end.toFixed(1)} mm`:`F${d.field+1} R${d.row+1} · TE ${Math.round(start/TE_MM)+1}${widthMM(d)>TE_MM?"–"+Math.round(end/TE_MM):""}`;
      tr.innerHTML=`<td class="position">${pos}</td><td class="device-name"><b>${esc(d.tech)}</b>${d.installStatus==="new"?` <span class="new-inline">NEU</span>`:""}<br><span class="hint">${esc(paletteMeta(d.type).label||d.type)}</span></td><td class="phase-cell-text">${esc(devicePhase(d))}</td><td></td><td class="connection">${esc(connectionNameForTarget(d))}</td><td class="connection">${esc(outputNames(d))}</td>`;
      const input=document.createElement("input");input.type="text";input.value=d.label||"";input.placeholder="z. B. Wohnzimmer Steckdosen";
      input.onmousedown=ev=>ev.stopPropagation();
      input.onclick=ev=>{ev.stopPropagation();if(state.selectedDeviceId!==d.id){state.selectedDeviceId=d.id;updateSelectionOnly()}};
      input.oninput=ev=>{pushHistory(`table-label-${d.id}`,900);d.label=ev.target.value;if(state.selectedDeviceId===d.id){els.propLabel.value=d.label;els.selectionInfo.textContent=`${d.label||paletteMeta(d.type).label||"Gerät"} · Feld ${d.field+1}, Reihe ${d.row+1}`}updateDeviceLabelOnly(d.id,d.label)};
      tr.children[3].appendChild(input);tr.onclick=()=>selectDevice(d.id,true);els.deviceTableBody.appendChild(tr);
    });
  }

  function updateSelectionOnly(){
    document.querySelectorAll(".device.selected").forEach(e=>e.classList.remove("selected"));document.querySelectorAll(".device-table tbody tr.selected").forEach(e=>e.classList.remove("selected"));
    const de=document.querySelector(`.device[data-device-id="${state.selectedDeviceId}"]`),re=document.querySelector(`.device-table tr[data-device-id="${state.selectedDeviceId}"]`);
    if(de)de.classList.add("selected");if(re)re.classList.add("selected");renderProps();renderZoomRail();
  }
  function updateDeviceLabelOnly(id,label){const el=document.querySelector(`.device[data-device-id="${id}"] .label`);if(el)el.textContent=label}
  function selectDevice(id,scroll=true){state.selectedDeviceId=id;renderAll();if(scroll){scrollSelectedRowIntoView();scrollSelectedDeviceIntoView()}}
  function scrollSelectedRowIntoView(){if(!state.autoJump)return;requestAnimationFrame(()=>{const e=document.querySelector(`.device-table tr[data-device-id="${state.selectedDeviceId}"]`);if(e)e.scrollIntoView({block:"nearest",behavior:"smooth"})})}
  function scrollSelectedDeviceIntoView(){if(!state.autoJump)return;requestAnimationFrame(()=>{const e=document.querySelector(`.device[data-device-id="${state.selectedDeviceId}"]`);if(e)e.scrollIntoView({block:"nearest",inline:"nearest",behavior:"smooth"})})}

  function renderProps(){
    const d=getDevice(state.selectedDeviceId);els.emptyProps.hidden=!!d;els.propsForm.hidden=!d;
    if(!d){els.selectionInfo.textContent="Kein Gerät ausgewählt";return}
    els.selectionInfo.textContent=`${d.label||paletteMeta(d.type).label||"Gerät"} · Feld ${d.field+1}, Reihe ${d.row+1}`;
    els.propLabel.value=d.label;
    els.propTech.value=d.tech;
    if(els.propStatus) els.propStatus.value=d.installStatus||"existing";
    els.propGroup.value=d.group||effectiveGroup(d)||"";
    els.propGroup.placeholder = effectiveGroup(d) ? `automatisch: ${effectiveGroup(d)}` : "A / B / C";
    els.propPhase.value=d.phase||"none";
    if(usesMMWidth(d)){els.teWidthLabel.hidden=true;els.mmWidthLabel.hidden=false;els.customWidthControls.hidden=true;els.propWidthMM.value=widthMM(d).toFixed(1)}
    else{els.teWidthLabel.hidden=false;els.mmWidthLabel.hidden=true;els.customWidthControls.hidden=d.type!=="custom";els.propWidth.value=(widthMM(d)/TE_MM).toFixed(1).replace(/\.0$/,"")}
    if(inputPorts(d).length>0){
      els.singleInputLabel.hidden=true;
      els.changeInputs.hidden=false;
      renderMultiInputs(d);
    }else{
      els.singleInputLabel.hidden=false;
      els.changeInputs.hidden=true;
      els.changeInputs.innerHTML="";
      renderConnectionControls(d);
    }

    if(els.neutralBinding){
      const neutralRcd=terminalNeutralSource(d);
      if(terminalNeedsRcdNeutral(d) && neutralRcd){
        const group=effectiveGroup(d);
        els.neutralBinding.hidden=false;
        els.neutralBinding.innerHTML=`<b>N von:</b> ${esc(neutralRcd.label||"RCD")} [${esc(neutralRcd.tech||"RCD")}] · F${neutralRcd.field+1} R${neutralRcd.row+1} · RCD ${esc(group)}<br><span class="hint">automatisch über die RCD-Gruppe zugeordnet</span>`;
      }else{
        els.neutralBinding.hidden=true;
        els.neutralBinding.innerHTML="";
      }
    }
  }

  function targetInputChoices(target){
    if(target && paletteMeta(target.type).colorRole==="neutral"){
      return [{id:"INPUT",label:"N",phase:"N",multi:false}];
    }

    const ports=inputPorts(target);

    if(ports.length){
      return ports.map(p=>({
        id:p.id,
        label:p.label,
        phase:p.phase,
        multi:true
      }));
    }

    return [{
      id:"INPUT",
      label:"Eingang",
      phase:null,
      multi:false
    }];
  }

  function outputConnections(source, sourcePortId){
    const links=[];

    // normale Einzeleingänge
    for(const target of orderedDevices()){
      if(target.inputFrom===source.id && (target.inputPort||"OUT")===sourcePortId){
        links.push({
          target,
          targetPort:"INPUT",
          multi:false
        });
      }

      // Mehrfacheingänge, z.B. RCD und I-0-II
      if(target.multiInputs){
        for(const [targetPort,conn] of Object.entries(target.multiInputs)){
          if(conn && conn.sourceId===source.id && (conn.sourcePort||"OUT")===sourcePortId){
            links.push({
              target,
              targetPort,
              multi:true
            });
          }
        }
      }
    }

    return links;
  }

  function targetInputIsFree(target, targetPortId){
    if(targetPortId==="INPUT"){
      return target.inputFrom==null;
    }

    if(!target.multiInputs) target.multiInputs={};
    return !target.multiInputs[targetPortId];
  }

  function connectOutputToTarget(source, sourcePort, target, targetPortId){
    if(!source || !sourcePort || !target) return false;

    const targetChoice=targetInputChoices(target).find(p=>p.id===targetPortId);
    if(!targetChoice) return false;

    // Phasenprüfung. Freigegebene 4-polige Geräte dürfen L1/L2/L3
    // untereinander permutieren; der Neutralleiter bleibt strikt getrennt.
    if(!phaseCompatibleForInput(target,targetChoice,sourcePort)){
      flash(`Phasen passen nicht: ${sourcePort.label} → ${targetChoice.label}`);
      return false;
    }

    if(!targetInputIsFree(target,targetPortId)){
      flash("Dieser Eingang ist bereits belegt.");
      return false;
    }

    if(targetPortId==="INPUT"){
      target.inputFrom=source.id;
      target.inputPort=sourcePort.id;
    }else{
      if(!target.multiInputs) target.multiInputs={};
      target.multiInputs[targetPortId]={
        sourceId:source.id,
        sourcePort:sourcePort.id
      };
    }

    return true;
  }

  function disconnectOutputLink(source, sourcePortId, target, targetPortId){
    if(targetPortId==="INPUT"){
      if(target.inputFrom===source.id && (target.inputPort||"OUT")===sourcePortId){
        target.inputFrom=null;
        target.inputPort="OUT";
      }
      return;
    }

    if(target.multiInputs && target.multiInputs[targetPortId]){
      const conn=target.multiInputs[targetPortId];
      if(conn.sourceId===source.id && (conn.sourcePort||"OUT")===sourcePortId){
        delete target.multiInputs[targetPortId];
      }
    }
  }

  function renderAssignableOutputs(d){
    const rows=[];
    const ports=sourcePorts(d);
    const isGroupedHlak = ["hlak5_1to3","hlak5_1to3_compact"].includes(d.type);

    // 5-polige HLAK werden nach realen Abgangssätzen dargestellt:
    // Abgang 1 = L1.1 / L2.1 / L3.1 / N.1 / PE.1 usw.
    // Damit ist auf einen Blick klar, welche Leiter gemeinsam einen Abgang bilden.
    let renderPorts=ports;
    if(isGroupedHlak){
      const conductorOrder={L1:0,L2:1,L3:2,N:3,PE:4};
      renderPorts=[...ports].sort((a,b)=>{
        const [ac,ag="0"]=String(a.id).split(".");
        const [bc,bg="0"]=String(b.id).split(".");
        const gd=Number(ag)-Number(bg);
        if(gd) return gd;
        return (conductorOrder[ac]??99)-(conductorOrder[bc]??99);
      });
    }

    let lastGroup=null;
    for(const port of renderPorts){
      if(isGroupedHlak){
        const parts=String(port.id).split(".");
        const group=parts.length>1 ? parts[1] : null;
        if(group && group!==lastGroup){
          lastGroup=group;

          // Komfort-Zuordnung: Ein kompletter HLAK-Abgang kann auf einmal
          // einem 4-poligen Ziel (z.B. RCD) zugeordnet werden. Dabei werden
          // L1/L2/L3/N phasengleich verbunden; PE bleibt separat/frei.
          const targets=orderedDevices().filter(target=>{
            if(target.id===d.id) return false;
            const ids=inputPorts(target).map(x=>x.id);
            return ["L1","L2","L3","N"].every(id=>ids.includes(id));
          });
          const targetOpts=[`<option value="">— kompletten Abgang verbinden —</option>`]
            .concat(targets.map(t=>`<option value="${t.id}">F${t.field+1} R${t.row+1} · ${esc(deviceDisplayName(t))}</option>`));

          rows.push(`
            <div class="output-group-head">
              <div class="output-group-title">Abgang ${esc(group)}</div>
              <select class="output-group-target" data-output-group="${esc(group)}">
                ${targetOpts.join("")}
              </select>
            </div>`);
        }
      }

      const links=outputConnections(d,port.id);
      const current=links.length ? links[0] : null;

      const options=[];
      options.push(`<option value="">— frei —</option>`);

      for(const target of orderedDevices().filter(x=>x.id!==d.id)){
        for(const inp of targetInputChoices(target)){
          const isCurrent = current &&
            current.target.id===target.id &&
            current.targetPort===inp.id;

          const phaseMatch=phaseCompatibleForInput(target,inp,port);
          const free=targetInputIsFree(target,inp.id) || isCurrent;

          if(!phaseMatch || !free) continue;

          options.push(
            `<option value="${target.id}|${esc(inp.id)}"${isCurrent?" selected":""}>`+
            `F${target.field+1} R${target.row+1} · ${esc(deviceDisplayName(target))} → ${esc(inp.label)}`+
            `</option>`
          );
        }
      }

      rows.push(`
        <div class="output-assign-row">
          <div class="multi-output-port">${esc(port.label)}</div>
          <div class="output-assign-controls">
            <select class="output-assign-select" data-source-port="${esc(port.id)}">
              ${options.join("")}
            </select>
          </div>
        </div>`);
    }

    els.outputTargets.innerHTML=`
      <div class="multi-output-box">
        <div class="multi-output-title">Ausgänge zuordnen</div>
        ${isGroupedHlak?'<div class="output-group-hint">Die Leiter sind nach Abgang gruppiert. Für einen RCD kann der komplette Abgang in einem Schritt verbunden werden.</div>':''}
        ${rows.join("")}
      </div>`;

    els.outputTargets.querySelectorAll(".output-group-target").forEach(sel=>{
      sel.onchange=()=>{
        if(!sel.value) return;
        pushHistory("output-group");
        const dNow=getDevice(state.selectedDeviceId);
        const target=getDevice(Number(sel.value));
        const group=sel.dataset.outputGroup;
        if(!dNow || !target || !group) return;

        const wanted=["L1","L2","L3","N"];
        const groupPorts=wanted.map(ph=>sourcePorts(dNow).find(p=>p.id===`${ph}.${group}`)).filter(Boolean);
        if(groupPorts.length!==wanted.length){
          flash("Der komplette Abgang konnte nicht gefunden werden.");
          renderAll();
          return;
        }

        // Alle bisherigen Verbindungen dieses HLAK zu genau diesem Ziel lösen.
        // Das korrigiert auch versehentliche Zuordnungen wie L1.1/L1.2/L1.3
        // auf die drei RCD-Außenleiter.
        for(const sp of sourcePorts(dNow)){
          for(const link of outputConnections(dNow,sp.id)){
            if(link.target.id===target.id){
              disconnectOutputLink(dNow,sp.id,link.target,link.targetPort);
            }
          }
        }

        let ok=true;
        for(const ph of wanted){
          const sp=groupPorts.find(p=>String(p.id).startsWith(ph+"."));
          const inp=inputPorts(target).find(i=>i.id===ph);
          if(!sp || !inp || !connectOutputToTarget(dNow,sp,target,inp.id)){
            ok=false;
            break;
          }
        }

        if(!ok) flash("Der komplette Abgang konnte nicht vollständig verbunden werden.");
        renderAll();
        scrollSelectedRowIntoView();
      };
    });

    els.outputTargets.querySelectorAll(".output-assign-select").forEach(sel=>{
      sel.onchange=()=>{
        const dNow=getDevice(state.selectedDeviceId);
        pushHistory("output-link");
        if(!dNow) return;

        const sourcePortId=sel.dataset.sourcePort;
        const sourcePort=sourcePorts(dNow).find(p=>p.id===sourcePortId);
        if(!sourcePort) return;

        // Bestehendes Ziel dieses Ausgangs zuerst sauber lösen.
        const existing=outputConnections(dNow,sourcePortId);
        for(const link of existing){
          disconnectOutputLink(dNow,sourcePortId,link.target,link.targetPort);
        }

        // "frei" gewählt: Verbindung bleibt offen.
        if(!sel.value){
          renderAll();
          scrollSelectedRowIntoView();
          return;
        }

        const [targetIdRaw,targetPortId]=sel.value.split("|");
        const target=getDevice(Number(targetIdRaw));

        if(target && connectOutputToTarget(dNow,sourcePort,target,targetPortId)){
          renderAll();
          scrollSelectedRowIntoView();
          return;
        }

        // Falls die neue Verbindung fehlschlägt, UI neu aus Datenmodell aufbauen.
        renderAll();
      };
    });
  }

  function renderMultiInputs(d){
    if(!d.multiInputs) d.multiInputs={};

    const banks=[...new Set(inputPorts(d).map(p=>p.bank||"Eingang"))];
    const html=[];

    for(const bank of banks){
      html.push(`<div class="change-bank"><div class="change-bank-title">${esc(bank)}</div>`);

      for(const inp of inputPorts(d).filter(p=>p.bank===bank)){
        const selectId=`change-input-${d.id}-${inp.id.replaceAll(".","_")}`;
        html.push(`
          <div class="change-input-row">
            <span>${esc(inp.label)}</span>
            <select id="${selectId}" data-port="${esc(inp.id)}">
              <option value="">— offen —</option>
            </select>
          </div>`);
      }

      html.push(`</div>`);
    }

    els.changeInputs.innerHTML=html.join("");

    for(const inp of inputPorts(d)){
      const selector=`#change-input-${d.id}-${inp.id.replaceAll(".","_")}`;
      const sel=document.querySelector(selector);
      if(!sel) continue;

      const current=d.multiInputs[inp.id]||null;

      for(const src of sourceCandidates(d.id)){
        for(const port of sourcePorts(src)){
          const o=document.createElement("option");
          o.value=`${src.id}|${port.id}`;

          const isCurrent=current && current.sourceId===src.id && (current.sourcePort||"OUT")===port.id;
          const available=portAvailable(src,port,d.id);
          const phaseMatch=phaseCompatibleForInput(d,inp,port);
          const portText=sourcePorts(src).length>1?` → ${port.label}`:"";
          const busyText=(!available&&!isCurrent)?" (belegt)":"";
          const phaseText=(!phaseMatch)?" (falsche Phase)":"";

          o.textContent=`${sourceUiPrefix(src)} · ${deviceDisplayName(src)}${portText}${busyText}${phaseText}`;

          if((!available&&!isCurrent) || !phaseMatch) o.disabled=true;
          sel.appendChild(o);
        }
      }

      if(current){
        sel.value=`${current.sourceId}|${current.sourcePort||"OUT"}`;
      }

      sel.onchange=()=>{
        pushHistory("multi-input");
        const raw=sel.value;

        if(raw===""){
          delete d.multiInputs[inp.id];
          renderAll();
          scrollSelectedRowIntoView();
          return;
        }

        const [srcIdRaw,srcPort]=raw.split("|");
        const srcId=Number(srcIdRaw);
        const src=getDevice(srcId);
        const port=src?sourcePorts(src).find(p=>p.id===(srcPort||"OUT")):null;

        if(!src || !port){
          flash("Ungültige Quelle.");
          renderAll();
          return;
        }

        if(!phaseCompatibleForInput(d,inp,port)){
          flash(`Phase passt nicht zu Eingang ${inp.label}.`);
          renderAll();
          return;
        }

        if(!portAvailable(src,port,d.id)){
          flash("Dieser Ausgang ist bereits belegt.");
          renderAll();
          return;
        }

        d.multiInputs[inp.id]={
          sourceId:srcId,
          sourcePort:srcPort||"OUT"
        };

        renderAll();
        scrollSelectedRowIntoView();
      };
    }

    renderAssignableOutputs(d);
  }

  function renderConnectionControls(d){
    const oldSource=d.inputFrom==null?"":String(d.inputFrom);
    const oldPort=d.inputPort||"OUT";
    els.propInputFrom.innerHTML="";

    const none=document.createElement("option");
    none.value="";
    none.textContent="— kein Eingang zugeordnet —";
    els.propInputFrom.appendChild(none);

    sourceCandidates(d.id).forEach(src=>{
      const ports=sourcePorts(src);

      ports.forEach(port=>{
        const o=document.createElement("option");
        o.value=`${src.id}|${port.id}`;

        const isCurrent = oldSource===String(src.id) && oldPort===port.id;
        const available = portAvailable(src, port, d.id);
        const needPhase = requiredInputPhase(d);
        const phaseMatch = !needPhase || !port.phase || port.phase===needPhase;
        const portText = ports.length>1 ? ` → ${port.label}` : "";
        const busyText = (!available && !isCurrent) ? " (belegt)" : "";
        const phaseText = (!phaseMatch) ? " (falsche Phase)" : "";

        o.textContent=`${sourceUiPrefix(src)} · ${deviceDisplayName(src)}${portText}${busyText}${phaseText}`;

        if((!available && !isCurrent) || !phaseMatch){
          o.disabled=true;
        }

        els.propInputFrom.appendChild(o);
      });
    });

    els.propInputFrom.value = oldSource ? `${oldSource}|${oldPort}` : "";

    if(sourcePorts(d).length>1){
      renderAssignableOutputs(d);
    }else{
      const t=orderedDevices().filter(x=>x.inputFrom===d.id);
      if(!t.length){
        els.outputTargets.innerHTML=`<b>Ausgang zu:</b><br>noch keinem Element zugeordnet`;
      } else {
        els.outputTargets.innerHTML=
          `<b>Ausgang zu:</b><ul>${t.map(x=>`<li>${esc(deviceDisplayName(x))}</li>`).join("")}</ul>`;
      }
    }
  }

  function bindTextProp(input,key){
    input.oninput=()=>{const d=getDevice(state.selectedDeviceId);if(!d)return;pushHistory(`prop-${key}-${d.id}`,900);d[key]=input.value;renderBoard();renderDeviceTable();renderSummary();renderProps();scrollSelectedRowIntoView()}
  }
  bindTextProp(els.propLabel,"label");
  bindTextProp(els.propTech,"tech");

  els.propStatus.onchange=()=>{const d=getDevice(state.selectedDeviceId);if(!d)return;pushHistory("status");d.installStatus=els.propStatus.value==="new"?"new":"existing";renderAll();};

  els.propGroup.oninput=()=>{
    const d=getDevice(state.selectedDeviceId);
    if(!d) return;
    pushHistory(`prop-group-${d.id}`,900);

    // Eingabe setzt eine manuelle Gruppe.
    // Leeres Feld bedeutet: Gruppe automatisch aus der Einspeisekette übernehmen.
    d.group=els.propGroup.value.trim();

    renderBoard();
    renderDeviceTable();
    renderSummary();

    const inherited=effectiveGroup(d);
    els.propGroup.placeholder = inherited ? `automatisch: ${inherited}` : "A / B / C";
  };

  function setSelectedTEWidth(value){
    const d=getDevice(state.selectedDeviceId);if(!d||usesMMWidth(d))return false;
    pushHistory(`width-${d.id}`,700);
    const maxTE=d.type==="custom"?5:12;
    const n=Math.max(0.5,Math.min(maxTE,Math.round(Number(value)*2)/2)),w=n*TE_MM;
    if(xMM(d)+w>railMM()){
      flash(`Maximal ${maxTE} TE bzw. bis zum Reihenende möglich.`);
      els.propWidth.value=(widthMM(d)/TE_MM).toFixed(1).replace(/\.0$/," ").trim();
      return false;
    }
    if(!rectFree(d.field,d.row,xMM(d),w,d.id) && !makeSpaceByPushingRight(d.field,d.row,xMM(d),w,d.id)){
      flash("Nicht genug Platz auf dieser Reihe.");
      els.propWidth.value=(widthMM(d)/TE_MM).toFixed(1).replace(/\.0$/," ").trim();
      return false;
    }
    d.widthTE=n;renderAll();scrollSelectedRowIntoView();return true;
  }
  els.propWidth.oninput=()=>{setSelectedTEWidth(els.propWidth.value)};
  els.widthMinusBtn.onclick=()=>{
    const d=getDevice(state.selectedDeviceId);if(!d||d.type!=="custom")return;
    setSelectedTEWidth(widthMM(d)/TE_MM-0.5);
  };
  els.widthPlusBtn.onclick=()=>{
    const d=getDevice(state.selectedDeviceId);if(!d||d.type!=="custom")return;
    setSelectedTEWidth(widthMM(d)/TE_MM+0.5);
  };
  els.propWidthMM.oninput=()=>{
    const d=getDevice(state.selectedDeviceId);if(!d||!usesMMWidth(d))return;pushHistory(`widthmm-${d.id}`,700);const w=Math.max(1,Math.min(300,Number(els.propWidthMM.value)));
    if(xMM(d)+w>railMM()||!rectFree(d.field,d.row,xMM(d),w,d.id)){flash("Breite passt an dieser Position nicht.");els.propWidthMM.value=widthMM(d).toFixed(1);return}
    d.widthMM=Math.round(w*10)/10;renderAll();scrollSelectedRowIntoView();
  };
  els.propPhase.onchange=()=>{const d=getDevice(state.selectedDeviceId);if(!d)return;pushHistory("phase");d.phase=els.propPhase.value;renderAll();scrollSelectedRowIntoView()};
  els.propInputFrom.onchange=()=>{
    const d=getDevice(state.selectedDeviceId);
    if(!d) return;
    pushHistory("input-link");

    const raw=els.propInputFrom.value;

    if(raw===""){
      d.inputFrom=null;
      d.inputPort="OUT";
      renderAll();
      scrollSelectedRowIntoView();
      return;
    }

    const [srcIdRaw, portIdRaw]=raw.split("|");
    const srcId=Number(srcIdRaw);
    const portId=portIdRaw||"OUT";
    const src=getDevice(srcId);
    const port=src ? sourcePorts(src).find(p=>p.id===portId) : null;

    if(!src || !port){
      flash("Ungültiger Ausgang.");
      renderAll();
      return;
    }

    const needPhase=requiredInputPhase(d);
    if(needPhase && port.phase && port.phase!==needPhase){
      flash(`Dieser Verbraucher liegt auf ${needPhase}; bitte den passenden Ausgang wählen.`);
      renderAll();
      scrollSelectedRowIntoView();
      return;
    }

    if(!portAvailable(src, port, d.id)){
      flash("Dieser Ausgang ist bereits belegt.");
      renderAll();
      scrollSelectedRowIntoView();
      return;
    }

    d.inputFrom=srcId;
    d.inputPort=portId;

    renderAll();
    scrollSelectedRowIntoView();
  };

  function deleteSelectedDevice(){
    if(state.selectedDeviceId==null) return;
    pushHistory("delete");
    const id=state.selectedDeviceId;
    state.devices=state.devices.filter(d=>d.id!==id);
    state.devices.forEach(d=>{
      if(d.inputFrom===id){ d.inputFrom=null; d.inputPort="OUT"; }
      if(d.multiInputs){
        Object.keys(d.multiInputs).forEach(k=>{
          const link=d.multiInputs[k];
          if(link && Number(link.sourceId)===id) delete d.multiInputs[k];
        });
      }
    });
    state.selectedDeviceId=null;
    renderAll();
  }

  els.deleteBtn.onclick=deleteSelectedDevice;

  document.addEventListener("keydown",ev=>{
    const tag=(ev.target && ev.target.tagName || "").toLowerCase();
    const editing=["input","textarea","select"].includes(tag) || ev.target?.isContentEditable;
    if((ev.ctrlKey||ev.metaKey)&&!editing){
      const k=ev.key.toLowerCase();
      if(k==="z"){ev.preventDefault();ev.shiftKey?redo():undo();return}
      if(k==="y"){ev.preventDefault();redo();return}
      if(k==="d"){ev.preventDefault();duplicateSelectedDevice();return}
    }
    if(ev.key!=="Delete"||editing) return;
    if(state.selectedDeviceId==null) return;
    ev.preventDefault();deleteSelectedDevice();
  });

  function duplicateSelectedDevice(){
    const d=getDevice(state.selectedDeviceId);if(!d)return;let x=xMM(d)+widthMM(d);x=usesMMWidth(d)?Math.round(x*10)/10:Math.ceil(x/TE_MM)*TE_MM;
    if(x+widthMM(d)>railMM()||!rectFree(d.field,d.row,x,widthMM(d))){
      x=0;const step=usesMMWidth(d)?.1:TE_MM;
      while(x+widthMM(d)<=railMM()&&!rectFree(d.field,d.row,x,widthMM(d)))x+=step;
      if(x+widthMM(d)>railMM()){flash("Keine freie Stelle zum Duplizieren.");return}
    }
    pushHistory("duplicate");
    const copy=structuredClone(d);copy.id=state.nextId++;copy.xMM=Math.round(x*10)/10;copy.label=d.label?d.label+" Kopie":d.label;copy.inputFrom=null;copy.inputPort="OUT";if(copy.multiInputs)copy.multiInputs={};state.devices.push(copy);state.selectedDeviceId=copy.id;renderAll();scrollSelectedRowIntoView();
  }
  els.duplicateBtn.onclick=duplicateSelectedDevice;

  function renderSummary(){
    const total=state.fields*state.rows*railMM(),used=state.devices.reduce((s,d)=>s+widthMM(d),0),pc={L1:0,L2:0,L3:0};
    state.devices.forEach(d=>{const p=devicePhase(d);if(pc[p]!=null)pc[p]++;if(p==="3P"){pc.L1++;pc.L2++;pc.L3++}});
    const linked=state.devices.filter(d=>d.inputFrom!=null).length;
    els.summary.innerHTML=`<div class="summary-grid"><span>Geräte</span><strong>${state.devices.length}</strong><span>Belegt</span><strong>${used.toFixed(1)} mm</strong><span>Frei</span><strong>${(total-used).toFixed(1)} mm</strong><span>Mit Eingang</span><strong>${linked}</strong><span>Ohne Eingang</span><strong>${state.devices.length-linked}</strong></div><div class="summary-phase"><div><b>L1</b><br>${pc.L1}</div><div><b>L2</b><br>${pc.L2}</div><div><b>L3</b><br>${pc.L3}</div></div>`;
  }

  function renderZoomRail(){
    const selected=getDevice(state.selectedDeviceId);

    if(!selected){
      els.zoomRailTitle.textContent="keine Auswahl";
      els.zoomRail.className="zoom-rail empty";
      els.zoomRail.textContent="Bitte zuerst ein Gerät auswählen.";
      els.zoomRail.style.width="100%";
      return;
    }

    const field=selected.field;
    const row=selected.row;
    els.zoomRailTitle.textContent=`Feld ${field+1} · Reihe ${row+1}`;

    els.zoomRail.className="zoom-rail";
    els.zoomRail.innerHTML="";
    els.zoomRail.style.width=`${railMM()*ZOOM_PX_PER_MM}px`;

    // kleine mm-/TE-Rastermarken
    const ruler=document.createElement("div");
    ruler.className="zoom-ruler";
    for(let mm=0;mm<=railMM();mm+=18){
      const mark=document.createElement("div");
      mark.className="zoom-ruler-mark";
      mark.style.left=`${mm*ZOOM_PX_PER_MM}px`;
      ruler.appendChild(mark);
    }
    els.zoomRail.appendChild(ruler);

    const railDevices=state.devices
      .filter(d=>d.field===field&&d.row===row)
      .sort((a,b)=>xMM(a)-xMM(b));

    railDevices.forEach(d=>{
      const el=document.createElement("div");
      el.className="zoom-device"+(isTerminal(d)?" terminal":"")+(paletteMeta(d.type).colorRole==="neutral"?" termN":"")+(isSurgeDevice(d)?" surge":"")+(d.installStatus==="new"?" is-new":"")+(d.id===state.selectedDeviceId?" selected":"");
      el.draggable=true;
      el.dataset.deviceId=d.id;
      el.style.left=`${xMM(d)*ZOOM_PX_PER_MM}px`;
      el.style.width=`${Math.max(9,widthMM(d)*ZOOM_PX_PER_MM-1)}px`;

      const posText=usesMMWidth(d)
        ? `${xMM(d).toFixed(1)} mm`
        : `TE ${Math.round(xMM(d)/TE_MM)+1}`;

      el.innerHTML=`
        <div class="z-tech">${esc(d.tech)}</div>
        <div class="z-label">${esc(d.label)}</div>
        <div class="z-pos">${posText}</div>
      `;

      el.onclick=ev=>{
        ev.stopPropagation();
        selectDevice(d.id,false);
      };

      el.ondragstart=ev=>{
        ev.dataTransfer.setData("text/plain",String(d.id));
        dragDeviceId=d.id;state.selectedDeviceId=d.id;
      };

      els.zoomRail.appendChild(el);
    });

    els.zoomRail.ondragover=ev=>ev.preventDefault();
    els.zoomRail.ondrop=ev=>{
      ev.preventDefault();

      const id=Number(ev.dataTransfer.getData("text/plain"));
      const d=getDevice(id);
      if(!d || d.field!==field || d.row!==row) return;

      const rect=els.zoomRail.getBoundingClientRect();
      let x=(ev.clientX-rect.left)/ZOOM_PX_PER_MM;

      if(usesMMWidth(d)){
        // mm-genaue Bauteile: 0,1 mm Raster + magnetisch exakt an Nachbar anlegen
        x=Math.round(x*10)/10;
        x=magneticSnapToEdges(d,field,row,x,d.id);
      }else{
        x=Math.round(x/TE_MM)*TE_MM;
      }

      x=Math.max(0,Math.min(railMM()-widthMM(d),x));
      moveDevice(d,field,row,x);
    };

    // Detailansicht ungefähr zum selektierten Gerät scrollen
    requestAnimationFrame(()=>{
      const center=xMM(selected)*ZOOM_PX_PER_MM;
      els.zoomRailWrap.scrollLeft=Math.max(0,center-els.zoomRailWrap.clientWidth/2);
    });
  }

  function downstreamTargets(sourceId){
    return orderedDevices().filter(d=>d.inputFrom===sourceId);
  }

  function pathRowsFrom(start, visited=new Set()){
    if(!start) return [];
    if(visited.has(start.id)) return [[start]];
    const nextVisited=new Set(visited);
    nextVisited.add(start.id);

    const targets=downstreamTargets(start.id);
    if(!targets.length) return [[start]];

    const rows=[];
    for(const t of targets){
      const sub=pathRowsFrom(t,nextVisited);
      for(const p of sub) rows.push([start,...p]);
    }
    return rows;
  }

  function connectionPhase(from, to){
    if(!from || !to) return "none";

    if(to.inputFrom===from.id){
      const p=selectedSourcePortPhase(to,from);
      if(p) return p;
    }

    const p=devicePhase(to);
    return p||"none";
  }

  function nodeClass(d){
    const classes=["schematic-node"];
    if(isExternalSource(d)) classes.push("external-source");
    if(d.type==="rcd2" || d.type==="rcd4") classes.push("rcd");
    if(isTerminal(d)) classes.push("terminal");
    if(isSurgeDevice(d)) classes.push("surge");
    return classes.join(" ");
  }

  function nodeHtml(d, extraClass=""){
    if(isExternalSource(d)) return `<div class="${nodeClass(d)}${extraClass ? ` ${extraClass}` : ""}"><div class="node-tech">EXTERNE QUELLE</div><div class="node-label">${esc(deviceDisplayName(d))}</div><div class="node-meta">außerhalb des Verteilers</div></div>`;
    const phase=devicePhase(d);
    const phaseTag =
      phase==="3P" ? `<span class="schematic-phase-tag P3">3P</span>` :
      ["L1","L2","L3","N"].includes(phase) ? `<span class="schematic-phase-tag ${phase}">${phase}</span>` : "";

    const group=effectiveGroup(d);
    return `
      <div class="${nodeClass(d)}${extraClass ? ` ${extraClass}` : ""}">
        <div class="node-tech">${esc(d.tech)} ${phaseTag}</div>
        <div class="node-label">${esc(d.label||paletteMeta(d.type).label||"")}</div>
        <div class="node-meta">F${d.field+1} R${d.row+1}${group?` · RCD ${esc(group)}`:""}</div>
      </div>`;
  }

  function multiInputLinks(target){
    const links=[];
    if(!target || !target.multiInputs) return links;

    for(const [targetPort,conn] of Object.entries(target.multiInputs)){
      if(!conn || conn.sourceId==null) continue;
      const src=getDevice(Number(conn.sourceId));
      if(!src) continue;

      links.push({
        source:src,
        sourcePort:conn.sourcePort||"OUT",
        targetPort
      });
    }
    return links;
  }

  function groupedUpstreamSources(target){
    const bySource=new Map();

    for(const link of multiInputLinks(target)){
      if(!bySource.has(link.source.id)){
        bySource.set(link.source.id,{
          source:link.source,
          links:[]
        });
      }
      bySource.get(link.source.id).links.push(link);
    }

    return [...bySource.values()];
  }

  function upstreamConnectionLabel(grouped){
    if(!grouped || !grouped.links.length) return "";

    const pairs=grouped.links
      .sort((a,b)=>String(a.targetPort).localeCompare(String(b.targetPort),undefined,{numeric:true}))
      .map(x=>{
        const s=x.sourcePort||"OUT";
        const t=x.targetPort||"IN";
        return s===t ? s : `${s}→${t}`;
      });

    return pairs.join(" / ");
  }

  function pathHtml(path, root=null, targetDepth=null, upstreamGroups=[]){
    const parts=[];

    // Vorgelagerte Quellen (z. B. I-0-II-Inselschalter oder Klemmstein)
    // werden VOR dem RCD dargestellt.
    if(root && upstreamGroups && upstreamGroups.length){
      upstreamGroups.forEach((g,idx)=>{
        parts.push(nodeHtml(g.source));

        const label=upstreamConnectionLabel(g);
        parts.push(
          `<div class="schematic-arrow phase-P4"><span>${esc(label)}</span></div>`
        );
      });
    }

    if(root){
      parts.push(nodeHtml(root));
      if(path.length){
        const p=connectionPhase(root,path[0]);
        const cls=["L1","L2","L3","N"].includes(p)?` phase-${p}`:"";
        const port=(path[0].inputPort && path[0].inputPort!=="OUT")?path[0].inputPort:p;
        parts.push(`<div class="schematic-arrow${cls}"><span>${esc(port||"")}</span></div>`);
      }
    }

    const missing = targetDepth!=null ? Math.max(0,targetDepth-path.length) : 0;

    path.forEach((d,i)=>{
      const isLast=i===path.length-1;

      if(isLast && missing>0){
        for(let s=0;s<missing;s++){
          const previous = i===0 ? root : path[i-1];
          const p = previous ? connectionPhase(previous,d) : devicePhase(d);
          const cls=["L1","L2","L3","N"].includes(p)?` phase-${p}`:"";
          parts.push(`<div class="schematic-spacer-node"></div>`);
          parts.push(`<div class="schematic-arrow${cls}"><span></span></div>`);
        }
      }

      parts.push(nodeHtml(d));

      if(i<path.length-1){
        const next=path[i+1];
        const p=connectionPhase(d,next);
        const cls=["L1","L2","L3","N"].includes(p)?` phase-${p}`:"";
        const port=(next.inputPort && next.inputPort!=="OUT")?next.inputPort:p;
        parts.push(`<div class="schematic-arrow${cls}"><span>${esc(port||"")}</span></div>`);
      }
    });

    return `<div class="schematic-path">${parts.join("")}</div>`;
  }


  function pathHtml3P(rows, root=null, targetDepth=null, upstreamGroups=[]){
    if(!rows || !rows.length) return "";
    const first=rows[0][0];
    if(!first || first.type!=="ls3") return rows.map(r=>pathHtml(r,root,targetDepth,upstreamGroups)).join("");

    const parts=[];

    // Vorgelagerte Quellen und RCD nur EINMAL darstellen.
    if(root && upstreamGroups && upstreamGroups.length){
      upstreamGroups.forEach(g=>{
        parts.push(nodeHtml(g.source));
        const label=upstreamConnectionLabel(g);
        parts.push(`<div class="schematic-arrow phase-P4"><span>${esc(label)}</span></div>`);
      });
    }

    if(root){
      parts.push(nodeHtml(root));
      parts.push(`<div class="schematic-arrow phase-P4"><span>3P</span></div>`);
    }

    parts.push(nodeHtml(first,"schematic-node-3p-main"));

    const phaseOrder=["L1","L2","L3"];
    const sorted=[...rows].sort((a,b)=>{
      const pa=a[1] ? connectionPhase(first,a[1]) : "";
      const pb=b[1] ? connectionPhase(first,b[1]) : "";
      return phaseOrder.indexOf(pa)-phaseOrder.indexOf(pb);
    });

    const branchHtml=sorted.map((row,idx)=>{
      const tail=row.slice(1);
      if(!tail.length) return "";
      const phase=connectionPhase(first,tail[0]);
      const cls=["L1","L2","L3","N"].includes(phase)?` phase-${phase}`:"";
      const branch=[];
      branch.push(`<div class="schematic-arrow${cls}"><span>${esc(phase||"")}</span></div>`);

      tail.forEach((d,i)=>{
        branch.push(nodeHtml(d));
        if(i<tail.length-1){
          const next=tail[i+1];
          const p=connectionPhase(d,next);
          const c=["L1","L2","L3","N"].includes(p)?` phase-${p}`:"";
          const port=(next.inputPort && next.inputPort!=="OUT")?next.inputPort:p;
          branch.push(`<div class="schematic-arrow${c}"><span>${esc(port||"")}</span></div>`);
        }
      });

      return `<div class="schematic-3p-branch">${branch.join("")}</div>`;
    }).join("");

    parts.push(`<div class="schematic-3p-fanout">${branchHtml}</div>`);
    return `<div class="schematic-path schematic-path-3p">${parts.join("")}</div>`;
  }

  function schematicGroupNames(){
    const names=new Set();
    state.devices.forEach(d=>{
      const g=effectiveGroup(d);
      if(g) names.add(g);
    });
    return [...names].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  }

  function renderSchematic(){
    const groups=schematicGroupNames();
    const html=[];
    html.push(`<div class="schematic-title">${esc(projectTitle("Logikplan"))}</div>`);

    if(!state.devices.length){
      els.schematicContent.innerHTML=`<div class="schematic-empty">Noch keine Elemente vorhanden.</div>`;
      return;
    }

    for(const group of groups){
      const groupDevices=orderedDevices().filter(d=>effectiveGroup(d)===group);
      const roots=groupDevices.filter(d=>
        (d.type==="rcd2" || d.type==="rcd4") &&
        (d.group||"").trim()===group
      );

      html.push(`
        <section class="schematic-group">
          <div class="schematic-group-header">
            <strong>RCD-Gruppe ${esc(group)}</strong>
            <span class="neutral-note">N gehört vollständig zu RCD ${esc(group)}</span>
          </div>`);

      if(roots.length){
        for(const root of roots){
          const direct=downstreamTargets(root.id).filter(d=>effectiveGroup(d)===group);

          const upstreamGroupsForHeader=groupedUpstreamSources(root);
          const upstreamHeader=upstreamGroupsForHeader.length
            ? `<div class="schematic-upstream-note">Eingang von: ${upstreamGroupsForHeader.map(g=>`${esc(deviceDisplayName(g.source))} (${esc(upstreamConnectionLabel(g))})`).join(" · ")}</div>`
            : "";

          html.push(`<div class="schematic-root">
            <div class="schematic-root-device">${nodeHtml(root)}${upstreamHeader}</div>
            <div class="schematic-branches">`);

          if(!direct.length){
            html.push(`<div class="schematic-warning">Dieser RCD hat noch keine logisch verbundenen Abgänge.</div>`);
          } else {
            const allRows=[];
            for(const d of direct){
              const rows=pathRowsFrom(d);
              for(const rowPath of rows) allRows.push(rowPath);
            }

            // Längster Pfad bestimmt die gemeinsame Endspalte.
            // Beispiel:
            // RCD → LS → Klemme
            // RCD → LS → Treppenlichtautomat → Klemme
            // => die Klemmen des ersten Pfads werden um eine Stufe nach rechts gezogen.
            const maxDepth=Math.max(...allRows.map(p=>p.length));

            const upstreamGroups=groupedUpstreamSources(root);

            const rendered3P=new Set();
            for(const rowPath of allRows){
              const first=rowPath[0];
              if(first && first.type==="ls3"){
                if(rendered3P.has(first.id)) continue;
                const same=allRows.filter(p=>p[0] && p[0].id===first.id);
                html.push(pathHtml3P(same,root,maxDepth,upstreamGroups));
                rendered3P.add(first.id);
              }else{
                html.push(pathHtml(rowPath,root,maxDepth,upstreamGroups));
              }
            }
          }

          html.push(`</div>
            <div class="schematic-neutral-bar">N-Schiene / Neutralleitergruppe: RCD ${esc(group)} · alle zugehörigen Endstromkreise müssen denselben N-Pfad verwenden.</div>
          </div>`);
        }
      }else{
        // Gruppe existiert durch Vererbung/manuelle Gruppierung, aber kein RCD als Wurzel gefunden.
        html.push(`<div class="schematic-root">
          <div class="schematic-warning">Für Gruppe ${esc(group)} wurde kein RCD als Wurzel gefunden. Die zugeordneten Elemente werden nach ihrer logischen Verbindung dargestellt.</div>`);

        const heads=groupDevices.filter(d=>
          d.inputFrom==null ||
          !groupDevices.some(x=>x.id===d.inputFrom)
        );

        html.push(`<div class="schematic-branches">`);
        for(const h of heads){
          const rows=pathRowsFrom(h);
          const maxDepth=rows.length?Math.max(...rows.map(p=>p.length)):0; rows.forEach(p=>html.push(pathHtml(p,null,maxDepth)));
        }
        html.push(`</div></div>`);
      }

      html.push(`</section>`);
    }

    // Nicht gruppierte, aber logisch verbundene Geräte separat zeigen.
    const ungrouped=orderedDevices().filter(d=>!effectiveGroup(d));
    if(ungrouped.length){
      const set=new Set(ungrouped.map(d=>d.id));
      const heads=ungrouped.filter(d=>d.inputFrom==null || !set.has(d.inputFrom));

      html.push(`
        <section class="schematic-group">
          <div class="schematic-group-header">
            <strong>Nicht zugeordnete Elemente</strong>
            <span class="neutral-note">RCD-/N-Gruppe fehlt</span>
          </div>
          <div class="schematic-root">
            <div class="schematic-branches">`);

      for(const h of heads){
        const rows=pathRowsFrom(h).filter(p=>p.some(x=>set.has(x.id)));
        rows.forEach(p=>html.push(pathHtml(p.filter(x=>set.has(x.id)))));
      }

      html.push(`</div></div></section>`);
    }

    els.schematicContent.innerHTML=html.join("");
  }

  function openSchematic(){
    renderSchematic();
    els.schematicModal.hidden=false;
    document.body.style.overflow="hidden";
  }

  function closeSchematic(){
    els.schematicModal.hidden=true;
    document.body.style.overflow="";
  }

  function endTerminalForPath(path){
    if(!path || !path.length) return null;
    const terminals=path.filter(isTerminal);
    return terminals.length ? terminals[terminals.length-1] : null;
  }

  function firstProtectionAfterRcd(path){
    if(!path || !path.length) return null;
    return path[0] || null;
  }

  function intermediateForPath(path){
    if(!path || path.length<3) return null;
    // Alles zwischen erstem Schutzgerät und Endklemme:
    const last=path[path.length-1];
    if(!isTerminal(last)) return path.length>1 ? path[1] : null;
    return path.length>2 ? path[1] : null;
  }

  function circuitPhaseForPath(path){
    if(!path || !path.length) return "none";
    const first=path[0];
    const p=devicePhase(first);
    return p||"none";
  }

  function circuitTerminalCells(terminal, phase){
    const name=terminal ? (terminal.label||terminal.tech||"Klemme") : "Abgang";
    const tech=terminal ? terminal.tech : "";
    if(phase==="3P"){
      return `
        <div class="tcell">L1</div>
        <div class="tcell">L2</div>
        <div class="tcell">L3</div>
        <div class="tname">${esc(name)} · ${esc(tech)}</div>`;
    }
    return `
      <div class="tcell">${esc(phase==="none"?"L":phase)}</div>
      <div class="tcell">N</div>
      <div class="tcell">PE</div>
      <div class="tname">${esc(name)} · ${esc(tech)}</div>`;
  }

  function circuitSymbolSvg(d, variant=""){
    if(!d) return "";

    const type=d.type;

    // Vereinheitlichte IEC/DIN-nahe Schaltzeichen, passend zum vertikalen
    // Stromlauf des HV-Planers. Schwarz/weiß und drucktauglich.
    const pole=(x, breakerMark=false)=>{
      const mark=breakerMark
        ? `<path class="aux" d="M${x+4} 15 l3 -3 M${x+6} 18 l3 -3"/>`
        : "";
      return `<line x1="${x}" y1="2" x2="${x}" y2="12"/>
        <circle cx="${x}" cy="13.5" r="1.3"/>
        <line x1="${x}" y1="15" x2="${x+7}" y2="27"/>
        ${mark}
        <circle cx="${x}" cy="31" r="1.3"/>
        <line x1="${x}" y1="32.5" x2="${x}" y2="42"/>`;
    };

    const fusePole=(x)=>`<line x1="${x}" y1="2" x2="${x}" y2="13"/>
      <rect x="${x-4}" y="13" width="8" height="16"/>
      <line x1="${x}" y1="29" x2="${x}" y2="42"/>`;

    if(type==="ls1"){
      return `<svg viewBox="0 0 34 44" aria-label="Leitungsschutzschalter 1-polig">
        ${pole(13,true)}
      </svg>`;
    }

    if(type==="ls3"){
      if(variant==="wide3p"){
        return `<svg viewBox="0 0 260 44" aria-label="Leitungsschutzschalter 3-polig">
          ${pole(17,true)}${pole(127,true)}${pole(237,true)}
          <line class="aux mech" x1="15" y1="29" x2="239" y2="29"/>
        </svg>`;
      }
      return `<svg viewBox="0 0 40 44" aria-label="Leitungsschutzschalter 3-polig">
        ${pole(5,true)}${pole(17,true)}${pole(29,true)}
        <line class="aux mech" x1="3" y1="29" x2="31" y2="29"/>
      </svg>`;
    }

    if(type==="rcd2"){
      return `<svg viewBox="0 0 38 44" aria-label="Fehlerstromschutzschalter 2-polig">
        ${pole(9,false)}${pole(25,false)}
        <path class="aux" d="M16 16 l3 -3 M18 19 l3 -3"/>
        <text x="14" y="39">Δ</text>
      </svg>`;
    }

    if(type==="rcd4"){
      return `<svg viewBox="0 0 46 44" aria-label="Fehlerstromschutzschalter 4-polig">
        ${pole(4,false)}${pole(15,false)}${pole(26,false)}${pole(37,false)}
        <path class="aux" d="M20 16 l3 -3 M22 19 l3 -3"/>
        <line class="aux mech" x1="2" y1="29" x2="39" y2="29"/>
        <text x="20" y="40">Δ</text>
      </svg>`;
    }

    if(type==="d02_1p"){
      return `<svg viewBox="0 0 34 44" aria-label="Schmelzsicherung 1-polig">
        ${fusePole(17)}
      </svg>`;
    }

    if(type==="d02"){
      return `<svg viewBox="0 0 40 44" aria-label="Schmelzsicherung 3-polig">
        ${fusePole(6)}${fusePole(19)}${fusePole(32)}
      </svg>`;
    }

    if(type==="main"){
      return `<svg viewBox="0 0 46 44" aria-label="Hauptschalter 4-polig">
        ${pole(4,false)}${pole(15,false)}${pole(26,false)}${pole(37,false)}
        <line class="aux mech" x1="2" y1="29" x2="39" y2="29"/>
      </svg>`;
    }

    if(type==="change"){
      return `<svg viewBox="0 0 46 44" aria-label="I-0-II Umschalter 4-polig">
        <g>${[4,15,26,37].map(x=>`<line x1="${x}" y1="2" x2="${x}" y2="11"/><circle cx="${x}" cy="13" r="1.2"/><line x1="${x}" y1="14.5" x2="${x+6}" y2="24"/><circle cx="${x}" cy="31" r="1.2"/><line x1="${x}" y1="32.5" x2="${x}" y2="42"/>`).join("")}</g>
        <line class="aux mech" x1="2" y1="28" x2="39" y2="28"/>
        <text x="14" y="9">I-0-II</text>
      </svg>`;
    }

    if(type==="treppe"){
      return `<svg viewBox="0 0 34 44" aria-label="Stromstoßschalter / Treppenlichtautomat">
        <line x1="17" y1="2" x2="17" y2="9"/>
        <rect x="7" y="9" width="20" height="18"/>
        <path class="aux" d="M10 22 h7 v-6 h7"/>
        <line x1="17" y1="27" x2="17" y2="42"/>
      </svg>`;
    }

    if(type==="schuetz" || type==="relais" || type==="zeitrelais_1w"){
      const txt=type==="schuetz"?"K":(type==="relais"?"R":"t");
      return `<svg viewBox="0 0 34 44" aria-label="${type==="schuetz"?"Schütz":type==="relais"?"Relais":"Zeitrelais"}">
        <line x1="17" y1="2" x2="17" y2="10"/>
        <rect x="7" y="10" width="20" height="20"/>
        <text x="14" y="24">${txt}</text>
        <line x1="17" y1="30" x2="17" y2="42"/>
      </svg>`;
    }

    if(type==="hla1"){
      return `<svg viewBox="0 0 34 44" aria-label="Hauptleitungsabzweigklemme 1-polig">
        <line x1="17" y1="2" x2="17" y2="18"/><circle cx="17" cy="18" r="2"/>
        <line x1="17" y1="18" x2="8" y2="31"/><line x1="17" y1="18" x2="17" y2="31"/><line x1="17" y1="18" x2="26" y2="31"/>
        <circle cx="8" cy="31" r="1.5"/><circle cx="17" cy="31" r="1.5"/><circle cx="26" cy="31" r="1.5"/>
      </svg>`;
    }

    if(type==="hla" || type==="hlak5_1to3" || type==="hlak5_1to3_compact"){
      return `<svg viewBox="0 0 42 44" aria-label="Hauptleitungsabzweigklemme mehrpolig">
        <line x1="8" y1="2" x2="8" y2="18"/><circle cx="8" cy="18" r="1.8"/>
        <line x1="21" y1="2" x2="21" y2="18"/><circle cx="21" cy="18" r="1.8"/>
        <line x1="34" y1="2" x2="34" y2="18"/><circle cx="34" cy="18" r="1.8"/>
        <line x1="8" y1="18" x2="8" y2="38"/><line x1="21" y1="18" x2="21" y2="38"/><line x1="34" y1="18" x2="34" y2="38"/>
        <line class="aux" x1="4" y1="25" x2="38" y2="25"/>
      </svg>`;
    }

    if(type==="meter" || type==="shelly_pro_3em"){
      return `<svg viewBox="0 0 34 44" aria-label="Energiezähler">
        <line x1="17" y1="2" x2="17" y2="8"/>
        <rect x="6" y="8" width="22" height="28"/>
        <circle cx="17" cy="22" r="7"/>
        <text x="10" y="25">kWh</text>
        <line x1="17" y1="36" x2="17" y2="42"/>
      </svg>`;
    }

    if(type==="netzteil1" || type==="netzteil" || type==="netzteil3" || type==="netzteil4"){
      return `<svg viewBox="0 0 34 44" aria-label="Netzteil">
        <line x1="17" y1="2" x2="17" y2="8"/>
        <rect x="6" y="8" width="22" height="28"/>
        <text x="10" y="19">~</text><text x="19" y="30">=</text>
        <line x1="17" y1="36" x2="17" y2="42"/>
      </svg>`;
    }

    if(type==="shelly" || type==="shelly1g3" || type==="shelly2pmg4" || type==="shelly_pro_4pm"){
      return `<svg viewBox="0 0 34 44" aria-label="Steuergerät">
        <line x1="17" y1="2" x2="17" y2="8"/>
        <rect x="6" y="8" width="22" height="28"/>
        <text x="13" y="25">S</text>
        <line x1="17" y1="36" x2="17" y2="42"/>
      </svg>`;
    }

    if(type==="spd"){
      return `<svg viewBox="0 0 34 44" aria-label="Überspannungsschutz Typ 2">
        <line x1="17" y1="2" x2="17" y2="9"/>
        <rect x="7" y="9" width="20" height="22"/>
        <path class="aux" d="M19 11 L12 22 H18 L15 29 L23 18 H18 Z"/>
        <line class="pe" x1="17" y1="31" x2="17" y2="35"/>
        <line class="pe" x1="10" y1="35" x2="24" y2="35"/>
        <line class="pe" x1="12" y1="38" x2="22" y2="38"/>
        <line class="pe" x1="14" y1="41" x2="20" y2="41"/>
      </svg>`;
    }

    if(type==="termN"){
      return `<svg viewBox="0 0 34 44" aria-label="N-Reihenklemme">
        <line class="n" x1="17" y1="2" x2="17" y2="14"/>
        <circle class="n" cx="17" cy="20" r="3"/>
        <line class="n" x1="17" y1="23" x2="17" y2="42"/>
        <text x="22" y="23">N</text>
      </svg>`;
    }

    if(type==="term1"){
      return `<svg viewBox="0 0 34 44" aria-label="Reihenklemme 1-polig">
        <line x1="17" y1="2" x2="17" y2="17"/><circle cx="17" cy="20" r="3"/><line x1="17" y1="23" x2="17" y2="42"/>
      </svg>`;
    }

    if(type==="term2"){
      return `<svg viewBox="0 0 34 44" aria-label="Reihenklemme 2-polig">
        <line x1="11" y1="2" x2="11" y2="17"/><circle cx="11" cy="20" r="2.5"/><line x1="11" y1="22.5" x2="11" y2="42"/>
        <line x1="24" y1="2" x2="24" y2="17"/><circle cx="24" cy="20" r="2.5"/><line x1="24" y1="22.5" x2="24" y2="42"/>
      </svg>`;
    }

    if(type==="term3"){
      if(variant==="terminalWide"){
        // Anschlusspunkte bewusst über die drei Segmente L / N / PE verteilt.
        // Dadurch treffen die gezeichneten Leiter exakt in das zugehörige Segment.
        return `<svg viewBox="0 0 118 44" aria-label="Reihenklemme L N PE">
          <line x1="20" y1="2" x2="20" y2="17"/><circle cx="20" cy="20" r="2.5"/><line x1="20" y1="22.5" x2="20" y2="42"/>
          <line class="n" x1="59" y1="2" x2="59" y2="17"/><circle class="n" cx="59" cy="20" r="2.5"/><line class="n" x1="59" y1="22.5" x2="59" y2="42"/>
          <line class="pe" x1="98" y1="2" x2="98" y2="29"/>
          <line class="pe" x1="92" y1="30" x2="104" y2="30"/><line class="pe" x1="94" y1="34" x2="102" y2="34"/><line class="pe" x1="96" y1="38" x2="100" y2="38"/>
        </svg>`;
      }
      return `<svg viewBox="0 0 38 44" aria-label="Reihenklemme L N PE">
        <line x1="7" y1="2" x2="7" y2="17"/><circle cx="7" cy="20" r="2.5"/><line x1="7" y1="22.5" x2="7" y2="42"/>
        <line class="n" x1="19" y1="2" x2="19" y2="17"/><circle class="n" cx="19" cy="20" r="2.5"/><line class="n" x1="19" y1="22.5" x2="19" y2="42"/>
        <line class="pe" x1="31" y1="2" x2="31" y2="29"/>
        <line class="pe" x1="25" y1="30" x2="37" y2="30"/><line class="pe" x1="27" y1="34" x2="35" y2="34"/><line class="pe" x1="29" y1="38" x2="33" y2="38"/>
      </svg>`;
    }

    return `<svg viewBox="0 0 34 44" aria-label="Gerät">
      <line x1="17" y1="2" x2="17" y2="8"/>
      <rect x="7" y="8" width="20" height="28"/>
      <line x1="17" y1="36" x2="17" y2="42"/>
    </svg>`;
  }

  function circuitDeviceBoxHtml(d, extraClass=""){
    if(!d) return "";
    const surgeClass=isSurgeDevice(d)?" surge":"";
    return `
      <div class="${extraClass}${surgeClass}">
        <div class="circuit-symbol-wrap">
          <div class="circuit-symbol">${circuitSymbolSvg(d)}</div>
          <div class="symbol-text">
            <div class="tech">${esc(d.tech)}</div>
            <div class="label">${esc(d.label||paletteMeta(d.type).label||"")}</div>
            <div class="meta">F${d.field+1} R${d.row+1}</div>
          </div>
        </div>
      </div>`;
  }

  function renderCircuitSheet(group, root, branchRows){
    const columns=[];

    // 3-poliger LS mit drei getrennten Ausgängen erscheint als EIN Stromkreis,
    // sofern alle drei Pfade denselben ersten LS benutzen.
    const groupedByFirst=new Map();
    for(const row of branchRows){
      if(!row.length) continue;
      const first=row[0];
      if(!groupedByFirst.has(first.id)) groupedByFirst.set(first.id,[]);
      groupedByFirst.get(first.id).push(row);
    }

    for(const [firstId, rows] of groupedByFirst){
      const first=getDevice(firstId);
      if(!first) continue;

      if(first.type==="ls3"){
        // Herd / 3P: eine Spalte, mehrere Endklemmen können logisch darunter liegen.
        const terminals=rows.map(endTerminalForPath).filter(Boolean);
        columns.push({
          first,
          phase:"3P",
          intermediate:null,
          terminal:terminals.length ? terminals[0] : null,
          extraTerminals:terminals.slice(1)
        });
      }else{
        for(const row of rows){
          columns.push({
            first:row[0],
            phase:circuitPhaseForPath(row),
            intermediate:intermediateForPath(row),
            terminal:endTerminalForPath(row),
            extraTerminals:[]
          });
        }
      }
    }

    const rcdName=root ? (root.label||"RCD") : `RCD ${group}`;
    const rcdTech=root ? root.tech : "RCD";
    const fieldMeta=root ? `F${root.field+1} R${root.row+1}` : "";

    // V6.55: Die Zeichenfläche wächst mit der tatsächlichen Anzahl/Breite der Stromkreise.
    // Absolute Elemente innerhalb der Spalten beeinflussen die CSS-Intrinsic-Breite nicht zuverlässig,
    // daher wird die benötigte Canvas-Breite hier explizit aus den Spalten berechnet.
    const columnGap=26;
    const columnsWidth=columns.reduce((sum,c)=>sum+((c.phase==="3P" && c.first?.type==="ls3")?330:150),0);
    const circuitCanvasWidth=Math.max(1030,180+columnsWidth+Math.max(0,columns.length-1)*columnGap+36);

    const colHtml=columns.map((c,idx)=>{
      const phaseClass=c.phase==="3P"?"P3":c.phase;
      const firstLabel=c.first ? (c.first.label||paletteMeta(c.first.type).label||"") : "";
      const firstTech=c.first ? c.first.tech : "";
      const firstMeta=c.first ? `F${c.first.field+1} R${c.first.row+1}` : "";
      const interm=c.intermediate;
      const term=c.terminal;

      if(c.phase==="3P" && c.first?.type==="ls3"){
        const allTerms=[term,...(c.extraTerminals||[])].filter(Boolean).slice(0,3);
        const phases=["L1","L2","L3"];
        const termHtml=phases.map((ph,i)=>{
          const t=allTerms[i]||null;
          return `<div class="terminal-block threephase-terminal t${i+1}">
            <div class="terminal-symbol-row">
              <div class="circuit-symbol terminal-wide-symbol">${t?circuitSymbolSvg(t,t.type==="term3"?"terminalWide":""):""}</div>
            </div>
            ${circuitTerminalCells(t,ph)}
          </div>`;
        }).join("");

        return `
          <div class="circuit-column threephase-column">
            <div class="phase-feed3 L1"></div>
            <div class="phase-feed3 L2"></div>
            <div class="phase-feed3 L3"></div>
            <div class="device-box with-symbol threephase-device">
              <div class="circuit-symbol-wrap">
                <div class="circuit-symbol wide-3p-symbol">${circuitSymbolSvg(c.first,"wide3p")}</div>
                <div class="symbol-text">
                  <div class="tech">${esc(firstTech)}</div>
                  <div class="label">${esc(firstLabel)}</div>
                  <div class="meta">${esc(firstMeta)} · 3P</div>
                </div>
              </div>
            </div>
            <div class="threephase-wires">
              <div class="wire3-straight L1"></div>
              <div class="wire3-straight L2"></div>
              <div class="wire3-straight L3"></div>
            </div>
            <div class="n-tap threephase-n n1"></div>
            <div class="n-tap threephase-n n2"></div>
            <div class="n-tap threephase-n n3"></div>
            <div class="pe-tap threephase-pe p1"></div>
            <div class="pe-tap threephase-pe p2"></div>
            <div class="pe-tap threephase-pe p3"></div>
            ${termHtml}
          </div>`;
      }

      return `
        <div class="circuit-column ${interm?"has-intermediate":""}">
          <div class="phase-feed ${esc(phaseClass)}"></div>
          <div class="device-box with-symbol">
            <div class="circuit-symbol-wrap">
              <div class="circuit-symbol">${circuitSymbolSvg(c.first)}</div>
              <div class="symbol-text">
                <div class="tech">${esc(firstTech)}</div>
                <div class="label">${esc(firstLabel)}</div>
                <div class="meta">${esc(firstMeta)} · ${esc(c.phase)}</div>
              </div>
            </div>
          </div>

          ${interm ? `
            <div class="intermediate-box with-symbol">
              <div class="circuit-symbol-wrap">
                <div class="circuit-symbol">${circuitSymbolSvg(interm)}</div>
                <div class="symbol-text">
                  <div class="tech">${esc(interm.tech)}</div>
                  <div class="label">${esc(interm.label||paletteMeta(interm.type).label||"")}</div>
                </div>
              </div>
            </div>` : ""}

          <div class="wire-down ${esc(phaseClass)}"></div>
          <div class="n-tap"></div>
          <div class="pe-tap"></div>

          <div class="terminal-block">
            <div class="terminal-symbol-row">
              <div class="circuit-symbol terminal-wide-symbol">${term?circuitSymbolSvg(term,term.type==="term3"?"terminalWide":""):""}</div>
            </div>
            ${circuitTerminalCells(term,c.phase)}
          </div>
        </div>`;
    }).join("");

    return `
      <section class="circuit-sheet rcd-circuit-sheet" style="--circuit-canvas-width:${circuitCanvasWidth}px">
        <div class="circuit-sheet-header">
          <strong>RCD-Gruppe ${esc(group)}</strong>
          <span>${esc(rcdTech)} · ${esc(rcdName)} ${fieldMeta?`· ${esc(fieldMeta)}`:""}</span>
        </div>

        <div class="circuit-legend">
          <span><i class="l1"></i>L1</span>
          <span><i class="l2"></i>L2</span>
          <span><i class="l3"></i>L3</span>
          <span><i class="n"></i>N</span>
          <span><i class="pe"></i>PE</span>
        </div>

        <div class="circuit-grid">
          <div class="circuit-labels">
            <div class="circuit-label L1">L1</div>
            <div class="circuit-label L2">L2</div>
            <div class="circuit-label L3">L3</div>
            <div class="circuit-label N">N</div>
            <div class="circuit-label PE">PE</div>
          </div>

          <div class="circuit-canvas">
            <div class="bus L1"></div>
            <div class="bus L2"></div>
            <div class="bus L3"></div>
            <div class="bus N"></div>
            <div class="bus PE"></div>

            <div class="rcd-wire L1"></div>
            <div class="rcd-wire L2"></div>
            <div class="rcd-wire L3"></div>
            <div class="rcd-wire N"></div>

            <div class="rcd-block">
              <div class="circuit-symbol-wrap">
                <div class="circuit-symbol">${circuitSymbolSvg(root)}</div>
                <div class="symbol-text">
                  <div class="tech">${esc(rcdTech)}</div>
                  <div class="name">${esc(rcdName)}</div>
                  <div class="meta">${esc(fieldMeta)} · RCD ${esc(group)}</div>
                </div>
              </div>
            </div>

            <div class="rcd-output-bundle" aria-label="Abgänge des RCD zu den nachgeordneten Schutzgeräten">
              <span class="L1"></span><span class="L2"></span><span class="L3"></span><span class="N"></span>
            </div>

            <div class="circuit-columns">
              ${colHtml}
            </div>
          </div>
        </div>

        <div class="circuit-note">
          N der L/N/PE-Reihenklemmen ist logisch automatisch mit dem Neutralleiter-Ausgang von RCD ${esc(group)} verknüpft.
        </div>
      </section>`;
  }

  function renderStandaloneProtection(spds){
    if(!spds || !spds.length) return "";

    const cards=spds.map((d,idx)=>{
      const inputs=d.multiInputs||{};
      const sourceNames=["L1","L2","L3","N"].map(ph=>{
        const c=inputs[ph];
        if(!c) return null;
        const src=getDevice(Number(c.sourceId));
        const srcName=src ? (src.label||src.tech||paletteMeta(src.type).label||`#${src.id}`) : `#${c.sourceId}`;
        return `${ph}: ${srcName} / ${c.sourcePort||"OUT"}`;
      }).filter(Boolean);

      return `<div class="standalone-protection-card surge">
        <div class="standalone-phase-feeds">
          <span class="feed L1"></span><span class="feed L2"></span><span class="feed L3"></span><span class="feed N"></span>
        </div>
        <div class="circuit-symbol standalone-symbol">${circuitSymbolSvg(d)}</div>
        <div class="standalone-device-text">
          <div class="tech">${esc(d.tech||"SPD Typ 2")}</div>
          <div class="label">${esc(d.label||"Überspannungsschutz")}</div>
          <div class="meta">F${d.field+1} R${d.row+1}${sourceNames.length?` · ${esc(sourceNames.join(" · "))}`:""}</div>
        </div>
        <div class="standalone-pe-wire"></div>
      </div>`;
    }).join("");

    return `<section class="circuit-sheet standalone-protection-sheet">
      <div class="circuit-sheet-header">
        <strong>Zentraler Überspannungsschutz</strong>
        <span>parallel am Einspeisepunkt / HLAK</span>
      </div>
      <div class="circuit-legend">
        <span><i class="l1"></i>L1</span><span><i class="l2"></i>L2</span><span><i class="l3"></i>L3</span><span><i class="n"></i>N</span><span><i class="pe"></i>PE</span>
      </div>
      <div class="standalone-protection-canvas">
        <div class="bus L1"></div><div class="bus L2"></div><div class="bus L3"></div><div class="bus N"></div><div class="bus PE"></div>
        <div class="standalone-protection-cards">${cards}</div>
      </div>
      <div class="circuit-note">Der SPD wird parallel dargestellt. Nicht zugeordnete N-/PE-Verbindungen werden nicht erfunden; sie müssen im Projekt bzw. in der Ausführungsplanung eindeutig dokumentiert sein.</div>
    </section>`;
  }

  function renderCircuit(){
    const html=[];
    html.push(`<div class="circuit-print-title">${esc(projectTitle("Stromlaufplan"))}</div>`);

    const spds=orderedDevices().filter(d=>d.type==="spd");
    if(spds.length) html.push(renderStandaloneProtection(spds));

    const groups=schematicGroupNames();

    if(!groups.length){
      if(!spds.length){
        els.circuitContent.innerHTML=`<div class="schematic-empty">Noch keine RCD-Gruppen bzw. logischen Verbindungen vorhanden.</div>`;
        return;
      }
      els.circuitContent.innerHTML=html.join("");
      return;
    }

    for(const group of groups){
      const groupDevices=orderedDevices().filter(d=>effectiveGroup(d)===group);
      const roots=groupDevices.filter(d=>
        (d.type==="rcd2" || d.type==="rcd4") &&
        (d.group||"").trim()===group
      );

      if(!roots.length){
        html.push(`
          <section class="circuit-sheet">
            <div class="circuit-sheet-header"><strong>RCD-Gruppe ${esc(group)}</strong><span>kein RCD als Wurzel gefunden</span></div>
            <div class="schematic-warning">Für diese Gruppe kann noch kein vollständiger Stromlaufplan erzeugt werden.</div>
          </section>`);
        continue;
      }

      for(const root of roots){
        const direct=downstreamTargets(root.id).filter(d=>effectiveGroup(d)===group);
        const allRows=[];

        for(const d of direct){
          const rows=pathRowsFrom(d);
          for(const row of rows){
            allRows.push(row);
          }
        }

        html.push(renderCircuitSheet(group,root,allRows));
      }
    }

    els.circuitContent.innerHTML=html.join("");
  }

  function openCircuit(){
    renderCircuit();
    els.circuitModal.hidden=false;
    document.body.style.overflow="hidden";
  }

  function closeCircuit(){
    els.circuitModal.hidden=true;
    document.body.style.overflow="";
  }

  function bomDisplayName(d){
    const meta=paletteMeta(d.type);
    return meta.label || d.label || d.type;
  }

  function bomWidthText(d){
    if(usesMMWidth(d)){
      return `${widthMM(d).toFixed(1).replace(".",",")} mm`;
    }
    const te=Number(d.widthTE||paletteMeta(d.type).widthTE||1);
    return `${te} TE`;
  }

  function bomGroupKey(d){
    // Herstellerneutral: gleiche Geräteart + technische Ausführung + mechanische Breite.
    // Individuelle Stromkreisbezeichnungen spielen für die Bestellung keine Rolle.
    return [
      d.type,
      (d.tech||paletteMeta(d.type).tech||"").trim(),
      usesMMWidth(d) ? `mm:${widthMM(d)}` : `te:${Number(d.widthTE||paletteMeta(d.type).widthTE||1)}`
    ].join("|");
  }

  function buildBomRows(onlyNew=!!els.bomOnlyNew?.checked){
    const map=new Map();

    for(const d of state.devices){
      if(onlyNew && d.installStatus!=="new") continue;
      // "Reserve" ist ein Platzhalter im Plan und kein zu bestellendes Bauteil.
      if(d.type==="reserve") continue;

      const key=bomGroupKey(d);
      if(!map.has(key)){
        map.set(key,{
          type:d.type,
          name:bomDisplayName(d),
          tech:(d.tech||paletteMeta(d.type).tech||"").trim(),
          width:bomWidthText(d),
          qty:0,
          widthTE:usesMMWidth(d)?0:Number(d.widthTE||paletteMeta(d.type).widthTE||1),
          widthMM:usesMMWidth(d)?widthMM(d):0
        });
      }
      map.get(key).qty++;
    }

    return [...map.values()].sort((a,b)=>{
      const typeCmp=a.name.localeCompare(b.name,undefined,{numeric:true});
      if(typeCmp!==0) return typeCmp;
      return a.tech.localeCompare(b.tech,undefined,{numeric:true});
    });
  }

  function renderBom(){
    const rows=buildBomRows();
    if(!rows.length){
      els.bomContent.innerHTML=`<div class="bom-empty">Noch keine bestellbaren Elemente im Plan vorhanden.</div>`;
      return;
    }

    const deviceQty=rows.reduce((s,r)=>s+r.qty,0);
    const totalTE=rows.reduce((s,r)=>s+r.qty*r.widthTE,0);
    const terminalMM=rows.reduce((s,r)=>s+r.qty*r.widthMM,0);

    const body=rows.map(r=>{
      const totalWidth = r.widthTE>0
        ? `${r.qty*r.widthTE} TE`
        : `${(r.qty*r.widthMM).toFixed(1).replace(".",",")} mm`;

      return `
        <tr>
          <td class="qty">${r.qty}</td>
          <td>${esc(r.name)}</td>
          <td>${esc(r.tech||"—")}</td>
          <td class="width">${esc(r.width)}</td>
          <td class="width">${esc(totalWidth)}</td>
        </tr>`;
    }).join("");

    els.bomContent.innerHTML=`
      <div class="bom-print-title">${esc(projectTitle("Stückliste"))}</div>

      <div class="bom-summary">
        <div class="bom-stat">Bestellpositionen<strong>${rows.length}</strong></div>
        <div class="bom-stat">Bauteile gesamt<strong>${deviceQty}</strong></div>
        <div class="bom-stat">Modulgeräte gesamt<strong>${totalTE} TE</strong></div>
        <div class="bom-stat">Reihenklemmen-Breite<strong>${terminalMM.toFixed(1).replace(".",",")} mm</strong></div>
      </div>

      <table class="bom-table">
        <thead>
          <tr>
            <th>Menge</th>
            <th>Bauteil</th>
            <th>Ausführung</th>
            <th>Breite / Stück</th>
            <th>Gesamtbreite</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>

      <div class="bom-note">
        Gleiche Bauteilart und gleiche technische Ausführung werden automatisch zusammengefasst.
        Individuelle Bezeichnungen wie „Wohnzimmer“ oder „Herd“ verändern die Bestellmenge nicht.
        Reserve-Platzhalter werden nicht als Bauteil gezählt. Mit „nur Neu“ kann die Bestellliste auf neu markierte Geräte begrenzt werden.
      </div>`;
  }

  function openBom(){
    renderBom();
    els.bomModal.hidden=false;
    document.body.style.overflow="hidden";
  }

  function closeBom(){
    els.bomModal.hidden=true;
    document.body.style.overflow="";
  }

  function csvCell(value){
    const s=String(value??"");
    return `"${s.replaceAll('"','""')}"`;
  }

  function exportBomCsv(){
    const rows=buildBomRows();
    if(!rows.length){
      flash("Keine Stückliste zum Exportieren.");
      return;
    }

    const lines=[
      ["Menge","Bauteil","Ausführung","Breite / Stück","Gesamtbreite"].map(csvCell).join(";")
    ];

    for(const r of rows){
      const totalWidth=r.widthTE>0
        ? `${r.qty*r.widthTE} TE`
        : `${(r.qty*r.widthMM).toFixed(1).replace(".",",")} mm`;

      lines.push([
        r.qty,
        r.name,
        r.tech||"",
        r.width,
        totalWidth
      ].map(csvCell).join(";"));
    }

    // UTF-8 BOM sorgt dafür, dass Excel Umlaute beim Direktöffnen sauber erkennt.
    const blob=new Blob(["\ufeff"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download="HV-Stueckliste.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function renderStatus(){
    if(state.selectedPalette==null)els.statusBar.textContent="Gerät wählen oder vorhandenes Gerät anklicken/ziehen.";
    else{const p=palette[state.selectedPalette],w=p.terminal?`${p.widthMM.toFixed(1)} mm`:`${p.widthTE} TE`;els.statusBar.textContent=`Platzieren: ${p.label} (${p.tech}, ${w}) – auf gewünschte Position klicken. Belegte Geräte werden bei Bedarf nach rechts geschoben.`}
  }


  function plausibilityIssues(){
    const issues=[];const exists=id=>getDevice(Number(id));
    for(const d of orderedDevices()){
      const pos=`F${d.field+1} R${d.row+1} · ${d.label||paletteMeta(d.type).label||d.tech}`;
      if(d.field<0||d.field>=state.fields||d.row<0||d.row>=state.rows||xMM(d)<-.001||xMM(d)+widthMM(d)>railMM()+.001) issues.push({level:"error",text:`${pos}: liegt außerhalb der konfigurierten Verteilung.`});
      if(d.inputFrom!=null&&!exists(d.inputFrom)) issues.push({level:"error",text:`${pos}: Eingang verweist auf ein nicht mehr vorhandenes Gerät.`});
      if(d.multiInputs) for(const [port,link] of Object.entries(d.multiInputs)){if(link&&link.sourceId!=null&&!exists(link.sourceId))issues.push({level:"error",text:`${pos}: Eingang ${port} verweist auf eine nicht mehr vorhandene Quelle.`})}
      if(isTerminal(d)&&d.inputFrom==null&&(!d.multiInputs||!Object.keys(d.multiInputs).length)) issues.push({level:"warn",text:`${pos}: Klemme hat keinen zugeordneten Einspeisepfad.`});
      const hasOutput=sourcePorts(d).some(port=>outputConnections(d,port.id).length>0);
      if((d.type==="rcd2"||d.type==="rcd4")&&!hasOutput) issues.push({level:"warn",text:`${pos}: RCD hat aktuell keinen zugeordneten Abgang.`});
      if(["ls1","ls3","d02","d02_1p"].includes(d.type)&&!hasOutput) issues.push({level:"info",text:`${pos}: Schutzgerät hat aktuell kein zugeordnetes Ziel.`});
    }
    return issues;
  }
  function renderPlausibility(){
    const issues=plausibilityIssues();
    if(!issues.length){els.checkContent.innerHTML='<div class="check-ok"><strong>Keine auffälligen Modellstellen gefunden.</strong><br><span>Das ist keine Aussage zur normgerechten Ausführung.</span></div>';return}
    els.checkContent.innerHTML=`<div class="check-summary">${issues.length} Hinweis${issues.length===1?"":"e"} gefunden.</div><div class="check-list">${issues.map(i=>`<div class="check-item ${i.level}">${esc(i.text)}</div>`).join("")}</div><div class="check-disclaimer">Plausibilitätscheck = logische Modellhilfe, keine Normprüfung.</div>`;
  }
  function openPlausibility(){renderPlausibility();els.checkModal.hidden=false;document.body.style.overflow="hidden"}
  function closePlausibility(){els.checkModal.hidden=true;document.body.style.overflow=""}

  function renderAll(){
    if(els.sourcesCount) els.sourcesCount.textContent=String(state.externalSources.length);renderPalette();renderBoard();renderDeviceTable();renderProps();renderSummary();renderZoomRail();renderStatus();updateHistoryButtons()}

  function rebuildFromConfig(){
    pushHistory("config");
    const nf=Number(els.fieldCount.value),nr=Number(els.rowCount.value),nt=Number(els.teCount.value),newRail=nt*TE_MM;
    const bad=state.devices.some(d=>d.field>=nf||d.row>=nr||xMM(d)+widthMM(d)>newRail+.001);
    if(bad&&!confirm("Einige Geräte liegen außerhalb der neuen Schrankgröße und werden entfernt. Fortfahren?")){els.fieldCount.value=state.fields;els.rowCount.value=state.rows;els.teCount.value=state.te;return}
    const removed=new Set(state.devices.filter(d=>d.field>=nf||d.row>=nr||xMM(d)+widthMM(d)>newRail+.001).map(d=>d.id));
    state.fields=nf;state.rows=nr;state.te=nt;state.devices=state.devices.filter(d=>d.field<nf&&d.row<nr&&xMM(d)+widthMM(d)<=railMM()+.001);
    const keptPhaseStarts={},keptRailModes={};
    for(let f=0;f<nf;f++)for(let r=0;r<nr;r++){const k=phaseStartKey(f,r);if(state.phaseStarts?.[k])keptPhaseStarts[k]=state.phaseStarts[k];if(state.rowRailModes?.[k])keptRailModes[k]=state.rowRailModes[k];}
    state.phaseStarts=keptPhaseStarts;state.rowRailModes=keptRailModes;
    state.devices.forEach(d=>{if(removed.has(d.inputFrom))d.inputFrom=null});state.selectedDeviceId=null;renderAll();
  }

  [els.fieldCount,els.rowCount,els.teCount].forEach(e=>e.onchange=rebuildFromConfig);
  els.viewScale.oninput=()=>{state.viewScale=Number(els.viewScale.value)||100;applyBoardViewScale()};
  els.viewScaleReset.onclick=()=>{state.viewScale=100;applyBoardViewScale()};
  els.autoJump.onchange=()=>{state.autoJump=!!els.autoJump.checked;};
  els.insertStatus.onchange=()=>{state.insertStatus=els.insertStatus.value==="new"?"new":"existing";};
  els.balancePhasesBtn.onclick=()=>{
    pushHistory("balance");
    // Für drei gleich aufgebaute 8-LS-Reihen ergibt L1 / L3 / L2 exakt 8/8/8.
    // Das Muster wiederholt sich feldübergreifend und kann anschließend pro Reihe
    // jederzeit manuell überschrieben werden.
    const pattern=["L1","L3","L2"];
    let i=0;
    for(let f=0;f<state.fields;f++)for(let r=0;r<state.rows;r++){
      if(rowRailMode(f,r)==="none") continue;
      setRowPhaseStart(f,r,pattern[i++%pattern.length]);
      remapRowRcdOutputs(f,r);
    }
    renderAll();
    flash("Abgangsschienen auf L1 / L3 / L2 rotierend verteilt.");
  };

  function projectTitle(suffix){
    const name=(state.projectName||"").trim();
    return name ? `HV-Planer – ${name} – ${suffix}` : `HV-Planer – ${suffix}`;
  }

  function renderProjectTitles(){
    if(els.printListTitle) els.printListTitle.textContent=projectTitle("Elementliste");
  }

  els.projectName.oninput=()=>{
    pushHistory("project-name",900);state.projectName=els.projectName.value;
    renderProjectTitles();
  };

  function renderSourcesManager(){
    if(els.sourcesCount) els.sourcesCount.textContent=String(state.externalSources.length);
    if(!els.sourcesList) return;
    if(!state.externalSources.length){els.sourcesList.innerHTML='<p class="hint">Noch keine externe Quelle definiert.</p>';return;}
    els.sourcesList.innerHTML=state.externalSources.map(src=>`<div class="source-row" data-source-id="${src.id}"><input class="source-name" maxlength="120" value="${esc(src.label||"")}" placeholder="z. B. HAK / EVU oder Zählerschrank D02 40 A"><span class="source-conductors">L1 · L2 · L3 · N · PE</span><button class="danger source-delete" type="button">Löschen</button></div>`).join("");
    els.sourcesList.querySelectorAll('.source-row').forEach(row=>{
      const id=Number(row.dataset.sourceId),inp=row.querySelector('.source-name'),del=row.querySelector('.source-delete');
      inp.oninput=()=>{const src=getDevice(id);if(!src)return;pushHistory(`source-name-${id}`,900);src.label=inp.value;if(els.sourcesCount)els.sourcesCount.textContent=String(state.externalSources.length);renderAll()};
      del.onclick=()=>{const used=state.devices.some(d=>d.inputFrom===id || (d.multiInputs&&Object.values(d.multiInputs).some(c=>c&&Number(c.sourceId)===id)));if(used&&!confirm('Diese Quelle ist bereits mit Eingängen verknüpft. Quelle und alle Verknüpfungen wirklich löschen?'))return;pushHistory('source-delete');state.devices.forEach(d=>{if(d.inputFrom===id){d.inputFrom=null;d.inputPort='OUT'}if(d.multiInputs)for(const k of Object.keys(d.multiInputs)){if(Number(d.multiInputs[k]?.sourceId)===id)delete d.multiInputs[k]}});state.externalSources=state.externalSources.filter(x=>x.id!==id);renderSourcesManager();renderAll()};
    });
  }
  function openSources(){renderSourcesManager();els.sourcesModal.hidden=false}
  function closeSources(){els.sourcesModal.hidden=true}
  if(els.sourcesBtn) els.sourcesBtn.onclick=openSources;
  if(els.closeSourcesBtn) els.closeSourcesBtn.onclick=closeSources;
  if(els.sourcesModal) els.sourcesModal.onclick=e=>{if(e.target===els.sourcesModal)closeSources()};
  if(els.addSourceBtn) els.addSourceBtn.onclick=()=>{pushHistory('source-add');state.externalSources.push({id:state.nextSourceId--,externalSource:true,label:'Neue Quelle',tech:''});renderSourcesManager();renderAll()};

  function buildPayload(){return {version:"6.66",projectName:state.projectName,externalSources:state.externalSources,nextSourceId:state.nextSourceId,fields:state.fields,rows:state.rows,te:state.te,viewScale:state.viewScale,autoJump:state.autoJump,insertStatus:state.insertStatus,phaseStarts:state.phaseStarts,rowRailModes:state.rowRailModes,devices:state.devices,nextId:state.nextId};}
  els.saveBtn.onclick=()=>{
    const payload=buildPayload();
    const safeName=(state.projectName||"").trim().replace(/[^a-z0-9äöüß_-]+/gi,"-").replace(/^-+|-+$/g,"");
    const suggested=safeName?`hv-plan-${safeName}.json`:"hv-plan.json";
    let filename=prompt("Dateiname für die Projektdatei:",suggested);
    if(filename===null) return;
    filename=filename.trim();
    if(!filename) filename=suggested;
    filename=filename.replace(/[\/:*?"<>|]+/g,"-");
    if(!/\.json$/i.test(filename)) filename+=".json";
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;a.click();URL.revokeObjectURL(a.href);
  };

  function migrateLoadedDevice(d){
    const m=paletteMeta(d.type);
    const exactMM=usesMMWidth(m);
    const normalizeMultiInputs=(mi)=>{
      if(!mi || typeof mi!=="object") return hasMultiInputs(d)?{}:null;
      const out={};
      for(const [k,v] of Object.entries(mi)){
        if(!v) continue;
        out[k]={...v,sourceId:Number(v.sourceId),sourcePort:v.sourcePort||"OUT"};
      }
      return out;
    };

    if(d.xMM!=null){
      return {
        ...d,
        id:Number(d.id),
        mode:d.mode||(exactMM?"mm":"te"),
        widthTE:exactMM?null:Number(d.widthTE??d.width??m.widthTE??1),
        widthMM:exactMM?Number(d.widthMM??m.widthMM??5.2):null,
        inputFrom:d.inputFrom==null?null:Number(d.inputFrom),
        inputPort:d.inputPort||"OUT",
        multiInputs:normalizeMultiInputs(d.multiInputs),
        installStatus:d.installStatus==="new"?"new":"existing"
      };
    }

    return {
      id:Number(d.id),type:d.type,label:d.label,tech:d.tech,
      mode:exactMM?"mm":"te",
      widthTE:exactMM?null:Number(d.width||m.widthTE||1),
      widthMM:exactMM?Number(d.widthMM||m.widthMM||5.2):null,
      phase:d.phase,group:d.group||"",
      inputFrom:d.inputFrom==null?null:Number(d.inputFrom),
      inputPort:d.inputPort||"OUT",
      multiInputs:normalizeMultiInputs(d.multiInputs),
      installStatus:d.installStatus==="new"?"new":"existing",
      field:Number(d.field||0),row:Number(d.row||0),xMM:Number(d.slot||0)*TE_MM
    };
  }

  function applyLoadedData(data){
      state.projectName=String(data.projectName||"");
      state.externalSources=Array.isArray(data.externalSources)?data.externalSources.map(x=>({id:Number(x.id),externalSource:true,label:String(x.label||"Externe Quelle"),tech:""})):[];
      if(!state.externalSources.length && String(data.projectFeed||"").trim()) state.externalSources=[{id:-1,externalSource:true,label:String(data.projectFeed).trim(),tech:""}];
      state.nextSourceId=Number(data.nextSourceId)||Math.min(-1,...state.externalSources.map(x=>Number(x.id)||-1))-1;state.fields=Number(data.fields)||2;state.rows=Number(data.rows)||5;state.te=Number(data.te)||12;state.viewScale=Math.max(60,Math.min(250,Number(data.viewScale)||100));state.autoJump=data.autoJump!==false;state.insertStatus=data.insertStatus==="new"?"new":"existing";
      state.phaseStarts=(data.phaseStarts && typeof data.phaseStarts==="object")?{...data.phaseStarts}:{};
      state.devices=Array.isArray(data.devices)?data.devices.map(migrateLoadedDevice):[];
      if(data.rowRailModes && typeof data.rowRailModes==="object"){
        state.rowRailModes={...data.rowRailModes};
      }else{
        // Migration alter Projekte: eine reale 3P-Schiene nur dort annehmen,
        // wo bereits ein 4-poliger RCD / Schutzschalter sitzt. Alle anderen
        // Reihen starten bewusst ohne Stromschiene und erzwingen keine Phase.
        state.rowRailModes={};
        for(let f=0;f<state.fields;f++)for(let r=0;r<state.rows;r++){
          if(state.devices.some(d=>d.field===f&&d.row===r&&isFourPoleWithN(d))) setRowRailMode(f,r,"3P");
        }
      }
      state.devices.forEach(d=>{
        if(isTerminal(d) && d.inputFrom!=null && (d.phase==null || d.phase==="none")){
          d.phase="auto";
        }
      });

      // Alte Pläne können denselben LS-Ausgang mehrfach benutzt haben.
      // Bei begrenzten Ports bleibt die erste Verbindung erhalten,
      // weitere werden gelöst, damit der Plan elektrisch eindeutig bleibt.
      const seenLimitedPorts=new Set();
      orderedDevices().forEach(d=>{
        if(d.inputFrom==null) return;

        const src=getDevice(d.inputFrom);
        if(!src) return;

        const portId=d.inputPort||"OUT";
        const port=sourcePorts(src).find(p=>p.id===portId);
        if(!port || port.maxTargets===Infinity) return;

        const key=`${src.id}|${portId}`;
        if(seenLimitedPorts.has(key)){
          d.inputFrom=null;
          d.inputPort="OUT";
        } else {
          seenLimitedPorts.add(key);
        }
      });state.nextId=Number(data.nextId)||(Math.max(0,...state.devices.map(d=>d.id||0))+1);state.selectedDeviceId=null;
      els.projectName.value=state.projectName;els.fieldCount.value=String(state.fields);els.rowCount.value=String(state.rows);els.teCount.value=String(state.te);els.viewScale.value=String(state.viewScale);els.autoJump.checked=state.autoJump;els.insertStatus.value=state.insertStatus;history.undo=[];history.redo=[];renderProjectTitles();renderAll();
  }
  els.loadInput.onchange=async()=>{
    const file=els.loadInput.files[0];if(!file)return;
    try{applyLoadedData(JSON.parse(await file.text()));server.detach();}catch(e){console.error(e);alert("Die Datei konnte nicht geladen werden.")}els.loadInput.value="";
  };

  els.printListBtn.onclick=()=>{document.body.classList.add("print-list-mode");window.print()};
  window.onafterprint=()=>{document.body.classList.remove("print-list-mode");document.body.classList.remove("print-schematic-mode");document.body.classList.remove("print-circuit-mode");document.body.classList.remove("print-bom-mode")};

  els.bomBtn.onclick=openBom;
  els.closeBomBtn.onclick=closeBom;
  els.bomModal.onclick=ev=>{
    if(ev.target===els.bomModal) closeBom();
  };
  els.bomCsvBtn.onclick=exportBomCsv;
  els.bomOnlyNew.onchange=renderBom;
  els.printBomBtn.onclick=()=>{
    document.body.classList.add("print-bom-mode");
    window.print();
  };

  els.checkBtn.onclick=openPlausibility;
  els.closeCheckBtn.onclick=closePlausibility;
  els.checkModal.onclick=ev=>{if(ev.target===els.checkModal)closePlausibility()};
  els.undoBtn.onclick=undo;els.redoBtn.onclick=redo;

  els.schematicBtn.onclick=openSchematic;
  els.circuitBtn.onclick=openCircuit;
  els.closeCircuitBtn.onclick=closeCircuit;
  els.circuitModal.onclick=ev=>{
    if(ev.target===els.circuitModal) closeCircuit();
  };
  els.printCircuitBtn.onclick=()=>{
    document.body.classList.add("print-circuit-mode");
    window.print();
  };
  els.closeSchematicBtn.onclick=closeSchematic;
  els.schematicModal.onclick=ev=>{
    if(ev.target===els.schematicModal) closeSchematic();
  };
  document.addEventListener("keydown",ev=>{
    if(ev.key==="Escape" && !els.schematicModal.hidden) closeSchematic();
    if(ev.key==="Escape" && !els.circuitModal.hidden) closeCircuit();
    if(ev.key==="Escape" && !els.bomModal.hidden) closeBom();
    if(ev.key==="Escape" && !els.checkModal.hidden) closePlausibility();
  });
  els.printSchematicBtn.onclick=()=>{
    document.body.classList.add("print-schematic-mode");
    window.print();
  };

  els.helpBtn.onclick=()=>{els.helpModal.hidden=false};
  els.closeHelpBtn.onclick=()=>{els.helpModal.hidden=true};
  els.helpModal.addEventListener("click",e=>{if(e.target===els.helpModal) els.helpModal.hidden=true});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!els.helpModal.hidden) els.helpModal.hidden=true});

  els.aboutBtn.onclick=()=>{els.aboutModal.hidden=false};
  els.closeAboutBtn.onclick=()=>{els.aboutModal.hidden=true};
  els.aboutModal.addEventListener("click",e=>{if(e.target===els.aboutModal) els.aboutModal.hidden=true});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!els.aboutModal.hidden) els.aboutModal.hidden=true});
  
  els.resetBtn.onclick=()=>{if(!confirm("Aktuellen Plan wirklich löschen?"))return;pushHistory("reset");server.detach();state.projectName="";els.projectName.value="";state.externalSources=[];state.nextSourceId=-1;state.viewScale=100;els.viewScale.value="100";state.autoJump=true;els.autoJump.checked=true;state.insertStatus="existing";els.insertStatus.value="existing";state.devices=[];state.selectedDeviceId=null;state.selectedPalette=null;state.nextId=1;state.phaseStarts={};state.rowRailModes={};renderProjectTitles();renderAll()};

  function flash(msg){els.statusBar.textContent=msg;setTimeout(renderStatus,1800)}
  function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}

  els.projectName.value=state.projectName;els.fieldCount.value=String(state.fields);els.rowCount.value=String(state.rows);els.teCount.value=String(state.te);els.viewScale.value=String(state.viewScale);els.autoJump.checked=state.autoJump;els.insertStatus.value=state.insertStatus;history.undo=[];history.redo=[];renderProjectTitles();renderAll();

  // ===== Server-Anbindung (SQLite + OIDC) =====
  // Wird vom Patch-Skript angefügt. Aktiv nur, wenn /api/me antwortet; beim Öffnen
  // per file:// oder von einem reinen Dateiserver bleibt der Planer unverändert.
  const server=(()=>{
    const S={enabled:false,planId:null,planName:"",version:0,lastSaved:"",saving:false,conflict:false,dirtySince:null};
    const $q=s=>document.querySelector(s);
    const bar=$q("#serverBar"),statusEl=$q("#serverStatus"),userEl=$q("#serverUser");
    const plansModal=$q("#plansModal"),plansList=$q("#plansList");
    const AUTOSAVE_AFTER_MS=3000,TICK_MS=1500;

    const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
    const fmt=iso=>{try{return new Date(iso).toLocaleString("de-DE",{dateStyle:"short",timeStyle:"short"})}catch(e){return iso||""}};
    const current=()=>JSON.stringify(buildPayload());
    const isDirty=()=>S.planId!=null&&current()!==S.lastSaved;
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
      a.href="/auth/login?return=%2F";a.target="_blank";a.rel="noopener";
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
      if(current()!==S.lastSaved)setStatus("Ungespeicherte Änderungen","dirty");
    }

    function detach(){
      S.planId=null;S.planName="";S.version=0;S.lastSaved="";S.conflict=false;S.dirtySince=null;
      refreshStatus();
    }

    async function save(opts={}){
      if(!S.enabled||S.saving)return false;
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
        S.planId=p.id;S.planName=p.name;S.version=p.version;S.conflict=false;S.dirtySince=null;
        // Eine wiederhergestellte Version gilt als geändert und wird beim nächsten Autosave neu gespeichert.
        S.lastSaved=historyId?"":current();
        if(historyId)setStatus("Ältere Version geladen – wird gespeichert …","dirty");
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
        info.append(el("strong",null,p.name));
        const bits=["Version "+p.version,"geändert "+fmt(p.updated_at)];
        if(p.updated_by)bits.push("von "+p.updated_by);
        if(!p.mine&&p.owner_name)bits.push("Besitzer: "+p.owner_name);
        info.append(el("span","hint",bits.join(" · ")));

        const actions=el("div","plan-actions");
        const openB=el("button",null,p.id===S.planId?"Geöffnet":"Öffnen");
        openB.type="button";openB.disabled=p.id===S.planId;
        openB.onclick=async()=>{if(await openPlan(p.id))closePlans()};
        const histB=el("button",null,"Verlauf");histB.type="button";
        const delB=el("button","danger","Löschen");delB.type="button";
        actions.append(openB,histB,delB);

        const hist=el("div","plan-history");hist.hidden=true;
        histB.onclick=async()=>{
          if(!hist.hidden){hist.hidden=true;return}
          hist.hidden=false;hist.replaceChildren(el("span","hint","Lade …"));
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
        delB.onclick=async()=>{
          if(!confirm("Plan „"+p.name+"“ samt Verlauf unwiderruflich löschen?"))return;
          try{
            await req("DELETE","/api/plans/"+p.id);
            if(p.id===S.planId)detach();
            renderPlans();
          }catch(e){alert("Löschen fehlgeschlagen: "+e.message)}
        };
        row.append(info,actions,hist);
        plansList.append(row);
      }
    }

    async function init(){
      if(location.protocol==="file:")return;
      let me;
      try{me=await req("GET","/api/me")}catch(e){return}
      S.enabled=true;
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
        try{await req("POST","/auth/logout")}catch(e){}
        S.enabled=false;
        location.href="/auth/logged-out";
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
})();
