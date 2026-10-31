"use client";
import { createElement, useEffect, useRef, useState, type CSSProperties } from 'react';
export function ProductModel({src,name,spin=false,studio=false,onReady}:{src:string;name:string;spin?:boolean;studio?:boolean;onReady?:(ready:boolean)=>void}) {
 const host=useRef<HTMLDivElement>(null),viewer=useRef<HTMLElement>(null);
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[angle,setAngle]=useState(0),[loaded,setLoaded]=useState(false);
 useEffect(()=>{let active=true;import('@google/model-viewer').then(()=>{if(active)setReady(true);}).catch(()=>{if(active)setError('The 3D viewer could not load. Refresh to try again.');});return()=>{active=false;};},[]);
 useEffect(()=>{
  if(!ready)return;
  setLoaded(false);setError('');onReady?.(false);
  const element=viewer.current;if(!element)return;
  const load=()=>{setLoaded(true);onReady?.(true);};const fail=()=>{setError('This model could not be displayed. Try another GLB.');onReady?.(false);};
  element.addEventListener('load',load);element.addEventListener('error',fail);
  return()=>{element.removeEventListener('load',load);element.removeEventListener('error',fail);};
 },[ready,src,onReady]);
 useEffect(()=>{
  if(!ready || !spin || studio)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');let frame=0;
  const update=()=>{frame=0;if(reduced.matches)return;const root=host.current;if(!root)return;const rect=root.getBoundingClientRect();let top=0,height=window.innerHeight;
   for(let parent=root.parentElement;parent;parent=parent.parentElement){if(/auto|scroll/.test(getComputedStyle(parent).overflowY)&&parent.scrollHeight>parent.clientHeight){const bounds=parent.getBoundingClientRect();top=bounds.top;height=parent.clientHeight;break;}}
   const progress=Math.max(0,Math.min(1,(height-(rect.top-top))/(height+rect.height)));
   viewer.current?.setAttribute('camera-orbit',`${-360*progress}deg 75deg 105%`);
  };
  const scroll=()=>{if(!frame)frame=requestAnimationFrame(update);};document.addEventListener('scroll',scroll,true);window.addEventListener('resize',scroll);update();
  return()=>{document.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',scroll);cancelAnimationFrame(frame);};
 },[ready,spin,studio]);
 return <div ref={host} className="relative h-full w-full" style={{minHeight:220}}>
 {ready && createElement('model-viewer',{ref:viewer,src,alt:`${name || 'Product'} interactive 3D model`,'camera-controls':'','touch-action':'pan-y','disable-zoom':'','shadow-intensity':'1','camera-orbit':`${-angle}deg 75deg 105%`,'interaction-prompt':'none',style:{display:'block',width:'100%',height:studio?'calc(100% - 42px)':'100%',minHeight:210,background:'transparent'} as CSSProperties})}
 {!loaded&&!error&&<p role="status" className="pointer-events-none absolute inset-0 grid place-content-center text-sm">Loading 3D model…</p>}
 {error&&<p role="alert" className="absolute inset-0 grid place-content-center p-6 text-sm">{error}</p>}
 {studio&&<p className="absolute left-2 right-2 top-2 rounded-full bg-white/90 px-3 py-2 text-center text-xs font-semibold pointer-events-none">↕ Drag up/down · ↔ Drag to turn 360°</p>}
 {studio&&<label className="flex items-center gap-3 px-3 text-xs">Inspect 360°<input aria-label="Inspect model angle" type="range" min="0" max="360" value={angle} onChange={e=>setAngle(Number(e.target.value))} className="min-w-0 flex-1"/></label>}
 </div>;
}
