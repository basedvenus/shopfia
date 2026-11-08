import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({find:vi.fn(),create:vi.fn(),transaction:vi.fn(),execute:vi.fn(),cookie:vi.fn()}));
vi.mock('@/lib/services/account-notifications',()=>({notifyAccount:vi.fn()}));
vi.mock('@/auth',()=>({auth:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{user:{findUnique:mocks.find},$transaction:mocks.transaction}}));
vi.mock('@/lib/language-preference',()=>({persistUserLanguage:vi.fn(),writeLanguageCookie:mocks.cookie}));
vi.mock('@/lib/security/request',()=>({checkServerActionRateLimit:async()=>({ok:true})}));
vi.mock('@/lib/security/audit-log',()=>({securityLog:vi.fn()}));
vi.mock('@/lib/email',()=>({sendWelcomeEmail:async()=>({ok:true})}));
vi.mock('bcryptjs',()=>({hash:async()=> 'hashed-password'}));
import {createPasswordAccountAction} from '@/app/actions/auth';
beforeEach(()=>{vi.clearAllMocks();mocks.find.mockResolvedValue(null);mocks.create.mockResolvedValue({id:'new-account'});mocks.transaction.mockImplementation(async callback=>callback({user:{create:mocks.create},$executeRaw:mocks.execute}));});
function form(language:string){const value=new FormData();value.set('firstName','  Venus  ');value.set('email','new@example.com');value.set('password','long-password');value.set('preferredLanguage',language);return value;}
it('saves registration language in the same transaction as the new account',async()=>{
 expect((await createPasswordAccountAction(form('es'))).ok).toBe(true);expect(mocks.transaction).toHaveBeenCalledOnce();expect(mocks.execute.mock.calls[0].slice(1)).toEqual(['es','new-account']);expect(mocks.cookie).toHaveBeenCalledWith('es');
});
it('rejects an unsupported registration language before creating an account',async()=>{expect((await createPasswordAccountAction(form('fr'))).ok).toBe(false);expect(mocks.create).not.toHaveBeenCalled();});

it('trims and saves the required first name with the account',async()=>{
 await createPasswordAccountAction(form('en'));
 expect(mocks.create).toHaveBeenCalledWith({data:{email:'new@example.com',passwordHash:'hashed-password',firstName:'Venus'}});
});
it.each(['', '   '])('rejects a blank first name before creating an account',async(firstName)=>{
 const value=form('en');value.set('firstName',firstName);
 expect((await createPasswordAccountAction(value)).ok).toBe(false);
 expect(mocks.transaction).not.toHaveBeenCalled();
});
it('rejects a missing first name before creating an account',async()=>{
 const value=form('en');value.delete('firstName');
 expect((await createPasswordAccountAction(value)).ok).toBe(false);
 expect(mocks.transaction).not.toHaveBeenCalled();
});
