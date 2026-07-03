import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BoardSquareWithAction } from '@/types/app'

interface BingoGridProps {
  rows: number
  cols: number
  squares: BoardSquareWithAction[]
  onMark?: (squareId: string) => void
  disabled?: boolean
}

export function BingoGrid({ rows, cols, squares, onMark, disabled }: BingoGridProps) {
  const grid: (BoardSquareWithAction | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null),
  )

  for (const sq of squares) {
    grid[sq.row_index][sq.col_index] = sq
  }

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {grid.flatMap((row, r) =>
        row.map((sq, c) => {
          if (!sq) {
            return <div key={`${r}-${c}`} className="aspect-square rounded-md bg-secondary/30" />
          }

          const isFree = sq.state === 'free'
          const isMarked = sq.state === 'marked' || sq.state === 'winning'
          const isLocked = sq.state === 'locked'
          const canMark = !disabled && sq.state === 'unmarked' && onMark

          return (
            <button
              key={sq.id}
              type="button"
              disabled={!canMark}
              onClick={() => canMark && onMark(sq.id)}
              className={cn(
                'relative aspect-square rounded-md border p-1 text-left text-[10px] leading-tight transition-colors sm:text-xs',
                isFree && 'border-primary/40 bg-primary/10 font-semibold',
                isMarked && 'border-emerald-500/50 bg-emerald-500/20',
                (isLocked || sq.state === 'unmarked') && 'border-border bg-card',
                sq.state === 'unmarked' && 'hover:border-primary/50',
                canMark && 'cursor-pointer active:scale-95',
              )}
            >
              {isFree ? 'FREE' : sq.selected_actions?.action_text ?? '...'}
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
        }),
      )}
    </div>
  )
}
