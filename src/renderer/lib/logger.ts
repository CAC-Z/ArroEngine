/**
 * 统一日志工具 - 渲染进程
 * 
 * 在开发环境下输出日志，生产环境下只输出错误
 * 所有日志带有 [ArroEngine] 前缀便于过滤
 */

const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV ?? process.env.NODE_ENV === 'development';

export const logger = {
    /**
     * 普通日志 - 仅开发环境输出
     */
    log: (...args: unknown[]): void => {
        if (isDev) {
            console.log('[ArroEngine]', ...args);
        }
    },

    /**
     * 信息日志 - 仅开发环境输出
     */
    info: (...args: unknown[]): void => {
        if (isDev) {
            console.info('[ArroEngine]', ...args);
        }
    },

    /**
     * 警告日志 - 仅开发环境输出
     */
    warn: (...args: unknown[]): void => {
        if (isDev) {
            console.warn('[ArroEngine]', ...args);
        }
    },

    /**
     * 错误日志 - 始终输出
     */
    error: (...args: unknown[]): void => {
        console.error('[ArroEngine]', ...args);
    },

    /**
     * 调试日志 - 仅开发环境输出，可用于详细调试信息
     */
    debug: (...args: unknown[]): void => {
        if (isDev) {
            console.debug('[ArroEngine:Debug]', ...args);
        }
    },

    /**
     * 分组日志开始 - 仅开发环境
     */
    group: (label: string): void => {
        if (isDev) {
            console.group(`[ArroEngine] ${label}`);
        }
    },

    /**
     * 分组日志结束 - 仅开发环境
     */
    groupEnd: (): void => {
        if (isDev) {
            console.groupEnd();
        }
    },

    /**
     * 性能计时开始 - 仅开发环境
     */
    time: (label: string): void => {
        if (isDev) {
            console.time(`[ArroEngine] ${label}`);
        }
    },

    /**
     * 性能计时结束 - 仅开发环境
     */
    timeEnd: (label: string): void => {
        if (isDev) {
            console.timeEnd(`[ArroEngine] ${label}`);
        }
    },
};

export default logger;
