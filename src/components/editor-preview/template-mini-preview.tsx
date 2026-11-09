"use client";

import { Camera, ArrowUpRight } from "lucide-react";
import {useLayoutEffect,useRef,type CSSProperties} from "react";
import type { StorefrontTemplate } from "@/lib/editor-preview/storefront-template-library";
import { getSectionDesign, sectionDesignStyle } from "@/lib/editor-preview/template-section-design";
import { TemplateHeading } from "./template-heading";
import "./template-mini-preview.css";
import { TemplateMediaGrid } from "./template-media-grid";
import { TemplateIllustration } from "./template-illustration";

function PhotoSlot({ index, photo, className = "" }: { index: number; photo?: string; className?: string }) {
  return <div className={`mini-photo mini-photo-${index} ${className}`}>{photo ? <img src={photo} alt="" loading="lazy"/> : <Camera size={24} strokeWidth={1.2} aria-label="Photo placement"/>}</div>;
}

export function TemplateMiniPreview({ template, logo, vendorName, photos, heading, body, variables }: { template: StorefrontTemplate; logo: string; vendorName: string; photos: string[]; heading: string; body: string; variables: CSSProperties }) {
  const preview=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    const node=preview.current;if(!node)return;
    let active=true;
    const fit=()=>{
      if(!active)return;
      node.querySelectorAll<HTMLElement>(".mini-copy h3,.mini-work h4,.mini-story h4").forEach(heading=>{
        heading.style.removeProperty("font-size");
        const available=heading.clientWidth;if(!available)return;
        const context=document.createElement("canvas").getContext("2d");if(!context)return;
        const base=parseFloat(getComputedStyle(heading).fontSize);let longest=0;
        const walker=document.createTreeWalker(heading,NodeFilter.SHOW_TEXT);
        while(walker.nextNode()){
          const text=walker.currentNode,style=getComputedStyle(text.parentElement!);
          context.font=`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
          for(const word of (text.textContent??"").split(/\s+/)){
            const visible=style.textTransform==="uppercase"?word.toUpperCase():word;
            longest=Math.max(longest,context.measureText(visible).width+Math.max(0,word.length-1)*(parseFloat(style.letterSpacing)||0));
          }
        }
        if(longest>available-4)heading.style.setProperty("font-size",`${base*(available-4)/longest}px`,"important");
      });
    };
    fit();const observer=new ResizeObserver(fit);observer.observe(node);document.fonts.ready.then(fit);
    return()=>{active=false;observer.disconnect();};
  },[template.id,heading,body]);
  const first=getSectionDesign(template,"hero");
  const second=getSectionDesign(template,"about");

  return <div ref={preview} className="template-mini" aria-label="Sample typography and photo layout" style={{...variables,...sectionDesignStyle(template.backgroundDesign),fontFamily:body}} data-layout={template.composition} data-photo-layout={template.photoLayout} data-frame={template.frame} data-button={template.button} data-mask={template.imageMask} data-reference={template.source.number}>
    <div className="mini-platform-shell"><div className="mini-platform-nav"><img src="/logo.png" alt="ShopFia"/><span>Explore</span><span>Parties</span><span>Categories</span><span className="mini-account">Account</span></div></div>
    <div className="mini-paper">
      <div className="mini-nav"><div className="mini-logo">{logo ? <img src={logo} alt="" loading="lazy"/> : <span>Logo</span>}</div><div className="mini-vendor-details"><strong>{vendorName || "Your business"}</strong><span>Vendor storefront</span><b>Follow</b></div></div>
      <div className="mini-storefront-links"><span>Home</span><span>All Services</span><span>Portfolio</span><span>About Us</span></div>
      {(template.source.number === 2 || template.photoLayout === "quartet") && <div className="mini-photo-header"><PhotoSlot index={3} photo={photos[2]}/></div>}
      <div className="mini-hero" style={sectionDesignStyle(first)}>
        <div className="mini-copy"><h3 style={{fontFamily:heading,fontWeight:template.headingWeight ?? 600,fontStyle:template.headingFontStyle ?? "normal"}}>{template.source.number === 2 ? <span className="mini-illustrated-heading"><span>Made</span><TemplateIllustration kind={template.illustration || "ribbon"} className="mini-word-art"/><span>for you.</span></span> : <TemplateHeading text={template.sample || "Your next great moment."} treatment={template.headingTreatment} accentFamily={template.accentHeadingFamily} parts={template.specimenParts}/>}</h3><p className="mini-subtitle">Thoughtful services.<br/>Personal touches.</p><span className="mini-button">Get a quote <ArrowUpRight size={10}/></span></div>
        <div className="mini-feature">{template.illustration ? <TemplateIllustration kind={template.illustration} className="mini-illustration"/> : <PhotoSlot index={1} photo={photos[0]}/>}</div>
      </div>
      <div className="mini-work" style={sectionDesignStyle(template.sectionDesigns?.portfolio)}><h4 style={{fontFamily:template.subheadingFamily || heading,fontStyle:template.subheadingStyle}}>Your work, beautifully shown.</h4>{[1,2,18,19,57].includes(template.source.number) ? <TemplateMediaGrid template={template} photos={photos} mini/> : <div className="mini-photo-grid">{(template.photoLayout === "quartet" ? [0,1,2,3] : [0,1,2]).map(index=><div key={index}><PhotoSlot index={index+1} photo={photos[index % photos.length]}/><span className="mini-photo-caption">Your service</span></div>)}</div>}</div>
      <div className="mini-story" style={sectionDesignStyle(second)}><h4 style={{fontFamily:template.subheadingFamily || heading,fontStyle:template.subheadingStyle}}>A little about you.</h4><div><p>Space for your story,<br/>in your own words.</p><span className="mini-button">Request a quote ↗</span></div></div>

    </div>
  </div>;
}
