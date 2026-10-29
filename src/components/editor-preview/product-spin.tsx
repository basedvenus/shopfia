"use client";
import { ProductModel } from './product-model';
export function ProductSpin({modelUrl,image,name}:{modelUrl?:string;image:string;name:string}) {
 return <div className="relative h-full w-full">{modelUrl?<ProductModel src={modelUrl} name={name} spin/>:image?<img src={image} alt={`${name} product`} className="h-full w-full object-contain p-8"/>:null}</div>;
}
