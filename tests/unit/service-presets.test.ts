import {beforeEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),business:vi.fn(),list:vi.fn(),create:vi.fn(),remove:vi.fn()}));
vi.mock("@/auth",()=>({auth:mocks.auth}));
vi.mock("@/lib/businesses",()=>({businessManagerWhere:()=>({userId:"owner"})}));
vi.mock("@/lib/db",()=>({db:{vendorProfile:{findFirst:mocks.business},servicePreset:{findMany:mocks.list,create:mocks.create,deleteMany:mocks.remove}}}));
import {loadServicePresets,saveServicePreset,removeServicePreset} from "@/app/actions/service-presets";
import {copyServicePreset} from "@/lib/service-presets";
const option={kind:"options" as const,payload:{id:"old",name:"Flavors",options:["Chocolate","Vanilla"],selection:"single" as const,required:true}};
beforeEach(()=>{vi.resetAllMocks();mocks.auth.mockResolvedValue({user:{id:"owner",role:"VENDOR"}});mocks.business.mockResolvedValue({id:"business"});mocks.list.mockResolvedValue([]);mocks.create.mockImplementation(async({data})=>({id:"saved",...data}));});
describe("business service preset library",()=>{
 it("requires sign-in before accessing the library",async()=>{mocks.auth.mockResolvedValue(null);await expect(loadServicePresets("business")).rejects.toThrow("Sign in");expect(mocks.list).not.toHaveBeenCalled();});
 it("rejects another business for reads, saves, and removal",async()=>{mocks.business.mockResolvedValue(null);await expect(loadServicePresets("other")).rejects.toThrow("access");await expect(saveServicePreset("other",option)).rejects.toThrow("access");await expect(removeServicePreset("other","saved")).rejects.toThrow("access");expect(mocks.create).not.toHaveBeenCalled();expect(mocks.remove).not.toHaveBeenCalled();});
 it("saves a validated section scoped to the business",async()=>{const saved=await saveServicePreset("business",option);expect(saved).toMatchObject({...option,id:"saved",name:"Flavors"});expect(mocks.create).toHaveBeenCalledWith({data:{businessId:"business",kind:"options",name:"Flavors",payload:option.payload}});});
 it("rejects incomplete choices and unpriced add-ons",async()=>{await expect(saveServicePreset("business",{...option,payload:{...option.payload,options:[]}})).rejects.toThrow("Complete");await expect(saveServicePreset("business",{kind:"addon",payload:{id:"a",name:"Assistant",description:"Extra staff",type:"hour"}})).rejects.toThrow("Complete");expect(mocks.create).not.toHaveBeenCalled();});
 it("preserves hourly pricing and limits when saving an add-on",async()=>{const addon={kind:"addon" as const,payload:{id:"a",name:"Extra assistant",description:"One additional staff member",type:"hour" as const,rate:10000,minimum:2,maximum:8,increment:1,separateHours:true,locationRequired:false}};expect(await saveServicePreset("business",addon)).toMatchObject(addon);});
 it("loads only this business’s valid saved items",async()=>{mocks.list.mockResolvedValue([{...option,id:"saved",name:"Flavors"},{id:"bad",kind:"unknown",payload:{}}]);expect(await loadServicePresets("business")).toHaveLength(1);expect(mocks.list).toHaveBeenCalledWith({where:{businessId:"business"},orderBy:{createdAt:"desc"},take:100});});
 it("scopes deletion to the business without deleting service data",async()=>{await removeServicePreset("business","saved");expect(mocks.remove).toHaveBeenCalledWith({where:{id:"saved",businessId:"business"}});});
 it("applies an independent copy with a new ID each time",()=>{const a=copyServicePreset(option),b=copyServicePreset(option);expect(a.payload.id).not.toBe(option.payload.id);expect(a.payload.id).not.toBe(b.payload.id);if(a.kind==="options")a.payload.options[0]="Banana";expect(option.payload.options[0]).toBe("Chocolate");});
});
