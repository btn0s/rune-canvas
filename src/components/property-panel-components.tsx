import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectTrigger, SelectValue } from "./ui/select";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Plus, Eye, EyeOff, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerAlpha,
  ColorPickerEyeDropper,
} from "./ui/color-picker";

// Consistent label color for all property panel labels
const LABEL_COLOR = "text-muted-foreground";

// ============================================================================
// MIXED VALUE UTILITIES - For multi-selection editing
// ============================================================================

/** Symbol representing a mixed value (different across selected objects) */
export const MIXED = Symbol("mixed");
export type MixedValue = typeof MIXED;

/** Check if a value is mixed */
export function isMixed<T>(value: T | MixedValue): value is MixedValue {
  return value === MIXED;
}

/**
 * Get a property value from multiple objects.
 * Returns the value if all objects have the same value, otherwise MIXED.
 */
export function getMixedValue<T, K extends keyof T>(
  objects: T[],
  key: K
): T[K] | MixedValue {
  if (objects.length === 0) return MIXED;
  const firstValue = objects[0][key];
  const allSame = objects.every((obj) => obj[key] === firstValue);
  return allSame ? firstValue : MIXED;
}

/**
 * Get a nested property value from multiple objects.
 * Returns the value if all objects have the same value, otherwise MIXED.
 */
export function getMixedNestedValue<T, V>(
  objects: T[],
  getter: (obj: T) => V | undefined
): V | undefined | MixedValue {
  if (objects.length === 0) return MIXED;
  const firstValue = getter(objects[0]);
  const allSame = objects.every((obj) => getter(obj) === firstValue);
  return allSame ? firstValue : MIXED;
}

// Icon button component using shadcn Button
export function IconButton({
  active,
  onClick,
  children,
  tooltip,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tooltip?: string;
}) {
  const button = (
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn(
        "size-7 p-1.5 rounded-md transition-colors",
        active
          ? "bg-primary/20 text-primary hover:bg-primary/30"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      {children}
    </Button>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

// Icon button group
export function IconButtonGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-0.5 bg-input/30 rounded-md p-0.5">
      {children}
    </div>
  );
}

// Section label
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
      {children}
    </span>
  );
}

// Number input with label - consistent styling
// Supports mixed values for multi-selection editing
export function NumberInput({
  label,
  value,
  onChange,
  min,
  suffix,
}: {
  label?: string;
  value: number | MixedValue;
  onChange: (value: number) => void;
  min?: number;
  suffix?: string;
}) {
  const mixed = isMixed(value);
  const [localValue, setLocalValue] = useState(
    mixed ? "" : String(Math.round(value))
  );
  const [isFocused, setIsFocused] = useState(false);

  // Sync from prop when not focused (and not mixed)
  useEffect(() => {
    if (!isFocused && !mixed) {
      setLocalValue(String(Math.round(value)));
    }
  }, [value, isFocused, mixed]);

  // When mixed changes to non-mixed, sync the value
  useEffect(() => {
    if (!mixed && !isFocused) {
      setLocalValue(String(Math.round(value)));
    }
  }, [mixed]);

  const commitValue = () => {
    const parsed = parseFloat(localValue);
    if (!isNaN(parsed)) {
      const finalValue = min !== undefined ? Math.max(min, parsed) : parsed;
      onChange(finalValue);
      setLocalValue(String(Math.round(finalValue)));
    } else if (!mixed) {
      // Reset to original value if invalid and not mixed
      setLocalValue(String(Math.round(value)));
    }
  };

  return (
    <div className="flex items-center h-7 bg-input/30 border border-border rounded-md">
      {label && (
        <span className={cn("text-xs pl-2 pr-1", LABEL_COLOR)}>{label}</span>
      )}
      <Input
        type="number"
        value={localValue}
        placeholder={mixed ? "—" : undefined}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={(e) => {
          setIsFocused(true);
          e.target.select();
        }}
        onBlur={() => {
          setIsFocused(false);
          commitValue();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className={cn(
          "flex-1 min-w-0 h-full px-1 text-xs font-mono bg-transparent dark:bg-transparent border-0 shadow-none focus-visible:ring-0 rounded-none",
          mixed && localValue === ""
            ? "text-muted-foreground placeholder:text-muted-foreground"
            : "text-foreground"
        )}
      />
      {suffix && (
        <span className={cn("text-xs pr-2", LABEL_COLOR)}>{suffix}</span>
      )}
    </div>
  );
}

// Editable text input that syncs with external value but allows free typing
function EditableField({
  value,
  onChange,
  onCommit,
  className,
  ...props
}: {
  value: string;
  onChange?: (value: string) => void;
  onCommit: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  // Sync from prop when not focused
  useEffect(() => {
    if (!isFocused) setLocalValue(value);
  }, [value, isFocused]);

  return (
    <input
      {...props}
      value={localValue}
      onChange={(e) => {
        setLocalValue(e.target.value);
        onChange?.(e.target.value);
      }}
      onFocus={(e) => {
        setIsFocused(true);
        e.target.select();
      }}
      onBlur={() => {
        setIsFocused(false);
        onCommit(localValue);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "selection:bg-primary selection:text-primary-foreground",
        className
      )}
    />
  );
}

// Color input with swatch, hex, and opacity - swatch opens color picker popover
// Supports mixed values for multi-selection editing
export function ColorInput({
  color,
  opacity = 1,
  onChange,
  onOpacityChange,
  showOpacity = true,
}: {
  color: string | MixedValue;
  opacity?: number | MixedValue;
  onChange: (color: string) => void;
  onOpacityChange?: (opacity: number) => void;
  showOpacity?: boolean;
}) {
  const colorMixed = isMixed(color);
  const opacityMixed = isMixed(opacity);
  const displayColor = colorMixed ? "#888888" : color;
  const displayOpacity = opacityMixed ? 1 : opacity;
  const hexDisplay = colorMixed ? "" : color.replace("#", "").toUpperCase();
  const opacityDisplay = opacityMixed
    ? ""
    : `${Math.round(displayOpacity * 100)}`;

  const commitHex = (val: string) => {
    const hex = val.replace("#", "").toUpperCase();
    if (!/^[0-9A-F]*$/i.test(hex) || hex.length === 0) return;

    let expanded = hex;
    if (hex.length === 1) {
      // F → FFFFFF (grayscale)
      expanded = hex.repeat(6);
    } else if (hex.length === 2) {
      // AB → ABABAB (grayscale)
      expanded = hex.repeat(3);
    } else if (hex.length === 3) {
      // ABC → AABBCC (CSS shorthand)
      expanded = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    } else if (hex.length < 6) {
      // Pad with zeros: ABCD → ABCD00
      expanded = hex.padEnd(6, "0");
    } else {
      expanded = hex.slice(0, 6);
    }

    onChange(`#${expanded}`);
  };

  const commitOpacity = (val: string) => {
    const cleaned = val.replace("%", "").trim();
    if (cleaned === "") return; // Don't commit empty values
    const num = parseInt(cleaned);
    if (isNaN(num)) return; // Don't commit invalid values
    onOpacityChange?.(Math.min(100, Math.max(0, num)) / 100);
  };

  return (
    <div className="flex items-center h-7 w-full bg-input/30 border border-border rounded-md overflow-hidden">
      {/* Color swatch - opens popover */}
      <Popover>
        <PopoverTrigger asChild>
          <button className="h-full aspect-square shrink-0 p-1 hover:bg-input/50 transition-colors cursor-pointer">
            <div
              className={cn(
                "h-full w-full rounded",
                colorMixed && "bg-gradient-to-br from-zinc-400 to-zinc-600"
              )}
              style={colorMixed ? undefined : { backgroundColor: displayColor }}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-56 p-3"
          side="left"
          align="start"
          sideOffset={8}
        >
          <ColorPicker
            value={displayColor}
            alpha={displayOpacity}
            onChange={onChange}
            onAlphaChange={onOpacityChange}
          >
            <ColorPickerSelection />
            <ColorPickerHue />
            {onOpacityChange && <ColorPickerAlpha />}
            <div className="flex items-center gap-1.5">
              <Input
                type="text"
                value={colorMixed ? "" : hexDisplay}
                placeholder={colorMixed ? "Mixed" : undefined}
                onChange={(e) => {
                  const hex = e.target.value.replace("#", "");
                  if (/^[0-9A-Fa-f]{0,6}$/.test(hex)) {
                    onChange(`#${hex}`);
                  }
                }}
                onFocus={(e) => e.target.select()}
                className="flex-1 h-7 text-xs font-mono uppercase px-2"
                maxLength={6}
              />
              <ColorPickerEyeDropper className="h-7 w-7" />
            </div>
          </ColorPicker>
        </PopoverContent>
      </Popover>
      {/* Hex input */}
      <EditableField
        value={hexDisplay}
        onCommit={commitHex}
        placeholder={colorMixed ? "—" : undefined}
        className={cn(
          "flex-1 min-w-0 px-1 text-xs font-mono bg-transparent border-0 outline-none uppercase",
          colorMixed
            ? "text-muted-foreground placeholder:text-muted-foreground"
            : "text-foreground",
          !showOpacity && "pr-1.5"
        )}
        maxLength={6}
      />
      {showOpacity && (
        <>
          <span className={cn("text-xs", LABEL_COLOR)}>/</span>
          {/* Opacity input */}
          <EditableField
            value={opacityDisplay}
            onCommit={commitOpacity}
            placeholder={opacityMixed ? "—" : undefined}
            className={cn(
              "w-10 px-1 text-xs font-mono bg-transparent border-0 outline-none text-right",
              opacityMixed
                ? "text-muted-foreground placeholder:text-muted-foreground"
                : "text-foreground"
            )}
          />
          <span className={cn("text-xs pr-1.5", LABEL_COLOR)}>%</span>
        </>
      )}
    </div>
  );
}

// Collapsible property section (2 states: collapsed with +, or open with controls)
export function CollapsibleSection({
  label,
  isOpen,
  onAdd,
  onRemove,
  visible = true,
  onToggleVisible,
  children,
}: {
  label: string;
  isOpen: boolean;
  onAdd: () => void;
  onRemove: () => void;
  visible?: boolean;
  onToggleVisible?: () => void;
  children: React.ReactNode;
}) {
  if (!isOpen) {
    // Collapsed state - just label + add button
    return (
      <div className="flex items-center justify-between">
        <SectionLabel>{label}</SectionLabel>
        <Button
          variant="ghost"
          onClick={onAdd}
          className="size-6 p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
    );
  }

  // Open state - label with controls + content
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <SectionLabel>{label}</SectionLabel>
        <div className="flex items-center gap-0.5">
          {onToggleVisible && (
            <Button
              variant="ghost"
              onClick={onToggleVisible}
              className="size-6 p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              {visible ? (
                <Eye className="size-3.5" />
              ) : (
                <EyeOff className="size-3.5" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={onRemove}
            className="size-6 p-1 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Minus className="size-3.5" />
          </Button>
        </div>
      </div>
      {children}
    </div>
  );
}

// Property Panel Select - custom styled for PropertyPanel use case
export function PropertySelect({
  value,
  onValueChange,
  children,
  placeholder,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        size="sm"
        className="h-7 !w-full rounded-md border-border bg-card text-xs px-2 py-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring data-[size=sm]:h-7 [&>span]:text-xs [&>span]:text-foreground"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-md border-border bg-popover">
        {children}
      </SelectContent>
    </Select>
  );
}

// Property Panel Button - custom styled for PropertyPanel use case
export function PropertyButton({
  onClick,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className={cn(
        "w-full h-7 text-xs text-muted-foreground hover:text-foreground transition-colors",
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
}

// ============================================================================
// EFFECT SECTIONS - Reusable property sections for visual effects
// These support multi-selection by accepting arrays and computing mixed values
// ============================================================================

import type { ShadowProps, BorderSide } from "@/lib/types";
import { SelectItem } from "./ui/select";

/**
 * Helper to get a mixed value from an array of shadow arrays
 * Looks at the first shadow in each array for simplicity
 */
function getShadowMixedValue<K extends keyof ShadowProps>(
  shadowArrays: ShadowProps[][],
  key: K,
  defaultValue: ShadowProps[K]
): ShadowProps[K] | MixedValue {
  const firstShadows = shadowArrays
    .map((arr) => arr[0])
    .filter((s): s is ShadowProps => s !== undefined);
  if (firstShadows.length === 0) return defaultValue;
  const firstValue = firstShadows[0][key];
  const allSame = firstShadows.every((s) => s[key] === firstValue);
  return allSame ? firstValue : MIXED;
}

/**
 * Shadow section - handles stackable shadows (drop shadow or inner shadow)
 * For simplicity, currently edits the first shadow; full multi-shadow UI coming later
 */
export function ShadowSection({
  label,
  shadowArrays,
  isInner,
  onAdd,
  onRemove,
  onUpdate,
}: {
  label: string;
  shadowArrays: ShadowProps[][];
  isInner?: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onUpdate: (updates: Partial<ShadowProps>) => void;
}) {
  const hasAny = shadowArrays.some((arr) => arr.length > 0);
  const firstShadows = shadowArrays.map((arr) => arr[0]).filter(Boolean);

  const x = getShadowMixedValue(shadowArrays, "x", 0);
  const y = getShadowMixedValue(shadowArrays, "y", isInner ? 2 : 4);
  const blur = getShadowMixedValue(shadowArrays, "blur", isInner ? 4 : 8);
  const spread = getShadowMixedValue(shadowArrays, "spread", 0);
  const color = getShadowMixedValue(shadowArrays, "color", "#000000");
  const opacity = getShadowMixedValue(shadowArrays, "opacity", 0.25);

  const anyVisible = firstShadows.some((s) => s.visible);

  return (
    <CollapsibleSection
      label={label}
      isOpen={hasAny}
      onAdd={onAdd}
      onRemove={onRemove}
      visible={anyVisible}
      onToggleVisible={() => onUpdate({ visible: !anyVisible })}
    >
      <div className="grid grid-cols-2 gap-1.5">
        <NumberInput label="X" value={x} onChange={(v) => onUpdate({ x: v })} />
        <NumberInput label="Y" value={y} onChange={(v) => onUpdate({ y: v })} />
        <NumberInput
          label="Blur"
          value={blur}
          onChange={(v) => onUpdate({ blur: Math.max(0, v) })}
          min={0}
        />
        <NumberInput
          label="Spread"
          value={spread}
          onChange={(v) => onUpdate({ spread: v })}
        />
      </div>
      <ColorInput
        color={isMixed(color) ? "#000000" : color}
        opacity={isMixed(opacity) ? 0.25 : opacity}
        onChange={(c) => onUpdate({ color: c })}
        onOpacityChange={(o) => onUpdate({ opacity: o })}
      />
    </CollapsibleSection>
  );
}

/** Stroke data for multi-selection - one entry per selected object */
interface StrokeData {
  color: string | undefined;
  width: number | undefined;
  opacity: number | undefined;
}

// Stroke section props - shared between border and outline
interface StrokeSectionProps {
  label: string;
  /** Array of stroke data - one per selected object */
  strokes: StrokeData[];
  onChange: (updates: {
    color?: string;
    width?: number;
    opacity?: number;
  }) => void;
  onAdd: () => void;
  onRemove: () => void;
  /** Additional controls to render after width input (e.g., side selector, offset) */
  children?: React.ReactNode;
}

/**
 * Helper to get mixed value from stroke array
 */
function getStrokeMixedValue<K extends keyof StrokeData>(
  strokes: StrokeData[],
  key: K,
  defaultValue: NonNullable<StrokeData[K]>
): NonNullable<StrokeData[K]> | MixedValue {
  // Only consider strokes that have a color (meaning the effect is enabled)
  const active = strokes.filter((s) => s.color !== undefined);
  if (active.length === 0) return defaultValue;
  const firstValue = active[0][key];
  const allSame = active.every((s) => s[key] === firstValue);
  return allSame ? firstValue ?? defaultValue : MIXED;
}

/**
 * Stroke section - handles border and outline properties
 * Supports multi-selection by accepting an array of stroke data
 */
export function StrokeSection({
  label,
  strokes,
  onChange,
  onAdd,
  onRemove,
  children,
}: StrokeSectionProps) {
  // Compute mixed state
  const hasAny = strokes.some((s) => s.color !== undefined);
  const active = strokes.filter((s) => s.color !== undefined);

  // Get mixed values
  const color = getStrokeMixedValue(strokes, "color", "#000000");
  const width = getStrokeMixedValue(strokes, "width", 1);
  const opacity = getStrokeMixedValue(strokes, "opacity", 1);

  // For visibility toggle
  const anyVisible = active.some((s) => (s.opacity ?? 1) > 0);

  return (
    <CollapsibleSection
      label={label}
      isOpen={hasAny}
      onAdd={onAdd}
      onRemove={onRemove}
      visible={anyVisible}
      onToggleVisible={() => onChange({ opacity: anyVisible ? 0 : 1 })}
    >
      <div className="grid grid-cols-2 gap-1.5">
        <NumberInput
          label="W"
          value={width}
          onChange={(v) => onChange({ width: Math.max(0, v) })}
          min={0}
        />
        {children}
      </div>
      <ColorInput
        color={color}
        opacity={opacity}
        onChange={(c) => onChange({ color: c })}
        onOpacityChange={(o) => onChange({ opacity: o })}
      />
    </CollapsibleSection>
  );
}

/**
 * Border side selector - for selecting which sides to apply border to
 * Supports mixed values for multi-selection
 */
export function BorderSideSelect({
  value,
  onChange,
}: {
  value: BorderSide | MixedValue;
  onChange: (side: BorderSide) => void;
}) {
  const mixed = isMixed(value);
  return (
    <PropertySelect
      value={mixed ? "all" : value}
      onValueChange={(v) => onChange(v as BorderSide)}
      placeholder={mixed ? "Mixed" : undefined}
    >
      {(["all", "top", "right", "bottom", "left"] as BorderSide[]).map(
        (side) => (
          <SelectItem key={side} value={side} className="capitalize text-xs">
            {side}
          </SelectItem>
        )
      )}
    </PropertySelect>
  );
}
