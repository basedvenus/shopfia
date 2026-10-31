import { servicePricingSchema, type ServicePricing } from "./service-pricing";

export type ServiceFormIssue = { label: string; message: string; group?: string };
export function serviceFormIssues(service: ServicePricing, categories: string[], confirmed: boolean, eventCount = 0): ServiceFormIssue[] {
  const issues: ServiceFormIssue[] = [];
  const parsed = servicePricingSchema.safeParse(service);
  if (!parsed.success) for (const issue of parsed.error.issues) {
    const path = issue.path;
    const field = String(path.at(-1) ?? "");
    let group: string | undefined;
    let prefix = "";
    let label = ({ name: "Service name", description: "Description", inclusions: "What’s included", rate: service.base.type === "hour" ? "Hourly rate" : service.base.type === "person" ? "Price per person" : service.base.type === "item" ? "Price per item" : "Price per booking", minimum: service.base.type === "hour" ? "Minimum hours" : service.base.type === "person" ? "Minimum people" : "Minimum quantity", maximum: "Maximum people (optional)", increment: service.base.type === "hour" ? "Booking increments" : "Order increments", label: "Item label", questions: "Information needed to quote" } as Record<string, string>)[field] ?? "Service pricing";
    if (path[0] === "extras" && typeof path[1] === "number") {
      group = `extras.${path[1]}`; prefix = `${service.extras[path[1]]?.name || `Add-on ${path[1] + 1}`}: `;
      label = ({ name: "Add-on name", description: "Add-on description", rate: "Add-on price", minimum: "Add-on minimum", maximum: "Add-on maximum (optional)", increment: "Add-on quantity increment" } as Record<string, string>)[field] ?? "Quantity limits";
    } else if (path[0] === "menus" && typeof path[1] === "number") {
      group = `menus.${path[1]}`; prefix = `${service.menus?.[path[1]]?.name || `Menu ${path[1] + 1}`}: `;
      label = field === "name" ? "Menu name" : field === "description" ? "Menu description (optional)" : "Menu choices";
    } else if (path[1] === "packages" && typeof path[2] === "number") {
      group = `packages.${path[2]}`; prefix = `Package ${path[2] + 1}: `;
      label = ({ name: "Package name", price: "Package price", inclusions: "Exact inclusions", coverage: "Quantity or coverage included" } as Record<string, string>)[field] ?? "Package name";
    } else if (path[1] === "questions") label = "Information needed to quote";
    const message = issue.code === "invalid_type" || (issue.code === "too_small" && (issue.type === "string" || issue.type === "array"))
      ? `Complete ${label.toLowerCase()}.`
      : `${label}: ${issue.message}`;
    issues.push({ label, group, message: prefix + message });
  }
  // Match the existing save action, so it cannot reject a seemingly complete form.
  if (service.name.trim().length > 0 && (service.name.trim().length < 2 || service.name.length > 120)) issues.push({ label: "Service name", message: "Use 2–120 characters for the service name." });
  if (service.description.trim().length > 0 && service.description.trim().length < 20) issues.push({ label: "Description", message: "Add a little more detail to the description (at least 20 characters)." });
  if (!categories.length || categories.length > 8) issues.push({ label: "Service categories", message: "Choose 1–8 service categories under Photos & categories." });
  if (eventCount > 12) issues.push({ label: "Event types", message: "Choose no more than 12 event types." });
  if (!confirmed) issues.push({ label: "Template review", message: "Confirm that you reviewed the template’s sample prices and inclusions." });
  return issues.filter((issue, index, all) => all.findIndex(other => other.message === issue.message && other.group === issue.group) === index);
}
