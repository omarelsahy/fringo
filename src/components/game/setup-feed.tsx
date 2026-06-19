import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { SetupFeedItem } from '@/lib/constants'
import { ChevronUp } from 'lucide-react'

interface SetupFeedProps {
  items: SetupFeedItem[]
  onToggleUpvote: (item: SetupFeedItem) => void
  loading?: boolean
}

export function SetupFeed({ items, onToggleUpvote, loading }: SetupFeedProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No submissions yet. Be the first to add an action!
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="flex gap-3 p-4">
            <Button
              variant={item.voted_by_me ? 'default' : 'outline'}
              size="sm"
              className="h-auto min-w-[48px] flex-col py-2"
              disabled={loading}
              onClick={() => onToggleUpvote(item)}
            >
              <ChevronUp className="h-4 w-4" />
              <span>{item.vote_count}</span>
            </Button>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{item.target_display_name}</Badge>
                {item.is_mine && <Badge variant="outline">Yours</Badge>}
                {item.status === 'selected' && <Badge variant="success">Selected</Badge>}
              </div>
              <p className="text-sm">{item.text}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
