import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { businessManagerWhere } from '@/lib/businesses';
import { assertSameOrigin, enforceRequestRateLimit } from '@/lib/security/request';
import { readVerifiedImageFile } from '@/lib/security/uploads';
import { MODEL_TYPE, MODEL_JOB_TYPE, MAX_MODEL_BYTES, validateGlb, fetchModel } from '@/lib/storefront-model';
export const runtime='nodejs';
export const maxDuration=60;
type Context={params:Promise<{businessId:string}>};
type Job={task?:string;endpoint:'image-to-3d'|'multi-image-to-3d';status:string;progress?:number;error?:string};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function access(request:Request,context:Context) {
 const session=await auth();if(!session?.user?.id)return {response:reply({error:'Sign in to use 3D Studio.'},401)};
 if(!assertSameOrigin(request))return {response:reply({error:'Invalid origin.'},403)};
 const limited=enforceRequestRateLimit(request,[{key:`storefront-model:${session.user.id}`,limit:30,intervalMs:60000}]);if(limited)return {response:limited};
 const {businessId}=await context.params;
 const business=await db.vendorProfile.findFirst({where:{id:businessId,...businessManagerWhere(session.user.id,session.user.role)},select:{id:true}});
 if(!business)return {response:reply({error:'Business not found.'},404)};
 return {business,userId:session.user.id};
}
async function meshFetch(path:string,body?:unknown) {
 const key=process.env.MESHY_API_KEY;if(!key)throw new Error('Photo-to-3D generation is not configured yet. You can upload a GLB instead.');
 const response=await fetch(`https://api.meshy.ai/openapi/v1/${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw new Error(response.status===402?'Meshy credits are unavailable. Check your plan and API credit limit.':response.status===401?'The Meshy connection needs attention.':`Meshy could not complete this request (${response.status}).`);
 return response.json();
}
export async function GET(request:Request,context:Context){
 const a=await access(request,context);if(a.response)return a.response;
 const id=new URL(request.url).searchParams.get('job');
 if(!id){let connected=false,connectionError='';if(process.env.MESHY_API_KEY){try{await meshFetch('balance');connected=true;}catch{connectionError='Meshy could not connect. Check the API key and account; GLB uploads still work.';}}const recent=await db.vendorStorefrontMedia.findFirst({where:{vendorProfileId:a.business.id,contentType:{in:[MODEL_TYPE,MODEL_JOB_TYPE]}},orderBy:{createdAt:'desc'},select:{id:true,contentType:true}});return reply({configured:connected,connectionError,recent:recent?{id:recent.id,modelUrl:recent.contentType===MODEL_TYPE?`/api/vendor-media/${recent.id}`:null}:null});}
 const row=await db.vendorStorefrontMedia.findFirst({where:{id,vendorProfileId:a.business.id}});
 if(!row)return reply({error:'Model not found.'},404);
 if(row.contentType===MODEL_TYPE)return reply({status:'SUCCEEDED',modelUrl:`/api/vendor-media/${row.id}`});
 if(row.contentType!==MODEL_JOB_TYPE)return reply({error:'Model not found.'},404);
 const job:Job=JSON.parse(Buffer.from(row.data).toString());
 if(!job.task)return reply({status:job.status,error:job.error || 'The request is being submitted. If it stays here, check Meshy before starting another generation.'});
 if(job.status==='FAILED')return reply({status:job.status,error:job.error});
 try {
  const result=await meshFetch(`${job.endpoint}/${encodeURIComponent(job.task)}`);
  if(result.status==='SUCCEEDED'){
   const bytes=await fetchModel(result.model_urls?.glb || '');
   await db.vendorStorefrontMedia.update({where:{id},data:{data:bytes,size:bytes.length,contentType:MODEL_TYPE}});
   return reply({status:'SUCCEEDED',modelUrl:`/api/vendor-media/${id}`});
  }
  if(['FAILED','CANCELED'].includes(result.status)){
   job.status='FAILED';job.error='Meshy could not generate this model. Try clearer photos or upload a GLB.';
   const bytes=Buffer.from(JSON.stringify(job));await db.vendorStorefrontMedia.update({where:{id},data:{data:bytes,size:bytes.length}});
  }
  return reply({status:job.status==='FAILED'?'FAILED':result.status,progress:Math.min(100,Math.max(0,Number(result.progress)||0)),error:job.error});
 }catch(error){return reply({error:error instanceof Error?error.message:'Could not check the model. Try again.'},502);}
}
export async function POST(request:Request,context:Context){
 const a=await access(request,context);if(a.response)return a.response;
 if(Number(request.headers.get('content-length'))>4400000)return reply({error:'Upload under 4 MB total.'},413);
 let form:FormData;try{form=await request.formData();}catch{return reply({error:'Choose a file to upload.'},400);}
 const file=form.get('model');
 if(file instanceof File){
  try{if(file.size>MAX_MODEL_BYTES)throw new Error('Choose a GLB under 4 MB.');const bytes=Buffer.from(await file.arrayBuffer());validateGlb(bytes);const row=await db.vendorStorefrontMedia.create({data:{vendorProfileId:a.business.id,uploadedById:a.userId,contentType:MODEL_TYPE,data:bytes,size:bytes.length},select:{id:true}});return reply({modelUrl:`/api/vendor-media/${row.id}`,status:'SUCCEEDED'});}catch(error){return reply({error:error instanceof Error?error.message:'Could not upload the model.'},400);}
 }
 if(!process.env.MESHY_API_KEY)return reply({error:'Photo-to-3D is not configured. Upload a GLB instead.'},503);
 const requestId=form.get('requestId');if(typeof requestId!=='string'||!/^model-[a-f0-9-]{36}$/.test(requestId))return reply({error:'Invalid generation request.'},400);
 const existing=await db.vendorStorefrontMedia.findFirst({where:{id:requestId,vendorProfileId:a.business.id},select:{id:true}});if(existing)return reply({job:existing.id});
 const files=form.getAll('photos');if(!files.length||files.length>4||files.some(f=>!(f instanceof File))||files.reduce((n,f)=>n+(f as File).size,0)>3*1024*1024)return reply({error:'Choose 1–4 photos of the same product, under 3 MB total.'},400);
 let images:string[];
 try {images=await Promise.all((files as File[]).map(async f=>`data:${f.type};base64,${(await readVerifiedImageFile(f,{allowedTypes:new Set(['image/png','image/jpeg','image/webp']),maxBytes:3*1024*1024})).toString('base64')}`));}catch{return reply({error:'Use valid PNG, JPG, or WebP photos.'},400);}
 const job:Job={endpoint:images.length===1?'image-to-3d':'multi-image-to-3d',status:'SUBMITTING'};
 // Reserve before contacting Meshy. Serializable quota prevents concurrent paid requests.
 try{await db.$transaction(async tx=>{
  const count=await tx.vendorStorefrontMedia.count({where:{id:{startsWith:'model-'},createdAt:{gte:new Date(Date.now()-86400000)}}});
  if(count>=3)throw new Error('The daily beta generation limit has been reached. Upload a GLB or try tomorrow.');
  const bytes=Buffer.from(JSON.stringify(job));await tx.vendorStorefrontMedia.create({data:{id:requestId,vendorProfileId:a.business.id,uploadedById:a.userId,contentType:MODEL_JOB_TYPE,data:bytes,size:bytes.length}});
 },{isolationLevel:'Serializable'});}catch{return reply({error:'Generation is already pending or the daily beta limit is reached. Reopen the studio to resume.'},429);}
 try{
  const result=await meshFetch(job.endpoint,{...(images.length===1?{image_url:images[0]}:{image_urls:images}),ai_model:'meshy-7.1',should_texture:true,texture_resolution:'2k',should_remesh:true,target_polycount:10000,target_formats:['glb']});
  if(typeof result.result!=='string')throw new Error('Meshy did not return a task ID.');
  job.task=result.result;job.status='PENDING';
 }catch{job.status='UNKNOWN';job.error='Submission could not be confirmed. Check Meshy Request Logs before generating again; credits may have been used.';}
 const bytes=Buffer.from(JSON.stringify(job));await db.vendorStorefrontMedia.update({where:{id:requestId},data:{data:bytes,size:bytes.length}});
 return reply({job:requestId,status:job.status,error:job.error});
}
