"use client";
import {useEffect,useRef,useState,type ReactEventHandler} from "react";
import {cropImageRect,normalizeImageCrop,type ImageCrop} from "@/lib/image-crop";
/** Shared geometry for an image at rest and the inline crop editor. */
export function CropGeometryImage({src,alt="",crop,loading="lazy",decoding="async",onError,contain=false}:{src:string;alt?:string;crop?:ImageCrop|null;loading?:"eager"|"lazy";decoding?:"async"|"auto"|"sync";onError?:ReactEventHandler<HTMLImageElement>;contain?:boolean}){
 const host=useRef<HTMLSpanElement>(null),image=useRef<HTMLImageElement>(null);
 const [size,setSize]=useState({width:0,height:0,imageWidth:0,imageHeight:0});
 useEffect(()=>{
  const node=host.current;if(!node)return;
  const measure=()=>{const img=image.current;const next={width:node.clientWidth,height:node.clientHeight,imageWidth:img?.naturalWidth??0,imageHeight:img?.naturalHeight??0};setSize(old=>Object.keys(next).every(key=>old[key as keyof typeof old]===next[key as keyof typeof next])?old:next);};
  measure();const observer=new ResizeObserver(measure);observer.observe(node);image.current?.addEventListener("load",measure);
  const img=image.current;return()=>{observer.disconnect();img?.removeEventListener("load",measure);};
 },[src]);
 const normalized=normalizeImageCrop(crop);
 const rect=size.width&&size.height&&size.imageWidth?cropImageRect(size.imageWidth,size.imageHeight,size.width,size.height,{...normalized,zoom:contain?normalized.zoom*Math.min(size.width/size.imageWidth,size.height/size.imageHeight)/Math.max(size.width/size.imageWidth,size.height/size.imageHeight):normalized.zoom}):null;
 return <span ref={host} style={{position:"absolute",inset:0,display:"block",overflow:"hidden"}}><img ref={image} src={src} alt={alt} loading={loading} decoding={decoding} onError={onError} draggable={false} style={{position:"absolute",maxWidth:"none",...(rect?{width:rect.width,height:rect.height,left:rect.x,top:rect.y}:{width:"100%",height:"100%",objectFit:contain?"contain":"cover",objectPosition:`${normalized.x}% ${normalized.y}%`}),filter:`brightness(${normalized.brightness??1}) saturate(${normalized.saturation??1})`}}/></span>;
}
