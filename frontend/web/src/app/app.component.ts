import { Component, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileParsingService } from './services/file-parsing.service';
import { StorageService } from './services/storage.service';
import { ModelRegistryService, ModelConfig, ModelProvider } from './services/model-registry.service';
import { EmbeddingService } from './services/embedding.service';
import { LocalExtractionService } from './services/local-extraction.service';
import { OllamaService } from './services/ollama.service';
import { OpenAIService } from './services/openai.service';
import { Subscription } from 'rxjs';

// UI Components
import { FileUploaderComponent, ProgressStep } from './components/ui/file-uploader/file-uploader.component';
import { DocumentListComponent } from './components/feature/document-list/document-list.component';
import { ModelConfigComponent } from './components/feature/model-config/container/model-config.component';
import { BrowserConfigComponent } from './components/feature/model-config/tabs/browser-config.component';
import { OllamaConfigComponent } from './components/feature/model-config/tabs/ollama-config.component';
import { OpenAiConfigComponent } from './components/feature/model-config/tabs/openai-config.component';
import { AddModelModalComponent } from './components/ui/add-model-modal/add-model-modal.component';
import { SmartDropdownComponent } from './components/ui/smart-dropdown/smart-dropdown.component';
import { OpenAIKeyModalComponent } from './components/ui/openai-key-modal/openai-key-modal.component';
import { ProviderConfigModalComponent } from './components/ui/provider-config-modal/provider-config-modal.component';

@Component( {
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FileUploaderComponent,
    DocumentListComponent,
    ModelConfigComponent,
    BrowserConfigComponent,
    OllamaConfigComponent,
    OpenAiConfigComponent,
    AddModelModalComponent,
    SmartDropdownComponent,
    OpenAIKeyModalComponent,
    ProviderConfigModalComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: [ './app.component.css' ]
} )
export class AppComponent implements OnInit, OnDestroy {
  // Application State
  documents: any[] = [];
  statusMessages: string[] = [];
  isProcessing = false;
  progressPercent = 0;
  modelLoadingProgress = '';
  showSettings = false;
  selectedFileType: string | null = null;

  // Add Model Modal State
  isAddModelModalOpen = false;
  isOpenAIKeyModalOpen = false;

  // Provider Config Modal State
  isProviderConfigModalOpen = false;
  providerConfigActiveTab: 'online' | 'offline' = 'offline';
  providerConfigFocusField: 'ollama-url' | 'openai-key' | null = null;

  // Pipeline Steps
  steps: ProgressStep[] = [
    { name: 'Parsing File', status: 'pending' },
    { name: 'Loading Models', status: 'pending' },
    { name: 'Extracting Data', status: 'pending' },
    { name: 'Vectorizing', status: 'pending' },
    { name: 'Storing', status: 'pending' }
  ];

  // Model Config State
  selectedProvider: ModelProvider = 'browser';
  selectedEmbeddingModel = '';
  selectedChatModel = '';

  // Provider Specific Data
  ollamaApiUrl = 'http://localhost:11434';
  openaiApiKey = '';

  // Model Lists (Unified, handled by Registry)
  chatModels: ModelConfig[] = []; // Keep for backward compatibility/internal use if needed
  unifiedChatModels: { label: string; subgroups: { label: string; options: ModelConfig[]; noKeyConfigured?: boolean; message?: string }[] }[] = []; // For Dropdown
  embeddingModels: ModelConfig[] = [];

  private subscriptions: Subscription[] = [];

  // Async Operations State
  embeddingPullProgress: { percent: number, status: string, completed: number, total: number } = { percent: 0, status: '', completed: 0, total: 0 };
  abortController: AbortController | null = null;
  confirmingEmbeddingDelete = false;
  embeddingDeleteTimeout: any;
  isRefreshingOpenAIMetadata = false;

  constructor (
    private fileParsingService: FileParsingService,
    private storageService: StorageService,
    public modelRegistry: ModelRegistryService,
    private embeddingService: EmbeddingService,
    private localExtractionService: LocalExtractionService,
    public ollamaService: OllamaService,
    private openAIService: OpenAIService,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit () {
    this.documents = await this.storageService.getAllDocuments();

    // Subscribe to Model Registry changes
    this.subscriptions.push(
      this.modelRegistry.chatModels$.subscribe( async models => {
        this.chatModels = models;
        // Also refresh unified list
        this.unifiedChatModels = await this.modelRegistry.getUnifiedChatModels();
        this.cdr.detectChanges();
      } ),
      this.modelRegistry.embeddingModels$.subscribe( models => {
        this.embeddingModels = models;
        this.cdr.detectChanges();
      } ),
      this.modelRegistry.selectedProvider$.subscribe( provider => {
        this.selectedProvider = provider;
        this.ollamaApiUrl = 'http://localhost:11434';
      } ),
      this.modelRegistry.selectedEmbeddingModel$.subscribe( model => this.selectedEmbeddingModel = model ),
      this.modelRegistry.selectedChatModel$.subscribe( model => this.selectedChatModel = model ),
      this.modelRegistry.openAIKey$.subscribe( key => this.openaiApiKey = key )
    );
  }

  ngOnDestroy () {
    this.subscriptions.forEach( sub => sub.unsubscribe() );
  }

  // --- Model Management Logic ---

  async refreshModels () {
    await this.modelRegistry.refreshModels();
    this.unifiedChatModels = await this.modelRegistry.getUnifiedChatModels();
    this.cdr.detectChanges();
  }

  onProviderChange ( providerId: string ) {
    this.modelRegistry.setProvider( providerId as ModelProvider );
  }

  onChatModelChange ( modelId: string ) {
    // Find provider from unified list (nested structure)
    let provider: ModelProvider | undefined;
    for ( const category of this.unifiedChatModels ) {
      for ( const subgroup of category.subgroups ) {
        const model = subgroup.options.find( m => m.id === modelId );
        if ( model ) {
          provider = model.provider;
          break;
        }
      }
      if ( provider ) break;
    }

    if ( provider && provider !== this.selectedProvider ) {
      this.modelRegistry.setProvider( provider );
    }
    this.modelRegistry.setChatModel( modelId );
  }

  onEmbeddingModelChange ( modelId: string ) {
    this.modelRegistry.setEmbeddingModel( modelId );
  }

  get isChatModelInstalled (): boolean {
    const model = this.chatModels.find( m => m.id === this.selectedChatModel );
    return model?.isInstalled ?? false;
  }

  get isSelectedChatModelOllama (): boolean {
    const model = this.chatModels.find( m => m.id === this.selectedChatModel );
    return model?.provider === 'ollama'; // or model.provider
  }

  // --- Modal Logic ---
  openAddModelModal () {
    this.isAddModelModalOpen = true;
  }

  closeAddModelModal () {
    this.isAddModelModalOpen = false;
  }

  onModelAddedFromModal ( modelId: string ) {
    if ( this.selectedProvider === 'ollama' ) {
      this.onDownloadModel( { id: modelId, type: 'chat' } );
    } else {
      // For OpenAI, it's already added. Just refresh list.
      this.modelRegistry.refreshModels();
    }
    this.closeAddModelModal();
  }

  // --- Provider Config Modal ---
  onConfigureProvider ( event: { group: string, subgroup?: string } ) {
    const { group, subgroup } = event;

    // Determine which tab to open and which field to focus
    if ( group === 'Offline' ) {
      this.providerConfigActiveTab = 'offline';
      if ( subgroup === 'Ollama' ) {
        this.providerConfigFocusField = 'ollama-url';
      } else {
        this.providerConfigFocusField = null;
      }
    } else if ( group === 'Online' ) {
      this.providerConfigActiveTab = 'online';
      if ( subgroup === 'OpenAI' ) {
        this.providerConfigFocusField = 'openai-key';
      } else {
        this.providerConfigFocusField = null;
      }
    }

    this.isProviderConfigModalOpen = true;
  }

  closeProviderConfigModal () {
    this.isProviderConfigModalOpen = false;
    this.providerConfigFocusField = null;
  }

  onProviderConfigSaved () {
    this.refreshModels();
  }

  onOllamaApiUrlChange ( url: string ) {
    this.ollamaApiUrl = url;
    this.ollamaService.setApiUrl( url );
    this.modelRegistry.refreshModels();
  }

  onOpenAiApiKeyChange ( key: string ) {
    this.openaiApiKey = key;
  }

  saveOpenAIKey () {
    this.modelRegistry.setOpenAIKey( this.openaiApiKey );
    alert( 'API Key saved!' );
  }

  removeOpenAIKey () {
    this.modelRegistry.setOpenAIKey( '' );
    this.openaiApiKey = '';
    alert( 'API Key removed!' );
  }

  async refreshOpenAIMetadata () {
    this.isRefreshingOpenAIMetadata = true;
    try {
      await this.modelRegistry.refreshOpenAIMetadata();
      alert( 'OpenAI model metadata refreshed from backend!' );
    } catch ( error ) {
      alert( 'Failed to refresh metadata. Check backend connection.' );
    } finally {
      this.isRefreshingOpenAIMetadata = false;
    }
  }

  viewOpenAIMetadata ( modelId: string ) {
    // Hacky access to private map for display, or we could expose a getter
    // Re-using the getMetadataFor logic locally or relying on what's in 'details'
    const model = this.chatModels.find( m => m.id === modelId ) || this.embeddingModels.find( m => m.id === modelId );
    if ( model ) {
      alert( `Details: ${ model.details }\nSize: ${ model.size }\nContext: ${ ( model as any ).contextLength || 'N/A' }` );
    }
  }

  // --- File Processing Logic ---

  async onFileSelected ( event: any ) {
    const file = event.target.files[ 0 ];
    if ( !file ) return;

    this.resetProgress();
    this.isProcessing = true;
    this.statusMessages = [];
    this.selectedFileType = this.getFileExtension( file.name );

    // Default steps reset
    this.steps.forEach( s => s.status = 'pending' );

    try {
      // 1. Parsing
      this.updateStep( 0, 'loading' );
      const text = await this.fileParsingService.parseFile( file );
      this.updateStep( 0, 'completed' );

      // 2. Loading -> Handled implicitly by Extraction Service for Browser, check for others
      this.updateStep( 1, 'loading' );
      await this.initializeModels();
      this.updateStep( 1, 'completed' );

      // 3. Extraction
      this.updateStep( 2, 'loading' );
      const extractedJson = await this.extractData( text );
      this.updateStep( 2, 'completed' );

      // 4. Vectorization
      this.updateStep( 3, 'loading' );
      const docVector = await this.embeddingService.getEmbedding( text );
      const jsonVector = await this.embeddingService.getEmbedding( JSON.stringify( extractedJson ) );
      this.updateStep( 3, 'completed' );

      // 5. Storing
      this.updateStep( 4, 'loading' );
      const docId = crypto.randomUUID();
      await this.storageService.storeDocument(
        docId,
        file.name,
        docVector,
        extractedJson,
        jsonVector,
        this.selectedFileType || 'unknown'
      );
      this.documents = await this.storageService.getAllDocuments();
      this.updateStep( 4, 'completed' );

      this.statusMessages.push( 'Document processed successfully!' );

    } catch ( error: any ) {
      console.error( 'Processing failed:', error );
      this.statusMessages.push( `Error: ${ error.message }` );
      const currentStep = this.steps.find( s => s.status === 'loading' );
      if ( currentStep ) currentStep.status = 'error';
    } finally {
      this.isProcessing = false;
    }
  }

  async initializeModels () {
    if ( this.selectedProvider === 'browser' ) {
      // We still use LocalExtractionService to initialize WebLLM
      await this.localExtractionService.initialize( this.selectedChatModel, ( progress ) => {
        this.modelLoadingProgress = progress;
      } );
    }
    // Validation for other providers
    if ( this.selectedProvider === 'ollama' && !this.selectedChatModel ) throw new Error( "No Ollama chat model selected" );
    if ( this.selectedProvider === 'openai' && !this.selectedChatModel ) throw new Error( "No OpenAI chat model selected" );
  }

  async extractData ( text: string ): Promise<any> {
    // LocalExtractionService.extractData handles all provider delegation!
    return this.localExtractionService.extractData( text );
  }

  updateStep ( index: number, status: 'loading' | 'completed' | 'error' ) {
    this.steps[ index ].status = status;
    this.calculateProgress();
  }

  calculateProgress () {
    const completed = this.steps.filter( s => s.status === 'completed' ).length;
    this.progressPercent = Math.round( ( completed / this.steps.length ) * 100 );
  }

  resetProgress () {
    this.progressPercent = 0;
    this.modelLoadingProgress = '';
    this.steps.forEach( s => s.status = 'pending' );
    this.statusMessages = [];
  }

  // --- Document Management ---

  async deleteDocument ( id: string ) {
    if ( confirm( 'Are you sure you want to delete this document?' ) ) {
      await this.storageService.deleteDocument( id );
      this.documents = await this.storageService.getAllDocuments();
    }
  }

  importData ( event: any ) {
    const file = event.target.files[ 0 ];
    if ( !file ) return;
    const reader = new FileReader();
    reader.onload = async ( e: any ) => {
      try {
        const data = JSON.parse( e.target.result );
        await this.storageService.importDocuments( data );
        this.documents = await this.storageService.getAllDocuments();
        alert( 'Import successful!' );
      } catch ( err ) {
        alert( 'Import failed: Invalid JSON' );
      }
    };
    reader.readAsText( file );
  }

  async exportData () {
    const dataStr = JSON.stringify( this.documents, null, 2 );
    const blob = new Blob( [ dataStr ], { type: 'application/json' } );
    const url = window.URL.createObjectURL( blob );
    const a = document.createElement( 'a' );
    a.href = url;
    a.download = 'cv-parser-data.json';
    a.click();
    window.URL.revokeObjectURL( url );
  }

  // --- Ollama Management ---

  async onDownloadModel ( event: { id: string, type: 'chat' | 'embedding' } ) {
    const { id, type } = event;
    this.abortController = new AbortController();
    this.embeddingPullProgress = { percent: 0, status: 'Starting...', completed: 0, total: 0 };

    try {
      // Re-implement the multi-layer progress tracking logic here
      const digestProgress = new Map<string, number>();

      await this.ollamaService.pullModel( id, ( status, completed, total, digest ) => {
        if ( digest ) {
          digestProgress.set( digest, completed );
        }
        // Approximation for UI
        // Total size calculation logic from "Gotchas"
        const totalDownloaded = Array.from( digestProgress.values() ).reduce( ( a, b ) => a + b, 0 );
        const totalSize = total * ( digestProgress.size || 1 ); // Approximation

        let percent = 0;
        if ( totalSize > 0 ) {
          percent = Math.min( 100, Math.round( ( totalDownloaded / totalSize ) * 100 ) );
        } else if ( total > 0 ) {
          percent = Math.min( 100, Math.round( ( completed / total ) * 100 ) );
        }

        if ( status === 'success' || status === 'verifying' || status === 'writing manifest' ) percent = 100;

        this.embeddingPullProgress = {
          percent: percent,
          status: status,
          completed: totalDownloaded,
          total: totalSize
        };
        this.cdr.detectChanges();
      }, this.abortController.signal );

      this.modelRegistry.refreshModels();
      alert( 'Model downloaded successfully!' );
    } catch ( err: any ) {
      if ( err.name === 'AbortError' ) {
        this.embeddingPullProgress.status = 'Cancelled';
      } else {
        alert( 'Download failed: ' + err.message );
      }
    } finally {
      this.abortController = null;
      this.cdr.detectChanges();
      setTimeout( () => {
        this.embeddingPullProgress = { percent: 0, status: '', completed: 0, total: 0 };
        this.cdr.detectChanges();
      }, 2000 );
    }
  }

  async onDeleteModel ( event: { id: string, type: 'chat' | 'embedding' } ) {
    if ( !this.confirmingEmbeddingDelete ) {
      this.confirmingEmbeddingDelete = true;
      if ( this.embeddingDeleteTimeout ) clearTimeout( this.embeddingDeleteTimeout );
      this.embeddingDeleteTimeout = setTimeout( () => {
        this.confirmingEmbeddingDelete = false;
        this.cdr.detectChanges();
      }, 3000 );
      return;
    }

    try {
      await this.ollamaService.deleteModel( event.id );
      this.modelRegistry.refreshModels();
      this.confirmingEmbeddingDelete = false;
    } catch ( err: any ) {
      alert( 'Deletion failed: ' + err.message );
    }
  }

  async onInlineDeleteModel ( modelId: string ) {
    try {
      await this.ollamaService.deleteModel( modelId );
      // Refresh to remove from dropdown
      await this.refreshModels();
    } catch ( err: any ) {
      alert( 'Failed to delete model: ' + err.message );
    }
  }

  onCancelPull () {
    if ( this.abortController ) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  toggleSettings () {
    this.showSettings = !this.showSettings;
  }

  getFileExtension ( filename: string ): string {
    return filename.split( '.' ).pop()?.toLowerCase() || '';
  }
}
