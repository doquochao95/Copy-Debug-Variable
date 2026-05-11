import * as vscode from 'vscode';
import { fetchVariableTree } from './variableFetcher';
import { formatVariable } from './formatter';

/**
 * Biến lưu trữ tạm thời dữ liệu được chọn để so sánh
 */
let selectedDataForCompare: { name: string, value: string } | null = null;

/**
 * Hàm kích hoạt extension
 */
export function activate(context: vscode.ExtensionContext) {
  // --- HÀM TRỢ GIÚP: TRÍCH XUẤT DỮ LIỆU BIẾN ---
  async function extractVariableData(args: any[], format: 'json' | 'plain'): Promise<Record<string, string>> {
    const session = vscode.debug.activeDebugSession;
    if (!session) throw new Error('Không có phiên debug nào đang hoạt động');
    // 1. Xác định biến mục tiêu từ context menu
    let targetVariable: any = null;
    if (args.length > 0 && args[0]) {
      const arg = args[0];
      if (arg && typeof arg === 'object') {
        targetVariable = arg.variable || (arg.name !== undefined ? arg : null);
      }
    }
    if (!targetVariable) throw new Error('Vui lòng click chuột phải vào một biến để copy');

    const varName = targetVariable.name || 'unknown';
    const variablesRef = targetVariable.variablesReference;
    const varValue = targetVariable.value !== undefined ? targetVariable.value : targetVariable;

    // Lấy kiểu dữ liệu thực tế
    let actualType = targetVariable.type || '';
    const nameTypeMatch = varName.match(/\[(.*?)\]$/);
    if (nameTypeMatch) actualType = nameTypeMatch[1];

    // Ngăn chặn copy trực tiếp từ Results View / Raw View
    if (varName === 'Results View' || varName === 'Raw View')
      throw new Error(`Vui lòng click chuột phải vào biến gốc thay vì "${varName}".`);

    // CHẶN BIẾN "this": Tránh copy toàn bộ object context hiện tại
    if (varName === 'this')
      throw new Error('Không hỗ trợ xử lý biến "this". Vui lòng chọn các thuộc tính con cụ thể.');
    // CHẶN INTERFACE: Chỉ cho phép copy các biến có "Cách lưu trữ" trong RAM (Concrete Types)
    const typeParts = actualType.split('.');
    const shortTypeName = typeParts[typeParts.length - 1];
    if (/^[I][A-Z]/.test(shortTypeName))
      throw new Error(`Không thể xử lý kiểu Interface (${shortTypeName}). Vui lòng chuyển sang kiểu lưu trữ thực tế.`);

    const lowerType = actualType.toLowerCase();
    const isDateType = lowerType.includes('datetime') || lowerType.includes('date');

    // 1. Xử lý giá trị đơn giản hoặc kiểu Date
    if (variablesRef === 0 || isDateType)
      return format === 'json' ? { [varName]: JSON.stringify(varValue) } : { [varName]: String(varValue) }
    // 2. Xử lý các đối tượng phức tạp
    const children = await fetchVariableTree(
      session,
      targetVariable.evaluateName || varName
    );

    const node = {
      name: varName,
      value: varValue,
      type: targetVariable.type,
      variablesReference: variablesRef,
      children
    };
    return formatVariable(node, format);
  }

  // --- LỆNH 1: COPY GIÁ TRỊ ---
  const copyCommand = vscode.commands.registerCommand('copyDebugVariable.copyValue', async (...args: any[]) => {
    try {
      const config = vscode.workspace.getConfiguration('copyDebugVariable');
      const format = config.get<'json' | 'plain'>('format', 'json');

      const data = await extractVariableData(args, format);

      if (data) {
        const [name, value] = Object.entries(data)[0];
        await vscode.env.clipboard.writeText(value);
        vscode.window.showInformationMessage(`Đã copy "${name}" vào clipboard`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Lỗi: ${error}`);
    }
  });

  // --- LỆNH 2: CHỌN ĐỂ SO SÁNH ---
  const selectForCompareCommand = vscode.commands.registerCommand('copyDebugVariable.selectForCompare', async (...args: any[]) => {
    try {
      const data = await extractVariableData(args, 'json');
      const [name, value] = Object.entries(data)[0];
      selectedDataForCompare = { name: name, value: value };
      await vscode.commands.executeCommand('setContext', 'copyDebugVariable.hasSelectedForCompare', true);
      vscode.window.showInformationMessage(`Đã chọn "${name}" để so sánh.`);
    } catch (error) {
      vscode.window.showErrorMessage(`Lỗi: ${error}`);
    }
  });

  // --- LỆNH 3: SO SÁNH VỚI BIẾN ĐÃ CHỌN ---
  const compareWithSelectedCommand = vscode.commands.registerCommand('copyDebugVariable.compareWithSelected', async (...args: any[]) => {
    try {
      if (!selectedDataForCompare) {
        vscode.window.showErrorMessage("Vui lòng chọn một biến trước (Select for Compare).");
        return;
      }
      const data = await extractVariableData(args, 'json');
      const [name, value] = Object.entries(data)[0];
      // Tạo các URI ảo để mở Diff View
      const leftUri = vscode.Uri.parse(`debug-compare:Selected: ${selectedDataForCompare.name}.json?${encodeURIComponent(selectedDataForCompare.value)}`);
      const rightUri = vscode.Uri.parse(`debug-compare:Current: ${name}.json?${encodeURIComponent(value)}`);
      await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, `${selectedDataForCompare.name} ↔ ${name} (Recent)`);
    } catch (error) {
      vscode.window.showErrorMessage(`Lỗi: ${error}`);
    }
  });

  // Đăng ký Provider để hiển thị nội dung từ URI "debug-compare"
  const compareProvider = new class implements vscode.TextDocumentContentProvider {
    provideTextDocumentContent(uri: vscode.Uri): string {
      return decodeURIComponent(uri.query);
    }
  };

  context.subscriptions.push(
    copyCommand,
    selectForCompareCommand,
    compareWithSelectedCommand,
    vscode.workspace.registerTextDocumentContentProvider('debug-compare', compareProvider)
  );
}

export function deactivate() { }
