import {createElement} from 'react';
import {act,create} from 'react-test-renderer';
import {expect,it,vi} from 'vitest';
vi.mock('@/components/location/place-autocomplete-input',()=>({PlaceAutocompleteInput:()=>null}));
import {ServiceAreaPicker} from '@/components/vendor/service-area-picker';
import {PlaceAutocompleteInput} from '@/components/location/place-autocomplete-input';
import {ServiceRadiusMap} from '@/components/location/service-radius-map';
import type {PlaceDetails} from '@/lib/places';
const city:PlaceDetails={placeId:'sf',formattedAddress:'San Francisco, CA, USA',name:'San Francisco',city:'San Francisco',state:'CA',lat:37.77,lng:-122.42,types:['locality'],source:'google'};
const county:PlaceDetails={...city,placeId:'solano',formattedAddress:'Solano County, CA, USA',name:'Solano County',lat:38.2,lng:-121.94,types:['administrative_area_level_2']};
it('adds and removes bubbles with the selected areas',()=>{
 const changed=vi.fn();let view:ReturnType<typeof create>;
 act(()=>{view=create(createElement(ServiceAreaPicker,{onAreasChange:changed}));});
 for(const place of [city,county])act(()=>view!.root.findByType(PlaceAutocompleteInput).props.onPlaceSelect(place));
 expect(changed).toHaveBeenLastCalledWith([city,county]);
 act(()=>view!.root.findByProps({'aria-label':`Remove ${city.formattedAddress}`}).props.onClick());
 expect(changed).toHaveBeenLastCalledWith([county]);act(()=>view!.unmount());
});
it('draws separate labeled city and county bubbles without changing the travel radius',()=>{
 const change=vi.fn();let view:ReturnType<typeof create>;
 act(()=>{view=create(createElement(ServiceRadiusMap,{lat:37.77,lng:-122.42,radius:80,onChange:change,areas:[city,county]}));});
 expect(view!.root.findAll(node=>node.props['data-service-area-bubble'])).toHaveLength(2);
 expect(view!.root.findAllByType('text').map(node=>node.children.join(''))).toEqual(['San Francisco','Solano County']);expect(change).not.toHaveBeenCalled();
 act(()=>view!.unmount());
});
