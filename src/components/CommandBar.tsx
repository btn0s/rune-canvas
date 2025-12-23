import { useRef, useEffect, useCallback, useMemo } from "react";
import { useCanvasStore } from "../lib/canvasStore";
import type {
  Command,
  CommandContext,
  IndexedPropertyItem,
} from "../lib/commands/types";
import type { FrameObject } from "../lib/types";
import { cn } from "@/lib/utils";

interface CommandBarProps {
  context: CommandContext;
}

function isCommandAvailable(cmd: Command, context: CommandContext): boolean {
  if (cmd.requiresSelection && context.selectedIds.length === 0) {
    return false;
  }
  if (cmd.minSelection && context.selectedIds.length < cmd.minSelection) {
    return false;
  }
  if (cmd.requiresType) {
    const hasValidType = context.selectedObjects.some((obj) =>
      cmd.requiresType!.includes(obj.type as "frame" | "text" | "image")
    );
    if (!hasValidType) return false;
  }
  return true;
}

function getIndexedItems(
  cmd: Command,
  context: CommandContext
): IndexedPropertyItem[] | null {
  if (!cmd.indexedProperty) return null;

  const frames = context.selectedObjects.filter(
    (o) => o.type === "frame"
  ) as FrameObject[];
  if (frames.length === 0) return null;

  const frame = frames[0];
  const { property, getLabel } = cmd.indexedProperty;

  let items: unknown[] = [];
  if (property === "fills") {
    items = frame.fills || [];
  } else if (property === "shadows") {
    items = frame.shadows || [];
  } else if (property === "innerShadows") {
    items = frame.innerShadows || [];
  }

  if (items.length <= 1) return null;

  return items.map((item, idx) => ({
    index: idx,
    label: getLabel(item, idx),
  }));
}

export function CommandBar({ context }: CommandBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    commandState,
    setCommandInput,
    setCommandSelectedIndex,
    setPendingCommand,
    setPendingIndexItems,
    setPendingIndex,
    clearCommand,
  } = useCanvasStore();

  const {
    isActive,
    input,
    suggestions,
    selectedIndex,
    pendingCommand,
    pendingIndexItems,
    pendingIndex,
  } = commandState;

  const availableSuggestions = useMemo(
    () => suggestions.filter((cmd) => isCommandAvailable(cmd, context)),
    [suggestions, context]
  );

  const executeCommand = useCallback(
    (cmd: Command, args?: string, index?: number) => {
      if (cmd.requiresSelection && context.selectedIds.length === 0) {
        return;
      }
      if (cmd.minSelection && context.selectedIds.length < cmd.minSelection) {
        return;
      }
      if (cmd.requiresType) {
        const hasValidType = context.selectedObjects.some((obj) =>
          cmd.requiresType!.includes(obj.type as "frame" | "text" | "image")
        );
        if (!hasValidType) return;
      }

      cmd.execute(context, args, index);
      clearCommand();
    },
    [context, clearCommand]
  );

  const startCommand = useCallback(
    (cmd: Command) => {
      const indexedItems = getIndexedItems(cmd, context);
      if (indexedItems && indexedItems.length > 1) {
        setPendingCommand(cmd);
        setPendingIndexItems(indexedItems);
      } else if (cmd.argType) {
        setPendingCommand(cmd);
      } else {
        executeCommand(cmd, undefined, indexedItems?.[0]?.index ?? 0);
      }
    },
    [context, setPendingCommand, setPendingIndexItems, executeCommand]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        clearCommand();
        inputRef.current?.blur();
        return;
      }

      if (pendingIndexItems) {
        const maxIdx = pendingIndexItems.length - 1;
        const clampedIdx = Math.min(selectedIndex, Math.max(0, maxIdx));

        if (e.key === "ArrowDown") {
          e.preventDefault();
          setCommandSelectedIndex(Math.min(clampedIdx + 1, maxIdx));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setCommandSelectedIndex(Math.max(clampedIdx - 1, 0));
          return;
        }
        if (e.key === "Enter" && pendingCommand) {
          e.preventDefault();
          const selectedItem = pendingIndexItems[clampedIdx];
          if (selectedItem !== undefined) {
            if (pendingCommand.argType) {
              setPendingIndex(selectedItem.index);
            } else {
              executeCommand(pendingCommand, undefined, selectedItem.index);
            }
          }
          return;
        }
        return;
      }

      const clampedIdx = Math.min(
        selectedIndex,
        Math.max(0, availableSuggestions.length - 1)
      );

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCommandSelectedIndex(
          Math.min(clampedIdx + 1, availableSuggestions.length - 1)
        );
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCommandSelectedIndex(Math.max(clampedIdx - 1, 0));
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();

        if (pendingCommand && pendingIndex !== null) {
          executeCommand(pendingCommand, input, pendingIndex);
          return;
        }

        if (pendingCommand) {
          executeCommand(pendingCommand, input, 0);
          return;
        }

        if (availableSuggestions.length > 0) {
          const cmd = availableSuggestions[clampedIdx];
          if (cmd) {
            startCommand(cmd);
          }
        }
        return;
      }

      if (e.key === "Tab" && availableSuggestions.length > 0) {
        e.preventDefault();
        const cmd = availableSuggestions[clampedIdx];
        if (cmd) {
          setCommandInput(cmd.id);
        }
        return;
      }
    },
    [
      availableSuggestions,
      pendingIndexItems,
      pendingIndex,
      selectedIndex,
      pendingCommand,
      input,
      setCommandSelectedIndex,
      setCommandInput,
      setPendingIndex,
      startCommand,
      executeCommand,
      clearCommand,
    ]
  );

  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  const showSuggestions =
    isActive && availableSuggestions.length > 0 && !pendingCommand;
  const showIndexPicker = isActive && pendingIndexItems && pendingIndexItems.length > 0;
  const showArgInput = isActive && pendingCommand && !pendingIndexItems;

  const clampedSelectedIndex = Math.min(
    selectedIndex,
    Math.max(
      0,
      (pendingIndexItems?.length ?? availableSuggestions.length) - 1
    )
  );

  const getPromptText = () => {
    if (pendingIndexItems) return `${pendingCommand?.name} - Select:`;
    if (pendingCommand) return `${pendingCommand.name}:`;
    return ">";
  };

  return (
    <div className="relative">
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 bg-card border border-border border-b-0 rounded-t-md min-w-[200px] transition-colors",
          isActive && "border-primary/50"
        )}
      >
        <span className="text-muted-foreground text-sm">{getPromptText()}</span>
        {showArgInput && (
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              setTimeout(() => {
                if (!inputRef.current?.matches(":focus")) {
                  clearCommand();
                }
              }, 150);
            }}
            placeholder={pendingCommand?.argPlaceholder || "Enter value..."}
            className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground/50"
          />
        )}
        {!showArgInput && (
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              setTimeout(() => {
                if (!inputRef.current?.matches(":focus")) {
                  clearCommand();
                }
              }, 150);
            }}
            placeholder="Type a command..."
            className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground/50"
            style={{ display: pendingIndexItems ? "none" : undefined }}
          />
        )}
      </div>

      {showIndexPicker && (
        <div className="absolute bottom-full left-0 mb-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-[300px] overflow-y-auto">
          {pendingIndexItems.map((item, idx) => (
            <button
              key={item.index}
              className={cn(
                "w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors",
                idx === clampedSelectedIndex ? "bg-muted" : "hover:bg-muted/50"
              )}
              onClick={() => {
                if (pendingCommand?.argType) {
                  setPendingIndex(item.index);
                  inputRef.current?.focus();
                } else if (pendingCommand) {
                  executeCommand(pendingCommand, undefined, item.index);
                }
              }}
              onMouseEnter={() => setCommandSelectedIndex(idx)}
            >
              <span className="text-muted-foreground font-mono text-xs w-4">
                {item.index + 1}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      {showSuggestions && (
        <div className="absolute bottom-full left-0 mb-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-[300px] overflow-y-auto">
          {availableSuggestions.map((cmd, idx) => (
            <button
              key={cmd.id}
              className={cn(
                "w-full px-3 py-2 text-left text-sm flex items-center justify-between gap-2 transition-colors",
                idx === clampedSelectedIndex ? "bg-muted" : "hover:bg-muted/50"
              )}
              onClick={() => {
                startCommand(cmd);
                inputRef.current?.focus();
              }}
              onMouseEnter={() => setCommandSelectedIndex(idx)}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{cmd.name}</span>
                {cmd.argType && (
                  <span className="text-xs text-muted-foreground">
                    (needs value)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">
                  {cmd.aliases[0]}
                </span>
                {cmd.shortcutHint && (
                  <span className="text-xs text-muted-foreground/60">
                    {cmd.shortcutHint}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function useCommandKeyCapture(editingTextId: string | null) {
  const { commandState, setCommandInput, setCommandActive } = useCanvasStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingTextId) return;
      if (e.target instanceof HTMLInputElement) return;
      if (e.target instanceof HTMLTextAreaElement) return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      if (commandState.isActive) return;

      const hasModifier = e.metaKey || e.ctrlKey || e.altKey;
      if (hasModifier) return;

      if (/^[a-zA-Z0-9]$/.test(e.key)) {
        e.preventDefault();
        setCommandActive(true);
        setCommandInput(e.key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingTextId, commandState.isActive, setCommandInput, setCommandActive]);
}
