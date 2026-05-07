import * as vscode from 'vscode';
import { VariableNode } from './types';

/**
 * Hàm chính để lấy toàn bộ cây biến (hỗ trợ cả các tập dữ liệu lớn)
 */
export async function fetchVariableTree(
  session: vscode.DebugSession,
  variablesReference: number,
  initialValue?: string,
  depth: number = 0,
): Promise<VariableNode[]> {
  // Giới hạn độ sâu để tránh đệ quy vô tận hoặc treo máy
  if (variablesReference === 0 || depth > 20) {
    return [];
  }

  /**
   * Helper: Xử lý các nút "[More]" do .NET Debugger tự động chèn vào khi dữ liệu quá lớn (pagination)
   */
  async function expandMoreNodes(vars: any[]): Promise<any[]> {
    let result = [...vars];
    while (true) {
      const moreIndex = result.findIndex(v => v.name === '[More]');
      if (moreIndex === -1) break;

      const moreVar = result[moreIndex];
      result.splice(moreIndex, 1); // Loại bỏ nút [More] để thay bằng dữ liệu thật

      if (moreVar.variablesReference > 0) {
        try {
          const moreResp = await session.customRequest('variables', {
            variablesReference: moreVar.variablesReference,
            count: 10000
          });
          const newVars = moreResp.variables || [];
          result.push(...newVars);
        } catch (e) {
          break;
        }
      } else {
        break;
      }
    }
    return result;
  }

  try {
    // 1. Lấy thông tin số lượng phần tử (nếu có) từ giá trị hiển thị (vd: Count = 42)
    let totalCount = 0;
    if (initialValue && typeof initialValue === 'string') {
      let match = initialValue.match(/Count\s*=\s*(\d+)/i) || initialValue.match(/\[(\d+)\]/);
      if (match && match[1]) {
        totalCount = parseInt(match[1], 10);
      }
    }

    // 2. Lấy danh sách biến ban đầu
    const resp = await session.customRequest('variables', {
      variablesReference,
      start: 0,
      count: 1000
    });
    let firstBatch: any[] = resp.variables || [];

    // Mở rộng tất cả các nút [More] nếu có
    firstBatch = await expandMoreNodes(firstBatch);

    // 3. Xây dựng cây VariableNode đệ quy
    const allNodes: VariableNode[] = [];
    for (const variable of firstBatch) {
      const isRawView = variable.name === 'Raw View' || variable.name === 'Results View';
      if (isRawView) continue;

      const varType = (variable.type || '').toLowerCase();
      const isDateType = varType.includes('datetime') || varType.includes('date');

      const node: VariableNode = {
        name: variable.name,
        value: variable.value,
        type: variable.type,
        variablesReference: (isDateType) ? 0 : (variable.variablesReference || 0)
      };

      if (node.variablesReference > 0) {
        node.children = await fetchVariableTree(session, node.variablesReference, undefined, depth + 1);
      }
      allNodes.push(node);
    }

    return allNodes;
  } catch (error) {
    return [];
  }
}
