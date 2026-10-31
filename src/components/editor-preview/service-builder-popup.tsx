"use client";
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {OfferingSetupForm} from '@/components/vendor/offering-setup-form';
import {loadStorefrontServiceBuilder} from '@/app/actions/storefront-service-builder';
type Data=Awaited<ReturnType<typeof loadStorefrontServiceBuilder>>;
export function ServiceBuilderPopup({businessId,previewOnly,onClose,onSaved}:{businessId:string;previewOnly:boolean;onClose:()=>void;onSaved:(services:Data['services'])=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState('');
 useEffect(()=>{dialog.current?.showModal();let active=true;loadStorefrontServiceBuilder(businessId,previewOnly).then(value=>{if(active)setData(value);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[businessId,previewOnly]);
 return createPortal(<dialog onSubmit={event=>event.stopPropagation()} ref={dialog} aria-label="Add service" onCancel={e=>{e.preventDefault();onClose();}} className="m-auto max-h-[90vh] w-[min(960px,94vw)] overflow-y-auto rounded-3xl border border-[#eadbd7] bg-[#fffaf8] p-6 shadow-xl backdrop:bg-black/25"><header className="sticky top-0 z-10 mb-5 flex items-center justify-between bg-[#fffaf8] py-3"><h2 className="text-xl font-semibold">Add service</h2><button type="button" onClick={onClose} className="rounded-full border px-4 py-2">Back to storefront</button></header>{error?<p role="alert">{error}</p>:data?<OfferingSetupForm businessId={businessId} categories={data.categories} eventCategories={data.eventCategories} previewOnly={previewOnly} onSaved={()=>{loadStorefrontServiceBuilder(businessId).then(value=>{onSaved(value.services);onClose();}).catch(()=>setError('Service saved. Close this window and reopen Services to refresh.'));}}/>:<p role="status">Loading service builder…</p>}</dialog>,document.body);
}
