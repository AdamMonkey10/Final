import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { User, UserPlus, Users, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { addOperator } from '@/lib/firebase/operators';
import { useOperator } from '@/contexts/OperatorContext';

export function OperatorSelector() {
  const { operators, selectedOperator, setSelectedOperator, refreshOperators, loading } = useOperator();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newOperatorName, setNewOperatorName] = useState('');
  const [newOperatorEmail, setNewOperatorEmail] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const handleAddOperator = async () => {
    if (!newOperatorName.trim()) {
      toast.error('Please enter operator name');
      return;
    }

    setAddLoading(true);
    try {
      await addOperator(newOperatorName.trim(), newOperatorEmail.trim());
      await refreshOperators();
      toast.success('Operator added successfully');
      setNewOperatorName('');
      setNewOperatorEmail('');
      setShowAddDialog(false);
    } catch (error) {
      console.error('Error adding operator:', error);
      toast.error('Failed to add operator');
    } finally {
      setAddLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshOperators();
      toast.success('Operators refreshed');
    } catch (error) {
      console.error('Error refreshing operators:', error);
      toast.error('Failed to refresh operators');
    }
  };

  if (operators.length === 0 && !loading) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50">
          No Operators
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddDialog(true)}
          className="flex-shrink-0"
        >
          <UserPlus className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="flex-shrink-0"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>

        {/* Add Operator Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Add New Operator
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="operatorName">Name *</Label>
                <Input
                  id="operatorName"
                  value={newOperatorName}
                  onChange={(e) => setNewOperatorName(e.target.value)}
                  placeholder="Enter operator name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="operatorEmail">Email (optional)</Label>
                <Input
                  id="operatorEmail"
                  type="email"
                  value={newOperatorEmail}
                  onChange={(e) => setNewOperatorEmail(e.target.value)}
                  placeholder="Enter email address"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleAddOperator}
                  disabled={addLoading || !newOperatorName.trim()}
                  className="flex-1"
                >
                  {addLoading ? 'Adding...' : 'Add Operator'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowAddDialog(false)}
                  disabled={addLoading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <Select
          value={selectedOperator?.id || ''}
          onValueChange={(value) => {
            const operator = operators.find(op => op.id === value);
            setSelectedOperator(operator || null);
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select operator" />
          </SelectTrigger>
          <SelectContent>
            {operators.map((operator) => (
              <SelectItem key={operator.id} value={operator.id}>
                <div className="flex items-center gap-2">
                  <span>{operator.name}</span>
                  {operator.email && (
                    <Badge variant="secondary" className="text-xs">
                      {operator.email.split('@')[0]}
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowAddDialog(true)}
        className="flex-shrink-0"
      >
        <UserPlus className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        className="flex-shrink-0"
        disabled={loading}
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </Button>

      {/* Add Operator Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Add New Operator
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="operatorName">Name *</Label>
              <Input
                id="operatorName"
                value={newOperatorName}
                onChange={(e) => setNewOperatorName(e.target.value)}
                placeholder="Enter operator name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="operatorEmail">Email (optional)</Label>
              <Input
                id="operatorEmail"
                type="email"
                value={newOperatorEmail}
                onChange={(e) => setNewOperatorEmail(e.target.value)}
                placeholder="Enter email address"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAddOperator}
                disabled={addLoading || !newOperatorName.trim()}
                className="flex-1"
              >
                {addLoading ? 'Adding...' : 'Add Operator'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                disabled={addLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}