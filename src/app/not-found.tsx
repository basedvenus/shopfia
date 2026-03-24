import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Page not found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            That listing or vendor page may have moved, been removed, or the link is outdated.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/explore">
              <Button>Browse vendors</Button>
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
