// 识别层测试:非衣物图片必须被拒绝,不能带着一堆“未知”入库。
// 这里用假的 fetch 返回模型响应,不打真实 API。
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { recognizeClothing, NotClothingError } from "./vision.ts";

const IMG = "data:image/jpeg;base64,AAAA";

/** 让 fetch 返回指定的模型输出文本。 */
function mockModelReply(content: string) {
  mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  }));
}

test("rejects images the model says are not clothing", async () => {
  process.env.VISION_API_KEY = "test-key";
  mockModelReply(
    JSON.stringify({ notClothing: true, reason: "图里是一个塑料水杯" })
  );
  await assert.rejects(
    () => recognizeClothing(IMG),
    (err: Error) => {
      assert.ok(err instanceof NotClothingError, "应抛 NotClothingError");
      assert.match(err.message, /水杯/, "错误信息应带上模型给的原因");
      return true;
    }
  );
  mock.restoreAll();
});

test("rejects results whose key fields are all unknown", async () => {
  // 模型没走 notClothing 分支,但每个字段都填“未知”——
  // 这正是拍到水杯时出现的“未知/未知·未知·未知”空卡片,不该入库。
  process.env.VISION_API_KEY = "test-key";
  mockModelReply(
    JSON.stringify({
      title: "未知",
      category: "未知",
      subtype: "未知",
      colors: [],
      fit: "未知",
      material: "未知",
      seasons: [],
      styleTags: [],
      details: "无法识别衣物信息",
    })
  );
  await assert.rejects(
    () => recognizeClothing(IMG),
    (err: Error) => {
      assert.ok(err instanceof NotClothingError);
      return true;
    }
  );
  mock.restoreAll();
});

test("accepts a normal clothing result", async () => {
  process.env.VISION_API_KEY = "test-key";
  mockModelReply(
    JSON.stringify({
      title: "黑色宽松工装裤",
      category: "裤装",
      subtype: "工装裤",
      colors: ["黑色"],
      fit: "宽松",
      material: "工装棉布",
      seasons: ["春", "秋"],
      styleTags: ["街头"],
      details: "多个工装大口袋，裤脚束口，抽绳腰头。",
    })
  );
  const item = await recognizeClothing(IMG);
  assert.equal(item.title, "黑色宽松工装裤");
  assert.equal(item.subtype, "工装裤", "款式由模型自由判断");
  assert.equal(item.fit, "宽松");
  mock.restoreAll();
});

test("a single unknown field does not reject an otherwise good result", async () => {
  // 只有材质没看出来时仍应入库,不能一刀切。
  process.env.VISION_API_KEY = "test-key";
  mockModelReply(
    JSON.stringify({
      title: "白色圆领T恤",
      category: "T恤",
      subtype: "圆领T恤",
      colors: ["白色"],
      fit: "合身",
      material: "未知",
      seasons: ["夏"],
      styleTags: ["休闲"],
      details: "圆领，短袖，胸前无印花，面料轻薄。",
    })
  );
  const item = await recognizeClothing(IMG);
  assert.equal(item.title, "白色圆领T恤");
  mock.restoreAll();
});

