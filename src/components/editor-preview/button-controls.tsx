"use client";
import {useState} from "react";
import {ColorPicker} from "./color-picker";
import {getSectionDesign} from "@/lib/editor-preview/template-section-design";
import type {SectionDesign,StorefrontTemplate} from "@/lib/editor-preview/storefront-template-library";
export function ButtonControls({template,section,onChange}:{template:StorefrontTemplate;section:string;onChange:(value:StorefrontTemplate)=>void}) {
 const [allColors,setAllColors]=useState(false),[allShapes,setAllShapes]=useState(false);
 const design=getSectionDesign(template,section);
 const color=design.buttonColor??template.buttonColor??template.colors.accent;
 const ink=design.buttonInk??template.colors.accentInk;
 const shape=design.buttonShape??template.button??"pill";
 function update(patch:Partial<SectionDesign>,global=false){
  const colors=patch.buttonColor!==undefined||patch.buttonInk!==undefined;
  if(global||(colors?allColors:allShapes)){
   const sectionDesigns=Object.fromEntries(Object.entries(template.sectionDesigns??{}).map(([key,value])=>{const next={...value};if(colors){delete next.buttonColor;delete next.buttonInk;}else delete next.buttonShape;return [key,next];}));
   onChange({...template,sectionDesigns,...(colors?{buttonColor:patch.buttonColor??color,colors:{...template.colors,accentInk:patch.buttonInk??ink}}:{button:patch.buttonShape??shape})});
  }else onChange({...template,sectionDesigns:{...template.sectionDesigns,[section]:{...design,...patch}}});
 }
 return <section data-button-settings className="rounded-2xl border bg-[#fffaf8] p-4">
  <h3 className="mb-4 font-semibold">Buttons</h3>
  <label className="grid gap-2 text-sm font-medium">Button label<input aria-label="Button label" className="w-full rounded-xl border bg-white px-3 py-2 text-base font-normal" maxLength={60} value={template.buttonText??"Request a quote"} placeholder="e.g. Request a quote" onChange={event=>onChange({...template,buttonText:event.target.value})}/></label>
  <p className="mt-2 text-xs text-stone-500">The text customers see on your booking buttons.</p>
  <div className="mt-4 grid grid-cols-2 gap-3"><ColorPicker label="Button color" value={color} onChange={buttonColor=>update({buttonColor})}/><ColorPicker label="Button text color" value={ink} onChange={buttonInk=>update({buttonInk})}/></div>
  <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={allColors} onChange={e=>{setAllColors(e.target.checked);if(e.target.checked)update({buttonColor:color,buttonInk:ink},true);}}/>Change All</label>
  <p className="mb-2 mt-5 text-sm font-medium">Button shape</p>
  <div role="group" aria-label="Button shape" className="flex gap-2">{(["pill","block"] as const).map(value=><button key={value} type="button" aria-pressed={shape===value} onClick={()=>update({buttonShape:value})} className="border px-4 py-2 text-sm aria-pressed:bg-[#f5e7e6]" style={{borderRadius:value==="pill"?999:0}}>{value==="pill"?"Rounded":"Square"}</button>)}</div>
  <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={allShapes} onChange={e=>{setAllShapes(e.target.checked);if(e.target.checked)update({buttonShape:shape==="pill"?"pill":"block"},true);}}/>Change All</label>
 </section>;
}
