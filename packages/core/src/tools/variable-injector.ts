/**
 * Dynamic Variable Injector
 * Thay thế các biến placeholder dạng {{VAR_NAME}} bằng giá trị thực tế từ Scoped Config của Workspace.
 */

export class VariableInjector {
  /**
   * Thay thế biến trong một chuỗi văn bản (URL hoặc giá trị header)
   */
  static injectString(template: string, variables: Record<string, string>): string {
    if (!template) return template;
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, varName) => {
      if (varName in variables) {
        return variables[varName];
      }
      return match; // Giữ nguyên nếu không tìm thấy
    });
  }

  /**
   * Thay thế biến đệ quy trong một Object (Header, Query Params hoặc Body)
   */
  static injectObject<T = unknown>(obj: T, variables: Record<string, string>): T {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.injectString(obj, variables) as unknown as T;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.injectObject(item, variables)) as unknown as T;
    }

    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        const injectedKey = this.injectString(key, variables);
        result[injectedKey] = this.injectObject(value, variables);
      }
      return result as T;
    }

    return obj;
  }

  /**
   * Kiểm tra xem các biến bắt buộc đã được cung cấp đầy đủ hay chưa
   */
  static validateRequiredVariables(
    requiredVariables: string[],
    providedVariables: Record<string, string>
  ): { isValid: boolean; missingVariables: string[] } {
    const missing: string[] = [];
    for (const reqVar of requiredVariables) {
      if (!providedVariables[reqVar] || providedVariables[reqVar].trim() === '') {
        missing.push(reqVar);
      }
    }
    return {
      isValid: missing.length === 0,
      missingVariables: missing,
    };
  }
}
