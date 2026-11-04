"use client";
import {useEffect,useState} from "react";
import {loadServicePresets,removeServicePreset} from "@/app/actions/service-presets";
import {servicePresetInput,type ServicePresetInput,type SavedServicePreset} from "@/lib/service-presets";
import {Button,type ButtonProps} from "@/components/ui/button";
function PricingButton(props:ButtonProps){return <Button variant="secondary" {...props}/>;}
export function useServicePresetLibrary(businessId?:string,previewOnly=false){
 const [items,setItems]=useState<SavedServicePreset[]>([]),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const key=`shopfia-service-presets-preview:${businessId??"demo"}`;
 useEffect(()=>{let active=true;setItems([]);setNotice("");
  if(previewOnly){try{const values=JSON.parse(localStorage.getItem(key)??"[]") as SavedServicePreset[];setItems(values.filter(item=>typeof item.id==="string"&&servicePresetInput.safeParse(item).success));}catch{setNotice("Saved preview items could not be loaded.");}}
  else if(businessId)loadServicePresets(businessId).then(values=>{if(active)setItems(values);}).catch(()=>{if(active)setNotice("Saved items could not be loaded. You can still build this service; try reopening it to retry.");});
  const reload=()=>{try{setItems(JSON.parse(localStorage.getItem(key)??"[]"));}catch{setNotice("Saved preview items could not be loaded.");}};
  if(previewOnly)window.addEventListener("shopfia-presets-updated",reload);
  return()=>{active=false;window.removeEventListener("shopfia-presets-updated",reload);};
 },[businessId,previewOnly,key]);
 function persist(next:SavedServicePreset[]){if(previewOnly)localStorage.setItem(key,JSON.stringify(next));setItems(next);}
 async function remove(id:string){if(busy)return;setBusy(true);try{if(!previewOnly){if(!businessId)throw new Error("Choose a business first.");await removeServicePreset(businessId,id);}persist(items.filter(item=>item.id!==id));setNotice("Removed from saved items. Existing services are unchanged.");}catch{setNotice("Could not remove this saved item. Please try again.");}finally{setBusy(false);}}
 return {items,notice,busy,remove};
}
export function ServicePresetChoices({kind,items,busy,onApply,onRemove}:{kind:ServicePresetInput["kind"];items:SavedServicePreset[];busy:boolean;onApply:(item:SavedServicePreset)=>void;onRemove:(id:string)=>void}){
 const saved=items.filter(item=>item.kind===kind);
 if(!saved.length)return null;
 return <div className="sp-disclosure"><h3>{kind==="options"?"Your saved options and menus":"Your saved add-ons"}</h3><p className="sp-note">Apply an editable copy. Changes here will not affect other services.</p>{saved.map(item=><div key={item.id} className="flex flex-wrap items-center gap-2 py-2"><PricingButton type="button" disabled={busy} onClick={()=>onApply(item)}>Use {item.name}</PricingButton><small>{item.kind==="options"?`${item.payload.options.length} ${item.payload.options.length===1?"choice":"choices"}`:item.payload.type==="quoted"?"Quoted separately":`$${((item.payload.rate??0)/100).toFixed(2)} · ${item.payload.type==="hour"?"per hour":item.payload.type==="person"?"per person":item.payload.type==="item"?"per item":"flat fee"}`}</small><PricingButton type="button" className="sp-link" disabled={busy} aria-label={`Remove saved ${item.name}`} onClick={()=>onRemove(item.id)}>Remove saved</PricingButton></div>)}</div>;
}
