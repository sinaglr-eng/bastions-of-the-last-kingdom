import * as THREE from 'three';
import {seededRandom} from '../core/math.js';
import {box,beam,cone,sphere,cylinder,rockModel,optimize} from './models.js';
import {createValleyRelief,valleyGroundHeight,RIVER_CONTROL_POINTS} from './valley-relief.js';
import {LANDMARK_SITES} from './scenery-landmarks.js';

// UVs follow the river's bends, keeping the current parallel to the banks.
function flowingWater(time,fall=false){
  return new THREE.ShaderMaterial({
    uniforms:{time,fall:{value:fall?1:0},deep:{value:new THREE.Color(fall?'#53b4c4':'#247e91')},shallow:{value:new THREE.Color('#91d9ce')}},
    side:THREE.DoubleSide,transparent:fall,depthWrite:!fall,
    vertexShader:`
      uniform float time;uniform float fall;
      varying vec2 currentUv;varying vec3 worldPosition;varying vec3 worldNormal;
      void main(){
        currentUv=uv;vec3 p=position;
        if(fall<.5)p.y+=sin(uv.y*7.0-time*2.4+uv.x*4.0)*.016;
        else p.z+=sin(uv.x*38.0+uv.y*7.0-time*4.0)*.018;
        worldPosition=(modelMatrix*vec4(p,1.0)).xyz;
        worldNormal=normalize(mat3(modelMatrix)*normal);
        gl_Position=projectionMatrix*viewMatrix*vec4(worldPosition,1.0);
      }`,
    fragmentShader:`
      uniform float time;uniform float fall;uniform vec3 deep;uniform vec3 shallow;
      varying vec2 currentUv;varying vec3 worldPosition;varying vec3 worldNormal;
      void main(){
        float along=currentUv.y-time*(fall>.5?1.7:.22);
        float bends=sin(along*2.1+sin(currentUv.x*9.0+along*.7)*.6);
        float narrow=sin(currentUv.x*27.0+sin(along*1.9)*1.6+sin(along*5.3)*.4);
        float crest=smoothstep(.92,1.0,narrow)*smoothstep(.5,1.0,sin(along*4.0+currentUv.x*13.0));
        float edge=pow(abs(currentUv.x*2.0-1.0),7.0);
        float threads=fall>.5?smoothstep(.6,1.0,narrow)*.34:edge*.24;
        vec3 n=normalize(worldNormal+vec3(sin(along*8.0)*.06,0.0,cos(currentUv.x*24.0+along*8.0)*.06));
        vec3 view=normalize(cameraPosition-worldPosition);
        float reflection=pow(1.0-abs(dot(n,view)),3.0)*.3;
        float glint=pow(max(dot(reflect(-normalize(vec3(-.45,1.0,.32)),n),view),0.0),55.0)*.55;
        vec3 color=mix(deep,shallow,.22+bends*.07+threads+reflection);
        color=mix(color,vec3(.83,.97,.91),clamp(crest*.21+threads*.4+glint,0.0,.8));
        gl_FragColor=vec4(color,fall>.5?.86:1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
}

function cloudTexture(){
  const width=128,height=64,pixels=new Uint8Array(width*height*4);
  const lobes=[[-.57,.05,.33],[-.25,.2,.46],[.13,.18,.52],[.5,.03,.34],[.02,-.18,.45]];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const px=(x/(width-1)-.5)*2,py=(y/(height-1)-.5)*2;let density=0;
    for(const [cx,cy,r]of lobes)density+=Math.exp(-((px-cx)**2+(py-cy)**2)/(r*r)*4.5);
    const a=Math.min(1,Math.max(0,(density-.045)*1.25)),i=(y*width+x)*4;
    pixels[i]=240;pixels[i+1]=247;pixels[i+2]=236;pixels[i+3]=Math.round(a*255);
  }
  const texture=new THREE.DataTexture(pixels,width,height);texture.needsUpdate=true;texture.colorSpace=THREE.SRGBColorSpace;
  texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;return texture;
}

// Ground scenery stays outside the 37 × 37 construction field.
export function valleyEnvironment(){
  const land=new THREE.Group(),water=new THREE.Group(),clouds=new THREE.Group(),rng=seededRandom(1907),bounds=[];
  const half=18.5,timeUniform={value:0};
  function place(object,x,z,scale=1,angle=0){
    object.position.set(x,valleyGroundHeight(x,z),z);object.scale.multiplyScalar(scale);object.rotation.y=angle;
    const b=new THREE.Box3().setFromObject(object);
    if(b.min.x<half&&b.max.x>-half&&b.min.z<half&&b.max.z>-half)return false;
    bounds.push({min:b.min.toArray(),max:b.max.toArray()});land.add(object);return true;
  }
  function peak(radius,height){
    const g=new THREE.Group(),n=12,vertices=[],colors=[],rings=[];
    const shades=['#637f7f','#7f9790','#547178','#9daf9c','#6c8280','#8aa39a'];
    const offsets=Array.from({length:n},()=>.77+rng()*.32),top=new THREE.Vector3(radius*.17,height,-radius*.14);
    for(const [r,y]of [[1,-.12],[.73,.23],[.40,.56],[.16,.82]])rings.push(Array.from({length:n},(_,i)=>{
      const a=i/n*Math.PI*2,shoulder=r*(.87+rng()*.24)*offsets[i];
      return new THREE.Vector3(Math.cos(a)*radius*shoulder+top.x*y,height*y+(y?rng()*height*.045:0),Math.sin(a)*radius*shoulder+top.z*y);
    }));
    function triangle(a,b,c,color){vertices.push(...a.toArray(),...b.toArray(),...c.toArray());const col=new THREE.Color(color);for(let k=0;k<3;k++)colors.push(col.r,col.g,col.b);}
    for(let row=0;row<rings.length-1;row++)for(let i=0;i<n;i++){
      const j=(i+1)%n,col=row===2?(i%3?'#c2d7cd':'#eff0db'):shades[(i+row)%shades.length];
      triangle(rings[row][i],rings[row+1][i],rings[row][j],col);triangle(rings[row][j],rings[row+1][i],rings[row+1][j],col);
    }
    for(let i=0;i<n;i++)triangle(rings[3][i],top,rings[3][(i+1)%n],i%3?'#e0e7d8':'#f9f5e5');
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
    const m=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true}));m.castShadow=true;m.receiveShadow=true;g.add(m);return g;
  }
  land.add(createValleyRelief());
  // Irregular ridges in three depth bands form a landscape, rather than a wall
  // of evenly spaced peaks. The lower foreground ridge preserves the map view.
  for(let layer=0;layer<3;layer++)for(let i=0;i<14;i++){
    const angle=(i+(rng()-.5)*.7)/14*Math.PI*2,distance=43+layer*14+rng()*7;
    const x=Math.cos(angle)*distance,z=Math.sin(angle)*distance;
    const height=(z>19?3.8:7.5)+layer*1.7+rng()*4.5;
    const mountain=peak(4.3+layer*.5+rng()*2.7,height);mountain.scale.x=.90+rng()*.65;mountain.scale.z=.85+rng()*.53;
    place(mountain,x,z,1,rng()*Math.PI);
  }

  const curve=new THREE.CatmullRomCurve3(RIVER_CONTROL_POINTS.map(([x,z])=>new THREE.Vector3(x,0,z)));
  const points=curve.getPoints(240),riverMaterial=flowingWater(timeUniform),fallMaterial=flowingWater(timeUniform,true);
  function ribbon(width,y,material){
    const positions=[],uvs=[],lengths=[0];
    for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+points[i].distanceTo(points[i-1]));
    const edges=points.map((p,i)=>{const d=points[Math.min(i+1,points.length-1)].clone().sub(points[Math.max(0,i-1)]).normalize();const n=new THREE.Vector3(-d.z,0,d.x).multiplyScalar(width/2);return [p.clone().add(n).setY(y),p.clone().sub(n).setY(y)];});
    for(let i=0;i<edges.length-1;i++){
      const [a,b]=edges[i],[c,d]=edges[i+1],v=lengths[i]/3,w=lengths[i+1]/3;
      for(const [p,u,t]of [[a,0,v],[c,0,w],[b,1,v],[b,1,v],[c,0,w],[d,1,w]]){positions.push(...p.toArray());uvs.push(u,t);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();
    const object=new THREE.Mesh(geometry,material);object.receiveShadow=true;water.add(object);return object;
  }
  ribbon(5.5,-.095,new THREE.MeshStandardMaterial({color:'#a3b18d',roughness:.95}));
  ribbon(4.7,-.06,new THREE.MeshStandardMaterial({color:'#659d91',roughness:.42}));ribbon(4.1,-.025,riverMaterial);
  const flowGeometry=new THREE.BufferGeometry(),flowPositions=new Float32Array(84*2*3),streaks=[];
  for(let i=0;i<84;i++)streaks.push({phase:rng(),side:(rng()-.5)*3.4,length:.12+rng()*.3,speed:.009+rng()*.004});
  flowGeometry.setAttribute('position',new THREE.BufferAttribute(flowPositions,3));
  const currents=new THREE.LineSegments(flowGeometry,new THREE.LineBasicMaterial({color:'#d6f2dd',transparent:true,opacity:.48,depthWrite:false}));currents.frustumCulled=false;water.add(currents);

  // A rounded lip, moving sheets, foam and spray make one continuous cascade.
  for(const [x,z,s]of [[21.2,-24,2.8],[27.1,-24.8,3.8],[24,-27,3]])place(rockModel(),x,z,s);
  const falls=new THREE.Group();
  for(let i=0;i<5;i++){const rock=rockModel();rock.position.set(22.9+i*.48,1.6,-22.3-(i%2)*.23);rock.scale.set(.74,3.4,.9);falls.add(rock);}
  const positions=[],uvs=[];
  function sheetPoint(u,v){const drop=Math.max(0,(v-.12)/.88);return new THREE.Vector3(22.72+u*2.06,3.62-drop*3.51,-22.2+Math.min(v/.12,1)*1.12+drop*.1);}
  for(let row=0;row<28;row++)for(let col=0;col<14;col++){
    const u=col/14,v=row/28,nu=(col+1)/14,nv=(row+1)/28;
    for(const [x,y]of [[u,v],[nu,v],[u,nv],[u,nv],[nu,v],[nu,nv]]){positions.push(...sheetPoint(x,y).toArray());uvs.push(x,y*2.4);}
  }
  const sheetGeometry=new THREE.BufferGeometry();sheetGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));sheetGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));sheetGeometry.computeVertexNormals();
  const sheet=new THREE.Mesh(sheetGeometry,fallMaterial);water.add(sheet);
  for(let i=0;i<26;i++){const s=sphere(falls,.10+rng()*.16,i%3?'#b9e0d4':'#edf2df',[22.63+rng()*2.33,.065+rng()*.06,-20.93+rng()*.72]);s.scale.y=.28;}
  water.add(optimize(falls));
  const splashRings=[];
  for(let i=0;i<3;i++){
    const ring=new THREE.Mesh(new THREE.RingGeometry(.25,.28,32),new THREE.MeshBasicMaterial({color:'#daefe0',transparent:true,opacity:.5,depthWrite:false,side:THREE.DoubleSide}));
    ring.geometry.rotateX(-Math.PI/2);ring.geometry.translate(23.7,.02,-20.4);water.add(ring);splashRings.push(ring);
  }
  const sparkGeometry=new THREE.BufferGeometry(),drops=[];
  for(let i=0;i<64;i++)drops.push(22.72+rng()*2.08,rng()*3.6,-20.95+rng()*.4);
  sparkGeometry.setAttribute('position',new THREE.Float32BufferAttribute(drops,3));
  const spray=new THREE.Points(sparkGeometry,new THREE.PointsMaterial({color:'#ecfff2',size:.075,transparent:true,opacity:.75,depthWrite:false}));water.add(spray);

  const leafMaterials=['#2f6251','#39745b','#4b8462','#6a9268','#98ad76'].map(color=>new THREE.MeshStandardMaterial({color,roughness:.96}));
  const leafGeometry={broad:new THREE.IcosahedronGeometry(.61,1),crown:new THREE.IcosahedronGeometry(.85,1),pine:Array.from({length:4},(_,i)=>new THREE.ConeGeometry(.8-i*.145,1.42-i*.09,12)),twig:Array.from({length:4},(_,i)=>new THREE.ConeGeometry((.8-i*.145)*.4,.66,8))};
  function foliage(parent,geometry,materialIndex,position,scale=[1,1,1]){
    const m=new THREE.Mesh(geometry,leafMaterials[materialIndex%leafMaterials.length]);m.position.set(...position);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  function tree(broadleaf){
    const g=new THREE.Group(),h=2.8+rng()*.5;cylinder(g,.065,.13,h*.86,'#6c503c',[0,h*.4,0],10);
    for(let i=0;i<5;i++){
      const a=i*2.399,level=.95+i*.23,reach=.48+rng()*.24,tip=[Math.cos(a)*reach,level+.26,Math.sin(a)*reach];beam(g,[0,level,0],tip,.05,'#6f5940');
      if(broadleaf)foliage(g,leafGeometry.broad,3+i%2,[tip[0],tip[1]+.28,tip[2]],[1,.85,1]);
    }
    if(broadleaf){
      foliage(g,leafGeometry.crown,3,[0,h-.35,0],[.95,1,1]);cylinder(g,.105,.13,h*.5,'#c2bea0',[0,h*.25,0],10);
      for(let i=0;i<5;i++)box(g,[.13,.06,.013],'#695c43',[Math.sin(i*2)*.02,.2+i*.22,.13]);
    }else{
      for(let i=0;i<4;i++){
        const radius=.8-i*.145,branch=foliage(g,leafGeometry.pine[i],i,[Math.sin(i*2)*.08,1.15+i*.49,Math.cos(i*3)*.045]);branch.rotation.y=i*.8;branch.rotation.z=(rng()-.5)*.07;
        for(let j=0;j<3;j++){const a=j*2.094+i*.7;foliage(g,leafGeometry.twig[i],i,[Math.cos(a)*radius*.63,.99+i*.49,Math.sin(a)*radius*.63],[1,.8,1]);}
      }
    }
    for(let i=0;i<3;i++){const a=i*2.094;beam(g,[0,.15,0],[Math.cos(a)*.3,.01,Math.sin(a)*.3],.075,'#6b5540');}return g;
  }
  function landmarkClearing(x,z){
    return Object.entries(LANDMARK_SITES).some(([key,site])=>Math.hypot(x-site.x,z-site.z)<(key==='camp'?6.3:6.5));
  }
  for(let i=0;i<205;i++){
    const side=i%4;let x,z;
    if(side===0){x=-25+rng()*48;z=-21.8-rng()*5;}if(side===1){x=-22.5-rng()*6;z=-21+rng()*46;}
    if(side===2){x=27.5+rng()*7;z=-20+rng()*46;}if(side===3){x=-25+rng()*46;z=31+rng()*7;}
    if(landmarkClearing(x,z)||Math.hypot(x-24,z+24)<4)continue;
    place(tree(i%5===0),x,z,.72+rng()*.67,rng()*6.28);
  }
  // Broad forest masses repeat shared foliage geometry at the outer shoulders.
  // Small distant conifers use three crowns, keeping geometry and draw calls low.
  const distantCone=new THREE.ConeGeometry(.75,1.55,7);
  for(let cluster=0;cluster<12;cluster++){
    const angle=cluster/12*Math.PI*2+.12*Math.sin(cluster*2.8),distance=35+(cluster%3)*7;
    const cx=Math.cos(angle)*distance,cz=Math.sin(angle)*distance;
    for(let i=0;i<13;i++){
      const x=cx+(rng()-.5)*10,z=cz+(rng()-.5)*10;
      if(landmarkClearing(x,z))continue;
      const sapling=new THREE.Group();cylinder(sapling,.07,.12,2.1,'#6c503c',[0,.86,0],7);
      for(let crown=0;crown<3;crown++)foliage(sapling,distantCone,(cluster+crown)%3,[0,1.04+crown*.56,0],[1-crown*.22,1,1-crown*.22]);
      place(sapling,x,z,.75+rng()*.65,rng()*Math.PI*2);
    }
  }
  for(let i=0;i<70;i++){
    const side=i%3,x=side===0?-21-rng()*4:side===1?28+rng()*5:-23+rng()*44,z=side===2?-21-rng()*4:-21+rng()*47;
    if(landmarkClearing(x,z))continue;place(rockModel(),x,z,.3+rng()*.65,rng()*6);
  }
  for(let i=0;i<35;i++){
    const flowers=new THREE.Group(),x=-20.5-rng()*4,z=-8+rng()*31;
    for(let j=0;j<4;j++){const dx=rng()*.6,dz=rng()*.6;beam(flowers,[dx,0,dz],[dx,.18,dz],.035,'#608364');sphere(flowers,.07,j%2?'#e8bc70':'#e0a7a1',[dx,.2,dz]);}place(flowers,x,z);
  }
  const bridge=new THREE.Group();
  for(let i=0;i<28;i++)box(bridge,[.22,.12,1.3],i%2?'#b79965':'#cbb27a',[18.62+i*.24,.14,14]);
  for(const z of [13.37,14.63]){
    beam(bridge,[18.65,.65,z],[25.1,.65,z],.07,'#84603d');for(let x=18.7;x<25.2;x+=1.25){cylinder(bridge,.065,.08,.8,'#705139',[x,.32,z],6);cone(bridge,.1,.14,'#c9b780',[x,.79,z],4);}
  }
  land.add(bridge);
  const cloudMap=cloudTexture(),cloudItems=[];
  for(let i=0;i<7;i++){
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudMap,color:i%2?'#d5dfd5':'#ffffff',transparent:true,opacity:0,depthWrite:false,fog:true}));
    sprite.scale.set(10+rng()*7,4+rng()*2,1);clouds.add(sprite);cloudItems.push({sprite,x:-45+rng()*90,y:14+rng()*9,z:-31+rng()*65,speed:.11+rng()*.06,phase:rng()*Math.PI*2});
  }
  clouds.visible=false;
  const staticGroup=optimize(land);
  const valley={staticGroup,water,clouds,bounds,update(dt,time,zoomDistance=0){
    timeUniform.value=time;
    const a=sparkGeometry.attributes.position;for(let i=0;i<a.count;i++){let y=a.getY(i)-dt*4.4;if(y<.04)y+=3.6;a.setY(i,y);}a.needsUpdate=true;spray.material.opacity=.61+Math.sin(time*1.3)*.1;
    const current=flowGeometry.attributes.position;
    for(let i=0;i<streaks.length;i++){
      const s=streaks[i],t=(s.phase+time*s.speed)%1,p=curve.getPoint(t),tangent=curve.getTangent(t).normalize(),normal=new THREE.Vector3(-tangent.z,0,tangent.x);
      p.addScaledVector(normal,s.side);p.y=.007;const tail=p.clone().addScaledVector(tangent,-s.length);current.setXYZ(i*2,p.x,p.y,p.z);current.setXYZ(i*2+1,tail.x,tail.y,tail.z);
    }
    current.needsUpdate=true;
    for(let i=0;i<splashRings.length;i++){
      const ring=splashRings[i],phase=(time*.53+i/3)%1,scale=.6+phase*2.3;
      ring.scale.set(scale,1,scale);ring.position.set(23.7*(1-scale),0,-20.4*(1-scale));ring.material.opacity=(1-phase)*.4;
    }
    const fade=THREE.MathUtils.smoothstep(zoomDistance,66,82);clouds.visible=fade>0;
    for(const c of cloudItems){c.sprite.position.set(((c.x+time*c.speed+50)%100)-50,c.y,c.z+Math.sin(time*.012+c.phase)*2);c.sprite.material.opacity=fade*THREE.MathUtils.smoothstep(Math.sin(time*.017+c.phase),-.1,.7)*.38;}
  }};
  valley.update(0,0);
  return valley;
}
