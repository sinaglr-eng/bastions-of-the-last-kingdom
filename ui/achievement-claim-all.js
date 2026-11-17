// Keep the server's existing single-achievement eligibility and payout checks.
// A stable snapshot prevents newly arriving rewards from extending this action.
const activeClaims=new WeakMap();
export function claimAvailableAchievements(player,onProgress=()=>{}){
 if(activeClaims.has(player))return activeClaims.get(player);
 const ids=[...new Set((player.readyAchievements||[]).map(row=>row.id))];
 const operation=(async()=>{
  if(!player.user||!player.online)throw Error('Connect and sign in to claim achievements.');
  let claimed=0;
  try{
   for(const id of ids){await player.claimAchievement(id);claimed++;onProgress({claimed,total:ids.length});}
   return {claimed,total:ids.length};
  }catch(error){error.claimedCount=claimed;error.requestedCount=ids.length;throw error;}
 })();
 activeClaims.set(player,operation);
 operation.finally(()=>activeClaims.delete(player)).catch(()=>{});
 return operation;
}
