'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/shared/lib/utils'

// Stop React's SYNTHETIC event propagation without stopping NATIVE DOM
// propagation. React's SyntheticEvent.stopPropagation() also calls the
// underlying nativeEvent.stopPropagation(); here we neutralize just that for the
// duration of the call. Result: `isPropagationStopped` is still set — so a click
// inside a portaled dialog does NOT leak up the FIBER tree to a clickable React
// ancestor (e.g. a pipeline kanban card whose onClick opened the modal) — while
// the native click keeps bubbling to `document`, where Radix's popover/menu
// dismiss listener lives. That native reach is required for touch "tap-away to
// close": on touch, Radix DismissableLayer defers dismissal to a document-level
// `click` listener, so a plain stopPropagation() (which also kills native
// bubbling) silently breaks tap-away for every Radix layer opened in a dialog.
function stopReactPropagationOnly(e: React.SyntheticEvent) {
  const nativeEvent = e.nativeEvent
  const nativeStopPropagation = nativeEvent.stopPropagation.bind(nativeEvent)
  nativeEvent.stopPropagation = () => {}
  e.stopPropagation()
  nativeEvent.stopPropagation = nativeStopPropagation
}

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-background/50',
        className,
      )}
      {...props}
      // Contain backdrop clicks for the same reason as DialogContent below: the
      // overlay is a portal sibling of the content, so a click on it would also
      // bubble the FIBER tree to a clickable ancestor. Stop the synthetic bubble
      // only (see stopReactPropagationOnly) so native document-level dismiss
      // still fires.
      onClick={(e) => {
        stopReactPropagationOnly(e)
        onClick?.(e)
      }}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onClick,
  onKeyDown,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg',
          className,
        )}
        {...props}
        // A modal is an interaction boundary. Radix portals this content to
        // <body>, but React synthetic events still bubble along the FIBER tree,
        // not the DOM tree — so a click inside a dialog rendered by a clickable
        // ancestor (e.g. a pipeline kanban card that opens the customer profile
        // on click) would propagate to that ancestor's onClick and fire it.
        // stopReactPropagationOnly contains every modal's clicks at its own
        // boundary, for every consumer, WITHOUT killing native DOM propagation —
        // Radix's touch tap-away dismiss needs the native click to reach
        // `document`. (Consumer onClick, if any, still runs.)
        onClick={(e) => {
          stopReactPropagationOnly(e)
          onClick?.(e)
        }}
        // Same reasoning for keyboard: without this, a keystroke inside the
        // modal (e.g. Space in a textarea) bubbles the fiber tree to an ancestor
        // that spreads dnd-kit listeners (the draggable pipeline card), whose
        // KeyboardSensor treats Space/arrows/Enter as drag-activation keys —
        // so typing a space would start dragging the card. Radix's own Escape/
        // Tab handling is unaffected (native document listeners, not this).
        onKeyDown={(e) => {
          e.stopPropagation()
          onKeyDown?.(e)
        }}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-lg leading-none font-semibold', className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
