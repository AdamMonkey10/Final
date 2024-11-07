import { useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, Trash2, Plus } from 'lucide-react';
import { CategoryDialog } from './category-dialog';
import type { Category } from '@/lib/firebase/categories';

interface CategoriesTabProps {
  categories: Category[];
  onSaveCategory: (data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onDeleteCategory: (category: Category) => Promise<void>;
}

export function CategoriesTab({
  categories,
  onSaveCategory,
  onDeleteCategory
}: CategoriesTabProps) {
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Item Categories</span>
          <Button onClick={() => {
            setSelectedCategory(undefined);
            setShowCategoryDialog(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </CardTitle>
        <CardDescription>
          Manage product categories and Kanban rules
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Min Qty</TableHead>
                <TableHead>Max Qty</TableHead>
                <TableHead>Reorder Point</TableHead>
                <TableHead>Reorder Qty</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">
                    {category.name}
                    {category.isDefault && (
                      <Badge variant="secondary" className="ml-2">
                        Default
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{category.prefix}</TableCell>
                  <TableCell>{category.kanbanRules.minQuantity}</TableCell>
                  <TableCell>{category.kanbanRules.maxQuantity}</TableCell>
                  <TableCell>{category.kanbanRules.reorderPoint}</TableCell>
                  <TableCell>{category.kanbanRules.reorderQuantity}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCategory(category);
                        setShowCategoryDialog(true);
                      }}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    {!category.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteCategory(category)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Category Dialog */}
      {showCategoryDialog && (
        <CategoryDialog
          open={showCategoryDialog}
          onOpenChange={setShowCategoryDialog}
          onSave={onSaveCategory}
          category={selectedCategory}
        />
      )}
    </Card>
  );
}