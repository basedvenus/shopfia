import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),business:vi.fn(),find:vi.fn(),create:vi.fn(),transaction:vi.fn()}));
vi.mock('@/auth',()=>({auth:mocks.auth}));
vi.mock('@/lib/db',()=>({db:{vendorProfile:{findFirst:mocks.business},vendorStorefrontMedia:{findFirst:mocks.find,create:mocks.create},$transaction:mocks.transaction}}));
vi.mock('@/lib/businesses',()=>({businessManagerWhere:()=>({userId:'owner'})}));
vi.mock('@/lib/security/request',()=>({assertSameOrigin:(r:Request)=>r.headers.get('origin')==='https://shopfia.app',enforceRequestRateLimit:()=>null}));
import {POST,GET} from '@/app/api/vendor/business/[businessId]/models/route';
const context={params:Promise.resolve({businessId:'business'})};
function request(form=new FormData()){return new Request('https://shopfia.app/api/vendor/business/business/models',{method:'POST',headers:{origin:'https://shopfia.app'},body:form});}
beforeEach(()=>{vi.clearAllMocks();vi.unstubAllEnvs();mocks.auth.mockResolvedValue({user:{id:'owner',role:'VENDOR'}});mocks.business.mockResolvedValue({id:'business'});mocks.find.mockResolvedValue(null);});
describe('3D routes',()=>{
 it('rejects unauthenticated requests before storage or provider calls',async()=>{mocks.auth.mockResolvedValue(null);expect((await POST(request(),context)).status).toBe(401);expect(mocks.create).not.toHaveBeenCalled();});
 it('enforces business ownership',async()=>{mocks.business.mockResolvedValue(null);expect((await POST(request(),context)).status).toBe(404);});
 it('reports unavailable generation when no server key exists',async()=>{vi.stubEnv('MESHY_API_KEY','');expect((await POST(request(),context)).status).toBe(503);});
 it('deduplicates paid requests before contacting Meshy',async()=>{vi.stubEnv('MESHY_API_KEY','test');mocks.find.mockResolvedValue({id:'model-12345678-1234-1234-1234-123456789012'});const f=new FormData();f.set('requestId','model-12345678-1234-1234-1234-123456789012');const r=await POST(request(f),context);expect(r.status).toBe(200);expect(mocks.transaction).not.toHaveBeenCalled();});
 it('does not return another business model',async()=>{const r=await GET(new Request('https://shopfia.app/models?job=other',{headers:{origin:'https://shopfia.app'}}),context);expect(r.status).toBe(404);expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({where:{id:'other',vendorProfileId:'business'}}));});
 it('rejects foreign origins',async()=>{const r=await POST(new Request('https://shopfia.app/models',{method:'POST',headers:{origin:'https://evil.test'}}),context);expect(r.status).toBe(403);});
});
