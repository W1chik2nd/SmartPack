// 扫码上传会话的单元测试。
// 重点验证:手机免登录凭 token 上传、同一 token 连续传多张、跨用户隔离。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createUploadSession,
  getUploadSession,
  attachImage,
  consumeImage,
  endUploadSession,
} from "./upload-session.ts";

const IMG = "data:image/jpeg;base64,AAAA";

test("createUploadSession issues a random token bound to the user", () => {
  const a = createUploadSession("user-1");
  const b = createUploadSession("user-1");
  assert.notEqual(a.token, b.token, "token 必须每次都不同");
  assert.match(a.token, /^[0-9a-f]{48}$/);
  assert.equal(a.userId, "user-1");
  assert.equal(a.image, undefined, "刚创建时还没有图片");
});

test("attachImage then consumeImage hands the photo over", () => {
  const s = createUploadSession("user-1");
  // 手机端上传:只凭 token,不涉及登录态。
  assert.equal(attachImage(s.token, IMG), true);
  // 电脑端取回。
  assert.equal(consumeImage(s.token), IMG);
  // 同一张不会被取两次(槽位已清空)。
  assert.equal(consumeImage(s.token), null);
  // 但会话仍然有效 —— 这是连拍的前提。
  assert.notEqual(getUploadSession(s.token), null);
});

test("the same token accepts multiple photos in a row", () => {
  // 连拍场景:手机上那一页不换 token,连续传好几张。
  const s = createUploadSession("user-1");
  const second = "data:image/jpeg;base64,BBBB";

  assert.equal(attachImage(s.token, IMG), true);
  assert.equal(consumeImage(s.token), IMG);

  // 第二张:之前会话已被销毁,这里会失败并报“上传链接已失效”。
  assert.equal(attachImage(s.token, second), true, "第二张仍应能上传");
  assert.equal(consumeImage(s.token), second, "第二张应能取回");
});

test("endUploadSession stops the session explicitly", () => {
  // 电脑关掉二维码弹窗时结束会话,不再接受上传。
  const s = createUploadSession("user-1");
  endUploadSession(s.token);
  assert.equal(getUploadSession(s.token), null);
  assert.equal(attachImage(s.token, IMG), false);
});

test("consumeImage returns null while the phone has not uploaded yet", () => {
  const s = createUploadSession("user-1");
  assert.equal(consumeImage(s.token), null);
  // 会话仍然有效,轮询可以继续。
  assert.notEqual(getUploadSession(s.token), null);
});

test("unknown tokens are rejected", () => {
  assert.equal(attachImage("not-a-real-token", IMG), false);
  assert.equal(getUploadSession("not-a-real-token"), null);
  assert.equal(consumeImage("not-a-real-token"), null);
});

test("sessions carry their owner so routes can reject other users", () => {
  // 路由层用 userId 比对来拒绝“拿别人 token 捞照片”,这里确认字段可用。
  const mine = createUploadSession("user-1");
  const theirs = createUploadSession("user-2");
  assert.equal(getUploadSession(mine.token)?.userId, "user-1");
  assert.equal(getUploadSession(theirs.token)?.userId, "user-2");
});
