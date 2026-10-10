/** Escape LIKE wildcards so user text is matched literally. */
export function likeEscape(input: string): string {
  return input.replace(/[\%_]/g, (c) => `\${c}`);
}

export const contains = (input: string) => `%${likeEscape(input)}%`;
export const startsWith = (input: string) => `${likeEscape(input)}%`;
