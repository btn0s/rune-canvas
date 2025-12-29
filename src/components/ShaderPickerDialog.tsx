/**
 * Shader Picker Dialog
 *
 * Dialog that displays available shaders in a grid with live previews
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShaderRendererComponent } from "@/lib/shaders/ShaderRenderer";
import { getAllShaders } from "@/lib/shaders/registry";
import type { ShaderDefinition } from "@/lib/shaders/types";

export interface ShaderPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (shaderId: string) => void;
}

export function ShaderPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: ShaderPickerDialogProps) {
  const shaders = getAllShaders();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleSelect = (shaderId: string) => {
    onSelect(shaderId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select a Shader</DialogTitle>
          <DialogDescription>
            Choose a WebGL 2.0 shader to add to your canvas
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 mt-4">
          {shaders.map((shader) => (
            <ShaderPreview
              key={shader.id}
              shader={shader}
              isHovered={hoveredId === shader.id}
              onHover={() => setHoveredId(shader.id)}
              onSelect={() => handleSelect(shader.id)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ShaderPreviewProps {
  shader: ShaderDefinition;
  isHovered: boolean;
  onHover: () => void;
  onSelect: () => void;
}

function ShaderPreview({
  shader,
  isHovered,
  onHover,
  onSelect,
}: ShaderPreviewProps) {
  return (
    <div
      className={`
        relative border rounded-lg overflow-hidden cursor-pointer
        transition-all duration-200
        ${isHovered ? "border-primary shadow-lg scale-[1.02]" : "border-border"}
      `}
      onMouseEnter={onHover}
      onClick={onSelect}
    >
      <div className="aspect-video bg-black/50 relative">
        <ShaderRendererComponent
          shader={shader}
          params={shader.defaultParams}
          width={400}
          height={225}
          speed={1}
        />
      </div>
      <div className="p-3 bg-background/95 backdrop-blur-sm">
        <h3 className="font-semibold text-sm">{shader.name}</h3>
        {shader.description && (
          <p className="text-xs text-muted-foreground mt-1">
            {shader.description}
          </p>
        )}
      </div>
    </div>
  );
}
