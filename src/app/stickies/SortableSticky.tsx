"use client";
import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
export function SortableSticky({id, title, disabled, editing, paper, className, children}: {
  id: string; title: string; disabled: boolean; editing: boolean; paper: number;
  className: string; children: ReactNode;
}) {
  const {setNodeRef, setActivatorNodeRef, attributes, listeners, transform, isDragging} = useSortable({id, disabled});
  return <div ref={setNodeRef} className={className} data-sticky-id={id}
    data-editing={editing} data-paper={paper} data-dragging={isDragging}
    style={{translate: transform ? transform.x + 'px ' + transform.y + 'px' : undefined,
      zIndex: isDragging ? 30 : undefined, transition: isDragging ? 'none' : undefined}}>
    {children}
    {!editing && <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners}
      disabled={disabled} className="sticky-drag-handle"
      aria-label={'拖曳排序便條紙「' + (title || '未命名') + '」'}
      title="拖曳換順序；也可按空白鍵後用方向鍵移動">
      <GripVertical size={18} aria-hidden="true" />
    </button>}
  </div>;
}
