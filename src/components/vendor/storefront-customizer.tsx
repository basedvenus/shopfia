"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, GripVertical, Monitor, Smartphone, Wand2 } from "lucide-react";
import { updateStorefrontCustomizationAction } from "@/app/actions/vendor";
import { Button } from "@/components/ui/button";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CopyStorefrontLinkButton } from "@/components/vendor/copy-storefront-link-button";
import {
  APPROVED_STOREFRONT_SECTIONS,
  STOREFRONT_BUTTON_STYLES,
  STOREFRONT_FONT_STYLES,
  STOREFRONT_IMAGE_SHAPES,
  STOREFRONT_LAYOUTS,
  STOREFRONT_PALETTES,
  STOREFRONT_SECTION_LABELS,
  sanitizeStorefrontSections,
  storefrontPath
} from "@/lib/businesses";
import { formatCurrency } from "@/lib/utils";

type CustomizerBusiness = {
  availabilityNotes: string | null;
  bio: string | null;
  city: string;
  coverPhoto: string | null;
  id: string;
  instagramUrl: string | null;
  logoUrl: string | null;
  name: string;
  offerings: Array<{ basePriceCents: number | null; id: string; title: string }>;
  photos: string[];
  serviceAreaNotes: string | null;
  serviceRadiusMiles: number;
  slug: string;
  startingPriceCents: number | null;
  state: string | null;
  storefrontAboutHeading: string | null;
  storefrontAboutImage: string | null;
  storefrontButtonStyle: string;
  storefrontFontStyle: string;
  storefrontHiddenSections: string[];
  storefrontImageShape: string;
  storefrontLayout: string;
  storefrontPalette: string;
  storefrontSectionOrder: string[];
  storefrontTagline: string | null;
  tiktokUrl: string | null;
  website: string | null;
};

type FormState = {
  aboutHeading: string;
  aboutImage: string;
  availabilityNotes: string;
  bio: string;
  buttonStyle: string;
  coverPhoto: string;
  fontStyle: string;
  hiddenSections: string[];
  imageShape: string;
  instagramUrl: string;
  layout: string;
  logoUrl: string;
  name: string;
  palette: string;
  photoUrls: string[];
  sectionOrder: string[];
  serviceAreaNotes: string;
  tagline: string;
  tiktokUrl: string;
  website: string;
};

const categories = ["Page", "Design", "Sections", "Settings"] as const;

export function StorefrontCustomizer({
  business,
  publicUrl,
  saved
}: {
  business: CustomizerBusiness;
  publicUrl: string;
  saved?: boolean;
}) {
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("Page");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState(saved ? "Saved" : "Published");
  const [form, setForm] = useState<FormState>(() => ({
    aboutHeading: business.storefrontAboutHeading ?? `About ${business.name}`,
    aboutImage: business.storefrontAboutImage ?? "",
    availabilityNotes: business.availabilityNotes ?? "",
    bio: business.bio ?? "",
    buttonStyle: business.storefrontButtonStyle,
    coverPhoto: business.coverPhoto ?? business.photos[0] ?? "",
    fontStyle: business.storefrontFontStyle,
    hiddenSections: business.storefrontHiddenSections,
    imageShape: business.storefrontImageShape,
    instagramUrl: business.instagramUrl ?? "",
    layout: business.storefrontLayout,
    logoUrl: business.logoUrl ?? "",
    name: business.name,
    palette: business.storefrontPalette,
    photoUrls: [...business.photos, "", "", "", "", "", ""].slice(0, 8),
    sectionOrder: sanitizeStorefrontSections(business.storefrontSectionOrder),
    serviceAreaNotes: business.serviceAreaNotes ?? "",
    tagline: business.storefrontTagline ?? "",
    tiktokUrl: business.tiktokUrl ?? "",
    website: business.website ?? ""
  }));

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setStatus("Unpublished changes");
  }

  function updatePhoto(index: number, value: string) {
    const next = [...form.photoUrls];
    next[index] = value;
    update("photoUrls", next);
  }

  const visibleSections = useMemo(
    () => form.sectionOrder.filter((section) => !form.hiddenSections.includes(section)),
    [form.hiddenSections, form.sectionOrder]
  );

  return (
    <form action={updateStorefrontCustomizationAction} className="min-h-[calc(100vh-130px)] overflow-hidden rounded-[1.25rem] border border-white/80 bg-white shadow-[0_18px_50px_rgba(72,44,43,0.08)]">
      <input type="hidden" name="businessId" value={business.id} />
      <input type="hidden" name="name" value={form.name} />
      <input type="hidden" name="tagline" value={form.tagline} />
      <input type="hidden" name="bio" value={form.bio} />
      <input type="hidden" name="aboutHeading" value={form.aboutHeading} />
      <input type="hidden" name="aboutImage" value={form.aboutImage} />
      <input type="hidden" name="logoUrl" value={form.logoUrl} />
      <input type="hidden" name="coverPhoto" value={form.coverPhoto} />
      <input type="hidden" name="serviceAreaNotes" value={form.serviceAreaNotes} />
      <input type="hidden" name="availabilityNotes" value={form.availabilityNotes} />
      <input type="hidden" name="website" value={form.website} />
      <input type="hidden" name="instagramUrl" value={form.instagramUrl} />
      <input type="hidden" name="tiktokUrl" value={form.tiktokUrl} />
      <input type="hidden" name="layout" value={form.layout} />
      <input type="hidden" name="fontStyle" value={form.fontStyle} />
      <input type="hidden" name="palette" value={form.palette} />
      <input type="hidden" name="buttonStyle" value={form.buttonStyle} />
      <input type="hidden" name="imageShape" value={form.imageShape} />
      {form.sectionOrder.map((section) => <input key={`order-${section}`} type="hidden" name="sectionOrder" value={section} />)}
      {form.hiddenSections.map((section) => <input key={`hidden-${section}`} type="hidden" name="hiddenSections" value={section} />)}
      {form.photoUrls.filter(Boolean).map((photo, index) => <input key={`${photo}-${index}`} type="hidden" name="photoUrls" value={photo} />)}

      <div className="flex flex-col gap-3 border-b border-[#eadbd8] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={`/vendor/business/${business.slug}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border hover:bg-muted" aria-label="Back to business dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Edit Storefront</p>
            <h1 className="truncate text-xl font-semibold">{form.name}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fbf7f5] px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <Check className="h-3.5 w-3.5" />
            {status}
          </span>
          <Button type="button" variant="secondary" onClick={() => setMode(mode === "preview" ? "edit" : "preview")}>Preview</Button>
          <Button type="submit" variant="secondary" onClick={() => setStatus("Saving")}>Save</Button>
          <Button type="submit" onClick={() => setStatus("Publishing")}>Publish</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[340px_1fr]">
        <aside className={`${mode === "preview" ? "hidden lg:block" : "block"} border-b border-[#eadbd8] bg-[#fbf7f5] lg:max-h-[calc(100vh-190px)] lg:overflow-y-auto lg:border-b-0 lg:border-r`}>
          <nav className="flex gap-2 overflow-x-auto p-3 lg:grid lg:grid-cols-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeCategory === category ? "bg-foreground text-background" : "bg-white text-muted-foreground hover:text-foreground"}`}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </nav>
          <div className="space-y-4 p-4">
            {activeCategory === "Page" ? <PageControls form={form} update={update} updatePhoto={updatePhoto} /> : null}
            {activeCategory === "Design" ? <DesignControls form={form} update={update} /> : null}
            {activeCategory === "Sections" ? <SectionControls form={form} update={update} /> : null}
            {activeCategory === "Settings" ? <SettingsControls publicUrl={publicUrl} /> : null}
          </div>
        </aside>

        <section className={`${mode === "edit" ? "hidden lg:block" : "block"} bg-[#f6efec] p-4 lg:max-h-[calc(100vh-190px)] lg:overflow-y-auto`}>
          <div className="mb-3 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Monitor className="hidden h-4 w-4 sm:block" />
              Live preview
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Smartphone className="h-4 w-4" />
              Responsive
            </div>
          </div>
          <StorefrontPreview business={business} form={form} visibleSections={visibleSections} />
        </section>
      </div>
    </form>
  );
}

function PageControls({ form, update, updatePhoto }: { form: FormState; update: <K extends keyof FormState>(key: K, value: FormState[K]) => void; updatePhoto: (index: number, value: string) => void }) {
  return (
    <>
      <ControlGroup title="Business identity">
        <Field label="Business name"><Input value={form.name} onChange={(event) => update("name", event.target.value)} /></Field>
        <Field label="Short tagline"><Input value={form.tagline} onChange={(event) => update("tagline", event.target.value)} /></Field>
        <Field label="Primary call-to-action text"><Input value="Request a Quote" readOnly /></Field>
        <ImageUploadField name="editorLogo" label="Logo" value={form.logoUrl} onChangePreview={(value) => update("logoUrl", value)} rounded="full" />
        <ImageUploadField name="editorCover" label="Cover / hero image" value={form.coverPhoto} onChangePreview={(value) => update("coverPhoto", value)} />
      </ControlGroup>
      <ControlGroup title="About the business">
        <Field label="About Us heading"><Input value={form.aboutHeading} onChange={(event) => update("aboutHeading", event.target.value)} /></Field>
        <Field label="About Us description"><Textarea value={form.bio} className="min-h-[120px]" onChange={(event) => update("bio", event.target.value)} /></Field>
        <ImageUploadField name="editorAboutImage" label="Company or founder headshot" value={form.aboutImage} onChangePreview={(value) => update("aboutImage", value)} />
      </ControlGroup>
      <ControlGroup title="Business information">
        <Field label="Service areas"><Textarea value={form.serviceAreaNotes} onChange={(event) => update("serviceAreaNotes", event.target.value)} /></Field>
        <Field label="Booking notes"><Textarea value={form.availabilityNotes} onChange={(event) => update("availabilityNotes", event.target.value)} /></Field>
        <Field label="Website"><Input value={form.website} onChange={(event) => update("website", event.target.value)} /></Field>
        <Field label="Instagram"><Input value={form.instagramUrl} onChange={(event) => update("instagramUrl", event.target.value)} /></Field>
        <Field label="TikTok"><Input value={form.tiktokUrl} onChange={(event) => update("tiktokUrl", event.target.value)} /></Field>
      </ControlGroup>
      <ControlGroup title="Portfolio">
        <p className="text-xs text-muted-foreground">Upload, replace, remove, and reorder portfolio images by moving images between slots.</p>
        {form.photoUrls.map((photo, index) => (
          <ImageUploadField key={index} name={`editorPhoto${index}`} label={`Portfolio image ${index + 1}`} value={photo} onChangePreview={(value) => updatePhoto(index, value)} />
        ))}
      </ControlGroup>
    </>
  );
}

function DesignControls({ form, update }: { form: FormState; update: <K extends keyof FormState>(key: K, value: FormState[K]) => void }) {
  return (
    <>
      <ChoiceGrid title="Layout" name="layout" current={form.layout} options={STOREFRONT_LAYOUTS} update={(value) => update("layout", value)} />
      <ChoiceGrid title="Font pairing" name="fontStyle" current={form.fontStyle} options={STOREFRONT_FONT_STYLES} update={(value) => update("fontStyle", value)} />
      <ChoiceGrid title="Color theme" name="palette" current={form.palette} options={STOREFRONT_PALETTES} update={(value) => update("palette", value)} palette />
      <CompactChoice title="Button style" current={form.buttonStyle} options={STOREFRONT_BUTTON_STYLES} update={(value) => update("buttonStyle", value)} />
      <CompactChoice title="Image shape" current={form.imageShape} options={STOREFRONT_IMAGE_SHAPES} update={(value) => update("imageShape", value)} />
      <CompactChoice title="Section spacing" current="BALANCED" options={[{ value: "COMPACT", label: "Compact" }, { value: "BALANCED", label: "Balanced" }, { value: "AIRY", label: "Airy" }]} update={() => undefined} />
    </>
  );
}

function SectionControls({ form, update }: { form: FormState; update: <K extends keyof FormState>(key: K, value: FormState[K]) => void }) {
  function move(section: string, direction: -1 | 1) {
    const index = form.sectionOrder.indexOf(section);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= form.sectionOrder.length) return;
    const next = [...form.sectionOrder];
    [next[index], next[target]] = [next[target], next[index]];
    update("sectionOrder", next);
  }

  function toggle(section: string) {
    if (section === "hero") return;
    update(
      "hiddenSections",
      form.hiddenSections.includes(section)
        ? form.hiddenSections.filter((item) => item !== section)
        : [...form.hiddenSections, section]
    );
  }

  return (
    <ControlGroup title="Storefront sections">
      {form.sectionOrder.map((section) => (
        <div key={section} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-[1rem] bg-white p-3">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <button type="button" className="text-left text-sm font-semibold" onClick={() => update("hiddenSections", form.hiddenSections.filter((item) => item !== section))}>
            {STOREFRONT_SECTION_LABELS[section as keyof typeof STOREFRONT_SECTION_LABELS]}
          </button>
          <div className="flex items-center gap-1">
            <button type="button" className="rounded-full border px-2 py-1 text-xs" onClick={() => move(section, -1)}>Up</button>
            <button type="button" className="rounded-full border px-2 py-1 text-xs" onClick={() => move(section, 1)}>Down</button>
            <button type="button" className="rounded-full border px-2 py-1 text-xs" onClick={() => toggle(section)}>
              {form.hiddenSections.includes(section) ? "Show" : "Hide"}
            </button>
          </div>
        </div>
      ))}
    </ControlGroup>
  );
}

function SettingsControls({ publicUrl }: { publicUrl: string }) {
  return (
    <ControlGroup title="Publishing">
      <p className="text-sm leading-6 text-muted-foreground">Preview, save, publish, and copy the storefront link from this editor.</p>
      <CopyStorefrontLinkButton url={publicUrl} label="Copy Link" className="w-full bg-white" />
    </ControlGroup>
  );
}

function ControlGroup({ children, title }: { children: React.ReactNode; title: string }) {
  return <section className="space-y-3 rounded-[1rem] bg-white p-4"><h2 className="text-sm font-semibold">{title}</h2>{children}</section>;
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="grid gap-2 text-sm font-medium">{label}{children}</label>;
}

function ChoiceGrid({ current, options, palette = false, title, update }: { current: string; options: ReadonlyArray<{ className?: string; description: string; label: string; value: string }>; palette?: boolean; title: string; name: string; update: (value: string) => void }) {
  return (
    <ControlGroup title={title}>
      <div className="grid gap-2">
        {options.map((option) => (
          <button key={option.value} type="button" className={`rounded-[1rem] border p-3 text-left text-sm transition ${current === option.value ? "border-primary bg-[#fff8f6]" : "bg-white"}`} onClick={() => update(option.value)}>
            {palette && option.className ? <span className={`mb-2 block h-8 rounded-lg bg-gradient-to-r ${option.className}`} /> : <span className="mb-2 block h-8 rounded-lg bg-[#fbf7f5]" />}
            <span className="font-semibold">{option.label}</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
          </button>
        ))}
      </div>
    </ControlGroup>
  );
}

function CompactChoice({ current, options, title, update }: { current: string; options: ReadonlyArray<{ label: string; value: string }>; title: string; update: (value: string) => void }) {
  return (
    <ControlGroup title={title}>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button key={option.value} type="button" className={`rounded-full border px-3 py-2 text-xs font-semibold ${current === option.value ? "border-primary bg-[#fff8f6]" : "bg-white"}`} onClick={() => update(option.value)}>
            {option.label}
          </button>
        ))}
      </div>
    </ControlGroup>
  );
}

function StorefrontPreview({ business, form, visibleSections }: { business: CustomizerBusiness; form: FormState; visibleSections: string[] }) {
  const palette = STOREFRONT_PALETTES.find((item) => item.value === form.palette) ?? STOREFRONT_PALETTES[0];
  const imageRadius = form.imageShape === "SQUARE" ? "rounded-none" : form.imageShape === "SOFT" ? "rounded-[2rem]" : "rounded-[1rem]";
  const portfolio = form.photoUrls.filter(Boolean);
  return (
    <div className={`mx-auto max-w-5xl overflow-hidden rounded-[1.5rem] bg-gradient-to-br ${palette.className} shadow-[0_18px_50px_rgba(72,44,43,0.08)]`}>
      <section className="relative min-h-[420px] p-6 sm:p-10">
        {form.coverPhoto ? <img src={form.coverPhoto} alt="" className={`absolute inset-0 h-full w-full object-cover ${imageRadius}`} /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="relative z-10 flex min-h-[340px] flex-col justify-end text-white">
          {form.logoUrl ? <img src={form.logoUrl} alt="" className="mb-4 h-16 w-16 rounded-full object-cover" /> : null}
          <h2 className="max-w-2xl text-4xl font-semibold tracking-[-0.04em]">{form.name}</h2>
          {form.tagline ? <p className="mt-3 max-w-xl text-base leading-7 text-white/88">{form.tagline}</p> : null}
          <a href="#preview-inquiry" className="mt-5 inline-flex w-fit rounded-full bg-white px-5 py-3 text-sm font-semibold text-foreground">Request a Quote</a>
        </div>
      </section>
      <div className="space-y-10 bg-white/78 p-6 sm:p-10">
        {visibleSections.map((section) => {
          if (section === "about") return <PreviewSection key={section} title={form.aboutHeading}><p>{form.bio || "Add a warm description of your work and what clients can expect."}</p>{form.aboutImage ? <img src={form.aboutImage} alt="" className={`mt-4 h-56 w-full object-cover ${imageRadius}`} /> : null}</PreviewSection>;
          if (section === "portfolio" && portfolio.length) return <PreviewSection key={section} title="Portfolio"><div className="grid grid-cols-2 gap-3 md:grid-cols-3">{portfolio.slice(0, 6).map((photo, index) => <img key={`${photo}-${index}`} src={photo} alt="" className={`aspect-square object-cover ${imageRadius}`} />)}</div></PreviewSection>;
          if (section === "services" && business.offerings.length) return <PreviewSection key={section} title="Services"><div className="grid gap-3 md:grid-cols-3">{business.offerings.map((offering) => <div key={offering.id} className="rounded-[1rem] bg-white p-4 shadow-sm"><div className="font-semibold">{offering.title}</div><div className="mt-2 text-sm text-muted-foreground">{offering.basePriceCents ? `From ${formatCurrency(offering.basePriceCents)}` : "Message for pricing"}</div></div>)}</div></PreviewSection>;
          if (section === "service-area") return <PreviewSection key={section} title="Service Area"><p>{form.serviceAreaNotes || `${business.city}${business.state ? `, ${business.state}` : ""} and nearby areas within ${business.serviceRadiusMiles} miles.`}</p></PreviewSection>;
          if (section === "inquiry-form") return <PreviewSection key={section} title="Request a Quote"><div id="preview-inquiry" className="rounded-[1rem] bg-white p-4 text-sm text-muted-foreground">Inquiry form appears here on the live storefront.</div></PreviewSection>;
          if (section === "social-links" && (form.instagramUrl || form.tiktokUrl || form.website)) return <PreviewSection key={section} title="Social Links"><p>{[form.instagramUrl, form.tiktokUrl, form.website].filter(Boolean).join(" · ")}</p></PreviewSection>;
          return null;
        })}
      </div>
    </div>
  );
}

function PreviewSection({ children, title }: { children: React.ReactNode; title: string }) {
  return <section><h3 className="text-2xl font-semibold tracking-[-0.03em]">{title}</h3><div className="mt-3 text-sm leading-6 text-muted-foreground">{children}</div></section>;
}
