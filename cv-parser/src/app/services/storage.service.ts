import { Injectable } from '@angular/core';
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface VectorDB extends DBSchema {
    documents: {
        key: string;
        value: {
            requestId: string;
            doc_location: string;
            doc_vector: number[];
            user_data: any;
            user_data_vector: number[];
            fileType: string;
            timestamp: number;
        };
        indexes: { 'by-timestamp': number };
    };
}

@Injectable( {
    providedIn: 'root'
} )
export class StorageService {
    private dbPromise: Promise<IDBPDatabase<VectorDB>>;

    constructor () {
        this.dbPromise = openDB<VectorDB>( 'ai-vector-db', 4, {
            upgrade ( db, oldVersion, newVersion, transaction ) {
                // For this demo, we'll just clear the old store to ensure schema match
                if ( db.objectStoreNames.contains( 'documents' ) ) {
                    db.deleteObjectStore( 'documents' );
                }
                const store = db.createObjectStore( 'documents', { keyPath: 'requestId' } );
                store.createIndex( 'by-timestamp', 'timestamp' );
            },
        } );
    }

    /**
     * 4. Store Vector in IndexedDB
     */
    async storeDocument (
        requestId: string,
        doc_location: string,
        doc_vector: number[],
        user_data: any,
        user_data_vector: number[],
        fileType: string
    ) {
        const db = await this.dbPromise;
        await db.put( 'documents', {
            requestId,
            doc_location,
            doc_vector,
            user_data,
            user_data_vector,
            fileType,
            timestamp: Date.now(),
        } );
    }

    async getAllDocuments () {
        const db = await this.dbPromise;
        return db.getAll( 'documents' );
    }

    async deleteDocument ( requestId: string ) {
        const db = await this.dbPromise;
        await db.delete( 'documents', requestId );
    }

    async importDocuments ( documents: any[] ) {
        const db = await this.dbPromise;
        const tx = db.transaction( 'documents', 'readwrite' );
        const store = tx.objectStore( 'documents' );

        for ( const doc of documents ) {
            await store.put( doc );
        }
        await tx.done;
    }
}
