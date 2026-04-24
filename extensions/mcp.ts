/**
 * pi-cc-mcp — Claude Code 兼容层 MCP 客户端扩展
 *
 * 职责：MCP 服务器连接管理 + 动态工具注册 + 资源发现 + 认证
 *
 * 与其他扩展的关系：完全独立，不读取共享状态。
 * MCP 工具注册后，core.ts 的 tool_call handler 会自动拦截它们。
 *
 * 注册的工具：mcp__<server>__<tool> （动态注册，连接时才生成）
 * 注册的命令：/mcp
 *
 * 配置文件（兼容 Claude Code 格式）：
 * - ~/.claude/mcp.json （全局）
 * - ./.claude/mcp.json （项目级）
 * 也支持 Pi 原生格式：
 * - ~/.pi/agent/mcp.json
 * - ./.pi/mcp.json
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"

export default function mcpExtension(pi: ExtensionAPI) {
  // TODO: initMCP(pi)

  pi.on("session_start", async (_event, ctx) => {
    // TODO: 读取 MCP 配置，连接服务器，动态注册工具
    // for (const [name, config] of Object.entries(mcpConfig.servers)) {
    //   await mcpManager.connect(name, config)
    //   for (const tool of mcpManager.getTools(name)) {
    //     pi.registerTool({ name: `mcp__${name}__${tool.name}`, ... })
    //   }
    // }
  })

  pi.on("session_shutdown", async () => {
    // TODO: mcpManager.disconnectAll()
  })

  pi.registerCommand("mcp", {
    description: "Manage MCP server connections",
    handler: async (_args, ctx) => {
      ctx.ui.notify("MCP management coming soon", "info")
    },
  })
}