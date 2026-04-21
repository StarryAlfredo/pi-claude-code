# pi-claude-code

> **Claude Code compatibility layer for [Pi](https://github.com/badlogic/pi-mono)**
>
> 将 Claude Code 的核心能力（权限系统、记忆系统、Web 工具、LSP、多 Agent 协作、MCP 客户端等）以 Pi 扩展的形式实现，让你在 Pi 中获得 Claude Code 的一致体验。

---

## 架构概览

```
pi-claude-code/
├── extensions/              ← Pi 自动发现的扩展入口（4 个独立扩展）
│   ├── core.ts              ← pi-cc-core:  权限 + 记忆 + Hooks + 命令（基础设施层）
│   ├── tools.ts             ← pi-cc-tools:  Web/LSP/Todo/Plan/AskUser/Notebook/Worktree
│   ├── agents.ts            ← pi-cc-agents: Agent/Task/Team/Coordinator/Batch
│   └── mcp.ts               ← pi-cc-mcp:   MCP 客户端（动态工具注册）
│
├── src/                     ← 共享源码（被 extensions/ 引用）
│   ├── permissions/         ← 权限系统
│   │   ├── classifier.ts       Bash 命令安全分类（read/write/dangerous）
│   │   ├── rules.ts            权限规则解析（.claude/settings.json）
│   │   ├── modes.ts            权限模式管理（default/plan/yolo/auto）
│   │   └── path-validator.ts   路径验证（防止路径遍历）
│   │
│   ├── memory/              ← 记忆系统
│   │   ├── manager.ts          记忆文件管理（PI.md / PI.local.md）
│   │   └── extractor.ts        自动记忆提取（从对话中提取事实）
│   │
│   ├── hooks/               ← Hooks 系统
│   │   ├── config.ts           Hook 配置解析（.claude/hooks.json → Pi 事件）
│   │   └── runner.ts           Hook 执行器
│   │
│   ├── tools/               ← 工具实现
│   │   ├── web-fetch.ts        WebFetch 工具
│   │   ├── web-search.ts       WebSearch 工具
│   │   ├── lsp.ts              LSP 工具
│   │   ├── lsp-client.ts       LSP JSON-RPC 客户端
│   │   ├── lsp-server-manager.ts LSP 服务器生命周期管理
│   │   ├── todo.ts             TodoWrite 工具
│   │   ├── plan-mode.ts        Plan Mode 工具（enter/exit_plan_mode）
│   │   ├── ask-user.ts         AskUser 工具
│   │   ├── notebook-edit.ts    NotebookEdit 工具
│   │   └── worktree.ts         Git Worktree 工具
│   │
│   ├── agents/              ← 多 Agent 协作
│   │   ├── agent-tool.ts       Agent 工具（spawn 子进程）
│   │   ├── process-manager.ts  Agent 进程管理
│   │   ├── color-manager.ts    Agent 颜色区分
│   │   ├── task-tools.ts       Task CRUD 工具
│   │   ├── team-tools.ts       Team 工具
│   │   ├── send-message.ts     Agent 间消息传递
│   │   └── coordinator.ts      Coordinator 模式
│   │
│   ├── mcp/                 ← MCP 客户端
│   │   ├── manager.ts           MCP 连接管理器
│   │   ├── config.ts            MCP 配置解析（兼容 .claude/mcp.json）
│   │   └── auth.ts              MCP 认证
│   │
│   ├── utils/               ← 通用工具
│   │   └── truncate.ts          输出截断
│   │
│   └── types/               ← 共享类型
│       └── index.ts             PermissionMode, SharedState, etc.
│
├── skills/                  ← Pi 技能（SKILL.md）
│   ├── batch/                  批量并行工作编排
│   ├── remember/               记忆保存
│   └── debug/                  调试辅助
│
├── prompts/                 ← Pi 提示模板
│   └── claude-code-system.md   Claude Code 兼容系统提示
│
├── config/                  ← 默认配置文件
├── tests/                   ← 测试
├── docs/                    ← 文档
│
├── package.json             ← Pi Package manifest（pi 字段是发现机制的关键）
├── tsconfig.json
└── README.md
```

---

## 4 个扩展的职责和协作

### 扩展加载顺序（重要！）

Pi 按 `settings.json` 中的配置顺序加载扩展。**core 必须第一个加载。**

```
core.ts → tools.ts → agents.ts → mcp.ts
```

### 扩展间通信

```
┌─────────────┐     EventBus 查询      ┌─────────────┐
│  pi-cc-core │ ◄────────────────────── │ pi-cc-tools │
│  (状态中枢)  │                        │ pi-cc-agents│
│             │ ────── 权限拦截 ───────► │ pi-cc-mcp   │
└─────────────┘    (tool_call 事件)      └─────────────┘
```

| 通信机制 | 用途 | 示例 |
|---------|------|------|
| **tool_call 事件** | 权限拦截 | core 拦截所有扩展的工具调用 |
| **before_agent_start** | System Prompt 修改 | core 注入权限模式，agents 注入 Coordinator 提示 |
| **EventBus** | 跨扩展状态查询 | agents 查询 core 的权限模式 |
| **--append-system-prompt** | 子进程状态传递 | agents spawn 子 Agent 时注入权限/记忆上下文 |
| **CustomEntry** | 持久化共享状态 | core 写入权限模式到 session entries |

---

## 安装

### 方式 1：从 GitHub 安装（推荐）

```bash
pi install git:github.com/Alfredo/pi-claude-code
```

### 方式 2：本地开发路径

在 `~/.pi/agent/settings.json` 中添加：

```json
{
  "packages": ["D:/dev/pi-claude-code"]
}
```

修改代码后在 Pi 中执行 `/reload` 即可生效。

### 方式 3：临时测试

```bash
pi -e D:/dev/pi-claude-code
```

### 方式 4：选择性安装

只安装部分扩展（使用 Package Filtering）：

```json
{
  "packages": [{
    "source": "git:github.com/Alfredo/pi-claude-code",
    "extensions": ["extensions/core.ts", "extensions/tools.ts"]
  }]
}
```

---

## 功能对照表

### Claude Code → Pi 扩展映射

| Claude Code 能力 | Pi 扩展 | 状态 |
|-----------------|---------|------|
| **权限系统** (default/plan/yolo/auto) | pi-cc-core | 🔲 待实现 |
| **记忆系统** (CLAUDE.md) | pi-cc-core | 🔲 待实现 |
| **Hooks 系统** | pi-cc-core | 🔲 待实现 |
| **/permissions, /memory, /hooks, /doctor, /cost** | pi-cc-core | 🔲 待实现 |
| **WebFetch** | pi-cc-tools | 🔲 待实现 |
| **WebSearch** | pi-cc-tools | 🔲 待实现 |
| **LSP 集成** | pi-cc-tools | 🔲 待实现 |
| **TodoWrite** | pi-cc-tools | 🔲 待实现 |
| **Plan Mode** (enter/exit_plan_mode) | pi-cc-tools | 🔲 待实现 |
| **AskUser** | pi-cc-tools | 🔲 待实现 |
| **NotebookEdit** | pi-cc-tools | 🔲 待实现 |
| **Git Worktree** | pi-cc-tools | 🔲 待实现 |
| **AgentTool** (子 Agent 调度) | pi-cc-agents | 🔲 待实现 |
| **Task 管理** (create/get/list/output/stop/update) | pi-cc-agents | 🔲 待实现 |
| **Team 协作** (create/delete/send_message) | pi-cc-agents | 🔲 待实现 |
| **Coordinator Mode** | pi-cc-agents | 🔲 待实现 |
| **Batch 技能** | pi-cc-agents | 🔲 待实现 |
| **MCP 客户端** | pi-cc-mcp | 🔲 待实现 |
| **MCP 动态工具注册** | pi-cc-mcp | 🔲 待实现 |
| **MCP 认证** | pi-cc-mcp | 🔲 待实现 |

### Pi 已有内置能力（不需要扩展实现）

| 能力 | Pi 内置方式 |
|------|------------|
| 文件读写编辑 | read, edit, write 工具 |
| Bash 执行 | bash 工具 |
| 文件搜索 | find, grep, ls 工具 |
| 上下文压缩 | compact 命令 + 自动压缩 |
| 会话管理 | SessionManager (创建/恢复/分支/导航) |
| 模型切换 | Ctrl+P / /model |
| System Prompt | before_agent_start 事件 |
| 扩展系统 | pi.registerTool() / pi.on() / pi.registerCommand() |
| 主题 | themes 系统 |
| 技能 | skills 系统 (SKILL.md) |
| Prompt 模板 | prompts 系统 |

---

## 开发指南

### 环境准备

```bash
cd D:/dev/pi-claude-code
npm install   # 安装依赖（后续添加）
```

### 开发流程

1. 在 `src/` 下实现功能模块
2. 在 `extensions/` 下的入口文件中导入并注册
3. 执行 `/reload` 重新加载扩展
4. 测试功能

### Pi 官方可复用示例

| Pi 示例 | 对应功能 | 路径 |
|---------|---------|------|
| subagent | AgentTool | `pi examples/extensions/subagent/` |
| plan-mode | Plan Mode | `pi examples/extensions/plan-mode/` |
| permission-gate | 权限拦截 | `pi examples/extensions/permission-gate.ts` |
| sandbox | 沙箱模式 | `pi examples/extensions/sandbox/` |
| todo | TodoWrite | `pi examples/extensions/todo.ts` |
| claude-rules | 记忆系统 | `pi examples/extensions/claude-rules.ts` |

### 实现优先级

1. **Phase 1** — `core.ts`: 权限系统 + 记忆系统（其他扩展都依赖它）
2. **Phase 2** — `tools.ts`: Web 工具 + Todo + Plan Mode + AskUser
3. **Phase 3** — `agents.ts`: AgentTool + Task + Coordinator（最复杂）
4. **Phase 4** — `mcp.ts`: MCP 客户端

---

## 配置文件兼容性

本扩展兼容 Claude Code 的配置文件格式：

| Claude Code 配置 | Pi 路径 | 说明 |
|-----------------|---------|------|
| `.claude/settings.json` | `.pi/settings.json` | 权限规则、工具配置 |
| `.claude/mcp.json` | `.pi/mcp.json` | MCP 服务器配置 |
| `.claude/hooks.json` | — | Hook 配置（映射到 Pi 事件） |
| `CLAUDE.md` | `PI.md` | 项目级记忆 |
| `CLAUDE.local.md` | `PI.local.md` | 本地记忆（gitignored） |
| `.claude/rules/` | `.pi/context/` | 规则/上下文文件 |

---

## License

MIT
