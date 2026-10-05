export function formatRunDuration(seconds){
  const total=Number.isFinite(seconds)?Math.max(0,Math.floor(seconds)):0;
  const hours=Math.floor(total/3600),minutes=Math.floor(total/60)%60,remainder=total%60;
  const pair=value=>String(value).padStart(2,'0');
  return hours?`${hours}:${pair(minutes)}:${pair(remainder)}`:`${pair(minutes)}:${pair(remainder)}`;
}
