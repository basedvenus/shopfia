"use client";

import { TemplateIllustration } from "./template-illustration";
import { useState } from "react";
import type { SectionDesign, StorefrontTemplate } from "@/lib/storefront-template-library";
import { getSectionDesign, SECTION_PATTERNS } from "@/lib/template-section-design";

export function SectionBackgroundControls({ template, section, label, onChange }: { template: StorefrontTemplate; section: string; label: string; onChange: (template: StorefrontTemplate)=>void }) {
  const [scope,setScope]=useState<"section"|"page">("section");
  const design:SectionDesign=scope === "page" ? template.backgroundDesign ?? {background:template.colors.background,ink:template.colors.ink,pattern:"solid",patternColor:template.colors.secondary,overlayColor:"#ffffff",overlayOpacity:0} : getSectionDesign(template,section);
  function update(patch:Partial<SectionDesign>) {
    const next={...design,...patch};
    onChange(scope === "page" ? {...template,backgroundDesign:next} : {...template,sectionDesigns:{...template.sectionDesigns,[section]:next}});
  }
  return <details className="mb-4 rounded-xl border p-3"><summary className="cursor-pointer text-xs font-semibold">Backgrounds & illustrations</summary><div className="mt-4 space-y-4 text-xs">
    {section === "hero" && <fieldset><legend className="mb-2 font-semibold">Illustrations</legend><div className="grid grid-cols-3 gap-2">{([undefined,"ribbon","botanical","bouquet","cake","balloons","citrus","sparkle"] as const).map(kind=><button key={kind ?? "none"} type="button" aria-label={`Use ${kind ?? "no"} illustration`} aria-pressed={template.illustration===kind} onClick={()=>onChange({...template,illustration:kind})} className="grid justify-items-center gap-1 rounded-lg border p-2 aria-pressed:bg-stone-100" style={{color:template.colors.ink}}>{kind ? <TemplateIllustration kind={kind} className="h-9 w-9"/> : <span className="grid h-9 place-items-center">—</span>}<span>{kind === "botanical" ? "Flower" : kind === "ribbon" ? "Bow" : kind ?? "None"}</span></button>)}</div></fieldset>}
    <label className="grid gap-2">Editing<select aria-label="Background area" value={scope} onChange={event=>setScope(event.target.value as "section"|"page")} className="h-10 w-full rounded-lg border bg-white px-2"><option value="section">{label} section</option><option value="page">Page backdrop</option></select></label>
    <label className="grid gap-2">Pattern<select aria-label="Background pattern" value={design.pattern} onChange={event=>update({pattern:event.target.value as SectionDesign["pattern"]})} className="h-10 w-full rounded-lg border bg-white px-2">{SECTION_PATTERNS.map(pattern=><option key={pattern} value={pattern}>{pattern[0].toUpperCase()+pattern.slice(1)}</option>)}</select></label>
    <div className="grid grid-cols-3 gap-3">{([['background','Base'],['patternColor','Pattern'],['ink','Text']] as const).map(([key,title])=><label key={key} className="grid gap-2">{title}<input aria-label={`Section ${title.toLowerCase()} color`} type="color" value={design[key] ?? '#ffffff'} onChange={event=>update({[key]:event.target.value})} className="h-9 w-full rounded border"/></label>)}</div>
    <div className="flex items-center justify-between"><label htmlFor="section-overlay-color">Overlay color</label><input id="section-overlay-color" type="color" value={design.overlayColor ?? '#ffffff'} onChange={event=>update({overlayColor:event.target.value})} className="h-8 w-12 rounded border"/></div>
    <label className="grid gap-2">Overlay · {Math.round((design.overlayOpacity ?? 0)*100)}%<input aria-label="Background overlay strength" type="range" min="0" max="80" step="5" value={Math.round((design.overlayOpacity ?? 0)*100)} onChange={event=>update({overlayOpacity:Number(event.target.value)/100})}/></label>
  </div></details>;
}
