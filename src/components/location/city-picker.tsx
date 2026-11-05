"use client";
import {PlaceAutocompleteInput} from "./place-autocomplete-input";
export function CityPicker({city,state,onChange}:{city:string;state:string;onChange:(city:string,state:string)=>void}) {
 const label=[city,state].filter(Boolean).join(', ');
 return <PlaceAutocompleteInput searchType="cities" requireSelection placeholder="Search and select a city" label="City" defaultValue={label} defaultPlace={{city,state,formattedAddress:label}} fieldNames={{input:'citySearch'}} omitHiddenFields onPlaceSelect={place=>onChange(place.city,place.state)}/>;
}
