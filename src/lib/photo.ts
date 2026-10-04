/** Google-hosted photos can be requested at any size via their "=w..-h.." suffix. */
export function sizedPhoto(url: string | undefined, w: number, h: number): string | undefined {
  if (!url) return undefined;
  return /googleusercontent\.com/.test(url) ? url.replace(/=w\d+-h\d+(-[a-z-]+)?$/, `=w${w}-h${h}-k-no`) : url;
}
