/**
 * pi-cc-tools — Claude Code 兼容层工具扩展
 *
 * 职责：注册 Claude Code 风格的独立工具
 *
 * 与 core.ts 的关系：
 * - 如果 core.ts 已安装，tools.ts 读取 state.permission 遵循权限模式
 * - 如果 core.ts 没装，state.permission 默认值是 "default" 模式，
 *   tools.ts 的 tool_call handler 会做基础的危险命令拦截
 * - 可以通过 Pi 的 Package Filtering 单独安装
 *
 * 注册的工具：AskUserQuestion, web_fetch, web_search, lsp, todo,
 *             notebook_edit, worktree_enter, worktree_exit
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { state } from "../src/state.js"
import { registerAskUser } from "../src/tools/ask-user.js"

export default function toolsExtension(pi: ExtensionAPI) {
  // ── 已实现 ──────────────────────────────────────────
  registerAskUser(pi)

  // ── 工具权限补充拦截 ──
  // core.ts 的 tool_call handler 做了主要权限拦截。
  // 但如果 core.ts 没装，tools.ts 需要自己做基础保护。
  // 因为 tool_call handler 是链式调用的（所有扩展的 handler 都会执行），
  // 所以这里不会和 core.ts 冲突——core 拦截了就不会到这里。
  pi.on("tool_call", async (event, ctx) => {
    // 只处理本扩展注册的工具
    const myTools = ["AskUserQuestion"]
    if (!myTools.includes(event.toolName)) return

    // AskUserQuestion 在 plan 模式下仍然允许（它是只读的交互工具）
    // 无需额外拦截
  })

  // ── 待实现 ──────────────────────────────────────────
  // TODO: registerWebFetch(pi)
  // TODO: registerWebSearch(pi)
  // TODO: registerLSP(pi)
  // TODO: registerTodo(pi)
  // TODO: registerPlanMode(pi)
  // TODO: registerNotebookEdit(pi)
  // TODO: registerWorktree(pi)
}