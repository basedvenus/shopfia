"use client";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {Plus,GripVertical,X} from "lucide-react";
import {DEFAULT_IMAGE_CROP,normalizeImageCrop,type ImageCrop} from "@/lib/image-crop";
import {ServicePhotoFrame} from "./service-photo-frame";
import {CroppedImage} from "@/components/ui/cropped-image";
import {ImageCropEditor} from "@/components/ui/image-crop-editor";

type Photo={id:string;url:string;crop:ImageCrop};
export function ServicePhotoGrid({photos=[],crops=[],businessId,previewOnly=false}:{photos?:string[];crops?:unknown[];businessId?:string;previewOnly?:boolean}){
 const [items,setItems]=useState<Photo[]>(()=>photos.filter(Boolean).map((url,i)=>({id:`saved-${i}`,url,crop:normalizeImageCrop(crops[i])})));
 const [uploading,setUploading]=useState(false),[error,setError]=useState(""),[selected,setSelected]=useState<string|null>(null),[adjusting,setAdjusting]=useState(false);
 const root=useRef<HTMLElement>(null);
 useEffect(()=>{const form=root.current?.closest("form");const guard=(event:Event)=>{if(uploading){event.preventDefault();event.stopImmediatePropagation();setError("Wait for photo uploads to finish before saving.");}};form?.addEventListener("submit",guard,true);return()=>form?.removeEventListener("submit",guard,true);},[uploading]);
 const input=useRef<HTMLInputElement>(null),drag=useRef<string|null>(null);
 const current=items.find(p=>p.id===selected);
 function move(id:string,to:number){setItems(previous=>{const next=[...previous],from=next.findIndex(p=>p.id===id);if(from<0||to<0||to>=next.length)return previous;const [photo]=next.splice(from,1);next.splice(to,0,photo);return next;});}
 async function add(files:FileList|null){if(!files||uploading)return;setUploading(true);setError("");try{
  for(const file of Array.from(files)){
   if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Choose JPG, PNG, or WebP photos.");
   if(file.size>10*1024*1024)throw new Error("Each photo must be smaller than 10 MB.");
   const prepared=await prepare(file);let url:string;
   if(businessId&&!previewOnly){const body=new FormData();body.set("file",prepared);const response=await fetch(`/api/vendor/business/${businessId}/media`,{method:"POST",body,credentials:"same-origin"});const result=await response.json();if(!response.ok||!result.url)throw new Error(result.error??"Photo upload failed. Please try again.");url=result.url;}
   else{url=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Could not read that photo."));reader.readAsDataURL(prepared);});}
   setItems(previous=>[...previous,{id:crypto.randomUUID(),url,crop:DEFAULT_IMAGE_CROP}]);
  }
 }catch(e){setError(e instanceof Error?e.message:"Could not upload those photos.");}finally{setUploading(false);if(input.current)input.current.value="";}}
 return <section ref={root} className="space-y-3" aria-label="Service photos">
  <div><h2 className="text-xl font-semibold">Photos</h2><p className="mt-1 text-sm text-muted-foreground">Drag photos to reorder. The first photo is your cover. Use Adjust crop to choose exactly what customers see. Tap a photo to enlarge or remove it.</p></div>
  {items.map(photo=><span key={`fields-${photo.id}`}><input type="hidden" name="photos" value={photo.url}/><input type="hidden" name="photosCrop" value={JSON.stringify(photo.crop)}/></span>)}
  <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="Upload service photos" className="sr-only" disabled={uploading} onChange={event=>void add(event.target.files)}/>
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(event.dataTransfer.files.length)void add(event.dataTransfer.files);}}>
   {items.map((photo,index)=><div key={photo.id} data-service-photo={photo.id} draggable onDragStart={event=>{drag.current=photo.id;event.dataTransfer.setData("text/plain",photo.id);}} onDragEnd={()=>{drag.current=null;}} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();event.stopPropagation();if(drag.current)move(drag.current,index);drag.current=null;}} className={`group relative overflow-hidden rounded-2xl bg-white ${index===0?"ring-2 ring-[#e8aaa9] ring-offset-2":""}`}>
    <button type="button" aria-label={`Edit service photo ${index+1}${index===0?", cover":""}`} onClick={()=>setSelected(photo.id)} className="relative block aspect-square w-full"><ServicePhotoFrame src={photo.url} crop={photo.crop}/></button>
    <button type="button" aria-label={`Adjust crop for service photo ${index+1}`} onClick={()=>{setSelected(photo.id);setAdjusting(true);}} className="absolute bottom-2 right-2 rounded-full border bg-white/95 px-3 py-2 text-xs">Adjust crop</button>
    {index===0&&<span className="pointer-events-none absolute right-2 top-2 rounded-full bg-white/95 px-2 py-1 text-xs font-semibold">Cover</span>}
    <button type="button" aria-label={`Move service photo ${index+1}`} title="Drag to reorder; arrow keys move photo" className="absolute bottom-2 left-2 grid h-9 w-9 touch-none place-items-center rounded-full border bg-white/95" onKeyDown={event=>{if(event.key==="ArrowLeft"||event.key==="ArrowUp"){event.preventDefault();move(photo.id,index-1);}if(event.key==="ArrowRight"||event.key==="ArrowDown"){event.preventDefault();move(photo.id,index+1);}}} onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);drag.current=photo.id;}} onPointerUp={event=>{const target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>("[data-service-photo]");const to=items.findIndex(p=>p.id===target?.dataset.servicePhoto);if(drag.current&&to>=0)move(drag.current,to);drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}><GripVertical className="h-4 w-4"/></button>
   </div>)}
   <button type="button" disabled={uploading} onClick={()=>input.current?.click()} className="grid aspect-square place-content-center gap-2 rounded-2xl border-2 border-dashed border-[#e8aaa9]/60 text-[#ca8f91] hover:bg-white/60 disabled:opacity-60"><Plus className="mx-auto h-10 w-10"/><span className="text-sm font-semibold">{uploading?"Uploading…":"Add photos"}</span></button>
  </div>
  {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
  {uploading&&<p role="status" className="text-sm">Adding photos. Wait for uploads to finish before saving.</p>}
  {current&&createPortal(adjusting?<ImageCropEditor imageUrl={current.url} crop={current.crop} aspectLabel="Service photo · square storefront crop" previewClassName="aspect-square" preserveFrame previewAspectRatio={1} allowAdjustments onCancel={()=>setAdjusting(false)} onSave={crop=>{setItems(previous=>previous.map(photo=>photo.id===current.id?{...photo,crop}:photo));setAdjusting(false);}}/>:<PhotoDialog onClose={()=>{setSelected(null);setAdjusting(false);}}><div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-3xl bg-white p-5" onClick={event=>event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Service photo</h3><button type="button" aria-label="Close photo" onClick={()=>{setSelected(null);setAdjusting(false);}} className="grid h-10 w-10 place-items-center rounded-full border"><X className="h-5 w-5"/></button></div><><CroppedImage src={current.url} crop={current.crop} frameFit="contain" className="h-[45vh] w-full object-contain"/><div className="mt-4 flex flex-wrap gap-2"><button type="button" className="rounded-full border px-4 py-2 text-sm" onClick={()=>{move(current.id,0);setSelected(null);}}>Make cover</button><button type="button" className="rounded-full border px-4 py-2 text-sm" onClick={()=>setAdjusting(true)}>Adjust image</button><button type="button" className="rounded-full border px-4 py-2 text-sm text-red-700" onClick={()=>{setItems(previous=>previous.filter(p=>p.id!==current.id));setSelected(null);}}>Remove photo</button></div></></div></PhotoDialog>,document.body)}
 </section>;
}
async function prepare(file:File){const url=URL.createObjectURL(file);try{const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("Could not read that photo."));image.src=url;});const scale=Math.min(1,1800/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const context=canvas.getContext("2d");if(!context)throw new Error("Photo processing is unavailable.");context.drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("Could not process that photo.")),"image/webp",.9));return new File([blob],"service-photo.webp",{type:"image/webp"});}finally{URL.revokeObjectURL(url);}}

function PhotoDialog({children,onClose}:{children:React.ReactNode;onClose:()=>void}){const dialog=useRef<HTMLDialogElement>(null);useEffect(()=>{dialog.current?.showModal();},[]);return <dialog ref={dialog} aria-label="Edit service photo" onCancel={event=>{event.preventDefault();onClose();}} className="m-auto max-h-[94vh] w-[min(700px,96vw)] overflow-auto rounded-3xl border-0 bg-transparent p-2 backdrop:bg-black/50">{children}</dialog>;}
