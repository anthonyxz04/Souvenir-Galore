/**
 * CSV helpers. Cells that start with = + - @ (or tab/CR) are prefixed with an
 * apostrophe so spreadsheet apps don't execute them as formulas (CSV injection).
 */
export function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function csvRow(values: (string | number | null | undefined)[]): string {
  return values.map(csvCell).join(",");
}
