"use client";
import { ProductSpin } from "./product-spin";
import { ProductSpotlight } from "./product-spotlight";
import { InlineStorefrontText } from "./inline-storefront-text";
import { TemplateIllustration } from "./template-illustration";

import type { StorefrontTemplate } from "@/lib/editor-preview/storefront-template-library";
import { sectionDesignStyle } from "@/lib/editor-preview/template-section-design";
import { TemplateHeading } from "./template-heading";
import { ArrowUpRight, Upload, Pencil, X } from "lucide-react";
import { StorefrontBrandSculpture, type LogoMount } from "@/components/editor-preview/storefront-brand-sculpture";
import { ImageCropEditor } from "@/components/ui/image-crop-editor";
import { CroppedImage } from "@/components/ui/cropped-image";
import type { ImageCrop } from "@/lib/image-crop";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import "./dimensional-storefront-hero.css";

export type HeroDepth = "flat" | "layered" | "floating";
export const HERO_DEPTH_PRESETS: { value: HeroDepth; label: string; detail: string }[] = [
  { value: "flat", label: "Off", detail: "Standard hero" },
  { value: "floating", label: "3D Effect", detail: "Stays visible and interactive" }
];

export function DimensionalStorefrontHero({ onCoverCropChange, coverEditor, effectOnly=false, effectModel="", effectImage="", presentation="emblem", backgroundWord="", template, name, headline, description, onHeadlineChange, onDescriptionChange, descriptionLabel="Tagline", location, image, crop, logo, depth, mobile, headingStyle, onBook, onDepthChange, mount, edgeColor, sceneColor }: {
  coverEditor?: ReactNode;
  onCoverCropChange?:(crop:ImageCrop)=>void;
  effectOnly?:boolean;
  previewReplay?:number;
  effectModel?:string; effectImage?:string; presentation?:"emblem"|"product"|"spin"; backgroundWord?:string;
  template?: StorefrontTemplate;
  onHeadlineChange?: (value:string)=>void; onDescriptionChange?: (value:string)=>void; descriptionLabel?:string;
  name: string; headline: string; description: string; location: string;
  image: string; crop: ImageCrop; secondaryImage?: string; logo: string;
  depth: HeroDepth; mobile: boolean; headingStyle: CSSProperties; onBook: () => void; onDepthChange: (value: HeroDepth) => void; mount: LogoMount; edgeColor: string; sceneColor: string;
}) {
  const [cropOpen,setCropOpen]=useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const coverDialog = useRef<HTMLDialogElement>(null);
  const playing = depth !== "flat";
  const effectsButton = useRef<HTMLButtonElement>(null);
  const [effectsOpen, setEffectsOpen] = useState(false);
  const headlineContent = (template?.id === "reference-02" ? <span className="reference-inline-title"><span>{(headline || name).split(" ").slice(0,1).join(" ")}</span>{" "}<TemplateIllustration kind={template.illustration || "ribbon"} className="reference-title-art"/><span>{(headline || name).split(" ").slice(1).join(" ")}</span></span> : <TemplateHeading text={headline || name || "Your storefront"} treatment={template?.headingTreatment} accentFamily={template?.accentHeadingFamily}/>);
  return (
    <><div ref={rootRef} className={`depth-hero ${mobile ? "depth-mobile" : ""}`} data-preview-playing={playing} data-depth={depth} data-presentation={presentation} data-reference={template?.id} style={{...(effectOnly?{display:"block"}:{}),"--scene-color":sceneColor,...sectionDesignStyle(template?.sectionDesigns?.hero),...(template?.sectionDesigns?.hero ? {"--template-heroInk":template.sectionDesigns.hero.ink} : {})} as CSSProperties}>

      {!effectOnly && <div className="depth-copy">
        {template?.illustration && template.id !== "reference-02" && <TemplateIllustration kind={template.illustration} className="mb-3 h-20 w-20"/>}
        {location ? <p className="depth-location">{location}</p> : null}
        <h2 style={headingStyle}>{onHeadlineChange ? <InlineStorefrontText label="Headline" value={headline} placeholder="Type headline here" onChange={onHeadlineChange}>{headlineContent}</InlineStorefrontText> : <span data-storefront-text="headline">{headlineContent}</span>}</h2>
        {onDescriptionChange ? <p className="depth-description"><InlineStorefrontText label={descriptionLabel} value={description} placeholder="Type tagline here" onChange={onDescriptionChange}/></p> : description ? <p className="depth-description" data-storefront-text="description">{description}</p> : null}
        <button type="button" data-storefront-button style={{...(template?.buttonColor?{background:template.buttonColor,color:template.colors.accentInk}:{}),borderRadius:template?.button==="pill"?999:0}} className="depth-book" onClick={(event) => { event.stopPropagation(); onBook(); }}>{template?.buttonText || "Request a quote"} <ArrowUpRight size={17} aria-hidden="true" /></button>
      </div>}
      <div className="depth-scene" data-playing={playing}>
        <div className="depth-regular-cover" style={{position:"relative",...(crop.aspectRatio?{aspectRatio:crop.aspectRatio,height:"auto",minHeight:0,maxHeight:"none"}:{})}}>{image ? <CroppedImage src={image} frameFit={image === logo ? "contain" : "cover"} crop={crop} alt={`${name || "Storefront"} cover`} loading="eager" className="h-full w-full object-cover" /> : <span className="depth-empty">{coverEditor ? "" : "Add a cover image"}</span>}
          {coverEditor && <button type="button" aria-label={image ? "Edit cover image" : "Upload cover image"} onDoubleClick={event=>{event.stopPropagation();if(image&&onCoverCropChange)setCropOpen(true);}} onClick={event=>{event.stopPropagation();if(image&&onCoverCropChange)setCropOpen(true);else coverDialog.current?.showModal();}} className="group absolute inset-0 z-10 flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary">
            <span className={`inline-flex items-center gap-2 rounded-full border border-[#eadbd8] bg-white px-4 py-2 text-sm text-[#675f59] shadow-sm ${image ? "opacity-90 group-hover:opacity-100" : ""}`}>{image ? <Pencil size={17}/> : <Upload size={17}/>} {image ? "Edit cover image" : "Upload cover image"}</span>
          </button>}
        </div>
        {coverEditor && <dialog ref={coverDialog} aria-label="Edit cover image" onClick={event=>event.stopPropagation()} className="w-[min(480px,92vw)] max-h-[85vh] overflow-y-auto rounded-3xl border bg-[#fffaf7] p-6 shadow-xl backdrop:bg-black/30">
          <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Cover image</h3><button type="button" aria-label="Close cover image editor" onClick={()=>coverDialog.current?.close()} className="rounded-full p-2"><X size={20}/></button></div>
          {coverEditor}
          <button type="button" onClick={()=>coverDialog.current?.close()} className="mt-4 rounded-full border px-5 py-2 text-sm">Done</button>
        </dialog>}
        {playing ? <div className="depth-permanent-layer">
          {presentation === "spin" ? <ProductSpin modelUrl={effectModel} image={effectImage} name={name}/> : presentation === "product" ? <ProductSpotlight modelUrl={effectModel} image={effectImage} word={backgroundWord} name={name} headingStyle={headingStyle}/> : <><div className="depth-stage-light" aria-hidden="true"/><div className="depth-floor-shadow" aria-hidden="true"/><StorefrontBrandSculpture touchPreview={mobile} mount={mount} edgeColor={edgeColor} image={effectImage || logo || image} name={name} interactive /></>}
        </div> : null}

      </div>
    </div>{cropOpen&&onCoverCropChange&&<ImageCropEditor allowFrameResize imageUrl={image} crop={crop} preserveFrame previewAspectRatio={rootRef.current?.querySelector(".depth-regular-cover")?.getBoundingClientRect().width! / rootRef.current?.querySelector(".depth-regular-cover")?.getBoundingClientRect().height! || 1.5} onCancel={()=>setCropOpen(false)} onSave={value=>{onCoverCropChange(value);setCropOpen(false);}}/>}</>
  );
}
