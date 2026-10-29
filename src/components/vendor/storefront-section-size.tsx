"use client";
import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';

/** Fit a section into its chosen height without hiding its content. */
export function StorefrontSectionSize({height,disabled=false,responsive=false,children}:{height?:number;disabled?:boolean;responsive?:boolean;children:ReactNode}) {
 const content=useRef<HTMLDivElement>(null);
 const [naturalHeight,setNaturalHeight]=useState(0);
 const [smallScreen,setSmallScreen]=useState(false);
 useLayoutEffect(()=>{
  const node=content.current;if(!node)return;
  const measure=()=>setNaturalHeight(node.offsetHeight);
  measure();const observer=new ResizeObserver(measure);observer.observe(node);
  return()=>observer.disconnect();
 },[]);
 useLayoutEffect(()=>{
  if(!responsive)return;
  const query=window.matchMedia('(max-width:680px)');const update=()=>setSmallScreen(query.matches);
  update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);
 },[responsive]);
 const target=disabled || smallScreen ? undefined : height;
 const scale=target && naturalHeight ? Math.min(1,target/naturalHeight) : 1;
 return <div className="storefront-section-size" style={{height:target??'auto',position:'relative',minWidth:0}} data-sized={Boolean(target)}>
  <div ref={content} className="storefront-section-natural" style={{transform:scale<1?`scale(${scale})`:undefined,transformOrigin:'top center',display:'flow-root',width:'100%'}}>{children}</div>
 </div>;
}
