/** Find the editable surface actually painting the clicked background. */
export function backgroundSelection(element: HTMLElement): { element: HTMLElement; section: string } | null {
  const page = element.closest<HTMLElement>("[data-storefront-background]");
  if (!page) return null;
  for (let surface: HTMLElement | null = element; surface; surface = surface.parentElement) {
    let section: string | undefined;
    if (surface === page) section = "page-background";
    else if (surface.hasAttribute("data-service-card")) section = "services-card";
    else if (surface.hasAttribute("data-profile-frame")) section = "profile-frame";
    else if (surface.matches('.depth-hero, [data-testid^="preview-section-"]')) {
      section = surface.closest<HTMLElement>("[data-section-frame]")?.dataset.sectionFrame;
    }
    if (section) {
      const style = getComputedStyle(surface);
      const transparent = style.backgroundColor === "transparent" || /rgba\([^)]*,\s*0\s*\)/.test(style.backgroundColor);
      if (surface === page || !transparent || style.backgroundImage !== "none") return { element: surface, section };
    }
    if (surface === page) break;
  }
  return null;
}
