/**
 * AskUserQuestion Tool — Claude Code 兼容实现
 *
 * 与 Claude Code 的架构映射:
 *
 *   Claude Code                │  Pi
 *   ──────────────────────────│──────────────────────────────
 *   交互在权限确认层           │  交互在 execute() 中
 *   (checkPermissions→对话框)  │  (ctx.ui.select/confirm/input)
 *   React Ink 多题导航 UI     │  逐题弹出 select
 *   SelectMulti 组件一次多选   │  逐项 confirm + 汇总
 *   PreviewBox 侧边栏预览     │  ⚠ 不支持 (Pi select 无预览面板)
 *   图片粘贴 (base64 附件)     │  ⚠ 不支持 (Pi input 无图片)
 *   "Chat about this" 底栏    │  ⚠ 未实现
 */

import type { ExtensionAPI, ToolDefinition } from "@mariozechner/pi-coding-agent"
import { Type } from "@sinclair/typebox"
import { Text } from "@mariozechner/pi-tui"

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
	options: Type.Array(QuestionOptionSchema, {
		minItems: 2,
		maxItems: 4,
		description: "The available choices for this question. Must have 2-4 options. There should be no 'Other' option, that will be provided automatically.",
	}),
	multiSelect: Type.Boolean({
		default: false,
		description:
			"Set to true to allow the user to select multiple options instead of just one. Use when choices are not mutually exclusive.",
	}),
})

const AskUserParams = Type.Object({
	questions: Type.Array(QuestionSchema, {
		minItems: 1,
		maxItems: 4,
		description: "Questions to ask the user (1-4 questions)",
	}),
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
	annotations?: Record<string, { notes?: string; preview?: string }>
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
		executionMode: "sequential",

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const { questions } = params
			const answers: Record<string, string> = {}
			const annotations: Record<string, { notes?: string; preview?: string }> = {}

			// 无 UI 时返回默认提示
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

				if (signal?.aborted) {
					throw new Error("Question cancelled by user.")
				}

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

				if (q.multiSelect) {
					// ── 多选模式 ──
					// 逐项 confirm
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

					answers[q.question] = selectedLabels.length > 0 ? selectedLabels.join(", ") : "No selection"
				} else {
					// ── 单选模式 ──
					// 用 index 映射，不用 split 解析
					const OTHER_INDEX = q.options.length // "Other" 的 index
					const displayOptions = q.options.map(
						(opt) => `${opt.label} — ${opt.description}`,
					)
					displayOptions.push("Other (type your own answer)")

					const choice = await ctx.ui.select(
						`${progressPrefix}${q.header}: ${q.question}`,
						displayOptions,
					)

					if (choice === undefined) {
						throw new Error("User declined to answer questions.")
					}

					const choiceIndex = displayOptions.indexOf(choice)

					if (choiceIndex === OTHER_INDEX) {
						// 用户选了 "Other"
						const customText = await ctx.ui.input("Enter your answer:", "")
						if (customText === undefined || customText.trim() === "") {
							throw new Error("User declined to answer questions.")
						}
						answers[q.question] = customText.trim()
						annotations[q.question] = { notes: customText.trim() }
					} else if (choiceIndex >= 0 && choiceIndex < q.options.length) {
						// 用 index 映射回 label，而不是 split(" — ")
						answers[q.question] = q.options[choiceIndex].label
					} else {
						// 兜底：万一 indexOf 没匹配到
						answers[q.question] = q.options[0]?.label ?? "Unknown"
					}
				}
			}

			// 格式化返回文本（与 Claude Code 保持一致）
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

			const preview = firstQ?.question ?? ""
			const truncated = preview.length > 60 ? preview.slice(0, 60) + "..." : preview
			text += "\n  " + theme.fg("dim", truncated)

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