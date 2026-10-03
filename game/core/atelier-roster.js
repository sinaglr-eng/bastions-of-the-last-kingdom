// The gallery follows the actual campaign, including the hostile final boss.
// Three combat variants may share one authored visual; show that visual once.
export function atelierEnemyRoster(enemies,waves){
  const roster=new Map();
  for(const [index,wave] of waves.entries())for(const group of wave.groups||[]){
    const definition=enemies[group.type],id=definition?.visualAsset;
    if(!definition||!/^host_\d{2}$/.test(id)||roster.has(id))continue;
    roster.set(id,{...definition,id,type:group.type,wave:index+1});
  }
  return [...roster.values()].sort((a,b)=>a.wave-b.wave||a.id.localeCompare(b.id));
}

export function atelierSelection(search,towers,enemies){
  const query=new URLSearchParams(search);
  const roster=query.get('roster')==='enemies'?'enemies':'defenders';
  const requested=query.get(roster==='enemies'?'enemy':'family');
  const members=roster==='enemies'?enemies:towers;
  const id=Object.hasOwn(members,requested)?requested:roster==='enemies'?Object.keys(enemies)[0]:'archer';
  const tier=roster==='defenders'&&!towers[id]?.advanced?Math.max(1,Math.min(6,Math.floor(Number(query.get('tier'))||1))):1;
  return {roster,id,tier};
}

export function atelierSelectionQuery({roster,id,tier=1}){
  const query=new URLSearchParams();query.set('roster',roster);
  query.set(roster==='enemies'?'enemy':'family',id);
  if(roster==='defenders')query.set('tier',String(tier));
  return '?'+query.toString();
}

export function atelierEnemyProperties(enemy){
  const labels=[];
  if(enemy.resists)labels.push(...Object.entries(enemy.resists).filter(([,value])=>value>0).map(([type,value])=>`${type}: ${Math.round(value*100)} %`));
  for(const [keys,label] of [
    [['blink'],'Teleport'],[['regen'],'Regenerace'],[['refraction'],'Refrakční štíty'],
    [['cloaked','stealth','cloakDaggers'],'Maskování'],[['shred'],'Průraz zbroje'],
    [['physicalImmune'],'Fyzická imunita'],[['magicImmune'],'Magická imunita'],
    [['krakenShell'],'Ochranný krunýř'],[['reactiveArmor'],'Reaktivní zbroj'],
    [['recharge'],'Obnova zdraví'],[['disarm'],'Odzbrojení'],[['hasteAura'],'Zrychlení spojenců'],
    [['rush'],'Nápor'],[['thief'],'Krádež zlata'],[['untouchable'],'Aura oslabující obránce'],
  ])if(keys.some(key=>enemy[key]))labels.push(label);
  if(enemy.evasion)labels.push(`Úhyb: ${Math.round(enemy.evasion*100)} %`);
  return labels;
}
