import {seasonKeys,seasonName,seasonPrizeLabel} from './seasons.js';

export function seasonOptions(current,selected) {
  return seasonKeys(current).map(key => {
    const value = key === current ? 'current' : key;
    return `<option value="${value}" ${key === selected ? 'selected' : ''}>${seasonName(key)}${key === current ? ' · Current season' : ''}</option>`;
  }).join('');
}

export function seasonIntro(season,current) {
  const closed = season.key < current;
  const date = new Date(season.end).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  return `<h2>${seasonName(season.key)}</h2><p>${closed ? 'Closed' : 'Ends'} ${date} at 00:00 UTC. Each account holds one place with its best verified finish across all factions and equipment.</p>`;
}

export function seasonRules(season,current) {
  return `<section class="season-summary">${seasonIntro(season,current)}
    <details class="season-prizes"><summary>Top 10 rewards</summary><p>Rewards are added to the Commander vault when the season closes. Legendary chests are Tier V and Epic chests are Tier IV.</p>
    <ol>${Array.from({length:10},(_,i)=>`<li>${seasonPrizeLabel(i+1)}</li>`).join('')}</ol></details></section>`;
}
