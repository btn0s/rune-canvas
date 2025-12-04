import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { Plus, Eye, EyeOff, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

// Consistent label color for all property panel labels
const LABEL_COLOR = "text-zinc-500";

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
      size="icon-sm"
      onClick={onClick}
      className={cn(
        "p-1.5 rounded transition-colors",
        active
          ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
          : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
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
    <div className="flex items-center gap-0.5 bg-zinc-800/50 rounded p-0.5">
      {children}
    </div>
  );
}

// Section label
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] uppercase tracking-wider text-zinc-600 font-medium">
      {children}
    </span>
  );
}

// Number input with label - consistent styling
export function NumberInput({
  label,
  value,
  onChange,
  min,
  suffix,
}: {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center h-7 bg-zinc-800/50 border border-zinc-700/50 rounded">
      {label && (
        <span className={cn("text-[10px] pl-2 pr-1", LABEL_COLOR)}>
          {label}
        </span>
      )}
      <Input
        type="number"
        value={Math.round(value)}
        onChange={(e) => {
          const v = parseFloat(e.target.value) || 0;
          onChange(min !== undefined ? Math.max(min, v) : v);
        }}
        className="flex-1 min-w-0 h-full px-1 !text-[10px] font-mono text-zinc-300 bg-transparent border-0 shadow-none focus-visible:ring-0 rounded-none"
      />
      {suffix && (
        <span className={cn("text-[10px] pr-2", LABEL_COLOR)}>{suffix}</span>
      )}
    </div>
  );
}

// Color input with swatch, hex, and opacity
export function ColorInput({
  color,
  opacity = 1,
  onChange,
  onOpacityChange,
}: {
  color: string;
  opacity?: number;
  onChange: (color: string) => void;
  onOpacityChange?: (opacity: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {/* Swatch + Hex */}
      <div className="flex items-center h-7 bg-zinc-800/50 border border-zinc-700/50 rounded overflow-hidden">
        <div className="relative h-full aspect-square shrink-0">
          <input
            type="color"
            value={color}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
          />
          <div
            className="absolute inset-1 rounded"
            style={{ backgroundColor: color }}
          />
        </div>
        <Input
          type="text"
          value={color.replace("#", "").toUpperCase()}
          onChange={(e) => {
            const hex = e.target.value.replace("#", "");
            if (/^[0-9A-Fa-f]{0,6}$/.test(hex)) {
              onChange(`#${hex}`);
            }
          }}
          className="flex-1 min-w-0 h-full px-2 !text-[10px] font-mono text-zinc-300 bg-transparent border-0 shadow-none focus-visible:ring-0 rounded-none uppercase"
          maxLength={6}
        />
      </div>
      {/* Opacity */}
      <div className="flex items-center h-7 bg-zinc-800/50 border border-zinc-700/50 rounded">
        <Input
          type="number"
          min={0}
          max={100}
          value={Math.round(opacity * 100)}
          onChange={(e) =>
            onOpacityChange?.(
              Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) / 100
            )
          }
          className="flex-1 min-w-0 h-full px-2 !text-[10px] font-mono text-zinc-300 bg-transparent border-0 shadow-none focus-visible:ring-0 rounded-none"
        />
        <span className={cn("text-[10px] pr-2", LABEL_COLOR)}>%</span>
      </div>
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
          size="icon-sm"
          onClick={onAdd}
          className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
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
              size="icon-sm"
              onClick={onToggleVisible}
              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
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
            size="icon-sm"
            onClick={onRemove}
            className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
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
        className="h-7 !w-full rounded border-zinc-700/50 bg-zinc-800/50 !text-[10px] px-2 py-0 shadow-none focus-visible:ring-1 focus-visible:ring-zinc-600 data-[size=sm]:h-7 [&>span]:!text-[10px] [&>span]:text-zinc-300"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-md border-zinc-700/50 bg-zinc-800">
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
        "w-full h-7 !text-[10px] text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 border-zinc-700/50 rounded transition-colors",
        className
      )}
      {...props}
    >
      {children}
    </Button>
  );
}
