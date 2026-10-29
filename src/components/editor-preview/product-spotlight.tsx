"use client";
import type { CSSProperties } from 'react';
import { ProductModel } from './product-model';
export function ProductSpotlight({modelUrl,image,word,name,headingStyle}:{modelUrl?:string;image:string;word:string;name:string;headingStyle?:CSSProperties}) {
 return <div className="product-spotlight">
 {word&&<div className="product-backdrop-word" style={headingStyle} aria-hidden="true">{word}</div>}
 <div className="product-screen" aria-hidden="true"><div className="product-screen-chrome"><i/><i/><i/></div><div className="product-screen-content"/></div>
 <div className="absolute inset-0 z-10">{modelUrl?<ProductModel src={modelUrl} name={name}/>:image?<img src={image} alt={`${name} product`} className="h-full w-full object-contain p-8"/>:null}</div>
 </div>;
}
