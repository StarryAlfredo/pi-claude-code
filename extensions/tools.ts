/**
 * pi-cc-tools — Claude Code 兼容层工具扩展
 *
 * 职责：注册 Claude Code 风格的独立工具
 * 依赖：pi-cc-core（可选，如果已安装则遵循权限系统）
 *
 * 注册的工具：web_fetch, web_search, lsp, todo, plan_mode, ask_user,
 *             notebook_edit, worktree_enter, worktree_exit
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function toolsExtension(pi: ExtensionAPI) {
  // TODO: 注册 WebFetch 工具
  // import { registerWebFetch } from '../src/tools/web-fetch'
  // registerWebFetch(pi)

  // TODO: 注册 WebSearch 工具
  // import { registerWebSearch } from '../src/tools/web-search'
  // registerWebSearch(pi)

  // TODO: 注册 LSP 工具
  // import { registerLSP } from '../src/tools/lsp'
  // registerLSP(pi)

  // TODO: 注册 TodoWrite 工具
  // import { registerTodo } from '../src/tools/todo'
  // registerTodo(pi)

  // TODO: 注册 Plan Mode 工具（enter_plan_mode / exit_plan_mode）
  // import { registerPlanMode } from '../src/tools/plan-mode'
  // registerPlanMode(pi)

  // TODO: 注册 AskUser 工具
  // import { registerAskUser } from '../src/tools/ask-user'
  // registerAskUser(pi)

  // TODO: 注册 NotebookEdit 工具
  // import { registerNotebookEdit } from '../src/tools/notebook-edit'
  // registerNotebookEdit(pi)

  // TODO: 注册 Worktree 工具（worktree_enter / worktree_exit）
  // import { registerWorktree } from '../src/tools/worktree'
  // registerWorktree(pi)

  // 不需要自己做权限检查 —— pi-cc-core 的 tool_call 拦截器会统一处理
  // 如果 pi-cc-core 没装，工具也能正常使用，只是没有权限保护
}
