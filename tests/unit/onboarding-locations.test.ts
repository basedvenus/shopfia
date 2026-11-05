import {createElement} from 'react';
import {act,create} from 'react-test-renderer';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('@/lib/places',()=>({getGooglePlacesApiKey:()=> 'test-key',normalizeGoogleSuggestion:(value:unknown)=>value}));
vi.mock('@/lib/security/request',()=>({enforceRequestRateLimit:()=>null}));
vi.mock('@/lib/security/audit-log',()=>({securityLog:vi.fn()}));
vi.mock('@/components/location/place-autocomplete-input',()=>({PlaceAutocompleteInput:()=>null}));
import {GET} from '@/app/api/places/autocomplete/route';
import {ServiceAreaPicker} from '@/components/vendor/service-area-picker';
import {PlaceAutocompleteInput} from '@/components/location/place-autocomplete-input';
afterEach(()=>vi.unstubAllGlobals());
it.each([['cities','(cities)'],['regions','(regions)']])('restricts %s search to geographic suggestions',async(type,expected)=>{
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({suggestions:[]})});vi.stubGlobal('fetch',fetcher);
 const response=await GET(new Request(`http://localhost/api/places/autocomplete?input=San&type=${type}`));
 expect(response.status).toBe(200);expect(JSON.parse(fetcher.mock.calls[0][1].body).includedPrimaryTypes).toEqual([expected]);
});
it('adds distinct selected service areas without adding location metadata to the business form',()=>{
 let view:ReturnType<typeof create>;act(()=>{view=create(createElement(ServiceAreaPicker,{}));});
 const search=()=>view!.root.findByType(PlaceAutocompleteInput);
 expect(search().props.omitHiddenFields).toBe(true);
 for(const formattedAddress of ['San Francisco, CA, USA','Oakland, CA, USA','San Francisco, CA, USA'])act(()=>search().props.onPlaceSelect({formattedAddress}));
 expect(view!.root.findByProps({name:'serviceAreaNotes'}).props.value).toBe('San Francisco, CA, USA; Oakland, CA, USA');
 act(()=>view!.root.findByProps({'aria-label':'Remove San Francisco, CA, USA'}).props.onClick());
 expect(view!.root.findByProps({name:'serviceAreaNotes'}).props.value).toBe('Oakland, CA, USA');
 act(()=>view!.unmount());
});
