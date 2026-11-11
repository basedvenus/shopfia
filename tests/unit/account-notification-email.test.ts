import {expect,it,vi} from 'vitest';
const sendMail=vi.hoisted(()=>vi.fn(async (_mail: Record<string, unknown>)=>({})));
vi.mock('nodemailer',()=>({createTransport:()=>({sendMail})}));
vi.mock('@/lib/auth/provider-config',()=>({authProviderConfig:{emailEnabled:true,email:{port:'465',host:'smtp.example.com',user:'test',password:'test',from:'ShopFia <no-reply@shopfia.app>'}}}));
import {sendAccountNotificationEmail, sendPasswordResetEmail} from '@/lib/email';
it('uses the configured no-reply sender, escapes content and prevents external notification links',async()=>{
 await sendAccountNotificationEmail({to:'recipient@example.com',title:'<img src=x> started following you',path:'//evil.example',kind:'NEW_FOLLOWER'});
 const mail=sendMail.mock.calls[0][0] as any;
 expect(mail.from).toEqual({name:'Shopfia 🧁',address:'no-reply@shopfia.app'});expect(mail.to).toBe('recipient@example.com');
 expect(mail.html).toContain('&lt;img src=x&gt;');expect(mail.html).not.toContain('href="//evil.example');expect(mail.text).toContain('/notifications');
});

it('renders readable, responsive branded email in light and dark mode',async()=>{
 await sendAccountNotificationEmail({to:'recipient@example.com',title:'A guest requested a service.',path:'/messages',kind:'SERVICE_REQUEST'});
 const mail=sendMail.mock.calls.at(-1)![0] as any;
 expect(mail.subject).toBe('New Party Request on Shopfia 🧁');
 expect(mail.html).toContain('cid:shopfia-logo');
 expect(mail.attachments[0].cid).toBe('shopfia-logo');
 expect(mail.attachments[0].content.length).toBeGreaterThan(0);
 expect(mail.html).toContain('color-scheme:light dark');
 expect(mail.html).toContain('prefers-color-scheme: dark');
 expect(mail.html).toContain('max-width:480px');
 expect(mail.html).toContain('linear-gradient(135deg,#fcdee3');
 expect(mail.html).not.toContain('>Shopfia 🧁</p>');
 expect(mail.html).toContain('background:#e3a7a7;background-image:linear-gradient(90deg,#e3a7a7,#eab8b3);color:#302625');
 expect(mail.html).toContain('bgcolor="#fce1e4"');
});

it('includes requester and business portraits and embeds a saved business logo',async()=>{
 await sendAccountNotificationEmail({to:'recipient@example.com',title:'A request',path:'/messages',kind:'SERVICE_REQUEST',requester:{name:'Kae C',image:'/api/users/buyer/avatar'},business:{name:'Moon Matcha',image:'data:image/png;base64,aGVsbG8='}});
 const mail=sendMail.mock.calls.at(-1)![0] as any;
 expect(mail.html).toContain('alt="Kae C"');
 expect(mail.html).toContain('alt="Moon Matcha"');
 expect(mail.html).toContain('cid:business-avatar');
 expect(mail.attachments.find((item:any)=>item.cid==='business-avatar').content.toString()).toBe('hello');
});

it("sends a branded password reset email with the correct reset destination", async () => {
  const url = "https://www.shopfia.app/account/reset-password?email=person%40example.com&token=example";
  await sendPasswordResetEmail("person@example.com", url);
  const mail = sendMail.mock.lastCall![0];

  expect(mail.subject).toBe("Reset your ShopFia password");
  expect(mail.html).toContain('src="cid:shopfia-logo"');
  expect(mail.html).toContain(`href="${url.replace("&", "&amp;")}"`);
  expect(mail.text).toContain(url);
});
