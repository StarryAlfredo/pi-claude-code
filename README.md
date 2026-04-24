# pi-claude-code

> **Claude Code compatibility layer for [Pi](https://github.com/badlogic/pi-mono)**
>
> 将 Claude Code 的核心能力（权限系统、记忆系统、Web 工具、LSP、多 Agent 协作、MCP 客户端等）以 Pi 扩展的形式实现，让你在 Pi 中获得 Claude Code 的一致体验。

---

## 架构概览

```
pi-claude-code/
├── extensions/              ← Pi 自动发现的扩展入口（4 个可独立安装的扩展）
│   ├── core.ts              ← 权限拦截 + 记忆注入 + Hooks + 命令
│   ├── tools.ts             ← Web/LSP/Todo/Plan/AskUser/Notebook/Worktree
│   ├── agents.ts            ← Agent/Task/Team/Coordinator/Batch
│   └── mcp.ts               ← MCP 客户端（动态工具注册）
│
├── src/                     ← 共享源码（被 extensions/ 引用）
│   ├── state.ts             ← ★ 扩展间共享状态（Module Singleton Pattern）
│   ├── types.ts             ← 共享类型（PermissionMode, SafetyLevel 等）
│   ├── tools/
│   │   └── ask-user.ts         AskUserQuestion 工具 ✅
│   ├── permissions/         ← （待实现）
│   ├── memory/              ← （待实现）
│   ├── hooks/               ← （待实现）
│   ├── agents/              ← （待实现）
│   ├── mcp/                 ← （待实现）
│   └── utils/               ← （待实现）
│
├── skills/remember/         ← /remember 技能
├── package.json             ← Pi Package manifest
└── tsconfig.json
```

---

## 扩展间通信：共享模块状态

4 个扩展运行在同一个 Node.js 进程中，通过 **Module Singleton Pattern** 共享状态：

```
┌──────────────────────────────────────────────────────┐
│                  src/state.ts                        │
│          （Node.js 模块缓存 → 同一对象实例）           │
│                                                      │
│  state.permission  ← core 写入，tools/agents 读取    │
│  state.memory      ← core 写入，tools/agents 读取    │
│  state.agent       ← agents 写入，core 读取          │
└──────────────────────────────────────────────────────┘
         ▲ import        ▲ import        ▲ import
         │               │               │
    core.ts          tools.ts        agents.ts
```

### 为什么不用 EventBus？

| 方案 | 一致性 | 速度 | 依赖加载顺序 | 独立安装 |
|------|--------|------|-------------|---------|
| ~~EventBus~~ | ❌ 异步 | ❌ 微任务延迟 | ❌ core 必须先加载 | ❌ 拆了就失效 |
| 合并为单扩展 | ✅ 同步 | ✅ 即时 | ✅ 无依赖 | ❌ 不可拆分 |
| **共享模块状态** | ✅ 同步 | ✅ 即时 | ✅ 无依赖 | ✅ 默认值安全降级 |

### 优雅降级

- 只装 `tools.ts`？→ `state.permission.mode` 默认 `"default"`，工具正常运行
- 只装 `agents.ts`？→ 同上，子 Agent 不受 Plan 模式限制但功能完整
- 装了 `core.ts`？→ 完整权限拦截 + Plan 模式 + 记忆注入

---

## 4 个扩展的职责

### 无加载顺序依赖

4 个扩展可以按任意顺序加载，也可以单独安装。

- **core.ts** 是唯一写入共享状态的扩展（权限模式、记忆内容等）
- **tools.ts / agents.ts / mcp.ts** 只读取共享状态
- 如果 core.ts 没装，共享状态保持默认值，其他扩展仍然正常工作

### 扩展间通信方式

| 通信机制 | 用途 | 示例 |
|---------|------|------|
| **src/state.ts** | 跨扩展同步状态共享 | core 写 `state.permission.mode = "plan"`，tools 立刻读到 |
| **tool_call 事件** | 权限拦截 | core 拦截所有扩展的工具调用 |
| **before_agent_start** | System Prompt 修改 | core 注入权限模式 + 记忆内容 |
| **--append-system-prompt** | 子进程状态传递 | agents spawn 子 Agent 时注入 `state.permission.mode` |

---

## 安装

### 方式 1：从 GitHub 安装（推荐）

```bash
pi install git:github.com/StarryAlfredo/pi-claude-code
```

### 方式 2：本地开发路径

在 `~/.pi/agent/settings.json` 中添加：

```json
{
  "packages": ["G:/pi-claude-code"]
}
```

修改代码后在 Pi 中执行 `/reload` 即可生效。

### 方式 3：临时测试

```bash
pi -e G:/pi-claude-code
```

### 方式 4：选择性安装

只安装部分扩展（使用 Package Filtering）：

```json
{
  "packages": [{
    "source": "git:github.com/StarryAlfredo/pi-claude-code",
    "extensions": ["extensions/core.ts", "extensions/tools.ts"]
  }]
}
```

只要 agents 不需要？只装 agents：

```json
{
  "packages": [{
    "source": "git:github.com/StarryAlfredo/pi-claude-code",
    "extensions": ["extensions/agents.ts"]
  }]
}
```

---

## 功能对照表

| Claude Code 能力 | Pi 扩展 | 状态 |
|-----------------|---------|------|
| **权限系统** (default/plan/yolo/auto) | core | 🟡 部分实现 |
| **记忆系统** (PI.md) | core | 🟡 部分实现 |
| **Hooks 系统** | core | 🔲 待实现 |
| **/permissions, /memory** | core | 🟡 已实现 |
| **/hooks, /doctor, /cost** | core | 🔲 待实现 |
| **Plan Mode** (Ctrl+Alt+P + /permissions) | core | 🟡 部分实现 |
| **AskUser** | tools | ✅ 已实现 |
| **WebFetch** | tools | 🔲 待实现 |
| **WebSearch** | tools | 🔲 待实现 |
| **LSP 集成** | tools | 🔲 待实现 |
| **TodoWrite** | tools | 🔲 待实现 |
| **NotebookEdit** | tools | 🔲 待实现 |
| **Git Worktree** | tools | 🔲 待实现 |
| **AgentTool** (子 Agent 调度) | agents | 🔲 待实现 |
| **Task 管理** (create/get/list/output/stop/update) | agents | 🔲 待实现 |
| **Team 协作** (create/delete/send_message) | agents | 🔲 待实现 |
| **Coordinator Mode** | agents | 🔲 待实现 |
| **Batch 技能** | agents | 🔲 待实现 |
| **MCP 客户端** | mcp | 🔲 待实现 |
| **MCP 动态工具注册** | mcp | 🔲 待实现 |
| **MCP 认证** | mcp | 🔲 待实现 |

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
| Prompt 模板 | prompts 系统 + promptSnippet/promptGuidelines 自动注入 |
| 权限拦截 | tool_call 事件 (block + input mutation) |
| 工具动态切换 | pi.setActiveTools() |
| OS 级 Sandbox | @anthropic-ai/sandbox-runtime (Pi sandbox 示例) |

---

## 已实现功能详情

### 权限系统（core.ts）

- **4 种模式**：default（危险命令需确认）、plan（只读）、yolo（全放行）、auto（LLM 自行决定）
- **Bash 命令分类**：dangerous（rm -rf, sudo 等）/ write（mkdir, git commit 等）/ read
- **Plan 模式**：`/permissions` 或 Ctrl+Alt+P 切换，自动限制为只读工具集
- **CLI 标志**：`--yolo` / `--plan`
- **受保护路径**：edit/write 操作的路径拦截

### AskUserQuestion（tools/ask-user.ts）

- Schema 与 Claude Code 完全一致
- 单选：ctx.ui.select() + "Other" → ctx.ui.input()
- 多选：逐项 confirm + 自定义输入
- 非 UI 模式降级（默认选第一个选项）
- AbortSignal 支持
- 自定义 TUI 渲染 (renderCall/renderResult)
- promptSnippet + promptGuidelines 自动注入系统提示

---

## 开发指南

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
| protected-paths | 路径保护 | `pi examples/extensions/protected-paths.ts` |
| sandbox | 沙箱模式 | `pi examples/extensions/sandbox/` |
| todo | TodoWrite | `pi examples/extensions/todo.ts` |
| claude-rules | 记忆系统 | `pi examples/extensions/claude-rules.ts` |
| custom-compaction | 自定义压缩 | `pi examples/extensions/custom-compaction.ts` |

### 实现优先级

1. **Phase 1** — `core.ts`: 权限系统完善 + 记忆系统 + Hooks
2. **Phase 2** — `tools.ts`: Web 工具 + Todo + Plan Mode 完善
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
