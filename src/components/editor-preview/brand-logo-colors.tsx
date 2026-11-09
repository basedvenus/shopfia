"use client";
import {useEffect,useState} from "react";
export function BrandLogoColors({logo}:{logo:string}){
 const [colors,setColors]=useState<string[]>([]),[pending,setPending]=useState(false);
 useEffect(()=>{
  let active=true;setColors([]);if(!logo)return;setPending(true);
  const image=new Image();image.crossOrigin="anonymous";
  const finish=(values:string[])=>{if(active){setColors(values);setPending(false);}};
  image.onload=()=>{try{
    const canvas=document.createElement("canvas");canvas.width=64;canvas.height=64;const context=canvas.getContext("2d");if(!context){finish([]);return;}
    context.drawImage(image,0,0,64,64);const pixels=context.getImageData(0,0,64,64).data,counts=new Map<string,{count:number;red:number;green:number;blue:number}>();
    for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]<200)continue;const color="#"+[pixels[i],pixels[i+1],pixels[i+2]].map(v=>Math.min(255,Math.round(v/24)*24).toString(16).padStart(2,"0")).join("");const bucket=counts.get(color)??{count:0,red:0,green:0,blue:0};bucket.count++;bucket.red+=pixels[i];bucket.green+=pixels[i+1];bucket.blue+=pixels[i+2];counts.set(color,bucket);}
    finish([...counts.values()].sort((a,b)=>b.count-a.count).slice(0,6).map(bucket=>"#"+[bucket.red,bucket.green,bucket.blue].map(value=>Math.round(value/bucket.count).toString(16).padStart(2,"0")).join("")));
  }catch{finish([]);}};
  image.onerror=()=>finish([]);image.src=logo;return()=>{active=false;};
 },[logo]);
 return <div className="mt-5"><h4 className="mb-3 text-sm font-semibold">Colors from your logo</h4>{colors.length?<div className="flex flex-wrap gap-3">{colors.map(color=><div key={color} className="grid justify-items-center gap-1"><span title={color} className="h-10 w-10 rounded-full border border-black/15" style={{backgroundColor:color}}/><span className="text-[10px] text-stone-600">{color.toUpperCase()}</span></div>)}</div>:<p className="text-sm text-muted-foreground">{pending?"Reading your logo colors…":logo?"Colors could not be read from this image. Try uploading the logo again.":"Upload your logo to see its colors here."}</p>}</div>;
}
