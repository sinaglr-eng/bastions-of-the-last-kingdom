export const FIRST_SEASON = '2026-11';

export function currentSeason(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 7);
}

export function seasonWindow(key) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) throw new RangeError('Invalid season.');
  const [year, month] = key.split('-').map(Number);
  return {key, start: Date.UTC(year, month - 1, 1), end: Date.UTC(year, month, 1)};
}

export function seasonKeys(current) {
  const keys = [];
  for (let key = current; key >= FIRST_SEASON; key = currentSeason(seasonWindow(key).start - 1)) keys.push(key);
  return keys;
}

export function seasonName(key) {
  return new Date(seasonWindow(key).start).toLocaleDateString('en-US', {month:'long', year:'numeric', timeZone:'UTC'});
}

export function seasonReward(rank) {
  return {
    legendary: rank === 1 ? 3 : rank === 2 ? 1 : 0,
    epic: rank === 2 ? 2 : rank === 3 ? 3 : 0,
    gems: rank >= 1 && rank <= 3 ? 1 : 0,
    dust: rank >= 4 && rank <= 10 ? 150 - 20 * (rank - 4) : 0
  };
}

export function seasonPrizeLabel(rank) {
  const {legendary, epic, gems, dust} = seasonReward(rank);
  return [
    legendary && `${legendary} Legendary chest${legendary > 1 ? 's' : ''}`,
    epic && `${epic} Epic chests`,
    gems && '1 random gem',
    dust && `${dust} Relic Dust`
  ].filter(Boolean).join(' + ');
}

// Decimal scores are stored as canonical digit strings and can exceed JS integer precision.
const order = 'score_digits DESC, score_text DESC, highest_wave DESC, finished_at ASC, id ASC';
export const seasonRankedSQL = `WITH personal AS (
  SELECT id,user_id,faction_id,score_digits,score_text,highest_wave,COALESCE(finished_at,updated_at) AS finished_at,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY score_digits DESC,score_text DESC,highest_wave DESC,COALESCE(finished_at,updated_at),id) AS personal_rank
  FROM fr010_runs WHERE outcome IN ('lost','won') AND COALESCE(finished_at,updated_at)>=? AND COALESCE(finished_at,updated_at)<?
), ranked AS (
  SELECT *, ROW_NUMBER() OVER (ORDER BY ${order}) AS rank FROM personal WHERE personal_rank=1
)`;
