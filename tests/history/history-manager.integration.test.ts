import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';
import crypto from 'node:crypto';
const nodeModule = require('node:module') as any;

import type { HistoryEntry, FileOperation } from '../../src/shared/types';

interface HistoryManagerTestContext {
  tempRoot: string;
  userDataDir: string;
  historyFilePath: string;
  historyManager: any;
  restoreEnv: () => void;
  restoreModuleLoader: () => void;
}

async function createHistoryManagerTestContext(): Promise<HistoryManagerTestContext> {
  const originalLoad = nodeModule._load;
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'history-manager-test-'));
  const userDataDir = path.join(tempRoot, 'user-data');
  await fs.ensureDir(userDataDir);

  const electronMock = {
    app: {
      getPath: (name: string) => {
        if (name === 'userData') {
          return userDataDir;
        }
        throw new Error(`Unsupported app.getPath request: ${name}`);
      }
    }
  };

  nodeModule._load = function mockLoad(request: string, parent: NodeModule | null, isMain: boolean) {
    if (request === 'electron') {
      return electronMock;
    }
    return originalLoad.apply(this, [request, parent, isMain]);
  };

  const distHistoryManagerPath = path.join(__dirname, '../../main/modules/history-manager.js');

  // 确保每次创建上下文时重新加载模块，使 HISTORY_FILE_PATH 指向新的临时目录
  delete require.cache[distHistoryManagerPath];

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { HistoryManager } = require(distHistoryManagerPath);
    const historyManager = new HistoryManager();

    return {
      tempRoot,
      userDataDir,
      historyFilePath: path.join(userDataDir, 'history.json'),
      historyManager,
      restoreEnv: () => {
        if (typeof originalNodeEnv === 'undefined') {
          delete process.env.NODE_ENV;
        } else {
          process.env.NODE_ENV = originalNodeEnv;
        }
      },
      restoreModuleLoader: () => {
        nodeModule._load = originalLoad;
        delete require.cache[distHistoryManagerPath];
      }
    };
  } catch (error) {
    if (typeof originalNodeEnv === 'undefined') {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    nodeModule._load = originalLoad;
    delete require.cache[distHistoryManagerPath];
    await fs.remove(tempRoot);
    throw error;
  }
}

async function disposeHistoryManagerTestContext(context: HistoryManagerTestContext) {
  try {
    if (context.historyManager && typeof context.historyManager.stopLockCleanupMonitor === 'function') {
      context.historyManager.stopLockCleanupMonitor();
    }
  } catch {
    // Swallow cleanup errors to avoid masking test failures.
  }

  context.restoreModuleLoader();
  context.restoreEnv();
  await fs.remove(context.tempRoot);
}

function createMoveOperation(originalPath: string, newPath: string, fileSize: number): FileOperation {
  return {
    id: `op-${crypto.randomUUID()}`,
    originalPath,
    originalName: path.basename(originalPath),
    newPath,
    newName: path.basename(newPath),
    operation: 'move',
    status: 'success',
    fileType: 'file',
    fileSize
  };
}

function buildHistoryEntry(operation: FileOperation): HistoryEntry {
  return {
    id: `history-${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    workflowId: 'workflow-test',
    workflowName: 'Test Workflow',
    fileOperations: [operation],
    status: 'success',
    duration: 1000,
    totalFiles: 1,
    processedFiles: 1,
    errors: [],
    canUndo: true,
    isUndone: false,
    source: 'manual'
  };
}

test('HistoryManager integration suite', async (t) => {
  const context = await createHistoryManagerTestContext();

  t.after(async () => {
    await disposeHistoryManagerTestContext(context);
  });

  await t.test('adds entries and retrieves them via getEntries', async () => {
    await context.historyManager.clearHistory();

    const originalDir = path.join(context.tempRoot, 'scenario-add', 'original');
    const newDir = path.join(context.tempRoot, 'scenario-add', 'renamed');
    const originalPath = path.join(originalDir, 'file.txt');
    const newPath = path.join(newDir, 'file.txt');

    await fs.ensureDir(newDir);
    await fs.writeFile(newPath, 'sample content');

    const stats = await fs.stat(newPath);
    const operation = createMoveOperation(originalPath, newPath, stats.size);
    const entry = buildHistoryEntry(operation);

    await context.historyManager.addEntry(entry);

    const entries = await context.historyManager.getEntries();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, entry.id);
    assert.equal(entries[0].workflowName, 'Test Workflow');

    const stored = await fs.readJSON(context.historyFilePath);
    assert.equal(stored[0].id, entry.id);
  });

  await t.test('undoes and redoes a move operation', async () => {
    await context.historyManager.clearHistory();

    const scenarioRoot = path.join(context.tempRoot, 'scenario-undo-redo');
    const originalDir = path.join(scenarioRoot, 'original');
    const newDir = path.join(scenarioRoot, 'renamed');
    const originalPath = path.join(originalDir, 'file.txt');
    const newPath = path.join(newDir, 'file.txt');

    await fs.ensureDir(newDir);
    await fs.ensureDir(originalDir);
    await fs.writeFile(newPath, 'undo redo content');

    const stats = await fs.stat(newPath);
    const operation = createMoveOperation(originalPath, newPath, stats.size);
    const entry = buildHistoryEntry(operation);

    await context.historyManager.addEntry(entry);

    const undoResult = await context.historyManager.undoEntry(entry.id);
    assert.equal(undoResult.success, true);
    assert.equal(await fs.pathExists(originalPath), true, 'file restored to original path');
    assert.equal(await fs.pathExists(newPath), false, 'file removed from new path');

    const entriesAfterUndo = await context.historyManager.getEntries();
    const undoneEntry = entriesAfterUndo.find((item: HistoryEntry) => item.id === entry.id);
    assert.ok(undoneEntry);
    assert.equal(undoneEntry!.isUndone, true);
    assert.equal(undoneEntry!.canUndo, false);

    const redoResult = await context.historyManager.redoEntry(entry.id);
    assert.equal(redoResult.success, true);
    assert.equal(await fs.pathExists(newPath), true, 'file moved back to new path');
    assert.equal(await fs.pathExists(originalPath), false, 'original path cleaned up');

    const entriesAfterRedo = await context.historyManager.getEntries();
    const redoneEntry = entriesAfterRedo.find((item: HistoryEntry) => item.id === entry.id);
    assert.ok(redoneEntry);
    assert.equal(redoneEntry!.isUndone, false);
    assert.equal(redoneEntry!.canUndo, true);
  });
});
