"use client";
import {useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {PlaceAutocompleteInput} from "@/components/location/place-autocomplete-input";
import {ServiceRadiusMap} from "@/components/location/service-radius-map";
import {ServiceAreaPicker} from "@/components/vendor/service-area-picker";
import {updateBusinessLocationAction} from "@/app/actions/business-location";
import {Button} from "@/components/ui/button";
import type {PlaceDetails} from "@/lib/places";
type Business={id:string;city:string;state:string|null;formattedAddress:string|null;googlePlaceId:string|null;locationLat:number|null;locationLng:number|null;serviceRadiusMiles:number;serviceAreaNotes:string|null};
export function BusinessLocationSettings({business}:{business:Business}) {
 const router=useRouter();
 const [place,setPlace]=useState<Partial<PlaceDetails>>({city:business.city,state:business.state??'',formattedAddress:business.formattedAddress||[business.city,business.state].filter(Boolean).join(', '),placeId:business.googlePlaceId??'',lat:business.locationLat??undefined,lng:business.locationLng??undefined});
 const [areas,setAreas]=useState<PlaceDetails[]>([]);
 const [radius,setRadius]=useState(business.serviceRadiusMiles);
 const [pending,setPending]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function save(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();if(pending)return;
  const form=new FormData(event.currentTarget);setPending(true);setError('');setMessage('');
  try {
   const result=await updateBusinessLocationAction({businessId:business.id,city:place.city??'',state:place.state??'',formattedAddress:place.formattedAddress??'',googlePlaceId:place.placeId??'',lat:place.lat??null,lng:place.lng??null,radius,serviceAreaNotes:String(form.get('serviceAreaNotes')??'')});
   if(result.ok){setMessage('Business details saved. Your live storefront is updated.');router.refresh();}else setError(result.error??'Your changes could not be saved.');
  }catch{setError('Your changes could not be saved. Please try again.');}finally{setPending(false);}
 }
 return <form onSubmit={save} className="mt-4 space-y-4">
  <fieldset disabled={pending} className="space-y-4">
   <PlaceAutocompleteInput label="Business city" searchType="cities" placeholder="Start typing your city" required requireSelection defaultPlace={place} defaultValue={place.formattedAddress} fieldNames={{input:'businessCitySearch'}} omitHiddenFields onPlaceSelect={setPlace} helperText="Select a city from Google suggestions to place it on the map."/>
   {place.lat!=null&&place.lng!=null?<ServiceRadiusMap key={`${place.lat}:${place.lng}`} lat={place.lat} lng={place.lng} radius={radius} onChange={setRadius} areas={areas}/>:<p className="rounded-xl bg-white p-3 text-sm text-muted-foreground">Select your city above to show its service-radius map.</p>}
   <label className="block text-sm font-medium">Service radius: {radius} miles<input aria-label="Service radius" type="range" min={1} max={200} value={radius} onChange={event=>setRadius(Number(event.target.value))} className="mt-3 block w-full accent-[#c74d7f]"/></label>

   <ServiceAreaPicker defaultValue={business.serviceAreaNotes} onAreasChange={setAreas}/>
   <p className="text-xs text-muted-foreground">The circle shows your standard travel range. Add any other cities or regions you serve above.</p>
   <Button type="submit">{pending?'Saving…':'Save business details'}</Button>
  </fieldset>
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  {message&&<p role="status" className="text-sm text-green-800">{message}</p>}
 </form>;
}
