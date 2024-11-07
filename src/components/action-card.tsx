import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowDownToLine, ArrowUpFromLine, List, MapPin, MoreVertical, Scan, Trash2, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { WarehouseAction } from '@/lib/firebase/actions';

interface ActionCardProps {
  action: WarehouseAction;
  suggestedLocations: Record<string, string>;
  onActionSelect: (action: WarehouseAction) => void;
  onShowLocations: (action: WarehouseAction) => void;
  onDeleteAction: (action: WarehouseAction) => void;
}

export function ActionCard({ 
  action, 
  suggestedLocations,
  onActionSelect,
  onShowLocations,
  onDeleteAction
}: ActionCardProps) {
  const getActionBadge = (action: WarehouseAction) => {
    const styles = action.actionType === 'in' 
      ? 'bg-blue-100 text-blue-800' 
      : 'bg-orange-100 text-orange-800';
    
    return (
      <Badge variant="outline" className={styles}>
        {action.actionType === 'in' ? 'Goods In' : 'Pick'}
      </Badge>
    );
  };

  const getCategoryBadge = (category: string) => {
    const styles = {
      raw: 'bg-blue-100 text-blue-800',
      finished: 'bg-green-100 text-green-800',
      packaging: 'bg-yellow-100 text-yellow-800',
      spare: 'bg-purple-100 text-purple-800',
    }[category] || 'bg-gray-100 text-gray-800';

    const labels = {
      raw: 'Raw Materials',
      finished: 'Finished Goods',
      packaging: 'Packaging',
      spare: 'Spare Parts',
    }[category] || category;

    return (
      <Badge variant="outline" className={styles}>
        {labels}
      </Badge>
    );
  };

  const getStatusColor = (action: WarehouseAction) => {
    const baseColors = {
      in: {
        pending: 'bg-blue-100 text-blue-800',
        'in-progress': 'bg-yellow-100 text-yellow-800',
        completed: 'bg-green-100 text-green-800',
      },
      out: {
        pending: 'bg-orange-100 text-orange-800',
        'in-progress': 'bg-yellow-100 text-yellow-800',
        completed: 'bg-green-100 text-green-800',
      },
    };
    return baseColors[action.actionType][action.status];
  };

  const getTimeAgo = () => {
    if (!action.timestamp?.toDate) return 'Just now';
    return formatDistanceToNow(action.timestamp.toDate(), { addSuffix: true });
  };

  return (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              {getActionBadge(action)}
              <h4 className="font-semibold mt-2">{action.itemCode}</h4>
              <p className="text-sm text-muted-foreground">{action.description}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Clock className="h-3 w-3" />
                {getTimeAgo()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline"
                className={getStatusColor(action)}
              >
                {action.status.charAt(0).toUpperCase() + action.status.slice(1)}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onShowLocations(action)}>
                    <List className="h-4 w-4 mr-2" />
                    Select Location
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onActionSelect(action)}>
                    <Scan className="h-4 w-4 mr-2" />
                    Scan Item
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => onDeleteAction(action)}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Category:</span>
              <div className="mt-1">{getCategoryBadge(action.category)}</div>
            </div>
            <div>
              <span className="text-muted-foreground">Department:</span>
              <div className="mt-1">{action.department || '—'}</div>
            </div>
          </div>

          <div className="text-sm">
            <span className="text-muted-foreground">Location:</span>
            <div className="mt-1">
              {action.actionType === 'in' ? (
                suggestedLocations[action.id] ? (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {suggestedLocations[action.id]}
                  </Badge>
                ) : '—'
              ) : (
                action.location || '—'
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {action.status !== 'completed' && (
              <Button
                variant="outline"
                onClick={() => onActionSelect(action)}
                className="flex-1 flex items-center justify-center gap-2"
              >
                {action.actionType === 'in' ? (
                  <>
                    <ArrowDownToLine className="h-4 w-4" />
                    {action.location ? 'View Location' : 'Select Location'}
                  </>
                ) : (
                  <>
                    <ArrowUpFromLine className="h-4 w-4" />
                    View Location
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}