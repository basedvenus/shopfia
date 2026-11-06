"use client";
export function ChoiceLimitStepper({value,max,onChange}:{value:number;max:number;onChange:(value:number)=>void}){
 const count=Math.max(0,Math.min(max,value));
 return <div className="inline-flex w-fit items-center rounded-xl border border-[#d7d4df] bg-white p-1" role="group" aria-label="Maximum choices"><button type="button" aria-label="Decrease maximum choices" disabled={count<=1} onClick={()=>onChange(count-1)} className="h-8 w-8 text-lg disabled:opacity-30">−</button><output className="min-w-8 text-center text-sm font-semibold" aria-live="polite">{count}</output><button type="button" aria-label="Increase maximum choices" disabled={count>=max} onClick={()=>onChange(count+1)} className="h-8 w-8 text-lg disabled:opacity-30">+</button></div>;
}
