import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function MyBusinessesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/account?next=login");
  }

  const businesses = await db.vendorProfile.findMany({
    where: session.user.role === "ADMIN" ? {} : { userId: session.user.id },
    select: {
      id: true,
      logoUrl: true,
      name: true,
      slug: true
    },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }]
  });

  return (
    <main className="mx-auto max-w-5xl space-y-8 pb-12">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Vendor Dashboard</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em]">My Businesses</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {businesses.map((business) => (
          <Link
            key={business.id}
            href={`/vendor/business/${business.slug}`}
            className="group grid aspect-square place-items-center rounded-[1.5rem] border border-white/80 bg-white p-5 text-center shadow-[0_18px_50px_rgba(72,44,43,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(72,44,43,0.12)]"
          >
            <div className="grid gap-4 place-items-center">
              <div className="relative grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-[#f8deda] text-2xl font-semibold text-primary shadow-[0_10px_28px_rgba(72,44,43,0.08)]">
                {business.logoUrl ? (
                  <img src={business.logoUrl} alt={`${business.name} logo`} className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  initials(business.name)
                )}
              </div>
              <div className="max-w-full truncate text-sm font-semibold text-foreground/80">{business.name}</div>
            </div>
          </Link>
        ))}

        <Link
          href="/onboarding?newBusiness=1#profile"
          className="grid aspect-square place-items-center rounded-[1.5rem] border border-dashed border-[#dfc8c3] bg-white/70 p-5 text-center shadow-[0_18px_50px_rgba(72,44,43,0.05)] transition hover:-translate-y-0.5 hover:bg-white"
        >
          <div className="grid gap-4 place-items-center">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-[#f8deda] text-primary">
              <Plus className="h-8 w-8" />
            </div>
            <div className="text-sm font-semibold text-foreground/80">Add a Business</div>
          </div>
        </Link>
      </div>
    </main>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
