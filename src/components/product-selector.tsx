import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown, Package, Plus, Clock, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getProducts, searchProducts, saveProduct, type Product } from '@/lib/firebase/products';
import { toast } from 'sonner';

interface ProductSelectorProps {
  value: string;
  onChange: (value: string) => void;
  onProductSelect?: (product: Product) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ProductSelector({ 
  value, 
  onChange, 
  onProductSelect, 
  placeholder = "Select or enter Product/SKU",
  disabled = false
}: ProductSelectorProps) {
  const [open, setOpen] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // New product form - only essential fields
  const [newProduct, setNewProduct] = useState({
    sku: '',
    description: ''
  });

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      searchProductsDebounced();
    } else {
      loadProducts();
    }
  }, [searchTerm]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const fetchedProducts = await getProducts();
      setProducts(fetchedProducts);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchProductsDebounced = async () => {
    try {
      setLoading(true);
      const results = await searchProducts(searchTerm);
      setProducts(results);
    } catch (error) {
      console.error('Error searching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (product: Product) => {
    onChange(product.sku);
    onProductSelect?.(product);
    setOpen(false);
  };

  const handleAddProduct = async () => {
    try {
      if (!newProduct.sku.trim() || !newProduct.description.trim()) {
        toast.error('Product/SKU and description are required');
        return;
      }

      const productData = {
        sku: newProduct.sku.trim(),
        description: newProduct.description.trim(),
        category: 'general', // Default category
        metadata: {}
      };

      await saveProduct(productData);
      toast.success('Product saved successfully');
      
      // Reset form and close dialog
      setNewProduct({
        sku: '',
        description: ''
      });
      setShowAddDialog(false);
      
      // Reload products and select the new one
      await loadProducts();
      onChange(productData.sku);
      onProductSelect?.(productData as Product);
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error('Failed to save product');
    }
  };

  const selectedProduct = products.find(p => p.sku === value);

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-base">
        <Package className="h-4 w-4" />
        Product/SKU
      </Label>
      
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="flex-1 justify-between h-14 text-base"
              disabled={disabled}
            >
              {value || placeholder}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[800px] p-0" align="start">
            <Command>
              <CommandInput 
                placeholder="Search products..." 
                value={searchTerm}
                onValueChange={setSearchTerm}
              />
              <CommandList>
                <CommandEmpty>
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-2">No products found</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewProduct(prev => ({ ...prev, sku: searchTerm }));
                        setShowAddDialog(true);
                        setOpen(false);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add "{searchTerm}"
                    </Button>
                  </div>
                </CommandEmpty>
                <CommandGroup>
                  {products.map((product) => (
                    <CommandItem
                      key={product.id}
                      value={product.sku}
                      onSelect={() => handleProductSelect(product)}
                      className="flex items-center justify-between p-4"
                    >
                      <div className="flex items-center min-w-0 flex-1">
                        <Check
                          className={cn(
                            "mr-3 h-4 w-4 flex-shrink-0",
                            value === product.sku ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-base">{product.sku}</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {product.description}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                        {product.usageCount > 1 && (
                          <Badge variant="secondary" className="text-xs">
                            <Hash className="h-3 w-3 mr-1" />
                            {product.usageCount}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          Recent
                        </Badge>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowAddDialog(true)}
          disabled={disabled}
          className="h-14 w-14"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {selectedProduct && (
        <div className="p-3 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{selectedProduct.sku}</div>
              <div className="text-sm text-muted-foreground">{selectedProduct.description}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                <Hash className="h-3 w-3 mr-1" />
                Used {selectedProduct.usageCount} times
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Dialog - Simplified */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Product/SKU</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newSku" className="text-base">Product/SKU *</Label>
              <Input
                id="newSku"
                value={newProduct.sku}
                onChange={(e) => setNewProduct(prev => ({ ...prev, sku: e.target.value }))}
                placeholder="Enter product/SKU code"
                required
                className="h-14 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newDescription" className="text-base">Description *</Label>
              <Input
                id="newDescription"
                value={newProduct.description}
                onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter product description"
                required
                className="h-14 text-base"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAddProduct} className="flex-1 h-14 text-base">
                Save Product
              </Button>
              <Button variant="outline" onClick={() => setShowAddDialog(false)} className="h-14 text-base">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}