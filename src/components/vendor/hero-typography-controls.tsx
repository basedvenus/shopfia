"use client";

import { useEffect, useRef, useState } from "react";
import { STOREFRONT_TEMPLATES, type StorefrontTemplate } from "@/lib/storefront-template-library";
import { STOREFRONT_FONT_STYLES } from "@/lib/businesses";

export function HeroTypographyControls({ allowUpload = true, value, onStyle, onCustomFont, onPairing, templateFonts, template, onTemplateFont }: { allowUpload?: boolean; value: string; onStyle: (value: string) => void; onCustomFont: (family: string | null) => void; onPairing?: (template: StorefrontTemplate)=>void; templateFonts?: string; template?: StorefrontTemplate | null; onTemplateFont?: (patch: Partial<StorefrontTemplate>)=>void }) {
  const [fontPanel,setFontPanel]=useState<"heading"|"subheading"|"upload"|null>(null);
  const loadedFont = useRef<FontFace | null>(null);
  const request = useRef(0);
  const [message, setMessage] = useState("");
  const [pairKey, setPairKey] = useState("");
  const [hasCustomFont, setHasCustomFont] = useState(false);
  useEffect(() => () => {request.current++; if(loadedFont.current) document.fonts.delete(loadedFont.current);}, []);
  async function loadFont(file?: File) {
    const id=++request.current;
    if(!file)return;
    if(!/\.(woff2?|ttf|otf)$/i.test(file.name) || file.size>3*1024*1024) {setMessage("Choose a WOFF, WOFF2, TTF, or OTF font under 3 MB.");return;}
    setMessage("Loading font…");
    try {
      const family=`ShopFiaPreviewFont${Date.now()}`;
      const font=await new FontFace(family,await file.arrayBuffer()).load();
      if(id!==request.current)return;
      if(loadedFont.current)document.fonts.delete(loadedFont.current);
      document.fonts.add(font);loadedFont.current=font;onCustomFont(family);setHasCustomFont(true);setMessage("Your font is applied in this preview only.");
    } catch {if(id===request.current)setMessage("This font could not be loaded. Try another font file.");}
  }
  if(template && onTemplateFont) {
    const fonts=STOREFRONT_TEMPLATES.filter((item,index,items)=>item.headingFamily && items.findIndex(other=>other.headingFamily?.replace(/\s/g,"")===item.headingFamily?.replace(/\s/g,""))===index);
    const current=fontPanel==='subheading' ? template.subheadingFamily || template.headingFamily : template.headingFamily;
    return <section className="mb-4 rounded-xl border bg-white p-3" aria-label="Font controls"><p className="mb-2 text-xs font-semibold">Font</p><div className="flex flex-wrap gap-2" role="toolbar" aria-label="Font toolbar">{(['heading','subheading',...(allowUpload ? ['upload' as const] : [])] as const).map(panel=><button type="button" key={panel} aria-expanded={fontPanel===panel} onClick={()=>setFontPanel(fontPanel===panel?null:panel)} className="rounded-lg border px-3 py-2 text-xs aria-expanded:bg-stone-100">{panel==='heading'?'Heading font':panel==='subheading'?'Subheading font':'Upload font'}</button>)}</div>
    {fontPanel && fontPanel!=='upload' && <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border p-1" role="group" aria-label={fontPanel==='heading'?'Heading font options':'Subheading font options'}>{fonts.map(font=><button type="button" key={font.id} aria-pressed={current===font.headingFamily} className="flex w-full items-center justify-between rounded-md p-3 text-left text-lg aria-pressed:bg-stone-100" style={{fontFamily:font.headingFamily}} onClick={()=>{if(fontPanel==='heading'){onCustomFont(null);onTemplateFont({headingFamily:font.headingFamily,headingWeight:font.headingWeight});}else onTemplateFont({subheadingFamily:font.headingFamily,subheadingStyle:'normal'});}}>{font.fonts.split(/ \+ | · /)[0]}{current===font.headingFamily && <span aria-hidden="true">✓</span>}</button>)}</div>}
    {fontPanel==='upload' && <label className="mt-3 block text-xs">Upload heading font<input type="file" accept=".woff,.woff2,.ttf,.otf" className="mt-2 w-full" onChange={event=>{void loadFont(event.target.files?.[0]);event.target.value='';}}/><span className="mt-2 block">WOFF, WOFF2, TTF, or OTF · up to 3 MB</span></label>}{message && <p role="status" className="mt-2 text-xs">{message}</p>}</section>;
  }
  return <details className="mb-4 rounded-xl border p-3"><summary>Font</summary>
    <div className="mt-4 space-y-4">
      <label className="block text-xs font-medium">Font pairing<select aria-label="Font pairing" value={pairKey || value} onChange={(event)=>{request.current++;onCustomFont(null);setHasCustomFont(false);setMessage("");if(loadedFont.current){document.fonts.delete(loadedFont.current);loadedFont.current=null;}if(event.target.value.startsWith("template:")){const pair=STOREFRONT_TEMPLATES.find(item=>`template:${item.id}`===event.target.value);setPairKey(event.target.value);if(pair)onPairing?.(pair);}else{setPairKey("");onStyle(event.target.value);}}} className="mt-2 h-10 w-full rounded-lg border bg-white px-3 text-sm">{STOREFRONT_FONT_STYLES.map(font=><option value={font.value} key={font.value}>{font.value === value && templateFonts && !pairKey ? templateFonts : font.description.split(".")[0]}</option>)}{onPairing ? STOREFRONT_TEMPLATES.filter((item,index,items)=>item.headingFamily && items.findIndex(other=>other.fonts===item.fonts)===index && (pairKey || item.fonts!==templateFonts)).map(item=><option key={item.id} value={`template:${item.id}`}>{item.fonts}</option>) : null}</select></label>
      {allowUpload && <label className="block text-xs font-medium">Use your own font<input type="file" accept=".woff,.woff2,.ttf,.otf" className="mt-2 block w-full text-xs" onChange={(event)=>{void loadFont(event.target.files?.[0]);event.target.value="";}} /></label>}
      {message ? <p role="status" className="text-[11px] leading-5 text-muted-foreground">{message}</p> : null}
      {hasCustomFont ? <button type="button" className="text-xs underline" onClick={()=>{request.current++;onCustomFont(null);setHasCustomFont(false);setMessage("");if(loadedFont.current){document.fonts.delete(loadedFont.current);loadedFont.current=null;}}}>Use selected pairing</button> : null}
      {allowUpload && <p className="text-[11px] leading-5 text-muted-foreground">WOFF, WOFF2, TTF, or OTF · up to 3 MB.</p>}
    </div>
  </details>;
}
