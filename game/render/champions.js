import * as THREE from 'three';
import {CHAMPIONS,SIEGE_KINDS} from './champion-catalog.js';

// Original miniature characters. Primitives are injected to avoid a model-module cycle.
export function championModel(family,k) {
  const spec=CHAMPIONS[family];if(!spec)throw new Error(`Unknown champion: ${family}`);
  const {box,beam,sphere,cylinder,cone,mesh,optimize}=k;
  const root=new THREE.Group(),{kind,color,accent}=spec,ink='#263b46',gold='#deb768',skin='#efbd96',wood='#72513b';
  cylinder(root,.45,.48,.11,'#657d79',[0,.065,0],12);
  cylinder(root,.42,.43,.045,accent,[0,.135,0],12);
  const gem=(p,r,c,pos)=>mesh(p,new THREE.OctahedronGeometry(r),c,pos);
  function face(p,y,c=skin){
    sphere(p,.235,c,[0,y,-.045]);
    for(const x of [-.085,.085]){box(p,[.072,.065,.03],'#fff7e1',[x,y+.025,-.254]);box(p,[.035,.048,.025],ink,[x,y+.02,-.274]);}
    box(p,[.085,.023,.026],'#986357',[0,y-.09,-.267]);
  }
  function closedHelm(p,{heraldic=false,black=false}={}){
    const steel=black?'#27303a':'#afc5cd',edge=black?accent:heraldic?gold:'#d6e3e7';
    const shell=mesh(p,new THREE.SphereGeometry(.255,12,8),steel,[0,1.19,.045]);shell.scale.set(.93,1.13,.85);
    const xs=[-.21,-.145,-.035,.035,.145,.21],rows=[[.985,-.175],[1.10,-.304],[1.195,-.275],[1.235,-.27],[1.34,-.205],[1.43,-.08]];
    const positions=[],indices=[];
    for(let row=0;row<rows.length;row++)for(const x of xs){
      const [y,z]=rows[row],taper=[.74,.96,1,1,.94,.59][row];
      positions.push(x*taper,y,z+.068*Math.abs(x)/.21);
    }
    for(let row=0;row<rows.length-1;row++)for(let j=0;j<5;j++){
      if(row===2&&(j===1||j===3))continue;
      const a=row*6+j,b=a+1,c=a+7,d=a+6;indices.push(a,c,b,a,d,c);
    }
    const visor=new THREE.BufferGeometry();visor.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    visor.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(positions.length/3*2),2));
    visor.setIndex(indices);visor.computeVertexNormals();mesh(p,visor,steel);
    box(p,[.36,.065,.015],'#101820',[0,1.215,-.181]);
    beam(p,[0,1.425,-.088],[0,1.246,-.278],.024,edge);beam(p,[0,1.246,-.278],[0,1.09,-.316],.021,edge);
    cylinder(p,.16,.20,.12,steel,[0,.98,.015],12);
    for(const sign of [-1,1]){
      sphere(p,.027,edge,[sign*.235,1.25,-.02]);
      for(let j=0;j<3;j++)box(p,[.013,.028,.008],'#17212a',[sign*(.060+j*.038),1.13,-.285+.022*j]);
      if(black){mesh(p,new THREE.BoxGeometry(.076,.013,.006),accent,[sign*.092,1.217,-.191],[0,0,0],true);cone(p,.033,.15,steel,[sign*.12,1.52,.10],5).rotation.x=.45;}
    }
    if(heraldic){
      for(let j=0;j<4;j++)sphere(p,.07,'#aa3f54',[0,1.50+Math.sin(j*.7)*.025,.08-j*.055]);
      gem(p,.04,gold,[0,1.34,-.215]);
    }
  }
  function plateArmor(p,black=false){
    const steel=black?'#27303a':'#afc5cd',edge=black?accent:gold;
    const breast=sphere(p,.30,steel,[0,.735,-.02]);breast.scale.set(.88,1.05,.59);
    beam(p,[0,.60,-.21],[0,.89,-.20],.020,edge);
    for(const sign of [-1,1]){
      for(let j=0;j<3;j++){
        const pauldron=sphere(p,.151-j*.013,steel,[sign*(.27+j*.016),.865-j*.04,0]);pauldron.scale.y=.39;
        box(p,[.175,.057,.047],steel,[sign*.135,.47+j*.050,-.167]);
      }
      box(p,[.175,.255,.15],steel,[sign*.13,.355,-.025]);sphere(p,.087,steel,[sign*.13,.50,-.10]);
      for(let j=0;j<3;j++)box(p,[.18,.042,.07],steel,[sign*.13,.225,-.12-j*.041]);
      beam(p,[sign*.28,.83,0],[sign*.34,.66,-.09],.118,steel);sphere(p,.09,steel,[sign*.34,.63,-.12]);
    }
  }
  function heraldicShield(p,{lion=false,black=false}={}){
    const shape=new THREE.Shape();shape.moveTo(-.18,.23);shape.lineTo(.18,.23);shape.lineTo(.20,-.02);shape.lineTo(0,-.27);shape.lineTo(-.20,-.02);shape.closePath();
    mesh(p,new THREE.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:false}),black?'#202a34':color,[-.37,.73,-.23]);
    for(const [a,b] of [[[-.55,.96,-.237],[-.19,.96,-.237]],[[-.55,.96,-.237],[-.57,.71,-.237]],[[-.57,.71,-.237],[-.37,.46,-.237]],[[-.37,.46,-.237],[-.17,.71,-.237]],[[-.17,.71,-.237],[-.19,.96,-.237]]])beam(p,a,b,.025,black?accent:gold);
    if(lion){const mane=sphere(p,.097,gold,[-.37,.75,-.257]);mane.scale.z=.3;sphere(p,.039,ink,[-.37,.728,-.287]);}
    else{beam(p,[-.37,.62,-.256],[-.37,.87,-.256],.024,black?accent:gold);beam(p,[-.46,.80,-.256],[-.28,.80,-.256],.018,black?accent:gold);}
  }
  function warhammer(p){
    beam(p,[.4,.44,-.2],[.4,1.27,-.2],.052,wood);
    for(const y of [.57,.63,.69])box(p,[.061,.017,.061],gold,[.4,y,-.2]);
    box(p,[.33,.18,.15],'#afc5cd',[.4,1.27,-.2]);
    for(const sign of [-1,1])box(p,[.035,.22,.19],gold,[.4+sign*.173,1.27,-.2]);
    beam(p,[.4,1.205,-.282],[.4,1.335,-.282],.018,gold);beam(p,[.35,1.28,-.282],[.45,1.28,-.282],.014,gold);
    sphere(p,.045,gold,[.4,.43,-.2]);
  }
  function hero(p,{robe=false,helmet=false,closedHelmet=false,armor=false,hat=false,beard=false}={}){
    for(const x of [-.13,.13]){box(p,[.16,.3,.18],ink,[x,.35,0]);box(p,[.19,.12,.3],ink,[x,.22,-.05]);}
    cylinder(p,.2,robe?.36:.28,.55,color,[0,.63,0],7);
    box(p,[.49,.6,.07],color,[0,.66,.2],[.12,0,0]);
    for(const x of [-.23,.23])box(p,[.04,.57,.04],accent,[x,.65,.26],[.12,0,0]);
    box(p,[.48,.07,.36],gold,[0,.5,0]);sphere(p,.065,accent,[0,.77,-.24]);
    for(const s of [-1,1]){sphere(p,.145,helmet?accent:color,[s*.28,.85,0]);beam(p,[s*.28,.83,0],[s*.34,.64,-.09],.12,color);sphere(p,.09,skin,[s*.34,.63,-.12]);}
    if(!closedHelmet)face(p,1.1);
    if(closedHelmet)closedHelm(p,{heraldic:family==='roseguard',black:family==='highking'});
    else if(helmet){sphere(p,.255,'#8fadb9',[0,1.23,.035]);box(p,[.47,.055,.4],accent,[0,1.16,.015]);for(const x of [-.18,.18])box(p,[.075,.2,.17],'#8fadb9',[x,1.07,0]);}
    else {sphere(p,.25,kind==='priestess'?'#a87a46':'#ece0be',[0,1.21,.08]);}
    if(beard)for(const x of [-.13,0,.13])cone(p,.1,.35,'#e4e5de',[x,.94,-.2],5).rotation.z=Math.PI;
    if(hat){cylinder(p,.33,.33,.055,color,[0,1.29,0],8);cone(p,.26,.55,color,[.03,1.56,.01],7).rotation.z=-.14;box(p,[.43,.07,.38],accent,[0,1.31,0]);gem(p,.085,accent,[.03,1.81,.01]);}
    if(armor)plateArmor(p,family==='highking');
  }
  function staff(p,x=.4,y=1.65){beam(p,[x,.2,0],[x,y,0],.065,wood);gem(p,.17,accent,[x,y+.12,0]);for(const s of [-1,1])beam(p,[x,y-.13,0],[x+s*.18,y+.15,0],.045,gold);}
  function sword(p,x,tilt=0){
    const g=new THREE.Group();box(g,[.09,.22,.09],wood,[0,.12,0]);box(g,[.3,.06,.07],gold,[0,.24,0]);box(g,[.12,.57,.055],'#d5e5e8',[0,.56,0]);cone(g,.087,.18,'#eff7ed',[0,.92,0],4);g.position.set(x,.53,-.2);g.rotation.z=tilt;p.add(g);
  }
  function halo(p,y,r=.32){mesh(p,new THREE.TorusGeometry(r,.027,5,24),gold,[0,y,.04],[Math.PI/2,0,0]);}
  function featherWing(p,sign,y,c1=accent,c2=color,spread=.88){
    for(let j=0;j<5;j++){
      const a=[sign*.17,y,.1],b=[sign*(.47+j*.105)*spread,y+.33-j*.09,.2+j*.045];
      beam(p,a,b,.12,j%2?c1:c2);const f=cone(p,.085,.43,j%2?c1:c2,b,5);f.rotation.z=sign*-.72;f.rotation.x=.5;
    }
  }
  function bow(p){
    const x=-.43;beam(p,[x,.4,-.12],[x-.14,.85,-.21],.07,wood);beam(p,[x-.14,.85,-.21],[x,1.3,-.12],.07,wood);beam(p,[x,.4,-.12],[x,1.3,-.12],.018,'#f1ddb2');beam(p,[x-.18,.84,-.36],[x+.32,.84,-.36],.035,gold);
  }
  function eyes(p,y,z,c=accent){for(const x of [-.105,.105])gem(p,.052,c,[x,y,z]);}
  function beast(p,dragon=false,mounted=true){
    const body=sphere(p,.39,color,[0,.63,.08]);body.scale.set(.9,.85,1.4);
    for(const x of [-.22,.22])for(const z of [-.28,.35]){beam(p,[x,.63,z],[x,.24,z-.06],.115,accent);box(p,[.19,.09,.25],ink,[x,.2,z-.1]);}
    const head=sphere(p,.29,accent,[0,.92,-.44]);head.scale.set(.95,1,1.2);
    if(dragon){cone(p,.11,.3,gold,[-.18,1.16,-.37],5);cone(p,.11,.3,gold,[.18,1.16,-.37],5);box(p,[.31,.15,.23],color,[0,.87,-.72]);}
    else {const beak=cone(p,.14,.3,gold,[0,.86,-.74],4);beak.rotation.x=-Math.PI/2;}
    eyes(p,.99,-.705,ink);beam(p,[0,.7,.38],[.18,.96,.74],.09,color);
    featherWing(p,-1,.82);featherWing(p,1,.82);
    if(mounted){const rider=new THREE.Group();hero(rider,{helmet:true});rider.scale.setScalar(.58);rider.position.set(0,.8,.06);p.add(rider);staff(rider,.4,1.6);}
  }
  function wheels(p){
    box(p,[.67,.16,.92],wood,[0,.44,0]);
    for(const x of [-.39,.39])for(const z of [-.31,.32]){
      const w=cylinder(p,.21,.21,.12,ink,[x,.31,z],10);w.rotation.z=Math.PI/2;
      const hub=cylinder(p,.085,.085,.13,gold,[x,.31,z],8);hub.rotation.z=Math.PI/2;
      for(const sign of [-1,1])beam(p,[x*1.17,.2,z+sign*.12],[x*1.17,.42,z-sign*.12],.035,wood);
    }
  }
  if(family==='mothernature'){
    const jade='#91cbb0',leaf='#428b69',light='#dfecaf';
    const body=mesh(root,new THREE.SphereGeometry(.29,12,8),jade,[0,.96,0]);body.scale.set(.60,.88,.49);
    cylinder(root,.115,.15,.22,jade,[0,.77,0],10);
    const tail=cylinder(root,.119,.060,.31,jade,[.027,.53,.01],10);tail.rotation.z=-.19;
    const tip=cone(root,.060,.19,jade,[.082,.32,.01],10);tip.rotation.z=Math.PI+.27;
    beam(root,[0,1.13,0],[0,1.24,0],.077,jade);
    const head=mesh(root,new THREE.SphereGeometry(.18,12,8),jade,[0,1.36,-.016]);head.scale.set(.85,1.1,.80);
    for(const sign of [-1,1]){
      beam(root,[sign*.14,1.05,0],[sign*.25,1.00,-.02],.075,jade);
      beam(root,[sign*.25,1.00,-.02],[sign*.36,1.18,-.09],.058,jade);sphere(root,.047,jade,[sign*.36,1.18,-.09]);
      mesh(root,new THREE.OctahedronGeometry(.025),light,[sign*.061,1.40,-.165],[0,0,0],true);
      beam(root,[sign*.09,1.47,.04],[sign*.19,1.64,.055],.037,leaf);beam(root,[sign*.19,1.64,.055],[sign*.30,1.70,.08],.025,leaf);
      beam(root,[sign*.19,1.63,.06],[sign*.17,1.76,.08],.022,leaf);
      for(let j=0;j<3;j++){
        const crown=gem(root,.070,accent,[sign*(.14+j*.055),1.65+j*.031,.034]);crown.scale.set(.64,1.16,.3);crown.rotation.z=sign*-.58;
        const hair=cone(root,.065,.37+j*.09,leaf,[sign*(.06+j*.039),1.34-j*.03,.13],5);hair.rotation.z=Math.PI+sign*.13;
        const collar=gem(root,.093,leaf,[sign*(.065+j*.042),1.078,-.12]);collar.scale.set(.7,1,.3);
      }
      mesh(root,new THREE.OctahedronGeometry(.043),light,[sign*.36,1.29,-.09],[0,0,0],true);
      const drift=gem(root,.061,accent,[sign*.43,.86,-.11]);drift.scale.set(.55,1,.3);drift.rotation.z=sign*.57;
    }
    // Wisps orbit the hovering tail; they replace the recruit's legs and boots.
    for(let j=0;j<7;j++){
      const a=j*.54;
      const wisp=gem(root,.075*(1-j*.08),jade,[Math.cos(a)*(.17+j*.008),.79-j*.068,Math.sin(a)*.18]);
      wisp.scale.set(.55,1.3,.32);wisp.rotation.z=.45;
    }
    box(root,[.041,.012,.006],'#496f5b',[0,1.285,-.169]);
  }else if(['firebaby','firemother','thunderbird'].includes(kind)){
    beast(root,kind!=='thunderbird',false);
    for(let i=0;i<3;i++)gem(root,.075,accent,[(i-1)*.14,1.34,.08]);
    if(kind==='firemother'){cone(root,.14,.45,accent,[0,1.56,.18],5);sphere(root,.12,'#ffcb66',[0,.88,-.87]);}
    if(kind==='thunderbird')for(const s of [-1,1]){beam(root,[s*.2,1.25,0],[s*.35,1.5,0],.045,accent);beam(root,[s*.35,1.5,0],[s*.25,1.66,0],.04,accent);}
  }else if(kind==='bear'){
    const body=sphere(root,.42,color,[0,.75,.08]);body.scale.set(1,1.15,1.25);
    for(const x of [-.26,.26])for(const z of [-.25,.3])beam(root,[x,.7,z],[x,.24,z-.06],.18,color);
    sphere(root,.32,color,[0,1.14,-.38]);sphere(root,.19,accent,[0,1.04,-.61]);sphere(root,.06,ink,[0,1.1,-.78]);eyes(root,1.23,-.66,ink);
    for(const x of [-.24,.24])sphere(root,.105,color,[x,1.39,-.33]);
    for(const x of [-.14,0,.14])cone(root,.07,.24,gold,[x,1.61,-.4],5);
  }else if(kind==='griffin'||kind==='dragon'||kind==='phoenix'){
    beast(root,kind==='dragon');
    if(kind==='phoenix')for(let i=0;i<5;i++){const f=cone(root,.1,.6,i%2?accent:color,[(i-2)*.1,.53,.61+i%2*.05],5);f.rotation.x=.85;}
    if(kind==='dragon')for(let i=0;i<4;i++)gem(root,.075,accent,[(i-1.5)*.21,1.94,.2]);
  }else if(kind==='wolf'){
    const b=sphere(root,.35,'#9dbece',[0,.64,.06]);b.scale.set(.9,.85,1.5);
    for(const x of [-.23,.23])for(const z of [-.29,.33])beam(root,[x,.6,z],[x,.22,z-.07],.13,'#c7dde0');
    sphere(root,.29,'#c7dde0',[0,.98,-.42]);box(root,[.26,.15,.27],'#dfebe5',[0,.88,-.63]);sphere(root,.075,ink,[0,.93,-.8]);eyes(root,1.04,-.66);
    for(const x of [-.19,.19])cone(root,.12,.28,color,[x,1.24,-.39],4);
    beam(root,[0,.7,.45],[.19,1.04,.7],.13,'#c7dde0');
    const rider=new THREE.Group();hero(rider,{helmet:true});sword(rider,.36);rider.scale.setScalar(.66);rider.position.y=.77;root.add(rider);
  }else if(SIEGE_KINDS.includes(kind)){
    wheels(root);
    if(kind==='catapult'){
      for(const x of [-.24,.24]){beam(root,[x,.5,.37],[x,1.13,.04],.11,wood);beam(root,[x,.5,-.4],[x,1.13,.04],.11,wood);}
      beam(root,[-.35,1.04,0],[.35,1.04,0],.13,ink);beam(root,[0,.62,-.49],[0,1.45,.36],.12,gold);
      cylinder(root,.24,.15,.17,ink,[0,1.45,.36],8);sphere(root,.18,'#f7a84c',[0,1.6,.36]);cone(root,.14,.32,'#ffd986',[0,1.77,.36],5);
      for(let i=0;i<3;i++)sphere(root,.085,'#eeaf64',[-.2+i*.2,.57,-.3]);
    }else if(kind==='cannon'){
      const barrel=cylinder(root,.24,.29,.83,'#c39354',[0,.86,-.19],10);barrel.rotation.x=Math.PI/2+.16;
      const rim=cylinder(root,.28,.28,.1,gold,[0,.92,-.64],10);rim.rotation.x=Math.PI/2+.16;
      const hole=cylinder(root,.19,.19,.12,ink,[0,.93,-.7],10);hole.rotation.x=Math.PI/2+.16;
      sphere(root,.115,'#ffb867',[0,.94,-.76]);for(const x of [-.21,.21]){cone(root,.09,.22,gold,[x,1.12,-.47],4);gem(root,.048,'#ffe89b',[x,.99,-.6]);}
      box(root,[.37,.32,.35],ink,[0,.72,.22]);cone(root,.1,.25,accent,[0,1,.25],5);
    }else{
      cylinder(root,.15,.2,.42,ink,[0,.72,0]);box(root,[.15,.15,1.18],wood,[0,1,-.12]);
      for(const s of [-1,1]){beam(root,[0,1,-.55],[s*.58,1,-.32],.09,gold);beam(root,[s*.58,1,-.32],[0,1,.31],.024,'#eadabd');}
      beam(root,[0,1.12,.37],[0,1.12,-.76],.045,'#dce4e1');gem(root,.1,accent,[0,1.12,-.78]);
      for(const x of [-.22,.22])gem(root,.07,'#b3dbe1',[x,.55,-.42]);
    }
  }else if(['titan','colossus','treant'].includes(kind)){
    const bark=kind==='treant',core=bark?'#806342':color;
    for(const s of [-1,1]){
      beam(root,[s*.22,.23,0],[s*.23,.83,.05],.23,core);box(root,[.3,.17,.4],core,[s*.23,.22,-.06]);
      sphere(root,.28,core,[s*.39,1.25,0]);beam(root,[s*.43,1.24,0],[s*.52,.72,-.08],.23,core);sphere(root,.21,accent,[s*.52,.71,-.09]);
    }
    const body=sphere(root,.5,core,[0,1.05,0]);body.scale.set(.9,1,.7);gem(root,.19,accent,[0,1.12,-.33]);
    sphere(root,.3,core,[0,1.63,0]);eyes(root,1.66,-.28);
    if(bark){
      for(const s of [-1,1]){beam(root,[s*.22,1.67,.06],[s*.45,2,.09],.1,wood);sphere(root,.31,color,[s*.35,1.99,.08]);sphere(root,.22,accent,[s*.51,1.94,.1]);}
      for(const x of [-.15,0,.15])cone(root,.08,.3,'#afc28a',[x,1.47,-.22],5).rotation.z=Math.PI;
      sphere(root,.08,'#f2c57c',[-.48,1.17,-.15]);
    }else{for(const x of [-.22,0,.22])gem(root,.17,accent,[x,1.91,.02]);if(kind==='titan')halo(root,2.08,.36);}
  }else{
    const robe=!['duelist','paladin','huntress','ranger'].includes(kind);
    const revisedKnight=['frostblade','roseguard','highking'].includes(family);
    hero(root,{robe,helmet:kind==='paladin',closedHelmet:revisedKnight,armor:revisedKnight||family==='kingdomprotector',hat:['conjurer','archmage'].includes(kind),beard:kind==='archmage'});
    if(kind==='duelist'){sword(root,-.36,-.28);sword(root,.36,.28);const feather=cone(root,.095,.42,accent,[-.2,1.53,.02],5);feather.rotation.z=-.7;cylinder(root,.33,.33,.05,color,[0,1.28,0],8);}
    if(kind==='paladin'){
      if(family==='kingdomprotector')warhammer(root);
      else if(family==='highking'){
        box(root,[.075,.18,.065],wood,[.40,.71,-.20]);sphere(root,.048,accent,[.40,.815,-.20]);
        box(root,[.28,.045,.070],accent,[.40,.62,-.20]);box(root,[.125,.32,.047],'#384653',[.40,.44,-.20]);
        const point=cone(root,.086,.12,'#384653',[.40,.22,-.20],4);point.rotation.z=Math.PI;
        for(const y of [.36,.44,.52])mesh(root,new THREE.BoxGeometry(.022,.035,.008),accent,[.40,y,-.228],[0,0,0],true);
        for(const sign of [-1,1]){const spike=cone(root,.061,.22,'#27303a',[sign*.38,1.00,.025],5);spike.rotation.z=sign*-.55;}
      }else sword(root,.4);
      if(revisedKnight)heraldicShield(root,{lion:family==='roseguard',black:family==='highking'});
      else{sphere(root,.2,gold,[-.37,.75,-.1]);gem(root,.08,color,[-.37,.75,-.28]);}
      if(!revisedKnight)for(const x of [-.17,0,.17])cone(root,.07,.21,gold,[x,1.48,0],4);
    }
    if(kind==='huntress'||kind==='ranger'){
      bow(root);cone(root,.27,.32,color,[0,1.41,.045],6);for(const x of [-.24,.24]){const ear=cone(root,.075,.23,skin,[x,1.12,-.01],4);ear.rotation.z=x>0?-.8:.8;}
      if(kind==='huntress'){sphere(root,.16,'#dad9c0',[.35,1.06,0]);for(const x of [.29,.41]){sphere(root,.06,'#f1d98d',[x,1.09,-.125]);sphere(root,.025,ink,[x,1.09,-.17]);}cone(root,.045,.1,gold,[.35,1.02,-.15],4).rotation.x=-1;}
      else for(const s of [-1,1])beam(root,[s*.24,.55,.25],[s*.5,.2,.32],.1,accent);
    }
    if(['grovekeeper','priestess','archmage','seraph','archbishop'].includes(kind))staff(root);
    if(kind==='firebomber'){sphere(root,.16,ink,[-.37,.76,-.25]);beam(root,[-.37,.89,-.25],[-.33,1.03,-.25],.04,gold);sphere(root,.05,'#ffb350',[-.33,1.05,-.25]);for(const x of [-.1,0,.1])cone(root,.08,.28,accent,[x,.94,-.2],5).rotation.z=Math.PI;}
    if(kind==='monk'){halo(root,1.55,.25);for(let i=0;i<5;i++)sphere(root,.045,gold,[(i-2)*.085,.86,-.25]);}
    if(kind==='archbishop'){cone(root,.23,.58,accent,[0,1.58,0],4);beam(root,[-.08,1.66,-.14],[.08,1.66,-.14],.045,gold);beam(root,[0,1.55,-.14],[0,1.82,-.14],.045,gold);}
    if(kind==='grovekeeper'){
      for(const s of [-1,1]){beam(root,[s*.17,1.27,0],[s*.34,1.69,.03],.06,wood);beam(root,[s*.29,1.54,.03],[s*.48,1.61,.03],.05,wood);beam(root,[s*.34,1.69,.03],[s*.27,1.83,.03],.045,wood);}
      cylinder(root,.075,.095,.19,'#e8d7ad',[-.35,.24,-.2],6);const cap=sphere(root,.16,'#be6955',[-.35,.38,-.2]);cap.scale.y=.5;
    }
    if(kind==='priestess'||kind==='seraph'){halo(root,1.64);gem(root,.13,accent,[-.35,.84,-.24]);}
    if(kind==='seraph'){featherWing(root,-1,1.15,'#f9efd0','#b6dce1',.95);featherWing(root,1,1.15,'#f9efd0','#b6dce1',.95);}
    if(kind==='archmage'){halo(root,1.88,.43);for(let i=0;i<3;i++)gem(root,.075,accent,[-.42+i*.35,1.9,.18]);}
    if(kind==='starweaver'){
      halo(root,1.56,.26);box(root,[.5,.08,.29],'#d4b274',[0,.84,-.43],[-.25,0,0]);box(root,[.45,.05,.27],'#eee2cb',[0,.89,-.44],[-.25,0,0]);
      for(let i=0;i<4;i++){const a=i/4*Math.PI*2;gem(root,.085,accent,[Math.cos(a)*.46,1.49+Math.sin(a)*.18,Math.sin(a)*.3]);}
    }
    if(kind==='conjurer')for(const s of [-1,1]){sphere(root,.14,'#a8c8d1',[s*.39,.85,-.19]);beam(root,[s*.39,.87,-.25],[s*.34,1.13,-.25],.05,accent);beam(root,[s*.34,1.13,-.25],[s*.45,1.29,-.25],.05,accent);}
  }
  const result=optimize(root);result.userData.unitKind=SIEGE_KINDS.includes(kind)?'siege':'champion';return result;
}
