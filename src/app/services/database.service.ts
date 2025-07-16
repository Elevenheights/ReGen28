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
  getDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  DocumentReference,
  QueryConstraint,
  increment
} from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Observable, from, map, catchError, of } from 'rxjs';
import { Auth } from '@angular/fire/auth';

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

export interface TrackerSpecificSuggestionsResponse {
  userId: string;
  trackerId: string;
  date: string;
  dateKey: string;
  todayAction: {
    text: string;
    icon: string;
    reason: string;
  };
  suggestions: Array<{
    text: string;
    type: string;
    icon: string;
    dataPoint: string;
  }>;
  motivationalQuote: {
    text: string;
    author: string;
    context: string;
  };
  generatedAt: any;
  source: string;
  model: string;
  trackerInfo: {
    name: string;
    target: number;
    unit: string;
    frequency: string;
    category: string;
  };
  analytics: any;
}

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  
  constructor(
    private firestore: Firestore,
    private functions: Functions,
    private auth: Auth
  ) {}

  // ===============================
  // DOCUMENT OPERATIONS
  // ===============================

  /**
   * Get a single document with real-time updates
   */
  getDocument<T>(collectionName: string, id: string): Observable<T | null> {
    const docRef = doc(this.firestore, collectionName, id);
    
    return docData(docRef, { idField: 'id' }).pipe(
      map(data => data as T | null),
      catchError(error => {
        console.error(`🔥 DatabaseService: Error in real-time listener for ${collectionName}/${id}:`, error);
        return of(null);
      })
    );
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

  /**
   * Get tracker-specific AI suggestions
   */
  getTrackerSpecificSuggestions(trackerId: string, forceRefresh: boolean = false): Observable<TrackerSpecificSuggestionsResponse> {
    // Debug: Check if user is authenticated
    const user = this.auth.currentUser;
    console.log('🔐 Firebase Auth State:', {
      isAuthenticated: !!user,
      userEmail: user?.email,
      uid: user?.uid,
      emailVerified: user?.emailVerified
    });
    
    if (!user) {
      console.error('❌ User not authenticated when calling getTrackerSpecificSuggestions');
      throw new Error('User must be authenticated to get tracker suggestions');
    }
    
    return this.callFunction<{ trackerId: string; forceRefresh?: boolean }, TrackerSpecificSuggestionsResponse>(
      'getTrackerSpecificSuggestions',
      { trackerId, forceRefresh }
    );
  }

  /**
   * Check if suggestions document exists and get its timestamp
   * Returns only the timestamp to minimize data transfer
   */
  checkSuggestionTimestamp(trackerId: string): Observable<{ generatedAt: any } | null> {
    return new Observable(observer => {
      const user = this.auth.currentUser;
      if (!user) {
        observer.next(null);
        observer.complete();
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const docId = `${user.uid}_${trackerId}_${today}`;
      const docRef = doc(this.firestore, 'tracker-specific-suggestions', docId);
      
      from(getDoc(docRef)).subscribe({
        next: (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            observer.next({ generatedAt: data['generatedAt'] });
          } else {
            observer.next(null);
          }
          observer.complete();
        },
        error: (error) => {
          console.error('Error checking suggestion timestamp:', error);
          observer.next(null);
          observer.complete();
        }
      });
    });
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

  /**
   * Create Firestore increment for atomic counter updates
   */
  increment(value: number = 1) {
    return increment(value);
  }
} 