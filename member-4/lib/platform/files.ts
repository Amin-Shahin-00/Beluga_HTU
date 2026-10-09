import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { drawRtlLine, wrapRtl } from '@/lib/integrations/pdf-rtl';
import type { UserProfile } from '@/lib/integrations/types';

export async function autofillPdf(profile:UserProfile):Promise<Uint8Array> {
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(await readFile(path.join(process.cwd(),'lib/integrations/fonts/Amiri-Regular.ttf')));
 let page=pdf.addPage([595,842]);let y=785;
 const lines=[ 'بداية — نموذج مراجعة بيانات المشروع', 'نموذج تجريبي وليس طلبًا حكوميًا رسميًا أو وثيقة موقعة.',
  `اسم صاحب المشروع: ${profile.personal.fullNameAr}`,`اسم المشروع: ${profile.business.nameAr}`,`المدينة: ${profile.personal.city}`,
  `القطاع: ${profile.business.sector}`,`الشكل القانوني: ${profile.business.legalForm}`,`العمل من المنزل: ${profile.business.homeBased?'نعم':'لا'}`,
  `وصف المشروع: ${profile.business.descriptionAr||profile.business.description}`,`العملاء المستهدفون: ${profile.business.targetCustomersAr||profile.business.targetCustomers}`,
  `رأس المال المصرح: ${profile.business.startupCapitalJod} JOD`,`التمويل المطلوب: ${profile.business.fundingNeededJod} JOD`,`الموظفون المخطط لهم: ${profile.business.employeesPlanned}`,
  'مصدر الحقول: أدخلها المستخدم. لم تتحقق SANAD من البيانات.', 'راجع جميع البيانات قبل استخدامها أو توقيع مستند منفصل.' ];
 for(const line of lines) for(const part of wrapRtl(line,font,14,490)) {if(y<60){page=pdf.addPage([595,842]);y=785;}drawRtlLine(page,part,{right:540,y,font,size:14,color:rgb(.1,.15,.2)});y-=25;}
 pdf.setTitle('Bedaya demo profile review');pdf.setLanguage('ar-JO');return pdf.save();
}
export function fileSignature(bytes:Uint8Array,mime:string) {
 if(mime==='application/pdf')return new TextDecoder().decode(bytes.slice(0,5))==='%PDF-';
 if(mime==='image/png')return [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 if(mime==='image/jpeg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 return false;
}
export function safeFilename(name:string) {return name.replace(/[\\/\x00-\x1f]/g,'_').replace(/^\.+/,'').slice(0,160)||'document';}
