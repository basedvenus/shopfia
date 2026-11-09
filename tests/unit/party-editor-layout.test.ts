import { describe, it, expect, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/app/actions/auth", () => ({ createPartyEventAction: vi.fn(), updatePartyEventAction: vi.fn(), followPartyVendorAction: vi.fn() }));
vi.mock("@radix-ui/react-dialog", () => {
  const passthrough = ({children}: {children: ReactNode}) => children;
  return { Root: ({open, children}: {open: boolean; children: ReactNode}) => open ? children : null, Portal: passthrough, Overlay: () => null, Content: passthrough, Title: passthrough, Description: passthrough, Close: passthrough };
});
vi.mock("@/app/actions/vendor", () => ({ createUnclaimedVendorAction: vi.fn() }));
vi.mock("@/components/location/place-autocomplete-input", () => ({ PlaceAutocompleteInput: () => null }));
import { PartyPhotoActions } from "@/components/parties/party-photo-actions";
import { PartyPhotoEditor } from "@/components/parties/party-photo-editor";
import { updatePartyEventAction } from "@/app/actions/auth";
import { PartySelect } from "@/components/parties/party-select";
import { PartyEventForm } from "@/components/parties/party-event-form";
const photo = { id: "photo", url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800'%3E%3Crect width='800' height='800' fill='%23000000'/%3E%3Crect y='100' width='800' height='600' fill='%23e3a7a7'/%3E%3Ctext x='230' y='300' font-size='60' fill='%23ffffff'%3EParty photo%3C/text%3E%3C/svg%3E", crop: { x: 50, y: 50, zoom: 1 }, vendorIds: [], vendorContributions: {} };
const party = { id: "party", slug: "test-party", title: "Test party", theme: null, tags: [], description: null, location: "Private residence", countyFips: "06095", photos: [photo], appleMusicUrl: "https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb", tiktokUrls: ["https://www.tiktok.com/@scout2015/video/6718335390845095173", "https://www.tiktok.com/@scout2015/video/6718335390845095174"] };
describe("party editor organization", () => {
  it("saves a title edit with existing unrated legacy vendor tags without opening the rating panel", async () => {
    vi.mocked(updatePartyEventAction).mockResolvedValueOnce({ ok: false, error: "Test save captured" });
    let view!: ReactTestRenderer;
    act(() => { view = create(createElement(PartyEventForm, { currentUserId: "owner", initialParty: { ...party, photos: [{ ...photo, vendorIds: ["existing-vendor"] }] }, composer: true, users: [], vendors: [] })); });
    const data = new FormData(); data.set("title", "Updated Baby Shower");
    await act(async () => view.root.findByType("form").props.action(data));
    expect(updatePartyEventAction).toHaveBeenCalledWith(data);
    expect(data.get("title")).toBe("Updated Baby Shower");
    expect(view.root.findAllByType(PartyPhotoActions)).toHaveLength(0);
    act(() => view.unmount());
  });

  it("walks from photos to editing and details without losing field edits", () => {
    let view!: ReactTestRenderer;
    act(() => { view = create(createElement(PartyEventForm, { currentUserId: "owner", initialParty: party, users: [], vendors: [] })); });
    const button = (text: string) => view.root.findAllByType("button").find((node) => node.children.includes(text))!;
    const titleInput = view.root.findByProps({ "aria-label": "Party title" });
    expect(view.root.findAllByType("button").some(node => node.props["aria-label"] === "Crop and edit photo")).toBe(true);
    expect(view.root.findByProps({ "aria-label": "Party title" }).props.defaultValue).toBe("Test party");
    act(() => button("Next").props.onClick({preventDefault: vi.fn()}));
    expect(view.root.findByProps({"data-party-step": "details"}).props.hidden).toBe(false);
    act(() => view.root.findAllByType("button").find((node) => node.props["aria-label"] === "Back")!.props.onClick());
    expect(view.root.findAllByType("button").some(node => node.props["aria-label"] === "Crop and edit photo")).toBe(true);
    expect(view.root.findByProps({ "aria-label": "Party title" }).props.defaultValue).toBe("Test party");
    expect(view.root.findByProps({ "aria-label": "Party title" })).toBe(titleInput);
    act(() => view.unmount());
  });

  it("edits and deletes the selected photo, retaining the others", () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetcher);
    let view!: ReactTestRenderer;
    act(() => { view = create(createElement(PartyEventForm, { currentUserId: "owner", initialParty: { ...party, photos: [photo, { ...photo, id: "second" }] }, users: [], vendors: [] })); });
    act(() => view.root.findByProps({ "aria-label": "Select photo 2" }).props.onClick());
    act(() => view.root.findByProps({ "aria-label": "Crop and edit photo" }).props.onClick());
    expect(view.root.findByType(PartyPhotoEditor).props.imageUrl).toBe(photo.url);
    const crop = { x: 40, y: 60, zoom: 1.5 };
    act(() => view.root.findByType(PartyPhotoEditor).props.onSave(crop));
    act(() => view.root.findByProps({ "aria-label": "Crop and edit photo" }).props.onClick());
    expect(view.root.findByType(PartyPhotoEditor).props.crop).toEqual(crop);
    act(() => view.root.findByType(PartyPhotoEditor).props.onCancel());
    act(() => view.root.findAllByType("button").find((node) => node.props["aria-label"] === "Delete photo")!.props.onClick());
    expect(fetcher).toHaveBeenCalledWith("/api/party-photos/second", { method: "DELETE" });
    expect(view.root.findAllByProps({ "aria-label": "Select photo 2" })).toHaveLength(0);
    expect(view.root.findByProps({ "aria-label": "Select photo 1" }).props["aria-pressed"]).toBe(true);
    act(() => view.unmount());
    vi.unstubAllGlobals();
  });

  it("opens vendor tagging for the selected photo only", () => {
    let view!: ReactTestRenderer;
    act(() => { view = create(createElement(PartyEventForm, { currentUserId: "owner", initialParty: { ...party, photos: [photo, { ...photo, id: "second" }] }, users: [], vendors: [] })); });
    for (let index = 0; index < 3; index++) act(() => view.root.findAllByType("button").find((node) => node.children.includes("Next"))!.props.onClick({preventDefault: vi.fn()}));
    act(() => view.root.findByProps({ "aria-label": "Select photo 2" }).props.onClick());
    act(() => view.root.findByProps({ "aria-label": "Tag vendors in selected photo" }).props.onClick());
    expect(view.root.findAllByType("button").some(node => node.props["aria-label"] === "Close vendor tagging")).toBe(true);
    expect(view.root.findAll((node) => typeof node.type === "function" && node.props.photo?.id === "second")).toHaveLength(1);
    act(() => view.root.findByProps({ "aria-label": "Select photo 1" }).props.onClick());
    expect(view.root.findAllByType("button").some(node => node.props["aria-label"] === "Close vendor tagging")).toBe(false);
    act(() => view.unmount());
  });

  it("keeps party details before a separate inspiration step with Save on the right", () => {
    let view!: ReactTestRenderer;
    act(() => { view = create(createElement(PartyEventForm, { currentUserId: "owner", initialParty: party, users: [], vendors: [] }), {createNodeMock: element => element.type === "form" ? { reportValidity: () => true, querySelector: () => null } : null}); });
    const next = () => view.root.findAllByType("button").find(node => node.children.includes("Next"))!;
    act(() => next().props.onClick({preventDefault: vi.fn()}));
    expect(view.root.findByProps({"data-party-step": "details"}).props.hidden).toBe(false);
    expect(view.root.findByProps({"data-party-step": "inspiration"}).props.hidden).toBe(true);
    const preventDefault = vi.fn();
    act(() => next().props.onClick({preventDefault}));
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(view.root.findByProps({"data-party-step": "details"}).props.hidden).toBe(true);
    expect(view.root.findByProps({"data-party-step": "inspiration"}).props.hidden).toBe(false);
    act(() => next().props.onClick({preventDefault: vi.fn()}));
    expect(view.root.findByProps({"data-party-step": "vendors"}).props.hidden).toBe(false);
    expect(view.root.findAllByType("button").find(node => node.children.includes("Publish"))!.props.type).toBe("submit");
    act(() => view.unmount());
  });

  it("groups a compact age dropdown and gender choices inside the category card", () => {
    let view!: ReactTestRenderer;
    act(() => { view = create(createElement(PartyEventForm, { currentUserId: "owner", initialParty: {...party, tags: ["age3", "audiencegirl"], title: "Third birthday"}, users: [], vendors: [] })); });
    const card = view.root.findByProps({"aria-label": "Party category and celebration"});
    const age = card.findAllByType(PartySelect).find(node => node.props.name === "birthdayAge")!;
    expect(age.props.name).toBe("birthdayAge");
    expect(age.props.defaultValue).toBe("3");
    expect(age.props.options).toHaveLength(120);
    const gender = card.findAllByType("input").filter(node => node.props.name === "partyAudience");
    expect(gender.map(node => node.props.value)).toEqual(["Boy", "Girl", "Not specified"]);
    expect(gender.find(node => node.props.value === "Girl")?.props.defaultChecked).toBe(true);
    act(() => view.unmount());
  });

  it("reveals link fields after selecting a service and removes the preview category", () => {
    let view!: ReactTestRenderer;
    act(() => { view = create(createElement(PartyEventForm, {currentUserId: "owner", users: [], vendors: []})); });
    const provider = (label: string) => view.root.findAllByType(PartySelect).find(node => node.props.label === label)!;
    const field = (name: string) => view.root.findAllByType("input").find(node => node.props.name === name)!;
    const panel = () => { let node = field("pinterestUrl").parent; while (node && !("hidden" in node.props)) node = node.parent; return node; };
    expect(panel()?.props.hidden).toBe(true);
    act(() => provider("Visual platform").props.onChange("pinterest"));
    expect(panel()?.props.hidden).toBe(false);
    act(() => provider("Music service").props.onChange("spotify"));
    expect(provider("Music service").props.value).toBe("spotify");
    act(() => provider("Invitation service").props.onChange("luma"));
    act(() => field("partyfulUrl").props.onChange({target: {value: "https://lu.ma/test-party"}}));
    expect(field("partyfulUrl").props.value).toBe("https://lu.ma/test-party");
    expect(view.root.findAllByType("summary").some(node => node.children.includes("Preview your inspiration"))).toBe(false);
    act(() => view.unmount());
  });

  it("makes a dragged photo the cover without losing photo edits or submitting", () => {
    let view!: ReactTestRenderer;
    act(() => { view = create(createElement(PartyEventForm, { currentUserId: "owner", initialParty: {...party, photos: [photo, {...photo, id: "second", crop: {x: 30, y: 60, zoom: 1.4}}]}, users: [], vendors: [] })); });
    const tile = (index: number) => view.root.findByProps({"aria-label": `Select photo ${index}`});
    const data = new Map<string, string>();
    const dataTransfer = {setData: (key: string, value: string) => data.set(key, value), getData: (key: string) => data.get(key), effectAllowed: "", dropEffect: ""};
    act(() => tile(2).props.onDragStart({dataTransfer}));
    act(() => tile(1).props.onDrop({dataTransfer, preventDefault: vi.fn(), stopPropagation: vi.fn()}));
    act(() => tile(1).props.onClick());
    act(() => view.root.findByProps({"aria-label": "Crop and edit photo"}).props.onClick());
    expect(view.root.findByType(PartyPhotoEditor).props.crop).toMatchObject({x: 30, y: 60, zoom: 1.4});
    expect(data.get("application/x-shopfia-photo")).toBe("second");
    expect(view.root.findAllByType("button").some(node => node.children.includes("Use as cover") || node.children.includes("Upload another image"))).toBe(false);
    act(() => view.unmount());
  });

  it("shows uploaded photos without opening the editor until Edit is selected", async () => {
    const fetcher = vi.fn().mockResolvedValue({ok: true, text: async () => JSON.stringify({photo: {id: "uploaded", url: "https://example.com/uploaded.jpg"}})});
    vi.stubGlobal("fetch", fetcher);
    let view!: ReactTestRenderer;
    act(() => { view = create(createElement(PartyEventForm, {currentUserId: "owner", users: [], vendors: []})); });
    const fileInput = view.root.findAllByType("input").find(node => node.props.type === "file")!;
    await act(async () => {
      fileInput.props.onChange({target: {files: [new File(["photo"], "party.jpg", {type: "image/jpeg"})]}});
    });
    expect(fetcher).toHaveBeenCalledWith("/api/uploads/party-photo", expect.objectContaining({method: "POST"}));
    expect(view.root.findByProps({"aria-label": "Select photo 1"}).props["aria-pressed"]).toBe(true);
    expect(view.root.findAllByType(PartyPhotoEditor)).toHaveLength(0);
    act(() => view.root.findByProps({"aria-label": "Selected photo preview"}).props.onClick());
    expect(view.root.findAllByType(PartyPhotoEditor)).toHaveLength(0);
    act(() => view.root.findByProps({"aria-label": "Crop and edit photo"}).props.onClick());
    expect(view.root.findByType(PartyPhotoEditor).props.imageUrl).toBe("https://example.com/uploaded.jpg");
    act(() => view.unmount());
    vi.unstubAllGlobals();
  });

  it("starts a new party with photos and keeps optional links collapsed", () => {
    const html = renderToStaticMarkup(createElement(PartyEventForm, { currentUserId: "owner", users: [], vendors: [] }));
    expect(html).toContain("Photos");
    expect(html).not.toContain("1. Choose photos");
    expect(html).toContain("Choose your party photos");
    expect(html).toContain('data-party-step="inspiration"');
    expect(html).not.toContain("Edit photo &amp; tags");
    expect(html).toContain('name="tiktokUrls"');
    expect(html).toContain("Spotify playlist");
    expect(html).toContain("Pinterest mood board");
  });
});
