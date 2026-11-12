import { CalendarDays } from "lucide-react";

type UpcomingParty = {
  id: string;
  title: string;
  date: Date;
  location: string | null;
};

const eventDateFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "full",
  timeZone: "UTC"
});

export function UpcomingParties({ parties }: { parties: UpcomingParty[] }) {
  return (
    <section id="upcoming-parties" aria-labelledby="upcoming-parties-title" className="scroll-mt-24 rounded-[1.25rem] border border-white/80 bg-white p-5 shadow-[0_18px_50px_rgba(72,44,43,0.08)] sm:p-6">
      <h2 id="upcoming-parties-title" className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <CalendarDays aria-hidden="true" className="size-5 shrink-0 text-primary" />
        Upcoming parties
      </h2>
      {parties.length ? (
        <ul className="mt-3 divide-y divide-border">
          {parties.map((party) => (
            <li key={party.id} className="py-3">
              <p className="font-semibold">{party.title}</p>
              <p className="text-sm text-muted-foreground">
                <time dateTime={party.date.toISOString().slice(0, 10)}>{eventDateFormat.format(party.date)}</time>
                {party.location && ` · ${party.location}`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No upcoming parties yet.</p>
      )}
    </section>
  );
}
