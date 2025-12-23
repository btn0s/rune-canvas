/**
 * Command System Types
 *
 * AutoCAD-inspired command input system for the design canvas.
 * Commands can be invoked by typing in the command bar.
 */

export type CommandCategory =
  | "tool" // select, hand, frame, text
  | "clipboard" // copy, paste, duplicate
  | "transform" // move, align, distribute
  | "zorder" // bringForward, sendBack
  | "layout" // toggleFlex, frameSelection
  | "property" // gap, opacity, radius
  | "history" // undo, redo
  | "view"; // toggleSidebar, zoom

export type CommandArgType = "number" | "color" | "enum" | "string";

export interface IndexedPropertyConfig {
  property: "fills" | "shadows" | "innerShadows";
  getLabel: (item: unknown, index: number) => string;
}

export interface Command {
  /** Unique identifier: "copy", "alignLeft" */
  id: string;

  /** Display name: "Copy", "Align Left" */
  name: string;

  /** Alternative triggers: ["c", "cp"] */
  aliases: string[];

  /** Tooltip/help text */
  description?: string;

  /** For grouping in help/suggestions */
  category: CommandCategory;

  /** Disable if nothing selected */
  requiresSelection?: boolean;

  /** Minimum selection count (e.g., distribute needs 3+) */
  minSelection?: number;

  /** Required object type(s) for this command */
  requiresType?: ("frame" | "text" | "image")[];

  /** The action to execute - index is provided for indexed property commands */
  execute: (ctx: CommandContext, args?: string, index?: number) => void;

  /** For commands with arguments */
  argType?: CommandArgType;

  /** For enum type arguments */
  argOptions?: string[];

  /** Placeholder text: "Enter gap value..." */
  argPlaceholder?: string;

  /** Keyboard shortcut hint for display */
  shortcutHint?: string;

  /** For commands that operate on array properties (fills, shadows) */
  indexedProperty?: IndexedPropertyConfig;
}

/**
 * Context passed to command execute functions
 * Provides access to canvas state and actions
 */
export interface CommandContext {
  // Selection state
  selectedIds: string[];
  selectedObjects: import("../types").CanvasObject[];

  // All objects
  objects: import("../types").CanvasObject[];

  // Actions from useCanvas
  setTool: (tool: import("../types").Tool) => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  selectAllSiblings: () => void;

  // Alignment
  alignLeft: () => void;
  alignRight: () => void;
  alignTop: () => void;
  alignBottom: () => void;
  alignCenterH: () => void;
  alignCenterV: () => void;
  distributeHorizontal: () => void;
  distributeVertical: () => void;

  // Z-order
  bringToFront: () => void;
  sendToBack: () => void;
  bringForward: () => void;
  sendBackward: () => void;

  // Layout
  frameSelection: (options?: { layoutMode?: "none" | "flex" | "grid" }) => void;

  // History
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Object updates
  updateObject: (
    id: string,
    updates: Partial<import("../types").CanvasObject>
  ) => void;

  // Store actions
  setSelectedIds: (ids: string[]) => void;
}

export interface IndexedPropertyItem {
  index: number;
  label: string;
}

export interface CommandState {
  isActive: boolean;
  input: string;
  selectedIndex: number;
  suggestions: Command[];
  pendingCommand: Command | null;
  pendingIndexItems: IndexedPropertyItem[] | null;
  pendingIndex: number | null;
}

export const initialCommandState: CommandState = {
  isActive: false,
  input: "",
  selectedIndex: 0,
  suggestions: [],
  pendingCommand: null,
  pendingIndexItems: null,
  pendingIndex: null,
};
