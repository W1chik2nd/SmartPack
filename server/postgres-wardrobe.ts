import { randomUUID } from "node:crypto";
import type { WardrobeItem } from "../shared/wardrobe-types.ts";
import type { ItemPatch, NewItem, WardrobeStore } from "./wardrobe.ts";
import { row, rows, type PostgresPool } from "./postgres.ts";

type WardrobeRow = {
  id: string;
  title: string;
  category: string;
  subtype: string;
  count: number;
  colors: string;
  fit: string;
  material: string;
  seasons: string;
  style_tags: string;
  details: string;
  has_photo: boolean;
  created_at: Date | string;
};

function stringList(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toItem(value: WardrobeRow): WardrobeItem {
  return {
    id: value.id,
    title: value.title,
    category: value.category,
    subtype: value.subtype ?? "",
    count: value.count,
    colors: stringList(value.colors),
    fit: value.fit,
    material: value.material,
    seasons: stringList(value.seasons),
    styleTags: stringList(value.style_tags),
    details: value.details,
    hasPhoto: value.has_photo,
    createdAt:
      value.created_at instanceof Date
        ? value.created_at.toISOString()
        : value.created_at,
  };
}

const SELECT_ITEM = `
  SELECT id, title, category, subtype, count, colors, fit, material,
         seasons, style_tags, details, photo_data IS NOT NULL AS has_photo,
         created_at
    FROM wardrobe_items`;

function photoParts(dataUrl: string | undefined): {
  data: Buffer | null;
  contentType: string | null;
} {
  if (!dataUrl) return { data: null, contentType: null };
  const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/is);
  if (!match) return { data: null, contentType: null };
  return { data: Buffer.from(match[2], "base64"), contentType: match[1] };
}

export function createPostgresWardrobeStore(
  pool: PostgresPool
): WardrobeStore {
  async function find(userId: string, id: string): Promise<WardrobeRow | null> {
    return row<WardrobeRow>(
      pool,
      `${SELECT_ITEM} WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
  }

  return {
    async list(userId) {
      return (
        await rows<WardrobeRow>(
          pool,
          `${SELECT_ITEM}
            WHERE user_id = $1
            ORDER BY created_at DESC, id DESC`,
          [userId]
        )
      ).map(toItem);
    },

    async add(userId, item: NewItem) {
      const id = randomUUID();
      const photo = photoParts(item.photoDataUrl);
      const saved = await row<WardrobeRow>(
        pool,
        `INSERT INTO wardrobe_items
           (id, user_id, title, category, subtype, count, colors, fit, material,
            seasons, style_tags, details, photo_data, photo_content_type)
         VALUES
           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id, title, category, subtype, count, colors, fit, material,
                   seasons, style_tags, details,
                   photo_data IS NOT NULL AS has_photo, created_at`,
        [
          id,
          userId,
          item.title,
          item.category,
          item.subtype ?? "",
          item.count ?? 1,
          JSON.stringify(item.colors ?? []),
          item.fit ?? "",
          item.material ?? "",
          JSON.stringify(item.seasons ?? []),
          JSON.stringify(item.styleTags ?? []),
          item.details ?? "",
          photo.data,
          photo.contentType,
        ]
      );
      return toItem(saved!);
    },

    async update(userId, id, patch: ItemPatch) {
      const columns: Record<string, string | number> = {};
      if (patch.title !== undefined) columns.title = patch.title;
      if (patch.category !== undefined) columns.category = patch.category;
      if (patch.subtype !== undefined) columns.subtype = patch.subtype;
      if (patch.count !== undefined) columns.count = patch.count;
      if (patch.fit !== undefined) columns.fit = patch.fit;
      if (patch.material !== undefined) columns.material = patch.material;
      if (patch.details !== undefined) columns.details = patch.details;
      const keys = Object.keys(columns);
      if (keys.length === 0) {
        const existing = await find(userId, id);
        return existing ? toItem(existing) : null;
      }
      const values = keys.map((key) => columns[key]);
      const updated = await row<WardrobeRow>(
        pool,
        `UPDATE wardrobe_items
            SET ${keys.map((key, index) => `${key} = $${index + 1}`).join(", ")}
          WHERE id = $${keys.length + 1} AND user_id = $${keys.length + 2}
          RETURNING id, title, category, subtype, count, colors, fit, material,
                    seasons, style_tags, details,
                    photo_data IS NOT NULL AS has_photo, created_at`,
        [...values, id, userId]
      );
      return updated ? toItem(updated) : null;
    },

    async remove(userId, id) {
      const result = await pool.query(
        `DELETE FROM wardrobe_items WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );
      return (result.rowCount ?? 0) > 0;
    },

    async photo(userId, id) {
      const value = await row<{ photo_data: Buffer; photo_content_type: string }>(
        pool,
        `SELECT photo_data, photo_content_type
           FROM wardrobe_items
          WHERE id = $1 AND user_id = $2 AND photo_data IS NOT NULL`,
        [id, userId]
      );
      return value
        ? {
            data: value.photo_data,
            contentType: value.photo_content_type || "image/jpeg",
          }
        : null;
    },
  };
}
