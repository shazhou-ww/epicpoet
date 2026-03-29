/**
 * Sanitize a string for use as a filename.
 * Keeps original characters (including CJK), only replaces filesystem-unsafe chars.
 */
export function sanitizeFilename(name: string): string {
  // Replace characters not allowed in filenames: / \ : * ? " < > |
  return name.replace(/[\/\\:*?"<>|]/g, '-').trim();
}
