import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({upsert:vi.fn(),updateMany:vi.fn(),send:vi.fn()}));
vi.mock('@/lib/services/business-sms',()=>({notifyBusinessSms:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{notification:{upsert:mocks.upsert,updateMany:mocks.updateMany}}}));
vi.mock('@/lib/email',()=>({sendAccountNotificationEmail:mocks.send}));
vi.mock('@/lib/security/audit-log',()=>({securityLog:vi.fn()}));
import {notifyAccount} from '@/lib/services/account-notifications';
const input={userId:'owner',kind:'SERVICE_REQUEST' as const,title:'New request',href:'/messages?conversationId=one',dedupeKey:'request:one'};
beforeEach(()=>{vi.clearAllMocks();mocks.upsert.mockResolvedValue({id:'notification',emailSentAt:null,user:{email:'owner@example.com'}});mocks.send.mockResolvedValue({ok:true});});
it('emails the saved recipient and records successful delivery',async()=>{
 await notifyAccount(input);
 expect(mocks.send).toHaveBeenCalledWith({to:'owner@example.com',title:input.title,path:input.href,kind:input.kind});
 expect(mocks.updateMany).toHaveBeenCalledWith({where:{id:'notification',emailSentAt:null},data:{emailSentAt:expect.any(Date)}});
});
it('does not resend an already delivered alert',async()=>{
 mocks.upsert.mockResolvedValue({id:'notification',emailSentAt:new Date(),user:{email:'owner@example.com'}});
 await notifyAccount(input);expect(mocks.send).not.toHaveBeenCalled();
});
it('keeps failed delivery unsent so a repeat action can retry',async()=>{
 mocks.send.mockResolvedValue({ok:false});await notifyAccount(input);expect(mocks.updateMany).not.toHaveBeenCalled();
});
it('does not fail a completed action when notification storage fails',async()=>{
 mocks.upsert.mockRejectedValue(new Error('offline'));await expect(notifyAccount(input)).resolves.toBeUndefined();expect(mocks.send).not.toHaveBeenCalled();
});
