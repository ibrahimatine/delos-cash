// A long list scrolling inside its card (`.flow-scroll`), the head of the
// card staying in place. At either end of the list, the wheel goes on with
// the page at once: browsers otherwise keep a wheel gesture on the box
// (scroll latching) until the mouse moves or pauses.
import type { ReactNode } from 'react'
import type { WheelEvent as ReactWheelEvent } from 'react'

const LINE = 16 // px per line when the wheel counts in lines

const handOver = (e: ReactWheelEvent<HTMLDivElement>) => {
  const box = e.currentTarget as HTMLElement
  if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
  const delta = e.deltaMode === 1 ? e.deltaY * LINE : e.deltaY
  const atTop = box.scrollTop <= 0
  const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 1
  if ((delta > 0 && atBottom) || (delta < 0 && atTop)) {
    e.preventDefault()
    globalThis.scrollBy({ top: delta })
  }
}

export const ScrollBox = (
  { children, className }: {
    children: ReactNode
    className?: string
  },
) => (
  <div className={`flow-scroll ${className ?? ''}`} onWheel={handOver}>
    {children}
  </div>
)
