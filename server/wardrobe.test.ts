// 衣柜持久化层测试:落库、编辑、删除、照片按 id 存文件、用户隔离。
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWardrobeStore } from "./wardrobe.ts";

// 1x1 像素 JPEG 的 data URL,够用来验证落盘。
const PHOTO =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwcJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPDs0NDP/wAALCAABAAEBAREA/8QAFAABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJQA/9k=";

function freshStore() {
  const dir = mkdtempSync(join(tmpdir(), "wearroute-wardrobe-"));
  const db = new DatabaseSync(join(dir, "test.db"));
  // wardrobe 表有 user_id 外键指向 users,测试里需要这张表存在。
  db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY);`);
  db.prepare(`INSERT INTO users (id) VALUES ('u1'), ('u2')`).run();
  const photoDir = join(dir, "photos");
  return { store: createWardrobeStore(db, photoDir), photoDir, db };
}

const BASE = { title: "黄色宽松外套", category: "外套" };

test("add stores all detail fields for later AI analysis", () => {
  const { store } = freshStore();
  const item = store.add("u1", {
    ...BASE,
    subtype: "工装外套",
    colors: ["黄色"],
    fit: "宽松",
    material: "棉",
    seasons: ["春", "秋"],
    styleTags: ["休闲"],
    details: "翻领,长袖,中厚",
  });
  assert.equal(item.title, "黄色宽松外套");
  assert.equal(item.category, "外套");
  assert.equal(item.count, 1, "数量默认 1");
  // 这些细节字段是穿搭推荐要用的原料,必须原样存回。
  assert.equal(item.subtype, "工装外套", "具体款式要存下来");
  assert.deepEqual(item.colors, ["黄色"]);
  assert.equal(item.fit, "宽松");
  assert.equal(item.material, "棉");
  assert.deepEqual(item.seasons, ["春", "秋"]);
  assert.deepEqual(item.styleTags, ["休闲"]);
  assert.equal(item.details, "翻领,长袖,中厚");
  assert.equal(item.hasPhoto, false, "没传照片时为 false");
  assert.match(item.id, /^[0-9a-f-]{36}$/);
});

test("photos are written to disk by id, not stored in the row", () => {
  const { store, photoDir } = freshStore();
  const item = store.add("u1", { ...BASE, photoDataUrl: PHOTO });
  assert.equal(item.hasPhoto, true);

  const path = store.photoPath("u1", item.id);
  assert.ok(path, "应返回照片路径");
  assert.equal(path, join(photoDir, `${item.id}.jpg`), "文件名用单品 id");
  assert.ok(existsSync(path!), "照片应落盘");
  assert.ok(readFileSync(path!).length > 0, "文件非空");

  // 列表接口不应把图片数据带出来(只有 hasPhoto 标记)。
  const listed = store.list("u1")[0] as unknown as Record<string, unknown>;
  assert.equal(listed.photoDataUrl, undefined);
  assert.equal(listed.photo_file, undefined);
});

test("list returns newest first and only the owner's items", () => {
  const { store } = freshStore();
  store.add("u1", { ...BASE, title: "第一件" });
  store.add("u1", { ...BASE, title: "第二件" });
  store.add("u2", { ...BASE, title: "别人的" });

  const mine = store.list("u1");
  assert.equal(mine.length, 2, "只看到自己的两件");
  assert.ok(
    mine.every((i) => i.title !== "别人的"),
    "不应看到其他用户的单品"
  );
  assert.equal(store.list("u2").length, 1);
});

test("update only touches whitelisted fields", () => {
  const { store } = freshStore();
  const item = store.add("u1", { ...BASE, colors: ["黄色"] });

  const updated = store.update("u1", item.id, {
    title: "米色修身外套",
    count: 3,
    fit: "修身",
  });
  assert.equal(updated?.title, "米色修身外套");
  assert.equal(updated?.count, 3);
  assert.equal(updated?.fit, "修身");
  // 没在 patch 里的字段保持原样。
  assert.deepEqual(updated?.colors, ["黄色"]);
});

test("update and remove reject other users' items", () => {
  const { store } = freshStore();
  const item = store.add("u1", BASE);
  // u2 不能改也不能删 u1 的东西。
  assert.equal(store.update("u2", item.id, { title: "篡改" }), null);
  assert.equal(store.remove("u2", item.id), false);
  assert.equal(store.list("u1").length, 1, "原单品仍在");
  assert.equal(store.photoPath("u2", item.id), null);
});

test("remove deletes the row and its photo file", () => {
  const { store } = freshStore();
  const item = store.add("u1", { ...BASE, photoDataUrl: PHOTO });
  const path = store.photoPath("u1", item.id)!;
  assert.ok(existsSync(path));

  assert.equal(store.remove("u1", item.id), true);
  assert.equal(store.list("u1").length, 0, "记录已删");
  assert.equal(existsSync(path), false, "照片文件也应删掉,避免孤儿文件");
  // 重复删除应返回 false 而不是抛错。
  assert.equal(store.remove("u1", item.id), false);
});
