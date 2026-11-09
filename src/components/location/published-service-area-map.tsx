"use client";
import {useSavedServiceAreas} from "./use-saved-service-areas";
import {ServiceRadiusMap} from "./service-radius-map";
export function PublishedServiceAreaMap({city,notes,radius,lat,lng}:{city:string;notes:string|null;radius:number;lat:number|null;lng:number|null}){
 const places=useSavedServiceAreas(notes);
 const found=useSavedServiceAreas(lat==null||lng==null?city:"")[0];
 const base=lat!=null&&lng!=null?{lat,lng}:found;
 return base?<ServiceRadiusMap lat={base.lat} lng={base.lng} radius={radius} areas={places} readOnly/>:<p className="p-4 text-sm">Select a city in business settings to display the service-area map.</p>;
}
