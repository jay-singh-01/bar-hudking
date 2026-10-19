import type { Place } from "./types";
import { formatPriceForTwo, TYPE_META } from "./discover";
import { openStatus } from "./hours";
import { sizedPhoto } from "./photo";
import { placeUrl, shareLink } from "./share";
import { toast } from "./toast";

// A shareable image card for a place (1080×1350, the Instagram portrait size).
// Google photo hosts send `Access-Control-Allow-Origin: *`, so the photo can
// be drawn to canvas and exported.

const W = 1080;
const H = 1350;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const iw = img.width * s;
  const ih = img.height * s;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = test;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s+\S*$/, "") + "…";
  }
  return lines;
}

export async function renderShareCard(place: Place): Promise<Blob | null> {
  await Promise.all([document.fonts.load('600 80px "Fraunces"'), document.fonts.load('500 30px "Geist"')]).catch(() => {});
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Paper-on-ink background.
  ctx.fillStyle = "#100e0c";
  ctx.fillRect(0, 0, W, H);

  const photoH = 820;
  const photo = place.photo ? await loadImage(place.photo.startsWith("/") ? place.photo : sizedPhoto(place.photo, 1080, 820)!) : null;
  if (photo) {
    cover(ctx, photo, 0, 0, W, photoH);
  } else {
    ctx.fillStyle = TYPE_META[place.type].color;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(0, 0, W, photoH);
    ctx.globalAlpha = 1;
  }
  const fade = ctx.createLinearGradient(0, photoH - 360, 0, photoH);
  fade.addColorStop(0, "rgba(16,14,12,0)");
  fade.addColorStop(1, "rgba(16,14,12,1)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, photoH - 360, W, 360);

  const pad = 80;
  let y = photoH - 20;

  ctx.fillStyle = "#d4a159";
  ctx.font = '600 28px "Geist", system-ui, sans-serif';
  ctx.letterSpacing = "4px";
  ctx.fillText([TYPE_META[place.type].label, place.area].filter(Boolean).join("  ·  ").toUpperCase(), pad, y);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = "#f2ebe1";
  ctx.font = '600 84px "Fraunces", Georgia, serif';
  for (const line of wrap(ctx, place.name, W - pad * 2, 2)) {
    y += 96;
    ctx.fillText(line, pad, y);
  }

  y += 70;
  ctx.font = '500 36px "Geist", system-ui, sans-serif';
  const bits: string[] = [];
  if (place.rating !== undefined) bits.push(`★ ${place.rating.toFixed(1)}${place.ratingCount ? ` (${place.ratingCount.toLocaleString("en-IN")})` : ""}`);
  const price = formatPriceForTwo(place);
  if (price) bits.push(price);
  ctx.fillStyle = "#f2ebe1";
  ctx.fillText(bits.join("   ·   "), pad, y);

  const status = openStatus(place.hours);
  if (status) {
    y += 56;
    ctx.fillStyle = "#a69c8f";
    ctx.font = '400 32px "Geist", system-ui, sans-serif';
    ctx.fillText(status.open ? `Open now · ${status.label}` : status.label, pad, y);
  }

  // Footer wordmark + hairline.
  ctx.strokeStyle = "#2f2924";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, H - 130);
  ctx.lineTo(W - pad, H - 130);
  ctx.stroke();
  ctx.fillStyle = "#f2ebe1";
  ctx.font = '600 40px "Fraunces", Georgia, serif';
  ctx.fillText("BarHudking", pad, H - 70);
  ctx.fillStyle = "#756b60";
  ctx.font = '400 28px "Geist", system-ui, sans-serif';
  const tag = "Bangalore after dark";
  ctx.fillText(tag, W - pad - ctx.measureText(tag).width, H - 72);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9));
}

/** Share the card image (with link) via the native sheet, or download it. */
export async function shareCard(place: Place) {
  const blob = await renderShareCard(place);
  const url = placeUrl(place.id);
  if (!blob) return shareLink(place.name, place.name, url);
  const file = new File([blob], `${place.name.replace(/[^\w]+/g, "-").toLowerCase()}.jpg`, { type: "image/jpeg" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: place.name, text: `${place.name} — ${url}` });
      return;
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast("Card saved — share it anywhere");
}
