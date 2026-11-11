"use client";
import {backgroundSelection} from './background-selection';
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
export function BackgroundSelectionToolbar({onOpen}:{onOpen:(section:string)=>void}){
 const [target,setTarget]=useState<HTMLElement|null>(null);
 const [position,setPosition]=useState<{left:number;top:number}|null>(null);
 useEffect(()=>{
  const click=(event:PointerEvent)=>{
   const el=event.target as HTMLElement;
   if(el.closest('[data-background-toolbar],.editor-inspector'))return;
   if(el.closest('button,a,input,textarea,[data-inline-photo],[data-storefront-text],[data-sticker]')){setTarget(null);return;}
   setTarget(backgroundSelection(el)?.element??null);
  };
  document.addEventListener('pointerdown',click);
  return()=>document.removeEventListener('pointerdown',click);
 },[]);
 useEffect(()=>{if(!target)return;const surface=backgroundSelection(target)?.element??target;surface.setAttribute('data-background-selected','true');return()=>surface.removeAttribute('data-background-selected');},[target]);
 useEffect(()=>{
  if(!target)return;
  const canvas=target.closest<HTMLElement>('.editor-canvas');
  if(!canvas)return;
  const measure=()=>{
   const rect=target.getBoundingClientRect(),area=canvas.getBoundingClientRect();
   const editor=canvas.closest('.editor-review');
   const toolbar=editor?.querySelector('[data-editor-toolbar]')?.getBoundingClientRect();
   const nav=document.querySelector('header.sticky')?.getBoundingClientRect();
   const inspector=editor?.querySelector('.editor-inspector');
   const sheet=inspector&&getComputedStyle(inspector).position==='fixed'?inspector.getBoundingClientRect():null;
   const top=Math.max(8,area.top+8,toolbar&&toolbar.bottom>0?toolbar.bottom+8:0,nav&&nav.bottom>0?nav.bottom+8:0);
   const bottom=Math.min(window.innerHeight-8,area.bottom-8,sheet?sheet.top-8:window.innerHeight);
   if(!target.isConnected||bottom-top<44||rect.bottom<top||rect.top>bottom){setPosition(null);return;}
   const left=Math.max(8,area.left+8,Math.min(window.innerWidth-52,area.right-52,rect.left+rect.width/2-22));
   const next={left,top:Math.max(top,Math.min(bottom-44,rect.top-46))};
   setPosition(previous=>previous?.left===next.left&&previous?.top===next.top?previous:next);
  };
  measure();const observer=new ResizeObserver(measure);observer.observe(target);observer.observe(canvas);
  window.addEventListener('scroll',measure,true);window.addEventListener('resize',measure);
  window.visualViewport?.addEventListener('resize',measure);window.visualViewport?.addEventListener('scroll',measure);
  return()=>{observer.disconnect();window.removeEventListener('scroll',measure,true);window.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('resize',measure);window.visualViewport?.removeEventListener('scroll',measure);};
 },[target]);
 if(!target||!position)return null;
 const selection=backgroundSelection(target);
 const color=getComputedStyle(selection?.element??target).backgroundColor;
 return createPortal(<div data-background-toolbar data-background-target={selection?.section} role="toolbar" aria-label="Background color" style={{position:'fixed',...position,zIndex:60}} className="rounded-xl border border-stone-200 bg-white p-1 shadow-md"><style>{`.editor-review [data-background-selected="true"] {outline:2px solid #d86b93;outline-offset:-2px;} .editor-review .storefront-section-frame[data-selected="true"]:has([data-background-selected="true"]):not([data-dragging="true"]) {outline-color:transparent;}`}</style><button type="button" aria-label="Edit background color" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-stone-100" onClick={()=>onOpen(selection?.section??'page-background')}><span className="h-6 w-6 rounded-full border border-stone-300" style={{background:color}}/></button></div>,document.body);
}
