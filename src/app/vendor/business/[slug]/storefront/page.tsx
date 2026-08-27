import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Eye, Wand2 } from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { CopyStorefrontLinkButton } from "@/components/vendor/copy-storefront-link-button";
import { storefrontPath, storefrontUrl } from "@/lib/businesses";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const tabs = ["Content", "Design", "Sections", "Preview"];

export default async function StorefrontCustomizerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/account?next=login");

  const business = await db.vendorProfile.findFirst({
    where: session.user.role === "ADMIN" ? { slug } : { slug, userId: session.user.id },
    select: {
      bio: true,
      city: true,
      coverPhoto: true,
      id: true,
      instagramUrl: true,
      logoUrl: true,
      name: true,
      photos: true,
      serviceAreaNotes: true,
      serviceRadiusMiles: true,
      slug: true,
      state: true,
      tiktokUrl: true,
      website: true,
      offerings: {
        where: { active: true },
        select: { id: true, photos: true, title: true },
        take: 4
      }
    }
  });

  if (!business) redirect("/vendor/dashboard");

  const publicUrl = storefrontUrl(business.slug);

  return (
    <div className="space-y-6 pb-10">
      <Link href={`/vendor/business/${business.slug}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to {business.name} dashboard
      </Link>

      <section className="rounded-[1.5rem] border border-white/80 bg-white p-5 shadow-[0_18px_50px_rgba(72,44,43,0.08)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Customize Storefront</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{business.name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Adjust the customer-facing storefront for this business. Content edits use the existing business profile fields until the advanced design-settings migration is approved.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyStorefrontLinkButton url={publicUrl} />
            <Button asChild variant="secondary">
              <Link href={storefrontPath(business.slug)}>
                <Eye className="h-4 w-4" />
                View Storefront
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[240px_1fr]">
        <nav className="rounded-[1.25rem] border border-white/80 bg-white p-3 shadow-[0_18px_50px_rgba(72,44,43,0.08)]">
          {tabs.map((tab) => (
            <a key={tab} href={`#${tab.toLowerCase()}`} className="flex rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-[#f8ece9] hover:text-foreground">
              {tab}
            </a>
          ))}
        </nav>
        <div className="space-y-5">
          <EditorPanel id="content" title="Content" body="Business name, About Our Business, logo, cover image, social links, service area, and contact preferences are edited through business details.">
            <Button asChild>
              <Link href={`/onboarding?business=${business.slug}#profile`}>Edit Content</Link>
            </Button>
          </EditorPanel>
          <EditorPanel id="design" title="Design" body="Controlled templates, font pairings, color themes, button styles, and image styles are ready in the codebase, but need the storefront customization database migration before they can be saved safely.">
            <div className="grid gap-3 md:grid-cols-3">
              {["Editorial", "Portfolio", "Services"].map((layout) => <Choice key={layout} label={layout} />)}
            </div>
          </EditorPanel>
          <EditorPanel id="sections" title="Sections" body="The approved storefront sections are Hero, About, Portfolio, Services, Featured Parties, Reviews, Service Area, Inquiry Form, and Social Links.">
            <p className="text-sm text-muted-foreground">Full-section show, hide, and reorder controls are migration-backed so each business can keep its own storefront arrangement.</p>
          </EditorPanel>
          <EditorPanel id="preview" title="Preview" body="Preview the storefront customers see and copy the link for Instagram or TikTok.">
            <div className="grid gap-3 md:grid-cols-2">
              <Button asChild variant="secondary"><Link href={storefrontPath(business.slug)}>Desktop Preview</Link></Button>
              <Button asChild variant="secondary"><Link href={storefrontPath(business.slug)}>Mobile Preview</Link></Button>
            </div>
          </EditorPanel>
        </div>
      </div>
    </div>
  );
}

function EditorPanel({ body, children, id, title }: { body: string; children: React.ReactNode; id: string; title: string }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-[1.25rem] border border-white/80 bg-white p-5 shadow-[0_18px_50px_rgba(72,44,43,0.08)] sm:p-6">
      <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        <Wand2 className="h-4 w-4" />
        {title}
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{body}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Choice({ label }: { label: string }) {
  return <div className="rounded-[1rem] border border-[#eadbd8] bg-[#fbf7f5] p-4 text-sm font-semibold">{label}</div>;
}
