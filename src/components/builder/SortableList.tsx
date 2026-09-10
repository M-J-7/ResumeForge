/**
 * Drag-and-drop reordering that also works without a mouse.
 *
 * dnd-kit's `KeyboardSensor` is included deliberately: M0-T8 requires a full
 * resume to be buildable with the keyboard alone, and reordering is part of
 * building one. The drag handle is a real focusable button, so the sequence
 * is tab to it, space to lift, arrows to move, space to drop.
 */

"use client";

import type { ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { DragIcon } from "@/components/ui/icons";

export function SortableList({
  ids,
  onReorder,
  children,
}: {
  ids: string[];
  onReorder: (from: number, to: number) => void;
  children: ReactNode;
}) {
  const sensors = useSensors(
    // A small activation distance so a click on a button inside the row is
    // not swallowed as the start of a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onReorder(from, to);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

export function SortableItem({
  id,
  children,
  label,
}: {
  id: string;
  /** Receives the handle so the row decides where to place it. */
  children: (handle: ReactNode) => ReactNode;
  /** Announced to screen readers, e.g. "Reorder Senior Backend Engineer". */
  label: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const handle = (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "text-faint hover:bg-surface-2 hover:text-text cursor-grab touch-none rounded p-1 transition",
        "focus-visible:ring-accent focus-visible:ring-2 focus-visible:outline-none",
        isDragging && "cursor-grabbing",
      )}
      {...attributes}
      {...listeners}
    >
      <DragIcon className="h-4 w-4" />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        // A real lift while dragging: a stronger shadow and a slight scale,
        // rather than only the pre-existing opacity dip — makes it legible
        // which row is airborne when several are close together.
        isDragging && "relative z-10 scale-[1.02] opacity-95 shadow-[var(--shadow-page)]",
      )}
    >
      {children(handle)}
    </div>
  );
}
