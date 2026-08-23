// 衣柜持久化 —— 单品存 SQLite,照片按 id 存文件。
//
// 为什么照片不进数据库:base64 图片动辄几百 KB,塞进表里会让每次查询
// 都拖着图片数据走,而衣柜列表只需要标题和标签。所以库里只存文件名,
// 图片本体落盘到 data/photos/<id>.jpg,由 /api/wardrobe/photo/<id> 提供。
//
// details/fit/material/seasons 这些细节字段是留给穿搭推荐(README 核心功能)
// 分析用的,不只是展示。
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export type WardrobeItem = {
  id: string;
  title: string; // 大标题,如“黄色宽松工装裤”
  category: string;
  /** 具体款式,如“工装裤”“飞行夹克”。 */
  subtype: string;
  count: number;
  colors: string[];
  fit: string;
  material: string;
  seasons: string[];
  styleTags: string[];
  details: string;
  /** 有照片时为 true;图片本体走 /api/wardrobe/photo/<id> 取。 */
  hasPhoto: boolean;
  createdAt: string;
};

/** 新增单品时的入参(照片是可选的 data URL)。 */
export type NewItem = {
  title: string;
  category: string;
  subtype?: string;
  count?: number;
  colors?: string[];
  fit?: string;
  material?: string;
  seasons?: string[];
  styleTags?: string[];
  details?: string;
  photoDataUrl?: string;
};

/** 允许编辑的字段。 */
export type ItemPatch = Partial<{
  title: string;
  category: string;
  subtype: string;
  count: number;
  fit: string;
  material: string;
  details: string;
}>;

type Row = {
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
  photo_file: string | null;
  created_at: string;
};

function toItem(r: Row): WardrobeItem {
  // 数组字段以 JSON 文本存;SQLite 没有数组类型,这比开关联表简单得多。
  const list = (s: string): string[] => {
    try {
      const v = JSON.parse(s);
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return [];
    }
  };
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    subtype: r.subtype ?? "",
    count: r.count,
    colors: list(r.colors),
    fit: r.fit,
    material: r.material,
    seasons: list(r.seasons),
    styleTags: list(r.style_tags),
    details: r.details,
    hasPhoto: Boolean(r.photo_file),
    createdAt: r.created_at,
  };
}

export type WardrobeStore = {
  list: (userId: string) => WardrobeItem[];
  add: (userId: string, item: NewItem) => WardrobeItem;
  update: (userId: string, id: string, patch: ItemPatch) => WardrobeItem | null;
  remove: (userId: string, id: string) => boolean;
  photoPath: (userId: string, id: string) => string | null;
};

export function createWardrobeStore(
  db: DatabaseSync,
  photoDir: string
): WardrobeStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wardrobe_items (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id),
      title       TEXT NOT NULL,
      category    TEXT NOT NULL,
      count       INTEGER NOT NULL DEFAULT 1,
      colors      TEXT NOT NULL DEFAULT '[]',
      fit         TEXT NOT NULL DEFAULT '',
      material    TEXT NOT NULL DEFAULT '',
      seasons     TEXT NOT NULL DEFAULT '[]',
      style_tags  TEXT NOT NULL DEFAULT '[]',
      details     TEXT NOT NULL DEFAULT '',
      photo_file  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_wardrobe_user
      ON wardrobe_items(user_id, created_at);
  `);

  // subtype(具体款式,如“工装裤”)是后加的字段。已有库里没有这列,
  // 所以用 ALTER 补上;重复执行会报错,捕获掉即可(SQLite 没有 IF NOT EXISTS)。
  try {
    db.exec(`ALTER TABLE wardrobe_items ADD COLUMN subtype TEXT NOT NULL DEFAULT ''`);
  } catch {
    // 列已存在,正常情况。
  }
  mkdirSync(photoDir, { recursive: true });

  /** data:image/jpeg;base64,xxx → 落盘,返回文件名。 */
  function savePhoto(id: string, dataUrl: string): string {
    const comma = dataUrl.indexOf(",");
    const base64 = dataUrl.slice(comma + 1);
    const ext = /^data:image\/png/i.test(dataUrl) ? "png" : "jpg";
    const file = `${id}.${ext}`;
    writeFileSync(join(photoDir, file), Buffer.from(base64, "base64"));
    return file;
  }

  function findRow(userId: string, id: string): Row | undefined {
    return db
      .prepare(`SELECT * FROM wardrobe_items WHERE id = ? AND user_id = ?`)
      .get(id, userId) as Row | undefined;
  }

  return {
    list(userId) {
      const rows = db
        .prepare(
          `SELECT * FROM wardrobe_items WHERE user_id = ? ORDER BY created_at DESC`
        )
        .all(userId) as Row[];
      return rows.map(toItem);
    },

    add(userId, item) {
      const id = randomUUID();
      const photoFile = item.photoDataUrl
        ? savePhoto(id, item.photoDataUrl)
        : null;
      db.prepare(
        `INSERT INTO wardrobe_items
           (id, user_id, title, category, subtype, count, colors, fit, material,
            seasons, style_tags, details, photo_file)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
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
        photoFile
      );
      return toItem(findRow(userId, id)!);
    },

    update(userId, id, patch) {
      if (!findRow(userId, id)) return null;
      // 只允许白名单字段,避免把 user_id/photo_file 这类字段改掉。
      const cols: Record<string, string | number> = {};
      if (patch.title !== undefined) cols.title = patch.title;
      if (patch.category !== undefined) cols.category = patch.category;
      if (patch.subtype !== undefined) cols.subtype = patch.subtype;
      if (patch.count !== undefined) cols.count = patch.count;
      if (patch.fit !== undefined) cols.fit = patch.fit;
      if (patch.material !== undefined) cols.material = patch.material;
      if (patch.details !== undefined) cols.details = patch.details;

      const keys = Object.keys(cols);
      if (keys.length > 0) {
        db.prepare(
          `UPDATE wardrobe_items SET ${keys
            .map((k) => `${k} = ?`)
            .join(", ")} WHERE id = ? AND user_id = ?`
        ).run(...keys.map((k) => cols[k]), id, userId);
      }
      return toItem(findRow(userId, id)!);
    },

    remove(userId, id) {
      const row = findRow(userId, id);
      if (!row) return false;
      db.prepare(`DELETE FROM wardrobe_items WHERE id = ? AND user_id = ?`).run(
        id,
        userId
      );
      // 顺手删掉照片文件,避免孤儿文件堆积。
      if (row.photo_file) {
        try {
          unlinkSync(join(photoDir, row.photo_file));
        } catch {
          // 文件可能已不在(手动删过/迁移过),删记录才是目的,忽略即可。
        }
      }
      return true;
    },

    photoPath(userId, id) {
      const row = findRow(userId, id);
      return row?.photo_file ? join(photoDir, row.photo_file) : null;
    },
  };
}

