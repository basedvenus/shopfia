import {expect,it,vi} from 'vitest';
const sendMail=vi.hoisted(()=>vi.fn(async (_mail: Record<string, unknown>)=>({})));
vi.mock('nodemailer',()=>({createTransport:()=>({sendMail})}));
vi.mock('@/lib/auth/provider-config',()=>({authProviderConfig:{emailEnabled:true,email:{port:'465',host:'smtp.example.com',user:'test',password:'test',from:'ShopFia <no-reply@shopfia.app>'}}}));
import {sendAccountNotificationEmail} from '@/lib/email';
it('uses the configured no-reply sender, escapes content and prevents external notification links',async()=>{
 await sendAccountNotificationEmail({to:'recipient@example.com',title:'<img src=x> started following you',path:'//evil.example',kind:'NEW_FOLLOWER'});
 const mail=sendMail.mock.calls[0][0] as any;
 expect(mail.from).toBe('ShopFia <no-reply@shopfia.app>');expect(mail.to).toBe('recipient@example.com');
 expect(mail.html).toContain('&lt;img src=x&gt;');expect(mail.html).not.toContain('href="//evil.example');expect(mail.text).toContain('/notifications');
});
