import { z } from 'zod';
import JSZip from 'jszip';
import { createClient } from '@/lib/supabase/server';
import { checkMutation, json, readObject } from '@/lib/http';
import { profileSchema, draftSchema, summarize, teamEstimate, type Task } from '@/lib/platform/team';
import { rankIncubators } from '@/lib/platform/ranking';
import { autofillPdf, fileSignature, safeFilename } from '@/lib/platform/files';
import { complianceDates } from '@/lib/platform/domain';
import { explainMatches, prefillApplications } from '@/lib/integrations/incubators';
import { knowledge } from '@/lib/integrations/knowledge';
import { generateBusinessPlan } from '@/lib/integrations/business-plan';
import { renderBusinessPlanPdf } from '@/lib/integrations/business-plan-pdf';
import { checkDocuments } from '@/lib/integrations/document-checker';
import type { UserProfile, OcrResult } from '@/lib/integrations/types';
type SupabaseClient=Awaited<ReturnType<typeof createClient>>;

type Context={params:Promise<{path:string[]}>};
class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
function must<T>(result:{data:T|null;error:{code?:string;message?:string}|null}):T {
 if(result.error)throw new HttpError(result.error.code==='23505'||result.error.code==='P0001'?409:result.error.code==='42501'?403:500,'The operation could not be completed. Check prerequisites and database setup.');
 return result.data as T;
}
function validate<T>(schema:z.ZodType<T>,value:unknown):T {const parsed=schema.safeParse(value);if(!parsed.success)throw new HttpError(400,parsed.error.issues.map(issue=>`${issue.path.join('.')}: ${issue.message}`).join('; ').slice(0,500));return parsed.data;}
const idSchema=z.string().uuid();
const MIME=['application/pdf','image/jpeg','image/png'] as const;
type DocumentRow={id:string;business_id:number;user_id:string;filename:string;storage_path:string;mime_type:string;size_bytes:number;status:string;kind:string;expires_on:string|null;ocr_result:OcrResult|null};
async function owner(db:SupabaseClient,id:number,user:string) {const row=must(await db.from('businesses').select('id,name,type,city,status,created_at').eq('id',id).eq('user_id',user).maybeSingle<{id:number;name:string;type:string;city:string;status:string;created_at:string}>());if(!row)throw new HttpError(404,'Business not found.');return row;}
async function profile(db:SupabaseClient,id:number,user:string):Promise<UserProfile> {const row=must(await db.from('bedaya_profiles').select('answers,submitted_at').eq('business_id',id).eq('user_id',user).maybeSingle<{answers:Record<string,unknown>;submitted_at:string|null}>());if(!row?.submitted_at)throw new HttpError(409,'Complete and submit onboarding first.');return {...validate(profileSchema,Object.fromEntries(Object.entries(row.answers).filter(([key])=>key!=='userId'))),userId:user};}
async function document(db:SupabaseClient,id:string,user:string):Promise<DocumentRow> {const row=must(await db.from('bedaya_documents').select('*').eq('id',validate(idSchema,id)).eq('user_id',user).maybeSingle());if(!row)throw new HttpError(404,'Document not found.');return row as DocumentRow;}
async function taskRows(db:SupabaseClient,bid:number,user:string):Promise<Task[]> {return (must(await db.from('bedaya_tasks').select('*').eq('business_id',bid).eq('user_id',user)) as Task[]).sort((a,b)=>Number(a.details.order)-Number(b.details.order));}
async function plan(db:SupabaseClient,bid:number,user:string) {
 const p=await profile(db,bid,user);const costs=teamEstimate(p,await taskRows(db,bid,user));const generated=await generateBusinessPlan(p,costs);
 let cursor=new Date().toISOString().slice(0,10);
 generated.timeline=costs.steps.map(step=>{const start=cursor;const end=new Date(cursor+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+(step.days.value??0));cursor=end.toISOString().slice(0,10);return {stepId:step.id,title:step.title,office:knowledge.offices[step.officeId]?.name||{ar:step.officeId,en:step.officeId},start,end:cursor,durationKnown:step.days.value!==null&&step.days.verified==='yes',fee:step.fee.note};});
 return {profile:p,costs,plan:generated};
}
function attachment(bytes:Uint8Array,mime:string,name:string) {return new Response(new Uint8Array(bytes),{headers:{'Content-Type':mime,'Content-Disposition':`attachment; filename="${name}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
async function savePdf(db:SupabaseClient,bid:number,user:string,filename:string,bytes:Uint8Array) {const id=crypto.randomUUID();const storage_path=`${user}/${bid}/${id}.pdf`;must(await db.storage.from('bedaya-vault').upload(storage_path,bytes,{contentType:'application/pdf',upsert:false}));return must(await db.from('bedaya_documents').insert({id,business_id:bid,user_id:user,filename,storage_path,mime_type:'application/pdf',size_bytes:bytes.length,kind:'generated',status:'ready'}).select().single());}

async function handler(request:Request,context:Context) {
 try {
  const mutation=request.method!=='GET';
  if(mutation){const rejected=checkMutation(request);if(rejected)return rejected;}
  const db=await createClient();const {data:{user},error}=await db.auth.getUser();if(error||!user)return json({error:'Sign in first.'},401);
  const {path}=await context.params;const method=request.method;const route=path.join('/');
  const input=mutation?await readObject(request,65536):null;if(mutation&&!input)throw new HttpError(400,'Send a JSON object no larger than 64 KB.');
  if(route==='catalog'&&method==='GET')return json({data:must(await db.from('bedaya_catalog').select('*').order('key')),disclaimer:'Real programme information is team-supplied. Bank, slot, compliance and zoning fixtures are demo-only.'});
  if(route==='me'&&method==='GET')return json({user:{id:user.id,email:user.email},membership:must(await db.from('bedaya_members').select('role,partner_key').eq('user_id',user.id).maybeSingle())});
  if(route==='notifications'&&method==='GET')return json({data:must(await db.from('bedaya_notifications').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100))});
  if(path[0]==='notifications'&&path.length===2&&method==='PATCH')return json({data:must(await db.from('bedaya_notifications').update({read_at:new Date().toISOString()}).eq('id',validate(idSchema,path[1])).eq('user_id',user.id).select().maybeSingle())});
  if(route==='consents'&&method==='POST') {const value=validate(z.object({purpose:z.enum(['ocr_processing','ai_assistant','incubator_share','e_signature','mock_identity']),granted:z.boolean()}).strict(),input);return json({data:must(await db.from('bedaya_consents').insert({user_id:user.id,...value,consent_text_version:'v1'}).select().single())},201);}
  if(route==='signatures'&&method==='POST') {
   const value=validate(z.object({documentId:idSchema,signedDocumentId:idSchema,signerName:z.string().trim().min(1).max(120),consent:z.literal(true)}).strict(),input);
   const original=await document(db,value.documentId,user.id);const signed=await document(db,value.signedDocumentId,user.id);
   if(original.status!=='ready'||signed.status!=='ready'||signed.kind!=='signed'||original.business_id!==signed.business_id)throw new HttpError(400,'Both documents must be ready, in the same business; the signed file must be marked signed.');
   must(await db.from('bedaya_consents').insert({user_id:user.id,purpose:'e_signature',granted:true,consent_text_version:'v1'}));
   return json({data:must(await db.from('bedaya_signatures').insert({user_id:user.id,document_id:original.id,signed_document_id:signed.id,signer_name:value.signerName,provider:'mock'}).select().single()),isMock:true,legallyVerified:false},201);
  }
  if(route==='identity/mock'&&method==='POST') {
   validate(z.object({consent:z.literal(true)}).strict(),input);
   must(await db.from('bedaya_audit').insert({user_id:user.id,event:'mock_identity_consent',details:{provider:'mock_sanad',version:'v1'}}));
   return json({provider:'mock_sanad',isMock:true,userId:user.id,fields:{email:{value:user.email,source:'supabase_auth',verifiedBySanad:false}},disclaimer:'This adapter uses the existing session. It does not authenticate through or retrieve data from SANAD.'});
  }
  if(path[0]==='businesses'&&path.length>=3) {
   const bid=validate(z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),path[1]);const business=await owner(db,bid,user.id);const action=path.slice(2).join('/');
   if(action==='onboarding'&&method==='GET')return json({data:must(await db.from('bedaya_profiles').select('*').eq('business_id',bid).eq('user_id',user.id).maybeSingle()),fieldOrigins:{personal:'typed_by_user',business:'typed_by_user',userId:'supabase_auth'},sanadVerified:false});
   if(action==='onboarding/draft'&&method==='POST') {
    const draft=validate(draftSchema,input);const existing=must(await db.from('bedaya_profiles').select('submitted_at').eq('business_id',bid).maybeSingle<{submitted_at:string|null}>());if(existing?.submitted_at)throw new HttpError(409,'Submitted onboarding is frozen.');
    return json({data:must(await db.from('bedaya_profiles').upsert({business_id:bid,user_id:user.id,answers:draft,updated_at:new Date().toISOString()},{onConflict:'business_id'}).select().single())});
   }
   if(action==='onboarding/submit'&&method==='POST') {
    const p=validate(profileSchema,input);must(await db.rpc('bedaya_submit',{p_business:bid,p_answers:{...p,userId:user.id}}));return json({message:'Onboarding submitted.',rulesVersion:knowledge.version},201);
   }
   if(action==='roadmap'&&method==='GET')return json({data:summarize(await taskRows(db,bid,user.id)),orderBasis:'M1 spreadsheet step order; dependency order is a demo planning assumption.'});
   if(action==='estimate'&&method==='GET')return json({data:teamEstimate(await profile(db,bid,user.id),await taskRows(db,bid,user.id))});
   if(action==='incubators'&&method==='GET') {const p=await profile(db,bid,user.id);const ranked=rankIncubators(p);return json({...await explainMatches(p,ranked),ranked,submissionMode:'internal_demo',disclaimer:'Application fields are inferred, not official forms; confirm programme availability and eligibility.'});}
   if(action==='incubators/prefill'&&method==='POST') {const value=validate(z.object({incubatorIds:z.array(z.string().min(1).max(80)).min(1).max(10)}).strict(),input);return json({data:prefillApplications(await profile(db,bid,user.id),value.incubatorIds),officialForm:false});}
   if(action==='applications'&&method==='GET')return json({data:must(await db.from('bedaya_applications').select('*').eq('business_id',bid).eq('user_id',user.id).order('created_at',{ascending:false}))});
   if(action==='applications'&&method==='POST') {
    const value=validate(z.object({partnerKeys:z.array(z.string().min(1).max(80)).min(1).max(10),consent:z.literal(true),documentIds:z.array(idSchema).max(100).optional()}).strict(),input);
    const partners=must(await db.from('bedaya_catalog').select('key,payload,is_demo').eq('kind','partner').in('key',[...new Set(value.partnerKeys)]));if(partners.length!==new Set(value.partnerKeys).size)throw new HttpError(400,'Unknown partner.');
    // Only the documents the owner selected are shared (all ready documents when no selection is sent).
    let docQuery=db.from('bedaya_documents').select('id,filename,storage_path,kind').eq('business_id',bid).eq('user_id',user.id).eq('status','ready');if(value.documentIds)docQuery=docQuery.in('id',value.documentIds.length?value.documentIds:['00000000-0000-0000-0000-000000000000']);
    const built=await plan(db,bid,user.id);const docs=must(await docQuery);
    const rows=partners.map(partner=>({business_id:bid,user_id:user.id,partner_key:partner.key,kind:partner.payload.kind==='bank'?'bank':'incubator',consent:true,payload:{profile:built.profile,plan:built.plan,costs:built.costs,documentIds:docs.map(doc=>doc.id),documents:docs,submissionMode:'internal_demo',isDemo:true,notSentExternally:true}}));
    const inserted=must(await db.from('bedaya_applications').insert(rows).select());
    must(await db.from('bedaya_audit').insert({user_id:user.id,event:'partner_share_consent',details:{businessId:bid,partners:value.partnerKeys,mode:'internal_demo',version:'v1'}}));return json({data:inserted,message:'Recorded in the Bedaya demo inbox; not sent to external organisations.'},201);
   }
   if(action==='documents'&&method==='GET')return json({data:must(await db.from('bedaya_documents').select('*').eq('business_id',bid).eq('user_id',user.id).order('created_at',{ascending:false}))});
   if(action==='documents/upload'&&method==='POST') {
    const value=validate(z.object({filename:z.string().min(1).max(180),mimeType:z.enum(MIME),sizeBytes:z.number().int().positive().max(10485760),kind:z.enum(['identity','address','registration','license','other','signed']),expiresOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()}).strict(),input);
    const id=crypto.randomUUID();const ext={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg'}[value.mimeType];const storage_path=`${user.id}/${bid}/${id}.${ext}`;
    const row=must(await db.from('bedaya_documents').insert({id,business_id:bid,user_id:user.id,storage_path,filename:safeFilename(value.filename),mime_type:value.mimeType,size_bytes:value.sizeBytes,kind:value.kind,expires_on:value.expiresOn||null}).select().single());
    const upload=must(await db.storage.from('bedaya-vault').createSignedUploadUrl(storage_path));return json({data:row,upload:{signedUrl:upload.signedUrl,path:upload.path,token:upload.token},next:`POST /api/platform/documents/${id}/finalize`},201);
   }
   if(action==='documents/autofill'&&method==='POST')return json({data:await savePdf(db,bid,user.id,'bedaya-profile-review.pdf',await autofillPdf(await profile(db,bid,user.id))),officialForm:false,signed:false},201);
   if(action==='plan'&&method==='GET')return json({data:await plan(db,bid,user.id),disclaimer:'Prototype plan; estimated cost lower bounds exclude unknown fees and monthly operating costs.'});
   if(action==='plan/pdf'&&method==='GET') {const built=await plan(db,bid,user.id);const lang=new URL(request.url).searchParams.get('lang')==='en'?'en':'ar';return attachment(await renderBusinessPlanPdf(built.plan,lang),'application/pdf','bedaya-business-plan.pdf');}
   if(action==='bank-package'&&method==='GET') {
    const selected=new URL(request.url).searchParams.get('documents');const ids=selected===null?null:selected.split(',').filter(Boolean).map(id=>validate(idSchema,id));
    let pkgQuery=db.from('bedaya_documents').select('*').eq('business_id',bid).eq('user_id',user.id).eq('status','ready');if(ids)pkgQuery=pkgQuery.in('id',ids.length?ids:['00000000-0000-0000-0000-000000000000']);
    const built=await plan(db,bid,user.id);const docs=must(await pkgQuery) as DocumentRow[];
    if(docs.reduce((n,d)=>n+Number(d.size_bytes),0)>25000000)throw new HttpError(413,'Package exceeds 25 MB.');
    const zip=new JSZip();zip.file('profile.json',JSON.stringify(built.profile,null,2));zip.file('costs.json',JSON.stringify(built.costs,null,2));zip.file('business-plan.pdf',await renderBusinessPlanPdf(built.plan,'ar'));zip.file('manifest.json',JSON.stringify({business,documents:docs.map(d=>({id:d.id,filename:d.filename,kind:d.kind})),readiness:{hasSignedDocuments:docs.some(d=>d.kind==='signed'),notVerifiedBySanad:true},disclaimer:'Demo review package. Not automatically bank-approved. No external submission or official signature validation.'},null,2));
    let actualSize=0;for(const doc of docs){const file=must(await db.storage.from('bedaya-vault').download(doc.storage_path));actualSize+=file.size;if(actualSize>25000000)throw new HttpError(413,'Actual package size exceeds 25 MB.');zip.file(`documents/${doc.id}-${safeFilename(doc.filename)}`,await file.arrayBuffer());}
    return attachment(await zip.generateAsync({type:'uint8array'}),'application/zip','bedaya-bank-package.zip');
   }
   if(action==='home-track'&&method==='GET') {const p=await profile(db,bid,user.id);return json({homeBased:p.business.homeBased,facts:knowledge.facts.filter(f=>f.id.startsWith('home_')),scope:'Greater Amman source material; do not assume the same rules in other municipalities.',sources:knowledge.sources});}
   if(action==='compliance'&&method==='GET') {const row=must(await db.from('bedaya_catalog').select('payload').eq('key','compliance-demo').single<{payload:{items:{key:string;title_ar:string;title_en:string;months:number;office:string}[]}}>());const start=new URL(request.url).searchParams.get('start')||String(business.created_at).slice(0,10);validate(z.string().regex(/^\d{4}-\d{2}-\d{2}$/),start);return json({data:complianceDates(start,row.payload.items),isDemo:true,disclaimer:'Fictional review dates, not legal filing deadlines.'});}
   if(action==='bookings'&&method==='GET')return json({data:must(await db.from('bedaya_bookings').select('*').eq('business_id',bid).eq('user_id',user.id))});
   if(action==='bookings'&&method==='POST') {const value=validate(z.object({slotKey:z.string().min(1).max(80)}).strict(),input);return json({id:must(await db.rpc('bedaya_book',{p_business:bid,p_slot:value.slotKey})),isDemo:true},201);}
  }
  if(path[0]==='tasks'&&path.length===2&&method==='PATCH') {const value=validate(z.object({status:z.enum(['pending','in_progress','done'])}).strict(),input);must(await db.rpc('bedaya_update_task',{p_task:validate(idSchema,path[1]),p_status:value.status}));return json({message:'Progress saved.'});}
  if(path[0]==='bookings'&&path[2]==='cancel'&&path.length===3&&method==='POST') {must(await db.rpc('bedaya_cancel_booking',{p_booking:validate(idSchema,path[1])}));return json({message:'Demo booking cancelled.'});}
  if(path[0]==='documents'&&path.length===3) {
   const doc=await document(db,path[1],user.id);
   if(path[2]==='finalize'&&method==='POST') {const blob=must(await db.storage.from('bedaya-vault').download(doc.storage_path));const bytes=new Uint8Array(await blob.arrayBuffer());if(bytes.length!==Number(doc.size_bytes)||!fileSignature(bytes,doc.mime_type))throw new HttpError(400,'File size or signature does not match its metadata.');return json({data:must(await db.from('bedaya_documents').update({status:'ready'}).eq('id',doc.id).select().single())});}
   if(path[2]==='download'&&method==='GET') {if(doc.status!=='ready')throw new HttpError(409,'Finalize the upload first.');return json({data:must(await db.storage.from('bedaya-vault').createSignedUrl(doc.storage_path,60)),expiresInSeconds:60});}
   if(path[2]==='ocr'&&method==='POST') {
    const value=validate(z.object({consent:z.literal(true),result:z.object({fileId:idSchema,fileName:z.string().max(180),docType:z.string().max(80),fields:z.record(z.string(),z.string().max(500)),confidence:z.number().min(0).max(1),imageQuality:z.number().min(0).max(1)}).strict()}).strict(),input);
    if(doc.status!=='ready'||value.result.fileId!==doc.id)throw new HttpError(400,'Use the finalized document ID.');
    const p=await profile(db,doc.business_id,user.id);const checked=await checkDocuments({profile:p,files:[value.result as OcrResult]});
    must(await db.from('bedaya_audit').insert({user_id:user.id,event:'ocr_processing_consent',details:{documentId:doc.id,version:'v1',source:'M5_result'}}));
    return json({data:must(await db.from('bedaya_documents').update({ocr_result:value.result,warnings:checked.files[0]?.warnings||[]}).eq('id',doc.id).select().single()),check:checked,disclaimer:'Stores supplied OCR results; this endpoint does not perform OCR itself.'});
   }
  }
  if(route==='slots'&&method==='GET')return json({data:must(await db.rpc('bedaya_available_slots')),isDemo:true});
  if(route==='location'&&method==='POST') {const value=validate(z.object({area:z.string().min(1).max(120),activity:z.string().min(1).max(80)}).strict(),input);const row=must(await db.from('bedaya_catalog').select('payload').eq('key','location-demo').single<{payload:{areas:{name:string;activities:string[]}[];disclaimer:string}}>());const area=row.payload.areas.find(item=>item.name===value.area);return json({allowed:area?area.activities.includes(value.activity):null,isDemo:true,disclaimer:row.payload.disclaimer});}
  if(route==='analytics'&&method==='GET')return json({isDemo:true,anonymous:true,data:[{step:'registration',averageDays:2,sampleSize:12},{step:'documents',averageDays:4,sampleSize:12},{step:'licensing',averageDays:7,sampleSize:12}],disclaimer:'Static fictional aggregates for the screens-only feature; no user data is aggregated.'});
  if(route==='partner/inbox'&&method==='GET') {const membership=must(await db.from('bedaya_members').select('role,partner_key').eq('user_id',user.id).maybeSingle<{role:string;partner_key:string|null}>());if(!membership)throw new HttpError(403,'Partner or admin role required.');let query=db.from('bedaya_applications').select('*').order('created_at',{ascending:false}).limit(100);if(membership.role==='partner')query=query.eq('partner_key',membership.partner_key);return json({data:must(await query)});}
  if(path[0]==='partner'&&path[1]==='applications'&&path.length===3&&method==='PATCH') {const value=validate(z.object({status:z.enum(['in_review','needs_documents','approved','rejected']),note:z.string().max(1000).default(''),requestedItems:z.array(z.string().max(120)).max(20).default([])}).strict(),input);const row=must(await db.from('bedaya_applications').update({status:value.status,review_note:value.note,requested_items:value.requestedItems,reviewed_at:new Date().toISOString()}).eq('id',validate(idSchema,path[2])).select().maybeSingle());if(!row)throw new HttpError(403,'You cannot review this application.');return json({data:row});}
  if(path[0]==='admin') {
   if(!must(await db.rpc('bedaya_is_admin')))throw new HttpError(403,'Admin role required.');
   if(route==='admin/catalog'&&method==='GET')return json({data:must(await db.from('bedaya_catalog').select('*').order('key'))});
   if(route==='admin/users'&&method==='GET')return json({data:must(await db.from('bedaya_members').select('*'))});
   if(route==='admin/users'&&method==='POST') {const value=validate(z.object({userId:idSchema,role:z.enum(['admin','partner','expert']),partnerKey:z.string().min(1).max(80).nullable()}).strict(),input);must(await db.rpc('bedaya_set_member',{p_user:value.userId,p_role:value.role,p_partner:value.partnerKey}));return json({message:'Application role saved.'});}
   if(route==='admin/catalog'&&method==='POST') {const value=validate(z.object({key:z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),kind:z.enum(['rules','partner','slot','compliance','location']),payload:z.record(z.string(),z.unknown()),isDemo:z.boolean()}).strict(),input);if(value.kind==='rules')validate(z.object({steps:z.array(z.object({key:z.string(),legalForm:z.enum(['home_business','sole_proprietorship','llc']),condition:z.enum(['always','optional','if_trade_name','if_food','if_employees','if_rented','if_male_born_1989_plus']),title:z.object({ar:z.string(),en:z.string()}),officeId:z.string(),requiredDocs:z.array(z.object({docId:z.string(),condition:z.string()})),fee:z.object({minJod:z.number().nonnegative().nullable(),maxJod:z.number().nonnegative().nullable()}),days:z.object({value:z.number().int().nonnegative().nullable()})}).passthrough()).min(1)}).passthrough(),value.payload);return json({data:must(await db.from('bedaya_catalog').upsert({key:value.key,kind:value.kind,payload:value.payload,is_demo:value.isDemo,updated_at:new Date().toISOString()}).select().single())});}
  }
  throw new HttpError(404,'Endpoint not found.');
 } catch(error) {if(error instanceof HttpError)return json({error:error.message},error.status);return json({error:'Service unavailable. Check configuration and migrations.'},503);}
}
export const GET=handler;
export const POST=handler;
export const PATCH=handler;
