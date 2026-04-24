/**
 * pi-cc-agents — Claude Code 兼容层多 Agent 协作扩展
 *
 * 职责：子 Agent 调度 + 任务管理 + 团队协作 + Coordinator 模式
 *
 * 与 core.ts 的关系：
 * - 读取 state.permission.mode 决定子 Agent 的权限继承
 * - 读取 state.permission.planModeActive 决定是否限制子 Agent 为只读
 * - 可以独立安装，不依赖 core.ts
 *
 * 注册的工具：agent, task_create, task_get, task_list, task_output,
 *             task_stop, task_update, team_create, team_delete,
 *             send_message, enter_coordinator, exit_coordinator
 * 注册的命令：/agents, /tasks, /batch
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { state } from "../src/state.js"

export default function agentsExtension(pi: ExtensionAPI) {
  // TODO: registerAgentTool(pi)
  // TODO: registerTaskTools(pi)
  // TODO: registerTeamTools(pi)
  // TODO: registerSendMessage(pi)
  // TODO: registerCoordinator(pi)

  // 子 Agent spawn 时，通过 --append-system-prompt 传递共享状态
  // 例如：`pi --mode json --append-system-prompt "Permission mode: ${state.permission.mode}"`
  // 这样子进程不需要知道父进程的内存状态

  // 清理子进程
  pi.on("session_shutdown", () => {
    for (const pid of state.agent.activePids) {
      try {
        process.kill(pid, "SIGTERM")
      } catch {
        // 进程可能已退出
      }
    }
    state.agent.activePids = []
  })
}