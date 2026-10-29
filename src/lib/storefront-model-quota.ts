export const MODEL_CREDITS = 30;
export const MONTHLY_GENERATIONS = Math.floor(1000 / MODEL_CREDITS);
export function modelCreditWindow(balance: {balance?:number;monthly_credits?:number;monthly_resets_at?:number|null}, now = new Date()) {
 if (!Number.isFinite(balance.balance) || !Number.isFinite(balance.monthly_credits) || !balance.monthly_resets_at) throw new Error('We could not confirm the monthly 3D allowance. Please try again later.');
 if (Math.min(balance.balance!,balance.monthly_credits!) < MODEL_CREDITS) throw new Error('The monthly 3D allowance is used up. Creation will resume when the monthly credits reset.');
 const end = new Date(balance.monthly_resets_at);
 if (!Number.isFinite(end.getTime()) || end <= now) throw new Error('The monthly 3D allowance is refreshing. Please try again shortly.');
 const start = new Date(end); start.setUTCMonth(start.getUTCMonth()-1);
 return {start,end};
}
