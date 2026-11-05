import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({auth:vi.fn(),persist:vi.fn(),cookie:vi.fn(),rate:vi.fn()}));
vi.mock('@/auth',()=>({auth:mocks.auth}));
vi.mock('@/lib/language-preference',()=>({persistUserLanguage:mocks.persist,writeLanguageCookie:mocks.cookie}));
vi.mock('@/lib/security/request',()=>({checkServerActionRateLimit:mocks.rate}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
import {updatePreferredLanguageAction} from '@/app/actions/language';
import {translate,normalizeLanguage} from '@/lib/language';
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue({user:{id:'signed-in-user'}});mocks.rate.mockResolvedValue({ok:true});});
it('saves Spanish only on the authenticated account and allows switching back',async()=>{
 expect(await updatePreferredLanguageAction('es')).toEqual({ok:true,message:'Idioma guardado.'});expect(mocks.persist).toHaveBeenCalledWith('signed-in-user','es');
 await updatePreferredLanguageAction('en');expect(mocks.persist).toHaveBeenLastCalledWith('signed-in-user','en');
});
it('rejects unsupported languages before touching account data',async()=>{
 expect((await updatePreferredLanguageAction('fr')).ok).toBe(false);expect(mocks.persist).not.toHaveBeenCalled();
});
it('uses a cookie for the pre-registration choice without writing an account',async()=>{
 mocks.auth.mockResolvedValue(null);expect((await updatePreferredLanguageAction('es')).ok).toBe(true);expect(mocks.cookie).toHaveBeenCalledWith('es');expect(mocks.persist).not.toHaveBeenCalled();
});
it('reports failed persistence instead of claiming the preference was saved',async()=>{
 mocks.persist.mockRejectedValueOnce(new Error('Database not ready'));expect((await updatePreferredLanguageAction('es')).ok).toBe(false);
});
it('translates navigation with stable English fallback',()=>{
 expect(translate('es','Settings')).toBe('Configuración');expect(translate('en','Settings')).toBe('Settings');expect(normalizeLanguage('fr')).toBe('en');
});
