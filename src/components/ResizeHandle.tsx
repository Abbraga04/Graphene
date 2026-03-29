"use client";

import { useCallback, useEffect, useRef } from "react";

export default function ResizeHandle({
  onResize,
  direction = "horizontal",
}: {
  onResize: (delta: number) => void;
  direction?: "horizontal" | "vertical";
}) {
  const isDragging = useRef(false);
  const lastPos = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      lastPos.current = direction === "horizontal" ? e.clientX : e.clientY;
      document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [direction]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const pos = direction === "horizontal" ? e.clientX : e.clientY;
      const delta = pos - lastPos.current;
      lastPos.current = pos;
      onResize(delta);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [direction, onResize]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`shrink-0 bg-border hover:bg-border-hover active:bg-accent transition-colors ${
        direction === "horizontal"
          ? "w-[3px] cursor-col-resize hover:w-[4px]"
          : "h-[3px] cursor-row-resize hover:h-[4px]"
      }`}
    />
  );
}
