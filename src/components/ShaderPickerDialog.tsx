/**
 * Shader Picker Dialog
 *
 * Dialog that displays available shaders in categorized sections with live previews
 */

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ShaderRendererComponent } from "@/lib/shaders/ShaderRenderer";
import { getAllShaders } from "@/lib/shaders/registry";
import type { ShaderDefinition, ShaderCategory } from "@/lib/shaders/types";

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

  // Group shaders by category
  const shadersByCategory = useMemo(() => {
    const grouped: Record<ShaderCategory, ShaderDefinition[]> = {
      "Image filters": [],
      "Logo animations": [],
      "Effects": [],
    };
    
    shaders.forEach((shader) => {
      grouped[shader.category].push(shader);
    });
    
    return grouped;
  }, [shaders]);

  const handleSelect = (shaderId: string) => {
    onSelect(shaderId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-card border-b border-border px-6 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Shaders</h2>
        </div>
        
        <div className="px-6 py-6 space-y-8">
          {(["Image filters", "Logo animations", "Effects"] as ShaderCategory[]).map((category) => {
            const categoryShaders = shadersByCategory[category];
            if (categoryShaders.length === 0) return null;
            
            return (
              <div key={category} className="space-y-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-medium text-foreground">{category}</h3>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {categoryShaders.map((shader) => (
                    <ShaderPreview
                      key={shader.id}
                      shader={shader}
                      isHovered={hoveredId === shader.id}
                      onHover={() => setHoveredId(shader.id)}
                      onSelect={() => handleSelect(shader.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
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
        relative cursor-pointer group
        transition-all duration-200
      `}
      onMouseEnter={onHover}
      onClick={onSelect}
    >
      <div className="aspect-square bg-black/50 relative rounded-md overflow-hidden border border-border group-hover:border-primary transition-colors">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-full flex items-center justify-center">
            <ShaderRendererComponent
              shader={shader}
              params={shader.defaultParams}
              width={200}
              height={200}
              speed={1}
            />
          </div>
        </div>
      </div>
      <div className="mt-2 text-center">
        <h3 className="text-xs font-medium">{shader.name}</h3>
      </div>
    </div>
  );
}
