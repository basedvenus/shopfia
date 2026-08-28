"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Check,
  Eye,
  EyeOff,
  GripVertical,
  ImagePlus,
  Monitor,
  Palette,
  Plus,
  Save,
  Send,
  Smartphone,
  Star,
  Trash2,
  Wand2
} from "lucide-react";
import { updateStorefrontCustomizationAction } from "@/app/actions/vendor";
import { Button } from "@/components/ui/button";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CopyStorefrontLinkButton } from "@/components/vendor/copy-storefront-link-button";
import {
  APPROVED_STOREFRONT_SECTIONS,
  STOREFRONT_FONT_STYLES,
  STOREFRONT_IMAGE_SHAPES,
  STOREFRONT_PALETTES,
  STOREFRONT_SECTION_LABELS,
  getStorefrontFontFamilies,
  normalizeStorefrontPalette,
  sanitizeStorefrontSections
} from "@/lib/businesses";
import { formatCurrency } from "@/lib/utils";

type EditorService = {
  active: boolean;
  basePriceCents: number | null;
  categoryId: string | null;
  description: string;
  featured: boolean;
  id: string;
  isNew?: boolean;
  messageForPricing: boolean;
  photos: string[];
  title: string;
  turnaroundDays: number | null;
};

type FaqItem = { id: string; answer: string; question: string };
type PolicyItem = { id: string; body: string; title: string };
type BookingInfo = { deposit: string; leadTime: string; process: string };

type CustomizerBusiness = {
  availabilityNotes: string | null;
  bio: string | null;
  categories: Array<{ categoryId: string; category: { name: string } }>;
  city: string;
  coverPhoto: string | null;
  id: string;
  instagramUrl: string | null;
  logoUrl: string | null;
  name: string;
  offerings: Array<{
    active: boolean;
    basePriceCents: number | null;
    categoryId: string;
    description: string;
    id: string;
    messageForPricing: boolean;
    photos: string[];
    title: string;
    turnaroundDays: number | null;
  }>;
  photos: string[];
  serviceAreaNotes: string | null;
  serviceRadiusMiles: number;
  slug: string;
  startingPriceCents: number | null;
  state: string | null;
  storefrontAboutHeading: string | null;
  storefrontAboutImage: string | null;
  storefrontBookingJson: unknown;
  storefrontButtonStyle: string;
  storefrontDraftJson: unknown;
  storefrontFaqJson: unknown;
  storefrontFeaturedOfferingIds: string[];
  storefrontFontStyle: string;
  storefrontHiddenSections: string[];
  storefrontImageShape: string;
  storefrontLayout: string;
  storefrontOfferingOrder: string[];
  storefrontPalette: string;
  storefrontPoliciesJson: unknown;
  storefrontSectionOrder: string[];
  storefrontTagline: string | null;
  storefrontTextTone: string;
  tiktokUrl: string | null;
  website: string | null;
};

type FormState = {
  aboutHeading: string;
  aboutImage: string;
  availabilityNotes: string;
  bio: string;
  booking: BookingInfo;
  coverPhoto: string;
  city: string;
  faqs: FaqItem[];
  fontStyle: string;
  hiddenSections: string[];
  imageShape: string;
  instagramUrl: string;
  logoUrl: string;
  name: string;
  palette: string;
  photoUrls: string[];
  policies: PolicyItem[];
  sectionOrder: string[];
  serviceAreaNotes: string;
  services: EditorService[];
  state: string;
  tagline: string;
  textTone: string;
  tiktokUrl: string;
  website: string;
};

const editableSections = APPROVED_STOREFRONT_SECTIONS;

export function StorefrontCustomizer({
  business,
  draftSaved,
  errorMessage,
  publicUrl,
  saved
}: {
  business: CustomizerBusiness;
  draftSaved?: boolean;
  errorMessage?: string;
  publicUrl: string;
  saved?: boolean;
}) {
  const [activeSection, setActiveSection] = useState<string>("hero");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState(errorMessage ? "Needs attention" : draftSaved ? "Draft saved" : saved ? "Published" : "Live");
  const [draggedSection, setDraggedSection] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => createInitialState(business));

  const visibleSections = useMemo(
    () => form.sectionOrder.filter((section) => !form.hiddenSections.includes(section)),
    [form.hiddenSections, form.sectionOrder]
  );
  const activeSectionLabel = STOREFRONT_SECTION_LABELS[activeSection as keyof typeof STOREFRONT_SECTION_LABELS] ?? "Section";
  const servicesJson = useMemo(
    () =>
      JSON.stringify(
        form.services.map((service) => ({
          active: service.active,
          basePriceCents: service.basePriceCents,
          categoryId: service.categoryId,
          clientId: service.id,
          description: service.description,
          featured: service.featured,
          id: service.isNew ? undefined : service.id,
          messageForPricing: service.messageForPricing,
          photos: service.photos.filter(Boolean),
          title: service.title,
          turnaroundDays: service.turnaroundDays
        }))
      ),
    [form.services]
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    markDirty();
  }

  function markDirty() {
    setDirty(true);
    setStatus("Unpublished changes");
  }

  function moveSection(section: string, targetSection: string) {
    if (section === targetSection) return;
    const without = form.sectionOrder.filter((item) => item !== section);
    const targetIndex = without.indexOf(targetSection);
    update("sectionOrder", [...without.slice(0, targetIndex), section, ...without.slice(targetIndex)]);
  }

  function onSectionDrop(event: DragEvent<HTMLButtonElement>, targetSection: string) {
    event.preventDefault();
    if (draggedSection) moveSection(draggedSection, targetSection);
    setDraggedSection(null);
  }

  function toggleSection(section: string) {
    if (section === "hero") return;
    update(
      "hiddenSections",
      form.hiddenSections.includes(section)
        ? form.hiddenSections.filter((item) => item !== section)
        : [...form.hiddenSections, section]
    );
  }

  function updateService(id: string, patch: Partial<EditorService>) {
    update(
      "services",
      form.services.map((service) => (service.id === id ? { ...service, ...patch } : service))
    );
  }

  function moveService(id: string, direction: -1 | 1) {
    const index = form.services.findIndex((service) => service.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= form.services.length) return;
    const next = [...form.services];
    [next[index], next[target]] = [next[target], next[index]];
    update("services", next);
  }

  function addService() {
    const categoryId = business.categories[0]?.categoryId ?? null;
    update("services", [
      ...form.services,
      {
        active: true,
        basePriceCents: null,
        categoryId,
        description: "Describe what is included, who this service is best for, and what customers can customize.",
        featured: true,
        id: `draft-${crypto.randomUUID()}`,
        isNew: true,
        messageForPricing: true,
        photos: [],
        title: "New service",
        turnaroundDays: null
      }
    ]);
    setActiveSection("all-services");
  }

  function removeService(id: string) {
    update("services", form.services.map((service) => (service.id === id ? { ...service, active: false, featured: false } : service)));
  }

  return (
    <form action={updateStorefrontCustomizationAction} className="overflow-hidden rounded-[1.25rem] border border-white/80 bg-white shadow-[0_18px_50px_rgba(72,44,43,0.08)]">
      <input type="hidden" name="businessId" value={business.id} />
      <input type="hidden" name="businessSlug" value={business.slug} />
      <input type="hidden" name="name" value={form.name} />
      <input type="hidden" name="city" value={form.city} />
      <input type="hidden" name="state" value={form.state} />
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
      <input type="hidden" name="layout" value="EDITORIAL" />
      <input type="hidden" name="fontStyle" value={form.fontStyle} />
      <input type="hidden" name="palette" value={form.palette} />
      <input type="hidden" name="buttonStyle" value="PILL" />
      <input type="hidden" name="imageShape" value={form.imageShape} />
      <input type="hidden" name="textTone" value={form.textTone} />
      <input type="hidden" name="faqJson" value={JSON.stringify(form.faqs)} />
      <input type="hidden" name="policiesJson" value={JSON.stringify(form.policies)} />
      <input type="hidden" name="bookingJson" value={JSON.stringify(form.booking)} />
      <input type="hidden" name="servicesJson" value={servicesJson} />
      {form.sectionOrder.map((section) => <input key={`order-${section}`} type="hidden" name="sectionOrder" value={section} />)}
      {form.hiddenSections.map((section) => <input key={`hidden-${section}`} type="hidden" name="hiddenSections" value={section} />)}
      {form.photoUrls.filter(Boolean).map((photo, index) => <input key={`${photo}-${index}`} type="hidden" name="photoUrls" value={photo} />)}
      {form.services.map((service) => <input key={`offering-order-${service.id}`} type="hidden" name="offeringOrder" value={service.id} />)}
      {form.services.filter((service) => service.featured && service.active).map((service) => <input key={`featured-${service.id}`} type="hidden" name="featuredOfferingIds" value={service.id} />)}

      <div className="flex flex-col gap-3 border-b border-[#eadbd8] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={`/vendor/business/${business.slug}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border hover:bg-muted" aria-label="Back to business dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Customize Storefront</p>
            <h1 className="truncate text-xl font-semibold">{form.name}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fbf7f5] px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <Check className="h-3.5 w-3.5" />
            {status}
          </span>
          <Button type="button" variant="secondary" onClick={() => setPreviewMode(previewMode === "desktop" ? "mobile" : "desktop")}>
            {previewMode === "desktop" ? <Monitor className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
            {previewMode === "desktop" ? "Desktop" : "Mobile"}
          </Button>
          <Button type="submit" name="intent" value="draft" variant="secondary" onClick={() => setStatus("Saving draft")}>
            <Save className="h-4 w-4" />
            Save draft
          </Button>
          <Button type="submit" name="intent" value="publish" onClick={() => setStatus("Publishing")}>
            <Send className="h-4 w-4" />
            Publish
          </Button>
        </div>
      </div>
      {errorMessage ? (
        <div className="border-b border-[#f1c8c4] bg-[#fff4f2] px-4 py-3 text-sm font-medium text-[#8a332b]">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid min-h-[calc(100vh-190px)] lg:grid-cols-[260px_minmax(0,1fr)_360px]">
        <aside className="border-b border-[#eadbd8] bg-[#fbf7f5] p-3 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Sections</h2>
            <CopyStorefrontLinkButton url={publicUrl} label="Copy link" className="h-8 bg-white px-3 text-xs" />
          </div>
          <div className="grid gap-2">
            {form.sectionOrder.map((section) => {
              const hidden = form.hiddenSections.includes(section);
              const active = activeSection === section;
              return (
                <button
                  key={section}
                  type="button"
                  draggable
                  onClick={() => setActiveSection(section)}
                  onDragStart={() => setDraggedSection(section)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => onSectionDrop(event, section)}
                  className={`grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-[0.9rem] border p-3 text-left text-sm transition ${
                    active ? "border-primary bg-white text-foreground shadow-sm" : "border-transparent bg-white/70 text-muted-foreground hover:bg-white"
                  } ${hidden ? "opacity-55" : ""}`}
                >
                  <GripVertical className="h-4 w-4" />
                  <span className="font-semibold">{STOREFRONT_SECTION_LABELS[section as keyof typeof STOREFRONT_SECTION_LABELS]}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="rounded-full p-1 hover:bg-[#fbf7f5]"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleSection(section);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleSection(section);
                      }
                    }}
                  >
                    {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="bg-[#efe7e3] p-4 lg:max-h-[calc(100vh-190px)] lg:overflow-y-auto">
          <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>Click a section in the preview to edit it.</span>
            <Link href={publicUrl.replace(/^https?:\/\/[^/]+/, "")} target="_blank" className="font-semibold text-foreground underline-offset-4 hover:underline">
              View live
            </Link>
          </div>
          <div className={previewMode === "mobile" ? "mx-auto max-w-[390px]" : "mx-auto max-w-6xl"}>
            <StorefrontPreview
              activeSection={activeSection}
              business={business}
              form={form}
              previewMode={previewMode}
              setActiveSection={setActiveSection}
              visibleSections={visibleSections}
            />
          </div>
        </main>

        <aside className="border-t border-[#eadbd8] bg-white p-4 lg:max-h-[calc(100vh-190px)] lg:overflow-y-auto lg:border-l lg:border-t-0">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Editing</p>
            <h2 className="text-xl font-semibold">{activeSectionLabel}</h2>
          </div>
          <SectionEditor
            activeSection={activeSection}
            business={business}
            form={form}
            markDirty={markDirty}
            update={update}
            updateService={updateService}
            moveService={moveService}
            removeService={removeService}
            addService={addService}
          />
          <div className="mt-6 border-t border-[#eadbd7] pt-5">
            <DesignControls form={form} update={update} />
          </div>
        </aside>
      </div>
    </form>
  );
}

function createInitialState(business: CustomizerBusiness): FormState {
  const draft = readDraft(business.storefrontDraftJson);
  const orderedServices = orderServices(
    business.offerings.map((offering) => ({
      active: offering.active,
      basePriceCents: offering.basePriceCents,
      categoryId: offering.categoryId,
      description: offering.description,
      featured: business.storefrontFeaturedOfferingIds.includes(offering.id),
      id: offering.id,
      messageForPricing: offering.messageForPricing,
      photos: offering.photos,
      title: offering.title,
      turnaroundDays: offering.turnaroundDays
    })),
    business.storefrontOfferingOrder
  );
  return {
    aboutHeading: draft?.aboutHeading ?? business.storefrontAboutHeading ?? `About ${business.name}`,
    aboutImage: draft?.aboutImage ?? business.storefrontAboutImage ?? "",
    availabilityNotes: draft?.availabilityNotes ?? business.availabilityNotes ?? "",
    bio: draft?.bio ?? business.bio ?? "",
    booking: draft?.booking ?? readBooking(business.storefrontBookingJson),
    city: draft?.city ?? business.city,
    coverPhoto: draft?.coverPhoto ?? business.coverPhoto ?? business.photos[0] ?? "",
    faqs: draft?.faqs ?? readFaqs(business.storefrontFaqJson),
    fontStyle: draft?.fontStyle ?? business.storefrontFontStyle,
    hiddenSections: draft?.hiddenSections ?? business.storefrontHiddenSections,
    imageShape: draft?.imageShape ?? business.storefrontImageShape,
    instagramUrl: draft?.instagramUrl ?? business.instagramUrl ?? "",
    logoUrl: draft?.logoUrl ?? business.logoUrl ?? "",
    name: draft?.name ?? business.name,
    palette: normalizeStorefrontPalette(draft?.palette ?? business.storefrontPalette),
    photoUrls: draft?.photoUrls ?? [...business.photos, "", "", "", "", "", ""].slice(0, 10),
    policies: draft?.policies ?? readPolicies(business.storefrontPoliciesJson),
    sectionOrder: draft?.sectionOrder ?? sanitizeStorefrontSections(business.storefrontSectionOrder),
    serviceAreaNotes: draft?.serviceAreaNotes ?? business.serviceAreaNotes ?? "",
    services: draft?.services?.length ? mergeDraftServices(draft.services, orderedServices) : orderedServices,
    state: draft?.state ?? business.state ?? "",
    tagline: draft?.tagline ?? business.storefrontTagline ?? "",
    textTone: draft?.textTone ?? business.storefrontTextTone ?? "AUTO",
    tiktokUrl: draft?.tiktokUrl ?? business.tiktokUrl ?? "",
    website: draft?.website ?? business.website ?? ""
  };
}

function SectionEditor({
  activeSection,
  business,
  form,
  markDirty,
  update,
  updateService,
  moveService,
  removeService,
  addService
}: {
  activeSection: string;
  business: CustomizerBusiness;
  form: FormState;
  markDirty: () => void;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  updateService: (id: string, patch: Partial<EditorService>) => void;
  moveService: (id: string, direction: -1 | 1) => void;
  removeService: (id: string) => void;
  addService: () => void;
}) {
  if (activeSection === "hero") {
    return (
      <PanelStack>
        <Field label="Headline"><Input value={form.aboutHeading} onChange={(event) => update("aboutHeading", event.target.value)} /></Field>
        <Field label="Tagline"><Input value={form.tagline} onChange={(event) => update("tagline", event.target.value)} /></Field>
        <Field label="Business name"><Input value={form.name} onChange={(event) => update("name", event.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="City"><Input value={form.city} onChange={(event) => update("city", event.target.value)} /></Field>
          <Field label="State"><Input value={form.state} onChange={(event) => update("state", event.target.value)} /></Field>
        </div>
        <ImageUploadField name="editorLogo" label="Logo" value={form.logoUrl} onChangePreview={(value) => update("logoUrl", value)} rounded="full" />
        <ImageUploadField name="editorCover" label="Cover image" value={form.coverPhoto} onChangePreview={(value) => update("coverPhoto", value)} />
      </PanelStack>
    );
  }
  if (activeSection === "featured-services" || activeSection === "all-services") {
    return (
      <PanelStack>
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Edit, reorder, hide, feature, and add service photos.</p>
          <Button type="button" size="sm" onClick={addService}><Plus className="h-4 w-4" />Add</Button>
        </div>
        {form.services.map((service, index) => (
          <ServiceEditor
            key={service.id}
            business={business}
            index={index}
            service={service}
            updateService={updateService}
            moveService={moveService}
            removeService={removeService}
            markDirty={markDirty}
          />
        ))}
      </PanelStack>
    );
  }
  if (activeSection === "portfolio") {
    return (
      <PanelStack>
        <p className="text-sm text-muted-foreground">Replace images or reorder them by moving content between slots.</p>
        {form.photoUrls.map((photo, index) => (
          <div key={index} className="rounded-[1rem] border border-[#eadbd7] p-3">
            <ImageUploadField name={`portfolio-${index}`} label={`Portfolio image ${index + 1}`} value={photo} onChangePreview={(value) => {
              const next = [...form.photoUrls];
              next[index] = value;
              update("photoUrls", next);
            }} />
          </div>
        ))}
      </PanelStack>
    );
  }
  if (activeSection === "about") {
    return (
      <PanelStack>
        <Field label="About heading"><Input value={form.aboutHeading} onChange={(event) => update("aboutHeading", event.target.value)} /></Field>
        <Field label="About Us text"><Textarea className="min-h-[150px]" value={form.bio} onChange={(event) => update("bio", event.target.value)} /></Field>
        <ImageUploadField name="founderPhoto" label="Founder or team photo" value={form.aboutImage} onChangePreview={(value) => update("aboutImage", value)} />
      </PanelStack>
    );
  }
  if (activeSection === "how-it-works" || activeSection === "final-quote") {
    return (
      <PanelStack>
        <Field label="Service area"><Textarea value={form.serviceAreaNotes} onChange={(event) => update("serviceAreaNotes", event.target.value)} /></Field>
        <Field label="Lead time"><Input value={form.booking.leadTime} onChange={(event) => update("booking", { ...form.booking, leadTime: event.target.value })} /></Field>
        <Field label="Deposit or payment note"><Input value={form.booking.deposit} onChange={(event) => update("booking", { ...form.booking, deposit: event.target.value })} /></Field>
        <Field label="Booking process"><Textarea value={form.booking.process} onChange={(event) => update("booking", { ...form.booking, process: event.target.value })} /></Field>
        <Field label="Availability notes"><Textarea value={form.availabilityNotes} onChange={(event) => update("availabilityNotes", event.target.value)} /></Field>
      </PanelStack>
    );
  }
  if (activeSection === "faq") {
    return (
      <PanelStack>
        <Button type="button" variant="secondary" onClick={() => update("faqs", [...form.faqs, { id: crypto.randomUUID(), question: "New question", answer: "Answer this in your own words." }])}>
          <Plus className="h-4 w-4" />Add FAQ
        </Button>
        {form.faqs.map((faq) => (
          <div key={faq.id} className="rounded-[1rem] border border-[#eadbd7] p-3">
            <Field label="Question"><Input value={faq.question} onChange={(event) => update("faqs", form.faqs.map((item) => item.id === faq.id ? { ...item, question: event.target.value } : item))} /></Field>
            <Field label="Answer"><Textarea value={faq.answer} onChange={(event) => update("faqs", form.faqs.map((item) => item.id === faq.id ? { ...item, answer: event.target.value } : item))} /></Field>
          </div>
        ))}
      </PanelStack>
    );
  }
  if (activeSection === "reviews") {
    return <PanelStack><p className="text-sm leading-6 text-muted-foreground">Reviews are verified ShopFia booking records, so vendors can choose placement/visibility but cannot edit review content.</p></PanelStack>;
  }
  return (
    <PanelStack>
      <Field label="Website"><Input value={form.website} onChange={(event) => update("website", event.target.value)} /></Field>
      <Field label="Instagram"><Input value={form.instagramUrl} onChange={(event) => update("instagramUrl", event.target.value)} /></Field>
      <Field label="TikTok"><Input value={form.tiktokUrl} onChange={(event) => update("tiktokUrl", event.target.value)} /></Field>
      <Button type="button" variant="secondary" onClick={() => update("policies", [...form.policies, { id: crypto.randomUUID(), title: "New policy", body: "Describe the policy clearly." }])}>
        <Plus className="h-4 w-4" />Add policy
      </Button>
    </PanelStack>
  );
}

function ServiceEditor({
  business,
  index,
  markDirty,
  moveService,
  removeService,
  service,
  updateService
}: {
  business: CustomizerBusiness;
  index: number;
  markDirty: () => void;
  moveService: (id: string, direction: -1 | 1) => void;
  removeService: (id: string) => void;
  service: EditorService;
  updateService: (id: string, patch: Partial<EditorService>) => void;
}) {
  if (!service.active) {
    return (
      <div className="rounded-[1rem] border border-dashed border-[#eadbd7] p-3 text-sm text-muted-foreground">
        {service.title} will be hidden after publishing.
        <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => updateService(service.id, { active: true })}>Restore</Button>
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-[1rem] border border-[#eadbd7] bg-[#fffaf8] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">Service {index + 1}</div>
        <div className="flex gap-1">
          <button type="button" className="rounded-full border px-2 py-1 text-xs" onClick={() => moveService(service.id, -1)}>Up</button>
          <button type="button" className="rounded-full border px-2 py-1 text-xs" onClick={() => moveService(service.id, 1)}>Down</button>
          <button type="button" className="rounded-full border p-1 text-muted-foreground hover:text-foreground" onClick={() => removeService(service.id)}><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      <Field label="Service name"><Input value={service.title} onChange={(event) => updateService(service.id, { title: event.target.value })} /></Field>
      <Field label="Description"><Textarea value={service.description} onChange={(event) => updateService(service.id, { description: event.target.value })} /></Field>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Starting price"><Input inputMode="decimal" value={service.basePriceCents == null ? "" : String(service.basePriceCents / 100)} onChange={(event) => updateService(service.id, { basePriceCents: dollarsToCents(event.target.value), messageForPricing: false })} /></Field>
        <Field label="Lead time days"><Input inputMode="numeric" value={service.turnaroundDays ?? ""} onChange={(event) => updateService(service.id, { turnaroundDays: event.target.value ? Number(event.target.value) : null })} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={service.messageForPricing} onChange={(event) => updateService(service.id, { messageForPricing: event.target.checked })} />Custom quote instead of public price</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={service.featured} onChange={(event) => updateService(service.id, { featured: event.target.checked })} />Feature this service</label>
      {business.categories.length > 0 ? (
        <Field label="Category">
          <select className="h-10 rounded-[0.75rem] border border-[#eadbd7] bg-white px-3 text-sm" value={service.categoryId ?? ""} onChange={(event) => updateService(service.id, { categoryId: event.target.value })}>
            {business.categories.map((category) => <option key={category.categoryId} value={category.categoryId}>{category.category.name}</option>)}
          </select>
        </Field>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {[0, 1, 2].map((photoIndex) => (
          <ImageUploadField
            key={photoIndex}
            name={`service-${service.id}-${photoIndex}`}
            label={`Photo ${photoIndex + 1}`}
            value={service.photos[photoIndex] ?? ""}
            onChangePreview={(value) => {
              const photos = [...service.photos];
              photos[photoIndex] = value;
              updateService(service.id, { photos });
              markDirty();
            }}
          />
        ))}
      </div>
    </div>
  );
}

function DesignControls({
  form,
  update
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  const theme = getPreviewTheme(form);
  const selectedPalette = getPreviewPalette(form.palette);
  const [themeOpen, setThemeOpen] = useState(false);

  return (
    <PanelStack>
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Theme System</h3>
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setThemeOpen((open) => !open)}
          style={{ borderColor: selectedPalette.accent, backgroundColor: `${selectedPalette.accent}12` }}
          className="flex w-full items-center gap-3 rounded-[0.9rem] border p-3 text-left text-sm transition hover:bg-[#fffaf8]"
          aria-expanded={themeOpen}
        >
          <span className={`h-9 w-9 shrink-0 rounded-full bg-gradient-to-br ${selectedPalette.className}`} />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Change theme</span>
            <span className="block text-xs text-muted-foreground">{selectedPalette.label}</span>
            <span className="mt-1 flex gap-1.5">
              {selectedPalette.swatches.map((color) => (
                <span key={color} className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: color }} />
              ))}
            </span>
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${themeOpen ? "rotate-180" : ""}`} />
        </button>
        {themeOpen ? (
          <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto rounded-[1rem] border border-[#eadbd7] bg-white p-2 shadow-[0_14px_40px_rgba(72,44,43,0.12)]">
            {STOREFRONT_PALETTES.map((palette) => (
              <button
                key={palette.value}
                type="button"
                onClick={() => {
                  update("palette", palette.value);
                  setThemeOpen(false);
                }}
                style={form.palette === palette.value ? { borderColor: palette.accent, backgroundColor: `${palette.accent}12` } : undefined}
                className={`flex items-center gap-3 rounded-[0.8rem] border p-3 text-left text-sm transition ${
                  form.palette === palette.value ? "" : "border-[#eadbd7] hover:bg-[#fffaf8]"
                }`}
              >
                <span className={`h-8 w-8 shrink-0 rounded-full bg-gradient-to-br ${palette.className}`} />
                <span className="min-w-0">
                  <span className="block font-semibold">{palette.label}</span>
                  <span className="mt-1 flex gap-1.5">
                    {palette.swatches.map((color) => (
                      <span key={color} className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: color }} />
                    ))}
                  </span>
                  <span className="block text-xs text-muted-foreground">{palette.description}</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <Field label="Font pairing">
        <select className="h-10 rounded-[0.75rem] border border-[#eadbd7] bg-white px-3 text-sm" value={form.fontStyle} onChange={(event) => update("fontStyle", event.target.value)}>
          {STOREFRONT_FONT_STYLES.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
        </select>
      </Field>
      <div className={`overflow-hidden border p-3 text-sm ${theme.cardClass} ${theme.sectionRadius}`} style={theme.previewCardStyle}>
        <div className={`mb-3 h-16 ${theme.imageRadius}`} style={theme.accentBlockStyle} />
        <div className="text-lg font-semibold" style={theme.headingStyle}>Live theme sample</div>
        <p className={`mt-1 ${theme.copyClass}`}>
          This sample uses the selected font, text color, accent color, and image shape.
        </p>
        <span className="mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold" style={theme.badgeStyle}>
          Accent preview
        </span>
      </div>
      <Field label="Text color">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Auto", value: "AUTO" },
            { label: "Dark", value: "DARK" },
            { label: "Light", value: "LIGHT" }
          ].map((tone) => (
            <button
              key={tone.value}
              type="button"
              onClick={() => update("textTone", tone.value)}
              style={form.textTone === tone.value ? theme.selectedControlStyle : undefined}
              className={`rounded-[0.75rem] border px-3 py-2 text-sm font-semibold ${
                form.textTone === tone.value ? "" : "border-[#eadbd7]"
              } ${tone.value === "LIGHT" ? "bg-[#241c1a] text-white" : ""}`}
            >
              {tone.label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Image shape">
        <div className="grid grid-cols-3 gap-2">
          {STOREFRONT_IMAGE_SHAPES.map((shape) => (
            <button
              key={shape.value}
              type="button"
              onClick={() => update("imageShape", shape.value)}
              style={form.imageShape === shape.value ? theme.selectedControlStyle : undefined}
              className={`rounded-[0.75rem] border px-3 py-2 text-sm font-semibold ${
                form.imageShape === shape.value ? "" : "border-[#eadbd7]"
              }`}
            >
              {shape.label}
            </button>
          ))}
        </div>
      </Field>
      <div className="rounded-[1rem] border border-[#eadbd7] bg-[#fbf7f5] p-3 text-xs leading-5 text-muted-foreground">
        <Wand2 className="mb-2 h-4 w-4 text-primary" />
        ShopFia locks spacing, navigation, trust actions, and responsive structure while letting you tune content, media, section order, and polished theme choices.
      </div>
    </PanelStack>
  );
}

function StorefrontPreview({
  activeSection,
  business,
  form,
  previewMode,
  setActiveSection,
  visibleSections
}: {
  activeSection: string;
  business: CustomizerBusiness;
  form: FormState;
  previewMode: "desktop" | "mobile";
  setActiveSection: (section: string) => void;
  visibleSections: string[];
}) {
  const palette = getPreviewPalette(form.palette);
  const theme = getPreviewTheme(form);
  const activeServices = form.services.filter((service) => service.active);
  const featuredServices = activeServices.filter((service) => service.featured).slice(0, 3);
  const isMobile = previewMode === "mobile";
  return (
    <div className={`overflow-hidden rounded-[1rem] shadow-soft ${isMobile ? "text-[12px]" : ""} ${theme.shellClass}`} style={theme.bodyStyle}>
      <button type="button" onClick={() => setActiveSection("hero")} className={previewButtonClass(activeSection === "hero", "block w-full text-left")}>
        <div className={`border-b px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] ${theme.headerClass}`} style={theme.platformBarStyle}>ShopFia Storefront</div>
        <div className={`flex gap-3 p-4 ${theme.profileClass}`}>
          {form.logoUrl ? <img src={form.logoUrl} alt="" className={`h-14 w-14 object-cover ${theme.logoRadius}`} /> : <div className={`grid h-14 w-14 place-items-center font-semibold ${theme.logoRadius}`} style={theme.softSurfaceStyle}>{form.name.slice(0, 1)}</div>}
          <div>
            <div className="text-lg font-semibold" style={theme.headingStyle}>{form.name}</div>
            <div className={`text-sm ${theme.mutedClass}`}>@{business.slug} · {form.city}{form.state ? `, ${form.state}` : ""}</div>
            <p className={`mt-1 line-clamp-2 text-sm ${theme.copyClass}`}>{form.tagline}</p>
            <span className="mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold" style={theme.badgeStyle}>Follow</span>
          </div>
        </div>
        <div className={`flex gap-1 overflow-x-auto border-t px-3 py-2 text-sm ${theme.navClass}`}>
          {["Home", "Services", "Portfolio", "About", "Reviews", "FAQ"].map((item) => <span key={item} className="rounded-full px-3 py-1" style={item === "Home" ? theme.activeNavItemStyle : undefined}>{item}</span>)}
        </div>
        <section className={`relative m-4 grid min-h-[390px] overflow-hidden bg-[#211815] text-white ${theme.heroRadius} ${isMobile ? "" : "md:grid-cols-[1fr_0.55fr]"}`}>
          {form.coverPhoto ? <img src={form.coverPhoto} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" /> : null}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(24,17,15,0.9),rgba(24,17,15,0.2))]" />
          <div className="relative p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/70">Featured storefront</p>
            <h2 className="mt-4 text-5xl font-semibold leading-[0.9] tracking-normal" style={theme.headingStyle}>{form.aboutHeading || form.name}</h2>
            <p className="mt-4 line-clamp-3 text-sm leading-6 text-white/80">{form.tagline || form.bio}</p>
            <span className="mt-5 inline-flex rounded-full px-4 py-2 text-xs font-semibold" style={theme.heroCtaStyle}>Browse services</span>
          </div>
        </section>
      </button>
      <div className={`bg-gradient-to-br ${palette.className} p-5`}>
        {visibleSections.filter((section) => section !== "hero").map((section) => {
          if (section === "featured-services") return <PreviewSection key={section} active={activeSection === section} theme={theme} title="Featured services" onClick={() => setActiveSection(section)}><ServiceGrid services={featuredServices} theme={theme} /></PreviewSection>;
          if (section === "all-services") return <PreviewSection key={section} active={activeSection === section} theme={theme} title="All services" onClick={() => setActiveSection(section)}><ServiceGrid services={activeServices} theme={theme} /></PreviewSection>;
          if (section === "portfolio") return <PreviewSection key={section} active={activeSection === section} theme={theme} title="Portfolio" onClick={() => setActiveSection(section)}><div className="grid grid-cols-3 gap-2">{form.photoUrls.filter(Boolean).slice(0, 6).map((photo, index) => <img key={`${photo}-${index}`} src={photo} alt="" className={`aspect-square object-cover ${theme.imageRadius}`} />)}</div></PreviewSection>;
          if (section === "about") return <PreviewSection key={section} active={activeSection === section} theme={theme} title={form.aboutHeading || "About Us"} onClick={() => setActiveSection(section)}><div className="grid gap-3 md:grid-cols-2"><p>{form.bio}</p>{form.aboutImage ? <img src={form.aboutImage} alt="" className={`h-44 w-full object-cover ${theme.imageRadius}`} /> : null}</div></PreviewSection>;
          if (section === "how-it-works") return <PreviewSection key={section} active={activeSection === section} theme={theme} title="How it works" onClick={() => setActiveSection(section)}><p>{form.booking.process}</p><p className="mt-2">{form.serviceAreaNotes}</p></PreviewSection>;
          if (section === "reviews") return <PreviewSection key={section} active={activeSection === section} theme={theme} title="Verified reviews" onClick={() => setActiveSection(section)}><p>Reviews are synced from completed ShopFia bookings.</p></PreviewSection>;
          if (section === "faq") return <PreviewSection key={section} active={activeSection === section} theme={theme} title="FAQ" onClick={() => setActiveSection(section)}>{form.faqs.slice(0, 3).map((faq) => <div key={faq.id} className="mt-2"><div className="font-semibold">{faq.question}</div><p>{faq.answer}</p></div>)}</PreviewSection>;
          if (section === "final-quote") return <PreviewSection key={section} active={activeSection === section} theme={theme} title="Ready for a quote?" onClick={() => setActiveSection(section)}><Button type="button"><Send className="h-4 w-4" />Get a quote</Button></PreviewSection>;
          return null;
        })}
      </div>
    </div>
  );
}

function ServiceGrid({ services, theme }: { services: EditorService[]; theme: PreviewTheme }) {
  if (!services.length) return <p className={`text-sm ${theme.mutedClass}`}>No services selected.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {services.map((service) => (
        <div key={service.id} className={`overflow-hidden shadow-sm ${theme.cardClass} ${theme.imageRadius}`}>
          {service.photos[0] ? <img src={service.photos[0]} alt="" className="aspect-[4/3] w-full object-cover" /> : <div className="grid aspect-[4/3] place-items-center bg-[#f8ece9]"><ImagePlus className="h-6 w-6 text-primary" /></div>}
          <div className="p-3">
            <div className="line-clamp-1 font-semibold" style={theme.headingStyle}>{service.title}</div>
            <p className={`mt-1 line-clamp-2 text-sm ${theme.mutedClass}`}>{service.description}</p>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span style={theme.accentTextStyle}>{service.messageForPricing || service.basePriceCents == null ? "Custom quote" : `From ${formatCurrency(service.basePriceCents)}`}</span>
              <span className={`inline-flex items-center gap-1 ${theme.mutedClass}`}><Star className="h-3.5 w-3.5 fill-current text-amber-500" />Verified</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PreviewSection({ active, children, onClick, theme, title }: { active: boolean; children: ReactNode; onClick: () => void; theme: PreviewTheme; title: string }) {
  return (
    <button type="button" onClick={onClick} className={previewButtonClass(active, `mb-5 block w-full p-5 text-left transition ${theme.cardClass} ${theme.sectionRadius}`)} style={active ? theme.activeSectionStyle : theme.previewCardStyle}>
      <h3 className="text-2xl font-semibold tracking-tight" style={theme.headingStyle}>{title}</h3>
      <div className={`mt-3 text-sm leading-6 ${theme.copyClass}`}>{children}</div>
    </button>
  );
}

function previewButtonClass(active: boolean, base: string) {
  return `${base} ${active ? "ring-2 ring-offset-2" : "ring-1 ring-transparent"}`;
}

type PreviewTheme = ReturnType<typeof getPreviewTheme>;

function getPreviewTheme(form: FormState) {
  const normalizedPalette = normalizeStorefrontPalette(form.palette);
  const isDark = form.textTone === "LIGHT" || (form.textTone === "AUTO" && normalizedPalette === "BLACK_AND_WHITE");
  const palette = getPreviewPalette(normalizedPalette);
  const accent = palette.accent;
  const ctaBackground = "gradient" in palette ? palette.gradient : accent;
  const ctaText = "ctaText" in palette ? palette.ctaText : "#ffffff";
  const imageRadius = form.imageShape === "SQUARE" ? "rounded-none" : form.imageShape === "SOFT" ? "rounded-[1.75rem]" : "rounded-[0.9rem]";
  const sectionRadius = form.imageShape === "SQUARE" ? "rounded-none" : form.imageShape === "SOFT" ? "rounded-[1.5rem]" : "rounded-[1rem]";
  const logoRadius = form.imageShape === "SQUARE" ? "rounded-[0.35rem]" : form.imageShape === "SOFT" ? "rounded-[1rem]" : "rounded-full";
  const fontFamilies = getStorefrontFontFamilies(form.fontStyle);

  return {
    accent,
    accentBlockStyle: { background: "gradient" in palette ? palette.gradient : `linear-gradient(135deg, ${palette.swatches.join(", ")})` } as CSSProperties,
    accentTextStyle: { color: accent } as CSSProperties,
    activeNavItemStyle: { backgroundColor: `${accent}24`, color: isDark ? "#ffffff" : "#2f2626" } as CSSProperties,
    activeSectionStyle: { borderColor: `${accent}88`, boxShadow: `0 0 0 2px ${accent}` } as CSSProperties,
    badgeStyle: { background: ctaBackground, borderColor: accent, color: ctaText } as CSSProperties,
    bodyStyle: { fontFamily: fontFamilies.body } as CSSProperties,
    cardClass: isDark ? "border border-white/15 bg-[#201b1e]/88 text-white" : "border border-white/80 bg-white/88 text-[#2f2626]",
    copyClass: isDark ? "text-white/86" : "text-[#5f5550]",
    headerClass: isDark ? "border-white/15 bg-[#171315] text-white/70" : "border-[#eadbd7] bg-[#fffaf8] text-[#7a625b]",
    headingStyle: { fontFamily: fontFamilies.heading } as CSSProperties,
    heroCtaStyle: { background: ctaBackground, color: ctaText } as CSSProperties,
    heroRadius: imageRadius,
    imageRadius,
    logoRadius,
    mutedClass: isDark ? "text-white/62" : "text-muted-foreground",
    navClass: isDark ? "border-white/15 bg-[#201b1e] text-white/72" : "border-[#eadbd7] bg-white text-muted-foreground",
    platformBarStyle: { backgroundColor: `${accent}14`, borderColor: `${accent}33` } as CSSProperties,
    profileClass: isDark ? "bg-[#201b1e] text-white" : "bg-white text-[#2f2626]",
    previewCardStyle: { borderColor: `${accent}44` } as CSSProperties,
    sectionRadius,
    selectedControlStyle: { borderColor: accent, backgroundColor: `${accent}14` } as CSSProperties,
    shellClass: isDark ? "bg-[#151113] text-white" : "bg-white text-[#2f2626]",
    softSurfaceStyle: { backgroundColor: `${accent}18`, color: accent } as CSSProperties
  };
}

function getPreviewPalette(value: string) {
  return STOREFRONT_PALETTES.find((item) => item.value === normalizeStorefrontPalette(value)) ?? STOREFRONT_PALETTES[0];
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="grid gap-2 text-sm font-semibold text-[#4b403c]">{label}{children}</label>;
}

function PanelStack({ children }: { children: ReactNode }) {
  return <div className="grid gap-4">{children}</div>;
}

function readDraft(value: unknown): Partial<FormState> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Partial<FormState> : null;
}

function readFaqs(value: unknown): FaqItem[] {
  return Array.isArray(value) && value.length
    ? value.filter(isFaqItem)
    : [
        { id: "quote", question: "How do I request a quote?", answer: "Share your date, location, guest count, and inspiration through ShopFia." },
        { id: "custom", question: "Can this be customized?", answer: "Yes. The vendor will confirm options, pricing, and timing in messages." }
      ];
}

function readPolicies(value: unknown): PolicyItem[] {
  return Array.isArray(value) && value.length
    ? value.filter(isPolicyItem)
    : [{ id: "changes", title: "Changes", body: "Final scope, timing, and changes are confirmed before booking." }];
}

function readBooking(value: unknown): BookingInfo {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Partial<BookingInfo>;
    return {
      deposit: record.deposit ?? "Deposit details are confirmed in the quote.",
      leadTime: record.leadTime ?? "Availability is confirmed in messages.",
      process: record.process ?? "Request a quote, confirm details in messages, then book securely through ShopFia when supported."
    };
  }
  return {
    deposit: "Deposit details are confirmed in the quote.",
    leadTime: "Availability is confirmed in messages.",
    process: "Request a quote, confirm details in messages, then book securely through ShopFia when supported."
  };
}

function isFaqItem(item: unknown): item is FaqItem {
  return item != null && typeof item === "object" && "question" in item && "answer" in item;
}

function isPolicyItem(item: unknown): item is PolicyItem {
  return item != null && typeof item === "object" && "title" in item && "body" in item;
}

function orderServices(services: EditorService[], order: string[]) {
  return [...services].sort((a, b) => {
    const aIndex = order.indexOf(a.id);
    const bIndex = order.indexOf(b.id);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });
}

function mergeDraftServices(draftServices: EditorService[], liveServices: EditorService[]) {
  const liveById = new Map(liveServices.map((service) => [service.id, service]));
  return draftServices.map((service) => ({ ...liveById.get(service.id), ...service }));
}

function dollarsToCents(value: string) {
  const normalized = value.replace(/[$,]/g, "").trim();
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}
