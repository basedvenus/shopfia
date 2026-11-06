"use client";
import {ServicePhotoFrame} from "./service-photo-frame";
import {normalizeImageCrop} from "@/lib/image-crop";
import {useEffect,useRef,useState} from "react";

export function ServicePhotos({photos,title,crops}:{photos:string[];title:string;crops?:unknown}){
 const images=photos.filter(Boolean);
 const [index,setIndex]=useState(0),[visible,setVisible]=useState(false),[reduced,setReduced]=useState(true);
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const motion=matchMedia("(prefers-reduced-motion: reduce)");
  const sync=()=>{setReduced(motion.matches);};sync();
  motion.addEventListener("change",sync);
  const observer=new IntersectionObserver(entries=>setVisible(entries[0]?.isIntersecting??false),{threshold:.3});if(host.current)observer.observe(host.current);
  return()=>{observer.disconnect();motion.removeEventListener("change",sync);};
 },[]);
 useEffect(()=>{setIndex(0);},[photos.join("|")]);
 useEffect(()=>{if(images.length<2||reduced||!visible)return;const timer=setInterval(()=>setIndex(current=>(current+1)%images.length),3000);return()=>clearInterval(timer);},[images.length,reduced,visible]);
 return <div ref={host} className="relative aspect-square w-full overflow-hidden bg-[#f8f5f2]">
  {images.length?<ServicePhotoFrame crop={normalizeImageCrop(Array.isArray(crops)?crops[index%images.length]:undefined)} src={images[index%images.length]} alt={`${title}${images.length>1?` — photo ${index+1} of ${images.length}`:""}`}/>:<div className="grid h-full place-items-center text-sm text-muted-foreground">No service photo</div>}

 </div>;
}
