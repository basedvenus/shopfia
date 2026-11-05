export const STICKER_KINDS=['ribbon','botanical','cake','balloons','bouquet','sparkle','citrus'] as const;
export type StickerKind=typeof STICKER_KINDS[number];
export type StorefrontSticker={id:string;kind:StickerKind;x:number;y:number;size:number};
export const STICKER_LABELS:Record<StickerKind,string>={ribbon:'Ribbon',botanical:'Flower',cake:'Cake',balloons:'Balloons',bouquet:'Bouquet',sparkle:'Sparkles',citrus:'Citrus'};
export function stickerScale(width:number,height:number,dx:number,dy:number,sx:number,sy:number) {
 return Math.max(.1,1+(dx*sx*width+dy*sy*height)/(sx*sx*width*width+sy*sy*height*height));
}
