import {beforeEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({auth:vi.fn(),info:vi.fn(),upsert:vi.fn(),origin:vi.fn(()=>true),payable:vi.fn(()=>true)}));
vi.mock("@/auth",()=>({auth:mocks.auth}));
vi.mock("@/lib/db",()=>({db:{waiverSignature:{upsert:mocks.upsert}}}));
vi.mock("@/lib/services/waivers",()=>({buyerQuoteWaivers:mocks.info}));
vi.mock("@/lib/services/quote-checkout",()=>({canPrepareQuoteCheckout:mocks.payable}));
vi.mock("@/lib/security/request",()=>({assertSameOrigin:mocks.origin,enforceRequestRateLimit:()=>null}));
import {POST} from "@/app/api/waivers/sign/[quoteId]/route";
const waiverId="cabcdefghijklmnopqrstuvwx",hash="a".repeat(64);
const payload={waiverId,quoteHash:hash,signerName:"TEST ONLY",consent:true};
function submit(body:object=payload){return POST(new Request("https://shopfia.app/api/waivers/sign/test-quote",{method:"POST",headers:{"content-type":"application/json",origin:"https://shopfia.app"},body:JSON.stringify(body)}),{params:Promise.resolve({quoteId:"test-quote"})});}
describe("waiver signing authorization",()=>{
 beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue({user:{id:"test-buyer"}});mocks.origin.mockReturnValue(true);mocks.payable.mockReturnValue(true);mocks.info.mockResolvedValue({quote:{},quoteHash:hash,required:[{id:waiverId,sha256:"document-hash"}]});mocks.upsert.mockResolvedValue({id:"test-signature"});});
 it("requires an authenticated customer",async()=>{mocks.auth.mockResolvedValue(null);expect((await submit()).status).toBe(401);expect(mocks.upsert).not.toHaveBeenCalled();});
 it("rejects a cross-origin request",async()=>{mocks.origin.mockReturnValue(false);expect((await submit()).status).toBe(403);expect(mocks.upsert).not.toHaveBeenCalled();});
 it("requires explicit electronic consent",async()=>{expect((await submit({...payload,consent:false})).status).toBe(400);expect(mocks.upsert).not.toHaveBeenCalled();});
 it("rejects an outdated quote version",async()=>{expect((await submit({...payload,quoteHash:"b".repeat(64)})).status).toBe(400);expect(mocks.upsert).not.toHaveBeenCalled();});
 it("rejects signing a document that does not apply to the quote",async()=>{mocks.info.mockResolvedValue({quote:{},quoteHash:hash,required:[]});expect((await submit()).status).toBe(400);expect(mocks.upsert).not.toHaveBeenCalled();});
 it("stores server-selected document and quote hashes for this customer",async()=>{expect((await submit()).status).toBe(200);expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({update:{},create:expect.objectContaining({buyerId:"test-buyer",quoteId:"test-quote",waiverId,documentHash:"document-hash",quoteHash:hash,signerName:"TEST ONLY"})}));});
});
