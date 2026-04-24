/**
 * 共享类型定义
 *
 * 这些类型被多个扩展模块共用。
 * 通过 import 引入，不通过 EventBus 传递。
 */

/** 权限模式 */
export type PermissionMode = "default" | "plan" | "yolo" | "auto"

/** 工具调用安全级别 */
export type SafetyLevel = "read" | "write" | "dangerous"

/** 权限检查结果 */
export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
}

/** Bash 命令分类结果 */
export interface BashClassification {
  safety: SafetyLevel
  category: string
  reason?: string
}
