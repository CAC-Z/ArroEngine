export const getOperators = (t: (key: string) => string) => ({
  string: [
    { value: 'contains', label: t('condition.operator.contains') },
    { value: 'notContains', label: t('condition.operator.notContains') },
    { value: 'equals', label: t('condition.operator.equals') },
    { value: 'notEquals', label: t('condition.operator.notEquals') },
    { value: 'startsWith', label: t('condition.operator.startsWith') },
    { value: 'notStartsWith', label: t('condition.operator.notStartsWith') },
    { value: 'endsWith', label: t('condition.operator.endsWith') },
    { value: 'notEndsWith', label: t('condition.operator.notEndsWith') },
    { value: 'regex', label: t('condition.operator.regex') },
  ],
  number: [
    { value: 'equals', label: t('condition.operator.equals') },
    { value: 'notEquals', label: t('condition.operator.notEquals') },
    { value: 'greaterThan', label: t('condition.operator.greaterThan') },
    { value: 'lessThan', label: t('condition.operator.lessThan') },
    { value: 'greaterThanOrEqual', label: t('condition.operator.greaterThanOrEqual') },
    { value: 'lessThanOrEqual', label: t('condition.operator.lessThanOrEqual') },
  ],
  date: [
    { value: 'equals', label: t('condition.operator.equals') },
    { value: 'notEquals', label: t('condition.operator.notEquals') },
    { value: 'greaterThan', label: t('condition.operator.laterThan') },
    { value: 'lessThan', label: t('condition.operator.earlierThan') },
    { value: 'greaterThanOrEqual', label: t('condition.operator.notEarlierThan') },
    { value: 'lessThanOrEqual', label: t('condition.operator.notLaterThan') },
  ],
  enum: [
    { value: 'equals', label: t('condition.operator.equals') },
    { value: 'notEquals', label: t('condition.operator.notEquals') },
    { value: 'in', label: t('condition.operator.in') },
    { value: 'notIn', label: t('condition.operator.notIn') },
  ],
  boolean: [
    { value: 'is', label: t('condition.operator.is') },
  ],
})
