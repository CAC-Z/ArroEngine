import path from 'path';
import fs from 'fs-extra';
import type { AppFile } from '../../../shared/types';
import { getFileTypeCategory } from './file-type';

export class NamingService {
  private counterMap = new Map<string, number>();

  resetCounters(): void {
    this.counterMap.clear();
  }

  async generateFileNameForPreview(
    originalName: string,
    config: any,
    fileIndex: number,
    file?: AppFile
  ): Promise<string> {
    const parsed = path.parse(originalName);
    const now = new Date();

    switch (config.namingPattern) {
      case 'timestamp': {
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const cleanBase = this.sanitizeBaseName(parsed.name, config);
        return `${timestamp}_${cleanBase}${parsed.ext}`;
      }

      case 'date': {
        const dateFormat = config.dateFormat || 'YYYY-MM-DD';
        const dateStr = this.formatDate(now, dateFormat);
        const cleanBase = this.sanitizeBaseName(parsed.name, config);
        return `${dateStr}_${cleanBase}${parsed.ext}`;
      }

      case 'file-created': {
        const cleanBase = this.sanitizeBaseName(parsed.name, config);
        const ext = parsed.ext;
        if (file?.createdDate) {
          try {
            const createdDate = new Date(file.createdDate);
            if (!Number.isNaN(createdDate.getTime())) {
              const createdDateStr = this.formatDate(createdDate, config.dateFormat || 'YYYY-MM-DD');
              return `${createdDateStr}_${cleanBase}${ext}`;
            }
            console.warn(`无法解析文件创建日期: ${file.createdDate}`);
          } catch (error) {
            console.warn(`无法解析文件创建日期: ${file.createdDate}`, error);
          }
        }

        const fallbackDateStr = this.formatDate(now, config.dateFormat || 'YYYY-MM-DD');
        return `${fallbackDateStr}_${cleanBase}${ext}`;
      }

      case 'file-modified': {
        const cleanBase = this.sanitizeBaseName(parsed.name, config);
        const ext = parsed.ext;

        if (file?.modifiedDate) {
          try {
            const modifiedDate = new Date(file.modifiedDate);
            if (!Number.isNaN(modifiedDate.getTime())) {
              const modifiedDateStr = this.formatDate(modifiedDate, config.dateFormat || 'YYYY-MM-DD');
              return `${modifiedDateStr}_${cleanBase}${ext}`;
            }
            console.warn(`无法解析文件修改日期: ${file.modifiedDate}`);
          } catch (error) {
            console.warn(`无法解析文件修改日期: ${file.modifiedDate}`, error);
          }
        }

        if (file?.path) {
          try {
            const stat = await fs.stat(file.path);
            if (!Number.isNaN(stat.mtime.getTime())) {
              const modifiedDateStr = this.formatDate(stat.mtime, config.dateFormat || 'YYYY-MM-DD');
              return `${modifiedDateStr}_${cleanBase}${ext}`;
            }
            console.warn(`无法解析文件修改日期: ${file.path}`);
          } catch (error) {
            console.warn(`无法获取文件修改日期: ${file.path}`, error);
          }
        }

        const fallbackDateStr = this.formatDate(now, config.dateFormat || 'YYYY-MM-DD');
        return `${fallbackDateStr}_${cleanBase}${ext}`;
      }

      case 'counter': {
        const counterStart = config.counterStart || 1;
        const counterPadding = config.counterPadding || 3;
        const counter = (counterStart + fileIndex).toString().padStart(counterPadding, '0');
        const cleanBase = this.sanitizeBaseName(parsed.name, config);
        return `${counter}_${cleanBase}${parsed.ext}`;
      }

      case 'prefix':
        return this.applyPrefix(originalName, config.prefix || '', config);

      case 'suffix':
        return this.applySuffix(originalName, config.suffix || '', config);

      case 'replace':
        return this.applyReplace(originalName, config.replaceFrom || '', config.replaceTo || '', config);

      case 'case':
        return this.applyCase(originalName, config);

      case 'custom':
        if (config.customPattern) {
          return this.buildCustomPattern(originalName, config.customPattern, now, config, { previewIndex: fileIndex });
        }
        return originalName;

      case 'advanced':
        return this.applyAdvancedRules(originalName, config.advancedRules || [], now, { previewIndex: fileIndex });

      case 'original':
      default:
        return originalName;
    }
  }

  async generateFileName(
    originalName: string,
    config: any,
    actionId?: string,
    filePath?: string
  ): Promise<string> {
    const parsed = path.parse(originalName);
    const now = new Date();
    let newFileName = originalName;
    const resolvedCounterKey = actionId ?? config?.counterKey ?? this.generateCounterKey();

    switch (config.namingPattern) {
      case 'timestamp': {
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const cleanBase = this.sanitizeBaseName(parsed.name, config);
        newFileName = `${timestamp}_${cleanBase}${parsed.ext}`;
        break;
      }

      case 'date': {
        const dateFormat = config.dateFormat || 'YYYY-MM-DD';
        const dateStr = this.formatDate(now, dateFormat);
        const cleanBase = this.sanitizeBaseName(parsed.name, config);
        newFileName = `${dateStr}_${cleanBase}${parsed.ext}`;
        break;
      }

      case 'file-created': {
        const cleanBase = this.sanitizeBaseName(parsed.name, config);
        const ext = parsed.ext;

        if (filePath) {
          try {
            const stat = await fs.stat(filePath);
            if (!Number.isNaN(stat.birthtime.getTime())) {
              const createdDateStr = this.formatDate(stat.birthtime, config.dateFormat || 'YYYY-MM-DD');
              newFileName = `${createdDateStr}_${cleanBase}${ext}`;
            } else {
              console.warn(`无法解析文件创建日期: ${filePath}`);
              const fallbackDateStr = this.formatDate(now, config.dateFormat || 'YYYY-MM-DD');
              newFileName = `${fallbackDateStr}_${cleanBase}${ext}`;
            }
          } catch (error) {
            console.warn(`无法获取文件创建日期: ${filePath}`, error);
            const fallbackDateStr = this.formatDate(now, config.dateFormat || 'YYYY-MM-DD');
            newFileName = `${fallbackDateStr}_${cleanBase}${ext}`;
          }
        } else {
          const fallbackDateStr = this.formatDate(now, config.dateFormat || 'YYYY-MM-DD');
          newFileName = `${fallbackDateStr}_${cleanBase}${ext}`;
        }
        break;
      }

      case 'file-modified': {
        const cleanBase = this.sanitizeBaseName(parsed.name, config);
        const ext = parsed.ext;

        if (filePath) {
          try {
            const stat = await fs.stat(filePath);
            if (!Number.isNaN(stat.mtime.getTime())) {
              const modifiedDateStr = this.formatDate(stat.mtime, config.dateFormat || 'YYYY-MM-DD');
              newFileName = `${modifiedDateStr}_${cleanBase}${ext}`;
            } else {
              console.warn(`无法解析文件修改日期: ${filePath}`);
              const fallbackDateStr = this.formatDate(now, config.dateFormat || 'YYYY-MM-DD');
              newFileName = `${fallbackDateStr}_${cleanBase}${ext}`;
            }
          } catch (error) {
            console.warn(`无法获取文件修改日期: ${filePath}`, error);
            const fallbackDateStr = this.formatDate(now, config.dateFormat || 'YYYY-MM-DD');
            newFileName = `${fallbackDateStr}_${cleanBase}${ext}`;
          }
        } else {
          const fallbackDateStr = this.formatDate(now, config.dateFormat || 'YYYY-MM-DD');
          newFileName = `${fallbackDateStr}_${cleanBase}${ext}`;
        }
        break;
      }

      case 'counter': {
        const cleanBase = this.sanitizeBaseName(parsed.name, config);
        const ext = parsed.ext;
        const counterStart = config.counterStart || 1;
        const counterPadding = config.counterPadding || 3;

        const current = this.counterMap.get(resolvedCounterKey) ?? counterStart;
        newFileName = `${current.toString().padStart(counterPadding, '0')}_${cleanBase}${ext}`;
        this.counterMap.set(resolvedCounterKey, current + 1);
        break;
      }

      case 'prefix':
        newFileName = this.applyPrefix(originalName, config.prefix || '', config);
        break;

      case 'suffix':
        newFileName = this.applySuffix(originalName, config.suffix || '', config);
        break;

      case 'replace':
        newFileName = this.applyReplace(originalName, config.replaceFrom || '', config.replaceTo || '', config);
        break;

      case 'case':
        newFileName = this.applyCase(originalName, config);
        break;

      case 'custom':
        if (config.customPattern) {
          newFileName = this.buildCustomPattern(originalName, config.customPattern, now, config, {
            actionId: resolvedCounterKey,
            counterKey: resolvedCounterKey
          });
        } else {
          newFileName = originalName;
        }
        break;

      case 'advanced':
        newFileName = this.applyAdvancedRules(originalName, config.advancedRules || [], now, {
          actionId: resolvedCounterKey,
          counterKey: resolvedCounterKey
        });
        break;

      case 'original':
      default:
        newFileName = originalName;
        break;
    }

    this.validateFileName(newFileName);
    return newFileName;
  }

  private buildCustomPattern(
    originalName: string,
    pattern: string,
    date: Date,
    config: any,
    options: { actionId?: string; previewIndex?: number; counterKey?: string }
  ): string {
    const parsed = path.parse(originalName);
    const cleanBase = this.sanitizeBaseName(parsed.name, config);
    const counterValue = this.resolveCounter(pattern, config, options);
    const fileType = getFileTypeCategory(parsed.ext.slice(1)) || '';
    const formattedDate = this.formatDate(date, config?.dateFormat || 'YYYY-MM-DD');
    const timeString = this.formatDate(date, 'HH-mm-ss');

    const replacements = {
      name: cleanBase,
      ext: parsed.ext,
      date: formattedDate,
      time: timeString,
      counter: counterValue,
      type: fileType,
      year: date.getFullYear().toString(),
      month: (date.getMonth() + 1).toString().padStart(2, '0'),
      day: date.getDate().toString().padStart(2, '0'),
      hour: date.getHours().toString().padStart(2, '0'),
      minute: date.getMinutes().toString().padStart(2, '0'),
      second: date.getSeconds().toString().padStart(2, '0')
    };

    let result = this.replacePlaceholders(pattern, replacements);

    if (!pattern.includes('{ext}') && parsed.ext) {
      result += parsed.ext;
    }

    return result;
  }

  private resolveCounter(
    pattern: string,
    config: any,
    options: { actionId?: string; previewIndex?: number; counterKey?: string }
  ): string {
    const counterStart = config?.counterStart || 1;
    const counterPadding = config?.counterPadding || 3;

    if (typeof options.previewIndex === 'number') {
      return (counterStart + options.previewIndex).toString().padStart(counterPadding, '0');
    }

    if (pattern.includes('{counter}')) {
      const counterKey = options.counterKey ?? options.actionId ?? config?.counterKey ?? this.generateCounterKey();
      const current = this.counterMap.get(counterKey) ?? counterStart;
      this.counterMap.set(counterKey, current + 1);
      return current.toString().padStart(counterPadding, '0');
    }

    return counterStart.toString().padStart(counterPadding, '0');
  }

  private sanitizeBaseName(fileName: string, config?: any): string {
    let cleanName = fileName;

    if (config?.removeSpaces) {
      cleanName = cleanName.replace(/\s+/g, '');
    }
    if (config?.removeSpecialChars) {
      const customPattern = config?.sanitizePattern;
      if (customPattern instanceof RegExp) {
        cleanName = cleanName.replace(customPattern, '');
      } else {
        cleanName = cleanName.replace(/[^\p{L}\p{N}]/gu, '');
      }
    }

    return cleanName;
  }

  private validateFileName(fileName: string): void {
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(fileName)) {
      throw new Error(`文件名包含非法字符: ${fileName}`);
    }

    const reservedNames = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];

    const nameWithoutExt = path.parse(fileName).name.toUpperCase();
    if (reservedNames.includes(nameWithoutExt)) {
      throw new Error(`文件名使用了系统保留名称: ${fileName}`);
    }

    if (fileName.length > 255) {
      throw new Error(`文件名过长（超过255字符）: ${fileName}`);
    }

    if (fileName.endsWith('.') || fileName.endsWith(' ')) {
      throw new Error(`文件名不能以点或空格结尾: ${fileName}`);
    }
  }

  private formatDate(date: Date, format: string): string {
    const hours24 = date.getHours();
    const hours12 = hours24 % 12 || 12;
    const tokens: Record<string, string> = {
      YYYY: date.getFullYear().toString(),
      YY: date.getFullYear().toString().slice(-2),
      MM: (date.getMonth() + 1).toString().padStart(2, '0'),
      M: (date.getMonth() + 1).toString(),
      DD: date.getDate().toString().padStart(2, '0'),
      D: date.getDate().toString(),
      HH: hours24.toString().padStart(2, '0'),
      H: hours24.toString(),
      hh: hours12.toString().padStart(2, '0'),
      h: hours12.toString(),
      mm: date.getMinutes().toString().padStart(2, '0'),
      m: date.getMinutes().toString(),
      ss: date.getSeconds().toString().padStart(2, '0'),
      s: date.getSeconds().toString(),
      SSS: date.getMilliseconds().toString().padStart(3, '0'),
      A: hours24 >= 12 ? 'PM' : 'AM',
      a: hours24 >= 12 ? 'pm' : 'am'
    };

    return format.replace(
      /(YYYY|YY|MM|M|DD|D|HH|H|hh|h|mm|m|ss|s|SSS|A|a)/g,
      token => tokens[token] ?? token
    );
  }

  private applyPrefix(originalName: string, prefix: string, config?: any): string {
    const parsed = path.parse(originalName);
    const cleanBase = this.sanitizeBaseName(parsed.name, config);
    return `${prefix}${cleanBase}${parsed.ext}`;
  }

  private applySuffix(originalName: string, suffix: string, config?: any): string {
    const parsed = path.parse(originalName);
    const cleanBase = this.sanitizeBaseName(parsed.name, config);
    return `${cleanBase}${suffix}${parsed.ext}`;
  }

  private applyReplace(
    originalName: string,
    replaceFrom: string,
    replaceTo: string,
    config?: any
  ): string {
    if (!replaceFrom) {
      return originalName;
    }

    const parsed = path.parse(originalName);
    const baseName = parsed.name;
    const pattern = new RegExp(this.escapeRegExp(replaceFrom), 'g');
    const replacedBase = baseName.replace(pattern, replaceTo);
    const cleanBase = this.sanitizeBaseName(replacedBase, config);
    return `${cleanBase}${parsed.ext}`;
  }

  private applyCase(originalName: string, config: any): string {
    const parsed = path.parse(originalName);
    let newName = this.sanitizeBaseName(parsed.name, config);

    switch (config.caseType) {
      case 'lower':
        newName = newName.toLowerCase();
        break;
      case 'upper':
        newName = newName.toUpperCase();
        break;
      case 'title':
        newName = newName.replace(/\w\S*/g, txt =>
          txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
        break;
      case 'camel':
        newName = newName.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
          index === 0 ? word.toLowerCase() : word.toUpperCase()
        ).replace(/\s+/g, '');
        break;
      case 'pascal':
        newName = newName.replace(/(?:^\w|[A-Z]|\b\w)/g, word =>
          word.toUpperCase()
        ).replace(/\s+/g, '');
        break;
      case 'snake':
        newName = newName.toLowerCase().replace(/\s+/g, '_');
        break;
      case 'kebab':
        newName = newName.toLowerCase().replace(/\s+/g, '-');
        break;
      default:
        break;
    }

    return `${newName}${parsed.ext}`;
  }

  private applyAdvancedRules(
    originalName: string,
    rules: any[],
    date: Date,
    options: { actionId?: string; previewIndex?: number; counterKey?: string } = {}
  ): string {
    const parsed = path.parse(originalName);
    let result = parsed.name;

    const sortedRules = rules
      .filter(rule => rule.enabled)
      .sort((a: any, b: any) => a.order - b.order);

    for (const rule of sortedRules) {
      switch (rule.type) {
        case 'prefix':
          result = `${rule.value}${result}`;
          break;
        case 'suffix':
          result = `${result}${rule.value}`;
          break;
        case 'replace':
          if (rule.config?.replaceFrom) {
            result = this.applyReplace(
              `${result}${parsed.ext}`,
              rule.config.replaceFrom,
              rule.config.replaceTo || '',
              rule.config
            );
            result = path.parse(result).name;
          }
          break;
        case 'case':
          result = this.applyCaseTransform(result, rule.config?.caseType || 'lower');
          break;
        case 'counter': {
          const counterValue = this.resolveCounter(rule.value, rule.config, options);
          const segment = this.replacePlaceholders(rule.value, { counter: counterValue });
          result = `${result}${segment}`;
          break;
        }
        case 'date': {
          const dateStr = this.formatDate(date, rule.config?.dateFormat || 'YYYY-MM-DD');
          const segment = this.replacePlaceholders(rule.value, { date: dateStr });
          result = `${result}${segment}`;
          break;
        }
        case 'custom': {
          const custom = this.buildCustomPattern(
            `${result}${parsed.ext}`,
            rule.value,
            date,
            rule.config || {},
            options
          );
          result = path.parse(custom).name;
          break;
        }
        default:
          break;
      }
    }

    return `${result}${parsed.ext}`;
  }

  private applyCaseTransform(text: string, caseType: string): string {
    switch (caseType) {
      case 'lower':
        return text.toLowerCase();
      case 'upper':
        return text.toUpperCase();
      case 'title':
        return text.replace(/\w\S*/g, txt =>
          txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
      case 'camel':
        return text.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
          index === 0 ? word.toLowerCase() : word.toUpperCase()
        ).replace(/\s+/g, '');
      case 'pascal':
        return text.replace(/(?:^\w|[A-Z]|\b\w)/g, word =>
          word.toUpperCase()
        ).replace(/\s+/g, '');
      case 'snake':
        return text.toLowerCase().replace(/\s+/g, '_');
      case 'kebab':
        return text.toLowerCase().replace(/\s+/g, '-');
      default:
        return text;
    }
  }

  private replacePlaceholders(
    template: string,
    replacements: Record<string, string | undefined>
  ): string {
    return template.replace(/\{([^}]+)\}/g, (match, key) => {
      const replacement = replacements[key];
      return typeof replacement === 'string' ? replacement : match;
    });
  }

  private generateCounterKey(): string {
    return `__auto_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
