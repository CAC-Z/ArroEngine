export interface ValidationIssue {
  type: 'no_matching_files' | 'invalid_configuration';
  stepId: string;
  stepName: string;
  processTarget: 'files' | 'folders' | 'mixed';
  message: string;
  suggestion: string;
}
