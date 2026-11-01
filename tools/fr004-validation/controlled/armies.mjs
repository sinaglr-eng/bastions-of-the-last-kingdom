import{expand,weight,datasets,diamond}from'./fixtures.mjs';
export const positions=[...diamond.core].sort((a,b)=>(a.x-18)**2+(a.z-18)**2-(b.x-18)**2-(b.z-18)**2||a.z-b.z||a.x-b.x);
export const cost=(f,a)=>a.reduce((s,t)=>s+weight(datasets[f],t.family,t.tier),0);
export function fill(f,army,budget=600){
 const rest=budget-cost(f,army);if(rest<0)return null;
 const ids={crown:['archer','thornwarden','embercrown'],forge:['dw_musketeer','dw_griffinscout','dw_longrifle','dw_repeatercrew'],grove:['el_grove_archer','el_elven_mage','el_elven_archer']}[f];
 const opts=ids.flatMap(id=>datasets[f].towers[id].advanced?[{family:id,tier:1}]:Array.from({length:6},(_,i)=>({family:id,tier:i+1}))).map(t=>({...t,cost:weight(datasets[f],t.family,t.tier)}));
 const dp=Array(rest+1).fill(null);dp[0]=[];
 for(let n=1;n<=rest;n++)for(const t of opts)if(n>=t.cost&&dp[n-t.cost]&&(!dp[n]||dp[n-t.cost].length+1<dp[n].length))dp[n]=[...dp[n-t.cost],{family:t.family,tier:t.tier}];
 if(!dp[rest]||army.length+dp[rest].length>19)return null;
 return [...army,...dp[rest]];
}
export const candidates={
 crown:[['human-physical',expand(['monk'],['rangermentor'],['archangel'],['royalranger'],['highking',10])]],
 forge:[
 ['dwarf-sniper',expand(['dw_warcaller'],['dw_nullifier'],['dw_talonlord'],['dw_steamrail',14])],
 ['dwarf-griffin',expand(['dw_warcaller'],['dw_nullifier'],['dw_talonlord',14])],
 ['dwarf-mixed',expand(['dw_warcaller'],['dw_nullifier',2],['dw_talonlord',9],['dw_steamrail',4])],
 ['dwarf-musketeer',expand(['dw_warcaller'],['dw_nullifier'],['dw_talonlord'],['dw_musketeer',14,6])],
 ],
 grove:[
 ['elf-huntress',expand(['el_moonwell_seer'],['el_stag_oracle'],['el_drow_furnace_seer'],['el_twilight_huntress',13])],
 ['elf-mixed',expand(['el_moonwell_seer'],['el_stag_oracle'],['el_drow_furnace_seer'],['el_twilight_huntress',10],['el_wisp_conductor',3])],
 ['elf-mixed-ranger',expand(['el_moonwell_seer'],['el_stag_oracle'],['el_drow_furnace_seer'],['el_twilight_huntress',10],['el_spark_adept',3,6])],
 ]
};
