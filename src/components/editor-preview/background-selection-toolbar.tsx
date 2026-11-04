"use client";
import {backgroundSelection} from './background-selection';
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
   setTarget(backgroundSelection(el)?.element??null);
  };
  document.addEventListener('pointerdown',click);
  return()=>document.removeEventListener('pointerdown',click);
 },[]);
 useEffect(()=>{if(!target)return;const surface=backgroundSelection(target)?.element??target;surface.setAttribute('data-background-selected','true');return()=>surface.removeAttribute('data-background-selected');},[target]);
 useEffect(()=>{if(!target)return;const measure=()=>{const r=target.getBoundingClientRect();setPosition({left:Math.max(8,r.left+r.width/2-22),top:Math.max(8,r.top-46)});};measure();window.addEventListener('scroll',measure,true);window.addEventListener('resize',measure);return()=>{window.removeEventListener('scroll',measure,true);window.removeEventListener('resize',measure);};},[target]);
 if(!target)return null;
 const selection=backgroundSelection(target);
 const color=getComputedStyle(selection?.element??target).backgroundColor;
 return createPortal(<div data-background-toolbar data-background-target={selection?.section} role="toolbar" aria-label="Background color" style={{position:'fixed',...position,zIndex:60}} className="rounded-xl border border-stone-200 bg-white p-1 shadow-md"><style>{`.editor-review [data-background-selected="true"] {outline:2px solid #d86b93;outline-offset:-2px;}`}</style><button type="button" aria-label="Edit background color" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-stone-100" onClick={()=>onOpen(selection?.section??'page-background')}><span className="h-6 w-6 rounded-full border border-stone-300" style={{background:color}}/></button></div>,document.body);
}
