// 集成模块的纯函数测试。外部 HTTP 调用(vision/电商 API)需要真实 key,
// 不在单测范围;这里只测我们自己的逻辑:签名、时间戳、关键词、provider 选择。
import { test } from "node:test";
import assert from "node:assert/strict";
import { topSign, gmt8Timestamp, ecommerceProvider } from "./ecommerce.ts";
import { searchKeyword, visionConfigured } from "./vision.ts";

test("topSign matches the documented TOP algorithm", () => {
  // MD5(secret + key1value1key2value2 + secret) 大写,键按字典序。
  // 期望值独立计算自 md5("seca1b2sec")。
  const sign = topSign({ b: "2", a: "1" }, "sec");
  assert.equal(sign, "7AB23CC77796A2899E6C5BF5D76D230E");
  // 顺序无关:同参数不同传入顺序,签名一致
  assert.equal(sign, topSign({ a: "1", b: "2" }, "sec"));
});

test("gmt8Timestamp formats as yyyy-MM-dd HH:mm:ss in GMT+8", () => {
  // 2024-01-01T00:00:00Z 的 GMT+8 是 08:00:00
  const ts = gmt8Timestamp(Date.UTC(2024, 0, 1, 0, 0, 0));
  assert.equal(ts, "2024-01-01 08:00:00");
});

test("searchKeyword joins color and title without duplication", () => {
  // 识别结果的公共字段;title 是“颜色+版型+品类”的大标题。
  const base = {
    category: "外套",
    subtype: "",
    fit: "",
    material: "",
    seasons: [],
    styleTags: [],
    details: "",
  };
  assert.equal(
    searchKeyword({ ...base, title: "牛仔外套", colors: ["蓝色"] }),
    "蓝色牛仔外套"
  );
  // 标题已含颜色则不重复
  assert.equal(
    searchKeyword({ ...base, title: "蓝色牛仔外套", colors: ["蓝色"] }),
    "蓝色牛仔外套"
  );
  // 无颜色时直接用标题
  assert.equal(
    searchKeyword({ ...base, title: "牛仔外套", colors: [] }),
    "牛仔外套"
  );
});

test("ecommerceProvider picks by configured env", () => {
  const saved = { ...process.env };
  try {
    delete process.env.JD_UNION_APP_KEY;
    delete process.env.JD_UNION_APP_SECRET;
    delete process.env.TAOBAO_APP_KEY;
    delete process.env.TAOBAO_APP_SECRET;
    delete process.env.TAOBAO_ADZONE_ID;
    delete process.env.ECOMMERCE_PROVIDER;
    assert.equal(ecommerceProvider(), null);

    process.env.JD_UNION_APP_KEY = "k";
    process.env.JD_UNION_APP_SECRET = "s";
    assert.equal(ecommerceProvider(), "jd");

    process.env.TAOBAO_APP_KEY = "k";
    process.env.TAOBAO_APP_SECRET = "s";
    process.env.TAOBAO_ADZONE_ID = "z";
    process.env.ECOMMERCE_PROVIDER = "taobao";
    assert.equal(ecommerceProvider(), "taobao");
  } finally {
    process.env = saved;
  }
});

test("visionConfigured reflects VISION_API_KEY presence", () => {
  const saved = process.env.VISION_API_KEY;
  try {
    delete process.env.VISION_API_KEY;
    assert.equal(visionConfigured(), false);
    process.env.VISION_API_KEY = "sk-test";
    assert.equal(visionConfigured(), true);
  } finally {
    if (saved === undefined) delete process.env.VISION_API_KEY;
    else process.env.VISION_API_KEY = saved;
  }
});
