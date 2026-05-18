import { auth, signOut } from "@/auth";
import { SiteNavClient } from "@/components/layout/site-nav-client";
import { db } from "@/lib/db";

export async function SiteNav() {
  const session = await auth();
  const unreadMessagesCount = session?.user?.id
    ? await db.message.count({
        where: {
          senderId: { not: session.user.id },
          readAt: null,
          conversation: {
            OR: [{ buyerId: session.user.id }, { vendorId: session.user.id }]
          }
        }
      })
    : 0;

  return (
    <SiteNavClient
      unreadMessagesCount={unreadMessagesCount}
      signOutAction={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    />
  );
}
