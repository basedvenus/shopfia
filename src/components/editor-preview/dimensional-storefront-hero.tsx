"use client";
import { ProductSpin } from "./product-spin";
import { ProductSpotlight } from "./product-spotlight";
import { InlineStorefrontText } from "./inline-storefront-text";
import { TemplateIllustration } from "./template-illustration";

import type { StorefrontTemplate } from "@/lib/editor-preview/storefront-template-library";
import { sectionDesignStyle } from "@/lib/editor-preview/template-section-design";
import { TemplateHeading } from "./template-heading";
import { ArrowUpRight } from "lucide-react";
import { StorefrontBrandSculpture, type LogoMount } from "@/components/editor-preview/storefront-brand-sculpture";
import { CroppedImage } from "@/components/ui/cropped-image";
import type { ImageCrop } from "@/lib/image-crop";
import { useRef, useState, type CSSProperties } from "react";
import "./dimensional-storefront-hero.css";

export type HeroDepth = "flat" | "layered" | "floating";
export const HERO_DEPTH_PRESETS: { value: HeroDepth; label: string; detail: string }[] = [
  { value: "flat", label: "Off", detail: "Standard hero" },
  { value: "floating", label: "3D Effect", detail: "Stays visible and interactive" }
];

export function DimensionalStorefrontHero({ effectImage="", presentation="emblem", backgroundWord="", template, name, headline, description, onHeadlineChange, onDescriptionChange, descriptionLabel="Tagline", location, image, crop, logo, depth, mobile, headingStyle, onBook, onDepthChange, mount, edgeColor, sceneColor }: {
  previewReplay?:number;
  effectImage?:string; presentation?:"emblem"|"product"|"spin"; backgroundWord?:string;
  template?: StorefrontTemplate;
  onHeadlineChange?: (value:string)=>void; onDescriptionChange?: (value:string)=>void; descriptionLabel?:string;
  name: string; headline: string; description: string; location: string;
  image: string; crop: ImageCrop; secondaryImage?: string; logo: string;
  depth: HeroDepth; mobile: boolean; headingStyle: CSSProperties; onBook: () => void; onDepthChange: (value: HeroDepth) => void; mount: LogoMount; edgeColor: string; sceneColor: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const playing = depth !== "flat";
  const effectsButton = useRef<HTMLButtonElement>(null);
  const [effectsOpen, setEffectsOpen] = useState(false);
  const headlineContent = (template?.id === "reference-02" ? <span className="reference-inline-title"><span>{(headline || name).split(" ").slice(0,1).join(" ")}</span>{" "}<TemplateIllustration kind={template.illustration || "ribbon"} className="reference-title-art"/><span>{(headline || name).split(" ").slice(1).join(" ")}</span></span> : <TemplateHeading text={headline || name || "Your storefront"} treatment={template?.headingTreatment} accentFamily={template?.accentHeadingFamily}/>);
  return (
    <div ref={rootRef} className={`depth-hero ${mobile ? "depth-mobile" : ""}`} data-preview-playing={playing} data-depth={depth} data-reference={template?.id} style={{"--scene-color":sceneColor,...sectionDesignStyle(template?.sectionDesigns?.hero),...(template?.sectionDesigns?.hero ? {"--template-heroInk":template.sectionDesigns.hero.ink} : {})} as CSSProperties}>

      <div className="depth-copy">
        {template?.illustration && template.id !== "reference-02" && <TemplateIllustration kind={template.illustration} className="mb-3 h-20 w-20"/>}
        {location ? <p className="depth-location">{location}</p> : null}
        <h2 style={headingStyle}>{onHeadlineChange ? <InlineStorefrontText label="Headline" value={headline} placeholder="Type headline here" onChange={onHeadlineChange}>{headlineContent}</InlineStorefrontText> : headlineContent}</h2>
        {onDescriptionChange ? <p className="depth-description"><InlineStorefrontText label={descriptionLabel} value={description} placeholder="Type tagline here" onChange={onDescriptionChange}/></p> : description ? <p className="depth-description">{description}</p> : null}
        <button type="button" className="depth-book" onClick={(event) => { event.stopPropagation(); onBook(); }}>Request a quote <ArrowUpRight size={17} aria-hidden="true" /></button>
      </div>
      <div className="depth-scene" data-playing={playing}>
        <div className="depth-regular-cover">{image ? <CroppedImage src={image} frameFit={image === logo ? "contain" : "cover"} crop={crop} alt={`${name || "Storefront"} cover`} loading="eager" className="h-full w-full object-cover" /> : <span className="depth-empty">Add a cover image</span>}</div>
        {playing ? <div className="depth-permanent-layer">
          {presentation === "spin" ? <ProductSpin image={effectImage} name={name}/> : presentation === "product" ? <ProductSpotlight image={effectImage} word={backgroundWord} name={name} headingStyle={headingStyle}/> : <><div className="depth-stage-light" aria-hidden="true"/><div className="depth-floor-shadow" aria-hidden="true"/><StorefrontBrandSculpture touchPreview={mobile} mount={mount} edgeColor={edgeColor} image={effectImage || logo || image} name={name} interactive /></>}
        </div> : null}

      </div>
    </div>
  );
}
