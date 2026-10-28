// Coordinated looks use the same theme values as the public storefront renderer.
// Recommendations never change a vendor's saved design automatically.
export const STOREFRONT_LOOKS = [
  { id: "botanical", name: "Botanical", note: "Fresh greens, warm whites, and a little vintage charm.", palette: "MATCHA_SOFT", fontStyle: "RETRO", layout: "EDITORIAL_SPLIT", imageShape: "ROUNDED", keywords: /matcha|tea|botanical|garden|floral|flower|natural|organic/i },
  { id: "romantic", name: "Soft romance", note: "Blush accents, graceful type, and softly rounded photos.", palette: "BLUSH", fontStyle: "ROMANTIC", layout: "EDITORIAL_SPLIT", imageShape: "ROUNDED", keywords: /wedding|bridal|romantic|cake|dessert|bakery|cookie/i },
  { id: "playful", name: "Playful studio", note: "Lilac details and expressive type that feels joyful.", palette: "LAVENDER", fontStyle: "PLAYFUL", layout: "PORTFOLIO_FIRST", imageShape: "ROUNDED", keywords: /balloon|kid|child|playful|birthday|entertainment/i },
  { id: "boutique", name: "Modern boutique", note: "Warm neutrals, elegant type, and space for your work.", palette: "ESPRESSO", fontStyle: "FASHION", layout: "PORTFOLIO_FIRST", imageShape: "ROUNDED", keywords: /./ }
] as const;

export function recommendStorefrontLook(business: string) {
  if (/\b(clean|minimal|elevated|sophisticated)\b/i.test(business)) return STOREFRONT_LOOKS[3];
  return STOREFRONT_LOOKS.find((look) => look.keywords.test(business)) ?? STOREFRONT_LOOKS[3];
}
