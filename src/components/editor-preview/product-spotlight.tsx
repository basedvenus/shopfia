"use client";
import { useRef, type CSSProperties } from "react";
export function ProductSpotlight({image,word,name,headingStyle}: {image:string;word:string;name:string;headingStyle?:CSSProperties}) {
 const stage=useRef<HTMLDivElement>(null);
 function tilt(x:number,y:number){stage.current?.style.setProperty('--product-y',`${x}deg`);stage.current?.style.setProperty('--product-x',`${y}deg`);}
 return <div ref={stage} className="product-spotlight" onPointerMove={event=>{if(event.pointerType!=='mouse')return;const bounds=event.currentTarget.getBoundingClientRect();tilt((event.clientX-bounds.left)/bounds.width*24-12,6-(event.clientY-bounds.top)/bounds.height*12);}} onPointerLeave={()=>tilt(0,0)}>
 {word && <div className="product-backdrop-word" style={headingStyle} aria-hidden="true">{word}</div>}
 <div className="product-screen" aria-hidden="true"><div className="product-screen-chrome"><i/><i/><i/></div><div className="product-screen-content"/><div className="product-screen-lines"><i/><i/></div></div>
 <div className="product-arrival" key={image}><img className="product-cutout" src={image} alt={`${name || 'Storefront'} featured image`}/></div>
 <div className="product-controls" role="group" aria-label="Product view"><button type="button" onClick={()=>tilt(-18,0)}>↶ Left</button><button type="button" onClick={()=>tilt(0,0)}>Front</button><button type="button" onClick={()=>tilt(18,0)}>Right ↷</button></div>
 </div>;
}
