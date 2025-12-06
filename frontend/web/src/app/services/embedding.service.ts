import { Injectable } from '@angular/core';
import { pipeline, env } from '@xenova/transformers';
import { ModelRegistryService } from './model-registry.service';
import { OllamaService } from './ollama.service';

// Configure to use our local backend proxy
env.allowLocalModels = false;
env.remoteHost = 'http://localhost:3000/models/';

@Injectable( {
    providedIn: 'root'
} )
export class EmbeddingService {
    private extractor: any = null;
    private pipe: any = null;
    private currentModelId: string | null = null;
    private isLoading = false;

    constructor (
        private modelRegistry: ModelRegistryService,
        private ollamaService: OllamaService
    ) { }

    async initModel ( modelId: string ) {
        // If Ollama, we don't need to load a browser model
        const provider = this.modelRegistry[ 'selectedProviderSubject' ].value;
        if ( provider === 'ollama' ) {
            this.currentModelId = modelId;
            return;
        }

        if ( this.currentModelId === modelId && this.pipe ) return;

        this.isLoading = true;
        try {
            console.log( `Loading embedding model: ${ modelId }` );
            this.pipe = await pipeline( 'feature-extraction', modelId, {
                quantized: true,
                progress_callback: ( x: any ) => {
                    if ( x.status === 'progress' ) {
                        console.log( `Loading ${ modelId }: ${ Math.round( x.progress ) }%` );
                    }
                }
            } );
            this.currentModelId = modelId;
            console.log( 'Embedding model loaded' );
        } catch ( err ) {
            console.error( 'Failed to load embedding model:', err );
            throw err;
        } finally {
            this.isLoading = false;
        }
    }

    async getEmbedding ( text: string ): Promise<number[]> {
        const provider = this.modelRegistry[ 'selectedProviderSubject' ].value;

        // Delegate to Ollama
        if ( provider === 'ollama' ) {
            const modelId = this.modelRegistry.getCurrentEmbeddingModelId();
            if ( !this.currentModelId ) this.currentModelId = modelId; // Ensure sync
            return this.ollamaService.getEmbeddings( modelId, text );
        }

        // Browser Fallback
        if ( !this.pipe ) {
            // Auto-init if needed (using default or last selected)
            const modelId = this.modelRegistry.getCurrentEmbeddingModelId();
            await this.initModel( modelId );
        }
        const output = await this.pipe( text, { pooling: 'mean', normalize: true } );
        return Array.from( output.data );
    }
}
