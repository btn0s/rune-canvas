/**
 * Shader Picker Dialog
 *
 * Dialog that displays available shaders in categorized sections with live previews
 */

import { useMemo, useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
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
      "Interactive": [],
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
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden p-0 flex flex-col">
        <DialogTitle className="sr-only">Select a shader</DialogTitle>
        <DialogDescription className="sr-only">
          Choose from a collection of WebGL shaders to add to your canvas
        </DialogDescription>
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Shaders</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {(["Image filters", "Interactive", "Logo animations", "Effects"] as ShaderCategory[]).map((category) => {
            const categoryShaders = shadersByCategory[category];
            if (categoryShaders.length === 0) return null;
            
            return (
              <div key={category} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{category}</h3>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="grid grid-cols-3 gap-3">
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
  // Render one frame then pause for all shaders
  const [paused, setPaused] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  
  // After first frame renders, pause the animation
  useEffect(() => {
    // Use requestAnimationFrame to wait for at least one frame
    const frameId = requestAnimationFrame(() => {
      // Then use a small timeout to ensure rendering completes
      timeoutRef.current = window.setTimeout(() => {
        setPaused(true);
        timeoutRef.current = null;
      }, 50);
    });
    
    return () => {
      cancelAnimationFrame(frameId);
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return (
    <button
      className="relative group text-left w-full transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
      onMouseEnter={onHover}
      onClick={onSelect}
    >
      <div className="aspect-square bg-muted/50 relative rounded-md overflow-hidden border border-border group-hover:border-primary/50 group-hover:shadow-sm transition-all">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-full flex items-center justify-center">
            <ShaderRendererComponent
              shader={shader}
              params={shader.defaultParams}
              width={200}
              height={200}
              speed={1}
              targetFps={isHovered ? 60 : 10}
              paused={paused}
            />
          </div>
        </div>
      </div>
      <div className="mt-1.5 px-0.5">
        <h3 className="text-xs font-medium text-foreground leading-tight">{shader.name}</h3>
      </div>
    </button>
  );
}
