  // Reihe mit der Nachbarreihe im selben Feld tauschen (Geräte, Stromschiene und Startphase wandern mit)
  function swapRows(field,a,b){
    if(a===b||a<0||b<0||a>=state.rows||b>=state.rows)return;
    pushHistory("swap-row");
    for(const d of state.devices){
      if(d.field!==field)continue;
      if(d.row===a)d.row=b;else if(d.row===b)d.row=a;
    }
    const ka=phaseStartKey(field,a),kb=phaseStartKey(field,b);
    for(const map of [state.rowRailModes,state.phaseStarts]){
      if(!map)continue;
      const va=map[ka],vb=map[kb];
      if(vb===undefined)delete map[ka];else map[ka]=vb;
      if(va===undefined)delete map[kb];else map[kb]=va;
    }
    renderAll();
  }
