import { VariableNode } from './types';

/**
 * Hàm xây dựng cây đối tượng Javascript từ cây biến của Debugger
 */
export function buildObjectTree(node: VariableNode, depth: number = 0): any {
  const nodeType = (node.type || '').toLowerCase();
  const isDateType = nodeType.includes('datetime') || nodeType.includes('date');

  // 1. Xử lý các giá trị cơ bản (Primitives) hoặc kiểu Date
  if (node.variablesReference === 0 || depth > 30 || isDateType) {
    let val = node.value;
    
    // Làm sạch chuỗi ngày tháng nếu cần
    if (isDateType && typeof val === 'string') {
      return val.replace(/^\{|\}$|^"|"$/g, '');
    }

    // Chuyển đổi chuỗi text sang kiểu dữ liệu Javascript tương ứng
    if (val === 'undefined') return undefined;
    if (val === 'null') return null;
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (!isNaN(Number(val)) && val.trim() !== '') return Number(val);
    
    // Xử lý chuỗi được bao bởi dấu ngoặc kép
    if (typeof val === 'string' && val.startsWith('"') && val.endsWith('"')) {
      try {
        return JSON.parse(val);
      } catch {
        return val.substring(1, val.length - 1);
      }
    }
    return val;
  }

  const type = (node.type || '').toLowerCase();
  const hasNumericChildren = node.children && node.children.some(c => /^\d+$/.test(c.name || '') || /^\[\d+\]$/.test(c.name || ''));
  const isArray = type.includes('array') || type.includes('list') || hasNumericChildren;

  // 2. Xử lý Mảng hoặc Danh sách (Array / List)
  if (isArray) {
    const arr: any[] = [];
    if (node.children) {
      // Lọc bỏ các thuộc tính nội bộ của debugger
      const filtered = node.children.filter(child => {
        const name = child.name || '';
        return !(name === 'Capacity' || name === 'Count' || name === 'Static members' || name === 'Non-Public members' || name.startsWith('_') || name === 'Raw View' || name === 'Results View');
      });

      for (const child of filtered) {
        const childResult = buildObjectTree(child, depth + 1);
        
        // Un-wrap nếu dữ liệu bị bọc trong một đối tượng rỗng (lỗi biên của vsdbg)
        if (typeof childResult === 'object' && childResult !== null && !Array.isArray(childResult)) {
          const keys = Object.keys(childResult);
          if (keys.length === 1 && keys[0] === '') {
            arr.push(childResult['']);
          } else {
            arr.push(childResult);
          }
        } else {
          arr.push(childResult);
        }
      }
    }
    return arr;
  }

  // 3. Xử lý Đối tượng (Object)
  const obj: any = {};
  if (node.children) {
    for (const child of node.children) {
      let propName = child.name || '';
      // Loại bỏ phần [index] ở cuối tên nếu có (đối với một số debugger đặc thù)
      propName = propName.replace(/\s*\[.*?\]\s*$/, '');
      
      const isInternal = propName === 'Capacity' || propName === 'Count' || propName === 'Static members' || propName === 'Non-Public members' || propName.startsWith('_') || propName === 'Raw View' || propName === 'Results View';
      if (isInternal) continue;
      
      obj[propName] = buildObjectTree(child, depth + 1);
    }
  }
  return obj;
}

/**
 * Hàm định dạng cây biến thành chuỗi text (JSON hoặc Plain Text)
 */
export function formatVariable(node: VariableNode, format: 'json' | 'plain' = 'json'): string {
  if (node.variablesReference === 0) {
    return format === 'json' ? JSON.stringify(node.value) : String(node.value);
  }

  const obj = buildObjectTree(node);
  return format === 'json' ? JSON.stringify(obj, null, 2) : String(obj);
}
