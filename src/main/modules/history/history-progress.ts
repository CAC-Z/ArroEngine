export function createProgressTracker(operationName: string, totalSteps: number) {
  const startTime = Date.now();

  return {
    updateProgress(currentStep: number, stepName: string, status: 'success' | 'error' | 'warning' = 'success') {
      const percentage = Math.round((currentStep / totalSteps) * 100);
      const statusIcon = status === 'success' ? '✅' : status === 'error' ? '❌' : '⚠️';
      const elapsed = Date.now() - startTime;
      const estimatedTotal = totalSteps > 0 ? (elapsed / currentStep) * totalSteps : 0;
      const remaining = Math.max(0, estimatedTotal - elapsed);

      console.log(`[${operationName}] ${statusIcon} ${percentage}% (${currentStep}/${totalSteps}) - ${stepName}`);

      if (remaining > 1000) {
        const remainingSeconds = Math.round(remaining / 1000);
        console.log(`   ⏱️ 预计剩余时间: ${remainingSeconds}秒`);
      }
    },

    complete(summary: { success: number; errors: number; warnings: number }) {
      const totalTime = Date.now() - startTime;
      const timeStr = totalTime > 1000 ? `${(totalTime / 1000).toFixed(1)}秒` : `${totalTime}毫秒`;

      console.log(`\n🎯 ${operationName}完成 - 用时: ${timeStr}`);
      console.log(`   ✅ 成功: ${summary.success}个`);
      if (summary.warnings > 0) {
        console.log(`   ⚠️ 警告: ${summary.warnings}个`);
      }
      if (summary.errors > 0) {
        console.log(`   ❌ 错误: ${summary.errors}个`);
      }
    },

    error(error: string) {
      const totalTime = Date.now() - startTime;
      const timeStr = totalTime > 1000 ? `${(totalTime / 1000).toFixed(1)}秒` : `${totalTime}毫秒`;

      console.error(`\n💥 ${operationName}失败 - 用时: ${timeStr}`);
      console.error(`   错误: ${error}`);
    }
  };
}
