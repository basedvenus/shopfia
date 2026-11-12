import {redirect} from "next/navigation";
import {auth} from "@/auth";
import {db} from "@/lib/db";
import {businessManagerWhere} from "@/lib/businesses";
import {vendorDashboardSelect} from "@/lib/vendor-dashboard-select";
import {getVendorDashboardStats} from "@/lib/services/vendor-dashboard-stats";
import {BusinessDashboardView} from "@/components/vendor/business-dashboard-view";
export const dynamic="force-dynamic";
export default async function BusinessDashboardPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams?:Promise<{reviewRequest?:string;welcome?:string}>}) {
 const {slug}=await params;
 const query=await searchParams;
 const session=await auth();
 if(!session?.user?.id)redirect("/account?next=login");
 const business=await db.vendorProfile.findFirst({where:{slug,...businessManagerWhere(session.user.id,session.user.role)},select:vendorDashboardSelect});
 if(!business)redirect("/vendor/dashboard");
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const [stats, upcomingOrders] = await Promise.all([
    getVendorDashboardStats(business.id),
    db.order.findMany({
      where: {
        vendorProfileId: business.id,
        status: { in: ["paid", "in_progress"] },
        quote: { quoteRequest: { eventDate: { gte: today } } }
      },
      orderBy: [{ quote: { quoteRequest: { eventDate: "asc" } } }, { id: "asc" }],
      take: 5,
      select: {
        id: true,
        offering: { select: { title: true } },
        quote: { select: { quoteRequest: { select: { eventDate: true, eventLocation: true } } } }
      }
    })
  ]);
 return <BusinessDashboardView business={business} stats={stats} upcomingParties={upcomingOrders.flatMap(({id, offering, quote}) => {
   const event = quote?.quoteRequest;
   return event?.eventDate ? [{id, title: offering?.title ?? "Custom booking", date: event.eventDate, location: event.eventLocation}] : [];
 })} welcome={query?.welcome==="1"} reviewRequest={query?.reviewRequest} />;
}
