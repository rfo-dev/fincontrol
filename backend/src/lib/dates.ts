/** Parse YYYY-MM-DD (or ISO) into a UTC Date suitable for Prisma @db.Date */
export function parseDateOnly(input: string | Date): Date {
  if (input instanceof Date) {
    return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  }

  const match = String(input).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  }

  const fallback = new Date(input);
  return new Date(Date.UTC(fallback.getUTCFullYear(), fallback.getUTCMonth(), fallback.getUTCDate()));
}

/** Format Prisma DATE as YYYY-MM-DD for the API */
export function formatDateOnly(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
