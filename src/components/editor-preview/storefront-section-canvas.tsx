"use client";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {StorefrontSectionSize} from "@/components/vendor/storefront-section-size";
import { GripVertical } from 'lucide-react';
import { placeSection, sectionRows, rowColumns, resizeSectionWidth, type SectionLayout, type SectionPlacement } from '@/lib/storefront-section-layout';
import './storefront-section-layout.css';

type Item = {id:string;label:string;content:ReactNode};
export function StorefrontSectionCanvas({items,order,layout,mobile,onChange}:{items:Item[];order:string[];layout:SectionLayout;mobile:boolean;onChange:(order:string[],layout:SectionLayout)=>void}) {
 const root=useRef<HTMLDivElement>(null);
 const [selected,setSelected]=useState<string|null>(null);
 useEffect(()=>{
  const clear=(event:PointerEvent)=>{const target=event.target as Element;if(!root.current?.contains(target)||target.closest('[data-sticker], [data-inline-photo], [data-crop-handle], .storefront-inline-text, .storefront-inline-field'))setSelected(null);};
  const selection=(event:Event)=>{if((event as CustomEvent).detail?.kind!=="section")setSelected(null);};
  window.addEventListener("storefront-selection",selection);
  document.addEventListener('pointerdown',clear,true);
  return()=>{window.removeEventListener('storefront-selection',selection);document.removeEventListener('pointerdown',clear,true);};
 },[]);
 const drag=useRef<string|null>(null);
 const resize=useRef<{id:string;y:number;height:number}|null>(null);
 const [dragging,setDragging]=useState<string|null>(null);
 const [target,setTarget]=useState<{id:string;placement:SectionPlacement}|null>(null);
 const [height,setHeight]=useState<{id:string;value:number}|null>(null);
 const [widthPreview,setWidthPreview]=useState<SectionLayout|null>(null);
 const visibleLayout=widthPreview??layout;
 const [announcement,setAnnouncement]=useState('');
 const byId=new Map(items.map(item=>[item.id,item]));
 const rows=sectionRows(order.filter(id=>byId.has(id)),layout);
 function destination(x:number,y:number){
  let element=document.elementsFromPoint(x,y).find(el=>el instanceof HTMLElement && el.hasAttribute('data-section-frame') && root.current?.contains(el)) as HTMLElement|undefined;
  if(!element && root.current){
   const candidates=Array.from(root.current.querySelectorAll<HTMLElement>('[data-section-frame]')).filter(frame=>frame.dataset.sectionFrame!==drag.current);
   element=candidates.sort((a,b)=>{const distance=(frame:HTMLElement)=>{const r=frame.getBoundingClientRect();return Math.hypot(Math.max(r.left-x,0,x-r.right),Math.max(r.top-y,0,y-r.bottom));};return distance(a)-distance(b);})[0];
  }
  if(!element || element.dataset.sectionFrame===drag.current)return null;
  const row=element.closest<HTMLElement>('.storefront-section-row');
  if(row?.dataset.paired==='true'&&!row.querySelector(`[data-section-frame="${drag.current}"]`)){
   const bounds=row.getBoundingClientRect();
   return {id:element.dataset.sectionFrame!,placement:(x<bounds.left+bounds.width/2?'left':'right') as SectionPlacement};
  }
  const bounds=element.getBoundingClientRect(), dx=(x-bounds.left)/bounds.width,dy=(y-bounds.top)/bounds.height;
  const placement:SectionPlacement=dy<.2?'above':dy>.8?'below':dx<.25?'left':dx>.75?'right':dy<.5?'above':'below';
  return {id:element.dataset.sectionFrame!,placement};
 }
 function finishMove(x:number,y:number){
  const drop=destination(x,y),source=drag.current;
  if(drop&&source){const next=placeSection(order,layout,source,drop.id,drop.placement);onChange(next.order,next.layout);setAnnouncement(`${byId.get(source)?.label} moved ${drop.placement} ${byId.get(drop.id)?.label}.`);}
  drag.current=null;setDragging(null);setTarget(null);
 }
 return <div ref={root} className="storefront-section-grid" data-mobile={mobile}>
  <span className="sr-only" role="status">{announcement}</span>
  {rows.map(row=><div key={row.join('-')} className="storefront-section-row" data-paired={row.length===2} style={{"--section-columns":rowColumns(row,visibleLayout)} as CSSProperties}>
   {row.map(id=>{const item=byId.get(id)!;return <div key={id} data-section-frame={id} data-selected={selected===id} onPointerDownCapture={event=>{const target=event.target as Element;setSelected(target.closest('[data-sticker], [data-inline-photo], .storefront-inline-text, .storefront-inline-field, input, textarea, a, button:not(.section-move-handle):not(.section-resize-handle):not(.section-width-handle):not(.section-corner-handle)')?null:id);if(!target.closest('[data-sticker], [data-inline-photo], [data-storefront-text], button, input, textarea'))window.dispatchEvent(new CustomEvent('storefront-selection',{detail:{kind:'section',id}}));}} data-dragging={dragging===id} className="storefront-section-frame" style={{'--section-width':`${visibleLayout[id]?.width??100}%`,'--section-offset':`${visibleLayout[id]?.offset??0}%`,'--section-height':`${height?.id===id?height.value:layout[id]?.height??0}px`} as CSSProperties}>
    <div className="section-edit-tools">

     <button type="button" className="section-move-handle" aria-label={`Move ${item.label} section`} title="Drag to arrange. Alt + arrows to move or place beside."
      onClick={event=>event.stopPropagation()}
      onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();drag.current=id;setDragging(id);event.currentTarget.setPointerCapture(event.pointerId);}}
      onPointerMove={event=>{if(drag.current){setTarget(destination(event.clientX,event.clientY));for(let parent=root.current?.parentElement;parent;parent=parent.parentElement){if(/auto|scroll/.test(getComputedStyle(parent).overflowY)&&parent.scrollHeight>parent.clientHeight){const bounds=parent.getBoundingClientRect();if(event.clientY<bounds.top+60)parent.scrollTop-=18;else if(event.clientY>bounds.bottom-60)parent.scrollTop+=18;break;}}}}}
      onPointerUp={event=>{if(drag.current)finishMove(event.clientX,event.clientY);}}
      onPointerCancel={()=>{drag.current=null;setDragging(null);setTarget(null);}}
      onKeyDown={event=>{if(!event.altKey||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const visible=order.filter(key=>byId.has(key));const index=visible.indexOf(id);const other=visible[event.key==='ArrowUp'?index-1:event.key==='ArrowDown'?index+1:index>0?index-1:index+1];if(other){const placement:SectionPlacement=event.key==='ArrowUp'?'above':event.key==='ArrowDown'?'below':event.key==='ArrowLeft'?'left':'right';const next=placeSection(order,layout,id,other,placement);onChange(next.order,next.layout);}}}
     ><GripVertical size={17} aria-hidden="true"/></button>
    </div>
    <StorefrontSectionSize disabled={mobile} responsive height={height?.id===id?height.value:visibleLayout[id]?.height}>{item.content}</StorefrontSectionSize>
    {target?.id===id&&<div className="section-drop-zone" data-placement={target.placement}><span>{target.placement==='left'?'Place left':target.placement==='right'?'Place right':target.placement==='above'?'Place above':'Place below'}{row.length===2 && (target.placement==='left'||target.placement==='right') && <small className="block mt-2">{byId.get(row[target.placement==='left'?1:0])?.label} moves below · 2 per row</small>}</span></div>}
    {(['left','right'] as const).filter(edge=>row.length===1||(row[0]===id?edge==='right':edge==='left')).map(edge=><SectionWidthHandle key={edge} id={id} label={item.label} edge={edge} row={row} layout={layout} onPreview={setWidthPreview} onCommit={next=>{onChange(order,next);setAnnouncement(`${item.label} width updated to ${next[id]?.width} percent.`);}}/>)}
    {row.length===1&&(['top-left','top-right','bottom-left','bottom-right'] as const).map(corner=><SectionWidthHandle key={corner} corner={corner} id={id} label={item.label} edge={corner.endsWith('left')?'left':'right'} row={row} layout={layout} onPreview={setWidthPreview} onCommit={next=>onChange(order,next)}/>)}
    {(['top','bottom'] as const).map(edge=><button key={edge} type="button" data-edge={edge} className="section-resize-handle" aria-label={`Resize ${item.label} section ${edge} height`} title="Drag to adjust height. Up/Down adjusts 20 px."
     onClick={event=>event.stopPropagation()}
     onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();const frame=event.currentTarget.closest<HTMLElement>('[data-section-frame]')!;resize.current={id,y:event.clientY,height:frame.getBoundingClientRect().height};event.currentTarget.setPointerCapture(event.pointerId);}}
     onPointerMove={event=>{if(resize.current){const value=Math.max(120,Math.min(1200,Math.round(resize.current.height+(event.clientY-resize.current.y)*(edge==='top'?-1:1))));setHeight({id,value});}}}
     onPointerUp={event=>{if(resize.current){const value=Math.max(120,Math.min(1200,Math.round(resize.current.height+(event.clientY-resize.current.y)*(edge==='top'?-1:1))));onChange(order,{...layout,[id]:{...layout[id],height:value}});resize.current=null;setHeight(null);setAnnouncement(`${item.label} height updated.`);}}}
     onPointerCancel={()=>{resize.current=null;setHeight(null);}}
     onKeyDown={event=>{if(!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const current=event.currentTarget.closest<HTMLElement>('[data-section-frame]')!.getBoundingClientRect().height;onChange(order,{...layout,[id]:{...layout[id],height:Math.max(120,Math.min(1200,Math.round(current+(event.key==='ArrowUp'?-20:20))))}});}}
    ><span className="resize-grip" aria-hidden="true"/>{height?.id===id&&<span>{height.value}px</span>}</button>)}
   </div>;})}
  </div>)}
 </div>;
}

function SectionWidthHandle({id,label,edge,row,layout,onPreview,onCommit,corner}:{id:string;label:string;edge:'left'|'right';corner?:'top-left'|'top-right'|'bottom-left'|'bottom-right';row:string[];layout:SectionLayout;onPreview:(layout:SectionLayout|null)=>void;onCommit:(layout:SectionLayout)=>void}) {
 const start=useRef<{x:number;y:number;height:number;pixels:number;layout:SectionLayout}|null>(null);
 const [value,setValue]=useState<number|null>(null);
 function nextLayout(x:number,y:number){const active=start.current!;const next=resizeSectionWidth(active.layout,row,id,edge,(x-active.x)/active.pixels*100);if(corner)next[id]={...next[id],height:Math.max(120,Math.min(1200,Math.round(active.height+(y-active.y)*(corner.startsWith('top')?-1:1))))};return next;}
 function clear(){start.current=null;setValue(null);onPreview(null);}
 return <button type="button" className={corner?"section-corner-handle":"section-width-handle"} data-corner={corner} data-edge={edge} aria-label={`Resize ${label} section ${corner??edge} edge`} title={corner?"Drag diagonally to resize width and height.":"Drag left or right to adjust width. Arrow keys adjust 5%."}
  onClick={event=>event.stopPropagation()}
  onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();const element=event.currentTarget.closest<HTMLElement>('.storefront-section-row')!;const pixels=element.getBoundingClientRect().width-(row.length===2?parseFloat(getComputedStyle(element).columnGap)||0:0);start.current={x:event.clientX,y:event.clientY,height:event.currentTarget.closest<HTMLElement>('[data-section-frame]')!.getBoundingClientRect().height,pixels,layout};event.currentTarget.setPointerCapture(event.pointerId);}}
  onPointerMove={event=>{const active=start.current;if(!active)return;const next=nextLayout(event.clientX,event.clientY);onPreview(next);setValue(next[id]?.width??100);}}
  onPointerUp={event=>{const active=start.current;if(!active)return;onCommit(nextLayout(event.clientX,event.clientY));clear();}}
  onPointerCancel={clear}
  onKeyDown={event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();event.stopPropagation();onCommit(resizeSectionWidth(layout,row,id,edge,event.key==='ArrowLeft'?-5:5));}}
 ><span className="resize-grip" aria-hidden="true"/>{value!==null&&<span>{value}%</span>}</button>;
}
