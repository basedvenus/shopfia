import Link from "next/link";
import { auth } from "@/auth";
import { toggleFavoriteAction } from "@/app/actions/favorites";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return <p className="text-sm text-muted-foreground">Sign in to save favorite vendors.</p>;
  }

  const favorites = await db.favorite.findMany({
    where: { buyerId: session.user.id },
    include: { vendor: true },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Favorites</h1>
      {favorites.length === 0 ? (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">No favorites yet.</CardContent></Card>
      ) : (
        favorites.map((fav) => (
          <Card key={fav.id}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <div className="font-medium">{fav.vendor.name}</div>
                <div className="text-sm text-muted-foreground">{fav.vendor.city}</div>
              </div>
              <div className="flex gap-2">
                <Link href={`/vendor/profile/${fav.vendor.slug}`}><Button variant="secondary" size="sm">View</Button></Link>
                <form action={async () => {
                  "use server";
                  await toggleFavoriteAction(fav.vendorId);
                }}>
                  <Button size="sm" variant="ghost">Remove</Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
