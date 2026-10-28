"use client";
import { TemplateIllustration } from "./template-illustration";

import type { StorefrontTemplate } from "@/lib/storefront-template-library";
import { sectionDesignStyle } from "@/lib/template-section-design";
import { TemplateHeading } from "./template-heading";
import { ArrowUpRight } from "lucide-react";
import { StorefrontBrandSculpture, type LogoMount } from "@/components/vendor/storefront-brand-sculpture";
import { CroppedImage } from "@/components/ui/cropped-image";
import type { ImageCrop } from "@/lib/image-crop";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import "./dimensional-storefront-hero.css";

export type HeroDepth = "flat" | "layered" | "floating";
export const HERO_DEPTH_PRESETS: { value: HeroDepth; label: string; detail: string }[] = [
  { value: "flat", label: "Off", detail: "Standard hero" },
  { value: "floating", label: "Intro 3D", detail: "Brief welcome" },
  { value: "layered", label: "Exit 3D", detail: "When scrolling past" }
];

export function DimensionalStorefrontHero({ editable=true, previewReplay=0, template, name, headline, description, location, image, crop, logo, depth, mobile, headingStyle, onBook, onDepthChange, mount, edgeColor, sceneColor }: {
  editable?:boolean;
  previewReplay?:number;
  template?: StorefrontTemplate;
  name: string; headline: string; description: string; location: string;
  image: string; crop: ImageCrop; secondaryImage?: string; logo: string;
  depth: HeroDepth; mobile: boolean; headingStyle: CSSProperties; onBook: () => void; onDepthChange: (value: HeroDepth) => void; mount: LogoMount; edgeColor: string; sceneColor: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(depth === "floating" || (previewReplay>0 && depth!=="flat"));
  const [replay, setReplay] = useState(0);
  const [introReady, setIntroReady] = useState(false);
  const finish = useCallback(() => {
    setIntroReady(true);
    if(timerRef.current)clearTimeout(timerRef.current);
    timerRef.current=setTimeout(()=>setPlaying(false),1700);
  }, []);
  useEffect(()=>{
    if(!playing)return;
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) {setPlaying(false);return;}
    // Always resolve to the normal storefront, including failed/slow 3D loading.
    timerRef.current=setTimeout(()=>setPlaying(false),2400);
    return ()=>{if(timerRef.current)clearTimeout(timerRef.current);};
  },[playing,replay]);
  useEffect(()=>{
    if(depth !== "layered" || !rootRef.current)return;
    let seen=false;
    const observer=new IntersectionObserver(([entry])=>{
      if(entry.intersectionRatio>=.65)seen=true;
      if(seen && entry.intersectionRatio<.5 && entry.boundingClientRect.top<0) {seen=false;setIntroReady(false);setPlaying(true);setReplay(value=>value+1);}
    },{threshold:[0,.25,.5,.65,1]});
    observer.observe(rootRef.current);return ()=>observer.disconnect();
  },[depth]);
  const effectsButton = useRef<HTMLButtonElement>(null);
  const [effectsOpen, setEffectsOpen] = useState(false);
  return (
    <div ref={rootRef} onContextMenu={(event) => { if(editable){event.preventDefault(); event.stopPropagation(); setEffectsOpen(true);} }} className={`depth-hero ${mobile ? "depth-mobile" : ""}`} data-preview-playing={playing && depth!=="flat"} data-depth={depth} data-reference={template?.id} style={{"--scene-color":sceneColor,...sectionDesignStyle(template?.sectionDesigns?.hero),...(template?.sectionDesigns?.hero ? {"--template-heroInk":template.sectionDesigns.hero.ink} : {})} as CSSProperties}>
      {depth !== "flat" ? <button type="button" className="depth-replay" onClick={(event)=>{event.stopPropagation();setIntroReady(false);setPlaying(true);setReplay(value=>value+1);}}>{playing ? "Playing 3D…" : depth === "floating" ? "Replay intro ↻" : "Preview exit ↻"}</button> : null}
      {editable && <div className="depth-effects" onBlur={(event)=>{if(!event.currentTarget.contains(event.relatedTarget))setEffectsOpen(false);}}>
        <button ref={effectsButton} type="button" aria-expanded={effectsOpen} aria-haspopup="menu" onClick={(event) => {event.stopPropagation(); setEffectsOpen(!effectsOpen);}}>3D Effects</button>
        {effectsOpen ? <div role="menu" aria-label="3D Effects" onKeyDown={(event) => {
          if(event.key === "Escape") {event.stopPropagation();setEffectsOpen(false);effectsButton.current?.focus();}
          if(["ArrowDown","ArrowUp","Home","End"].includes(event.key)) {
            event.preventDefault();const items=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));const current=items.indexOf(document.activeElement as HTMLButtonElement);
            const next=event.key === "Home" ? 0 : event.key === "End" ? items.length-1 : (current+(event.key === "ArrowDown" ? 1 : -1)+items.length)%items.length;items[next]?.focus();
          }
        }}>
          {HERO_DEPTH_PRESETS.map((preset,index) => <button key={preset.value} autoFocus={index === 0} type="button" role="menuitemradio" aria-checked={depth === preset.value} onClick={(event) => {event.stopPropagation();onDepthChange(preset.value);setEffectsOpen(false);effectsButton.current?.focus();}}>{preset.label}<span>{preset.detail}</span></button>)}
        </div> : null}
      </div>}
      <div className="depth-copy">
        {template?.illustration && template.id !== "reference-02" && <TemplateIllustration kind={template.illustration} className="mb-3 h-20 w-20"/>}
        {location ? <p className="depth-location">{location}</p> : null}
        <h2 style={headingStyle}>{template?.id === "reference-02" ? <span className="reference-inline-title"><span>{(headline || name).split(" ").slice(0,1).join(" ")}</span>{" "}<TemplateIllustration kind={template.illustration || "ribbon"} className="reference-title-art"/><span>{(headline || name).split(" ").slice(1).join(" ")}</span></span> : <TemplateHeading text={headline || name || "Your storefront"} treatment={template?.headingTreatment} accentFamily={template?.accentHeadingFamily}/>}</h2>
        {description ? <p className="depth-description">{description}</p> : null}
        <button type="button" className="depth-book" onClick={(event) => { event.stopPropagation(); onBook(); }}>Request a quote <ArrowUpRight size={17} aria-hidden="true" /></button>
      </div>
      <div className="depth-scene" data-playing={playing && depth !== "flat"}>
        <div className="depth-regular-cover">{image ? <CroppedImage src={image} frameFit={image === logo ? "contain" : "cover"} crop={crop} alt={`${name || "Storefront"} cover`} loading="eager" className="h-full w-full object-cover" /> : <span className="depth-empty">Add a cover image</span>}</div>
        {playing && depth !== "flat" ? <div className={`depth-intro-layer ${introReady ? "intro-ready" : ""}`} key={replay}>
          <div className="depth-wordmark" aria-hidden="true">{name}</div>
          <div className="depth-stage-light" aria-hidden="true" />
          <div className="depth-floor-shadow" aria-hidden="true" />
          <StorefrontBrandSculpture onReady={finish} touchPreview={mobile} mount={mount} edgeColor={edgeColor} image={logo || image} name={name} interactive />
        </div> : null}

      </div>
    </div>
  );
}
