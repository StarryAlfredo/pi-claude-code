/**
 * 权限系统共享类型
 */

/** 权限模式 */
export type PermissionMode = "default" | "plan" | "yolo" | "auto";

/** 工具调用安全级别 */
export type SafetyLevel = "read" | "write" | "dangerous";

/** 权限检查结果 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

/** 扩展间共享状态 */
export interface SharedState {
  permissionMode: PermissionMode;
  planModeActive: boolean;
  coordinatorModeActive: boolean;
  memoryFiles: string[];
}

/** Bash 命令分类结果 */
export interface BashClassification {
  safety: SafetyLevel;
  category: string;
  reason?: string;
}
