/**
 * 扩展间共享状态 — Module Singleton Pattern
 *
 * 原理：Node.js 模块缓存保证同一进程中多次 import 得到同一对象。
 * 所有扩展 import 这个模块后，读写的是同一份状态，同步、零延迟。
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  对比三种方案                                             │
 * ├──────────────────────────────────────────────────────────┤
 * │  EventBus (当前)      │ 异步、不可靠、依赖加载顺序       │
 * │  合并为单扩展         │ 同步、可靠、但无法拆分            │
 * │  共享模块状态 (本文件) │ 同步、可靠、可拆分、零依赖加载顺序│
 * └──────────────────────────────────────────────────────────┘
 *
 * 优雅降级：
 * - 如果 core.ts 没加载，state 仍然是默认值，tools/agents 正常运行
 * - 如果只装 agents.ts，state.permissionMode 默认是 "default"，不影响使用
 * - 每个 extension 都可以独立工作，只是缺少 core 的高级功能
 */

import type { PermissionMode, SafetyLevel } from "./types.js"

// ─── 权限状态 ──────────────────────────────────────────────

export interface PermissionState {
  /** 当前权限模式 */
  mode: PermissionMode
  /** Plan 模式是否激活 */
  planModeActive: boolean
  /** 自定义权限规则 (从 .claude/settings.json 或 .pi/settings.json 加载) */
  allowRules: string[]
  denyRules: string[]
  /** 受保护路径 (edit/write 被拦截) */
  protectedPaths: string[]
  /** Bash 命令分类器 (可由 core.ts 动态注册) */
  bashClassifier: ((command: string) => SafetyLevel) | null
}

// ─── 记忆状态 ──────────────────────────────────────────────

export interface MemoryState {
  /** 已发现的记忆文件路径 */
  files: string[]
  /** 记忆内容缓存 (文件路径 → 内容) */
  cache: Map<string, string>
  /** 是否启用自动记忆提取 */
  autoExtractEnabled: boolean
}

// ─── Agent 状态 ────────────────────────────────────────────

export interface AgentState {
  /** Coordinator 模式是否激活 */
  coordinatorModeActive: boolean
  /** 活跃的子 Agent PID 列表 (用于 session_shutdown 清理) */
  activePids: number[]
  /** Team 信息 (如果当前在 team 中) */
  currentTeam: string | null
}

// ─── 全局共享状态 ──────────────────────────────────────────

export interface SharedState {
  permission: PermissionState
  memory: MemoryState
  agent: AgentState
}

/**
 * 全局单例 — 所有扩展通过 import 访问同一实例
 *
 * 初始值是安全的默认值，确保任何扩展独立安装都能正常工作：
 * - permission.mode = "default" → 正常权限模式
 * - memory.autoExtractEnabled = false → 不自动提取
 * - agent.coordinatorModeActive = false → 不开启 coordinator
 */
export const state: SharedState = {
  permission: {
    mode: "default",
    planModeActive: false,
    allowRules: [],
    denyRules: [],
    protectedPaths: [],
    bashClassifier: null,
  },
  memory: {
    files: [],
    cache: new Map(),
    autoExtractEnabled: false,
  },
  agent: {
    coordinatorModeActive: false,
    activePids: [],
    currentTeam: null,
  },
}
