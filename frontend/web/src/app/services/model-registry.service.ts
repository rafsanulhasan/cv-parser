import { Injectable } from '@angular/core';
import { BehaviorSubject, from, Observable } from 'rxjs';
import { hasModelInCache } from '@mlc-ai/web-llm';
import { OllamaService } from './ollama.service';
import { OpenAIService } from './openai.service';

export type ModelProvider = 'browser' | 'ollama' | 'openai';

export interface ModelConfig {
  id: string;
  name: string;
  type: 'embedding' | 'chat';
  provider: ModelProvider;
  size?: string;
  quantization?: string;
  isDefault?: boolean;
  details?: string; // Extra info like "GPU Optimized"
  cached?: boolean;
  isInstalled?: boolean; // For Ollama models
}

@Injectable( {
  providedIn: 'root'
} )
export class ModelRegistryService {

  // --- Static Browser Models ---
  private readonly browserEmbeddingModels: ModelConfig[] = [
    {
      id: 'Xenova/all-MiniLM-L6-v2',
      name: 'All MiniLM L6 v2 (Fastest)',
      type: 'embedding',
      provider: 'browser',
      size: '23MB',
      isDefault: true
    },
    {
      id: 'Xenova/gte-small',
      name: 'GTE Small (Better Quality)',
      type: 'embedding',
      provider: 'browser',
      size: '30MB'
    }
  ];

  private readonly browserChatModels: ModelConfig[] = [
    {
      id: 'Phi-3-mini-4k-instruct-q4f16_1-MLC',
      name: 'Phi-3 Mini (3.8B) - Browser',
      type: 'chat',
      provider: 'browser',
      quantization: 'q4f16_1',
      size: '2.3GB',
      isDefault: true
    },
    {
      id: 'Llama-3-8B-Instruct-q4f32_1-MLC',
      name: 'Llama 3 (8B) - Browser',
      type: 'chat',
      provider: 'browser',
      quantization: 'q4f32_1',
      size: '4.6GB'
    }
  ];

  // --- Static Ollama Embedding Models ---
  private readonly ollamaEmbeddingModels: ModelConfig[] = [
    {
      id: 'nomic-embed-text',
      name: 'Nomic Embed Text (Recommended)',
      type: 'embedding',
      provider: 'ollama',
      details: 'High quality, 768d'
    },
    {
      id: 'mxbai-embed-large',
      name: 'Mxbai Embed Large',
      type: 'embedding',
      provider: 'ollama',
      details: 'State of the art, 1024d'
    },
    {
      id: 'all-minilm',
      name: 'All MiniLM (Fast)',
      type: 'embedding',
      provider: 'ollama',
      details: 'Small & Fast, 384d'
    }
  ];

  // --- State ---
  private chatModelsSubject = new BehaviorSubject<ModelConfig[]>( this.browserChatModels );
  chatModels$ = this.chatModelsSubject.asObservable();

  private embeddingModelsSubject = new BehaviorSubject<ModelConfig[]>( this.browserEmbeddingModels );
  embeddingModels$ = this.embeddingModelsSubject.asObservable();

  private selectedProviderSubject = new BehaviorSubject<ModelProvider>( 'browser' );
  selectedProvider$ = this.selectedProviderSubject.asObservable();

  private selectedChatModelSubject = new BehaviorSubject<string>( this.browserChatModels[ 0 ].id );
  selectedChatModel$ = this.selectedChatModelSubject.asObservable();

  private openAIKeySubject = new BehaviorSubject<string>( '' );
  openAIKey$ = this.openAIKeySubject.asObservable();

  // Cache for OpenAI model metadata from backend
  public cachedOpenAIMetadata: any = null;

  constructor (
    private ollamaService: OllamaService,
    private openAIService: OpenAIService
  ) {
    // Load saved preferences
    const savedProvider = localStorage.getItem( 'cv-parser-provider' ) as ModelProvider;
    if ( savedProvider ) this.setProvider( savedProvider );

    const savedKey = localStorage.getItem( 'cv-parser-openai-key' );
    if ( savedKey ) this.openAIKeySubject.next( savedKey );

    // Initial fetch
    this.refreshModels();

    // Fetch OpenAI metadata from backend
    this.fetchOpenAIMetadata();
  }

  /**
   * Fetch OpenAI model metadata from backend API
   */
  async fetchOpenAIMetadata (): Promise<any> {
    try {
      const response = await fetch( 'http://localhost:3000/api/model-metadata' );
      if ( !response.ok ) {
        throw new Error( `HTTP error! status: ${ response.status }` );
      }
      const data = await response.json();
      this.cachedOpenAIMetadata = data;
      console.log( '[ModelRegistry] Metadata fetched from backend:', data );
      return data;
    } catch ( error ) {
      console.error( '[ModelRegistry] Failed to fetch metadata from backend:', error );
      return null;
    }
  }

  /**
   * Trigger immediate metadata refresh via backend API
   */
  async refreshOpenAIMetadata (): Promise<any> {
    try {
      const response = await fetch( 'http://localhost:3000/api/model-metadata/refresh', {
        method: 'POST'
      } );

      if ( response.status === 429 ) {
        const errorData = await response.json();
        throw new Error( errorData.message || 'Rate limit exceeded' );
      }

      if ( !response.ok ) {
        throw new Error( `HTTP error! status: ${ response.status }` );
      }

      const result = await response.json();
      this.cachedOpenAIMetadata = result.data;
      console.log( '[ModelRegistry] Metadata refreshed:', result );

      // Refresh models if we're on OpenAI provider
      if ( this.selectedProviderSubject.value === 'openai' ) {
        await this.refreshModels();
      }

      return result;
    } catch ( error ) {
      console.error( '[ModelRegistry] Failed to refresh metadata:', error );
      throw error;
    }
  }

  getEmbeddingModels (): Observable<ModelConfig[]> {
    return this.embeddingModels$;
  }

  private selectedEmbeddingModelSubject = new BehaviorSubject<string>( this.browserEmbeddingModels[ 0 ].id );
  selectedEmbeddingModel$ = this.selectedEmbeddingModelSubject.asObservable();

  getCurrentEmbeddingModelId (): string {
    return this.selectedEmbeddingModelSubject.value;
  }

  setEmbeddingModel ( modelId: string ) {
    this.selectedEmbeddingModelSubject.next( modelId );
  }

  setProvider ( provider: ModelProvider ) {
    this.selectedProviderSubject.next( provider );
    localStorage.setItem( 'cv-parser-provider', provider );
    this.refreshModels();
  }

  setOpenAIKey ( key: string ) {
    this.openAIKeySubject.next( key );
    localStorage.setItem( 'cv-parser-openai-key', key );
    if ( this.selectedProviderSubject.value === 'openai' ) {
      this.refreshModels();
    }
  }

  getOpenAIKey (): string {
    return this.openAIKeySubject.value;
  }

  setChatModel ( modelId: string ) {
    this.selectedChatModelSubject.next( modelId );
  }

  async refreshModels () {
    const provider = this.selectedProviderSubject.value;
    console.log( `Refreshing models for provider: ${ provider }` );

    let models: ModelConfig[] = [];
    // Refresh embedding models based on provider
    let embeddingModels: ModelConfig[] = [];

    switch ( provider ) {
      case 'browser':
        models = await Promise.all( this.browserChatModels.map( async m => ( {
          ...m,
          cached: await hasModelInCache( m.id )
        } ) ) );
        embeddingModels = await Promise.all( this.browserEmbeddingModels.map( async m => ( {
          ...m,
          cached: await this.checkEmbeddingCache( m.id )
        } ) ) );
        break;

      case 'ollama':
        const ollamaModels = await this.ollamaService.getModels();
        console.log( 'Raw Ollama Models:', ollamaModels );

        // Separate installed models into chat and embedding
        const installedChatModels: ModelConfig[] = [];
        const installedEmbeddingModels: ModelConfig[] = [];

        // Check details for each installed model to categorize
        await Promise.all( ollamaModels.filter( m => m.isInstalled ).map( async m => {
          const details = await this.ollamaService.getModelDetails( m.name );
          const isEmbedding = m.name.includes( 'embed' ) ||
            m.name.includes( 'bert' ) ||
            ( details?.details?.families && (
              details.details.families.includes( 'bert' ) ||
              details.details.families.includes( 'nomic-bert' ) ||
              details.details.families.includes( 'embedding' )
            ) );

          console.log( `Categorizing ${ m.name }: isEmbedding=${ isEmbedding }`, details );

          const config: ModelConfig = {
            id: m.name,
            name: `${ m.name } (${ m.details?.parameter_size || 'Unknown' })`,
            type: ( isEmbedding ? 'embedding' : 'chat' ) as 'embedding' | 'chat',
            provider: 'ollama' as ModelProvider,
            size: m.size ? `${ ( m.size / 1024 / 1024 / 1024 ).toFixed( 1 ) }GB` : 'Unknown',
            details: 'Local Server',
            cached: true,
            isInstalled: true
          };

          if ( isEmbedding ) {
            installedEmbeddingModels.push( config );
          } else {
            installedChatModels.push( config );
          }
        } ) );

        console.log( 'Installed Embeddings:', installedEmbeddingModels );
        console.log( 'Installed Chat:', installedChatModels );

        // Now process all models (installed and uninstalled recommendations)
        const allOllamaModelsProcessed = ollamaModels.map( m => {
          // If it's an installed model, we already processed it.
          // We want to allow it for BOTH chat and embedding if it's installed.
          const existingInstalled = installedChatModels.find( ic => ic.id === m.name ) || installedEmbeddingModels.find( ie => ie.id === m.name );

          if ( existingInstalled ) {
            // Return a copy that works for the current context (we will filter later)
            // Actually, we can just return it. The 'type' property in the config is just a label.
            // But we filter by type below.
            return existingInstalled;
          }

          // For uninstalled models (recommendations), we stick to strict categorization
          const isEmbedding = m.name.includes( 'embed' ) || m.name.includes( 'bert' );
          return {
            id: m.name,
            name: `${ m.name } (Click to Install)`,
            type: ( isEmbedding ? 'embedding' : 'chat' ) as 'embedding' | 'chat',
            provider: 'ollama' as ModelProvider,
            size: m.size ? `${ ( m.size / 1024 / 1024 / 1024 ).toFixed( 1 ) }GB` : 'Unknown',
            details: 'Not Installed',
            cached: false,
            isInstalled: false
          };
        } );

        // Fetch dynamic recommendations from backend via OllamaService
        const recommendedChatModels = await this.ollamaService.getRecommendedModels( 'chat' );
        const recommendedEmbeddingModels = await this.ollamaService.getRecommendedModels( 'embedding' );

        // Helper to normalize model names (remove :latest, etc)
        const normalize = ( name: string ) => name.split( ':' )[ 0 ];

        // Chat Models: All installed + Uninstalled Chat Recommendations
        // Start with installed, but EXCLUDE known embedding models
        const chatCandidates = allOllamaModelsProcessed.filter( m => {
          const isEmbedding = m.type === 'embedding' ||
            m.id.includes( 'embed' ) ||
            ( m.details && typeof m.details === 'object' && 'families' in m.details && Array.isArray( ( m.details as any ).families ) && ( m.details as any ).families.includes( 'embedding' ) );

          return ( m.isInstalled || m.type === 'chat' ) && !isEmbedding;
        } );

        // Add recommendations
        recommendedChatModels.forEach( rec => {
          const existing = chatCandidates.find( c => normalize( c.id ) === normalize( rec.id ) );
          if ( !existing ) {
            chatCandidates.push( {
              ...rec,
              isInstalled: false,
              cached: false,
              name: `${ rec.name } (Click to Install)`
            } );
          }
        } );
        models = chatCandidates;

        // Embedding Models: All installed + Uninstalled Embedding Recommendations
        const embeddingCandidates = allOllamaModelsProcessed.filter( m => m.isInstalled || m.type === 'embedding' );

        // Add recommendations
        recommendedEmbeddingModels.forEach( rec => {
          const existing = embeddingCandidates.find( c => normalize( c.id ) === normalize( rec.id ) );
          if ( !existing ) {
            embeddingCandidates.push( {
              ...rec,
              isInstalled: false,
              cached: false,
              name: `${ rec.name } (Click to Install)`
            } );
          }
        } );

        console.log( 'Final Embedding Candidates:', embeddingCandidates );
        embeddingModels = embeddingCandidates;

        // Auto-select first installed embedding model if current is invalid or empty
        const currentEmbeddingId = this.selectedEmbeddingModelSubject.value;
        const installedEmbedding = embeddingModels.find( m => m.isInstalled );
        if ( installedEmbedding && ( !currentEmbeddingId || !embeddingModels.find( m => m.id === currentEmbeddingId ) ) ) {
          console.log( 'Auto-selecting embedding model:', installedEmbedding.id );
          this.setEmbeddingModel( installedEmbedding.id );
        }
        break;

      case 'openai':
        const key = this.getOpenAIKey();
        if ( key ) {
          console.log( 'Fetching OpenAI models...' );
          const openAIModels = await this.openAIService.getModels( key );

          // Helper to get metadata from cached backend data
          const getMetadataFor = ( modelId: string ) => {
            //Try exact match first
            if ( this.cachedOpenAIMetadata?.models?.[ modelId ] ) {
              return this.cachedOpenAIMetadata.models[ modelId ];
            }

            // Try fuzzy match (e.g., "gpt-4o" matches "gpt-4o-2024-05-13")
            if ( this.cachedOpenAIMetadata?.models ) {
              for ( const [ key, value ] of Object.entries( this.cachedOpenAIMetadata.models ) ) {
                if ( modelId.includes( key ) || key.includes( modelId ) ) {
                  return value;
                }
              }
            }

            // Fallback defaults
            return {
              contextLength: 'Unknown',
              outputTokens: 'Unknown',
              knowledgeCutoff: 'Unknown',
              details: 'Cloud API'
            };
          };

          models = openAIModels.map( m => {
            const meta = getMetadataFor( m.id );
            return {
              id: m.id,
              name: m.id,
              type: 'chat',
              provider: 'openai',
              details: meta.details || 'Cloud API',
              contextLength: meta.contextLength,
              outputTokens: meta.outputTokens,
              knowledgeCutoff: meta.knowledgeCutoff
            };
          } );
        }
        // Fallback for embedding
        embeddingModels = this.browserEmbeddingModels;
        break;
    }

    console.log( `Models refreshed. Chat: ${ models.length }, Embedding: ${ embeddingModels.length }` );
    this.chatModelsSubject.next( models );

    // Auto-select first if current selection is invalid
    const currentId = this.selectedChatModelSubject.value;
    const validCurrent = models.find( m => m.id === currentId );

    if ( !validCurrent && models.length > 0 ) {
      // Prefer installed models for Ollama
      if ( provider === 'ollama' ) {
        const installed = models.find( m => m.isInstalled );
        if ( installed ) {
          console.log( 'Auto-selecting chat model:', installed.id );
          this.selectedChatModelSubject.next( installed.id );
        } else {
          this.selectedChatModelSubject.next( models[ 0 ].id );
        }
      } else {
        this.selectedChatModelSubject.next( models[ 0 ].id );
      }
    }

    // I will simulate it or try to check if possible. 
    // Since I can't easily check Transformers.js cache without loading, I will skip the check for embedding 
    // to avoid breaking it, OR I will assume the user meant the Chat models which use WebLLM.
    // BUT the user said "embedding models as well".
    // I will add a dummy check or just set it to false for now to avoid errors, 
    // as mixing WebLLM cache check with Transformers.js models might return false negatives.

    // UPDATE: I will just pass them through for now.
    this.embeddingModelsSubject.next( embeddingModels );
  }

  private async checkEmbeddingCache ( modelId: string ): Promise<boolean> {
    try {
      if ( typeof window === 'undefined' || !( 'caches' in window ) ) return false;

      const cacheNames = await caches.keys();
      let found = false;

      // Search all caches for the model files
      for ( const cacheName of cacheNames ) {
        const cache = await caches.open( cacheName );
        const keys = await cache.keys();
        // Check for model ID or just the model name part
        const modelName = modelId.split( '/' ).pop() || modelId;

        if ( keys.some( req => req.url.includes( modelName ) ) ) {
          found = true;
          break;
        }
      }

      return found;
    } catch ( e ) {
      console.warn( 'Error checking embedding cache:', e );
      return false;
    }
  }
}
