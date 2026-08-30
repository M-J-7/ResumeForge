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
        "cursor-grab touch-none rounded p-1 text-zinc-400 transition",
        "hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
        "focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:outline-none",
        isDragging && "cursor-grabbing",
      )}
      {...attributes}
      {...listeners}
    >
      <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 fill-current">
        <circle cx="7" cy="5" r="1.4" />
        <circle cx="13" cy="5" r="1.4" />
        <circle cx="7" cy="10" r="1.4" />
        <circle cx="13" cy="10" r="1.4" />
        <circle cx="7" cy="15" r="1.4" />
        <circle cx="13" cy="15" r="1.4" />
      </svg>
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "relative z-10 opacity-90 shadow-lg")}
    >
      {children(handle)}
    </div>
  );
}
