/**
 * pi-cc-mcp — Claude Code 兼容层 MCP 客户端扩展
 *
 * 职责：MCP 服务器连接管理 + 动态工具注册 + 资源发现 + 认证
 * 依赖：无（完全独立，不依赖其他 pi-cc-* 扩展）
 *
 * 注册的工具：mcp__<server>__<tool> （动态注册，连接时才生成）
 * 注册的命令：/mcp
 *
 * 配置文件（兼容 Claude Code 格式）：
 * - ~/.claude/mcp.json （全局）
 * - ./.claude/mcp.json （项目级）
 *
 * 也支持 Pi 原生格式：
 * - ~/.pi/agent/mcp.json
 * - ./.pi/mcp.json
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function mcpExtension(pi: ExtensionAPI) {
  // TODO: 初始化 MCP 管理器
  // import { initMCP } from '../src/mcp/manager'
  // initMCP(pi)

  // 在 session_start 时连接配置的 MCP 服务器
  pi.on("session_start", async (_event, ctx) => {
    // TODO: 读取 MCP 配置，连接服务器，动态注册工具
    // for (const [name, config] of Object.entries(mcpConfig.servers)) {
    //   await mcpManager.connect(name, config)
    //   for (const tool of mcpManager.getTools(name)) {
    //     pi.registerTool({ name: `mcp__${name}__${tool.name}`, ... })
    //   }
    // }
  });

  // 在 session_shutdown 时断开所有连接
  pi.on("session_shutdown", async () => {
    // TODO: mcpManager.disconnectAll()
  });

  // 注册 /mcp 命令
  pi.registerCommand("mcp", {
    description: "Manage MCP server connections",
    handler: async (_args, ctx) => {
      ctx.ui.notify("MCP management coming soon", "info");
    },
  });
}
