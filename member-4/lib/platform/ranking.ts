import { incubators } from '@/lib/integrations/incubators';
import type { UserProfile } from '@/lib/integrations/types';
// Scores use M5's [{incubatorId, score}] contract; unknown operating duration isn't guessed.
export function rankIncubators(profile:UserProfile,today=new Date().toISOString().slice(0,10)) {
 const born=new Date(profile.personal.birthDate);const current=new Date(today);let age=current.getUTCFullYear()-born.getUTCFullYear();
 if(current.getUTCMonth()<born.getUTCMonth()||(current.getUTCMonth()===born.getUTCMonth()&&current.getUTCDate()<born.getUTCDate()))age--;
 return incubators.filter(inc=>inc.sectors.includes(profile.business.sector)&&inc.stages.includes(profile.business.stage))
  .filter(inc=>(inc.eligibility.minAge===undefined||age>=inc.eligibility.minAge)&&(inc.eligibility.maxAge===undefined||age<=inc.eligibility.maxAge))
  .map(inc=>({incubatorId:inc.id,score:(5+(inc.homeBasedFriendly&&profile.business.homeBased?2:0)+(inc.womenFocused&&profile.personal.gender==='female'?1:0)+(inc.city===profile.personal.city?1:0)+(inc.maxFundingJod!==null&&inc.maxFundingJod>=profile.business.fundingNeededJod?1:0))/10,needsConfirmation:inc.eligibility.minMonthsOperating!==undefined||inc.eligibility.jordanianOnly===true,eligibilityNote:'Programme eligibility and current intake must be confirmed; operating months and nationality are not collected.'})).sort((a,b)=>b.score-a.score);
}
