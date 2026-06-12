const ORACLE_IDENTIFIER_MAX_LENGTH = 128;

export type OracleRowLike = Record<string, unknown>;

export const oracleErrorCode = (
  error: unknown
): number | string | undefined => {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { errorNum?: number; code?: number | string })
    .errorNum;
  return code ?? (error as { code?: number | string }).code;
};

export const isOracleError = (error: unknown, code: number): boolean => {
  const actual = oracleErrorCode(error);
  return actual === code || actual === `ORA-${String(code).padStart(5, "0")}`;
};

export const rowValue = <T>(row: OracleRowLike, key: string): T =>
  (row[key] ?? row[key.toUpperCase()]) as T;

export const optionalRowValue = <T>(
  row: OracleRowLike,
  key: string
): T | undefined => rowValue<T | undefined>(row, key);

export const oracleConstraintName = (
  tableName: string,
  suffix: string
): string => {
  const maxPrefixLength = ORACLE_IDENTIFIER_MAX_LENGTH - suffix.length - 1;
  return `${tableName.slice(0, maxPrefixLength)}_${suffix}`;
};
