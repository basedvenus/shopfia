"use client";
import {useEffect,useState} from "react";
import type {PlaceDetails} from "@/lib/places";
export function useSavedServiceAreas(notes?:string|null){
 const [areas,setAreas]=useState<PlaceDetails[]>([]);
 useEffect(()=>{let active=true;setAreas([]);const labels=[...new Set((notes??"").split(/[;\n]+/).map(label=>label.trim()).filter(Boolean))].slice(0,20);
 void Promise.all(labels.map(async label=>{try{const suggestions=await fetch(`/api/places/autocomplete?input=${encodeURIComponent(label)}&type=regions`);if(!suggestions.ok)return null;const result=await suggestions.json();const id=result.suggestions?.[0]?.placeId;if(!id)return null;const details=await fetch(`/api/places/details?placeId=${encodeURIComponent(id)}`);if(!details.ok)return null;return (await details.json()).place as PlaceDetails|undefined;}catch{return null;}})).then(values=>{if(active)setAreas(values.filter((value):value is PlaceDetails=>Boolean(value)));});
 return()=>{active=false;};},[notes]);return areas;
}
