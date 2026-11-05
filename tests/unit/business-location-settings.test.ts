import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),find:vi.fn(),update:vi.fn(),rate:vi.fn(),revalidate:vi.fn()}));
vi.mock('@/auth',()=>({auth:mocks.auth}));
vi.mock('@/lib/db',()=>({db:{vendorProfile:{findFirst:mocks.find,update:mocks.update}}}));
vi.mock('@/lib/businesses',()=>({businessManagerWhere:(userId:string)=>({managers:{some:{userId}}}),storefrontPath:(slug:string)=>`/${slug}`}));
vi.mock('@/lib/security/request',()=>({checkServerActionRateLimit:mocks.rate}));
vi.mock('next/cache',()=>({revalidatePath:mocks.revalidate}));
import {updateBusinessLocationAction} from '@/app/actions/business-location';
import {mapPoint,milesFromPixels,radiusPixels,radiusZoom} from '@/lib/service-radius-map';
const input={businessId:'business',city:'San Francisco',state:'CA',formattedAddress:'San Francisco, CA, USA',googlePlaceId:'place',lat:37.77,lng:-122.42,radius:80,serviceAreaNotes:'Oakland, CA, USA'};
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue({user:{id:'owner',role:'VENDOR'}});mocks.rate.mockResolvedValue({ok:true});mocks.find.mockResolvedValue({id:'business',slug:'bakery',city:'Old City',state:'CA',storefrontDraftJson:{city:'Old City',name:'Bakery',template:'saved'}});mocks.update.mockResolvedValue({});});
it('requires sign-in and business management access',async()=>{
 mocks.auth.mockResolvedValue(null);expect((await updateBusinessLocationAction(input)).ok).toBe(false);expect(mocks.find).not.toHaveBeenCalled();
 mocks.auth.mockResolvedValue({user:{id:'other'}});mocks.find.mockResolvedValue(null);expect((await updateBusinessLocationAction(input)).ok).toBe(false);expect(mocks.update).not.toHaveBeenCalled();
});
it('saves the public location and coverage while retaining the draft design',async()=>{
 expect(await updateBusinessLocationAction(input)).toEqual({ok:true});
 expect(mocks.find.mock.calls[0][0].where).toEqual({id:'business',managers:{some:{userId:'owner'}}});
 expect(mocks.update.mock.calls[0][0].data).toMatchObject({city:'San Francisco',locationLat:37.77,serviceRadiusMiles:80,storefrontDraftJson:{city:'San Francisco',name:'Bakery',template:'saved'}});
 expect(mocks.revalidate).toHaveBeenCalledWith('/bakery');expect(mocks.revalidate).toHaveBeenCalledWith('/vendor/business/bakery');
});
it('rejects out-of-range radii and changed cities without a selected place',async()=>{
 expect((await updateBusinessLocationAction({...input,radius:201})).ok).toBe(false);
 expect((await updateBusinessLocationAction({...input,googlePlaceId:'',lat:null,lng:null})).ok).toBe(false);expect(mocks.update).not.toHaveBeenCalled();
});
it.each([0,37.77,-33.45,65])('keeps map distance and radius controls consistent at latitude %s',latitude=>{
 const zoom=radiusZoom(latitude,80);const pixels=radiusPixels(80,latitude,zoom);
 expect(pixels).toBeLessThanOrEqual(105);expect(milesFromPixels(pixels,latitude,zoom)).toBe(80);expect(milesFromPixels(pixels*1.5,latitude,zoom)).toBe(120);
});
it('wraps the map center with the correct world projection',()=>{expect(mapPoint(0,0,2)).toEqual({x:512,y:512});});
it('sizes a county bubble from its geographic bounds instead of the travel radius',async()=>{
 const {areaRadiusMiles}=await import('@/lib/service-radius-map');
 const city={lat:37.77,viewport:{low:{latitude:37.7,longitude:-122.5},high:{latitude:37.82,longitude:-122.35}}};
 const county={lat:38.2,viewport:{low:{latitude:37.99,longitude:-122.4},high:{latitude:38.54,longitude:-121.59}}};
 expect(areaRadiusMiles(county)).toBeGreaterThan(areaRadiusMiles(city));
});
