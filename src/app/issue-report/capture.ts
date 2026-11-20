// Browser-only helpers for the issue report sheet.
import { domToBlob } from "modern-screenshot";

/**
 * Elements that render Learner data carry this attribute (see CLAUDE.md, "Private elements").
 * The page capture masks them; it is posted to a public repository.
 */
export const PRIVATE_ATTRIBUTE = "data-private";

/** Marks the report control and sheet so they stay out of the capture. */
export const REPORT_UI_ATTRIBUTE = "data-issue-report-ui";

/** The colour private elements are painted over with in the capture. */
export const MASK_COLOR = "#a1a1aa";

/**
 * A PNG of the current page with every private element painted over. The masking happens on the
 * capture's copy of the page, so nothing visibly changes for the owner.
 */
export async function capturePage(): Promise<Blob> {
  const body = document.body;
  const blob = await domToBlob(body, {
    type: "image/png",
    scale: Math.min(window.devicePixelRatio || 1, 2),
    backgroundColor: getComputedStyle(body).backgroundColor,
    width: document.documentElement.clientWidth,
    // The copy of <body> otherwise picks up the browser's default 8px margin, shifting everything.
    style: { margin: getComputedStyle(body).margin },
    filter: (node) =>
      !(node instanceof Element) || (!node.hasAttribute(REPORT_UI_ATTRIBUTE) && node.localName !== "nextjs-portal"),
    onCloneNode: (clone) => {
      if (clone instanceof Element) maskPrivateElements(clone);
    },
  });
  if (!blob) throw new Error("The page couldn't be captured");
  return blob;
}

function maskPrivateElements(root: Element): void {
  const privateElements = [
    ...(root.matches(`[${PRIVATE_ATTRIBUTE}]`) ? [root] : []),
    ...root.querySelectorAll(`[${PRIVATE_ATTRIBUTE}]`),
  ];
  for (const element of privateElements) {
    paint(element, {
      "background-color": MASK_COLOR,
      "background-image": "none",
      "border-radius": "4px",
    });
    for (const inner of [element, ...element.querySelectorAll("*")]) {
      paint(inner, {
        color: "transparent",
        "-webkit-text-fill-color": "transparent",
        "text-shadow": "none",
        "text-decoration-color": "transparent",
        "caret-color": "transparent",
        "border-color": "transparent",
        "box-shadow": "none",
        ...(inner === element ? {} : { "background-color": "transparent", "background-image": "none" }),
      });
      // Images, videos, canvases and SVGs can hold Learner data too.
      if (inner !== element && /^(img|picture|video|canvas|svg|iframe)$/.test(inner.localName)) {
        paint(inner, { visibility: "hidden" });
      }
    }
  }
}

function paint(element: Element, styles: Record<string, string>): void {
  const { style } = element as HTMLElement;
  if (!style) return;
  for (const [property, value] of Object.entries(styles)) style.setProperty(property, value, "important");
}

const MAX_ATTACHMENT_SIDE = 2000;

/**
 * Re-encodes an attached image: scales it down to keep the upload small and drops its metadata
 * (phone photos carry GPS location). PNGs stay PNG; everything else becomes JPEG.
 */
export async function prepareAttachment(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_ATTACHMENT_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
  if (!blob) throw new Error(`${file.name} couldn't be read as an image`);
  const name = file.name.replace(/\.[^.]*$/, "") + (type === "image/png" ? ".png" : ".jpg");
  return new File([blob], name, { type });
}

/** The page the report is about, as an agent needs it to reproduce the problem. */
export function currentPage(params: Record<string, string | string[] | undefined>) {
  const { pathname, search } = window.location;
  return {
    url: pathname + search,
    route: routePattern(pathname, params),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    userAgent: navigator.userAgent,
  };
}

/** `/topics/0b9f…` with params `{ id: "0b9f…" }` → `/topics/[id]`. */
function routePattern(pathname: string, params: Record<string, string | string[] | undefined>): string {
  const names = new Map<string, string>();
  for (const [name, value] of Object.entries(params)) {
    if (typeof value === "string") names.set(value, `[${name}]`);
  }
  return pathname
    .split("/")
    .map((segment) => names.get(safeDecode(segment)) ?? segment)
    .join("/");
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
