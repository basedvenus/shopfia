"use client";
import {useId} from 'react';
import type {StorefrontTextStyle} from '@/lib/storefront-text-style';
function SpacingField({label,value,min,max,step,onChange}:{label:string;value:number;min:number;max:number;step:number;onChange:(value:number)=>void}) {
 const id=useId();
 return <div><label htmlFor={id} className="mb-3 block text-sm font-semibold">{label}</label><div className="flex items-center gap-4"><input id={id} type="range" min={min} max={max} step={step} value={value} onChange={event=>onChange(Number(event.target.value))} className="min-w-0 flex-1 accent-[#a9687b]"/><input aria-label={`${label} value`} type="number" min={min} max={max} step={step} value={value} onChange={event=>{if(event.target.value!=='')onChange(Math.max(min,Math.min(max,Number(event.target.value))));}} className="h-11 w-16 rounded-xl border border-stone-300 text-center text-sm"/></div></div>;
}
export function TextSpacingControl({style,onChange,controlClass}:{style:StorefrontTextStyle;onChange:(patch:StorefrontTextStyle)=>void;controlClass:string}) {
 return <details className="relative"><summary aria-label="Text spacing" title="Letter and line spacing" className={`${controlClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 6V3h10v3M12 3v10m-3 0h6M3 20h18M6 17l-3 3 3 3m12-6 3 3-3 3"/></svg></summary><div className="absolute right-0 z-50 grid w-72 max-w-[calc(100vw-32px)] gap-6 rounded-2xl border bg-white p-5 shadow-lg" aria-label="Text spacing settings"><SpacingField label="Letter spacing" min={-2} max={12} step={.1} value={style.letterSpacing??0} onChange={letterSpacing=>onChange({letterSpacing})}/><SpacingField label="Line spacing" min={.8} max={2.5} step={.1} value={style.lineHeight??1.4} onChange={lineHeight=>onChange({lineHeight})}/></div></details>;
}
