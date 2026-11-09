import {describe,it,expect} from "vitest";
import {mergeCurrentStorefrontServices,applyStorefrontServiceVisibility} from "@/lib/storefront-service-state";
const service=(id:string,extra={})=>({id,active:true,featured:true,photos:[] as string[],...extra});
describe("storefront services stay aligned with database",()=>{
 it("does not resurrect deleted services from an old storefront draft",()=>{expect(mergeCurrentStorefrontServices([service("deleted")],[])).toEqual([]);});
 it("keeps unsaved new services and adds newly created records",()=>{expect(mergeCurrentStorefrontServices([service("draft",{isNew:true})],[service("new")]).map(s=>s.id)).toEqual(["draft","new"]);});
 it("does not republish an inactive service from stale active draft flags",()=>{const merged=mergeCurrentStorefrontServices([service("old")],[service("old",{active:false})]);expect(applyStorefrontServiceVisibility(merged,[])[0]).toMatchObject({active:false,featured:false});});
 it("respects storefront-hidden services",()=>{expect(applyStorefrontServiceVisibility([service("hidden")],["hidden"])[0]).toMatchObject({active:false,featured:false});});
});
