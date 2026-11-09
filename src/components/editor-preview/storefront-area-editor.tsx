"use client";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {Pencil,MapPin,X} from "lucide-react";
import {loadStorefrontLocation} from "@/app/actions/storefront-location";
import {BusinessLocationSettings} from "@/components/vendor/business-location-settings";
import {useSavedServiceAreas} from "@/components/location/use-saved-service-areas";
import {ServiceRadiusMap} from "@/components/location/service-radius-map";
type Business=Awaited<ReturnType<typeof loadStorefrontLocation>>;
export function StorefrontAreaEditor({businessId,previewOnly,onChange}:{businessId:string;previewOnly:boolean;onChange:(value:{city:string;state:string;serviceAreaNotes:string})=>void}){
 const [business,setBusiness]=useState<Business|null>(null),[error,setError]=useState(""),[open,setOpen]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null);
 const areas=useSavedServiceAreas(business?.serviceAreaNotes);
 useEffect(()=>{let active=true;loadStorefrontLocation(businessId).then(value=>{if(active)setBusiness(value);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[businessId]);
 useEffect(()=>{if(open)dialog.current?.showModal();},[open]);
 return <div className="mt-3 rounded-2xl border border-current/15 p-4" onClick={event=>event.stopPropagation()}>
  <button type="button" onClick={()=>setOpen(true)} className="mb-3 flex w-full items-center justify-between gap-3 text-left font-semibold"><span className="flex items-center gap-2"><MapPin size={18}/>Service area{business?` · ${business.serviceRadiusMiles} miles from ${business.city}`:""}</span><span className="flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-sm text-stone-700"><Pencil size={15}/>Edit</span></button>
  {business?.locationLat!=null&&business.locationLng!=null?<div onClick={event=>{if(!(event.target as Element).closest("a"))setOpen(true);}}><ServiceRadiusMap lat={business.locationLat} lng={business.locationLng} radius={business.serviceRadiusMiles} areas={areas} onChange={()=>setOpen(true)}/></div>:<button type="button" className="w-full rounded-xl border border-dashed bg-white/50 p-6 text-sm" onClick={()=>setOpen(true)}>{error||"Select your city to display and edit your service-area map."}</button>}
  {open&&createPortal(<dialog ref={dialog} aria-label="Edit service areas" onCancel={event=>{event.preventDefault();setOpen(false);}} onSubmit={event=>event.stopPropagation()} className="m-auto max-h-[90vh] w-[min(640px,94vw)] overflow-y-auto rounded-3xl border bg-[#fffaf8] p-6 shadow-xl backdrop:bg-black/25"><header className="flex items-center justify-between"><h2 className="text-xl font-semibold">Edit service areas</h2><button type="button" aria-label="Close service area editor" onClick={()=>setOpen(false)}><X size={22}/></button></header>{business?<BusinessLocationSettings business={business} previewOnly={previewOnly} onSaved={value=>{setBusiness(value);onChange({city:value.city,state:value.state??"",serviceAreaNotes:value.serviceAreaNotes??""});setOpen(false);}}/>:<p role="alert">{error||"Loading map…"}</p>}</dialog>,document.body)}
 </div>;
}
