import { Camera } from "lucide-react";
import type { StorefrontTemplate } from "@/lib/storefront-template-library";
import "./template-media-grid.css";
export function TemplateMediaGrid({template,photos,mini=false}:{template:StorefrontTemplate;photos:string[];mini?:boolean}) {
 const count=template.id==='reference-57'?4:3;
 return <div className={`reference-media-grid ${mini?'reference-media-mini':''}`} data-reference={template.id}>
  {Array.from({length:Math.max(count,mini?count:photos.length)},(_,index)=><div className={`reference-media-item media-tone-${index%3}`} key={index}>{photos[index] ? <img src={photos[index]} alt={mini?'':`Portfolio image ${index+1}`} loading="lazy"/> : <Camera size={22} strokeWidth={1.2} aria-label="Photo placement"/>}</div>)}
 </div>;
}
