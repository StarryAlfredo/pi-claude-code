# pi-claude-code 架构数据流

## 1. 整体架构：4 扩展 + 共享模块状态

```
                          Pi 进程（单一 Node.js 进程）
  ┌─────────────────────────────────────────────────────────────────────┐
  │                                                                     │
  │   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌────────┐│
  │   │  core.ts    │   │  tools.ts   │   │  agents.ts  │   │ mcp.ts ││
  │   │             │   │             │   │             │   │        ││
  │   │ 唯一写入者  │   │  只读       │   │  只读       │   │ 独立   ││
  │   │ 注册事件    │   │  注册工具   │   │  注册工具   │   │注册工具││
  │   │ 注册命令    │   │  注册事件   │   │  注册命令   │   │注册命令││
  │   │ 注册快捷键  │   │             │   │             │   │        ││
  │   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘   └───┬────┘│
  │          │                 │                 │              │     │
  │          │    import       │    import       │   import     │     │
  │          ▼                 ▼                 ▼              │     │
  │   ┌──────────────────────────────────────────────┐          │     │
  │   │              src/state.ts                     │          │     │
  │   │         Module Singleton（全局唯一实例）        │          │     │
  │   │                                              │          │     │
  │   │  ┌─────────────┐ ┌──────────┐ ┌───────────┐ │          │     │
  │   │  │ permission  │ │  memory  │ │   agent   │ │          │     │
  │   │  │ .mode       │ │ .files   │ │ .coordin..│ │          │     │
  │   │  │ .planActive │ │ .cache   │ │ .activePid│ │          │     │
  │   │  │ .allowRules │ │ .autoExt │ │ .currTeam │ │          │     │
  │   │  │ .denyRules  │ │          │ │           │ │          │     │
  │   │  │ .protectPath│ │          │ │           │ │          │     │
  │   │  │ .bashClassif│ │          │ │           │ │          │     │
  │   │  └─────────────┘ └──────────┘ └───────────┘ │          │     │
  │   └──────────────────────────────────────────────┘          │     │
  │                                                             │     │
  │          Pi ExtensionAPI                                     │     │
  │   ┌──────────────────────────────────────────────────┐      │     │
  │   │  pi.registerTool()  pi.registerCommand()         │      │     │
  │   │  pi.on("tool_call") pi.on("before_agent_start") │      │     │
  │   │  pi.on("turn_end")  pi.on("session_start")      │      │     │
  │   │  pi.setActiveTools() pi.sendUserMessage()        │      │     │
  │   └──────────────────────────────────────────────────┘      │     │
  └─────────────────────────────────────────────────────────────────────┘

  Node.js 模块缓存保证：4 个扩展 import state.ts 得到同一个对象引用
  core.ts 写入 state.permission.mode = "plan"
  tools.ts 下次读 state.permission.mode 立刻看到 "plan"——同步、零延迟
```

## 2. 权限系统数据流

```
用户输入 → Pi Agent → LLM 输出 tool_use
                            │
                            ▼
                ┌─────── tool_call 事件 ───────┐
                │  Pi 按扩展加载顺序依次调用      │
                │  每个扩展的 tool_call handler   │
                └───────────┬───────────────────┘
                            │
          ┌─────────────────┼─────────────────────┐
          ▼                 ▼                     ▼
   ┌──────────────┐  ┌──────────────┐      ┌──────────────┐
   │  core.ts     │  │  tools.ts   │      │  agents.ts   │
   │  handler #1  │  │  handler #2 │      │  handler #3  │
   │              │  │              │      │              │
   │ 读取:        │  │ 读取:        │      │ 读取:        │
   │ state.       │  │ state.       │      │ state.       │
   │ permission   │  │ permission   │      │ permission   │
   │              │  │              │      │              │
   │ ┌──────────┐ │  │ 只关心自己   │      │ 只关心自己   │
   │ │mode=plan?│ │  │ 注册的工具   │      │ 注册的工具   │
   │ │→block    │ │  │              │      │              │
   │ │edit/write│ │  │ 不拦截 →     │      │ 不拦截 →     │
   │ │          │ │  │ return      │      │ return      │
   │ │mode=     │ │  │ undefined   │      │ undefined   │
   │ │default?  │ │  └──────┬───────┘      └──────┬───────┘
   │ │→dangerous│ │         │                     │
   │ │ confirm  │ │         │                     │
   │ │          │ │         │                     │
   │ │mode=     │ │         │                     │
   │ │yolo?     │ │         │                     │
   │ │→放行     │ │         │                     │
   │ └──────────┘ │         │                     │
   └──────┬───────┘         │                     │
          │                 │                     │
          ▼                 ▼                     ▼
   block=true?         不处理                  不处理
   │        │
   │ 否     │ 是
   ▼        ▼
 工具执行  返回 { block: true, reason: "..." }
                  → LLM 收到拒绝消息
```

## 3. Plan 模式数据流

```
用户按 Ctrl+Alt+P 或输入 /permissions 选择 "plan"
        │
        ▼
   core.ts handler
        │
        ├── 1. state.permission.mode = "plan"
        │      state.permission.planModeActive = true
        │
        ├── 2. pi.setActiveTools(["read","bash","grep","find","ls","AskUserQuestion"])
        │      → Pi 立即切换工具集，LLM 下一次调用只能看到这些工具
        │
        ├── 3. ctx.ui.setStatus("cc-perm", "⏸ plan")
        │      → 底部状态栏显示 Plan 模式标记
        │
        └── 4. 后续每次 before_agent_start 事件：
               │
               ▼
        ┌──────────────────────────────────────────────┐
        │  core.ts before_agent_start handler          │
        │                                              │
        │  读取 state.permission.planModeActive        │
        │       │                                      │
        │       ▼ true                                 │
        │  return {                                    │
        │    systemPrompt: event.systemPrompt +        │
        │      "\n\n[PLAN MODE ACTIVE]\n..."           │
        │  }                                           │
        │       │                                      │
        │       ▼                                      │
        │  Pi 把追加的 system prompt 发给 LLM           │
        │  LLM 知道自己处于 Plan 模式，只做分析不做修改  │
        └──────────────────────────────────────────────┘

退出 Plan 模式：
  用户输入 /permissions 选择其他模式
        │
        ▼
  state.permission.mode = "default"（或 yolo/auto）
  state.permission.planModeActive = false
  pi.setActiveTools(["read","bash","edit","write","grep","find","ls","AskUserQuestion",...])
  ctx.ui.setStatus("cc-perm", undefined)  → 清除状态栏
```

## 4. 记忆系统数据流

```
┌── session_start 事件 ──────────────────────────────────────────────┐
│                                                                     │
│  core.ts handler                                                   │
│     │                                                               │
│     ├── 扫描记忆文件:                                               │
│     │   ~/.pi/agent/PI.md        (用户级)                          │
│     │   ./PI.md                  (项目级, git tracked)             │
│     │   ./PI.local.md            (项目级, gitignored)              │
│     │                                                               │
│     ├── state.memory.files = [找到的文件路径]                       │
│     │   state.memory.cache = Map<路径, 内容>                       │
│     │                                                               │
│     └── updateStatus(ctx)                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌── before_agent_start 事件（每次 LLM 调用前）─────────────────────┐
│                                                                     │
│  core.ts handler                                                   │
│     │                                                               │
│     ├── 读取 state.memory.files + state.memory.cache                │
│     │                                                               │
│     ├── 拼接记忆内容到 system prompt 尾部:                           │
│     │   return {                                                    │
│     │     systemPrompt: event.systemPrompt +                        │
│     │       "\n\n## Memory Files\n### PI.md\n{内容}..."             │
│     │   }                                                           │
│     │                                                               │
│     └── LLM 看到记忆内容，据此调整行为                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌── turn_end 事件（每轮对话结束后）────────────────────────────────┐
│                                                                     │
│  core.ts handler                                                   │
│     │                                                               │
│     ├── state.memory.autoExtractEnabled?                            │
│     │       │                                                       │
│     │       ▼ false → 跳过                                         │
│     │       ▼ true  → 检查阈值                                     │
│     │               │                                               │
│     │               ▼ 超过阈值                                      │
│     │          spawn 子进程:                                         │
│     │          pi --mode json                                       │
│     │             --tools edit                                      │
│     │             --append-system-prompt "提取记忆..."               │
│     │             --no-session                                      │
│     │                                                               │
│     │          子进程读取对话历史，提取关键事实                       │
│     │          用 FileEdit 工具写入 PI.md 或新建 memory/*.md         │
│     │                                                               │
│     └── 下次 session_start 或 before_agent_start 时                 │
│        重新扫描，新记忆自动注入                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 5. 子 Agent 数据流（agents.ts）

```
LLM 调用 Agent 工具
        │
        ▼
agents.ts AgentTool.execute()
        │
        ├── 1. 从 state 读取当前状态（同步，零延迟）
        │      const appendPrompt = [
        │        `Permission mode: ${state.permission.mode}`,
        │        `Plan mode: ${state.permission.planModeActive}`,
        │        `Memory files: ${state.memory.files.join(",")}`,
        │        state.agent.coordinatorModeActive
        │          ? "You are a worker in a coordinator pattern..."
        │          : "",
        │      ].filter(Boolean).join("\n")
        │
        ├── 2. spawn 子进程
        │      const proc = spawn("pi", [
        │        "--mode", "json",
        │        "--append-system-prompt", appendPrompt,
        │        "--tools", "read,bash,edit,write",
        │        "Task: " + params.prompt,
        │      ])
        │
        │      子进程是独立的 Pi 实例:
        │      ┌──────────────────────────────────────────┐
        │      │  子 Pi 进程                              │
        │      │  - 独立上下文窗口（不污染父进程）        │
        │      │  - 通过 --append-system-prompt 继承状态  │
        │      │  - 会重新加载 settings.json 中的扩展     │
        │      │  - 但不共享父进程的内存/state            │
        │      │                                         │
        │      │  JSON 事件流 → stdout:                   │
        │      │    { type: "message_end", message: ... } │
        │      │    { type: "tool_result_end", ... }      │
        │      └──────────────────────────────────────────┘
        │
        ├── 3. 注册 PID 到 state.agent.activePids
        │      → session_shutdown 时统一 kill
        │
        └── 4. 收集子进程输出，返回给 LLM
               最终 assistant text 作为 Agent 工具的 result
```

## 6. MCP 数据流（mcp.ts）

```
┌── session_start 事件 ──────────────────────────────────────────────┐
│                                                                     │
│  mcp.ts handler                                                   │
│     │                                                               │
│     ├── 读取配置文件:                                               │
│     │   ~/.claude/mcp.json   (Claude Code 格式)                    │
│     │   ./.claude/mcp.json   (项目级)                              │
│     │   ~/.pi/agent/mcp.json (Pi 原生格式)                          │
│     │   ./.pi/mcp.json       (项目级)                              │
│     │                                                               │
│     ├── 对每个 server 配置:                                         │
│     │   ┌───────────────────────────────────────────┐               │
│     │   │  connectToServer(name, config)            │               │
│     │   │                                          │               │
│     │   │  根据 type 选择传输:                      │               │
│     │   │    stdio → StdioClientTransport           │               │
│     │   │    sse   → SSEClientTransport             │               │
│     │   │    ws    → WebSocketTransport             │               │
│     │   │    http  → StreamableHTTPTransport        │               │
│     │   │                                          │               │
│     │   │  认证:                                   │               │
│     │   │    OAuth / API Key / 无认证               │               │
│     │   └───────────────────────────────────────────┘               │
│     │                                                               │
│     ├── 动态注册工具:                                               │
│     │   for (const tool of server.tools) {                          │
│     │     pi.registerTool({                                         │
│     │       name: `mcp__${serverName}__${tool.name}`,               │
│     │       description: truncate(tool.description, 2048),          │
│     │       parameters: tool.inputSchema,                           │
│     │       execute: (id, params, signal, onUpdate, ctx) => {       │
│     │         return mcpManager.callTool(serverName, tool.name,      │
│     │                                  params, signal)              │
│     │       }                                                       │
│     │     })                                                        │
│     │   }                                                           │
│     │                                                               │
│     └── Pi 自动将新工具写入 system prompt 的 Available tools 区域    │
│        LLM 下一次调用就能看到 mcp__* 工具                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

LLM 调用 mcp__filesystem__read_file
        │
        ▼
┌──── tool_call 事件 ─────────────────────────────────────────────┐
│                                                                  │
│  core.ts handler  ──→ 检查权限 → 不拦截（MCP 工具不在黑名单）  │
│                                                                  │
└──── tool 实际执行 ──────────────────────────────────────────────┘
        │
        ▼
  mcp.ts 注册的 execute handler
        │
        ├── mcpManager.callTool("filesystem", "read_file", params)
        │      │
        │      ▼
        │   MCP JSON-RPC 请求 → MCP Server 子进程/远程
        │      │
        │      ▼
        │   MCP Server 返回结果
        │
        └── 返回 { content: [...], details: {...} }
              → LLM 收到工具结果
```

## 7. 独立安装场景

```
场景 A: 全部安装（默认）
┌──────────────────────────────────────────┐
│  settings.json packages:                │
│  "pi-claude-code"                       │
│                                          │
│  core.ts  → 写入 state + 权限拦截       │
│  tools.ts → 读 state + 注册工具         │
│  agents.ts → 读 state + 子 Agent        │
│  mcp.ts  → 独立 + MCP 工具              │
│                                          │
│  全功能可用                               │
└──────────────────────────────────────────┘

场景 B: 只装 agents（给别的项目用）
┌──────────────────────────────────────────┐
│  settings.json packages:                │
│  { source: "pi-claude-code",            │
│    extensions: ["./extensions/agents"] } │
│                                          │
│  agents.ts → import state.ts             │
│  state.permission.mode = "default" (默认)│
│  state.agent.coordinatorModeActive=false │
│                                          │
│  ✅ 子 Agent 正常工作                    │
│  ❌ 没有 /permissions 命令               │
│  ❌ 没有 Plan 模式切换                   │
│  ❌ 没有记忆注入                         │
│  → 合理降级，不是崩溃                    │
└──────────────────────────────────────────┘

场景 C: 只装 tools + mcp（只要工具能力）
┌──────────────────────────────────────────┐
│  settings.json packages:                │
│  { source: "pi-claude-code",            │
│    extensions: [                         │
│      "./extensions/tools",              │
│      "./extensions/mcp"                 │
│    ] }                                  │
│                                          │
│  tools.ts → AskUserQuestion 等           │
│  mcp.ts → MCP 工具                      │
│  state 默认值，无权限拦截                │
│                                          │
│  ✅ 工具正常工作                         │
│  ❌ 所有操作自动放行（无 core 拦截）     │
│  → 类似 Claude Code 的 yolo 模式         │
└──────────────────────────────────────────┘

场景 D: 开关验证单一功能
┌──────────────────────────────────────────┐
│  命令行:                                 │
│  pi -e ./extensions/tools.ts             │
│                                          │
│  只加载 tools 扩展                       │
│  → 验证 AskUserQuestion 是否正常         │
│  → 不受其他扩展干扰                      │
└──────────────────────────────────────────┘
```

## 8. 事件流时序图

```
时间 ──────────────────────────────────────────────────────────────────▶

Pi 启动
  │
  ├─ 加载 core.ts    ── import state.ts ── state.permission.bashClassifier = classifyBashCommand
  ├─ 加载 tools.ts   ── import state.ts ── (读，看到 bashClassifier 已被 core 设置)
  ├─ 加载 agents.ts  ── import state.ts ── (读)
  └─ 加载 mcp.ts     ── (不 import state)

session_start
  │
  ├─ core.ts:  读取 CLI 标志 → 写入 state.permission.mode
  │            扫描记忆文件 → 写入 state.memory.files / cache
  │            更新 UI 状态
  │
  ├─ tools.ts: (无 handler)
  │
  ├─ agents.ts: (无 handler)
  │
  └─ mcp.ts:   读取 mcp.json → 连接服务器 → pi.registerTool(mcp__*__)

用户输入 → LLM 输出 tool_use
  │
  ├─ before_agent_start (core.ts)
  │    读取 state.permission.planModeActive → 追加 system prompt
  │    读取 state.memory.cache → 追加记忆内容
  │
  ├─ tool_call (core.ts → tools.ts → agents.ts，链式调用)
  │    core:    读取 state.permission → 检查权限 → block 或放行
  │    tools:   不拦截 → return undefined
  │    agents:  不拦截 → return undefined
  │
  ├─ tool 执行 → 返回结果
  │
  └─ turn_end (core.ts)
       读取 state.memory.autoExtractEnabled → 决定是否提取记忆

session_shutdown
  │
  ├─ core.ts:    重置 state 所有字段为默认值
  ├─ agents.ts:  kill state.agent.activePids 中的子进程
  └─ mcp.ts:    断开所有 MCP 服务器连接
```
