import { Injectable } from '@angular/core';

export interface OllamaModel {
    name: string;
    modified_at?: string;
    size?: number;
    digest?: string;
    details?: {
        format: string;
        family: string;
        families: string[];
        parameter_size: string;
        quantization_level: string;
    };
    isInstalled?: boolean;
}

@Injectable( {
    providedIn: 'root'
} )
export class OllamaService {
    private apiUrl = 'http://localhost:11434/api';
    private apiKey = '';

    // Curated list of popular models to offer
    private readonly recommendedModels = [
        'llama3', 'llama3:8b', 'phi3', 'mistral', 'gemma:2b', 'gemma:7b', 'neural-chat', 'starling-lm', 'codellama'
    ];

    async getRecommendedModels ( type: 'chat' | 'embedding' = 'chat' ): Promise<any[]> {
        try {
            const response = await fetch( `http://localhost:3000/ollama/library?type=${ type }` );
            if ( !response.ok ) {
                throw new Error( 'Failed to fetch library' );
            }
            const models = await response.json();
            return models;
        } catch ( error ) {
            console.warn( 'Failed to fetch dynamic models, falling back to static list', error );
            if ( type === 'embedding' ) {
                return [
                    { id: 'nomic-embed-text', name: 'Nomic Embed Text', type: 'embedding', provider: 'ollama', details: 'Recommended', cached: false, isInstalled: false },
                    { id: 'mxbai-embed-large', name: 'MixedBread AI Embed Large', type: 'embedding', provider: 'ollama', details: 'Recommended', cached: false, isInstalled: false },
                    { id: 'all-minilm', name: 'All MiniLM', type: 'embedding', provider: 'ollama', details: 'Recommended', cached: false, isInstalled: false }
                ];
            }
            return this.recommendedModels.map( name => ( {
                id: name,
                name: name,
                type: 'chat',
                provider: 'ollama',
                details: 'Recommended',
                cached: false,
                isInstalled: false
            } ) );
        }
    }

    constructor () { }

    setApiKey ( key: string ) {
        this.apiKey = key;
    }

    setApiUrl ( url: string ) {
        this.apiUrl = url.replace( /\/$/, '' ); // Remove trailing slash
    }

    private getHeaders (): HeadersInit {
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if ( this.apiKey ) {
            headers[ 'Authorization' ] = `Bearer ${ this.apiKey }`;
        }
        return headers;
    }

    async isAvailable (): Promise<boolean> {
        try {
            const response = await fetch( `${ this.apiUrl }/tags`, { headers: this.getHeaders() } );
            return response.ok;
        } catch ( e ) {
            return false;
        }
    }

    async getModels (): Promise<OllamaModel[]> {
        try {
            // 1. Get installed models
            const response = await fetch( `${ this.apiUrl }/tags`, { headers: this.getHeaders() } );
            if ( !response.ok ) throw new Error( 'Failed to fetch Ollama models' );
            const data = await response.json();
            const installedModels: OllamaModel[] = ( data.models || [] ).map( ( m: any ) => ( { ...m, isInstalled: true } ) );

            // 2. Merge with recommended models
            const allModels: OllamaModel[] = [ ...installedModels ];

            this.recommendedModels.forEach( name => {
                // Check if already installed (ignoring tags for simple match if needed, but exact match is safer)
                const isInstalled = installedModels.some( m => m.name.startsWith( name ) );
                if ( !isInstalled ) {
                    allModels.push( {
                        name: name,
                        isInstalled: false,
                        details: {
                            parameter_size: 'Unknown',
                            format: '',
                            family: '',
                            families: [],
                            quantization_level: ''
                        }
                    } );
                }
            } );

            return allModels;
        } catch ( e ) {
            console.error( 'Error fetching Ollama models:', e );
            return [];
        }
    }

    async deleteModel ( modelName: string ): Promise<boolean> {
        try {
            const response = await fetch( `${ this.apiUrl }/delete`, {
                method: 'DELETE',
                headers: this.getHeaders(),
                body: JSON.stringify( { name: modelName } )
            } );
            return response.ok;
        } catch ( e ) {
            console.warn( `Failed to delete model ${ modelName }:`, e );
            return false;
        }
    }

    async pullModel ( modelName: string, progressCallback?: ( status: string, completed: number, total: number ) => void ) {
        const MAX_RETRIES = 3;
        const STALL_TIMEOUT = 30000; // 30 seconds without progress

        for ( let attempt = 1; attempt <= MAX_RETRIES; attempt++ ) {
            try {
                console.log( `Pulling model ${ modelName } (Attempt ${ attempt }/${ MAX_RETRIES })...` );

                const controller = new AbortController();
                const timeoutId = setTimeout( () => controller.abort(), STALL_TIMEOUT ); // Initial timeout

                let lastProgressTime = Date.now();

                const response = await fetch( `${ this.apiUrl }/pull`, {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify( { name: modelName, stream: true } ),
                    signal: controller.signal
                } );

                clearTimeout( timeoutId ); // Clear initial connection timeout

                if ( !response.body ) throw new Error( 'No response body' );
                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                while ( true ) {
                    // Race between reading chunk and stall timeout
                    const readPromise = reader.read();
                    const stallPromise = new Promise<any>( ( _, reject ) =>
                        setTimeout( () => reject( new Error( 'Download stalled' ) ), STALL_TIMEOUT )
                    );

                    const { done, value } = await Promise.race( [ readPromise, stallPromise ] );

                    if ( done ) break;

                    // Reset stall timer on progress
                    lastProgressTime = Date.now();

                    const chunk = decoder.decode( value, { stream: true } );
                    const lines = chunk.split( '\n' ).filter( line => line.trim() !== '' );

                    for ( const line of lines ) {
                        try {
                            const json = JSON.parse( line );
                            if ( json.error ) throw new Error( json.error );

                            if ( progressCallback ) {
                                progressCallback( json.status, json.completed || 0, json.total || 0 );
                            }
                        } catch ( e ) {
                            // Ignore parse errors for partial chunks
                        }
                    }
                }

                // If we get here, success!
                return;

            } catch ( error: any ) {
                console.warn( `Attempt ${ attempt } failed:`, error );

                if ( attempt === MAX_RETRIES ) {
                    throw new Error( `Failed to pull model after ${ MAX_RETRIES } attempts: ${ error.message }` );
                }

                // Notify retry
                if ( progressCallback ) {
                    progressCallback( `Download failed/stalled. Retrying (Attempt ${ attempt + 1 })...`, 0, 0 );
                }

                // Cleanup partial download
                await this.deleteModel( modelName );

                // Exponential backoff: 2s, 4s, 8s...
                const delay = Math.pow( 2, attempt ) * 1000;
                await new Promise( resolve => setTimeout( resolve, delay ) );
            }
        }
    }

    async generate ( model: string, systemPrompt: string, userPrompt: string ): Promise<any> {
        const response = await fetch( `${ this.apiUrl }/chat`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify( {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                stream: false,
                format: 'json'
            } )
        } );

        if ( !response.ok ) {
            throw new Error( `Ollama generation failed: ${ response.statusText }` );
        }

        const data = await response.json();
        try {
            return JSON.parse( data.message.content );
        } catch ( e ) {
            // Try to extract JSON if the model was chatty
            const content = data.message.content;
            const jsonMatch = content.match( /\{[\s\S]*\}/ );
            if ( jsonMatch ) {
                return JSON.parse( jsonMatch[ 0 ] );
            }
            throw new Error( 'Could not parse JSON from Ollama output' );
        }
    }

    async getEmbeddings ( model: string, input: string ): Promise<number[]> {
        const response = await fetch( `${ this.apiUrl }/embed`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify( {
                model: model,
                input: input
            } )
        } );

        if ( !response.ok ) {
            throw new Error( `Ollama embedding failed: ${ response.statusText }` );
        }

        const data = await response.json();
        return data.embeddings[ 0 ];
    }

    async getModelDetails ( model: string ): Promise<any> {
        try {
            const response = await fetch( `${ this.apiUrl }/show`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify( { model } )
            } );
            if ( !response.ok ) return null;
            return await response.json();
        } catch ( e ) {
            console.warn( `Failed to get details for ${ model }`, e );
            return null;
        }
    }
}
