import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  showTooltip?: boolean;
  formatTooltip?: (value: number) => string;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, showTooltip = true, formatTooltip, value, defaultValue, ...props }, ref) => {
  const [isInteracting, setIsInteracting] = React.useState(false);
  const currentValue = value?.[0] ?? defaultValue?.[0] ?? 0;
  const tooltipText = formatTooltip ? formatTooltip(currentValue) : `${currentValue}%`;

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      value={value}
      defaultValue={defaultValue}
      onPointerDown={() => setIsInteracting(true)}
      onPointerUp={() => setIsInteracting(false)}
      onPointerLeave={() => setIsInteracting(false)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-3 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="relative block h-6 w-6 rounded-full border-2 border-accent bg-background shadow-lg ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
        {showTooltip && isInteracting && (
          <span className="absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 text-xs font-medium bg-foreground text-background rounded shadow-md whitespace-nowrap">
            {tooltipText}
          </span>
        )}
      </SliderPrimitive.Thumb>
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
