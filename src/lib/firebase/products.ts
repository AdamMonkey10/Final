import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION = 'products';

export interface Product {
  id: string;
  sku: string;
  description: string;
  category: string;
  weight?: number;
  lastUsed: any;
  usageCount: number;
  metadata?: {
    coilNumber?: string;
    coilLength?: string;
  };
}

export async function getProducts(categoryFilter?: string): Promise<Product[]> {
  try {
    let q = query(
      collection(db, COLLECTION),
      orderBy('lastUsed', 'desc'),
      limit(50)
    );

    if (categoryFilter) {
      q = query(
        collection(db, COLLECTION),
        where('category', '==', categoryFilter),
        orderBy('lastUsed', 'desc'),
        limit(50)
      );
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Product[];
  } catch (error) {
    console.error('Error getting products:', error);
    return [];
  }
}

export async function getProductBySku(sku: string): Promise<Product | null> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('sku', '==', sku.trim())
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    } as Product;
  } catch (error) {
    console.error('Error getting product by SKU:', error);
    return null;
  }
}

export async function saveProduct(productData: Omit<Product, 'id' | 'lastUsed' | 'usageCount'>): Promise<string> {
  try {
    // Check if product already exists
    const existing = await getProductBySku(productData.sku);
    
    if (existing) {
      // Update existing product
      const docRef = doc(db, COLLECTION, existing.id);
      await setDoc(docRef, {
        ...productData,
        lastUsed: serverTimestamp(),
        usageCount: (existing.usageCount || 0) + 1,
      }, { merge: true });
      return existing.id;
    } else {
      // Create new product
      const docRef = doc(collection(db, COLLECTION));
      await setDoc(docRef, {
        ...productData,
        lastUsed: serverTimestamp(),
        usageCount: 1,
      });
      return docRef.id;
    }
  } catch (error) {
    console.error('Error saving product:', error);
    throw error;
  }
}

export async function searchProducts(searchTerm: string, categoryFilter?: string): Promise<Product[]> {
  try {
    // Get all products and filter client-side for better search
    const products = await getProducts(categoryFilter);
    
    if (!searchTerm.trim()) {
      return products;
    }

    const searchLower = searchTerm.toLowerCase();
    return products.filter(product => 
      product.sku.toLowerCase().includes(searchLower) ||
      product.description.toLowerCase().includes(searchLower)
    );
  } catch (error) {
    console.error('Error searching products:', error);
    return [];
  }
}