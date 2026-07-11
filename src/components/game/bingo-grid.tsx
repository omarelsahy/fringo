import { useRef } from 'react'
import { Lock, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BoardSquareWithAction } from '@/types/app'

const LONG_PRESS_MS = 500

interface BingoGridProps {
  rows: number
  cols: number
  squares: BoardSquareWithAction[]
  onMark?: (squareId: string) => void
  onLongPress?: (square: BoardSquareWithAction) => void
  disabled?: boolean
  /** Board-level lock (e.g. target claimed) — grey overlay + lock icon */
  locked?: boolean
  /** Display name of the player who claimed this target */
  claimedBy?: string
}

export function BingoGrid({ rows, cols, squares, onMark, onLongPress, disabled, locked, claimedBy }: BingoGridProps) {
  const grid: (BoardSquareWithAction | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null),
  )

  for (const sq of squares) {
    grid[sq.row_index][sq.col_index] = sq
  }

  return (
    <div className="relative">
      <div
        className={cn('grid gap-2', locked && 'pointer-events-none select-none opacity-50 grayscale')}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        aria-hidden={locked || undefined}
      >
        {grid.flatMap((row, r) =>
          row.map((sq, c) => {
            if (!sq) {
              return <div key={`${r}-${c}`} className="aspect-square rounded-md bg-secondary/30" />
            }

            return (
              <SquareButton
                key={sq.id}
                square={sq}
                disabled={disabled}
                onMark={onMark}
                onLongPress={onLongPress}
              />
            )
          }),
        )}
      </div>
      {locked && (
        <div
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/60"
          aria-hidden
        >
          <Lock className="h-10 w-10 text-muted-foreground" strokeWidth={2} />
          <span className="text-sm font-medium text-muted-foreground">Target claimed</span>
          {claimedBy && (
            <span className="text-sm text-muted-foreground">Claimed by: {claimedBy}</span>
          )}
        </div>
      )}
    </div>
  )
}

function SquareButton({
  square,
  disabled,
  onMark,
  onLongPress,
}: {
  square: BoardSquareWithAction
  disabled?: boolean
  onMark?: (squareId: string) => void
  onLongPress?: (square: BoardSquareWithAction) => void
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressedRef = useRef(false)

  const isFree = square.state === 'free'
  const isMarked = square.state === 'marked' || square.state === 'winning'
  const isLocked = square.state === 'locked'
  const canMark = !disabled && square.state === 'unmarked' && onMark
  const canLongPress = !disabled && !isFree && !isLocked && onLongPress

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function startLongPress() {
    if (!canLongPress) return
    longPressedRef.current = false
    clearTimer()
    timerRef.current = setTimeout(() => {
      longPressedRef.current = true
      onLongPress?.(square)
    }, LONG_PRESS_MS)
  }

  function handleClick() {
    if (longPressedRef.current) {
      longPressedRef.current = false
      return
    }
    if (canMark) onMark(square.id)
  }

  return (
    <button
      type="button"
      disabled={!canMark && !canLongPress}
      onClick={handleClick}
      onMouseDown={startLongPress}
      onMouseUp={clearTimer}
      onMouseLeave={clearTimer}
      onTouchStart={startLongPress}
      onTouchEnd={clearTimer}
      onTouchCancel={clearTimer}
      onContextMenu={(e) => {
        if (canLongPress) e.preventDefault()
      }}
      className={cn(
        'relative aspect-square rounded-md border p-1 text-left text-[10px] leading-tight transition-colors sm:text-xs',
        isFree && 'border-primary/40 bg-primary/10 font-semibold',
        isMarked && 'border-emerald-500/50 bg-emerald-500/20',
        (isLocked || square.state === 'unmarked') && 'border-border bg-card',
        !disabled && square.state === 'unmarked' && 'hover:border-primary/50',
        (canMark || canLongPress) && 'cursor-pointer active:scale-95',
        disabled && 'cursor-not-allowed',
      )}
    >
      {isFree ? 'FREE' : square.selected_actions?.action_text ?? '...'}
      {isLocked && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <X className="h-8 w-8 text-red-500" strokeWidth={3} />
        </span>
      )}
    </button>
  )
}
