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
  sizeBytes?: number;
  quantization?: string;
  isDefault?: boolean;
  details?: string; // Extra info like "GPU Optimized"
  cached?: boolean;
  isInstalled?: boolean; // For Ollama models
  contextLength?: number | string;
  outputTokens?: number | string;
  capabilities?: string[]; // For Ollama models: ["tools", "completion", etc.]
}

@Injectable( {
  providedIn: 'root'
} )
export class ModelRegistryService {

  // --- Static Browser Models ---
  private readonly browserEmbeddingModels: ModelConfig[] = [
    {
      id: 'Xenova/all-MiniLM-L6-v2',
      name: 'MiniLM-L6-v2',
      type: 'embedding',
      provider: 'browser',
      size: '22MB',
      details: '384 dims',
      isDefault: true
    },
    {
      id: 'Xenova/gte-small',
      name: 'GTE Small',
      type: 'embedding',
      provider: 'browser',
      size: '30MB',
      details: 'Better Quality'
    }
  ];

  private readonly browserChatModels: ModelConfig[] = [
    {
      id: 'Phi-3-mini-4k-instruct-q4f16_1-MLC',
      name: 'Phi-3 Mini',
      type: 'chat',
      provider: 'browser',
      quantization: 'q4f16_1',
      size: '2.3GB',
      contextLength: 4096,
      details: '3.8B params',
      isDefault: true
    },
    {
      id: 'Llama-3-8B-Instruct-q4f32_1-MLC',
      name: 'Llama 3',
      type: 'chat',
      provider: 'browser',
      quantization: 'q4f32_1',
      size: '4.6GB',
      contextLength: 8192,
      details: '8B params'
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

  // Ollama Base URL tracking
  private ollamaBaseUrlSubject = new BehaviorSubject<string>( 'http://localhost:11434' );
  ollamaBaseUrl$ = this.ollamaBaseUrlSubject.asObservable();

  // Cache for OpenAI model metadata from backend
  public cachedOpenAIMetadata: any = null;

  // Configuration state
  get isOllamaConfigured (): boolean {
    const url = this.ollamaBaseUrlSubject.value;
    return !!url && url !== 'http://localhost:11434';
  }

  get isOpenAIConfigured (): boolean {
    return !!this.openAIKeySubject.value;
  }

  constructor (
    private ollamaService: OllamaService,
    private openAIService: OpenAIService
  ) {
    // Load saved preferences
    const savedProvider = localStorage.getItem( 'cv-parser-provider' ) as ModelProvider;
    if ( savedProvider ) this.setProvider( savedProvider );

    const savedKey = localStorage.getItem( 'cv-parser-openai-key' );
    if ( savedKey ) this.openAIKeySubject.next( savedKey );

    // Load Ollama URL from IndexedDB
    this.loadOllamaBaseUrl();

    // Initial fetch
    this.refreshModels();

    // Fetch OpenAI metadata from backend
    this.fetchOpenAIMetadata();
  }

  /**
   * Save Ollama Base URL to IndexedDB
   */
  async saveOllamaBaseUrl ( url: string ): Promise<void> {
    this.ollamaBaseUrlSubject.next( url );
    try {
      const db = await this.openSettingsDB();
      const tx = db.transaction( 'settings', 'readwrite' );
      await tx.objectStore( 'settings' ).put( { key: 'ollamaBaseUrl', value: url } );
      await tx.done;
    } catch ( e ) {
      console.error( 'Failed to save Ollama URL to IndexedDB:', e );
    }
  }

  /**
   * Load Ollama Base URL from IndexedDB
   */
  private async loadOllamaBaseUrl (): Promise<void> {
    try {
      const db = await this.openSettingsDB();
      const result = await db.get( 'settings', 'ollamaBaseUrl' );
      if ( result?.value ) {
        this.ollamaBaseUrlSubject.next( result.value );
        this.ollamaService.setApiUrl( result.value );
      }
    } catch ( e ) {
      console.warn( 'Failed to load Ollama URL from IndexedDB:', e );
    }
  }

  private async openSettingsDB () {
    const { openDB } = await import( 'idb' );
    return openDB( 'cv-parser-settings', 1, {
      upgrade ( db ) {
        if ( !db.objectStoreNames.contains( 'settings' ) ) {
          db.createObjectStore( 'settings', { keyPath: 'key' } );
        }
      }
    } );
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

  /**
   * Add an OpenAI model to selection (for manual model entry)
   */
  addOpenAIModel ( modelId: string ) {
    this.setChatModel( modelId );
    console.log( `[ModelRegistry] Added OpenAI model: ${ modelId }` );
  }

  /**
   * Get available models for a provider (for add model modal)
   */
  async getAvailableModels ( provider: 'ollama' | 'openai' | 'browser' ): Promise<ModelConfig[]> {
    switch ( provider ) {
      case 'browser':
        return this.browserChatModels;
      case 'ollama':
        try {
          const models = await this.ollamaService.getModels();
          return models.map( m => ( {
            id: m.name,
            name: m.name.replace( ':latest', '' ),
            type: 'chat' as const,
            provider: 'ollama' as const,
            size: m.size ? this.formatBytes( m.size ) : undefined,
            isInstalled: true
          } ) );
        } catch ( e ) {
          return [];
        }
      case 'openai':
        const key = this.getOpenAIKey();
        if ( key ) {
          try {
            const list = await this.openAIService.getModels( key );
            return list.map( m => ( {
              id: m.id,
              name: m.id,
              type: 'chat' as const,
              provider: 'openai' as const
            } ) );
          } catch ( e ) {
            return [];
          }
        }
        return [];
      default:
        return [];
    }
  }

  private formatBytes ( bytes: number ): string {
    const units = [ 'B', 'KB', 'MB', 'GB', 'TB', 'PB' ];
    let unitIndex = 0;
    let size = bytes;
    while ( size >= 1024 && unitIndex < units.length - 1 ) {
      size /= 1024;
      unitIndex++;
    }
    return `${ size.toFixed( 1 ) } ${ units[ unitIndex ] }`;
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

  /**
   * Returns chat models in a 3-level hierarchy for the dropdown:
   * Category (Offline/Online) -> Provider (Ollama/Browser/OpenAI) -> Models
   */
  async getUnifiedChatModels (): Promise<{ label: string; isConfigured?: boolean; subgroups: { label: string; options: ModelConfig[]; noKeyConfigured?: boolean; message?: string; isConfigured?: boolean }[] }[]> {
    const currentModels = this.chatModelsSubject.value;
    const provider = this.selectedProviderSubject.value;

    // Fetch models for all providers
    let ollamaModels: ModelConfig[] = [];
    let browserModels: ModelConfig[] = [];
    let openaiModels: ModelConfig[] = [];

    // Get Ollama models (installed only, filtered by capabilities)
    try {
      const ollamaList = await this.ollamaService.getModels();

      // Filter models to only those with "tools" AND "completion" capabilities
      const filteredModels: ModelConfig[] = [];
      for ( const m of ollamaList.filter( m => m.isInstalled ) ) {
        const modelDetails = await this.ollamaService.getModelDetails( m.name );
        const capabilities = modelDetails?.capabilities || [];
        const hasTools = capabilities.includes( 'tools' );
        const hasCompletion = capabilities.includes( 'completion' );

        if ( hasTools && hasCompletion ) {
          filteredModels.push( {
            id: m.name,
            name: m.name.replace( ':latest', '' ),
            type: 'chat' as const,
            provider: 'ollama' as const,
            size: m.size ? this.formatBytes( m.size ) : undefined,
            sizeBytes: m.size,
            isInstalled: true,
            capabilities: capabilities,
            quantization: m.details?.quantization_level || modelDetails?.details?.quantization_level,
            contextLength: modelDetails?.model_info?.[ 'general.context_length' ] || modelDetails?.parameters?.num_ctx,
            details: m.details?.parameter_size || modelDetails?.details?.parameter_size
          } );
        }
      }
      ollamaModels = filteredModels;
    } catch ( e ) {
      console.warn( 'Could not fetch Ollama models for unified list' );
    }

    // Get Browser models with cache status
    browserModels = await Promise.all(
      this.browserChatModels.map( async m => ( {
        ...m,
        cached: await hasModelInCache( m.id )
      } ) )
    );

    // Get OpenAI models from current registry (uses cached metadata)
    const key = this.getOpenAIKey();

    // Static metadata for common OpenAI models
    const staticMetadata: Record<string, { contextLength: string; outputTokens: string; details: string }> = {
      'gpt-4o': { contextLength: '128k', outputTokens: '16k', details: 'High Intelligence' },
      'gpt-4o-mini': { contextLength: '128k', outputTokens: '16k', details: 'Fast & Smart' },
      'gpt-4-turbo': { contextLength: '128k', outputTokens: '4k', details: 'High Intelligence' },
      'gpt-4': { contextLength: '8k', outputTokens: '8k', details: 'High Intelligence' },
      'gpt-3.5-turbo': { contextLength: '16k', outputTokens: '4k', details: 'Fast & Cost-effective' },
      'o1': { contextLength: '200k', outputTokens: '100k', details: 'Reasoning Model' },
      'o1-mini': { contextLength: '128k', outputTokens: '65k', details: 'Fast Reasoning' }
    };

    // Helper to get metadata (cached or static fallback)
    const getMetadataFor = ( modelId: string ) => {
      // Try cached metadata first
      if ( this.cachedOpenAIMetadata?.models?.[ modelId ] ) {
        return this.cachedOpenAIMetadata.models[ modelId ];
      }
      // Try fuzzy match on cached
      if ( this.cachedOpenAIMetadata?.models ) {
        for ( const [ k, value ] of Object.entries( this.cachedOpenAIMetadata.models ) ) {
          if ( modelId.includes( k ) || k.includes( modelId ) ) {
            return value as any;
          }
        }
      }
      // Static fallback
      for ( const [ k, value ] of Object.entries( staticMetadata ) ) {
        if ( modelId.includes( k ) || k.includes( modelId ) ) {
          return value;
        }
      }
      return { contextLength: 'Unknown', outputTokens: 'Unknown', details: 'Cloud API' };
    };

    if ( key ) {
      try {
        // Ensure metadata is fetched before using it
        if ( !this.cachedOpenAIMetadata ) {
          await this.fetchOpenAIMetadata();
        }

        const openAIList = await this.openAIService.getModels( key );

        openaiModels = openAIList.map( m => {
          const meta = getMetadataFor( m.id );
          return {
            id: m.id,
            name: m.id,
            type: 'chat' as const,
            provider: 'openai' as const,
            contextLength: meta.contextLength,
            outputTokens: meta.outputTokens,
            details: meta.details || 'Cloud API'
          };
        } );
      } catch ( e ) {
        console.warn( 'Could not fetch OpenAI models for unified list:', e );
      }
    }

    // Build 3-level hierarchy with metadata and configuration state
    const hasOpenAIKey = !!key;
    const isOllamaConfigured = this.isOllamaConfigured;
    const isOpenAIConfigured = this.isOpenAIConfigured;

    return [
      {
        label: 'Offline',
        isConfigured: isOllamaConfigured, // At least one offline service configured
        subgroups: [
          { label: 'Ollama', options: ollamaModels, isConfigured: isOllamaConfigured },
          { label: 'Browser Based', options: browserModels } // Browser always works, no config needed
        ]
      },
      {
        label: 'Online',
        isConfigured: isOpenAIConfigured,
        subgroups: [
          {
            label: 'OpenAI',
            options: openaiModels,
            noKeyConfigured: !hasOpenAIKey,
            message: !hasOpenAIKey ? 'No OpenAI API key configured.' : undefined,
            isConfigured: isOpenAIConfigured
          }
        ]
      }
    ];
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
