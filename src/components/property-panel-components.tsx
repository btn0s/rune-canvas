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

  return (
    <div className="flex items-center h-7 bg-input/30 border border-border rounded-md">
      {label && (
        <span className={cn("text-xs pl-2 pr-1", LABEL_COLOR)}>{label}</span>
      )}
      <Input
        type="number"
        value={mixed ? "" : Math.round(value)}
        placeholder={mixed ? "—" : undefined}
        onChange={(e) => {
          const v = parseFloat(e.target.value) || 0;
          onChange(min !== undefined ? Math.max(min, v) : v);
        }}
        className={cn(
          "flex-1 min-w-0 h-full px-1 text-xs font-mono bg-transparent dark:bg-transparent border-0 shadow-none focus-visible:ring-0 rounded-none",
          mixed
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
      onFocus={() => setIsFocused(true)}
      onBlur={() => {
        setIsFocused(false);
        onCommit(localValue);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      className={className}
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
}: {
  color: string | MixedValue;
  opacity?: number | MixedValue;
  onChange: (color: string) => void;
  onOpacityChange?: (opacity: number) => void;
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
    const num = parseInt(val.replace("%", "")) || 0;
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
            : "text-foreground"
        )}
        maxLength={6}
      />
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
// ============================================================================

import type { ShadowProps, BorderSide } from "@/lib/types";
import { SelectItem } from "./ui/select";

// Default values for new shadows
const DEFAULT_SHADOW: ShadowProps = {
  x: 0,
  y: 2,
  blur: 4,
  spread: 0,
  color: "#000000",
  opacity: 0.2,
};

/**
 * Shadow section - handles both drop shadow and inner shadow
 * Provides X/Y offset, blur, spread, color, and opacity controls
 */
export function ShadowSection({
  label,
  shadow,
  onChange,
}: {
  label: string;
  shadow: ShadowProps | undefined;
  onChange: (shadow: ShadowProps | undefined) => void;
}) {
  return (
    <CollapsibleSection
      label={label}
      isOpen={!!shadow}
      onAdd={() => onChange({ ...DEFAULT_SHADOW })}
      onRemove={() => onChange(undefined)}
      visible={(shadow?.opacity ?? 0) > 0}
      onToggleVisible={() =>
        onChange(
          shadow
            ? { ...shadow, opacity: shadow.opacity > 0 ? 0 : 0.2 }
            : undefined
        )
      }
    >
      <div className="grid grid-cols-2 gap-1.5">
        <NumberInput
          label="X"
          value={shadow?.x || 0}
          onChange={(v) => onChange({ ...shadow!, x: v })}
        />
        <NumberInput
          label="Y"
          value={shadow?.y || 0}
          onChange={(v) => onChange({ ...shadow!, y: v })}
        />
        <NumberInput
          label="Blur"
          value={shadow?.blur || 0}
          onChange={(v) => onChange({ ...shadow!, blur: Math.max(0, v) })}
          min={0}
        />
        <NumberInput
          label="Spread"
          value={shadow?.spread || 0}
          onChange={(v) => onChange({ ...shadow!, spread: v })}
        />
      </div>
      <ColorInput
        color={shadow?.color || "#000000"}
        opacity={shadow?.opacity ?? 0.2}
        onChange={(color) => onChange({ ...shadow!, color })}
        onOpacityChange={(opacity) => onChange({ ...shadow!, opacity })}
      />
    </CollapsibleSection>
  );
}

// Stroke section props - shared between border and outline
interface StrokeSectionProps {
  label: string;
  color: string | undefined;
  width: number;
  opacity: number;
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
 * Stroke section - handles border and outline properties
 * Provides width, color, and opacity controls with optional additional controls
 */
export function StrokeSection({
  label,
  color,
  width,
  opacity,
  onChange,
  onAdd,
  onRemove,
  children,
}: StrokeSectionProps) {
  return (
    <CollapsibleSection
      label={label}
      isOpen={!!color}
      onAdd={onAdd}
      onRemove={onRemove}
      visible={opacity > 0}
      onToggleVisible={() => onChange({ opacity: opacity > 0 ? 0 : 1 })}
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
        color={color!}
        opacity={opacity}
        onChange={(c) => onChange({ color: c })}
        onOpacityChange={(o) => onChange({ opacity: o })}
      />
    </CollapsibleSection>
  );
}

/**
 * Border side selector - for selecting which sides to apply border to
 */
export function BorderSideSelect({
  value,
  onChange,
}: {
  value: BorderSide;
  onChange: (side: BorderSide) => void;
}) {
  return (
    <PropertySelect value={value} onValueChange={(v) => onChange(v as BorderSide)}>
      {(["all", "top", "right", "bottom", "left"] as BorderSide[]).map((side) => (
        <SelectItem key={side} value={side} className="capitalize text-xs">
          {side}
        </SelectItem>
      ))}
    </PropertySelect>
  );
}
