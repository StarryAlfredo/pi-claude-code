/**
 * pi-cc-agents — Claude Code 兼容层多 Agent 协作扩展
 *
 * 职责：子 Agent 调度 + 任务管理 + 团队协作 + Coordinator 模式
 * 依赖：pi-cc-core（可选，用于查询权限模式和注入子 Agent 上下文）
 *
 * 注册的工具：agent, task_create, task_get, task_list, task_output,
 *             task_stop, task_update, team_create, team_delete,
 *             send_message, enter_coordinator, exit_coordinator
 *
 * 注册的命令：/agents, /tasks, /batch
 *
 * 注意：子 Agent 通过 spawn pi 子进程实现，子进程会重新加载
 * settings.json 中的扩展，但不共享父进程的内存状态。
 * 通过 --append-system-prompt 传递关键状态（权限模式、记忆路径等）。
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function agentsExtension(pi: ExtensionAPI) {
  // TODO: 注册 Agent 工具
  // import { registerAgentTool } from '../src/agents/agent-tool'
  // registerAgentTool(pi)

  // TODO: 注册 Task 管理工具
  // import { registerTaskTools } from '../src/agents/task-tools'
  // registerTaskTools(pi)

  // TODO: 注册 Team 工具
  // import { registerTeamTools } from '../src/agents/team-tools'
  // registerTeamTools(pi)

  // TODO: 注册 SendMessage 工具
  // import { registerSendMessage } from '../src/agents/send-message'
  // registerSendMessage(pi)

  // TODO: 注册 Coordinator 模式
  // import { registerCoordinator } from '../src/agents/coordinator'
  // registerCoordinator(pi)

  // TODO: 注册命令
  // /agents - 查看/管理 Agent
  // /tasks  - 查看/管理任务
  // /batch  - 批量并行执行

  // 清理子进程
  pi.on("session_shutdown", () => {
    // TODO: killAllAgents()
  });
}
