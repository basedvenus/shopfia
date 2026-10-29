"use client";
import { useEffect, useRef, useState } from 'react';
function studioMessage(message:string) {
 if (/Submission could not be confirmed|check Meshy before/i.test(message)) return 'We could not confirm this request. Contact ShopFia support before starting another model.';
 if (/Meshy|API|credits|beta|not configured/i.test(message)) return '3D creation is temporarily unavailable. Try again later or upload a 3D model.';
 return message;
}
export function ProductModelUpload({endpoint,modelUrl,onModel}:{endpoint?:string;modelUrl:string;onModel:(url:string)=>void}) {
 const [files,setFiles]=useState<File[]>([]),[job,setJob]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(''),[configured,setConfigured]=useState(false),[retry,setRetry]=useState(0);
 const requestId=useRef('');
 useEffect(()=>{if(!endpoint)return;let active=true;fetch(endpoint).then(r=>r.json()).then(data=>{if(!active)return;setConfigured(data.configured);if(data.connectionError)setError(studioMessage(data.connectionError));if(!modelUrl && data.recent){if(data.recent.modelUrl)onModel(data.recent.modelUrl);else setJob(data.recent.id);}}).catch(()=>{if(active)setError('Could not connect to 3D Studio. Reopen it to retry.');});return()=>{active=false;};},[endpoint]); // Restore a server-owned job after closing the studio.
 useEffect(()=>{
  if(!job||!endpoint)return;let active=true,timer:ReturnType<typeof setTimeout>;
  async function check(){try{const response=await fetch(`${endpoint}?job=${encodeURIComponent(job)}`);const result=await response.json();if(!active)return;
   if(!response.ok)throw new Error(result.error || 'Could not check generation.');
   if(result.modelUrl){onModel(result.modelUrl);setStatus('Model ready. Inspect all sides before applying.');setBusy(false);setJob('');return;}
   if(['FAILED','UNKNOWN'].includes(result.status)){setError(studioMessage(result.error || "Could not create this model. Try a clearer photo."));setBusy(false);return;}
   setBusy(true);setStatus(result.status==='SUBMITTING'?'Submitting your photos…':`Generating your 3D model${typeof result.progress==='number'?` · ${result.progress}%`:''}…`);timer=setTimeout(check,5000);
  }catch(e){if(active){setError(e instanceof Error?studioMessage(e.message):'Could not check generation.');setBusy(false);}}}
  check();return()=>{active=false;clearTimeout(timer);};
 },[job,endpoint,retry]);
 async function submit(model?:File){
  setError('');
  if(!endpoint){if(model && model.name.toLowerCase().endsWith('.glb') && model.size<=4*1024*1024){onModel(URL.createObjectURL(model));setStatus('Local preview model. Upload it in your live editor to save it.');}else setError('Choose a GLB under 4 MB. Photo generation is available in your live editor.');return;}
  setBusy(true);setError('');const form=new FormData();
  if(model){if(!model.name.toLowerCase().endsWith('.glb')||model.size>4*1024*1024){setError('Choose a self-contained GLB under 4 MB.');setBusy(false);return;}form.set('model',model);setStatus('Uploading model…');}
  else{if(!files.length||files.length>4||files.reduce((sum,file)=>sum+file.size,0)>3*1024*1024){setError('Choose 1–4 photos under 3 MB total.');setBusy(false);return;}requestId.current ||= `model-${crypto.randomUUID()}`;form.set('requestId',requestId.current);files.forEach(file=>form.append('photos',file));setStatus('Preparing your photos…');}
  try{const response=await fetch(endpoint,{method:'POST',body:form});const data=await response.json();if(!response.ok)throw new Error(data.error || 'Upload failed.');if(data.modelUrl){onModel(data.modelUrl);setStatus('Model uploaded. Inspect all sides before applying.');setBusy(false);}else{setJob(data.job);setRetry(n=>n+1);}}
  catch(e){setError(e instanceof Error?studioMessage(e.message):'Could not submit. Try again with the same photos.');setBusy(false);}
 }
 return <div className="mt-5 space-y-4">
 <details open={!modelUrl} className="rounded-xl border p-3"><summary className="cursor-pointer text-sm font-medium">Create from photos</summary>
 <p className="my-3 text-xs leading-5">Add 1–4 clear photos of your product, front view first.</p>
 <label className="block cursor-pointer rounded-xl border border-dashed p-4 text-center text-sm">↑ Choose product photos<input disabled={busy} type="file" multiple accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={e=>{setFiles(Array.from(e.target.files||[]));requestId.current='';setError('');}}/></label>
 {files.length>0&&<p className="mt-2 break-words text-xs">{files.length} photo{files.length===1?'':'s'} selected</p>}
 <p className="my-3 text-xs text-muted-foreground">PNG, JPG or WebP · up to 3 MB total</p>
 <button type="button" disabled={busy||!configured||!files.length} onClick={()=>submit()} className="rounded-full bg-[#493e46] px-4 py-2 text-sm text-white disabled:opacity-40">Generate 3D model</button>
 {!configured&&<p className="mt-2 text-xs">{endpoint ? "Photo creation is temporarily unavailable." : "Open your live editor to create from photos."}</p>}
 </details>
 <label className="block cursor-pointer rounded-xl border border-dashed p-4 text-center text-sm">↑ Upload a 3D model<input disabled={busy} type="file" accept=".glb,model/gltf-binary" className="sr-only" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)submit(file);}}/><span className="mt-1 block text-xs text-muted-foreground">GLB file · up to 4 MB</span></label>
 {status&&<p role="status" className="text-sm">{status}</p>}{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
 {job&&!busy&&<button type="button" className="text-sm underline" onClick={()=>{setError('');setRetry(n=>n+1);}}>Check existing generation</button>}
 {busy&&<p className="text-xs">You can close the studio. Reopen it to resume checking this model.</p>}
 </div>;
}
