"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { X, Check } from "lucide-react";
import { getStorefrontFontFamilies } from "@/lib/businesses";
import { STOREFRONT_TEMPLATES, type StorefrontTemplate } from "@/lib/editor-preview/storefront-template-library";
import { TemplateMiniPreview } from "./template-mini-preview";
import "./storefront-template-library.css";

export function templateVariables(template: StorefrontTemplate): CSSProperties {
  const secondary=template.colors.secondary;
  const luminance=[1,3,5].map(index=>parseInt(secondary.slice(index,index+2),16)/255).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
  return {...Object.fromEntries(Object.entries(template.colors).map(([key,value])=>[`--template-${key}`,value])),
    "--template-heading-size":`${template.headingSize ?? 64}px`, "--template-heading-weight":template.headingWeight ?? 600,
    "--template-hero":template.heroBackground ?? template.colors.surface,
    "--template-heroInk":template.heroInk ?? template.colors.ink,
    "--template-secondaryInk":luminance>.55 ? "#282421" : "#fff9f0",
    "--template-heading-case":template.headingCase ?? "none",
    "--template-heading-style":template.headingFontStyle ?? "normal"
  } as CSSProperties;
}

export function StorefrontTemplateLibrary({ selected, image, vendorName, onApply, onClose, initialScroll = 0, onScroll }: { selected: string | null; image: string; vendorName: string; photos?: string[]; onApply: (template: StorefrontTemplate)=>void; onClose: ()=>void; initialScroll?: number; onScroll?: (position: number)=>void }) {
  const [showPhotos,setShowPhotos]=useState(false);
  const samplePhotos=[
    "https://images.unsplash.com/photo-1519654793190-2e8a4806f1f2?auto=format&fit=crop&w=640&q=75",
    "https://images.unsplash.com/photo-1633978694716-e7e5d6d2504c?auto=format&fit=crop&w=640&q=75",
    "https://images.unsplash.com/photo-1772127822514-682aeffcc0d3?auto=format&fit=crop&w=640&q=75",
    "https://images.unsplash.com/photo-1775126964424-913480443772?auto=format&fit=crop&w=640&q=75"
  ];
  const dialog=useRef<HTMLDialogElement>(null);
  const [logoSource,setLogoSource]=useState(image.startsWith("data:") ? "" : image);
  useEffect(()=>{
    if(!image.startsWith("data:")){setLogoSource(image);return;}
    let disposed=false;let objectUrl="";
    // Reuse the original bytes without repeating a large data URI in every card.
    void fetch(image).then(response=>response.blob()).then(blob=>{
      if(disposed)return;objectUrl=URL.createObjectURL(blob);setLogoSource(objectUrl);
    }).catch(()=>{if(!disposed)setLogoSource(image);});
    return ()=>{disposed=true;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[image]);
  useEffect(()=>{const element=dialog.current;if(element){if(!element.open)element.showModal();element.scrollTop=initialScroll;}},[initialScroll]);
  return <dialog ref={dialog} className="template-library" onScroll={(event)=>onScroll?.(event.currentTarget.scrollTop)} aria-labelledby="template-library-title" onCancel={(event)=>{event.preventDefault();onClose();}} onClick={(event)=>{if(event.target===event.currentTarget)onClose();}}>
    <div className="template-gallery-brand"><img src="/logo.png" alt="ShopFia"/><span>Storefront templates</span></div>
    <div className="template-library-inner">
      <header><div><p>ShopFia · Preview collection</p><h2 id="template-library-title">Find your storefront’s style.</h2><p>{STOREFRONT_TEMPLATES.length} designs. The five refined references appear first.</p></div><button type="button" onClick={onClose} aria-label="Close templates"><X size={21}/></button></header>

      <div className="template-photo-toolbar"><div role="group" aria-label="Template sample imagery"><button type="button" aria-pressed={showPhotos} onClick={()=>setShowPhotos(true)}>Photos</button><button type="button" aria-pressed={!showPhotos} onClick={()=>setShowPhotos(false)}>Color blocks</button></div><p>Sample images only · never added to your storefront</p></div>
      <div className="template-library-grid">{[...STOREFRONT_TEMPLATES].sort((a,b)=>{const order=[1,2,19,18,57];const x=order.indexOf(a.source.number),y=order.indexOf(b.source.number);return (x<0?99:x)-(y<0?99:y);}).map(template=>{
        const baseFonts=getStorefrontFontFamilies(template.fontStyle);
        const fonts={heading:template.headingFamily ?? baseFonts.heading,body:template.bodyFamily ?? baseFonts.body};
        return <article key={template.id} className="template-choice" data-selected={selected===template.id}><button type="button" className="template-select" aria-pressed={selected===template.id} aria-label={`Apply ${template.name} template`} onClick={()=>onApply(template)}>
          <TemplateMiniPreview template={template} logo={logoSource} vendorName={vendorName} photos={showPhotos ? samplePhotos : []} heading={fonts.heading} body={fonts.body} variables={templateVariables(template)}/>

          <div className="template-caption"><div><h3><span className="template-reference-number">{String(template.source.number).padStart(2,"0")}</span> {template.name}</h3>{selected===template.id ? <span>Applied</span> : null}</div>{selected===template.id ? <Check size={18}/> : null}<p>{template.source.notes}</p><p>{template.fonts}</p><div className="template-swatches">{Object.entries(template.colors).filter(([key])=>["background","surface","accent","secondary","ink"].includes(key)).map(([key,color])=><span key={key} title={`${key}: ${color}`} style={{background:color}}/>)}</div></div>
        </button><a className="template-reference-link" href={template.source.url} target="_blank" rel="noreferrer" aria-label={`Compare ${template.name} with Pinterest reference ${template.source.number}`}>Pinterest reference ↗</a></article>;
      })}</div>
      <footer>{STOREFRONT_TEMPLATES.length} source-linked designs · Your logo and business content stay unchanged.<details className="template-photo-credits"><summary>Sample photo credits</summary><a href="https://unsplash.com/photos/22JxStzTxwo" target="_blank" rel="noreferrer">Photos by Lanty</a> · <a href="https://unsplash.com/photos/IOZcO_63FSE" target="_blank" rel="noreferrer">Dillon Groves</a> · <a href="https://unsplash.com/photos/a6Kee4s4aPw" target="_blank" rel="noreferrer">Vidit Goswami</a> · <a href="https://unsplash.com/photos/zjJiX9txwRU" target="_blank" rel="noreferrer">Ben Atkins</a> / Unsplash</details></footer>
    </div>
  </dialog>;
}
