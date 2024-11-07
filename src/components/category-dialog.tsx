import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getLocations } from '@/lib/firebase/locations';
import { subscribeToCategory } from '@/lib/firebase/categories';
import { CategoryForm } from './category-form';
import type { Location } from '@/types/warehouse';
import type { Category } from '@/lib/firebase/categories';

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => Promise<void>;
  editData?: Category;
}

export function CategoryDialog({
  open,
  onOpenChange,
  onSave,
  editData,
}: CategoryDialogProps) {
  const [formData, setFormData] = useState<Partial<Category>>({
    name: '',
    prefix: '',
    description: '',
    kanbanRules: {
      goodsIn: false,
      minQuantity: 0,
      maxQuantity: 0,
      reorderPoint: 0,
      reorderQuantity: 0,
      currentQuantity: 0,
      fixedLocations: []
    }
  });
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    if (open) {
      loadLocations();
      if (editData) {
        setFormData(editData);
        // Subscribe to real-time updates for the category
        const unsubscribe = subscribeToCategory(editData.id, (updatedCategory) => {
          if (updatedCategory) {
            setFormData(updatedCategory);
          }
        });
        return () => unsubscribe();
      } else {
        setFormData({
          name: '',
          prefix: '',
          description: '',
          kanbanRules: {
            goodsIn: false,
            minQuantity: 0,
            maxQuantity: 0,
            reorderPoint: 0,
            reorderQuantity: 0,
            currentQuantity: 0,
            fixedLocations: []
          }
        });
      }
    }
  }, [open, editData]);

  const loadLocations = async () => {
    try {
      const locationList = await getLocations();
      setLocations(locationList);
    } catch (error) {
      console.error('Error loading locations:', error);
      toast.error('Failed to load locations');
    }
  };

  const handleSubmit = async () => {
    try {
      if (!formData.name || !formData.prefix) {
        toast.error('Name and prefix are required');
        return;
      }

      if (formData.kanbanRules?.goodsIn) {
        if (!formData.kanbanRules.minQuantity || !formData.kanbanRules.maxQuantity) {
          toast.error('Min and max quantities are required for goods in items');
          return;
        }

        if (formData.kanbanRules.maxQuantity <= formData.kanbanRules.minQuantity) {
          toast.error('Max quantity must be greater than min quantity');
          return;
        }

        if (formData.kanbanRules.reorderPoint < formData.kanbanRules.minQuantity) {
          toast.error('Reorder point must be at least the minimum quantity');
          return;
        }

        if (formData.kanbanRules.reorderQuantity <= 0) {
          toast.error('Reorder quantity must be greater than 0');
          return;
        }

        if (!formData.kanbanRules.fixedLocations?.length) {
          toast.error('At least one fixed location is required for goods in items');
          return;
        }
      }

      setLoading(true);
      await onSave(formData);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error('Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editData ? 'Edit Category' : 'Add Category'}
          </DialogTitle>
          <DialogDescription>
            {editData ? 'Update category details and rules' : 'Create a new category with optional Kanban rules'}
          </DialogDescription>
        </DialogHeader>

        <CategoryForm
          formData={formData}
          onChange={setFormData}
          locations={locations}
        />

        <Button 
          onClick={handleSubmit} 
          className="w-full mt-6"
          disabled={loading}
        >
          {loading ? 'Saving...' : editData ? 'Update Category' : 'Add Category'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}