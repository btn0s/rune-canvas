import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { Plus, Eye, EyeOff, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

// Consistent label color for all property panel labels
const LABEL_COLOR = "text-muted-foreground";

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
    <div className="flex items-center h-7 bg-input/30 border border-border rounded-md">
      {label && (
        <span className={cn("text-xs pl-2 pr-1", LABEL_COLOR)}>{label}</span>
      )}
      <Input
        type="number"
        value={Math.round(value)}
        onChange={(e) => {
          const v = parseFloat(e.target.value) || 0;
          onChange(min !== undefined ? Math.max(min, v) : v);
        }}
        className="flex-1 min-w-0 h-full px-1 text-xs font-mono text-foreground bg-transparent dark:bg-transparent border-0 shadow-none focus-visible:ring-0 rounded-none"
      />
      {suffix && (
        <span className={cn("text-xs pr-2", LABEL_COLOR)}>{suffix}</span>
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
      <div className="flex items-center h-7 bg-input/30 border border-border rounded-md overflow-hidden">
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
          className="flex-1 min-w-0 h-full px-2 text-xs font-mono text-foreground bg-transparent dark:bg-transparent border-0 shadow-none focus-visible:ring-0 rounded-none uppercase"
          maxLength={6}
        />
      </div>
      {/* Opacity */}
      <div className="flex items-center h-7 bg-input/30 border border-border rounded-md">
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
          className="flex-1 min-w-0 h-full px-2 text-xs font-mono text-foreground bg-transparent dark:bg-transparent border-0 shadow-none focus-visible:ring-0 rounded-none"
        />
        <span className={cn("text-xs pr-2", LABEL_COLOR)}>%</span>
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

