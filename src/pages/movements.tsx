import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getMovements } from '@/lib/firebase/movements';
import { ArrowDownToLine, ArrowUpFromLine, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InstructionPanel } from '@/components/instruction-panel';
import { useInstructions } from '@/contexts/InstructionsContext';
import { toast } from 'sonner';
import { useFirebase } from '@/contexts/FirebaseContext';
import type { Movement } from '@/types/warehouse';

export default function MovementsPage() {
  const { user, authLoading } = useFirebase();
  const { showInstructions } = useInstructions();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && !authLoading) {
      loadMovements();
    }
  }, [user, authLoading]);

  const loadMovements = async () => {
    if (!user || authLoading) return;
    
    try {
      setLoading(true);
      const fetchedMovements = await getMovements();
      setMovements(fetchedMovements.slice(0, 20)); // Only show last 20 movements
    } catch (error) {
      console.error('Error loading movements:', error);
      toast.error('Failed to load movements');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp?.toDate) return '—';
    return format(timestamp.toDate(), 'PPpp');
  };

  const instructionSteps = [
    {
      title: "Movement Types",
      description: "IN movements (blue) represent items entering the warehouse, OUT movements (orange) represent items leaving.",
      type: "info" as const
    },
    {
      title: "Movement Details",
      description: "View reference codes (Product/SKU), weights, operators, detailed notes, and timestamps for each movement.",
      type: "info" as const
    },
    {
      title: "Real-time Updates",
      description: "The movement log automatically updates when new transactions are processed in the warehouse.",
      type: "tip" as const
    },
    {
      title: "Audit Trail",
      description: "This provides a complete audit trail of all warehouse activities for tracking and compliance purposes.",
      type: "success" as const
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Recent Movements</h1>
        <Button onClick={loadMovements} variant="outline" disabled={loading}>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Instructions Panel */}
      {showInstructions && (
        <InstructionPanel
          title="Movement History"
          description="Track all warehouse movements and transactions. Monitor goods in, goods out, and item placements in real-time."
          steps={instructionSteps}
          onClose={() => {}}
          className="mb-6"
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Movement History</CardTitle>
          <CardDescription>
            Last 20 warehouse movements
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">
              Loading movements...
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No movements recorded yet.
            </div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Operator</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={movement.type === 'IN' ? 
                            'bg-blue-100 text-blue-800' : 
                            'bg-orange-100 text-orange-800'
                          }
                        >
                          {movement.type === 'IN' ? (
                            <ArrowDownToLine className="h-4 w-4 mr-1 inline" />
                          ) : (
                            <ArrowUpFromLine className="h-4 w-4 mr-1 inline" />
                          )}
                          {movement.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{movement.reference}</TableCell>
                      <TableCell>{movement.weight}kg</TableCell>
                      <TableCell>{movement.operator}</TableCell>
                      <TableCell>{movement.notes}</TableCell>
                      <TableCell>{formatTimestamp(movement.timestamp)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}