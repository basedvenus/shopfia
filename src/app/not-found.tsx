import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl py-14">
      <Card className="overflow-hidden border-white/70 bg-white/90 shadow-soft">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/70">
            ShopFia
          </p>
          <CardTitle className="text-3xl tracking-tight">This page is not available</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="max-w-lg text-sm leading-6 text-muted-foreground">
            This party, vendor, or service may have moved, been removed, or may still be finishing its setup.
            You can keep exploring from here.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/explore">
              <Button>Browse vendors</Button>
            </Link>
            <Link href="/parties">
              <Button variant="secondary">View parties</Button>
            </Link>
            <Link href="/categories">
              <Button variant="secondary">View categories</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
