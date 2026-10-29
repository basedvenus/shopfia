"use client";
import { useEffect, useState } from "react";
import { DimensionalStorefrontHero } from "@/components/editor-preview/dimensional-storefront-hero";
import type { StorefrontDesign } from "@/lib/storefront-design";
import type { ImageCrop } from "@/lib/image-crop";
import type { CSSProperties } from "react";
export function PublishedStorefrontHero({design,name,headline,description,location,image,logo,crop,headingStyle}: {design:StorefrontDesign;name:string;headline:string;description:string;location:string;image:string;logo:string;crop:ImageCrop;headingStyle:CSSProperties}) {
 const [mobile,setMobile]=useState(false);
 useEffect(()=>{const query=window.matchMedia("(max-width: 680px)");const update=()=>setMobile(query.matches);update();query.addEventListener("change",update);return()=>query.removeEventListener("change",update);},[]);
 return <section id="storefront-home" style={{order:0}}><DimensionalStorefrontHero effectModel={design.effectModel} effectImage={design.effectImage} presentation={design.effectPresentation} backgroundWord={design.effectWord} template={design.template ?? undefined} name={name} headline={headline} description={description} location={location} image={image} logo={logo} crop={crop} headingStyle={{...headingStyle,...(design.headingFamily ? {fontFamily:design.headingFamily}: {})}} mobile={mobile} depth={design.depth} mount={design.mount} edgeColor={design.edge} sceneColor={design.background} onDepthChange={()=>{}} onBook={()=>{const target=document.getElementById("inquiry");target?.scrollIntoView({behavior:"auto",block:"start"});target?.querySelector<HTMLElement>("input:not([type=hidden]),textarea,button,a")?.focus({preventScroll:true});}}/></section>;
}
