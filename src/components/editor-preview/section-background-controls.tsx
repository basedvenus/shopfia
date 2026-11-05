"use client";
import { patternPreviewStyle } from "@/lib/editor-preview/pattern-preview";
import {useEffect,useState} from "react";
import { useSelectedTextColor } from "./text-formatting";
import { ColorPicker } from "./color-picker";
import { STOREFRONT_TEMPLATES, type SectionDesign, type StorefrontTemplate } from "@/lib/editor-preview/storefront-template-library";
import { getSectionDesign, SECTION_PATTERNS } from "@/lib/editor-preview/template-section-design";
export function SectionBackgroundControls({template,section,label,onChange,mode="colors",logo,photos=[],textMode=false}:{textMode?:boolean;logo?:string;photos?:string[];mode?:"colors"|"patterns";template:StorefrontTemplate;section:string;label:string;onChange:(template:StorefrontTemplate)=>void}) {
 const [patternOpen,setPatternOpen]=useState(false);
 const [imageColors,setImageColors]=useState<{src:string;colors:string[]}[]>([]);
 const sources=JSON.stringify([logo,...photos].filter(Boolean).slice(0,5));
 useEffect(()=>{let cancelled=false;Promise.all((JSON.parse(sources) as string[]).map(src=>new Promise<{src:string;colors:string[]}>(resolve=>{const image=new Image();image.crossOrigin='anonymous';image.onload=()=>{try{const canvas=document.createElement('canvas');canvas.width=24;canvas.height=24;const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0,24,24);const pixels=ctx.getImageData(0,0,24,24).data;const counts=new Map<string,number>();for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]<200)continue;const color='#'+[pixels[i],pixels[i+1],pixels[i+2]].map(v=>Math.min(255,Math.round(v/32)*32).toString(16).padStart(2,'0')).join('');counts.set(color,(counts.get(color)??0)+1);}resolve({src,colors:[...counts].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([color])=>color)});}catch{resolve({src,colors:[]});}};image.onerror=()=>resolve({src,colors:[]});image.src=src;}))).then(values=>{if(!cancelled)setImageColors(values);});return()=>{cancelled=true;};},[sources]);
 const selectedText=useSelectedTextColor();
 const design=section === "page-background" ? template.backgroundDesign ?? {background:template.colors.background,ink:template.colors.ink,pattern:"solid" as const} : getSectionDesign(template,section);
 useEffect(()=>setColorTarget("background"),[section]);
 const [colorTarget,setColorTarget]=useState<"background"|"ink">("background");
 const templatePalette=Array.from(new Set(Object.values((STOREFRONT_TEMPLATES.find(item=>item.id===template.id)??template).colors)));
 const palette=Array.from(new Set([...templatePalette,...Object.values(template.colors)]));
 const brandColors=imageColors.find(item=>item.src===logo)?.colors??[];
 const photoRows=imageColors.filter(item=>item.src!==logo&&item.colors.length).slice(0,3);
 const solids=["#000000","#545454","#737373","#a6a6a6","#b6b6b6","#d9d9d9","#ffffff","#ff3131","#ff5757","#ff66c4","#e3a5ec","#cb6ce6","#8c52ff","#5e17eb","#0097b2","#0cc0df","#5ce1e6","#38b6ff","#5271ff","#004aad","#1800ad","#00bf63","#7ed957","#c1ff72","#ffde59","#ffbd59","#ff914d","#ff751f"];
 function chooseColor(color:string){if(textMode)selectedText.setColor?.(color);else update({[colorTarget]:color});}
 function swatch(color:string){return <button type="button" key={color} title={color} aria-label={`Set ${textMode?'text':colorTarget==='ink'?'text':'background'} color to ${color}`} aria-pressed={(textMode?selectedText.color:design[colorTarget])===color} onClick={()=>chooseColor(color)} style={{background:color}} className="aspect-square w-full rounded-full border border-stone-300 aria-pressed:ring-2 aria-pressed:ring-[#d96996] aria-pressed:ring-offset-2"/>;}
 function swatches(title:string,colors:string[]){return <div className="mt-5"><h4 className="mb-3 text-sm font-semibold">{title}</h4><div className="grid grid-cols-7 gap-2">{colors.map(swatch)}</div></div>;}
 function sourceRow(src:string,colors:string[],alt:string){return <div key={src} className="grid grid-cols-6 items-center gap-2"><img src={src} alt={alt} className="aspect-square w-full rounded-xl object-cover"/>{colors.slice(0,5).map(swatch)}</div>;}
 function update(patch:Partial<SectionDesign>){if(section === "page-background"){onChange({...template,backgroundDesign:{...design,...patch}});return;}onChange({...template,sectionDesigns:{...template.sectionDesigns,[section]:{...design,...patch}}});}
 return <section data-background-settings className="mb-4 rounded-2xl border border-[#eadbd7] bg-[#fffaf8] p-4">
 <div className="mobile-quick-colors" aria-label="Quick colors">{palette.map(swatch)}</div>
 <h3 className="mb-4 text-sm font-semibold">{textMode?"Selected text":label} · Color</h3>
 <>
 {textMode?<ColorPicker label="Text color" value={selectedText.color??"#000000"} onChange={chooseColor}/>:<div className="grid grid-cols-2 gap-4">{([['background','Background'],['ink','Text color']] as const).map(([key,title])=><div key={key} onPointerDownCapture={()=>{setColorTarget(key);setPatternOpen(false);}} onFocusCapture={()=>setColorTarget(key)}><ColorPicker label={title} value={design[key]??"#ffffff"} onChange={value=>update({[key]:value})}/></div>)}<div className="col-span-2 mt-1"><p className="mb-1 text-xs">Pattern</p><button type="button" aria-label="Choose background pattern" aria-expanded={patternOpen} onClick={()=>setPatternOpen(value=>!value)} className="flex h-10 w-full items-center justify-between rounded-xl border border-[#eadbd7] bg-white px-2"><span className="h-7 w-7 rounded-full border" style={patternPreviewStyle(design)}/><span className="ml-3 flex-1 text-left text-xs capitalize">{design.pattern==='solid'?'None':design.pattern}</span><span aria-hidden="true">⌄</span></button></div></div>}
 {!patternOpen && <>
 {swatches("Colors in this design",palette)}
 <p className="mt-2 text-xs text-stone-500">Includes your template palette</p>
 {logo&&brandColors.length>0&&<div className="mt-5"><h4 className="mb-3 text-sm font-semibold">Brand colors</h4>{sourceRow(logo,brandColors,"Brand logo")}</div>}
 {photoRows.length>0&&<div className="mt-5"><h4 className="mb-3 text-sm font-semibold">Photo colors</h4><div className="grid gap-3">{photoRows.map(item=>sourceRow(item.src,item.colors,"Photo color source"))}</div></div>}
 {swatches("Default solid colors",solids)}
 </>}
 </>
 {!textMode && (patternOpen || mode==='patterns') && <div className="mt-5" aria-label="Background patterns"><div className="grid grid-cols-4 gap-3">{SECTION_PATTERNS.map(pattern=><button type="button" key={pattern} aria-label={`Set background pattern to ${pattern}`} aria-pressed={design.pattern===pattern} onClick={()=>update({pattern,patternColor:design.patternColor??design.ink})} className="grid justify-items-center gap-1 text-xs capitalize"><span className="h-11 w-11 rounded-full border border-stone-300 aria-pressed:ring-2" style={{...patternPreviewStyle({...design,pattern}),...(design.pattern===pattern?{outline:'2px solid #d96996',outlineOffset:2}:{})}}/>{pattern==='solid'?'None':pattern}</button>)}</div><div className="mt-5"><ColorPicker label="Pattern color" value={design.patternColor??design.ink} onChange={patternColor=>update({patternColor})}/></div><label className="mt-4 grid gap-2 text-xs">Pattern opacity · {Math.round((design.patternOpacity??1)*100)}%<input type="range" min="0" max="100" value={(design.patternOpacity??1)*100} onChange={e=>update({patternOpacity:+e.target.value/100})}/></label></div>}

 </section>;
}
