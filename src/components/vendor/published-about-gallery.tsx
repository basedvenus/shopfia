
import { scallopedPhotoStyle } from "@/lib/scalloped-photo";
import type { CSSProperties } from "react";
type PhotoLayout = "grid"|"row"|"layered"|"offset"|"cascade"|"six"|"banner"|"scallop";
const PHOTO_LAYOUTS = [
 {id:"grid",label:"Square grid",count:4},
 {id:"row",label:"Wide row",count:3},
 {id:"layered",label:"Overlapping",count:3},
 {id:"offset",label:"Off-center",count:3},
 {id:"cascade",label:"Center stage",count:5},
 {id:"six",label:"Six squares",count:6},
 {id:"banner",label:"Trio + banner",count:4},
 {id:"scallop",label:"Scalloped",count:3},
] as const;

function photoTileStyle(layout:PhotoLayout,index:number):CSSProperties {
 if(layout==="offset") return index===0?{gridRow:"span 2",aspectRatio:"3 / 4"}:{aspectRatio:"16 / 9"};
 if(layout==="banner") return index===3?{gridColumn:"1 / -1",aspectRatio:"3 / 1"}:{aspectRatio:"1"};
 if(layout==="cascade") return {aspectRatio:"3 / 4",transform:`scale(${index===2?1.3:index===1||index===3?1.05:.8})`,zIndex:index===2?3:index===1||index===3?2:1};
 if(layout==="layered") return {aspectRatio:"1",transform:`translateY(${index===1?14:0}px) rotate(${index===0?-6:index===2?6:0}deg)`,marginLeft:index?-20:0,zIndex:index===1?2:1};
 return {aspectRatio:layout==="row"?"4 / 3":layout==="scallop"?"4 / 5":"1"};
}
function photoGridStyle(layout:PhotoLayout):CSSProperties {
 return {display:"grid",gridTemplateColumns:`repeat(${layout==="grid"||layout==="offset"?2:layout==="cascade"?5:3},minmax(0,1fr))`,gap:layout==="cascade"?0:12,alignItems:layout==="cascade"?"center":"stretch",padding:layout==="cascade"?"36px 12px":layout==="layered"?"20px 12px":"0"};
}

export function PublishedAboutGallery({images,layout="grid",name}:{images:string[];layout?:PhotoLayout;name:string}){const count=PHOTO_LAYOUTS.find(item=>item.id===layout)?.count??4;return <div className="mt-5" style={photoGridStyle(layout)}>{images.slice(0,count).map((url,index)=>url?<div key={index} className="relative min-w-0" style={{...photoTileStyle(layout,index),width:"100%",alignSelf:"start"}}><img src={url} alt={`${name} gallery photo ${index+1}`} loading="lazy" className="h-full w-full object-cover" style={layout==="scallop"?scallopedPhotoStyle:undefined}/></div>:null)}</div>}
