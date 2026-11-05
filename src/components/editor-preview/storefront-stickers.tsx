"use client";
import {createContext,useContext,useEffect,useRef,useState,type CSSProperties,type ReactNode} from "react";
import {Trash2} from "lucide-react";
import type {StorefrontTemplate} from "@/lib/editor-preview/storefront-template-library";
import {STICKER_KINDS,STICKER_LABELS,stickerScale,type StickerKind,type StorefrontSticker} from "@/lib/storefront-stickers";
import {TemplateIllustration} from "./template-illustration";
type Editor={template:StorefrontTemplate|null;change:(value:StorefrontTemplate)=>void;selected:string|null;select:(id:string|null)=>void};
const Context=createContext<Editor|null>(null);
export function StickerEditor({template,onChange,children}:{template:StorefrontTemplate|null;onChange:(value:StorefrontTemplate)=>void;children:ReactNode}) {
 const [selected,select]=useState<string|null>(null);
 useEffect(()=>{const outside=(event:PointerEvent)=>{if(!(event.target as Element).closest('[data-sticker]'))select(null);};const selection=(event:Event)=>{if((event as CustomEvent).detail?.kind!=='sticker')select(null);};document.addEventListener('pointerdown',outside,true);window.addEventListener('storefront-selection',selection);return()=>{document.removeEventListener('pointerdown',outside,true);window.removeEventListener('storefront-selection',selection);};},[]);
 return <Context.Provider value={{template,change:onChange,selected,select}}>{children}</Context.Provider>;
}
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
function StickerFrame({id,kind,style,className='',legacy=false}:{id:string;kind:StickerKind;style:CSSProperties;className?:string;legacy?:boolean}) {
 const editor=useContext(Context),root=useRef<HTMLSpanElement>(null);
 const gesture=useRef<{x:number;y:number;width:number;height:number;sx:number;sy:number;size:number;left:number;top:number;surfaceWidth:number;surfaceHeight:number;resize:boolean}|null>(null);
 const template=editor?.template,selected=editor?.selected===id;
 function patch(value:Partial<StorefrontSticker> & {x?:number;y?:number;size?:number}) {
  if(!editor||!template)return;
  if(legacy)editor.change({...template,...(value.size!==undefined?{illustrationSize:clamp(value.size,24,480)}:{}),...(value.x!==undefined?{illustrationX:clamp(value.x,-1000,1000)}:{}),...(value.y!==undefined?{illustrationY:clamp(value.y,-1000,3000)}:{})});
  else editor.change({...template,stickers:template.stickers?.map(item=>item.id===id?{...item,...value}:item)});
 }
 function remove(){if(!editor||!template)return;editor.change(legacy?{...template,illustrationHidden:true}:{...template,stickers:template.stickers?.filter(item=>item.id!==id)});editor.select(null);}
 function begin(event:React.PointerEvent<HTMLElement>,resize=false,sx=0,sy=0){
  if(!editor||!template||!root.current)return;event.preventDefault();event.stopPropagation();editor.select(id);window.dispatchEvent(new CustomEvent('storefront-selection',{detail:{kind:'sticker',id}}));
  const rect=root.current.getBoundingClientRect(),surface=root.current.closest('[data-sticker-surface]')?.getBoundingClientRect()??rect,item=template.stickers?.find(item=>item.id===id);
  gesture.current={x:event.clientX,y:event.clientY,width:rect.width,height:rect.height,sx,sy,size:legacy?(template.illustrationSize??rect.width):(item?.size??15),left:legacy?(template.illustrationX??0):(item?.x??35),top:legacy?(template.illustrationY??0):(item?.y??5),surfaceWidth:surface.width,surfaceHeight:surface.height,resize};event.currentTarget.setPointerCapture(event.pointerId);
 }
 function move(event:React.PointerEvent<HTMLElement>){const start=gesture.current;if(!start||!event.currentTarget.hasPointerCapture(event.pointerId))return;const dx=event.clientX-start.x,dy=event.clientY-start.y;if(start.resize){patch({size:clamp(start.size*stickerScale(start.width,start.height,dx,dy,start.sx,start.sy),legacy?24:3,legacy?480:50)});}else patch({x:legacy?start.left+dx:clamp(start.left+dx/start.surfaceWidth*100,0,100-(template?.stickers?.find(item=>item.id===id)?.size??15)),y:legacy?start.top+dy:clamp(start.top+dy/start.surfaceHeight*100,0,95)});}
 const pointer={onPointerMove:move,onPointerUp:()=>{gesture.current=null;},onPointerCancel:()=>{gesture.current=null;}};
 return <span ref={root} data-sticker={id} className={className} style={{display:'inline-block',position:'relative',verticalAlign:'middle',pointerEvents:editor?undefined:'none',...style,...(editor?{cursor:'move',touchAction:'none'}:{}),...(selected?{zIndex:35}:{})}} role={editor?'button':undefined} aria-label={editor?`Edit ${STICKER_LABELS[kind]} sticker`:undefined} tabIndex={editor?0:undefined} onPointerDown={event=>begin(event)} {...pointer} onClick={event=>{if(editor){event.stopPropagation();editor.select(id);}}} onKeyDown={event=>{if(!editor)return;if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();remove();}if(event.key==='Enter'||event.key===' '){event.preventDefault();editor.select(id);}if(event.key==='Escape')editor.select(null);}}>
  <TemplateIllustration kind={kind} className="h-full w-full"/>
  {selected&&<><span aria-hidden="true" className="pointer-events-none absolute inset-0 border-2 border-[#d86b93]"/>{([[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]] as const).map(([sx,sy])=><button type="button" key={`${sx}:${sy}`} aria-label={`Resize ${STICKER_LABELS[kind]} sticker ${sx},${sy}`} style={{position:'absolute',left:`${(sx+1)*50}%`,top:`${(sy+1)*50}%`,transform:'translate(-50%,-50%)',width:sx===0?24:sy===0?10:18,height:sy===0?24:sx===0?10:18,borderRadius:sx&&sy?'50%':5,border:sx&&sy?'2px solid #d86b93':'1px dashed #b5a7ad',background:'white',touchAction:'none',cursor:sx===0?'ns-resize':sy===0?'ew-resize':sx===sy?'nwse-resize':'nesw-resize'}} onPointerDown={event=>begin(event,true,sx,sy)} {...pointer} onKeyDown={event=>{if(event.key==='ArrowRight'||event.key==='ArrowUp'||event.key==='ArrowLeft'||event.key==='ArrowDown'){event.preventDefault();event.stopPropagation();const amount=event.key==='ArrowRight'||event.key==='ArrowUp'?1.05:.95;const item=template?.stickers?.find(item=>item.id===id);patch({size:(legacy?(template?.illustrationSize??80):(item?.size??15))*amount});}}}/>)}<button type="button" aria-label="Delete sticker" className="absolute -top-10 left-1/2 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full border bg-white text-stone-700 shadow" onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();remove();}}><Trash2 size={16}/></button></>}
 </span>;
}
export function TemplateSticker({template,kind,className}:{template?:StorefrontTemplate;kind:StickerKind;className?:string}) {
 const editor=useContext(Context),value=editor?.template??template;
 if(value?.illustrationHidden)return null;
 return <StickerFrame id="template-illustration" kind={kind} legacy className={className} style={{width:value?.illustrationSize??(className?.includes('reference-title-art')?60:80),height:value?.illustrationSize??(className?.includes('reference-title-art')?60:80),transform:`translate(${value?.illustrationX??0}px,${value?.illustrationY??0}px)`}}/>;
}
export function StickerLayer({template}:{template?:StorefrontTemplate|null}) {
 return <>{template?.stickers?.map(item=><StickerFrame key={item.id} id={item.id} kind={item.kind} style={{position:'absolute',left:`${item.x}%`,top:`${item.y}%`,width:`${item.size}%`,aspectRatio:1,zIndex:20}}/>)}</>;
}
export function StickersPanel({template,onChange}:{template:StorefrontTemplate;onChange:(value:StorefrontTemplate)=>void}) {
 return <section className="rounded-2xl border bg-[#fffaf8] p-4" aria-label="Sticker library"><h3 className="font-semibold">Stickers</h3><p className="my-3 text-xs text-muted-foreground">Add a sticker, then drag it on your page. Use its corner circles to resize, or the trash button to delete.</p><div className="grid grid-cols-3 gap-3">{STICKER_KINDS.map(kind=><button type="button" key={kind} disabled={(template.stickers?.length??0)>=30} aria-label={`Add ${STICKER_LABELS[kind]} sticker`} className="grid justify-items-center gap-1 rounded-xl border bg-white p-2 text-xs" onClick={()=>onChange({...template,stickers:[...(template.stickers??[]),{id:crypto.randomUUID(),kind,x:35,y:5,size:15}]})}><TemplateIllustration kind={kind} className="h-14 w-14"/>{STICKER_LABELS[kind]}</button>)}</div>{template.illustrationHidden&&<button type="button" className="mt-4 text-xs underline" onClick={()=>onChange({...template,illustrationHidden:false})}>Restore template sticker</button>}</section>;
}
