import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),business:vi.fn(),rate:vi.fn()}));
vi.mock("@/auth",()=>({auth:mocks.auth}));
vi.mock("@/lib/db",()=>({db:{vendorProfile:{findFirst:mocks.business}}}));
vi.mock("@/lib/businesses",()=>({businessManagerWhere:()=>({userId:"owner"})}));
vi.mock("@/lib/security/request",()=>({assertSameOrigin:(r:Request)=>r.headers.get("origin")==="http://localhost:3001",enforceRequestRateLimit:mocks.rate}));
import {POST} from "@/app/api/vendor/business/[businessId]/service-draft/route";
const request=(text="Portable pole rental for $100")=>new Request("http://localhost:3001/api/vendor/business/b/service-draft",{method:"POST",headers:{origin:"http://localhost:3001","Content-Type":"application/json"},body:JSON.stringify({description:text})});
const context={params:Promise.resolve({businessId:"b"})};
describe("AI drafting endpoint",()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("AI_GATEWAY_API_KEY","test-only-not-a-credential");mocks.auth.mockResolvedValue({user:{id:"owner",role:"USER"}});mocks.business.mockResolvedValue({id:"b"});mocks.rate.mockReturnValue(null);});
 afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
 it("rejects unauthenticated requests",async()=>{mocks.auth.mockResolvedValue(null);expect((await POST(request(),context)).status).toBe(401);expect(mocks.business).not.toHaveBeenCalled();});
 it("rejects unmanaged businesses",async()=>{mocks.business.mockResolvedValue(null);expect((await POST(request(),context)).status).toBe(404);});
 it("returns a clear setup message without a key",async()=>{vi.stubEnv("AI_GATEWAY_API_KEY","");expect((await POST(request(),context)).status).toBe(503);});
 it("enforces length and request limits",async()=>{expect((await POST(request("x".repeat(4001)),context)).status).toBe(400);mocks.rate.mockReturnValue(new Response("limited",{status:429}));expect((await POST(request(),context)).status).toBe(429);});
 it("only calls text generation without tools and returns validated fields",async()=>{const draft={name:"Pole rental",description:"Portable pole rental",inclusions:"Pole",pricingType:"fixed",rateCents:10000,minimum:null,itemLabel:"",packages:[],addons:[],questions:[]};const fetcher=vi.fn().mockResolvedValue(Response.json({choices:[{message:{content:JSON.stringify(draft)}}]}));vi.stubGlobal("fetch",fetcher);const response=await POST(request(),context);expect(response.status).toBe(200);expect((await response.json()).draft).toEqual(draft);const payload=JSON.parse(fetcher.mock.calls[0][1].body);expect(payload.tools).toBeUndefined();expect(payload.messages[1].content).toBe("Portable pole rental for $100");});
});
