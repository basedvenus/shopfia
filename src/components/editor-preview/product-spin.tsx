"use client";
import { useState } from "react";
export function ProductSpin({image,name}:{image:string;name:string}) {
 const [paused,setPaused]=useState(false);
 return <div className="product-spin" data-paused={paused}>
  <div className="product-spin-shadow" aria-hidden="true"/>
  <div className="product-spin-plane"><img src={image} alt={`${name || 'Storefront'} product cutout`} className="product-spin-image"/></div>
  <div className="product-controls"><button type="button" aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused?'Resume spin':'Pause spin'}</button></div>
 </div>;
}
