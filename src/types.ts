/**
 * Đại diện cho một nút trong cây biến debug
 */
export interface VariableNode {
  name: string;
  value: string;
  type?: string;
  variablesReference: number;
  children?: VariableNode[];
}

/**
 * Các cấu hình của extension
 */
export interface CopyDebugVariableConfig {
  format: 'json' | 'plain';
  maxDepth: number;
  truncateLarge: boolean;
}
