// Generates SQL only; never uses a privileged key or connects to your database.
import { mkdir, writeFile } from 'node:fs/promises';
import { demoRules, demoPartners, demoCompliance } from '../lib/platform/demo-data.ts';
const literal = value => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
const entries = [
 ['rules-demo-v1','rules',demoRules],
 ...demoPartners.map(partner=>[partner.key,'partner',partner]),
 ['compliance-demo','compliance',{items:demoCompliance}],
 ['location-demo','location',{areas:[{name:'Demo Amman Area A',activities:['retail','services']},{name:'Demo Amman Area B',activities:['bakery','online']}],disclaimer:'Fictional zoning sample only. No real address is verified.'}],
 ...Array.from({length:6},(_,index)=> {
   const date=new Date(); date.setUTCDate(date.getUTCDate()+index+1); date.setUTCHours(7+index%3,0,0,0);
   return [`slot-demo-${index+1}`,'slot',{partner_key:index%2?'bank-demo':'incubator-food',starts_at:date.toISOString(),duration_minutes:30,timezone:'Asia/Amman',is_demo:true}];
 })
];
const sql='begin;\n'+entries.map(([key,kind,payload])=>`insert into public.bedaya_catalog(key,kind,payload,is_demo) values('${key}','${kind}',${literal(payload)},true) on conflict(key) do nothing;`).join('\n')+'\ncommit;\n';
await mkdir('supabase/seeds',{recursive:true});
await writeFile('supabase/seeds/demo.sql',sql);
console.log('Generated supabase/seeds/demo.sql; all entries are fictional demo data.');
