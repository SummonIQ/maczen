import * as React from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  delayMs?: number;
  className?: string;
  disabled?: boolean;
};

const callHandler = <T extends (...args: any[]) => void>(
  handler: T | undefined,
  ...args: Parameters<T>
) => {
  if (typeof handler === "function") {
    handler(...args);
  }
};

export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  sideOffset = 8,
  delayMs = 120,
  className,
  disabled = false,
}: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  const openTimerRef = React.useRef<number | null>(null);

  const clearOpenTimer = React.useCallback(() => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  React.useEffect(
    () => () => {
      clearOpenTimer();
    },
    [clearOpenTimer],
  );

  const scheduleOpen = React.useCallback(() => {
    if (disabled) return;
    clearOpenTimer();
    openTimerRef.current = window.setTimeout(() => {
      setOpen(true);
    }, delayMs);
  }, [clearOpenTimer, delayMs, disabled]);

  const closeNow = React.useCallback(() => {
    clearOpenTimer();
    setOpen(false);
  }, [clearOpenTimer]);

  const child = React.Children.only(children);
  const wrappedChild = React.cloneElement(child, {
    "data-tooltip-open": open ? "true" : undefined,
    onMouseEnter: (event: React.MouseEvent) => {
      callHandler((child.props as any).onMouseEnter, event);
      scheduleOpen();
    },
    onMouseLeave: (event: React.MouseEvent) => {
      callHandler((child.props as any).onMouseLeave, event);
      closeNow();
    },
    onFocus: (event: React.FocusEvent) => {
      callHandler((child.props as any).onFocus, event);
      scheduleOpen();
    },
    onBlur: (event: React.FocusEvent) => {
      callHandler((child.props as any).onBlur, event);
      closeNow();
    },
    onPointerDown: (event: React.PointerEvent) => {
      callHandler((child.props as any).onPointerDown, event);
      closeNow();
    },
  });

  if (disabled) {
    return wrappedChild;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{wrappedChild}</PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "pointer-events-none z-40 w-auto max-w-none whitespace-nowrap border border-white/15 bg-neutral-950/95 px-2 py-1 text-[10px] font-medium text-white/85 shadow-xl shadow-black/60 backdrop-blur-xl",
          className,
        )}
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}
