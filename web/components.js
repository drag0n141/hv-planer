/*
 * HV-Planer – herstellerneutrale Komponentenbibliothek
 *
 * Diese Datei enthält nur Bauteildaten. Die Planungslogik bleibt in app.js.
 * Neue Standardkomponenten können hier ergänzt werden, ohne die Palette in
 * app.js anzufassen.
 *
 * Warum .js statt .json?
 * Der HV-Planer soll weiterhin direkt per Doppelklick (file://) ohne lokalen
 * Webserver funktionieren. Browser blockieren fetch() auf lokale JSON-Dateien
 * je nach Sicherheitsmodell. Der Inhalt ist bewusst JSON-ähnlich gehalten.
 */
window.HV_COMPONENTS = [
  {
    type:"rcd2", category:"Schutzgeräte", label:"RCD 2P", tech:"40A / 30mA", widthTE:2, phase:"none",
    inputs:[
      {id:"L", label:"L", phase:null, bank:"Eingang"},
      {id:"N", label:"N", phase:"N", bank:"Eingang"}
    ],
    outputs:[
      {id:"L", label:"L", phase:null, maxTargets:"unlimited"},
      {id:"N", label:"N", phase:"N", maxTargets:"unlimited"}
    ]
  },
  {
    type:"rcd4", category:"Schutzgeräte", label:"RCD 4P", tech:"40A / 30mA", widthTE:4, phase:"3P", fourPoleWithN:true, allowPhasePermutation:true,
    inputs:[
      {id:"L1", label:"L1", phase:"L1", bank:"Eingang"},
      {id:"L2", label:"L2", phase:"L2", bank:"Eingang"},
      {id:"L3", label:"L3", phase:"L3", bank:"Eingang"},
      {id:"N", label:"N", phase:"N", bank:"Eingang"}
    ],
    outputs:[
      {id:"L1", label:"L1", phase:"L1", maxTargets:"unlimited"},
      {id:"L2", label:"L2", phase:"L2", maxTargets:"unlimited"},
      {id:"L3", label:"L3", phase:"L3", maxTargets:"unlimited"},
      {id:"N", label:"N", phase:"N", maxTargets:"unlimited"}
    ]
  },
  {type:"ls1", category:"Schutzgeräte", label:"LS 1P", tech:"B16A", widthTE:1, phase:"auto", outputs:[{id:"OUT",label:"OUT",phase:null,maxTargets:1}]},
  {
    type:"ls3", category:"Schutzgeräte", label:"LS 3P", tech:"3×B16A", widthTE:3, phase:"3P",
    outputs:[
      {id:"L1", label:"L1", phase:"L1", maxTargets:1},
      {id:"L2", label:"L2", phase:"L2", maxTargets:1},
      {id:"L3", label:"L3", phase:"L3", maxTargets:1}
    ]
  },
  {
    type:"d02_1p", category:"Schutzgeräte", label:"Neozed / D02 1P", tech:"D02 35A", widthTE:1.5, phase:"auto",
    inputs:[
      {id:"IN", label:"IN", phase:null, bank:"Eingang"}
    ],
    outputs:[
      {id:"OUT", label:"OUT", phase:"source", maxTargets:1}
    ]
  },
  {
    type:"d02", category:"Schutzgeräte", label:"Neozed / D02", tech:"D02 35A", widthTE:4.5, phase:"3P",
    inputs:[
      {id:"L1", label:"L1", phase:"L1", bank:"Eingang"},
      {id:"L2", label:"L2", phase:"L2", bank:"Eingang"},
      {id:"L3", label:"L3", phase:"L3", bank:"Eingang"}
    ],
    outputs:[
      {id:"L1", label:"L1", phase:"L1", maxTargets:1},
      {id:"L2", label:"L2", phase:"L2", maxTargets:1},
      {id:"L3", label:"L3", phase:"L3", maxTargets:1}
    ]
  },
  {
    type:"hla1", category:"Verteilung", label:"Klemmstein einzeln", tech:"HLAK 1→3", widthTE:2, phase:"auto",
    outputs:[
      {id:"A1", label:"Abgang 1", phase:"source", maxTargets:1},
      {id:"A2", label:"Abgang 2", phase:"source", maxTargets:1},
      {id:"A3", label:"Abgang 3", phase:"source", maxTargets:1}
    ]
  },
  {
    type:"hla", category:"Verteilung", label:"Klemmstein kombiniert", tech:"HLAK 3×1→5", widthTE:4, phase:"3P",
    inputs:[
      {id:"L1", label:"L1", phase:"L1", bank:"Eingang"},
      {id:"L2", label:"L2", phase:"L2", bank:"Eingang"},
      {id:"L3", label:"L3", phase:"L3", bank:"Eingang"}
    ],
    outputs:[
      {id:"L1.1", label:"L1.1", phase:"L1", maxTargets:1},
      {id:"L1.2", label:"L1.2", phase:"L1", maxTargets:1},
      {id:"L1.3", label:"L1.3", phase:"L1", maxTargets:1},
      {id:"L1.4", label:"L1.4", phase:"L1", maxTargets:1},
      {id:"L1.5", label:"L1.5", phase:"L1", maxTargets:1},
      {id:"L2.1", label:"L2.1", phase:"L2", maxTargets:1},
      {id:"L2.2", label:"L2.2", phase:"L2", maxTargets:1},
      {id:"L2.3", label:"L2.3", phase:"L2", maxTargets:1},
      {id:"L2.4", label:"L2.4", phase:"L2", maxTargets:1},
      {id:"L2.5", label:"L2.5", phase:"L2", maxTargets:1},
      {id:"L3.1", label:"L3.1", phase:"L3", maxTargets:1},
      {id:"L3.2", label:"L3.2", phase:"L3", maxTargets:1},
      {id:"L3.3", label:"L3.3", phase:"L3", maxTargets:1},
      {id:"L3.4", label:"L3.4", phase:"L3", maxTargets:1},
      {id:"L3.5", label:"L3.5", phase:"L3", maxTargets:1}
    ]
  },
  {
    type:"hlak5_1to3", category:"Verteilung", label:"Hauptleitungs-Abzweigklemme 5P", tech:"5P / 1→3 je Leiter / 100 mm", widthMM:100, phase:"3P", passthroughByConductor:true,
    inputs:[
      {id:"L1", label:"L1", phase:"L1", bank:"Eingang"},
      {id:"L2", label:"L2", phase:"L2", bank:"Eingang"},
      {id:"L3", label:"L3", phase:"L3", bank:"Eingang"},
      {id:"N",  label:"N",  phase:"N",  bank:"Eingang"},
      {id:"PE", label:"PE", phase:"PE", bank:"Eingang"}
    ],
    outputs:[
      {id:"L1.1", label:"L1.1", phase:"L1", maxTargets:1},
      {id:"L1.2", label:"L1.2", phase:"L1", maxTargets:1},
      {id:"L1.3", label:"L1.3", phase:"L1", maxTargets:1},
      {id:"L2.1", label:"L2.1", phase:"L2", maxTargets:1},
      {id:"L2.2", label:"L2.2", phase:"L2", maxTargets:1},
      {id:"L2.3", label:"L2.3", phase:"L2", maxTargets:1},
      {id:"L3.1", label:"L3.1", phase:"L3", maxTargets:1},
      {id:"L3.2", label:"L3.2", phase:"L3", maxTargets:1},
      {id:"L3.3", label:"L3.3", phase:"L3", maxTargets:1},
      {id:"N.1",  label:"N.1",  phase:"N",  maxTargets:1},
      {id:"N.2",  label:"N.2",  phase:"N",  maxTargets:1},
      {id:"N.3",  label:"N.3",  phase:"N",  maxTargets:1},
      {id:"PE.1", label:"PE.1", phase:"PE", maxTargets:1},
      {id:"PE.2", label:"PE.2", phase:"PE", maxTargets:1},
      {id:"PE.3", label:"PE.3", phase:"PE", maxTargets:1}
    ]
  },
  {
    type:"hlak5_1to3_compact", category:"Verteilung", label:"Hauptleitungs-Abzweigklemme 5P kompakt", tech:"5P / 1→3 je Leiter / 88,8 mm", widthMM:88.8, phase:"3P", passthroughByConductor:true,
    inputs:[
      {id:"L1", label:"L1", phase:"L1", bank:"Eingang"},
      {id:"L2", label:"L2", phase:"L2", bank:"Eingang"},
      {id:"L3", label:"L3", phase:"L3", bank:"Eingang"},
      {id:"N",  label:"N",  phase:"N",  bank:"Eingang"},
      {id:"PE", label:"PE", phase:"PE", bank:"Eingang"}
    ],
    outputs:[
      {id:"L1.1", label:"L1.1", phase:"L1", maxTargets:1},
      {id:"L1.2", label:"L1.2", phase:"L1", maxTargets:1},
      {id:"L1.3", label:"L1.3", phase:"L1", maxTargets:1},
      {id:"L2.1", label:"L2.1", phase:"L2", maxTargets:1},
      {id:"L2.2", label:"L2.2", phase:"L2", maxTargets:1},
      {id:"L2.3", label:"L2.3", phase:"L2", maxTargets:1},
      {id:"L3.1", label:"L3.1", phase:"L3", maxTargets:1},
      {id:"L3.2", label:"L3.2", phase:"L3", maxTargets:1},
      {id:"L3.3", label:"L3.3", phase:"L3", maxTargets:1},
      {id:"N.1",  label:"N.1",  phase:"N",  maxTargets:1},
      {id:"N.2",  label:"N.2",  phase:"N",  maxTargets:1},
      {id:"N.3",  label:"N.3",  phase:"N",  maxTargets:1},
      {id:"PE.1", label:"PE.1", phase:"PE", maxTargets:1},
      {id:"PE.2", label:"PE.2", phase:"PE", maxTargets:1},
      {id:"PE.3", label:"PE.3", phase:"PE", maxTargets:1}
    ]
  },
  {type:"treppe", category:"Schaltgeräte", label:"Treppenlicht", tech:"TL-Automat", widthTE:1, phase:"auto", outputs:[{id:"OUT",label:"OUT",phase:null,maxTargets:1}]},
  {type:"schuetz", category:"Schaltgeräte", label:"Schütz", tech:"Install.-Schütz", widthTE:2, phase:"auto", outputs:[{id:"OUT",label:"OUT",phase:null,maxTargets:1}]},
  {type:"relais", category:"Schaltgeräte", label:"Relais", tech:"Relais", widthTE:1, phase:"auto", outputs:[{id:"OUT",label:"OUT",phase:null,maxTargets:1}]},
  {
    type:"zeitrelais_1w", category:"Schaltgeräte", label:"Zeitrelais", tech:"Multifunktion / 1 Wechsler", widthTE:1, phase:"auto",
    inputs:[
      {id:"A1", label:"A1", phase:null, bank:"Versorgung"},
      {id:"A2", label:"A2", phase:"N", bank:"Versorgung"},
      {id:"B1", label:"B1", phase:null, bank:"Steuereingang"},
      {id:"15", label:"15", phase:null, bank:"Wechsler"}
    ],
    outputs:[
      {id:"16", label:"16 Öffner", phase:"source", maxTargets:1},
      {id:"18", label:"18 Schließer", phase:"source", maxTargets:1}
    ]
  },
  {type:"netzteil1", category:"Messung & Steuerung", label:"Netzteil 1 TE", tech:"24V DC", widthTE:1, phase:"auto"},
  {type:"netzteil",  category:"Messung & Steuerung", label:"Netzteil 2 TE", tech:"24V DC", widthTE:2, phase:"auto"},
  {type:"netzteil3", category:"Messung & Steuerung", label:"Netzteil 3 TE", tech:"24V DC", widthTE:3, phase:"auto"},
  {type:"netzteil4", category:"Messung & Steuerung", label:"Netzteil 4 TE", tech:"24V DC", widthTE:4, phase:"auto"},
  {
    type:"meter", category:"Messung & Steuerung", label:"Energiezähler", tech:"3~ kWh", widthTE:4, phase:"3P",
    inputs:[
      {id:"L1", label:"L1", phase:"L1", bank:"Eingang"},
      {id:"L2", label:"L2", phase:"L2", bank:"Eingang"},
      {id:"L3", label:"L3", phase:"L3", bank:"Eingang"}
    ],
    outputs:[
      {id:"L1", label:"L1", phase:"L1", maxTargets:1},
      {id:"L2", label:"L2", phase:"L2", maxTargets:1},
      {id:"L3", label:"L3", phase:"L3", maxTargets:1}
    ]
  },
  {type:"shelly", category:"Messung & Steuerung", label:"Shelly / Smart", tech:"Smart-Modul", widthTE:1, phase:"auto", outputs:[{id:"OUT",label:"OUT",phase:null,maxTargets:1}]},
  {
    type:"shelly1g3", category:"Messung & Steuerung", label:"Shelly 1 Gen3", tech:"1 Kanal / potentialfreies Relais", widthMM:42, phase:"auto",
    inputs:[
      {id:"L", label:"L", phase:null, bank:"Versorgung"},
      {id:"N", label:"N", phase:"N", bank:"Versorgung"},
      {id:"SW", label:"SW", phase:null, bank:"Steuereingang"},
      {id:"I", label:"I", phase:null, bank:"Relais"}
    ],
    outputs:[
      {id:"O", label:"O", phase:"source", maxTargets:1}
    ]
  },
  {
    type:"shelly2pmg4", category:"Messung & Steuerung", label:"Shelly 2PM Gen4", tech:"2 Kanal / Rollladen", widthMM:42, phase:"auto", modes:["dual_relay","shutter"],
    inputs:[
      {id:"L", label:"L", phase:null, bank:"Versorgung"},
      {id:"N", label:"N", phase:"N", bank:"Versorgung"},
      {id:"S1", label:"S1", phase:null, bank:"Steuereingang"},
      {id:"S2", label:"S2", phase:null, bank:"Steuereingang"}
    ],
    outputs:[
      {id:"O1", label:"O1", phase:"source", maxTargets:1},
      {id:"O2", label:"O2", phase:"source", maxTargets:1}
    ]
  },
  {
    type:"shelly_pro_3em", category:"Messung & Steuerung", label:"Shelly Pro 3EM", tech:"3P Energiezähler / CT", widthTE:1, phase:"3P", measurement:"ct",
    inputs:[
      {id:"LA", label:"LA", phase:"L1", bank:"Spannungsmessung"},
      {id:"LB", label:"LB", phase:"L2", bank:"Spannungsmessung"},
      {id:"LC", label:"LC", phase:"L3", bank:"Spannungsmessung"},
      {id:"N", label:"N", phase:"N", bank:"Versorgung"}
    ],
    outputs:[]
  },
  {
    type:"shelly_pro_4pm", category:"Messung & Steuerung", label:"Shelly Pro 4PM", tech:"4 Kanal / Leistungsmessung", widthTE:3, phase:"auto", channels:4, powerMetering:true,
    inputs:[
      {id:"L", label:"L", phase:null, bank:"Versorgung"},
      {id:"N", label:"N", phase:"N", bank:"Versorgung"},
      {id:"E1", label:"E1", phase:null, bank:"Steuereingang"},
      {id:"E2", label:"E2", phase:null, bank:"Steuereingang"},
      {id:"E3", label:"E3", phase:null, bank:"Steuereingang"},
      {id:"E4", label:"E4", phase:null, bank:"Steuereingang"}
    ],
    outputs:[
      {id:"O1", label:"Out 1", phase:"source", maxTargets:1},
      {id:"O2", label:"Out 2", phase:"source", maxTargets:1},
      {id:"O3", label:"Out 3", phase:"source", maxTargets:1},
      {id:"O4", label:"Out 4", phase:"source", maxTargets:1}
    ]
  },
  {
    type:"spd", category:"Schutzgeräte", label:"Überspannungsschutz Typ 2", tech:"SPD Typ 2", widthTE:4, phase:"3P", colorRole:"surge", parallelProtection:true,
    inputs:[
      {id:"L1", label:"L1", phase:"L1", bank:"Netz"},
      {id:"L2", label:"L2", phase:"L2", bank:"Netz"},
      {id:"L3", label:"L3", phase:"L3", bank:"Netz"},
      {id:"N",  label:"N",  phase:"N",  bank:"Netz"},
      {id:"PE", label:"PE", phase:"PE", bank:"Ableitung"}
    ],
    outputs:[]
  },
  {
    type:"main", category:"Schaltgeräte", label:"Hauptschalter 4P", tech:"40A 4P", widthTE:4, phase:"3P", fourPoleWithN:true,
    inputs:[
      {id:"L1", label:"L1", phase:"L1", bank:"Eingang"},
      {id:"L2", label:"L2", phase:"L2", bank:"Eingang"},
      {id:"L3", label:"L3", phase:"L3", bank:"Eingang"},
      {id:"N", label:"N", phase:"N", bank:"Eingang"}
    ],
    outputs:[
      {id:"L1", label:"L1", phase:"L1", maxTargets:1},
      {id:"L2", label:"L2", phase:"L2", maxTargets:1},
      {id:"L3", label:"L3", phase:"L3", maxTargets:1},
      {id:"N", label:"N", phase:"N", maxTargets:1}
    ]
  },
  {
    type:"change", category:"Schaltgeräte", label:"I-0-II Umschalter", tech:"4P", widthTE:4, phase:"3P", fourPoleWithN:true,
    inputs:[
      {id:"L1.1", label:"L1.1", phase:"L1", bank:"Netz 1"},
      {id:"L2.1", label:"L2.1", phase:"L2", bank:"Netz 1"},
      {id:"L3.1", label:"L3.1", phase:"L3", bank:"Netz 1"},
      {id:"N1.1", label:"N1.1", phase:"N", bank:"Netz 1"},
      {id:"L1.2", label:"L1.2", phase:"L1", bank:"Netz 2"},
      {id:"L2.2", label:"L2.2", phase:"L2", bank:"Netz 2"},
      {id:"L3.2", label:"L3.2", phase:"L3", bank:"Netz 2"},
      {id:"N2", label:"N2", phase:"N", bank:"Netz 2"}
    ],
    outputs:[
      {id:"L1", label:"L1", phase:"L1", maxTargets:1},
      {id:"L2", label:"L2", phase:"L2", maxTargets:1},
      {id:"L3", label:"L3", phase:"L3", maxTargets:1},
      {id:"N", label:"N", phase:"N", maxTargets:1}
    ]
  },
  {type:"term1", category:"Reihenklemmen", label:"Reihenklemme 1P", tech:"1P", widthMM:5.2, phase:"auto", terminal:true, colorRole:"terminal", outputs:[{id:"OUT",label:"OUT",phase:null,maxTargets:1}]},
  {type:"termN", category:"Reihenklemmen", label:"Reihenklemme N", tech:"N-Klemme", widthMM:5.2, phase:"N", terminal:true, colorRole:"neutral", outputs:[{id:"OUT",label:"OUT",phase:"N",maxTargets:1}]},
  {type:"term2", category:"Reihenklemmen", label:"Reihenklemme 2P", tech:"2P", widthMM:5.2, phase:"auto", terminal:true, colorRole:"terminal", outputs:[{id:"OUT",label:"OUT",phase:null,maxTargets:1}]},
  {type:"term3", category:"Reihenklemmen", label:"Reihenklemme 3P", tech:"L/N/PE", widthMM:5.2, phase:"auto", terminal:true, colorRole:"terminal", outputs:[{id:"OUT",label:"OUT",phase:null,maxTargets:1}]},
  {type:"reserve", category:"Sonstiges", label:"Reserve", tech:"frei", widthTE:1, phase:"none"},
  {type:"custom", category:"Sonstiges", label:"Benutzerdefiniert", tech:"Gerät", widthTE:1, phase:"none"}
];
