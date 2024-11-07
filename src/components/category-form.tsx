import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X } from 'lucide-react';
import { StockLevelIndicator } from './stock-level-indicator';
import type { Location } from '@/types/warehouse';
import type { Category } from '@/lib/firebase/categories';

interface CategoryFormProps {
  formData: Partial<Category>;
  onChange: (data: Partial<Category>) => void;
  locations: Location[];
}

export function CategoryForm({ formData, onChange, locations }: CategoryFormProps) {
  const handleGoodsInToggle = (enabled: boolean) => {
    onChange({
      ...formData,
      kanbanRules: {
        ...formData.kanbanRules!,
        goodsIn: enabled,
        // Reset quantities when toggling off
        ...(enabled ? {} : {
          minQuantity: 0,
          maxQuantity: 0,
          reorderPoint: 0,
          reorderQuantity: 0,
          currentQuantity: 0,
          fixedLocations: []
        })
      }
    });
  };

  const handleLocationSelect = (value: string) => {
    if (!formData.kanbanRules) return;
    const currentLocations = formData.kanbanRules.fixedLocations || [];
    if (!currentLocations.includes(value)) {
      onChange({
        ...formData,
        kanbanRules: {
          ...formData.kanbanRules,
          fixedLocations: [...currentLocations, value]
        }
      });
    }
  };

  const handleLocationRemove = (location: string) => {
    if (!formData.kanbanRules) return;
    onChange({
      ...formData,
      kanbanRules: {
        ...formData.kanbanRules,
        fixedLocations: formData.kanbanRules.fixedLocations.filter(loc => loc !== location)
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => onChange({ ...formData, name: e.target.value })}
            placeholder="Category name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prefix">Prefix</Label>
          <Input
            id="prefix"
            value={formData.prefix}
            onChange={(e) => onChange({ ...formData, prefix: e.target.value })}
            placeholder="Category prefix"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={formData.description}
            onChange={(e) => onChange({ ...formData, description: e.target.value })}
            placeholder="Category description"
          />
        </div>

        <div className="space-y-4 border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Kanban Rules</h3>
              <p className="text-sm text-muted-foreground">
                Enable for quantity-based stock management
              </p>
            </div>
            <Switch
              checked={formData.kanbanRules?.goodsIn || false}
              onCheckedChange={handleGoodsInToggle}
            />
          </div>

          {formData.kanbanRules?.goodsIn && (
            <>
              {formData.kanbanRules.currentQuantity > 0 && (
                <div className="mb-4">
                  <StockLevelIndicator rules={formData.kanbanRules} showToast />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minQuantity">Minimum Quantity</Label>
                  <Input
                    id="minQuantity"
                    type="number"
                    min="0"
                    value={formData.kanbanRules.minQuantity}
                    onChange={(e) => onChange({
                      ...formData,
                      kanbanRules: {
                        ...formData.kanbanRules,
                        minQuantity: parseInt(e.target.value) || 0
                      }
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxQuantity">Maximum Quantity</Label>
                  <Input
                    id="maxQuantity"
                    type="number"
                    min="0"
                    value={formData.kanbanRules.maxQuantity}
                    onChange={(e) => onChange({
                      ...formData,
                      kanbanRules: {
                        ...formData.kanbanRules,
                        maxQuantity: parseInt(e.target.value) || 0
                      }
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reorderPoint">Reorder Point</Label>
                  <Input
                    id="reorderPoint"
                    type="number"
                    min="0"
                    value={formData.kanbanRules.reorderPoint}
                    onChange={(e) => onChange({
                      ...formData,
                      kanbanRules: {
                        ...formData.kanbanRules,
                        reorderPoint: parseInt(e.target.value) || 0
                      }
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reorderQuantity">Reorder Quantity</Label>
                  <Input
                    id="reorderQuantity"
                    type="number"
                    min="1"
                    value={formData.kanbanRules.reorderQuantity}
                    onChange={(e) => onChange({
                      ...formData,
                      kanbanRules: {
                        ...formData.kanbanRules,
                        reorderQuantity: parseInt(e.target.value) || 0
                      }
                    })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Fixed Locations</Label>
                <Select onValueChange={handleLocationSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Add location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.code} value={location.code}>
                        {location.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.kanbanRules.fixedLocations?.map((location) => (
                    <Badge key={location} variant="secondary" className="flex items-center gap-1">
                      {location}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-transparent"
                        onClick={() => handleLocationRemove(location)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}