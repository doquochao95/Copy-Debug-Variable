import * as vscode from 'vscode';
import { VariableNode } from './types';

/**
 * Hàm chính để lấy toàn bộ cây biến (hỗ trợ cả các tập dữ liệu lớn)
 */
export async function fetchVariableTree(
  session: vscode.DebugSession,
  evaluateName: string
): Promise<VariableNode[]> {
  try {
    const jsonStr = await tryFetchAsJson(session, evaluateName);
    if (jsonStr) {
      const data = JSON.parse(jsonStr);
      if (data !== null) {
        return convertJsonToNodes(data);
      }
    }

    throw "Không thể Serialize đối tượng sang JSON.";
  } catch (error) {
    throw error;
  }
}

/**
 * Thử Serialize đối tượng sang JSON
 */
async function tryFetchAsJson(session: vscode.DebugSession, expr: string): Promise<string | null> {
  const isJS = ['node', 'pwa-node', 'pwa-chrome', 'pwa-msedge', 'extensionHost'].includes(session.type);
  let expressions: string[] = [];
  if (isJS) {
    // Javascript/Typescript
    expressions = [
      `JSON.stringify(${expr})`,
      `(function(obj){
          const cache = new Set();
          return JSON.stringify(obj, (key, value) => {
            if (typeof value === 'object' && value !== null) {
              if (cache.has(value)) return;
              cache.add(value);
            }
            return typeof value === 'bigint' ? value.toString() : value;
          });
        })(${expr})`
    ];
  } else {
    // .NET (C#)
    expressions = [
      `Newtonsoft.Json.JsonConvert.SerializeObject(${expr}, new Newtonsoft.Json.JsonSerializerSettings { 
        MaxDepth = 3,
        ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore,
        Error = (s, e) => e.ErrorContext.Handled = true }
      )`,
      `System.Text.Json.JsonSerializer.Serialize(${expr})`
    ];
  }

  try {
    const threadsResp = await session.customRequest('threads');
    const threads = threadsResp.threads || [];

    // Thử trên nhiều Frame thay vì chỉ Frame đầu tiên
    for (const thread of threads) {
      const stackResp = await session.customRequest('stackTrace', { threadId: thread.id, levels: 5 });
      const frames = stackResp.stackFrames || [];

      for (const frame of frames) {
        for (const testExpr of expressions) {
          try {
            const evalResp: any = await session.customRequest('evaluate', {
              expression: testExpr,
              frameId: frame.id,
              context: 'repl'
            });

            if (evalResp && evalResp.result) {
              let result = evalResp.result;

              // GIẢI MÃ CHUỖI (Unescape): Debugger trả về string literal
              const isQuoted = (result.startsWith('"') && result.endsWith('"')) || (result.startsWith("'") && result.endsWith("'"));
              if (isQuoted) {
                try {
                  const normalizedResult = result.startsWith("'") 
                    ? '"' + result.substring(1, result.length - 1).replace(/\\'/g, "'").replace(/"/g, '\\"') + '"'
                    : result;
                  result = JSON.parse(normalizedResult);
                } catch (e) {
                  // Fallback nếu parse lỗi
                  result = result.substring(1, result.length - 1).replace(/\\"/g, '"').replace(/\\'/g, "'");
                }
              }

              // Nếu kết quả chứa lỗi đặc trưng của debugger, bỏ qua
              if (result.includes("Evaluation failed") || result.includes("error CS")) continue;

              // Kiểm tra xem chuỗi có phải JSON hợp lệ không
              if (result.trim().startsWith('{') || result.trim().startsWith('[')) {
                return result;
              }
            }
          } catch (e) { }
        }
      }
    }
  } catch (e) { }

  return null;
}

/**
 * Chuyển đổi dữ liệu JSON thô thành cây VariableNode
 */
function convertJsonToNodes(obj: any): VariableNode[] {
  if (Array.isArray(obj)) {
    return obj.map((item, index) => {
      const isComplex = item !== null && typeof item === 'object';
      return {
        name: `[${index}]`,
        value: isComplex ? '' : String(item),
        type: typeof item,
        variablesReference: 0,
        children: isComplex ? convertJsonToNodes(item) : []
      };
    });
  } else if (typeof obj === 'object' && obj !== null) {
    return Object.entries(obj).map(([key, value]) => {
      const isComplex = value !== null && typeof value === 'object';
      return {
        name: key,
        value: isComplex ? '' : String(value),
        type: typeof value,
        variablesReference: 0,
        children: isComplex ? convertJsonToNodes(value) : []
      };
    });
  }
  return [];
}
