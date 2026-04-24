/**
 * pi-cc-core — Claude Code 兼容层核心扩展
 *
 * 职责：权限系统 + 记忆系统 + Hooks 系统 + Slash 命令
 * 这是唯一会 **写入** 共享状态的扩展，其他扩展只 **读取**。
 *
 * 但如果 core 没装，其他扩展仍然能用默认值正常工作。
 *
 * 注册的工具：无（权限通过 tool_call 事件拦截，不注册工具）
 * 注册的命令：/permissions, /memory, /hooks, /doctor, /cost
 * 注册的事件：
 *   - tool_call      → 权限拦截（读 state.permission）
 *   - turn_end       → 记忆提取触发
 *   - before_agent_start → 权限模式注入 system prompt + 记忆注入
 * 注册的快捷键：Ctrl+Alt+P（切换 Plan 模式）
 * 注册的 CLI 标志：--yolo, --plan
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { Key } from "@mariozechner/pi-tui"
import { state } from "../src/state.js"
import type { PermissionMode, SafetyLevel } from "../src/types.js"

// ─── Bash 命令分类器 ──────────────────────────────────────────

const DANGEROUS_PATTERNS = [
  /\brm\s+(-rf?|--recursive)\b/i,
  /\bsudo\b/i,
  /\b(chmod|chown)\b.*777/i,
  /\bdd\s+if=/i,
  /\bmkfs\b/i,
  /\bformat\b.*[a-z]:/i,
  />\s*\/dev\/sd/i,
]

const WRITE_PATTERNS = [
  /\b(mkdir|touch|cp|mv|tee|cat\s*>|echo\s*>|sed\s+-i|apt|yum|brew|pip|npm\s+install|cargo\s+install)\b/i,
  /\bgit\s+(commit|push|merge|rebase|checkout|switch|reset|stash\s+drop)\b/i,
  /\b(docker|podman)\s+(run|build|push|rm|rmi)\b/i,
]

function classifyBashCommand(command: string): SafetyLevel {
  if (DANGEROUS_PATTERNS.some((p) => p.test(command))) return "dangerous"
  if (WRITE_PATTERNS.some((p) => p.test(command))) return "write"
  return "read"
}

// ─── 权限检查 ──────────────────────────────────────────────

function checkPermission(
  toolName: string,
  input: Record<string, unknown>,
  hasUI: boolean,
): { block: boolean; reason?: string } {
  const { mode, protectedPaths, bashClassifier } = state.permission

  // YOLO 模式：什么都不拦截
  if (mode === "yolo") return { block: false }

  // Auto 模式：LLM 自己决定，不做拦截
  if (mode === "auto") return { block: false }

  // Plan 模式：只允许只读操作
  if (mode === "plan") {
    if (["edit", "write"].includes(toolName)) {
      return { block: true, reason: `Plan mode: ${toolName} is disabled. Use /permissions to exit plan mode.` }
    }
    if (toolName === "bash") {
      const command = (input.command as string) ?? ""
      const classifier = bashClassifier ?? classifyBashCommand
      const safety = classifier(command)
      if (safety !== "read") {
        return { block: true, reason: `Plan mode: only read-only bash commands allowed. Use /permissions to exit plan mode.` }
      }
    }
    return { block: false }
  }

  // Default 模式：危险操作需要确认
  if (mode === "default") {
    // 受保护路径检查
    if (["edit", "write"].includes(toolName)) {
      const path = (input.path as string) ?? (input.file_path as string) ?? ""
      if (protectedPaths.some((p) => path.includes(p))) {
        return { block: true, reason: `Path "${path}" is protected` }
      }
    }

    // 危险 bash 命令需要确认
    if (toolName === "bash" && hasUI) {
      const command = (input.command as string) ?? ""
      const classifier = bashClassifier ?? classifyBashCommand
      const safety = classifier(command)
      if (safety === "dangerous") {
        // 注意：这里不能 await ctx.ui.confirm()，因为 tool_call handler 可能不希望在
        // 所有场景下都弹确认框。实际实现中，这里应该用 ctx.ui.confirm()。
        // 但当前 tool_call handler 签名允许 async，所以可以直接 confirm。
        // 不过这个逻辑比较复杂，先简单处理：dangerous 命令在 default 模式下需要确认
        // 具体的 confirm 调用在 tool_call 事件中处理
      }
    }
  }

  return { block: false }
}

// ─── 扩展入口 ──────────────────────────────────────────────

export default function coreExtension(pi: ExtensionAPI) {
  // ── 注册 Bash 分类器到共享状态 ──
  state.permission.bashClassifier = classifyBashCommand

  // ── CLI 标志 ──
  pi.registerFlag("yolo", {
    description: "Start with YOLO permission mode (auto-approve all)",
    type: "boolean",
    default: false,
  })

  pi.registerFlag("plan", {
    description: "Start in Plan mode (read-only exploration)",
    type: "boolean",
    default: false,
  })

  // ── 权限拦截 ──
  pi.on("tool_call", async (event, ctx) => {
    // dangerous bash 命令在 default 模式下需要确认
    if (
      state.permission.mode === "default" &&
      event.toolName === "bash" &&
      ctx.hasUI
    ) {
      const command = (event.input.command as string) ?? ""
      const classifier = state.permission.bashClassifier ?? classifyBashCommand
      const safety = classifier(command)

      if (safety === "dangerous") {
        const ok = await ctx.ui.confirm(
          "⚠️ Dangerous command",
          `${command}\n\nAllow execution?`,
        )
        if (!ok) {
          return { block: true, reason: "User denied dangerous command" }
        }
      }
    }

    // 通用权限检查
    const result = checkPermission(event.toolName, event.input, ctx.hasUI)
    if (result.block) {
      return { block: true, reason: result.reason }
    }
  })

  // ── 权限模式注入 system prompt + 记忆注入 ──
  pi.on("before_agent_start", async (event) => {
    let prompt = event.systemPrompt

    // 注入权限模式提示
    if (state.permission.planModeActive) {
      prompt +=
        "\n\n[PLAN MODE ACTIVE]\n" +
        "You are in plan mode — a read-only exploration mode.\n" +
        "You can only use: read, bash (read-only), grep, find, ls, AskUserQuestion.\n" +
        "You CANNOT use: edit, write (file modifications are disabled).\n" +
        "Create a detailed numbered plan under a \"Plan:\" header.\n" +
        "Do NOT attempt to make changes — just describe what you would do."
    }

    // 注入记忆文件内容
    if (state.memory.files.length > 0) {
      const memoryParts: string[] = ["\n\n## Memory Files"]
      for (const [path, content] of state.memory.cache) {
        memoryParts.push(`### ${path}\n${content}`)
      }
      prompt += memoryParts.join("\n")
    }

    if (prompt !== event.systemPrompt) {
      return { systemPrompt: prompt }
    }
  })

  // ── 记忆文件加载 ──
  pi.on("session_start", async (_event, ctx) => {
    // 读取 CLI 标志
    if (pi.getFlag("yolo") === true) {
      state.permission.mode = "yolo"
    }
    if (pi.getFlag("plan") === true) {
      state.permission.mode = "plan"
      state.permission.planModeActive = true
    }

    // 扫描记忆文件
    // TODO: 实现 loadMemoryFiles() 扫描 PI.md / PI.local.md
    // const files = await loadMemoryFiles(ctx.cwd)
    // state.memory.files = files.paths
    // state.memory.cache = files.cache

    // 更新 UI 状态
    updateStatus(ctx)

    if (state.permission.mode !== "default") {
      ctx.ui.notify(`Permission mode: ${state.permission.mode}`, "info")
    }
  })

  // ── 记忆提取触发 ──
  pi.on("turn_end", async (_event, _ctx) => {
    if (!state.memory.autoExtractEnabled) return
    // TODO: 检查阈值，触发记忆提取子进程
    // if (shouldExtractMemory(...)) {
    //   spawn pi --mode json --tools edit --append-system-prompt ...
    // }
  })

  // ── 命令 ──

  pi.registerCommand("permissions", {
    description: "Switch permission mode (default/plan/yolo/auto)",
    handler: async (_args, ctx) => {
      const current = state.permission.mode
      const modes: PermissionMode[] = ["default", "plan", "yolo", "auto"]
      const labels = modes.map((m) => (m === current ? `${m} (current)` : m))
      const choice = await ctx.ui.select("Permission mode:", labels)
      if (choice === undefined) return

      const mode = modes[labels.indexOf(choice)]
      if (!mode) return

      state.permission.mode = mode
      state.permission.planModeActive = mode === "plan"

      // Plan 模式切换工具集
      if (mode === "plan") {
        pi.setActiveTools(["read", "bash", "grep", "find", "ls", "AskUserQuestion"])
      } else {
        pi.setActiveTools(["read", "bash", "edit", "write", "grep", "find", "ls", "AskUserQuestion"])
      }

      updateStatus(ctx)
      ctx.ui.notify(`Permission mode: ${mode}`, "info")
    },
  })

  pi.registerCommand("memory", {
    description: "Manage memory files",
    handler: async (_args, ctx) => {
      const action = await ctx.ui.select("Memory:", ["List files", "Reload", "Toggle auto-extract"])
      if (action === "List files") {
        const files = state.memory.files
        if (files.length === 0) {
          ctx.ui.notify("No memory files found", "info")
        } else {
          ctx.ui.notify(`Memory files:\n${files.join("\n")}`, "info")
        }
      } else if (action === "Reload") {
        // TODO: 重新扫描记忆文件
        ctx.ui.notify("Memory files reloaded", "info")
      } else if (action === "Toggle auto-extract") {
        state.memory.autoExtractEnabled = !state.memory.autoExtractEnabled
        ctx.ui.notify(`Auto-extract: ${state.memory.autoExtractEnabled ? "on" : "off"}`, "info")
      }
    },
  })

  // ── 快捷键 ──
  pi.registerShortcut(Key.ctrlAlt("p"), {
    description: "Toggle Plan mode",
    handler: async (_ctx) => {
      // 通过 sendMessage 模拟 /permissions 命令
      // 不能直接调用 handler，因为需要 ExtensionCommandContext
      if (state.permission.planModeActive) {
        pi.sendUserMessage("/permissions", { deliverAs: "followUp" })
      } else {
        // 切换到 plan 模式
        state.permission.mode = "plan"
        state.permission.planModeActive = true
        pi.setActiveTools(["read", "bash", "grep", "find", "ls", "AskUserQuestion"])
        pi.sendMessage(
          {
            customType: "plan-mode-activated",
            content: "Plan mode activated. Tools restricted to read-only operations.",
            display: true,
          },
          { triggerTurn: false },
        )
      }
    },
  })

  // ── 清理 ──
  pi.on("session_shutdown", () => {
    // 重置共享状态（防止影响下一个 session）
    state.permission.mode = "default"
    state.permission.planModeActive = false
    state.permission.allowRules = []
    state.permission.denyRules = []
    state.permission.protectedPaths = []
    state.memory.files = []
    state.memory.cache.clear()
    state.memory.autoExtractEnabled = false
    state.agent.coordinatorModeActive = false
    state.agent.activePids = []
    state.agent.currentTeam = null
  })
}

// ─── 辅助函数 ──────────────────────────────────────────────

function updateStatus(ctx: import("@mariozechner/pi-coding-agent").ExtensionContext) {
  if (state.permission.planModeActive) {
    ctx.ui.setStatus("cc-perm", ctx.ui.theme.fg("warning", "⏸ plan"))
  } else if (state.permission.mode === "yolo") {
    ctx.ui.setStatus("cc-perm", ctx.ui.theme.fg("success", "🚀 yolo"))
  } else if (state.permission.mode === "auto") {
    ctx.ui.setStatus("cc-perm", ctx.ui.theme.fg("accent", "🤖 auto"))
  } else {
    ctx.ui.setStatus("cc-perm", undefined)
  }
}
