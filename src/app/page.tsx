import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CakeSlice, Camera, Flower2, GlassWater, Heart, MapPin, PartyPopper, Search, Sparkles, CalendarHeart } from "lucide-react";
import styles from "./home.module.css";

const description = "Find local vendors for your next celebration. Browse services, compare the details, and connect with vendors near you.";
export const metadata: Metadata = {
  title: { absolute: "ShopFia - Find Local Vendors for Your Party" },
  description,
  openGraph: { title: "ShopFia - Find Local Vendors for Your Party", description, url: "https://www.shopfia.app", siteName: "ShopFia", type: "website", images: [{ url: "/og-shopfia.svg", width: 1200, height: 630, alt: "ShopFia event inspiration preview" }] },
  twitter: { card: "summary_large_image", title: "ShopFia - Find Local Vendors for Your Party", description, images: ["/og-shopfia.svg"] }
};

// Decorative inspiration only. These existing assets do not represent vendor work or real event credits.
const inspirationTiles = [
  { title: "Positano Brunch", image: "/demo/fairfield-lemon-tablescape.png", alt: "Lemon and blush floral brunch table inspiration", href: "/events/citrus-garden-brunch" },
  { title: "Spring Cookies", image: "/demo/vacaville-cookie-tulips.png", alt: "Pastel flower-shaped cookie inspiration", href: "/events/tulip-cookie-shower" },
  { title: "Table Arrangements", image: "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=900&q=80", alt: "Fresh floral arrangement inspiration", href: "/explore?q=florals" },
  { title: "Tablescapes", image: "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1100&q=80", alt: "Decorated reception table inspiration", href: "/explore?q=rentals" }
];

const categories = [
  { name: "Cakes", icon: CakeSlice },
  { name: "Balloons", icon: PartyPopper },
  { name: "Florals", icon: Flower2 },
  { name: "Decor", icon: Sparkles },
  { name: "Cookies", icon: Heart },
  { name: "Rentals", icon: CalendarHeart },
  { name: "Photography", icon: Camera },
  { name: "Bartending", icon: GlassWater }
];

const steps = [
  { title: "Find your service", body: "Search by service and location to find vendors near you." },
  { title: "Compare the details", body: "Explore photos, services, and available pricing on vendor profiles." },
  { title: "Connect with your vendor", body: "Send an inquiry to discuss your date, availability, and next steps." }
];

export default function Page() {
  return (
    <div className={styles.home}>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><MapPin size={15} aria-hidden="true" /> Find vendors near you</p>
          <h1 id="home-title">Your one-stop shop for party planning.</h1>
          <p className={styles.intro}>Find the local vendors to bring your celebration to life.</p>
          <div className={styles.actions}>
            <Link href="/explore" className={styles.primary}>Find Local Vendors <ArrowRight size={17} aria-hidden="true" /></Link>
            <Link href="/parties" className={styles.secondary}>Explore Real Events <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </div>
          <p className={styles.heroNote}>Your vision. Your vendors. Your kind of party.</p>
        </div>
        <div className={styles.visual}>
          <div className={styles.collage}>
            {inspirationTiles.map((tile, index) => (
              <Link key={tile.title} href={tile.href} className={styles.tile} aria-label={`${tile.title} — inspiration example`}>
                <Image src={tile.image} alt={tile.alt} fill priority={index === 0} sizes={index === 0 ? "(min-width: 1024px) 31vw, 55vw" : "(min-width: 1024px) 18vw, 45vw"} className={styles.tileImage} />
                <div className={styles.tileShade} />
                <span className={styles.tileLabel}>{tile.title}</span>
                <ArrowUpRight className={styles.tileArrow} size={18} aria-hidden="true" />
              </Link>
            ))}
          </div>
          <p className={styles.imageNote}>Inspiration examples</p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="services-title">
        <div className={styles.sectionHeading}>
          <div><p className={styles.eyebrow}>Start with what you need</p><h2 id="services-title">Find your party people.</h2></div>
          <Link href="/categories" className={styles.textLink}>All categories <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <div className={styles.categories}>
          {categories.map(({ name, icon: Icon }) => (
            <Link key={name} href={`/explore?q=${encodeURIComponent(name.toLowerCase())}`} className={styles.category}>
              <Icon size={27} strokeWidth={1.35} aria-hidden="true" /><span>{name}</span><ArrowUpRight className={styles.categoryArrow} size={15} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.how}`} aria-labelledby="how-title">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>How ShopFia works</p><h2 id="how-title">A little less searching. A lot more celebrating.</h2></div></div>
        <ol className={styles.steps}>
          {steps.map((step, index) => <li key={step.title}><span className={styles.stepNumber}>0{index + 1}</span><h3>{step.title}</h3><p>{step.body}</p></li>)}
        </ol>
      </section>

      <section className={`${styles.section} ${styles.events}`} aria-labelledby="events-title">
        <div><p className={styles.eyebrow}>A little inspiration, too</p><h2 id="events-title">Discover through real events, then find your vendor.</h2><p className={styles.bodyCopy}>Explore shared celebrations and the vendors tagged in them.</p></div>
        <Link href="/parties" className={styles.secondary}>Explore Real Events <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </section>

      <section className={styles.finalCta} aria-labelledby="ready-title">
        <div><h2 id="ready-title">Let’s bring your party together.</h2><p>Start with the service you need.</p></div>
        <Link href="/explore" className={styles.primary}><Search size={17} aria-hidden="true" /> Find Local Vendors</Link>
      </section>
    </div>
  );
}
