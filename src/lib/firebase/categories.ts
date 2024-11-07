import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  runTransaction,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getCached, setCache, invalidateCache } from './cache';
import { toast } from 'sonner';
import { createElement } from 'react';
import { StockNotification } from '@/components/stock-notification';

const COLLECTION = 'categories';

export interface KanbanRules {
  goodsIn: boolean;
  minQuantity: number;
  maxQuantity: number;
  reorderPoint: number;
  reorderQuantity: number;
  currentQuantity: number;
  fixedLocations: string[];
}

export interface Category {
  id: string;
  name: string;
  prefix: string;
  description: string;
  isDefault: boolean;
  kanbanRules?: KanbanRules;
}

function generateEmailDraft(category: Category, newQuantity: number): string {
  const template = `Subject: Stock Level Alert - ${category.name}

Dear Warehouse Manager,

This is to notify you about a stock level alert for the following item:

Category: ${category.name}
Current Stock Level: ${newQuantity} units
Minimum Level: ${category.kanbanRules?.minQuantity} units
Reorder Point: ${category.kanbanRules?.reorderPoint} units
Recommended Order Quantity: ${category.kanbanRules?.reorderQuantity} units

${newQuantity <= category.kanbanRules?.minQuantity ? 
  '⚠️ URGENT: Stock has fallen below minimum level. Immediate action required.' :
  '📢 Stock has reached reorder point. Please process reorder soon.'}

Fixed Storage Locations:
${category.kanbanRules?.fixedLocations.join(', ')}

Please take appropriate action to maintain optimal stock levels.

Best regards,
Warehouse Management System`;

  return template;
}

export async function updateCategoryQuantity(categoryId: string, quantityChange: number) {
  try {
    const docRef = doc(db, COLLECTION, categoryId);
    
    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(docRef);
      if (!docSnap.exists()) {
        throw new Error('Category not found');
      }

      const category = docSnap.data() as Category;
      if (!category.kanbanRules) {
        throw new Error('Category does not have Kanban rules');
      }

      const newQuantity = category.kanbanRules.currentQuantity + quantityChange;
      
      // Validate new quantity
      if (newQuantity < 0) {
        throw new Error('Not enough stock available');
      }
      if (newQuantity > category.kanbanRules.maxQuantity) {
        throw new Error('Quantity would exceed maximum stock level');
      }

      // Show notifications based on stock levels
      if (newQuantity <= category.kanbanRules.minQuantity) {
        const emailDraft = generateEmailDraft(category, newQuantity);
        
        const confirmed = await new Promise<boolean>((resolve) => {
          toast.warning(
            `Critical Stock Warning: ${category.name}`,
            {
              description: createElement(StockNotification, {
                newQuantity,
                minQuantity: category.kanbanRules.minQuantity,
                emailDraft
              }),
              duration: Infinity,
              action: {
                label: 'Continue',
                onClick: () => resolve(true)
              },
              cancel: {
                label: 'Cancel',
                onClick: () => resolve(false)
              },
            }
          );
        });

        if (!confirmed) {
          throw new Error('Operation cancelled by user');
        }

        toast.error(`Critical Stock Alert: ${category.name}`, {
          description: createElement(StockNotification, {
            newQuantity,
            minQuantity: category.kanbanRules.minQuantity,
            emailDraft
          }),
          duration: 10000,
          action: {
            label: 'View Details',
            onClick: () => window.location.href = '/setup'
          }
        });
      } else if (newQuantity <= category.kanbanRules.reorderPoint) {
        const emailDraft = generateEmailDraft(category, newQuantity);
        
        const confirmed = await new Promise<boolean>((resolve) => {
          toast.warning(
            `Reorder Point Warning: ${category.name}`,
            {
              description: createElement(StockNotification, {
                newQuantity,
                minQuantity: category.kanbanRules.reorderPoint,
                emailDraft
              }),
              duration: Infinity,
              action: {
                label: 'Continue',
                onClick: () => resolve(true)
              },
              cancel: {
                label: 'Cancel',
                onClick: () => resolve(false)
              },
            }
          );
        });

        if (!confirmed) {
          throw new Error('Operation cancelled by user');
        }

        toast.warning(`Reorder Alert: ${category.name}`, {
          description: createElement(StockNotification, {
            newQuantity,
            minQuantity: category.kanbanRules.reorderPoint,
            emailDraft
          }),
          duration: 8000,
          action: {
            label: 'View Details',
            onClick: () => window.location.href = '/setup'
          }
        });
      }

      transaction.update(docRef, {
        'kanbanRules.currentQuantity': newQuantity,
        updatedAt: serverTimestamp()
      });
    });

    invalidateCache(COLLECTION);
  } catch (error) {
    if (error.message === 'Operation cancelled by user') {
      toast.info('Operation cancelled');
    } else {
      console.error('Error updating category quantity:', error);
      throw error;
    }
  }
}

export function subscribeToCategory(categoryId: string, callback: (category: Category) => void) {
  const docRef = doc(db, COLLECTION, categoryId);
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      const category = {
        id: snapshot.id,
        ...snapshot.data()
      } as Category;
      callback(category);
    }
  });
}

export async function getCategories() {
  try {
    const cached = getCached<Category>(COLLECTION);
    if (cached) return cached;

    const querySnapshot = await getDocs(collection(db, COLLECTION));
    const categories = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Category[];

    setCache(COLLECTION, categories);
    return categories;
  } catch (error) {
    console.error('Error getting categories:', error);
    throw error;
  }
}

export async function addCategory(data: Omit<Category, 'id'>) {
  try {
    const docRef = doc(collection(db, COLLECTION));
    await setDoc(docRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    invalidateCache(COLLECTION);
    return docRef.id;
  } catch (error) {
    console.error('Error adding category:', error);
    throw error;
  }
}

export async function updateCategory(id: string, data: Partial<Category>) {
  try {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
    invalidateCache(COLLECTION);
  } catch (error) {
    console.error('Error updating category:', error);
    throw error;
  }
}

export async function deleteCategory(id: string) {
  try {
    const docRef = doc(db, COLLECTION, id);
    await setDoc(docRef, {
      active: false,
      updatedAt: serverTimestamp()
    }, { merge: true });
    invalidateCache(COLLECTION);
  } catch (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
}