"use client";

import { useEffect, useRef, useState } from "react";
import { STOREFRONT_TEMPLATES, type StorefrontTemplate } from "@/lib/editor-preview/storefront-template-library";
import { STOREFRONT_FONT_STYLES } from "@/lib/businesses";

export function HeroTypographyControls({ subheadingFamily, onSubheading, value, onStyle, onCustomFont, onPairing, templateFonts, template, onTemplateFont }: { subheadingFamily?:string; onSubheading?:(family:string)=>void; value: string; onStyle: (value: string) => void; onCustomFont: (family: string | null) => void; onPairing?: (template: StorefrontTemplate)=>void; templateFonts?: string; template?: StorefrontTemplate | null; onTemplateFont?: (patch: Partial<StorefrontTemplate>)=>void }) {
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
  const fonts=STOREFRONT_TEMPLATES.filter((item,index,items)=>item.headingFamily && items.findIndex(other=>other.headingFamily?.replace(/\s/g,"")===item.headingFamily?.replace(/\s/g,""))===index);
  const current=fontPanel==='subheading' ? template?.subheadingFamily || subheadingFamily : template?.headingFamily;
  return <section className="mb-4 rounded-xl border bg-white p-3" aria-label="Font controls">
   <p className="mb-3 text-sm font-semibold">Fonts</p>
   <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Font toolbar">{(['heading','subheading','upload'] as const).map(panel=><button type="button" key={panel} aria-expanded={fontPanel===panel} onClick={()=>setFontPanel(fontPanel===panel?null:panel)} className="rounded-lg border px-3 py-2 text-xs aria-expanded:bg-stone-100">{panel==='heading'?'Heading font':panel==='subheading'?'Subheading font':'Upload font'}</button>)}</div>
   {fontPanel && fontPanel!=='upload' && <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border p-1" role="group" aria-label={fontPanel==='heading'?'Heading font options':'Subheading font options'}>{fonts.map(font=><button type="button" key={font.id} aria-pressed={current===font.headingFamily} className="block w-full rounded-md px-3 py-4 text-left text-xl leading-normal aria-pressed:bg-stone-100" style={{fontFamily:font.headingFamily,fontWeight:font.headingWeight}} onClick={()=>{if(fontPanel==='heading'){if(template && onTemplateFont){onCustomFont(null);onTemplateFont({headingFamily:font.headingFamily,headingWeight:font.headingWeight});}else onCustomFont(font.headingFamily || null);}else if(template && onTemplateFont)onTemplateFont({subheadingFamily:font.headingFamily,subheadingStyle:'normal'});else onSubheading?.(font.headingFamily || '');}}>{font.fonts.split(/ \+ | · /)[0]}{current===font.headingFamily && <span aria-hidden="true"> ✓</span>}</button>)}</div>}
   {fontPanel==='upload' && <label className="mt-3 block cursor-pointer rounded-xl border border-dashed p-5 text-center text-sm focus-within:ring-2">↑ Upload your heading font<input type="file" accept=".woff,.woff2,.ttf,.otf" className="sr-only" onChange={event=>{void loadFont(event.target.files?.[0]);event.target.value='';}}/><span className="mt-2 block text-xs text-muted-foreground">WOFF, WOFF2, TTF or OTF · up to 3 MB</span></label>}
   {message && <p role="status" className="mt-2 text-xs">{message}</p>}
  </section>;
}
