"use client";
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
export function BackgroundSelectionToolbar({onOpen}:{onOpen:(section:string)=>void}){
 const [target,setTarget]=useState<HTMLElement|null>(null);
 const [position,setPosition]=useState({left:0,top:0});
 useEffect(()=>{
  const click=(event:PointerEvent)=>{
   const el=event.target as HTMLElement;
   if(el.closest('[data-background-toolbar],.editor-inspector'))return;
   if(el.closest('button,a,input,textarea,[data-inline-photo],[data-storefront-text]')){setTarget(null);return;}
   setTarget(el.closest<HTMLElement>('[data-service-card]')??el.closest<HTMLElement>('[data-profile-frame]')??el.closest<HTMLElement>('[data-section-frame]'));
  };
  document.addEventListener('pointerdown',click);
  return()=>document.removeEventListener('pointerdown',click);
 },[]);
 useEffect(()=>{if(!target)return;const measure=()=>{const r=target.getBoundingClientRect();setPosition({left:Math.max(8,r.left+r.width/2-22),top:Math.max(8,r.top-46)});};measure();window.addEventListener('scroll',measure,true);window.addEventListener('resize',measure);return()=>{window.removeEventListener('scroll',measure,true);window.removeEventListener('resize',measure);};},[target]);
 if(!target)return null;
 const surface=target.hasAttribute('data-service-card')?target:target.querySelector<HTMLElement>('[data-testid^="preview-section-"]')??target;
 let color=getComputedStyle(surface).backgroundColor;
 if(color==='rgba(0, 0, 0, 0)')color=getComputedStyle(target.closest('.editor-review')??target).backgroundColor;
 return createPortal(<div data-background-toolbar role="toolbar" aria-label="Background color" style={{position:'fixed',...position,zIndex:60}} className="rounded-xl border border-stone-200 bg-white p-1 shadow-md"><button type="button" aria-label="Edit background color" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-stone-100" onClick={()=>onOpen(target.hasAttribute('data-service-card')?'services-card':target.hasAttribute('data-profile-frame')?'profile-frame':target.dataset.sectionFrame??'hero')}><span className="h-6 w-6 rounded-full border border-stone-300" style={{background:color}}/></button></div>,document.body);
}
