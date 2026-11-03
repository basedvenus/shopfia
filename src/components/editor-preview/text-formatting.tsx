"use client";
import {createContext,useContext,useState,useRef,useEffect,type FormEvent,type ReactNode} from 'react';
import {createPortal} from "react-dom";
import {AlignLeft,AlignCenter,AlignRight,List,ArrowLeftRight,Minus,Plus,X} from 'lucide-react';
import {ColorPicker,useTemplatePalette} from './color-picker';
import {STOREFRONT_TEMPLATES} from '@/lib/storefront-template-library';
import {textKey,textStyleCss,type StorefrontTextStyle} from '@/lib/storefront-text-style';
function fontName(font:string){return font.split(",")[0].replace(/var\(--font-(?:shopfia-|preview-)?([^)]*)\)/,"$1").replace(/["']/g,"").replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase());}
const Context=createContext<{textColor?:string;setTextColor?:(color:string)=>void;applyRole?:(role:string,patch:StorefrontTextStyle,all:boolean)=>void;toolbar?:ReactNode;fontPanel?:ReactNode;select:(label:string,value:string,change:(v:string)=>void)=>void}|null>(null);
export function useTextSelection(label:string,value:string,change:(v:string)=>void){const context=useContext(Context);const latest=useRef({value,change});latest.current={value,change};const select=()=>{window.dispatchEvent(new CustomEvent("storefront-selection",{detail:{kind:"text",id:textKey(label)}}));context?.select(label,value,next=>latest.current.change(next));};return {'data-storefront-text':textKey(label),onFocus:select,onClickCapture:select,onInput:(event:FormEvent<HTMLElement>)=>context?.select(label,(event.currentTarget as HTMLInputElement).value??value,next=>latest.current.change(next))};}
export function useSelectedTextColor(){const context=useContext(Context);return {color:context?.textColor,setColor:context?.setTextColor};}
export function useRoleFormatting(){return useContext(Context)?.applyRole;}
export function TextRoleSize({role,all,setAll}:{role:string;all:boolean;setAll:(value:boolean)=>void}){
 const context=useContext(Context);const [size,setSize]=useState(role==='heading'?32:role==='subheading'?24:16);
 const resize=(n:number)=>{n=Math.max(10,Math.min(120,n));setSize(n);context?.applyRole?.(role,{fontSize:n},true);};
 return <div className="mt-3 inline-flex h-10 items-center rounded-xl border border-stone-300 bg-white px-1"><button type="button" aria-label="Decrease font size" className="h-8 w-8" onClick={()=>resize(size-1)}><Minus size={16} className="mx-auto"/></button><input aria-label={`${role} font size`} type="number" min="10" max="120" value={size} onChange={e=>{if(e.target.value)resize(+e.target.value);}} className="w-14 border-0 bg-transparent p-0 text-center text-sm font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"/><button type="button" aria-label="Increase font size" className="h-8 w-8" onClick={()=>resize(size+1)}><Plus size={16} className="mx-auto"/></button></div>;
}
export function SelectedTextFonts(){return useContext(Context)?.fontPanel??null;}
export function TextFormattingToolbar(){
 const toolbar=useContext(Context)?.toolbar;
 const anchor=useRef<HTMLDivElement>(null);
 const [position,setPosition]=useState<{top:number;left:number;width:number}|null>(null);
 useEffect(()=>{
  if(!toolbar)return;
  const canvas=anchor.current?.closest('.editor-canvas');if(!canvas)return;
  const measure=()=>{const rect=canvas.getBoundingClientRect();const next={top:Math.max(8,rect.top+8),left:Math.max(8,rect.left+8),width:Math.max(0,Math.min(rect.right,window.innerWidth)-Math.max(0,rect.left)-16)};setPosition(previous=>previous&&previous.top===next.top&&previous.left===next.left&&previous.width===next.width?previous:next);};
  measure();const observer=new ResizeObserver(measure);observer.observe(canvas);
  window.addEventListener('scroll',measure,true);window.addEventListener('resize',measure);
  return()=>{observer.disconnect();window.removeEventListener('scroll',measure,true);window.removeEventListener('resize',measure);};
 },[Boolean(toolbar)]);
 return <><div ref={anchor}/>{toolbar&&position&&createPortal(<div data-floating-text-toolbar style={{position:'fixed',top:position.top,left:position.left,maxWidth:position.width,zIndex:60}}>{toolbar}</div>,document.body)}</>;
}
export function TextFormatting({styles,onChange,children,onOpenFonts,onOpenColors}:{onOpenColors:()=>void;styles:Record<string,StorefrontTextStyle>;onChange:(styles:Record<string,StorefrontTextStyle>)=>void;children:ReactNode;onOpenFonts:()=>void}){
 const palette=useTemplatePalette();
 const [colorOpen,setColorOpen]=useState(false);
 const [selected,setSelected]=useState<{label:string;value:string;change:(v:string)=>void;defaults?:StorefrontTextStyle;family?:string;color?:string}|null>(null);
 useEffect(()=>{const clear=(event:Event)=>{if((event as CustomEvent).detail?.kind!=="text"){setSelected(null);setColorOpen(false);}};window.addEventListener("storefront-selection",clear);return()=>window.removeEventListener("storefront-selection",clear);},[]);
 const key=selected?textKey(selected.label):'',style={...selected?.defaults,...styles[key]};
 const roleFor=(id:string)=>/subheading|tagline|subtitle|supporting/.test(id)?'subheading':/headline|heading|title|name/.test(id)?'heading':'body';
 const update=(patch:StorefrontTextStyle)=>{const next={...styles,[key]:{...style,...patch}};if(patch.fontFamily){const role=roleFor(key);next[`role-${role}`]={...next[`role-${role}`],fontFamily:patch.fontFamily};for(const node of document.querySelectorAll<HTMLElement>('.editor-canvas [data-storefront-text]')){const id=node.dataset.storefrontText!;if(roleFor(id)===role)next[id]={...next[id],fontFamily:patch.fontFamily};}}onChange(next);};
 const fonts=Array.from(new Set(STOREFRONT_TEMPLATES.flatMap(t=>[t.headingFamily,t.bodyFamily,t.subheadingFamily]).filter((v):v is string=>Boolean(v))));
 const control="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#202126] hover:bg-[#f0f0f3] aria-pressed:bg-[#e6e7eb]";
 const size=style.fontSize??24;
 const Alignment=style.textAlign==='center'?AlignCenter:style.textAlign==='right'?AlignRight:AlignLeft;
 const toolbar=selected&&<div role="toolbar" aria-label={`Format ${selected.label}`} className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-2xl border border-[#dedee7] bg-white p-1.5 text-[#202126] shadow-[0_3px_12px_rgba(74,65,115,0.16)]" style={{fontFamily:'Arial, sans-serif'}} onPointerDown={e=>{if(e.target instanceof Element&&e.target.closest('button'))e.preventDefault();}}>
 <button type="button" aria-label="Choose text font" onClick={onOpenFonts} className="h-8 w-32 truncate rounded-xl border border-[#d5d6dd] bg-[#f4f4f6] px-3 text-left text-sm font-semibold">{style.fontFamily?fontName(style.fontFamily):selected.family?fontName(selected.family):'Font'}</button>
 <div className="flex h-8 items-center rounded-xl border border-[#d5d6dd] px-1"><button type="button" aria-label="Decrease font size" className={control} onClick={()=>update({fontSize:Math.max(10,size-1)})}><Minus size={15}/></button><input type="number" aria-label="Font size" min="10" max="120" step=".1" value={size} onChange={e=>{if(e.target.value)update({fontSize:Math.max(10,Math.min(120,+e.target.value))});}} className="w-11 border-0 bg-transparent p-0 text-center text-sm font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"/><button type="button" aria-label="Increase font size" className={control} onClick={()=>update({fontSize:Math.min(120,size+1)})}><Plus size={15}/></button></div>
 <button type="button" aria-label="Text color" className={control} onClick={onOpenColors}><span className="relative pb-1 text-2xl font-medium leading-none">A<span className="absolute bottom-0 left-0 h-1 w-full rounded-full" style={{background:style.color??selected.color??'#202126'}}/></span></button>
 {([{label:'Bold',text:'B',active:style.fontWeight===700,patch:{fontWeight:style.fontWeight===700?400:700}},{label:'Italic',text:'I',active:style.fontStyle==='italic',patch:{fontStyle:style.fontStyle==='italic'?'normal':'italic'}},{label:'Underline',text:'U',active:style.textDecoration==='underline',patch:{textDecoration:style.textDecoration==='underline'?'none':'underline'}}] as const).map(item=><button type="button" key={item.label} aria-label={item.label} aria-pressed={item.active} onClick={()=>update(item.patch)} className={control} style={{fontSize:23,fontFamily:item.label==='Italic'?'Georgia, serif':undefined,fontWeight:item.label==='Bold'?700:400,fontStyle:item.label==='Italic'?'italic':'normal',textDecoration:item.label==='Underline'?'underline':'none',textUnderlineOffset:4}}>{item.text}</button>)}
 <button type="button" aria-label={`Text alignment: ${style.textAlign??'left'}. Change alignment`} className={control} onClick={()=>update({textAlign:style.textAlign==='left'||!style.textAlign?'center':style.textAlign==='center'?'right':'left'})}><Alignment size={22}/></button>
 <button type="button" aria-label="Bullet points" className={control} onClick={()=>{const lines=selected.value.split('\n'),remove=lines.every(line=>line.startsWith('• '));const value=lines.map(line=>remove?line.slice(2):'• '+line.replace(/^• /,'')).join('\n');selected.change(value);setSelected({...selected,value});}}><List size={22}/></button>
 <details className="relative"><summary aria-label="Text spacing" className={`${control} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}><ArrowLeftRight size={21}/></summary><div className="absolute right-0 z-50 w-56 rounded-2xl border bg-white p-4 shadow-lg"><label className="grid gap-2 text-xs">Letter spacing<input type="range" min="-2" max="12" step=".5" value={style.letterSpacing??0} onChange={e=>update({letterSpacing:+e.target.value})}/></label><label className="mt-4 grid gap-2 text-xs">Line spacing<input type="range" min=".8" max="2.5" step=".1" value={style.lineHeight??1.4} onChange={e=>update({lineHeight:+e.target.value})}/></label></div></details>
 <button type="button" aria-label="Close text toolbar" onClick={()=>{setSelected(null);setColorOpen(false);}} className={control}><X size={15}/></button></div>;
 return <Context.Provider value={{textColor:style.color??selected?.color,setTextColor:color=>update({color}),applyRole:(role,patch,all)=>{
 const next={...styles,[`role-${role}`]:{...styles[`role-${role}`],...patch}};
 const nodes=Array.from(document.querySelectorAll<HTMLElement>('.editor-canvas [data-storefront-text]'));
 const matching=nodes.filter(el=>roleFor(el.dataset.storefrontText??'')===role);
 const keys=all?matching.map(el=>el.dataset.storefrontText!):[key||matching[0]?.dataset.storefrontText].filter((v):v is string=>Boolean(v));
 for(const id of keys)next[id]={...next[id],...patch};onChange(next);
 },toolbar,fontPanel:selected?<section className="mb-4 rounded-2xl border bg-white p-3"><h3 className="mb-3 text-sm font-semibold">Font · {selected.label}</h3><div className="grid max-h-80 gap-1 overflow-y-auto">{fonts.map(font=><button key={font} type="button" style={{fontFamily:font}} onClick={()=>update({fontFamily:font})} className="rounded-lg p-2 text-left hover:bg-stone-100">{fontName(font)}</button>)}</div></section>:null,select:(label,value,change)=>{window.dispatchEvent(new CustomEvent("storefront-selection",{detail:{kind:"text",id:textKey(label)}}));const el=document.querySelector(`[data-storefront-text="${textKey(label)}"]`);const css=el?getComputedStyle(el):null;setSelected({label,value,change,family:css?.fontFamily,color:css?.color.match(/\d+/g)?.slice(0,3).map(v=>Number(v).toString(16).padStart(2,'0')).join('').replace(/^/,'#'),defaults:css?{fontSize:Math.round(parseFloat(css.fontSize)),fontWeight:parseInt(css.fontWeight)||400,fontStyle:css.fontStyle as StorefrontTextStyle["fontStyle"],textAlign:css.textAlign as StorefrontTextStyle["textAlign"]}:undefined});}}}><style>{textStyleCss(styles)}</style>{children}</Context.Provider>;
}
