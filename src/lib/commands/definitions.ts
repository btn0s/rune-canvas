import type { Command } from "./types";
import { registerCommand } from "./registry";
import { createShadow, createInnerShadow } from "../types";

function defineCommand(cmd: Command) {
  registerCommand(cmd);
  return cmd;
}

// =============================================================================
// TOOLS
// =============================================================================

defineCommand({
  id: "select",
  name: "Select Tool",
  aliases: ["v", "sel"],
  category: "tool",
  shortcutHint: "V",
  execute: (ctx) => ctx.setTool("select"),
});

defineCommand({
  id: "hand",
  name: "Hand Tool",
  aliases: ["h", "pan"],
  category: "tool",
  shortcutHint: "H",
  execute: (ctx) => ctx.setTool("hand"),
});

defineCommand({
  id: "frame",
  name: "Frame Tool",
  aliases: ["f", "rect", "rectangle"],
  category: "tool",
  shortcutHint: "F",
  execute: (ctx) => ctx.setTool("frame"),
});

defineCommand({
  id: "text",
  name: "Text Tool",
  aliases: ["t", "type"],
  category: "tool",
  shortcutHint: "T",
  execute: (ctx) => ctx.setTool("text"),
});

// =============================================================================
// CLIPBOARD
// =============================================================================

defineCommand({
  id: "copy",
  name: "Copy",
  aliases: ["c", "cp"],
  category: "clipboard",
  requiresSelection: true,
  shortcutHint: "⌘C",
  execute: (ctx) => ctx.copySelected(),
});

defineCommand({
  id: "paste",
  name: "Paste",
  aliases: ["p"],
  category: "clipboard",
  shortcutHint: "⌘V",
  execute: (ctx) => ctx.pasteClipboard(),
});

defineCommand({
  id: "duplicate",
  name: "Duplicate",
  aliases: ["d", "dup"],
  category: "clipboard",
  requiresSelection: true,
  shortcutHint: "⌘D",
  execute: (ctx) => ctx.duplicateSelected(),
});

defineCommand({
  id: "delete",
  name: "Delete",
  aliases: ["del", "rm", "remove"],
  category: "clipboard",
  requiresSelection: true,
  shortcutHint: "⌫",
  execute: (ctx) => ctx.deleteSelected(),
});

// =============================================================================
// ALIGNMENT
// =============================================================================

defineCommand({
  id: "alignLeft",
  name: "Align Left",
  aliases: ["al", "left"],
  category: "transform",
  requiresSelection: true,
  execute: (ctx) => ctx.alignLeft(),
});

defineCommand({
  id: "alignRight",
  name: "Align Right",
  aliases: ["ar", "right"],
  category: "transform",
  requiresSelection: true,
  execute: (ctx) => ctx.alignRight(),
});

defineCommand({
  id: "alignTop",
  name: "Align Top",
  aliases: ["at", "top"],
  category: "transform",
  requiresSelection: true,
  execute: (ctx) => ctx.alignTop(),
});

defineCommand({
  id: "alignBottom",
  name: "Align Bottom",
  aliases: ["ab", "bottom"],
  category: "transform",
  requiresSelection: true,
  execute: (ctx) => ctx.alignBottom(),
});

defineCommand({
  id: "alignCenterH",
  name: "Align Center Horizontal",
  aliases: ["ach", "centerh", "ch"],
  category: "transform",
  requiresSelection: true,
  execute: (ctx) => ctx.alignCenterH(),
});

defineCommand({
  id: "alignCenterV",
  name: "Align Center Vertical",
  aliases: ["acv", "centerv", "cv"],
  category: "transform",
  requiresSelection: true,
  execute: (ctx) => ctx.alignCenterV(),
});

defineCommand({
  id: "distributeH",
  name: "Distribute Horizontal",
  aliases: ["dh", "disth"],
  category: "transform",
  requiresSelection: true,
  minSelection: 3,
  execute: (ctx) => ctx.distributeHorizontal(),
});

defineCommand({
  id: "distributeV",
  name: "Distribute Vertical",
  aliases: ["dv", "distv"],
  category: "transform",
  requiresSelection: true,
  minSelection: 3,
  execute: (ctx) => ctx.distributeVertical(),
});

// =============================================================================
// Z-ORDER
// =============================================================================

defineCommand({
  id: "bringToFront",
  name: "Bring to Front",
  aliases: ["front", "btf"],
  category: "zorder",
  requiresSelection: true,
  shortcutHint: "⌘]",
  execute: (ctx) => ctx.bringToFront(),
});

defineCommand({
  id: "sendToBack",
  name: "Send to Back",
  aliases: ["back", "stb"],
  category: "zorder",
  requiresSelection: true,
  shortcutHint: "⌘[",
  execute: (ctx) => ctx.sendToBack(),
});

defineCommand({
  id: "bringForward",
  name: "Bring Forward",
  aliases: ["forward", "bf"],
  category: "zorder",
  requiresSelection: true,
  shortcutHint: "⌥⌘]",
  execute: (ctx) => ctx.bringForward(),
});

defineCommand({
  id: "sendBackward",
  name: "Send Backward",
  aliases: ["backward", "sb"],
  category: "zorder",
  requiresSelection: true,
  shortcutHint: "⌥⌘[",
  execute: (ctx) => ctx.sendBackward(),
});

// =============================================================================
// LAYOUT
// =============================================================================

defineCommand({
  id: "frameSelection",
  name: "Frame Selection",
  aliases: ["group", "wrap"],
  category: "layout",
  requiresSelection: true,
  shortcutHint: "⌘G",
  execute: (ctx) => ctx.frameSelection(),
});

defineCommand({
  id: "addFlex",
  name: "Add Flex Layout",
  aliases: ["flex", "autolayout", "auto"],
  category: "layout",
  requiresSelection: true,
  shortcutHint: "⇧A",
  execute: (ctx) => {
    if (ctx.selectedIds.length === 1) {
      const obj = ctx.selectedObjects[0];
      if (obj.type === "frame") {
        ctx.updateObject(obj.id, {
          layoutMode: "flex",
          flexDirection: "row",
          justifyContent: "flex-start",
          alignItems: "flex-start",
          flexWrap: "nowrap",
          gap: 0,
          widthMode: "fit",
          heightMode: "fit",
        });
        return;
      }
    }
    ctx.frameSelection({ layoutMode: "flex" });
  },
});

defineCommand({
  id: "toggleClip",
  name: "Toggle Clip Content",
  aliases: ["clip"],
  category: "layout",
  requiresSelection: true,
  requiresType: ["frame"],
  shortcutHint: "⌥C",
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame") {
        ctx.updateObject(obj.id, { clipContent: !obj.clipContent });
      }
    });
  },
});

// =============================================================================
// PROPERTY COMMANDS (with arguments)
// =============================================================================

defineCommand({
  id: "gap",
  name: "Set Gap",
  aliases: ["g"],
  category: "property",
  requiresSelection: true,
  requiresType: ["frame"],
  argType: "number",
  argPlaceholder: "Enter gap value...",
  execute: (ctx, args) => {
    const value = args ? parseFloat(args) : 0;
    if (isNaN(value)) return;
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame" && obj.layoutMode === "flex") {
        ctx.updateObject(obj.id, { gap: Math.max(0, value) });
      }
    });
  },
});

defineCommand({
  id: "opacity",
  name: "Set Opacity",
  aliases: ["op", "alpha"],
  category: "property",
  requiresSelection: true,
  argType: "number",
  argPlaceholder: "Enter opacity (0-100)...",
  execute: (ctx, args) => {
    const value = args ? parseFloat(args) : 100;
    if (isNaN(value)) return;
    const opacity = Math.max(0, Math.min(100, value)) / 100;
    ctx.selectedObjects.forEach((obj) => {
      ctx.updateObject(obj.id, { opacity });
    });
  },
});

defineCommand({
  id: "radius",
  name: "Set Radius",
  aliases: ["rad", "r", "corner"],
  category: "property",
  requiresSelection: true,
  requiresType: ["frame"],
  argType: "number",
  argPlaceholder: "Enter radius value...",
  execute: (ctx, args) => {
    const value = args ? parseFloat(args) : 0;
    if (isNaN(value)) return;
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame") {
        ctx.updateObject(obj.id, { radius: Math.max(0, value) });
      }
    });
  },
});

defineCommand({
  id: "rotate",
  name: "Rotate",
  aliases: ["rot", "rotation"],
  category: "property",
  requiresSelection: true,
  argType: "number",
  argPlaceholder: "Enter rotation degrees...",
  execute: (ctx, args) => {
    const value = args ? parseFloat(args) : 0;
    if (isNaN(value)) return;
    ctx.selectedObjects.forEach((obj) => {
      ctx.updateObject(obj.id, { rotation: value });
    });
  },
});

defineCommand({
  id: "width",
  name: "Set Width",
  aliases: ["w"],
  category: "property",
  requiresSelection: true,
  argType: "number",
  argPlaceholder: "Enter width...",
  execute: (ctx, args) => {
    const value = args ? parseFloat(args) : 100;
    if (isNaN(value) || value <= 0) return;
    ctx.selectedObjects.forEach((obj) => {
      ctx.updateObject(obj.id, { width: value });
    });
  },
});

defineCommand({
  id: "height",
  name: "Set Height",
  aliases: ["ht"],
  category: "property",
  requiresSelection: true,
  argType: "number",
  argPlaceholder: "Enter height...",
  execute: (ctx, args) => {
    const value = args ? parseFloat(args) : 100;
    if (isNaN(value) || value <= 0) return;
    ctx.selectedObjects.forEach((obj) => {
      ctx.updateObject(obj.id, { height: value });
    });
  },
});

defineCommand({
  id: "padding",
  name: "Set Padding",
  aliases: ["pad"],
  category: "property",
  requiresSelection: true,
  requiresType: ["frame"],
  argType: "number",
  argPlaceholder: "Enter padding value...",
  execute: (ctx, args) => {
    const value = args ? parseFloat(args) : 0;
    if (isNaN(value)) return;
    const padding = Math.max(0, value);
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame") {
        ctx.updateObject(obj.id, {
          paddingTop: padding,
          paddingRight: padding,
          paddingBottom: padding,
          paddingLeft: padding,
        });
      }
    });
  },
});

// =============================================================================
// FILL COMMANDS
// =============================================================================

defineCommand({
  id: "fill",
  name: "Set Fill Color",
  aliases: ["bg", "background", "fillcolor"],
  category: "property",
  requiresSelection: true,
  requiresType: ["frame"],
  argType: "color",
  argPlaceholder: "Enter color (hex)...",
  indexedProperty: {
    property: "fills",
    getLabel: (item, idx) => {
      const fill = item as { type: string; color?: string };
      if (fill.type === "solid" && fill.color) {
        return `${fill.color}`;
      }
      return `Fill ${idx + 1} (${fill.type})`;
    },
  },
  execute: (ctx, args, index = 0) => {
    if (!args) return;
    const color = args.startsWith("#") ? args : `#${args}`;
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame") {
        const fills = obj.fills.length > 0 ? [...obj.fills] : [];
        if (fills.length === 0) {
          fills.push({
            id: `fill-${Date.now()}`,
            type: "solid",
            visible: true,
            opacity: 1,
            color,
          });
        } else {
          const targetIndex = Math.min(index, fills.length - 1);
          if (fills[targetIndex].type === "solid") {
            fills[targetIndex] = { ...fills[targetIndex], color };
          } else {
            fills[targetIndex] = {
              id: fills[targetIndex].id,
              type: "solid",
              visible: true,
              opacity: 1,
              color,
            };
          }
        }
        ctx.updateObject(obj.id, { fills });
      }
    });
  },
});

defineCommand({
  id: "addFill",
  name: "Add Fill",
  aliases: ["newfill", "+fill"],
  category: "property",
  requiresSelection: true,
  requiresType: ["frame"],
  argType: "color",
  argPlaceholder: "Enter color (hex)...",
  execute: (ctx, args) => {
    const color = args
      ? args.startsWith("#")
        ? args
        : `#${args}`
      : "#DDDDDD";
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame") {
        const fills = [
          ...obj.fills,
          {
            id: `fill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: "solid" as const,
            visible: true,
            opacity: 1,
            color,
          },
        ];
        ctx.updateObject(obj.id, { fills });
      }
    });
  },
});

defineCommand({
  id: "removeFill",
  name: "Remove Fill",
  aliases: ["nofill", "-fill", "clearfill"],
  category: "property",
  requiresSelection: true,
  requiresType: ["frame"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame" && obj.fills.length > 0) {
        const fills = obj.fills.slice(0, -1);
        ctx.updateObject(obj.id, { fills });
      }
    });
  },
});

defineCommand({
  id: "clearFills",
  name: "Clear All Fills",
  aliases: ["nofills", "removefills"],
  category: "property",
  requiresSelection: true,
  requiresType: ["frame"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame") {
        ctx.updateObject(obj.id, { fills: [] });
      }
    });
  },
});

// =============================================================================
// OUTLINE COMMANDS
// =============================================================================

defineCommand({
  id: "outline",
  name: "Set Outline",
  aliases: ["stroke", "outlinecolor"],
  category: "property",
  requiresSelection: true,
  requiresType: ["frame"],
  argType: "color",
  argPlaceholder: "Enter color (hex)...",
  execute: (ctx, args) => {
    const color = args
      ? args.startsWith("#")
        ? args
        : `#${args}`
      : "#000000";
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame") {
        ctx.updateObject(obj.id, {
          outline: color,
          outlineWidth: obj.outlineWidth ?? 1,
          outlineOpacity: obj.outlineOpacity ?? 1,
          outlineStyle: obj.outlineStyle ?? "solid",
          outlineOffset: obj.outlineOffset ?? 0,
        });
      }
    });
  },
});

defineCommand({
  id: "outlineWidth",
  name: "Set Outline Width",
  aliases: ["strokewidth", "ow"],
  category: "property",
  requiresSelection: true,
  requiresType: ["frame"],
  argType: "number",
  argPlaceholder: "Enter width (px)...",
  execute: (ctx, args) => {
    const value = args ? parseFloat(args) : 1;
    if (isNaN(value)) return;
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame") {
        ctx.updateObject(obj.id, {
          outline: obj.outline ?? "#000000",
          outlineWidth: Math.max(0, value),
          outlineOpacity: obj.outlineOpacity ?? 1,
        });
      }
    });
  },
});

defineCommand({
  id: "removeOutline",
  name: "Remove Outline",
  aliases: ["nooutline", "-outline", "nostroke"],
  category: "property",
  requiresSelection: true,
  requiresType: ["frame"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame") {
        ctx.updateObject(obj.id, {
          outline: undefined,
          outlineWidth: undefined,
          outlineOpacity: undefined,
          outlineStyle: undefined,
          outlineOffset: undefined,
        });
      }
    });
  },
});

// =============================================================================
// BORDER COMMANDS
// =============================================================================

defineCommand({
  id: "border",
  name: "Set Border",
  aliases: ["bordercolor"],
  category: "property",
  requiresSelection: true,
  requiresType: ["frame"],
  argType: "color",
  argPlaceholder: "Enter color (hex)...",
  execute: (ctx, args) => {
    const color = args
      ? args.startsWith("#")
        ? args
        : `#${args}`
      : "#000000";
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame") {
        ctx.updateObject(obj.id, {
          border: color,
          borderWidth: obj.borderWidth ?? 1,
          borderOpacity: obj.borderOpacity ?? 1,
          borderStyle: obj.borderStyle ?? "solid",
          borderSide: obj.borderSide ?? "all",
        });
      }
    });
  },
});

defineCommand({
  id: "borderWidth",
  name: "Set Border Width",
  aliases: ["bw"],
  category: "property",
  requiresSelection: true,
  requiresType: ["frame"],
  argType: "number",
  argPlaceholder: "Enter width (px)...",
  execute: (ctx, args) => {
    const value = args ? parseFloat(args) : 1;
    if (isNaN(value)) return;
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame") {
        ctx.updateObject(obj.id, {
          border: obj.border ?? "#000000",
          borderWidth: Math.max(0, value),
          borderOpacity: obj.borderOpacity ?? 1,
        });
      }
    });
  },
});

defineCommand({
  id: "removeBorder",
  name: "Remove Border",
  aliases: ["noborder", "-border"],
  category: "property",
  requiresSelection: true,
  requiresType: ["frame"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame") {
        ctx.updateObject(obj.id, {
          border: undefined,
          borderWidth: undefined,
          borderOpacity: undefined,
          borderStyle: undefined,
          borderSide: undefined,
        });
      }
    });
  },
});

// =============================================================================
// SHADOW COMMANDS
// =============================================================================

defineCommand({
  id: "shadow",
  name: "Add Shadow",
  aliases: ["dropshadow", "boxshadow"],
  category: "property",
  requiresSelection: true,
  requiresType: ["frame"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame") {
        ctx.updateObject(obj.id, {
          shadows: [...obj.shadows, createShadow()],
        });
      }
    });
  },
});

defineCommand({
  id: "shadowBlur",
  name: "Set Shadow Blur",
  aliases: ["sblur"],
  category: "property",
  requiresSelection: true,
  requiresType: ["frame"],
  argType: "number",
  argPlaceholder: "Enter blur radius...",
  execute: (ctx, args) => {
    const value = args ? parseFloat(args) : 8;
    if (isNaN(value)) return;
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame") {
        if (obj.shadows.length === 0) {
          ctx.updateObject(obj.id, {
            shadows: [createShadow(0, 4, Math.max(0, value))],
          });
        } else {
          const newShadows = [...obj.shadows];
          newShadows[0] = { ...newShadows[0], blur: Math.max(0, value) };
          ctx.updateObject(obj.id, { shadows: newShadows });
        }
      }
    });
  },
});

defineCommand({
  id: "shadowColor",
  name: "Set Shadow Color",
  aliases: ["scolor"],
  category: "property",
  requiresSelection: true,
  requiresType: ["frame"],
  argType: "color",
  argPlaceholder: "Enter color (hex)...",
  execute: (ctx, args) => {
    if (!args) return;
    const color = args.startsWith("#") ? args : `#${args}`;
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame") {
        if (obj.shadows.length === 0) {
          ctx.updateObject(obj.id, {
            shadows: [createShadow(0, 4, 8, 0, color)],
          });
        } else {
          const newShadows = [...obj.shadows];
          newShadows[0] = { ...newShadows[0], color };
          ctx.updateObject(obj.id, { shadows: newShadows });
        }
      }
    });
  },
});

defineCommand({
  id: "removeShadow",
  name: "Remove Shadow",
  aliases: ["noshadow", "-shadow"],
  category: "property",
  requiresSelection: true,
  requiresType: ["frame"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame") {
        ctx.updateObject(obj.id, { shadows: [] });
      }
    });
  },
});

defineCommand({
  id: "innerShadow",
  name: "Add Inner Shadow",
  aliases: ["inset", "innershadow"],
  category: "property",
  requiresSelection: true,
  requiresType: ["frame"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame") {
        ctx.updateObject(obj.id, {
          innerShadows: [...obj.innerShadows, createInnerShadow()],
        });
      }
    });
  },
});

defineCommand({
  id: "removeInnerShadow",
  name: "Remove Inner Shadow",
  aliases: ["noinnershadow", "-innershadow"],
  category: "property",
  requiresSelection: true,
  requiresType: ["frame"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame") {
        ctx.updateObject(obj.id, { innerShadows: [] });
      }
    });
  },
});

// =============================================================================
// BLEND MODE COMMANDS
// =============================================================================

defineCommand({
  id: "blendMode",
  name: "Set Blend Mode",
  aliases: ["blend", "bm"],
  category: "property",
  requiresSelection: true,
  requiresType: ["frame"],
  argType: "enum",
  argOptions: ["normal", "multiply", "screen", "overlay", "darken", "lighten"],
  argPlaceholder: "Enter blend mode...",
  execute: (ctx, args) => {
    if (!args) return;
    const mode = args.toLowerCase() as
      | "normal"
      | "multiply"
      | "screen"
      | "overlay"
      | "darken"
      | "lighten";
    const validModes = [
      "normal",
      "multiply",
      "screen",
      "overlay",
      "darken",
      "lighten",
    ];
    if (!validModes.includes(mode)) return;
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame") {
        ctx.updateObject(obj.id, { blendMode: mode });
      }
    });
  },
});

// =============================================================================
// TEXT PROPERTY COMMANDS
// =============================================================================

defineCommand({
  id: "fontSize",
  name: "Set Font Size",
  aliases: ["fs", "textsize"],
  category: "property",
  requiresSelection: true,
  requiresType: ["text"],
  argType: "number",
  argPlaceholder: "Enter font size...",
  execute: (ctx, args) => {
    const value = args ? parseFloat(args) : 16;
    if (isNaN(value) || value <= 0) return;
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "text") {
        ctx.updateObject(obj.id, { fontSize: value });
      }
    });
  },
});

defineCommand({
  id: "textColor",
  name: "Set Text Color",
  aliases: ["color", "tc"],
  category: "property",
  requiresSelection: true,
  requiresType: ["text"],
  argType: "color",
  argPlaceholder: "Enter color (hex)...",
  execute: (ctx, args) => {
    if (!args) return;
    const color = args.startsWith("#") ? args : `#${args}`;
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "text") {
        ctx.updateObject(obj.id, { color });
      }
    });
  },
});

defineCommand({
  id: "bold",
  name: "Toggle Bold",
  aliases: ["b", "fontbold"],
  category: "property",
  requiresSelection: true,
  requiresType: ["text"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "text") {
        ctx.updateObject(obj.id, {
          fontWeight: obj.fontWeight >= 600 ? 400 : 700,
        });
      }
    });
  },
});

defineCommand({
  id: "italic",
  name: "Toggle Italic",
  aliases: ["i", "fontitalic"],
  category: "property",
  requiresSelection: true,
  requiresType: ["text"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "text") {
        ctx.updateObject(obj.id, {
          fontStyle: obj.fontStyle === "italic" ? "normal" : "italic",
        });
      }
    });
  },
});

defineCommand({
  id: "underline",
  name: "Toggle Underline",
  aliases: ["u", "textunderline"],
  category: "property",
  requiresSelection: true,
  requiresType: ["text"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "text") {
        ctx.updateObject(obj.id, {
          textDecoration: obj.textDecoration === "underline" ? "none" : "underline",
        });
      }
    });
  },
});

defineCommand({
  id: "lineHeight",
  name: "Set Line Height",
  aliases: ["lh", "leading"],
  category: "property",
  requiresSelection: true,
  requiresType: ["text"],
  argType: "number",
  argPlaceholder: "Enter line height (%)...",
  execute: (ctx, args) => {
    const value = args ? parseFloat(args) : 120;
    if (isNaN(value)) return;
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "text") {
        ctx.updateObject(obj.id, { lineHeight: value / 100 });
      }
    });
  },
});

defineCommand({
  id: "letterSpacing",
  name: "Set Letter Spacing",
  aliases: ["ls", "tracking"],
  category: "property",
  requiresSelection: true,
  requiresType: ["text"],
  argType: "number",
  argPlaceholder: "Enter letter spacing (%)...",
  execute: (ctx, args) => {
    const value = args ? parseFloat(args) : 0;
    if (isNaN(value)) return;
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "text") {
        ctx.updateObject(obj.id, { letterSpacing: value / 100 });
      }
    });
  },
});

defineCommand({
  id: "textAlignLeft",
  name: "Align Text Left",
  aliases: ["tal"],
  category: "property",
  requiresSelection: true,
  requiresType: ["text"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "text") {
        ctx.updateObject(obj.id, { textAlign: "left" });
      }
    });
  },
});

defineCommand({
  id: "textAlignCenter",
  name: "Align Text Center",
  aliases: ["tac"],
  category: "property",
  requiresSelection: true,
  requiresType: ["text"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "text") {
        ctx.updateObject(obj.id, { textAlign: "center" });
      }
    });
  },
});

defineCommand({
  id: "textAlignRight",
  name: "Align Text Right",
  aliases: ["tar"],
  category: "property",
  requiresSelection: true,
  requiresType: ["text"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "text") {
        ctx.updateObject(obj.id, { textAlign: "right" });
      }
    });
  },
});

defineCommand({
  id: "uppercase",
  name: "Toggle Uppercase",
  aliases: ["upper", "caps"],
  category: "property",
  requiresSelection: true,
  requiresType: ["text"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "text") {
        ctx.updateObject(obj.id, {
          textTransform: obj.textTransform === "uppercase" ? "none" : "uppercase",
        });
      }
    });
  },
});

// =============================================================================
// FLEX DIRECTION COMMANDS
// =============================================================================

defineCommand({
  id: "flexRow",
  name: "Flex Direction Row",
  aliases: ["row", "horizontal"],
  category: "layout",
  requiresSelection: true,
  requiresType: ["frame"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame" && obj.layoutMode === "flex") {
        ctx.updateObject(obj.id, { flexDirection: "row" });
      }
    });
  },
});

defineCommand({
  id: "flexColumn",
  name: "Flex Direction Column",
  aliases: ["col", "column", "vertical"],
  category: "layout",
  requiresSelection: true,
  requiresType: ["frame"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame" && obj.layoutMode === "flex") {
        ctx.updateObject(obj.id, { flexDirection: "column" });
      }
    });
  },
});

defineCommand({
  id: "flexWrap",
  name: "Toggle Flex Wrap",
  aliases: ["wrap"],
  category: "layout",
  requiresSelection: true,
  requiresType: ["frame"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame" && obj.layoutMode === "flex") {
        ctx.updateObject(obj.id, {
          flexWrap: obj.flexWrap === "wrap" ? "nowrap" : "wrap",
        });
      }
    });
  },
});

defineCommand({
  id: "justifyStart",
  name: "Justify Start",
  aliases: ["jstart", "js"],
  category: "layout",
  requiresSelection: true,
  requiresType: ["frame"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame" && obj.layoutMode === "flex") {
        ctx.updateObject(obj.id, { justifyContent: "flex-start" });
      }
    });
  },
});

defineCommand({
  id: "justifyCenter",
  name: "Justify Center",
  aliases: ["jcenter", "jc"],
  category: "layout",
  requiresSelection: true,
  requiresType: ["frame"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame" && obj.layoutMode === "flex") {
        ctx.updateObject(obj.id, { justifyContent: "center" });
      }
    });
  },
});

defineCommand({
  id: "justifyEnd",
  name: "Justify End",
  aliases: ["jend", "je"],
  category: "layout",
  requiresSelection: true,
  requiresType: ["frame"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame" && obj.layoutMode === "flex") {
        ctx.updateObject(obj.id, { justifyContent: "flex-end" });
      }
    });
  },
});

defineCommand({
  id: "justifyBetween",
  name: "Justify Space Between",
  aliases: ["jbetween", "jb", "spacebetween"],
  category: "layout",
  requiresSelection: true,
  requiresType: ["frame"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame" && obj.layoutMode === "flex") {
        ctx.updateObject(obj.id, { justifyContent: "space-between" });
      }
    });
  },
});

defineCommand({
  id: "alignItemsStart",
  name: "Align Items Start",
  aliases: ["aistart", "ais"],
  category: "layout",
  requiresSelection: true,
  requiresType: ["frame"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame" && obj.layoutMode === "flex") {
        ctx.updateObject(obj.id, { alignItems: "flex-start" });
      }
    });
  },
});

defineCommand({
  id: "alignItemsCenter",
  name: "Align Items Center",
  aliases: ["aicenter", "aic"],
  category: "layout",
  requiresSelection: true,
  requiresType: ["frame"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame" && obj.layoutMode === "flex") {
        ctx.updateObject(obj.id, { alignItems: "center" });
      }
    });
  },
});

defineCommand({
  id: "alignItemsEnd",
  name: "Align Items End",
  aliases: ["aiend", "aie"],
  category: "layout",
  requiresSelection: true,
  requiresType: ["frame"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame" && obj.layoutMode === "flex") {
        ctx.updateObject(obj.id, { alignItems: "flex-end" });
      }
    });
  },
});

defineCommand({
  id: "alignItemsStretch",
  name: "Align Items Stretch",
  aliases: ["aistretch", "stretch"],
  category: "layout",
  requiresSelection: true,
  requiresType: ["frame"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame" && obj.layoutMode === "flex") {
        ctx.updateObject(obj.id, { alignItems: "stretch" });
      }
    });
  },
});

defineCommand({
  id: "removeFlex",
  name: "Remove Flex Layout",
  aliases: ["noflex", "-flex"],
  category: "layout",
  requiresSelection: true,
  requiresType: ["frame"],
  execute: (ctx) => {
    ctx.selectedObjects.forEach((obj) => {
      if (obj.type === "frame") {
        ctx.updateObject(obj.id, { layoutMode: "none" });
      }
    });
  },
});

// =============================================================================
// POSITION COMMANDS
// =============================================================================

defineCommand({
  id: "x",
  name: "Set X Position",
  aliases: ["posx", "setx"],
  category: "property",
  requiresSelection: true,
  argType: "number",
  argPlaceholder: "Enter X position...",
  execute: (ctx, args) => {
    const value = args ? parseFloat(args) : 0;
    if (isNaN(value)) return;
    ctx.selectedObjects.forEach((obj) => {
      ctx.updateObject(obj.id, { x: value });
    });
  },
});

defineCommand({
  id: "y",
  name: "Set Y Position",
  aliases: ["posy", "sety"],
  category: "property",
  requiresSelection: true,
  argType: "number",
  argPlaceholder: "Enter Y position...",
  execute: (ctx, args) => {
    const value = args ? parseFloat(args) : 0;
    if (isNaN(value)) return;
    ctx.selectedObjects.forEach((obj) => {
      ctx.updateObject(obj.id, { y: value });
    });
  },
});

// =============================================================================
// HISTORY
// =============================================================================

defineCommand({
  id: "undo",
  name: "Undo",
  aliases: ["u", "z"],
  category: "history",
  shortcutHint: "⌘Z",
  execute: (ctx) => {
    if (ctx.canUndo) ctx.undo();
  },
});

defineCommand({
  id: "redo",
  name: "Redo",
  aliases: ["y", "rz"],
  category: "history",
  shortcutHint: "⇧⌘Z",
  execute: (ctx) => {
    if (ctx.canRedo) ctx.redo();
  },
});

// =============================================================================
// SELECTION
// =============================================================================

defineCommand({
  id: "selectAll",
  name: "Select All",
  aliases: ["all", "sa"],
  category: "view",
  shortcutHint: "⌘A",
  execute: (ctx) => ctx.selectAllSiblings(),
});

defineCommand({
  id: "deselect",
  name: "Deselect All",
  aliases: ["none", "clear", "esc"],
  category: "view",
  shortcutHint: "Esc",
  execute: (ctx) => ctx.setSelectedIds([]),
});

export function initializeCommands() {
  // Commands are registered when this module is imported
  // This function exists for explicit initialization if needed
}
