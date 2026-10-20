// D1 atomic counters contain member hashes and numbers, never photos or reports.
export function aiUsageStore(db){
 if(!db)return null;
 async function reserve(member,period,limit,cooldown,now){
  return !!await db.prepare(`INSERT INTO ai_usage (member,period,requests,last_request) VALUES (?,?,1,?)
   ON CONFLICT(member,period) DO UPDATE SET requests=requests+1,last_request=excluded.last_request
   WHERE requests < ? AND last_request <= ? RETURNING requests`).bind(member,period,now,limit,now-cooldown).first();
 }
 return {async take(member,now=Date.now()){
  const period=new Date(now).toISOString().slice(0,7);
  if(!await reserve(member,period,100,60000,now))return false;
  const day=new Date(now).toISOString().slice(0,10);
  if(!await reserve('__groq_daily__',day,25,60000,now))return false;
  return reserve('__all__',period,1000,0,now);
 }};
}
