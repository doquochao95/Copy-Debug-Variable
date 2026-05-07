import * as vscode from 'vscode';
import { fetchVariableTree } from './variableFetcher';
import { formatVariable } from './formatter';

/**
 * Hàm kích hoạt extension
 */
export function activate(context: vscode.ExtensionContext) {
  // Đăng ký lệnh copy
  const copyCommand = vscode.commands.registerCommand('copyDebugVariable.copyValue', async (...args: any[]) => {
    const session = vscode.debug.activeDebugSession;
    if (!session) {
      vscode.window.showErrorMessage('Không có phiên debug nào đang hoạt động');
      return;
    }

    try {
      // 1. Xác định biến mục tiêu từ context menu
      let targetVariable: any = null;
      if (args.length > 0 && args[0]) {
        const arg = args[0];
        if (arg && typeof arg === 'object') {
          targetVariable = arg.variable || (arg.name !== undefined ? arg : null);
        }
      }

      if (!targetVariable) {
        vscode.window.showErrorMessage('Vui lòng click chuột phải vào một biến để copy');
        return;
      }

      const varName = targetVariable.name || 'unknown';
      const variablesRef = targetVariable.variablesReference;
      const varValue = targetVariable.value !== undefined ? targetVariable.value : targetVariable;
      
      // Lấy kiểu dữ liệu thực tế (ưu tiên từ name nếu có định dạng [TypeName])
      let actualType = targetVariable.type || '';
      const nameTypeMatch = varName.match(/\[(.*?)\]$/);
      if (nameTypeMatch) {
          actualType = nameTypeMatch[1];
      }

      // Ngăn chặn copy trực tiếp từ Results View / Raw View
      if (varName === 'Results View' || varName === 'Raw View') {
        vscode.window.showErrorMessage(`Vui lòng click chuột phải vào biến gốc để copy thay vì "${varName}".`);
        return;
      }

      // CHẶN BIẾN "this": Tránh copy toàn bộ object context hiện tại
      if (varName === 'this') {
        vscode.window.showErrorMessage('Không hỗ trợ copy biến "this". Vui lòng chọn các thuộc tính con cụ thể.');
        return;
      }

      // CHẶN INTERFACE: Chỉ cho phép copy các biến có "Cách lưu trữ" trong RAM (Concrete Types)
      const typeParts = actualType.split('.');
      const shortTypeName = typeParts[typeParts.length - 1];
      const isInterface = /^[I][A-Z]/.test(shortTypeName);
      
      if (isInterface) {
        vscode.window.showErrorMessage(`Không thể copy kiểu Interface (${shortTypeName}). Vui lòng chuyển sang kiểu lưu trữ trên RAM trước khi copy.`);
        return;
      }

      // Lấy cấu hình định dạng (JSON hoặc Plain Text)
      const config = vscode.workspace.getConfiguration('copyDebugVariable');
      const format = config.get<'json' | 'plain'>('format', 'json');

      let valueToCopy: string = '';

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Đang xử lý dữ liệu biến "${varName}"...`,
        cancellable: false
      }, async (progress) => {
        const lowerType = actualType.toLowerCase();
        const isDateType = lowerType.includes('datetime') || lowerType.includes('date');

        // 2. Xử lý giá trị đơn giản hoặc kiểu Date
        if (variablesRef === 0 || isDateType) {
          valueToCopy = format === 'json' ? JSON.stringify(varValue) : String(varValue);
        } 
        // 3. Xử lý các đối tượng phức tạp (List, Dictionary, Object...)
        else {
          // Lấy toàn bộ cây dữ liệu (sử dụng chữ ký hàm mới đã được bạn refactor)
          const children = await fetchVariableTree(
              session, 
              variablesRef, 
              varValue, 
              0
          );
          
          const node = {
            name: varName,
            value: varValue,
            type: targetVariable.type,
            variablesReference: variablesRef,
            children
          };
          valueToCopy = formatVariable(node, format);
        }
      });

      // 4. Lưu vào clipboard
      if (valueToCopy) {
        await vscode.env.clipboard.writeText(valueToCopy);
        vscode.window.showInformationMessage(`Đã copy "${varName}" vào clipboard`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Lỗi khi copy biến: ${error}`);
    }
  });

  context.subscriptions.push(copyCommand);
}

export function deactivate() {}
