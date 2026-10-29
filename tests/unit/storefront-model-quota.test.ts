import {describe,it,expect} from 'vitest';
import {modelCreditWindow,MONTHLY_GENERATIONS} from '@/lib/storefront-model-quota';
const now=new Date('2026-10-29T00:00:00Z');
const balance={balance:1010,monthly_credits:1010,monthly_resets_at:Date.parse('2026-11-28T00:07:00Z')};
describe('monthly model allowance',()=>{
 it('limits the included 1000 credits to 33 textured generations',()=>expect(MONTHLY_GENERATIONS).toBe(33));
 it('uses the subscription cycle rather than calendar month',()=>expect(modelCreditWindow(balance,now).start.toISOString()).toBe('2026-10-28T00:07:00.000Z'));
 it('does not spend purchased credits after monthly credits run out',()=>expect(()=>modelCreditWindow({...balance,monthly_credits:20},now)).toThrow('used up'));
 it('respects a lower spendable balance',()=>expect(()=>modelCreditWindow({...balance,balance:20},now)).toThrow('used up'));
 it('stops when allowance cannot be confirmed',()=>expect(()=>modelCreditWindow({},now)).toThrow('confirm'));
});
