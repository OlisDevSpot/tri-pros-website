'use client'

import type { DragEndEvent } from '@dnd-kit/core'
import type { ReactNode } from 'react'
import {
  DndContext,

  rectIntersection,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { cn } from '@/shared/lib/utils'

export type { DragEndEvent } from '@dnd-kit/core'

interface Status {
  id: string
  name: string
  color: string
}

interface Feature {
  id: string
  name: string
  startAt: Date
  endAt: Date
  status: Status
}

export interface ListItemsProps {
  children: ReactNode
  className?: string
}

export function ListItems({ children, className }: ListItemsProps) {
  return (
    <div className={cn('flex flex-1 flex-col gap-2 p-3', className)}>
      {children}
    </div>
  )
}

export type ListHeaderProps
  = | {
    children: ReactNode
  }
  | {
    name: Status['name']
    color: Status['color']
    className?: string
  }

export function ListHeader(props: ListHeaderProps) {
  return 'children' in props
    ? (
        props.children
      )
    : (
        <div
          className={cn(
            'flex shrink-0 items-center gap-2 bg-foreground/5 p-3',
            props.className,
          )}
        >
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: props.color }}
          />
          <p className="m-0 font-semibold text-sm">{props.name}</p>
        </div>
      )
}

export interface ListGroupProps {
  id: Status['id']
  children: ReactNode
  className?: string
}

export function ListGroup({ id, children, className }: ListGroupProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      className={cn(
        'bg-secondary transition-colors',
        isOver && 'bg-foreground/10',
        className,
      )}
      ref={setNodeRef}
    >
      {children}
    </div>
  )
}

export type ListItemProps = Pick<Feature, 'id' | 'name'> & {
  readonly index: number
  readonly parent: string
  readonly children?: ReactNode
  readonly className?: string
}

export function ListItem({
  id,
  name,
  index,
  parent,
  children,
  className,
}: ListItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging }
    = useDraggable({
      id,
      data: { index, parent },
    })

  return (
    <div
      className={cn(
        'flex cursor-grab items-center gap-2 rounded-md border bg-background p-2 shadow-sm',
        isDragging && 'cursor-grabbing',
        className,
      )}
      style={{
        transform: transform
          ? `translateX(${transform.x}px) translateY(${transform.y}px)`
          : 'none',
      }}
      {...listeners}
      {...attributes}
      ref={setNodeRef}
    >
      {children ?? <p className="m-0 font-medium text-sm">{name}</p>}
    </div>
  )
}

export interface ListProviderProps {
  children: ReactNode
  onDragEnd: (event: DragEndEvent) => void
  className?: string
}

export function ListProvider({
  children,
  onDragEnd,
  className,
}: ListProviderProps) {
  return (
    <DndContext
      collisionDetection={rectIntersection}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
    >
      <div className={cn('flex size-full flex-col', className)}>{children}</div>
    </DndContext>
  )
}
