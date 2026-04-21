/**
 * AskUserQuestion Tool — Claude Code 兼容实现
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  Claude Code → Pi 架构映射                                     │
 * ├─────────────────────────────────────────────────────────────────┤
 * │  Claude Code              │  Pi                                │
 * │  交互在权限确认层          │  交互在 execute() 中               │
 * │  (checkPermissions→对话框) │  (ctx.ui.select/confirm/input)     │
 * │  React Ink 多题导航 UI    │  逐题弹出 select                  │
 * │  SelectMulti 组件一次多选  │  逐项 confirm + 汇总               │
 * │  PreviewBox 侧边栏预览    │  ⚠ 不支持 (Pi select 无预览面板)   │
 * │  图片粘贴 (base64 附件)    │  ⚠ 不支持 (Pi input 无图片)       │
 * │  "Chat about this" 底栏   │  ⚠ 未实现                         │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  实现状态                                                       │
 * ├─────────────────────────────────────────────────────────────────┤
 * │  ✅ 已实现                                                      │
 * │    • Schema 与 Claude Code 完全一致 (questions/options/header)  │
 * │    • 输出格式一致 (answers + annotations)                       │
 * │    • 返回文本一致 ("User has answered your questions: ...")     │
 * │    • 单选模式: ctx.ui.select() + "Other" → ctx.ui.input()      │
 * │    • 多选模式: 逐项 ctx.ui.confirm() + 自定义输入               │
 * │    • 多题顺序提问 (1-4 题)                                      │
 * │    • 非 UI 模式降级 (默认选第一个选项)                          │
 * │    • AbortSignal 支持 (用户取消)                                │
 * │    • 自定义 TUI 渲染 (renderCall/renderResult)                  │
 * │    • promptSnippet + promptGuidelines 注入系统提示              │
 * │                                                                 │
 * │  ⚠ 未实现 (Pi TUI 限制)                                        │
 * │    • Preview 侧边栏 — Pi select 无预览面板                     │
 * │      → 可用 ctx.ui.custom() 自定义组件实现 (未来)               │
 * │    • 多题 Tab 导航 — Pi select 是单次调用                       │
 * │      → 逐题弹出，体验略差但可用                                 │
 * │    • 图片粘贴 — Pi input 不支持图片附件                         │
 * │      → 需 Pi 核心支持 input 图片能力                            │
 * │    • "Chat about this" 底栏操作                                 │
 * │      → 需结合 Plan Mode 扩展实现                                │
 * │    • Plan Mode interview 集成                                  │
 * │      → 依赖 pi-cc-core 的 Plan Mode 状态                       │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  单选流程 (最常见)                                              │
 * ├─────────────────────────────────────────────────────────────────┤
 * │  LLM → AskUserQuestion({ questions: [{ ... }] })               │
 * │    ↓                                                            │
 * │  ctx.ui.select("Q?", ["Opt1 — desc", "Opt2 — desc", "Other"]) │
 * │    ↓                                                            │
 * │  用户选 "Other" → ctx.ui.input("Enter your answer:")           │
 * │  用户选 "Opt1 — desc" → 提取 label: "Opt1"                    │
 * │    ↓                                                            │
 * │  返回 { answers: { "Q?": "Opt1" } }                            │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  多选流程                                                       │
 * ├─────────────────────────────────────────────────────────────────┤
 * │  LLM → AskUserQuestion({ questions: [{ multiSelect: true }] }) │
 * │    ↓                                                            │
 * │  对每个 option: ctx.ui.confirm("Enable this?")                  │
 * │    ↓                                                            │
 * │  ctx.ui.confirm("Add custom?") → ctx.ui.input()                │
 * │    ↓                                                            │
 * │  返回 { answers: { "Q?": "Auth, Logging, Custom" } }           │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * GitHub Issue: https://github.com/StarryAlfredo/pi-claude-code/issues/1
 */

import type { ExtensionAPI, ToolDefinition } from "@mariozechner/pi-coding-agent"
import { Type } from "@sinclair/typebox"

// ─── Schema 定义 ───────────────────────────────────────────────

const QuestionOptionSchema = Type.Object({
	label: Type.String({
		description:
			"The display text for this option. Should be concise (1-5 words) and clearly describe the choice.",
	}),
	description: Type.String({
		description:
			"Explanation of what this option means or what will happen if chosen. Useful for providing context about trade-offs or implications.",
	}),
	preview: Type.Optional(
		Type.String({
			description:
				"Optional preview content (not rendered in Pi TUI, kept for schema compatibility).",
		}),
	),
})

const QuestionSchema = Type.Object({
	question: Type.String({
		description:
			'The complete question to ask the user. Should be clear, specific, and end with a question mark. Example: "Which library should we use for date formatting?"',
	}),
	header: Type.String({
		description:
			'Very short label displayed as a chip/tag (max 12 chars). Examples: "Auth method", "Library", "Approach".',
	}),
	options: Type.Array(QuestionOptionSchema, { minItems: 2, maxItems: 4 }).description(
		"The available choices for this question. Must have 2-4 options. There should be no 'Other' option, that will be provided automatically.",
	),
	multiSelect: Type.Boolean({
		default: false,
		description:
			"Set to true to allow the user to select multiple options instead of just one. Use when choices are not mutually exclusive.",
	}),
})

const AskUserParams = Type.Object({
	questions: Type.Array(QuestionSchema, { minItems: 1, maxItems: 4 }).description(
		"Questions to ask the user (1-4 questions)",
	),
})

// ─── 输出类型 ───────────────────────────────────────────────────

interface AskUserDetails {
	questions: Array<{
		question: string
		header: string
		options: Array<{ label: string; description: string; preview?: string }>
		multiSelect: boolean
	}>
	answers: Record<string, string>
	annotations?: Record<
		string,
		{
			notes?: string
			preview?: string
		}
	>
}

// ─── 工具实现 ───────────────────────────────────────────────────

export function registerAskUser(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "AskUserQuestion",
		label: "Ask User",
		description: [
			"Asks the user multiple choice questions to gather information, clarify ambiguity,",
			"understand preferences, make decisions or offer them choices.",
			"",
			"Usage notes:",
			"- Users will always be able to select 'Other' to provide custom text input",
			"- Use multiSelect: true to allow multiple answers to be selected for a question",
			"- If you recommend a specific option, make that the first option and add '(Recommended)' at the end of the label",
		].join("\n"),
		promptSnippet: "Ask the user multiple-choice questions to clarify preferences or decisions",
		promptGuidelines: [
			"Use AskUserQuestion when you need to clarify user preferences, gather requirements, or make implementation decisions during execution.",
			"Ask clear, specific questions with 2-4 options. Mark recommended options with '(Recommended)' in the label.",
			"Do NOT use AskUserQuestion to ask 'Is my plan ready?' or 'Should I proceed?' - just proceed.",
		],
		parameters: AskUserParams,
		// 必须顺序执行——同一时间只能有一个问题对话框
		executionMode: "sequential",

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const { questions } = params
			const answers: Record<string, string> = {}
			const annotations: Record<string, { notes?: string; preview?: string }> = {}

			// 无 UI 时（print/rpc 模式）返回默认提示
			if (!ctx.hasUI) {
				for (const q of questions) {
					answers[q.question] = q.options[0]?.label ?? "No preference"
				}
				return {
					content: [
						{
							type: "text" as const,
							text: `No interactive UI available. Default answers: ${Object.entries(answers)
								.map(([q, a]) => `"${q}"="${a}"`)
								.join(", ")}. Ask again in interactive mode for user input.`,
						},
					],
					details: { questions, answers } as AskUserDetails,
				}
			}

			// 逐题提问
			for (let i = 0; i < questions.length; i++) {
				const q = questions[i]

				// 检查是否已被中止
				if (signal?.aborted) {
					return {
						content: [{ type: "text" as const, text: "Question cancelled by user." }],
						details: { questions, answers } as AskUserDetails,
						isError: true,
					}
				}

				// 构建选项列表：原始选项 + "Other"
				const optionLabels = q.options.map((opt) => opt.label)
				const optionDescriptions: Record<string, string> = {}
				for (const opt of q.options) {
					optionDescriptions[opt.label] = opt.description
				}
				optionLabels.push("Other")

				// 更新进度
				const progressPrefix = questions.length > 1 ? `[${i + 1}/${questions.length}] ` : ""
				onUpdate?.({
					content: [
						{
							type: "text" as const,
							text: `${progressPrefix}Waiting for answer: ${q.question}`,
						},
					],
					details: { questions, answers } as AskUserDetails,
				})

				let answer: string | undefined

				if (q.multiSelect) {
					// ── 多选模式 ──
					// Pi 的 select 是单选的，所以多选用 confirm 逐个确认
					const selectedLabels: string[] = []

					for (const opt of q.options) {
						const confirmed = await ctx.ui.confirm(
							`${progressPrefix}${q.header}: ${q.question}`,
							`${opt.label}\n${opt.description}\n\nEnable this option?`,
						)
						if (confirmed) {
							selectedLabels.push(opt.label)
						}
					}

					// 询问是否还有自定义输入
					const customInput = await ctx.ui.confirm(
						q.question,
						"Would you like to add a custom answer?",
					)
					if (customInput) {
						const customText = await ctx.ui.input("Enter your answer:", "")
						if (customText?.trim()) {
							selectedLabels.push(customText.trim())
						}
					}

					answer = selectedLabels.length > 0 ? selectedLabels.join(", ") : "No selection"
				} else {
					// ── 单选模式 ──
					// 构建带描述的选项显示
					const displayOptions = q.options.map(
						(opt) => `${opt.label} — ${opt.description}`,
					)
					displayOptions.push("Other (type your own answer)")

					const choice = await ctx.ui.select(
						`${progressPrefix}${q.header}: ${q.question}`,
						displayOptions,
					)

					if (choice === undefined) {
						// 用户取消
						return {
							content: [
								{
									type: "text" as const,
									text: "User declined to answer questions.",
								},
							],
							details: { questions, answers } as AskUserDetails,
							isError: true,
						}
					}

					if (choice === "Other (type your own answer)") {
						const customText = await ctx.ui.input("Enter your answer:", "")
						answer = customText?.trim() || "No answer provided"
						// 记录用户笔记
						if (customText?.trim()) {
							annotations[q.question] = { notes: customText.trim() }
						}
					} else {
						// 从 "label — description" 格式中提取 label
						answer = choice.split(" — ")[0] || choice
					}
				}

				answers[q.question] = answer
			}

			// 格式化返回文本（与 Claude Code 的 mapToolResultToToolResultBlockParam 保持一致）
			const answersText = Object.entries(answers)
				.map(([questionText, answer]) => `"${questionText}"="${answer}"`)
				.join(", ")

			const hasAnnotations = Object.keys(annotations).length > 0

			return {
				content: [
					{
						type: "text" as const,
						text: `User has answered your questions: ${answersText}. You can now continue with the user's answers in mind.`,
					},
				],
				details: {
					questions,
					answers,
					...(hasAnnotations && { annotations }),
				} as AskUserDetails,
			}
		},

		// ─── 自定义渲染 ─────────────────────────────────────────

		renderCall(args, theme) {
			// 动态 import 避免顶层 require
			const { Text } = require("@mariozechner/pi-tui")

			const count = args.questions?.length ?? 0
			if (count === 0) return new Text("Asking questions...", 0, 0)

			const firstQ = args.questions[0]
			const header = firstQ?.header ?? "?"
			const multiQ = count > 1
			let text =
				theme.fg("toolTitle", theme.bold("AskUserQuestion ")) +
				theme.fg("accent", header)

			if (multiQ) {
				text += theme.fg("muted", ` (${count} questions)`)
			}

			// 显示第一个问题预览
			const preview = firstQ?.question ?? ""
			const truncated = preview.length > 60 ? preview.slice(0, 60) + "..." : preview
			text += "\n  " + theme.fg("dim", truncated)

			// 显示选项
			const options = firstQ?.options ?? []
			for (const opt of options.slice(0, 3)) {
				text += "\n  " + theme.fg("muted", "• ") + theme.fg("text", opt.label)
			}
			if (options.length > 3) {
				text += "\n  " + theme.fg("muted", `... +${options.length - 3} more`)
			}
			text += "\n  " + theme.fg("muted", "• Other")

			return new Text(text, 0, 0)
		},

		renderResult(result, { expanded }, theme) {
			const { Text } = require("@mariozechner/pi-tui")

			const details = result.details as AskUserDetails | undefined
			if (!details || Object.keys(details.answers).length === 0) {
				const text = result.content[0]
				return new Text(
					text?.type === "text" ? text.text : "No answers",
					0,
					0,
				)
			}

			let text = theme.fg("toolTitle", theme.bold("AskUserQuestion ")) + theme.fg("success", "✓")

			for (const [questionText, answer] of Object.entries(details.answers)) {
				const annotation = details.annotations?.[questionText]
				const displayQ = expanded
					? questionText
					: questionText.length > 40
						? questionText.slice(0, 40) + "..."
						: questionText
				text += "\n  " + theme.fg("muted", "· ") + theme.fg("dim", displayQ)
				text += " → " + theme.fg("accent", answer)
				if (annotation?.notes) {
					text += theme.fg("dim", ` (notes: ${annotation.notes})`)
				}
			}

			return new Text(text, 0, 0)
		},
	})
}
