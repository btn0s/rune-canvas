import { create } from "zustand";
import type { CanvasObject, Tool, Transform } from "./types";

type SceneState = {
  objects: CanvasObject[];
  selectedIds: string[];
  transform: Transform;
  tool: Tool;
  editingTextId: string | null;
};

type SceneUpdate<T> = T | ((prev: T) => T);

interface CanvasStoreState extends SceneState {
  history: {
    past: SceneState[];
    future: SceneState[];
  };
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
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
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
});

const getScene = (state: CanvasStoreState): SceneState => ({
  objects: state.objects,
  selectedIds: state.selectedIds,
  transform: state.transform,
  tool: state.tool,
  editingTextId: state.editingTextId,
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
  tool: "frame",
  editingTextId: null,
  history: { past: [], future: [] },
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
}));

export type { CanvasStoreState, SceneState as CanvasSceneState };

