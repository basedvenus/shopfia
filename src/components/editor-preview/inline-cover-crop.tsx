"use client";
import {useCallback,useEffect,useId,useRef,useState} from "react";
import {Trash2} from "lucide-react";
import {createPortal} from "react-dom";
import {CroppedImage} from "@/components/ui/cropped-image";
import {normalizeImageCrop,cropImageRect,fitImageZoom,resizeImageFrame,MIN_IMAGE_ZOOM,type ImageCrop} from "@/lib/image-crop";

/** Adjust the original image in the actual storefront frame, without navigating away. */
export function InlineCoverCrop({src,alt,crop,onChange,onReplace,onRemove}:{src:string;alt:string;crop:ImageCrop;onChange:(value:ImageCrop)=>void;onReplace:()=>void;onRemove?:()=>void}){
 const maskId=useId();
 const [bounds,setBounds]=useState<{left:number;top:number;width:number;height:number;imageWidth:number;imageHeight:number}|null>(null);
 const host=useRef<HTMLDivElement|null>(null);
 const [portalRoot,setPortalRoot]=useState<Element|null>(null);
 const attachHost=useCallback((element:HTMLDivElement|null)=>{host.current=element;setPortalRoot(element?.closest("dialog")??document.body);},[]);
 const [editing,setEditing]=useState(false);
 const [selected,setSelected]=useState(false);
 const [draft,setDraft]=useState(crop);
 const latest=useRef(draft);useEffect(()=>{latest.current=draft;},[draft]);
 const resize=useRef<{x:number;y:number;width:number;height:number;left:number;top:number;zoom:number;sx:number;sy:number;frameWidth:number}|null>(null);
 const drag=useRef<{x:number;y:number;crop:ImageCrop;overflowX:number;overflowY:number}|null>(null);
 useEffect(()=>{
  if(!editing&&!selected)return;
  const measure=()=>{const el=host.current,img=el?.querySelector('img');if(!el||!img?.naturalWidth)return;const r=el.getBoundingClientRect();setBounds(previous=>previous&&previous.left===r.left&&previous.top===r.top&&previous.width===r.width&&previous.height===r.height?previous:{left:r.left,top:r.top,width:r.width,height:r.height,imageWidth:img.naturalWidth,imageHeight:img.naturalHeight});};
  let animationFrame=0;const track=()=>{measure();animationFrame=requestAnimationFrame(track);};track();const observer=new ResizeObserver(measure);if(host.current)observer.observe(host.current);
  window.addEventListener('scroll',measure,true);window.addEventListener('resize',measure);
  return ()=>{cancelAnimationFrame(animationFrame);observer.disconnect();window.removeEventListener('scroll',measure,true);window.removeEventListener('resize',measure);};
 },[editing,selected]);
 useEffect(()=>{
  const selection=(event:Event)=>setSelected((event as CustomEvent).detail?.id===maskId);
  const outside=(event:PointerEvent)=>{const target=event.target as Element;if(!host.current?.contains(target)&&!target.closest(`[data-crop-owner="${CSS.escape(maskId)}"]`))setSelected(false);};
  window.addEventListener("storefront-selection",selection);document.addEventListener("pointerdown",outside,true);
  return()=>{window.removeEventListener("storefront-selection",selection);document.removeEventListener("pointerdown",outside,true);};
 },[maskId]);
 useEffect(()=>{
  if(!selected||!onRemove)return;
  const remove=(event:KeyboardEvent)=>{
   const target=event.target as Element|null;
   if(event.defaultPrevented||event.metaKey||event.ctrlKey||event.altKey||target?.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]'))return;
   if(event.key!=="Delete"&&event.key!=="Backspace")return;
   event.preventDefault();setSelected(false);setEditing(false);onRemove();
  };
  document.addEventListener("keydown",remove);return()=>document.removeEventListener("keydown",remove);
 },[selected,onRemove]);
 const imageRect=bounds?cropImageRect(bounds.imageWidth,bounds.imageHeight,bounds.width,bounds.height,editing?draft:crop):null;
 function start(){window.dispatchEvent(new CustomEvent("storefront-selection",{detail:{kind:"photo",id:maskId}}));const r=host.current?.getBoundingClientRect();setDraft({...normalizeImageCrop(crop),zoom:normalizeImageCrop(crop).zoom,aspectRatio:r&&r.height?r.width/r.height:undefined});setEditing(true);}
 function finish(){onChange(draft);setEditing(false);}
 useEffect(()=>{
  if(!editing)return;
  const commit=(event:PointerEvent)=>{const target=event.target as Element;if(host.current?.contains(target)||target.closest(`[data-crop-owner="${CSS.escape(maskId)}"]`))return;onChange(latest.current);setEditing(false);};
  const selection=(event:Event)=>{if((event as CustomEvent).detail?.id!==maskId){onChange(latest.current);setEditing(false);}};
  window.addEventListener("storefront-selection",selection);
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){setEditing(false);}else if(event.key==='Enter'){onChange(latest.current);setEditing(false);}};
  document.addEventListener('pointerdown',commit,true);document.addEventListener('keydown',key);
  return()=>{window.removeEventListener('storefront-selection',selection);document.removeEventListener('pointerdown',commit,true);document.removeEventListener('keydown',key);};
 },[editing,onChange,maskId]);
 return <div ref={attachHost} data-inline-photo onPointerDownCapture={()=>window.dispatchEvent(new CustomEvent("storefront-selection",{detail:{kind:"photo",id:maskId}}))} className="absolute inset-0" onDoubleClick={e=>{e.stopPropagation();if(!editing)start();}}>
  {selected&&bounds&&imageRect&&createPortal(<><div aria-hidden="true" data-frame-selection-outline style={{position:'fixed',left:bounds.left,top:bounds.top,width:bounds.width,height:bounds.height,border:'2px solid #d86b93',boxSizing:'border-box',pointerEvents:'none',zIndex:46}}/>{editing&&<svg aria-hidden="true" data-crop-overflow-preview="true" style={{position:'fixed',inset:0,width:'100vw',height:'100vh',pointerEvents:'none',zIndex:45}}>
   <defs><mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%" style={{maskType:"luminance"}}><rect width="100%" height="100%" fill="white"/><rect x={bounds.left} y={bounds.top} width={bounds.width} height={bounds.height} fill="black"/></mask></defs>
   <g mask={`url(#${maskId})`} opacity={.3}>
    <image href={src} x={bounds.left+imageRect.x} y={bounds.top+imageRect.y} width={imageRect.width} height={imageRect.height} preserveAspectRatio="none"/>
   </g>
   <rect x={bounds.left+imageRect.x} y={bounds.top+imageRect.y} width={imageRect.width} height={imageRect.height} fill="none" stroke="#d86b93" strokeWidth={2}/>
  </svg>}
  {([[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]] as const).map(([sx,sy])=><button key={`${sx}:${sy}`} type="button" data-crop-handle data-crop-owner={maskId} aria-label={`Resize image ${sy<0?'top':sy>0?'bottom':''} ${sx<0?'left':sx>0?'right':''}${sx&&sy?' corner':''}`} style={{position:'fixed',left:Math.max(12,Math.min(window.innerWidth-12,bounds.left+(sx+1)*bounds.width/2)),top:Math.max(12,Math.min(window.innerHeight-12,bounds.top+(sy+1)*bounds.height/2)),transform:'translate(-50%,-50%)',width:sx===0?28:sy===0?10:20,height:sy===0?28:sx===0?10:20,borderRadius:sx&&sy?'50%':6,border:sx&&sy?'2px solid #d86b93':'1px dashed #b5a7ad',background:'white',boxShadow:'0 1px 4px #0002',zIndex:46,cursor:sx===0?'ns-resize':sy===0?'ew-resize':sx===sy?'nwse-resize':'nesw-resize',touchAction:'none'}}
   onPointerDown={e=>{e.preventDefault();e.stopPropagation();resize.current={x:e.clientX,y:e.clientY,width:bounds.width,height:bounds.height,left:imageRect.x,top:imageRect.y,zoom:draft.zoom,sx,sy,frameWidth:crop.frameWidth??100};e.currentTarget.setPointerCapture(e.pointerId);}}
   onPointerMove={e=>{const d=resize.current;if(!d||!e.currentTarget.hasPointerCapture(e.pointerId))return;{const next={...(editing?latest.current:crop),...resizeImageFrame(d.width,d.height,d.frameWidth,e.clientX-d.x,e.clientY-d.y,d.sx,d.sy)};latest.current=next;setDraft(next);onChange(next);return;}}}
   onPointerUp={()=>{resize.current=null;}} onPointerCancel={()=>{resize.current=null;}}
   onKeyDown={e=>{if(['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'].includes(e.key)){e.preventDefault();const dx=e.key==='ArrowRight'?10:e.key==='ArrowLeft'?-10:0,dy=e.key==='ArrowDown'?10:e.key==='ArrowUp'?-10:0;const next={...(editing?latest.current:crop),...resizeImageFrame(bounds.width,bounds.height,crop.frameWidth??100,dx,dy,sx,sy)};latest.current=next;setDraft(next);onChange(next);}}}
  />)}
  </>,portalRoot??document.body)}
  {editing&&bounds&&imageRect?<div className="absolute inset-0 overflow-hidden"><img src={src} alt={alt} draggable={false} style={{position:'absolute',maxWidth:'none',width:`${imageRect.width/bounds.width*100}%`,height:`${imageRect.height/bounds.height*100}%`,left:`${imageRect.x/bounds.width*100}%`,top:`${imageRect.y/bounds.height*100}%`,filter:`brightness(${draft.brightness??1}) saturate(${draft.saturation??1})`}}/></div>:<CroppedImage src={src} alt={alt} crop={editing?draft:crop} loading="eager" className="h-full w-full object-cover"/>}
  <button type="button" aria-label={editing?'Drag image to reposition':'Reposition image'} title="Edit image" className="absolute inset-0 z-10" style={{cursor:editing?'move':'pointer',touchAction:editing?'none':undefined,outline:editing||selected?'2px solid #d86b93':undefined,outlineOffset:-2}} onClick={e=>{e.stopPropagation();}} onKeyDown={e=>{if(!editing&&(e.key==='Enter'||e.key===' ')){e.preventDefault();start();}if(editing&&e.key==='Escape'){setEditing(false);}if(editing&&e.key==='Enter')finish();}}
   onPointerDown={e=>{if(!editing)return;e.stopPropagation();const frame=host.current!,r=frame.getBoundingClientRect(),img=frame.querySelector('img');if(!img?.naturalWidth)return;const rect=cropImageRect(img.naturalWidth,img.naturalHeight,r.width,r.height,draft);drag.current={x:e.clientX,y:e.clientY,crop:draft,overflowX:r.width-rect.width,overflowY:r.height-rect.height};e.currentTarget.setPointerCapture(e.pointerId);}}
   onPointerMove={e=>{const d=drag.current;if(!d||!e.currentTarget.hasPointerCapture(e.pointerId))return;const clamp=(v:number)=>Math.max(0,Math.min(100,v));setDraft({...d.crop,x:Math.abs(d.overflowX)>1?clamp(d.crop.x+(e.clientX-d.x)/d.overflowX*100):d.crop.x,y:Math.abs(d.overflowY)>1?clamp(d.crop.y+(e.clientY-d.y)/d.overflowY*100):d.crop.y});}}
   onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}/>
  {selected&&bounds&&onRemove&&createPortal(<div data-crop-owner={maskId} role="toolbar" aria-label="Image actions" style={{position:'fixed',left:Math.max(8,Math.min(window.innerWidth-42,bounds.left+bounds.width/2-18)),top:Math.max(8,bounds.top-42),zIndex:46}} className="flex items-center rounded-full border border-stone-200 bg-white p-1 shadow-md"><button type="button" aria-label="Delete image" title="Delete image" className="grid h-7 w-7 place-items-center rounded-full text-stone-700 hover:bg-pink-50" onClick={e=>{e.stopPropagation();setSelected(false);onRemove();}}><Trash2 size={16}/></button><button type="button" className="rounded-full px-3 py-1 text-xs" onClick={event=>{event.stopPropagation();onReplace();}}>Replace image</button><button type="button" className="whitespace-nowrap rounded-full px-3 py-1 text-xs" onClick={event=>{event.stopPropagation();const fitted={...normalizeImageCrop(crop),x:50,y:50,zoom:Math.max(MIN_IMAGE_ZOOM,fitImageZoom(bounds.imageWidth,bounds.imageHeight,bounds.width,bounds.height)),aspectRatio:bounds.width/bounds.height};latest.current=fitted;setDraft(fitted);onChange(fitted);setEditing(false);}}>Fit whole image</button></div>,portalRoot??document.body)}
 </div>;
}
