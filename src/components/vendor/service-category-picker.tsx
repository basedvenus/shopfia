"use client";
type Category={id:string;name:string};
export {PET_PARTY_OPTION_ID,eventTypeOptions} from "@/lib/service-event-types";
export function ServiceCategoryPicker({label,name,options,selected,onChange,required=false,error}:{label:string;name:string;options:Category[];selected:string[];onChange:(ids:string[])=>void;required?:boolean;error?:string}){
 const chosen=options.filter(option=>selected.includes(option.id));
 const all=options.length>0&&options.every(option=>selected.includes(option.id));
 return <div className="space-y-2" role="group" aria-label={label} data-field-label={label} data-invalid={Boolean(error)}>
  <label className="text-sm font-semibold">{label}{required&&<span className="sp-required"> *</span>}</label>
  <details className="rounded-2xl border border-[#eadbd7] bg-white"><summary className="cursor-pointer px-4 py-3 text-sm">{chosen.length?chosen.map(option=>option.name).join(", "):`Select ${label.toLowerCase()}`}</summary><div className="grid max-h-72 gap-3 overflow-auto border-t p-4">
   <label className="flex items-center gap-3 border-b pb-3 text-sm font-semibold"><input type="checkbox" checked={all} onChange={event=>onChange(event.target.checked?options.map(option=>option.id):[])}/>Select all</label>
   {options.map(option=><label key={option.id} className="flex items-center gap-3 text-sm"><input type="checkbox" name={name} value={option.id} checked={selected.includes(option.id)} onChange={event=>onChange(event.target.checked?[...selected,option.id]:selected.filter(id=>id!==option.id))}/>{option.name}</label>)}
  </div></details>{error&&<p role="alert" className="sp-field-error">{error}</p>}
 </div>;
}
