"use client";
import { ColorPicker } from "./color-picker";
import type { SectionDesign, StorefrontTemplate } from "@/lib/editor-preview/storefront-template-library";
import { getSectionDesign, SECTION_PATTERNS } from "@/lib/editor-preview/template-section-design";
export function SectionBackgroundControls({template,section,label,onChange}:{template:StorefrontTemplate;section:string;label:string;onChange:(template:StorefrontTemplate)=>void}) {
 const design=getSectionDesign(template,section);
 const palette=Array.from(new Set(Object.values(template.colors)));
 function update(patch:Partial<SectionDesign>){onChange({...template,sectionDesigns:{...template.sectionDesigns,[section]:{...design,...patch}}});}
 return <section className="mb-4 rounded-2xl border border-[#eadbd7] bg-[#fffaf8] p-4">
 <h3 className="text-sm font-semibold">Background colors and patterns</h3>
 <p className="mt-2 text-xs text-muted-foreground">Click the section you want to edit.</p>
 <p className="my-4 rounded-xl bg-stone-100 px-3 py-2 text-sm font-medium">{label}</p>
 <p className="mb-2 text-xs font-semibold">Your template palette</p>
 <div className="mb-5 flex flex-wrap gap-2">{palette.map(color=><button type="button" key={color} title={color} aria-label={`Set ${label} background to ${color}`} aria-pressed={design.background===color} onClick={()=>update({background:color})} style={{background:color}} className="h-8 w-8 rounded-full border border-stone-300 aria-pressed:ring-2 aria-pressed:ring-[#b77980] aria-pressed:ring-offset-2"/>)}</div>
 <div className="grid grid-cols-2 gap-4">{([['background','Background'],['ink','Text color'],['patternColor','Pattern color']] as const).map(([key,title])=><ColorPicker key={key} label={title} value={design[key]??"#ffffff"} onChange={value=>update({[key]:value})}/>)}</div>
 <label className="mt-4 grid gap-2 text-xs">Pattern opacity · {Math.round((design.patternOpacity??1)*100)}%<input type="range" min="0" max="100" value={(design.patternOpacity??1)*100} onChange={e=>update({patternOpacity:+e.target.value/100})}/></label><p className="mb-2 mt-5 text-xs font-semibold">Pattern</p><div className="grid grid-cols-2 gap-2">{SECTION_PATTERNS.map(pattern=><button type="button" key={pattern} aria-pressed={design.pattern===pattern} onClick={()=>update({pattern})} className="rounded-xl border border-[#eadbd7] p-2 text-xs capitalize hover:bg-stone-100 aria-pressed:bg-stone-200">{pattern}</button>)}</div>
 <details className="mt-5"><summary>Buttons</summary><div className="mt-3 grid grid-cols-2 gap-3"><ColorPicker label="Button color" value={template.buttonColor??template.colors.accent} onChange={value=>onChange({...template,buttonColor:value})}/><ColorPicker label="Button text" value={template.colors.accentInk} onChange={value=>onChange({...template,colors:{...template.colors,accentInk:value}})}/></div></details>
 </section>;
}
