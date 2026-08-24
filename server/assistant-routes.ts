// WearRoute 助手路由:/api/chat。
// 从 app.ts 拆出来是为了守住单文件 400 行上限(AGENTS.md §7)。
//
// 会话内才可用:system prompt 里嵌了用户的问卷画像,匿名聊天没有可个性化的
// 依据。prompt 本身永远不出服务端(AGENTS.md §3)。
import { type IncomingMessage, type ServerResponse } from "node:http";
import { aiConfigured, chatCompletion, type ChatMessage } from "./ai.ts";
import { buildSystemPrompt } from "./prompts.ts";
import {
  executeAssistantActions,
  parseAssistantEnvelope,
  type AssistantDataContext,
} from "./assistant-actions.ts";
import type { AsyncValue } from "./async-value.ts";

/** buildSystemPrompt 需要的用户画像字段。 */
type ProfileUser = Parameters<typeof buildSystemPrompt>[0];

type Ctx = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  json: (res: ServerResponse, status: number, body: unknown) => void;
  readBody: (req: IncomingMessage, maxBytes?: number) => Promise<any>;
  /** 从 Authorization 头解析用户;未登录返回 null。 */
  userFromHeader: () => AsyncValue<ProfileUser | null>;
  actionContext: () => AsyncValue<AssistantDataContext | null>;
};

/** 处理了就返回 true,让 app.ts 知道不用继续匹配后面的路由。 */
export async function handleAssistantRoutes(ctx: Ctx): Promise<boolean> {
  const { req, res, url, json, readBody, userFromHeader } = ctx;

  if (req.method !== "POST" || url.pathname !== "/api/chat") return false;

  const user = await userFromHeader();
  if (!user) {
    json(res, 401, { error: "Not signed in." });
    return true;
  }
  if (!aiConfigured()) {
    json(res, 503, {
      error:
        "AI is not configured. Set AI_API_KEY in server/.env (see server/.env.example).",
    });
    return true;
  }

  // 信任边界:请求体是外部输入,这里校验形状和大小。
  const { messages } = await readBody(req);
  const valid =
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.length <= 40 &&
    messages.every(
      (m: ChatMessage) =>
        (m?.role === "user" || m?.role === "assistant") &&
        typeof m?.content === "string" &&
        m.content.length > 0 &&
        m.content.length <= 4000
    );
  if (!valid) {
    json(res, 400, { error: "Invalid messages." });
    return true;
  }

  const actionContext = await ctx.actionContext();
  if (!actionContext) {
    json(res, 401, { error: "Not signed in." });
    return true;
  }
  const systemPrompt = buildSystemPrompt(user) + actionContext.promptContext;
  const content = await chatCompletion(systemPrompt, messages);
  const envelope = parseAssistantEnvelope(content);
  const result = await executeAssistantActions(envelope.actions, actionContext);
  const resultMessage = result.actions.length > 0
    ? "Action completed successfully."
    : "";
  const reply = [envelope.reply, resultMessage, ...result.errors]
    .filter(Boolean)
    .join("\n\n");
  json(res, 200, { reply, actions: result.actions });
  return true;
}
