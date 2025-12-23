# Command Input System (AutoCAD-style)

## Priority: 🟠 High
## Difficulty: Hard
## Estimated Time: 6-8 hours

## Overview

Add an always-on command input system inspired by AutoCAD's Dynamic Input. Users can type commands at any time to execute operations without memorizing keyboard shortcuts.

### AutoCAD Reference (What We're Adapting)

AutoCAD's system has two parts:
1. **Command Line** - Fixed bar at bottom showing typed commands + autocomplete
2. **Dynamic Input** - Floating tooltips near cursor for values/prompts during operations

For our design canvas, we'll implement:
1. **Command Bar** - Bottom center, always visible, shows current input + suggestions
2. **Cursor Tooltip** - Shows context-aware suggestions as you type (near cursor)

## Design

### Behavior

1. **Always-on listening**: Any alphanumeric key (when not editing text) starts building a command
2. **Autocomplete**: As you type, show matching commands in a dropdown
3. **Execution**: 
   - Single unique match: Execute on Enter (or immediately if unambiguous)
   - Multiple matches: Show dropdown, use arrows to select, Enter to execute
   - Some commands take arguments (e.g., `gap 10`, `opacity 50`)
4. **Cancel**: Escape clears input and returns to previous state
5. **Focus preservation**: Canvas interactions still work while command bar is visible

### Visual Design

```
┌─────────────────────────────────────────────────────────────────┐
│                         CANVAS                                   │
│                                                                  │
│                    ┌─────────────────┐                          │
│                    │ Suggestions...  │  ← Near cursor (optional)│
│                    │ copy            │                          │
│                    │ copyStyles      │                          │
│                    └─────────────────┘                          │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ [Tools]        > cop_                    [Suggestions dropdown] │
│                  ↑ Command input         [copy] [copyStyles]    │
└─────────────────────────────────────────────────────────────────┘
```

### Command Registry Structure

```typescript
interface Command {
  id: string;                    // Unique identifier: "copy", "alignLeft"
  name: string;                  // Display name: "Copy", "Align Left"
  aliases: string[];             // Alternative triggers: ["c", "cp"]
  description?: string;          // Tooltip/help text
  category: CommandCategory;     // For grouping in help
  requiresSelection?: boolean;   // Disable if nothing selected
  execute: (args?: string) => void;  // The action
  // For commands with arguments:
  argType?: "number" | "color" | "enum";
  argOptions?: string[];         // For enum type
  argPlaceholder?: string;       // "Enter gap value..."
}

type CommandCategory = 
  | "tool"        // select, hand, frame, text
  | "clipboard"   // copy, paste, duplicate
  | "transform"   // move, align, distribute
  | "zorder"      // bringForward, sendBack
  | "layout"      // toggleFlex, frameSelection
  | "property"    // gap, opacity, radius
  | "history"     // undo, redo
  | "view"        // toggleSidebar
```

## Implementation Plan

### Phase 1: Command Registry & Infrastructure

#### 1.1 Create Command Registry (`src/lib/commands/registry.ts`)

```typescript
// Central registry of all commands
export const commandRegistry: Map<string, Command> = new Map();

// Helper to register commands
export function registerCommand(cmd: Command) {
  commandRegistry.set(cmd.id, cmd);
  // Also register aliases
  cmd.aliases.forEach(alias => {
    commandRegistry.set(alias.toLowerCase(), cmd);
  });
}

// Search commands by partial match
export function searchCommands(query: string): Command[] {
  const q = query.toLowerCase();
  const results: Command[] = [];
  const seen = new Set<string>();
  
  for (const [key, cmd] of commandRegistry) {
    if (seen.has(cmd.id)) continue;
    if (key.startsWith(q) || cmd.name.toLowerCase().includes(q)) {
      results.push(cmd);
      seen.add(cmd.id);
    }
  }
  
  return results.slice(0, 10); // Limit results
}
```

#### 1.2 Create Command Types (`src/lib/commands/types.ts`)

Define the Command interface and related types.

#### 1.3 Create Command Definitions (`src/lib/commands/definitions.ts`)

Register all existing operations as commands:

```typescript
// Tools
registerCommand({
  id: "select",
  name: "Select Tool",
  aliases: ["v", "sel"],
  category: "tool",
  execute: () => setTool("select"),
});

registerCommand({
  id: "hand",
  name: "Hand Tool",
  aliases: ["h", "pan"],
  category: "tool",
  execute: () => setTool("hand"),
});

// ... etc for all operations
```

### Phase 2: Command Input State

#### 2.1 Add Command State to Store (`src/lib/canvasStore.ts`)

```typescript
interface CommandState {
  isActive: boolean;        // Currently typing a command
  input: string;            // Current input text
  selectedIndex: number;    // Selected suggestion index
  suggestions: Command[];   // Matching commands
}

// Add to store
commandState: CommandState;
setCommandInput: (input: string) => void;
executeCommand: (commandId: string, args?: string) => void;
clearCommand: () => void;
```

### Phase 3: UI Components

#### 3.1 Command Bar Component (`src/components/CommandBar.tsx`)

```tsx
export function CommandBar() {
  const { commandState, setCommandInput, executeCommand, clearCommand } = useCanvasStore();
  const inputRef = useRef<HTMLInputElement>(null);
  
  return (
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-4">
      {/* Existing toolbar */}
      <div className="flex gap-1 p-1.5 bg-card border border-border border-b-0 rounded-t-md">
        {/* ... tool buttons ... */}
      </div>
      
      {/* Command input */}
      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border border-b-0 rounded-t-md min-w-[200px]">
          <span className="text-muted-foreground">{">"}</span>
          <input
            ref={inputRef}
            type="text"
            value={commandState.input}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Type command..."
            className="bg-transparent outline-none text-sm flex-1"
          />
        </div>
        
        {/* Suggestions dropdown */}
        {commandState.suggestions.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-full bg-popover border border-border rounded-md shadow-lg">
            {commandState.suggestions.map((cmd, idx) => (
              <button
                key={cmd.id}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-muted",
                  idx === commandState.selectedIndex && "bg-muted"
                )}
                onClick={() => executeCommand(cmd.id)}
              >
                <span className="font-medium">{cmd.name}</span>
                <span className="text-muted-foreground ml-2 text-xs">
                  {cmd.aliases[0]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

#### 3.2 Cursor Suggestions (Optional - Phase 2)

Show suggestions near cursor when typing. Lower priority.

### Phase 4: Keyboard Integration

#### 4.1 Update useKeyboardShortcuts

Modify to detect when typing should start command input vs trigger shortcuts:

```typescript
// In Canvas.tsx or new hook
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Skip if editing text or in input
    if (editingTextId || e.target instanceof HTMLInputElement) return;
    
    // Check if this is a shortcut (has modifiers)
    const hasModifier = e.metaKey || e.ctrlKey || e.altKey;
    
    // If no modifier and alphanumeric, start command input
    if (!hasModifier && /^[a-zA-Z0-9]$/.test(e.key)) {
      e.preventDefault();
      setCommandInput(e.key);
      // Focus command input
    }
  };
  
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [editingTextId]);
```

### Phase 5: Command Definitions

Complete list of commands to register:

#### Tools
| Command ID | Name | Aliases | Notes |
|------------|------|---------|-------|
| select | Select Tool | v, sel | |
| hand | Hand Tool | h, pan | |
| frame | Frame Tool | f, rect | |
| text | Text Tool | t | |
| shader | Shader Tool | s | |

#### Clipboard
| Command ID | Name | Aliases | Requires Selection |
|------------|------|---------|-------------------|
| copy | Copy | c, cp | Yes |
| paste | Paste | p, v (with meta) | No |
| duplicate | Duplicate | d, dup | Yes |
| delete | Delete | del, rm, backspace | Yes |

#### Transform/Alignment
| Command ID | Name | Aliases | Requires Selection |
|------------|------|---------|-------------------|
| alignLeft | Align Left | al | Yes |
| alignRight | Align Right | ar | Yes |
| alignTop | Align Top | at | Yes |
| alignBottom | Align Bottom | ab | Yes |
| alignCenterH | Align Center Horizontal | ach, ch | Yes |
| alignCenterV | Align Center Vertical | acv, cv | Yes |
| distributeH | Distribute Horizontal | dh | Yes (3+) |
| distributeV | Distribute Vertical | dv | Yes (3+) |

#### Z-Order
| Command ID | Name | Aliases | Requires Selection |
|------------|------|---------|-------------------|
| bringToFront | Bring to Front | front, btf | Yes |
| sendToBack | Send to Back | back, stb | Yes |
| bringForward | Bring Forward | forward, bf | Yes |
| sendBackward | Send Backward | backward, sb | Yes |

#### Layout
| Command ID | Name | Aliases | Requires Selection |
|------------|------|---------|-------------------|
| toggleFlex | Toggle Flex Layout | flex, autolayout | Yes (frame) |
| frameSelection | Frame Selection | group, frame | Yes |
| toggleClip | Toggle Clip Content | clip | Yes (frame) |

#### Property Commands (with arguments)
| Command ID | Name | Aliases | Arg Type | Example |
|------------|------|---------|----------|---------|
| gap | Set Gap | g | number | `gap 10` |
| opacity | Set Opacity | op | number (0-100) | `opacity 50` |
| radius | Set Radius | rad, r | number | `radius 8` |
| rotate | Rotate | rot | number | `rotate 45` |
| width | Set Width | w | number | `width 200` |
| height | Set Height | h | number | `height 100` |

#### History
| Command ID | Name | Aliases |
|------------|------|---------|
| undo | Undo | u, z |
| redo | Redo | y, rz |

#### View
| Command ID | Name | Aliases |
|------------|------|---------|
| toggleSidebar | Toggle Sidebar | sidebar |
| selectAll | Select All | all, sa |

## Files to Create

- `src/lib/commands/types.ts` - Type definitions
- `src/lib/commands/registry.ts` - Command registry
- `src/lib/commands/definitions.ts` - All command definitions
- `src/lib/commands/index.ts` - Barrel export
- `src/components/CommandBar.tsx` - UI component

## Files to Modify

- `src/lib/canvasStore.ts` - Add command state
- `src/components/Canvas.tsx` - Integrate CommandBar, update keyboard handling
- `src/lib/useKeyboardShortcuts.ts` - Coordinate with command system

## Testing

- [ ] Typing "v" activates select tool
- [ ] Typing "cop" shows "copy" and "copyStyles" suggestions
- [ ] Arrow keys navigate suggestions
- [ ] Enter executes selected command
- [ ] Escape clears command input
- [ ] `gap 10` sets gap on selected flex frame
- [ ] Commands that require selection are disabled when nothing selected
- [ ] Existing shortcuts still work (Cmd+C, etc.)
- [ ] Text editing mode disables command input
- [ ] Undo/redo works with command execution

## Future Enhancements

- [ ] Command history (up arrow to repeat last command)
- [ ] Cursor-following suggestions
- [ ] Help command (`help align` shows alignment commands)
- [ ] Custom aliases (user-defined)
- [ ] Command chaining (`copy; paste; move 10 10`)
