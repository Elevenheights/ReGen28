import { Injectable } from '@angular/core';
import { 
  Firestore, 
  doc, 
  docData, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  getDocs,
  writeBatch,
  serverTimestamp,
  Timestamp,
  DocumentReference,
  QueryConstraint
} from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Observable, from, map, catchError, of } from 'rxjs';

export interface DatabaseConfig {
  collection: string;
  converter?: any;
  realtime?: boolean;
}

export interface QueryOptions {
  where?: { field: string; operator: any; value: any }[];
  orderBy?: { field: string; direction?: 'asc' | 'desc' }[];
  limit?: number;
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  
  constructor(
    private firestore: Firestore,
    private functions: Functions
  ) {}

  // ===============================
  // DOCUMENT OPERATIONS
  // ===============================

  /**
   * Get a single document with real-time updates
   */
  getDocument<T>(collectionName: string, id: string): Observable<T | null> {
    const docRef = doc(this.firestore, collectionName, id);
    return docData(docRef, { idField: 'id' }) as Observable<T>;
  }

  /**
   * Get a single document once (no real-time)
   */
  getDocumentOnce<T>(collectionName: string, id: string): Observable<T | null> {
    return from(
      getDocs(query(collection(this.firestore, collectionName), where('__name__', '==', id)))
    ).pipe(
      map(snapshot => {
        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as T;
      }),
      catchError(error => {
        console.error(`Error getting document ${collectionName}/${id}:`, error);
        return of(null);
      })
    );
  }

  /**
   * Create a new document
   */
  createDocument<T>(collectionName: string, data: Omit<T, 'id'>): Observable<string> {
    const docData = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    return from(addDoc(collection(this.firestore, collectionName), docData)).pipe(
      map(docRef => docRef.id),
      catchError(error => {
        console.error(`Error creating document in ${collectionName}:`, error);
        throw error;
      })
    );
  }

  /**
   * Update an existing document
   */
  updateDocument<T>(collectionName: string, id: string, data: Partial<T>): Observable<void> {
    const docRef = doc(this.firestore, collectionName, id);
    const updateData = {
      ...data,
      updatedAt: serverTimestamp()
    };

    return from(updateDoc(docRef, updateData)).pipe(
      catchError(error => {
        console.error(`Error updating document ${collectionName}/${id}:`, error);
        throw error;
      })
    );
  }

  /**
   * Delete a document
   */
  deleteDocument(collectionName: string, id: string): Observable<void> {
    const docRef = doc(this.firestore, collectionName, id);
    return from(deleteDoc(docRef)).pipe(
      catchError(error => {
        console.error(`Error deleting document ${collectionName}/${id}:`, error);
        throw error;
      })
    );
  }

  // ===============================
  // QUERY OPERATIONS
  // ===============================

  /**
   * Query documents with various options
   */
  queryDocuments<T>(collectionName: string, options: QueryOptions = {}): Observable<T[]> {
    const constraints: QueryConstraint[] = [];

    // Add where clauses
    if (options.where) {
      options.where.forEach(w => {
        constraints.push(where(w.field, w.operator, w.value));
      });
    }

    // Add orderBy clauses
    if (options.orderBy) {
      options.orderBy.forEach(o => {
        constraints.push(orderBy(o.field, o.direction || 'asc'));
      });
    }

    // Add limit
    if (options.limit) {
      constraints.push(limit(options.limit));
    }

    const q = query(collection(this.firestore, collectionName), ...constraints);

    return from(getDocs(q)).pipe(
      map(snapshot => 
        snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T))
      ),
      catchError(error => {
        console.error(`Error querying ${collectionName}:`, error);
        return of([]);
      })
    );
  }

  // ===============================
  // BATCH OPERATIONS
  // ===============================

  /**
   * Perform multiple operations in a batch
   */
  batchWrite(operations: Array<{
    type: 'create' | 'update' | 'delete';
    collection: string;
    id?: string;
    data?: any;
  }>): Observable<void> {
    const batch = writeBatch(this.firestore);

    operations.forEach(op => {
      switch (op.type) {
        case 'create':
          const createRef = doc(collection(this.firestore, op.collection));
          batch.set(createRef, {
            ...op.data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          break;
        
        case 'update':
          const updateRef = doc(this.firestore, op.collection, op.id!);
          batch.update(updateRef, {
            ...op.data,
            updatedAt: serverTimestamp()
          });
          break;
        
        case 'delete':
          const deleteRef = doc(this.firestore, op.collection, op.id!);
          batch.delete(deleteRef);
          break;
      }
    });

    return from(batch.commit()).pipe(
      catchError(error => {
        console.error('Error in batch write:', error);
        throw error;
      })
    );
  }

  // ===============================
  // FIREBASE FUNCTIONS
  // ===============================

  /**
   * Call a Firebase Function
   */
  callFunction<T, R>(functionName: string, data: T): Observable<R> {
    const callable = httpsCallable<T, R>(this.functions, functionName);
    return from(callable(data)).pipe(
      map(result => result.data),
      catchError(error => {
        console.error(`Error calling function ${functionName}:`, error);
        throw error;
      })
    );
  }

  // ===============================
  // SPECIALIZED METHODS
  // ===============================

  /**
   * Get user's documents from any collection
   */
  getUserDocuments<T>(collectionName: string, userId: string, options: QueryOptions = {}): Observable<T[]> {
    const queryOptions: QueryOptions = {
      ...options,
      where: [
        { field: 'userId', operator: '==', value: userId },
        ...(options.where ?? [])
      ]
    };

    return this.queryDocuments<T>(collectionName, queryOptions);
  }

  /**
   * Get documents within a date range
   */
  getDocumentsByDateRange<T>(
    collectionName: string, 
    startDate: Date, 
    endDate: Date,
    dateField: string = 'createdAt',
    additionalOptions: QueryOptions = {}
  ): Observable<T[]> {
    const queryOptions: QueryOptions = {
      ...additionalOptions,
      where: [
        { field: dateField, operator: '>=', value: Timestamp.fromDate(startDate) },
        { field: dateField, operator: '<=', value: Timestamp.fromDate(endDate) },
        ...(additionalOptions.where ?? [])
      ]
    };

    return this.queryDocuments<T>(collectionName, queryOptions);
  }

  // ===============================
  // ERROR HANDLING & UTILITIES
  // ===============================

  /**
   * Check if document exists
   */
  documentExists(collectionName: string, id: string): Observable<boolean> {
    return this.getDocumentOnce(collectionName, id).pipe(
      map(doc => doc !== null),
      catchError(() => of(false))
    );
  }

  /**
   * Get document count
   */
  getDocumentCount(collectionName: string, options: QueryOptions = {}): Observable<number> {
    return this.queryDocuments(collectionName, options).pipe(
      map(docs => docs.length)
    );
  }
} 