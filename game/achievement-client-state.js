import {canonicalAchievementId,isSharedAchievement} from './core/account-progression.js';

// Read legacy cached profiles without changing their ledger, wallet or run identity.
export function canonicalAchievementRows(rows=[]){
 const unique=new Map();
 for(const row of rows||[]){
  if(!row||typeof row.id!=='string')continue;
  const id=canonicalAchievementId(row.id),previous=unique.get(id),current={...row,id,...(isSharedAchievement(id)?{factionId:null}:{})};
  if(!previous){unique.set(id,current);continue;}
  const next=row.id===id?current:previous;
  const dates=[previous.createdAt,current.createdAt].filter(value=>Number.isFinite(Number(value))&&value!==null);
  unique.set(id,dates.length?{...next,createdAt:Math.min(...dates.map(Number))}:next);
 }
 return [...unique.values()];
}
export const achievementIdSet=rows=>new Set(canonicalAchievementRows(rows).map(row=>row.id));
