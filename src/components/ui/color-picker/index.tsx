"use client";

import Color from "color";
import { PipetteIcon } from "lucide-react";
import * as Slider from "@radix-ui/react-slider";
import {
  type ComponentProps,
  createContext,
  type HTMLAttributes,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ColorPickerContextValue {
  hue: number;
  saturation: number;
  lightness: number;
  alpha: number;
  setColor: (h: number, s: number, l: number) => void;
  setAlpha: (alpha: number) => void;
}

const ColorPickerContext = createContext<ColorPickerContextValue | undefined>(
  undefined
);

export const useColorPicker = () => {
  const context = useContext(ColorPickerContext);

  if (!context) {
    throw new Error("useColorPicker must be used within a ColorPickerProvider");
  }

  return context;
};

const parseColor = (colorValue: string | undefined, defaultValue: string) => {
  try {
    const color = Color(colorValue || defaultValue);
    return {
      h: color.hue() || 0,
      s: color.saturationl() || 100,
      l: color.lightness() || 50,
    };
  } catch {
    return { h: 0, s: 100, l: 50 };
  }
};

export type ColorPickerProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange"
> & {
  value?: string;
  defaultValue?: string;
  alpha?: number;
  onChange?: (color: string) => void;
  onAlphaChange?: (alpha: number) => void;
};

export const ColorPicker = ({
  value,
  defaultValue = "#000000",
  alpha: controlledAlpha,
  onChange,
  onAlphaChange,
  className,
  children,
  ...props
}: ColorPickerProps) => {
  const colorValues = useMemo(
    () => parseColor(value, defaultValue),
    [value, defaultValue]
  );

  const alphaValue =
    controlledAlpha !== undefined ? controlledAlpha * 100 : 100;

  const handleSetColor = useCallback(
    (h: number, s: number, l: number) => {
      if (onChange) {
        const color = Color.hsl(h, s, l);
        onChange(color.hex());
      }
    },
    [onChange]
  );

  const handleSetAlpha = useCallback(
    (a: number) => {
      if (onAlphaChange) {
        onAlphaChange(a / 100);
      }
    },
    [onAlphaChange]
  );

  return (
    <ColorPickerContext.Provider
      value={{
        hue: colorValues.h,
        saturation: colorValues.s,
        lightness: colorValues.l,
        alpha: alphaValue,
        setColor: handleSetColor,
        setAlpha: handleSetAlpha,
      }}
    >
      <div className={cn("flex flex-col gap-2", className)} {...props}>
        {children}
      </div>
    </ColorPickerContext.Provider>
  );
};

export type ColorPickerSelectionProps = HTMLAttributes<HTMLDivElement>;

export const ColorPickerSelection = memo(
  ({ className, ...props }: ColorPickerSelectionProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const { hue, saturation, lightness, setColor } = useColorPicker();

    // Calculate position from saturation and lightness
    const positionX = saturation / 100;
    const positionY = useMemo(() => {
      const topLightness =
        saturation < 1 ? 100 : 50 + 50 * (1 - saturation / 100);
      if (topLightness === 0) return 1;
      return Math.max(0, Math.min(1, 1 - lightness / topLightness));
    }, [saturation, lightness]);

    const backgroundGradient = useMemo(() => {
      return `linear-gradient(0deg, rgba(0,0,0,1), rgba(0,0,0,0)),
            linear-gradient(90deg, rgba(255,255,255,1), rgba(255,255,255,0)),
            hsl(${hue}, 100%, 50%)`;
    }, [hue]);

    const updateFromPosition = useCallback(
      (clientX: number, clientY: number) => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

        const newSaturation = x * 100;
        const topLightness = x < 0.01 ? 100 : 50 + 50 * (1 - x);
        const newLightness = topLightness * (1 - y);

        setColor(hue, newSaturation, newLightness);
      },
      [hue, setColor]
    );

    useEffect(() => {
      if (!isDragging) return;

      const handleMove = (e: PointerEvent) => {
        updateFromPosition(e.clientX, e.clientY);
      };

      const handleUp = () => {
        setIsDragging(false);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);

      return () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };
    }, [isDragging, updateFromPosition]);

    return (
      <div
        className={cn(
          "relative h-32 w-full cursor-crosshair rounded-md",
          className
        )}
        onPointerDown={(e) => {
          e.preventDefault();
          setIsDragging(true);
          updateFromPosition(e.clientX, e.clientY);
        }}
        ref={containerRef}
        style={{
          background: backgroundGradient,
        }}
        {...props}
      >
        <div
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
          style={{
            left: `${positionX * 100}%`,
            top: `${positionY * 100}%`,
            boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
          }}
        />
      </div>
    );
  }
);

ColorPickerSelection.displayName = "ColorPickerSelection";

export type ColorPickerHueProps = ComponentProps<typeof Slider.Root>;

export const ColorPickerHue = ({
  className,
  ...props
}: ColorPickerHueProps) => {
  const { hue, saturation, lightness, setColor } = useColorPicker();

  return (
    <Slider.Root
      className={cn("relative flex h-3 w-full touch-none", className)}
      min={0}
      max={360}
      onValueChange={([h]) => setColor(h, saturation, lightness)}
      step={1}
      value={[hue]}
      {...props}
    >
      <Slider.Track className="relative h-3 w-full grow rounded-full bg-[linear-gradient(90deg,#FF0000,#FFFF00,#00FF00,#00FFFF,#0000FF,#FF00FF,#FF0000)]">
        <Slider.Range className="absolute h-full" />
      </Slider.Track>
      <Slider.Thumb
        className="block h-4 w-4 rounded-full border-2 border-white bg-transparent shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.5)" }}
      />
    </Slider.Root>
  );
};

export type ColorPickerAlphaProps = ComponentProps<typeof Slider.Root>;

export const ColorPickerAlpha = ({
  className,
  ...props
}: ColorPickerAlphaProps) => {
  const { hue, saturation, lightness, alpha, setAlpha } = useColorPicker();
  const color = Color.hsl(hue, saturation, lightness).hex();

  return (
    <Slider.Root
      className={cn("relative flex h-3 w-full touch-none", className)}
      min={0}
      max={100}
      onValueChange={([a]) => setAlpha(a)}
      step={1}
      value={[alpha]}
      {...props}
    >
      <Slider.Track
        className="relative h-3 w-full grow rounded-full"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}), url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==") left center`,
        }}
      >
        <Slider.Range className="absolute h-full rounded-full bg-transparent" />
      </Slider.Track>
      <Slider.Thumb
        className="block h-4 w-4 rounded-full border-2 border-white bg-transparent shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.5)" }}
      />
    </Slider.Root>
  );
};

export type ColorPickerEyeDropperProps = ComponentProps<typeof Button>;

export const ColorPickerEyeDropper = ({
  className,
  ...props
}: ColorPickerEyeDropperProps) => {
  const { setColor, setAlpha } = useColorPicker();

  const handleEyeDropper = async () => {
    try {
      // @ts-expect-error - EyeDropper API is experimental
      const eyeDropper = new EyeDropper();
      const result = await eyeDropper.open();
      const color = Color(result.sRGBHex);
      const [h, s, l] = color.hsl().array();

      setColor(h, s, l);
      setAlpha(100);
    } catch (error) {
      console.error("EyeDropper failed:", error);
    }
  };

  return (
    <Button
      className={cn("shrink-0 text-muted-foreground", className)}
      onClick={handleEyeDropper}
      size="icon"
      variant="outline"
      type="button"
      {...props}
    >
      <PipetteIcon size={16} />
    </Button>
  );
};

export type ColorPickerInputProps = HTMLAttributes<HTMLDivElement> & {
  showAlpha?: boolean;
};

export const ColorPickerInput = ({
  className,
  showAlpha = true,
  ...props
}: ColorPickerInputProps) => {
  const { hue, saturation, lightness, alpha } = useColorPicker();
  const color = Color.hsl(hue, saturation, lightness);
  const hex = color.hex().replace("#", "").toUpperCase();

  return (
    <div className={cn("flex items-center gap-1.5", className)} {...props}>
      <div className="flex-1">
        <Input
          className="h-7 bg-input/30 border-border text-xs font-mono uppercase px-2"
          readOnly
          type="text"
          value={hex}
        />
      </div>
      {showAlpha && (
        <div className="w-16">
          <Input
            className="h-7 bg-input/30 border-border text-xs font-mono px-2 text-right"
            readOnly
            type="text"
            value={`${Math.round(alpha)}%`}
          />
        </div>
      )}
    </div>
  );
};

export type ColorPickerSwatchProps = HTMLAttributes<HTMLDivElement>;

export const ColorPickerSwatch = ({
  className,
  ...props
}: ColorPickerSwatchProps) => {
  const { hue, saturation, lightness, alpha } = useColorPicker();
  const color = Color.hsl(hue, saturation, lightness).alpha(alpha / 100);

  return (
    <div
      className={cn(
        "h-7 w-7 rounded-md border border-border overflow-hidden",
        className
      )}
      style={{
        background: `url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==")`,
      }}
      {...props}
    >
      <div
        className="h-full w-full"
        style={{ backgroundColor: color.string() }}
      />
    </div>
  );
};
