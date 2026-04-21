/**
 * pi-cc-core — Claude Code 兼容层核心扩展
 *
 * 职责：权限系统 + 记忆系统 + Hooks 系统 + Slash 命令
 * 这是所有其他 pi-cc-* 扩展的基础设施层，必须第一个加载。
 *
 * 注册的工具：无（权限通过 tool_call 事件拦截，不注册工具）
 * 注册的命令：/permissions, /memory, /hooks, /doctor, /cost
 * 注册的事件：tool_call（权限拦截）、turn_end（记忆提取）、before_agent_start（模式注入）
 * 注册的快捷键：Ctrl+Alt+P（切换 Plan 模式）
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function coreExtension(pi: ExtensionAPI) {
  // TODO: 初始化权限系统
  // import { initPermissions } from '../src/permissions'
  // initPermissions(pi)

  // TODO: 初始化记忆系统
  // import { initMemory } from '../src/memory'
  // initMemory(pi)

  // TODO: 初始化 Hooks 系统
  // import { initHooks } from '../src/hooks'
  // initHooks(pi)

  // TODO: 注册 Slash 命令
  // /permissions - 权限模式管理
  // /memory      - 记忆文件管理
  // /hooks       - Hook 配置管理
  // /doctor      - 诊断工具
  // /cost        - 费用统计

  // TODO: 注册快捷键
  // Ctrl+Alt+P - 切换 Plan 模式

  // TODO: 注册 CLI 标志
  // --yolo  - 启动时使用 YOLO 权限模式
  // --plan  - 启动时使用 Plan 模式

  // 共享状态查询 API（通过 EventBus）
  pi.events.on("cc:get-state", (data: any) => {
    data.result = {
      permissionMode: "default",
      planModeActive: false,
      coordinatorModeActive: false,
      memoryFiles: [],
    };
  });

  pi.events.on("cc:set-permission-mode", (data: any) => {
    // TODO: 切换权限模式，通知其他扩展
    pi.events.emit("cc:permission-mode-changed", { mode: data.mode });
  });
}
