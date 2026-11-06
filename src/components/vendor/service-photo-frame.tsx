"use client";
import {useEffect,useRef,useState} from "react";
import {cropImageRect,normalizeImageCrop} from "@/lib/image-crop";
/** Uses the same image geometry as the square crop editor. */
export function ServicePhotoFrame({src,crop,alt=""}:{src:string;crop?:unknown;alt?:string}){
 const host=useRef<HTMLDivElement>(null);
 const [frame,setFrame]=useState({width:0,height:0}),[image,setImage]=useState({width:0,height:0});
 useEffect(()=>{setImage({width:0,height:0});},[src]);
 useEffect(()=>{const node=host.current;if(!node)return;const measure=()=>{setFrame({width:node.clientWidth,height:node.clientHeight});};measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();},[]);
 const normalized=normalizeImageCrop(crop);normalized.zoom=Math.max(1,normalized.zoom);
 const rect=frame.width&&image.width?cropImageRect(image.width,image.height,frame.width,frame.height,normalized):null;
 return <div ref={host} className="absolute inset-0 overflow-hidden"><img src={src} alt={alt} loading="lazy" draggable={false} onLoad={event=>setImage({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})} className="absolute h-full w-full object-cover" style={{...(rect?{width:rect.width,height:rect.height,left:rect.x,top:rect.y,maxWidth:"none"}:{objectPosition:`${normalized.x}% ${normalized.y}%`}),filter:`brightness(${normalized.brightness??1}) saturate(${normalized.saturation??1})`}}/></div>;
}
