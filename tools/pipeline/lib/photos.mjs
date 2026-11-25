// Telling a new photo from one uploaded again, so the same picture never spends credits twice.

/**
 * A photo by what it is, not by its id: its file name (without the suffix Shopify adds to a repeated
 * one), its size in pixels and its weight. Uploading the same file again gives the same fingerprint.
 */
export function fingerprint(media) {
  const name = decodeURIComponent(new URL(media.image.url).pathname.split("/").pop() ?? "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "")
    .toLowerCase();
  return [name, `${media.image.width ?? 0}x${media.image.height ?? 0}`, media.originalSource?.fileSize ?? 0].join("|");
}

/** The photos not among the ones already used (by id or by fingerprint). */
export function newPhotos(photos, usedIds, usedFingerprints) {
  const ids = new Set(usedIds);
  const prints = new Set(usedFingerprints);
  return photos.filter((m) => !ids.has(m.id) && !prints.has(fingerprint(m)));
}

/** Milliseconds until the merchant has left the photos alone for `quietMs` (0 = now). */
export function quietIn(photos, quietMs, now = Date.now()) {
  const latest = Math.max(0, ...photos.map((m) => Date.parse(m.createdAt ?? "") || 0));
  return Math.max(0, latest + quietMs - now);
}
