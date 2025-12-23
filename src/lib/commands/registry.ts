import type { Command } from "./types";

const commandRegistry: Map<string, Command> = new Map();
const commandsById: Map<string, Command> = new Map();

export function registerCommand(cmd: Command) {
  commandsById.set(cmd.id, cmd);
  commandRegistry.set(cmd.id.toLowerCase(), cmd);

  cmd.aliases.forEach((alias) => {
    commandRegistry.set(alias.toLowerCase(), cmd);
  });
}

export function getCommand(idOrAlias: string): Command | undefined {
  return commandRegistry.get(idOrAlias.toLowerCase());
}

export function getCommandById(id: string): Command | undefined {
  return commandsById.get(id);
}

export function getAllCommands(): Command[] {
  return Array.from(commandsById.values());
}

export function searchCommands(query: string): Command[] {
  if (!query.trim()) return [];

  const q = query.toLowerCase();
  const results: Command[] = [];
  const seen = new Set<string>();

  for (const cmd of commandsById.values()) {
    if (seen.has(cmd.id)) continue;

    const idMatch = cmd.id.toLowerCase().startsWith(q);
    const nameMatch = cmd.name.toLowerCase().includes(q);
    const aliasMatch = cmd.aliases.some((a) => a.toLowerCase().startsWith(q));

    if (idMatch || nameMatch || aliasMatch) {
      results.push(cmd);
      seen.add(cmd.id);
    }
  }

  return results
    .sort((a, b) => {
      const aExact =
        a.id.toLowerCase() === q ||
        a.aliases.some((al) => al.toLowerCase() === q);
      const bExact =
        b.id.toLowerCase() === q ||
        b.aliases.some((al) => al.toLowerCase() === q);
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;

      const aStarts = a.id.toLowerCase().startsWith(q);
      const bStarts = b.id.toLowerCase().startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;

      return a.name.localeCompare(b.name);
    })
    .slice(0, 10);
}

export function clearRegistry() {
  commandRegistry.clear();
  commandsById.clear();
}
