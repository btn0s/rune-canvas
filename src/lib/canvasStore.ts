import { create } from "zustand";
import type { CanvasObject, Tool, Transform } from "./types";
import type { Command, CommandState } from "./commands/types";
import { initialCommandState } from "./commands/types";
import { searchCommands } from "./commands/registry";

type SceneState = {
  objects: CanvasObject[];
  selectedIds: string[];
  transform: Transform;
  tool: Tool;
  editingTextId: string | null;
  canvasBackground: string;
};

type SceneUpdate<T> = T | ((prev: T) => T);

interface CanvasStoreState extends SceneState {
  history: {
    past: SceneState[];
    future: SceneState[];
  };
  commandState: CommandState;
  setScene: (
    updater:
      | Partial<SceneState>
      | ((scene: SceneState) => Partial<SceneState> | SceneState),
    options?: SceneUpdateOptions
  ) => void;
  setObjects: (
    value: SceneUpdate<CanvasObject[]>,
    options?: SceneUpdateOptions
  ) => void;
  setSelectedIds: (
    value: SceneUpdate<string[]>,
    options?: SceneUpdateOptions
  ) => void;
  setTransform: (
    value: SceneUpdate<Transform>,
    options?: SceneUpdateOptions
  ) => void;
  setTool: (value: SceneUpdate<Tool>, options?: SceneUpdateOptions) => void;
  setEditingTextId: (
    value: SceneUpdate<string | null>,
    options?: SceneUpdateOptions
  ) => void;
  setCanvasBackground: (
    value: SceneUpdate<string>,
    options?: SceneUpdateOptions
  ) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  setCommandInput: (input: string) => void;
  setCommandActive: (active: boolean) => void;
  setCommandSelectedIndex: (index: number) => void;
  setPendingCommand: (cmd: Command | null) => void;
  setPendingIndexItems: (items: { index: number; label: string }[] | null) => void;
  setPendingIndex: (index: number | null) => void;
  clearCommand: () => void;
}

type SceneUpdateOptions = {
  commit?: boolean;
};

const HISTORY_LIMIT = 50;

const cloneScene = (scene: SceneState): SceneState => ({
  objects: scene.objects.map((obj) => ({ ...obj })),
  selectedIds: [...scene.selectedIds],
  transform: { ...scene.transform },
  tool: scene.tool,
  editingTextId: scene.editingTextId,
  canvasBackground: scene.canvasBackground,
});

const getScene = (state: CanvasStoreState): SceneState => ({
  objects: state.objects,
  selectedIds: state.selectedIds,
  transform: state.transform,
  tool: state.tool,
  editingTextId: state.editingTextId,
  canvasBackground: state.canvasBackground,
});

const resolveUpdate = <T>(value: SceneUpdate<T>, prev: T): T =>
  typeof value === "function" ? (value as (prevValue: T) => T)(prev) : value;

const pushPast = (past: SceneState[], snapshot: SceneState) => {
  const updated = [...past, snapshot];
  if (updated.length > HISTORY_LIMIT) {
    updated.shift();
  }
  return updated;
};

export const useCanvasStore = create<CanvasStoreState>((set, get) => ({
  objects: [],
  selectedIds: [],
  transform: { x: 0, y: 0, scale: 1 },
  tool: "select",
  editingTextId: null,
  canvasBackground: "#0a0a0a",
  history: { past: [], future: [] },
  commandState: initialCommandState,
  setScene: (updater, options = {}) =>
    set((state) => {
      const currentScene = getScene(state);
      const patch =
        typeof updater === "function"
          ? (
              updater as (scene: SceneState) => Partial<SceneState> | SceneState
            )(currentScene)
          : updater;

      if (!patch) {
        return state;
      }

      const nextScene = { ...currentScene, ...patch };
      const history = options.commit
        ? {
            past: pushPast(state.history.past, cloneScene(currentScene)),
            future: [],
          }
        : state.history;

      return {
        ...state,
        ...nextScene,
        history,
      };
    }),
  setObjects: (value, options) =>
    get().setScene(
      (scene) => ({
        objects: resolveUpdate(value, scene.objects),
      }),
      options
    ),
  setSelectedIds: (value, options) =>
    get().setScene(
      (scene) => ({
        selectedIds: resolveUpdate(value, scene.selectedIds),
      }),
      options
    ),
  setTransform: (value, options) =>
    get().setScene(
      (scene) => ({
        transform: resolveUpdate(value, scene.transform),
      }),
      options
    ),
  setTool: (value, options) =>
    get().setScene(
      (scene) => ({
        tool: resolveUpdate(value, scene.tool),
      }),
      options
    ),
  setEditingTextId: (value, options) =>
    get().setScene(
      (scene) => ({
        editingTextId: resolveUpdate(value, scene.editingTextId),
      }),
      options
    ),
  setCanvasBackground: (value, options) =>
    get().setScene(
      (scene) => ({
        canvasBackground: resolveUpdate(value, scene.canvasBackground),
      }),
      options
    ),
  pushHistory: () =>
    set((state) => {
      const snapshot = cloneScene(getScene(state));
      return {
        ...state,
        history: {
          past: pushPast(state.history.past, snapshot),
          future: [],
        },
      };
    }),
  undo: () =>
    set((state) => {
      if (state.history.past.length === 0) {
        return state;
      }
      const previous = state.history.past[state.history.past.length - 1];
      const newPast = state.history.past.slice(0, -1);
      const currentSnapshot = cloneScene(getScene(state));
      return {
        ...state,
        ...cloneScene(previous),
        history: {
          past: newPast,
          future: [currentSnapshot, ...state.history.future].slice(
            0,
            HISTORY_LIMIT
          ),
        },
      };
    }),
  redo: () =>
    set((state) => {
      if (state.history.future.length === 0) {
        return state;
      }
      const [next, ...restFuture] = state.history.future;
      const currentSnapshot = cloneScene(getScene(state));
      return {
        ...state,
        ...cloneScene(next),
        history: {
          past: pushPast(state.history.past, currentSnapshot),
          future: restFuture,
        },
      };
    }),
  canUndo: () => get().history.past.length > 0,
  canRedo: () => get().history.future.length > 0,
  setCommandInput: (input: string) =>
    set((state) => {
      const suggestions = input.trim() ? searchCommands(input.trim()) : [];
      return {
        commandState: {
          ...state.commandState,
          isActive: true,
          input,
          suggestions,
          selectedIndex: 0,
        },
      };
    }),
  setCommandActive: (active: boolean) =>
    set((state) => ({
      commandState: {
        ...state.commandState,
        isActive: active,
      },
    })),
  setCommandSelectedIndex: (index: number) =>
    set((state) => ({
      commandState: {
        ...state.commandState,
        selectedIndex: Math.max(
          0,
          Math.min(index, state.commandState.suggestions.length - 1)
        ),
      },
    })),
  setPendingCommand: (cmd: Command | null) =>
    set((state) => ({
      commandState: {
        ...state.commandState,
        pendingCommand: cmd,
        input: cmd ? "" : state.commandState.input,
        pendingIndexItems: null,
        pendingIndex: null,
      },
    })),
  setPendingIndexItems: (items) =>
    set((state) => ({
      commandState: {
        ...state.commandState,
        pendingIndexItems: items,
        selectedIndex: 0,
      },
    })),
  setPendingIndex: (index) =>
    set((state) => ({
      commandState: {
        ...state.commandState,
        pendingIndex: index,
        pendingIndexItems: null,
        input: "",
      },
    })),
  clearCommand: () =>
    set(() => ({
      commandState: initialCommandState,
    })),
}));

export type { CanvasStoreState, SceneState as CanvasSceneState };

