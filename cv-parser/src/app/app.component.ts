import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmbeddingService } from './services/embedding.service';
import { StorageService } from './services/storage.service';
import { FileParsingService } from './services/file-parsing.service';
import { ModelRegistryService, ModelConfig, ModelProvider } from './services/model-registry.service';
import { LocalExtractionService } from './services/local-extraction.service';
import { OllamaService } from './services/ollama.service';

interface ProgressStep {
  name: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
}

@Component( {
  selector: 'app-root',
  standalone: true,
  imports: [ CommonModule, FormsModule ],
  template: `
    <div style="padding: 20px; font-family: sans-serif; max-width: 800px; margin: 0 auto;">
      <h1>Browser AI Vector Store</h1>

      
      <!-- Model Configuration Panel -->
      <div style="margin-bottom: 20px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        <div (click)="toggleSettings()" style="padding: 10px 15px; background: #f8f9fa; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-weight: bold;">
          <span>⚙️ Model Configuration</span>
          <span>{{ showSettings ? '▼' : '▶' }}</span>
        </div>
        
        <div *ngIf="showSettings" style="padding: 15px; background: #fff; border-top: 1px solid #ddd;">
          
          <!-- Provider Selection Tabs -->
          <div style="display: flex; border-bottom: 1px solid #ddd; margin-bottom: 15px;">
            <button (click)="onProviderChange('browser')" [style.background]="selectedProvider === 'browser' ? '#e9ecef' : 'white'" style="flex: 1; padding: 10px; border: none; cursor: pointer; font-weight: bold;">Browser (Beta)</button>
            <button (click)="onProviderChange('ollama')" [style.background]="selectedProvider === 'ollama' ? '#e9ecef' : 'white'" style="flex: 1; padding: 10px; border: none; cursor: pointer; font-weight: bold;">Ollama (Local)</button>
            <button (click)="onProviderChange('openai')" [style.background]="selectedProvider === 'openai' ? '#e9ecef' : 'white'" style="flex: 1; padding: 10px; border: none; cursor: pointer; font-weight: bold;">OpenAI (Cloud)</button>
          </div>

          <!-- OpenAI Key Input -->
          <div *ngIf="showKeyInput" style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
            <label style="display: block; font-weight: bold; margin-bottom: 5px;">OpenAI API Key</label>
            <div style="display: flex;">
              <input type="password" [(ngModel)]="openAIKey" placeholder="sk-..." style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; margin-right: 10px;">
              <button (click)="saveOpenAIKey()" style="padding: 8px 15px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">Save</button>
            </div>
          </div>

          <div *ngIf="selectedProvider === 'ollama'" style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
            <label style="display: block; font-weight: bold; margin-bottom: 5px;">Ollama URL</label>
            <input type="text" [(ngModel)]="ollamaUrl" placeholder="http://localhost:11434/api" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; margin-bottom: 10px;">
            
            <label style="display: block; font-weight: bold; margin-bottom: 5px;">Ollama API Key (Optional)</label>
            <div style="display: flex;">
              <input type="password" [(ngModel)]="ollamaKey" placeholder="If using a secured instance..." style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; margin-right: 10px;">
              <button (click)="saveOllamaConfig()" style="padding: 8px 15px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">Save</button>
              <button (click)="refreshLibrary()" style="margin-left: 10px; padding: 8px 15px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;" title="Refresh Model Library">↻</button>
            </div>
          </div>

          <div>
            <div style="margin-bottom: 15px;">
              <label style="display: block; font-weight: bold; margin-bottom: 5px;">Chat Model</label>
              <div style="display: flex; gap: 10px;">
                  <select [ngModel]="selectedChatModelId" (ngModelChange)="onChatModelChange($event)" [disabled]="isPullingChat" style="flex: 1; padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
                    <ng-container *ngIf="selectedProvider === 'ollama'; else simpleChat">
                        <optgroup label="Installed Models (Ready)">
                            <option *ngFor="let model of getInstalledModels(availableChatModels)" [value]="model.id">
                                {{ model.name }} ({{ model.size }})
                            </option>
                        </optgroup>
                        <optgroup label="Available to Download">
                            <option *ngFor="let model of getCloudModels(availableChatModels)" [value]="model.id">
                                {{ model.name }}
                            </option>
                        </optgroup>
                    </ng-container>
                    <ng-template #simpleChat>
                        <option *ngFor="let model of availableChatModels" [value]="model.id">
                            {{ model.name }} <span *ngIf="model.size">({{ model.size }})</span> <span *ngIf="model.cached">✅ Cached</span>
                        </option>
                    </ng-template>
                  </select>
                  <button *ngIf="selectedProvider === 'ollama' && !isPullingChat && !isModelInstalled(selectedChatModelId, availableChatModels)" 
                          (click)="downloadChatModel()" 
                          [disabled]="!selectedChatModelId"
                          [style.opacity]="(!selectedChatModelId) ? 0.5 : 1"
                          style="width: 100px; padding: 8px 0; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap; text-align: center; display: flex; justify-content: center; align-items: center;">
                      Download
                  </button>
                  <button *ngIf="selectedProvider === 'ollama' && isPullingChat" 
                          (click)="cancelChatPull()" 
                          style="width: 100px; padding: 8px 0; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap; text-align: center; display: flex; justify-content: center; align-items: center;">
                      Cancel
                  </button>
                  <button *ngIf="selectedProvider === 'ollama' && !isPullingChat && isModelInstalled(selectedChatModelId, availableChatModels)" 
                          (click)="deleteChatModel()" 
                          [disabled]="!selectedChatModelId"
                          [style.opacity]="(!selectedChatModelId) ? 0.5 : 1"
                          style="width: 100px; padding: 8px 0; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap; text-align: center; display: flex; justify-content: center; align-items: center;">
                      {{ confirmingChatDelete ? 'Confirm?' : 'Delete' }}
                  </button>
              </div>

              <!-- Chat Progress -->
              <div *ngIf="isPullingChat" style="margin-top: 10px; padding: 10px; background: transparent; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong>{{ chatPullProgress.status.startsWith('Deleting') ? 'Deleting...' : 'Downloading...' }}</strong>
                    <span>{{ chatPullProgress.percent }}%</span>
                </div>
                <div style="height: 20px; background: #fff; border-radius: 5px; overflow: hidden; border: 1px solid #dee2e6;">
                    <div [style.width.%]="chatPullProgress.percent" style="height: 100%; background: #007bff; transition: width 0.3s ease;"></div>
                </div>
                <p style="margin: 5px 0 0; font-size: 0.8em; color: #666;">{{ chatPullProgress.status }}</p>
              </div>

              <p *ngIf="selectedProvider === 'browser'" style="margin: 5px 0 0; font-size: 0.8em; color: #dc3545;">
                Note: Browser models require WebGPU and will download ~2-4GB of data.
              </p>
            </div>

            <div style="margin-bottom: 15px;">
              <label style="display: block; font-weight: bold; margin-bottom: 5px;">Embedding Model</label>
              <div style="display: flex; gap: 10px;">
                  <select [ngModel]="selectedEmbeddingModelId" (ngModelChange)="onEmbeddingModelChange($event)" [disabled]="isPullingEmbedding" style="flex: 1; padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
                    <ng-container *ngIf="selectedProvider === 'ollama'; else simpleEmbedding">
                        <optgroup label="Installed Models (Ready)">
                            <option *ngFor="let model of getInstalledModels(embeddingModels)" [value]="model.id">
                                {{ model.name }} ({{ model.size }})
                            </option>
                        </optgroup>
                        <optgroup label="Available to Download">
                            <option *ngFor="let model of getCloudModels(embeddingModels)" [value]="model.id">
                                {{ model.name }}
                            </option>
                        </optgroup>
                    </ng-container>
                    <ng-template #simpleEmbedding>
                        <option *ngFor="let model of embeddingModels" [value]="model.id">
                            {{ model.name }} ({{ model.size }}) <span *ngIf="model.cached">✅ Cached</span>
                        </option>
                    </ng-template>
                  </select>
                  <button *ngIf="selectedProvider === 'ollama' && !isPullingEmbedding && !isModelInstalled(selectedEmbeddingModelId, embeddingModels)" 
                          (click)="downloadEmbeddingModel()" 
                          [disabled]="!selectedEmbeddingModelId"
                          [style.opacity]="(!selectedEmbeddingModelId) ? 0.5 : 1"
                          style="width: 100px; padding: 8px 0; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap; text-align: center; display: flex; justify-content: center; align-items: center;">
                      Download
                  </button>
                  <button *ngIf="selectedProvider === 'ollama' && isPullingEmbedding" 
                          (click)="cancelEmbeddingPull()" 
                          style="width: 100px; padding: 8px 0; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap; text-align: center; display: flex; justify-content: center; align-items: center;">
                      Cancel
                  </button>
                  <button *ngIf="selectedProvider === 'ollama' && !isPullingEmbedding && isModelInstalled(selectedEmbeddingModelId, embeddingModels)" 
                          (click)="deleteEmbeddingModel()" 
                          [disabled]="!selectedEmbeddingModelId"
                          [style.opacity]="(!selectedEmbeddingModelId) ? 0.5 : 1"
                          style="width: 100px; padding: 8px 0; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap; text-align: center; display: flex; justify-content: center; align-items: center;">
                      {{ confirmingEmbeddingDelete ? 'Confirm?' : 'Delete' }}
                  </button>
              </div>
              
              <!-- Embedding Progress -->
              <div *ngIf="isPullingEmbedding" style="margin-top: 10px; padding: 10px; background: transparent; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong>{{ embeddingPullProgress.status.startsWith('Deleting') ? 'Deleting...' : 'Downloading...' }}</strong>
                    <span>{{ embeddingPullProgress.percent }}%</span>
                </div>
                <div style="height: 20px; background: #fff; border-radius: 5px; overflow: hidden; border: 1px solid #dee2e6;">
                    <div [style.width.%]="embeddingPullProgress.percent" style="height: 100%; background: #007bff; transition: width 0.3s ease;"></div>
                </div>
                <p style="margin: 5px 0 0; font-size: 0.8em; color: #666; text-align: center;">{{ embeddingPullProgress.status }}</p>
              </div>
            </div>

            <p *ngIf="selectedProvider === 'ollama'" style="margin: 5px 0 0; font-size: 0.8em; color: #17a2b8;">
                Note: Ensure Ollama is running ('ollama serve'). Models are fetched from your local installation.
            </p>
          </div>

        </div>
      </div>

      <div style="margin-bottom: 20px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background: #f5f5f5;">
        <h3>Upload & Process Document</h3>
        <div style="display: flex; align-items: center;">
            <input type="file" (change)="onFileSelected($event)" accept=".txt,.md,.json,.pdf,.docx,.doc" [disabled]="isProcessing || isPullingEmbedding || isPullingChat">
            
            <!-- Upload Widget Icon -->
            <svg *ngIf="selectedFileType" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" [title]="selectedFileType" style="margin-left: 5px;">
                <path d="M6 4C6 2.89543 6.89543 2 8 2H20L26 8V28C26 29.1046 25.1046 30 24 30H8C6.89543 30 6 29.1046 6 28V4Z" fill="white" stroke="#666" stroke-width="2"/>
                <path d="M20 2V8H26" stroke="#666" stroke-width="2" stroke-linejoin="round"/>
                <rect x="4" y="18" width="24" height="10" rx="2" [attr.fill]="getFileColor(selectedFileType)"/>
                <text x="16" y="25" fill="white" font-family="sans-serif" font-size="8" font-weight="bold" text-anchor="middle">{{ selectedFileType | uppercase }}</text>
            </svg>
        </div>
        <p style="font-size: 0.9em; color: #666;">Supported formats: .txt, .md, .json, .pdf, .docx</p>
        
        <!-- Progress Bar -->
        <div *ngIf="isProcessing || progressPercent > 0" style="margin-top: 20px; border: 1px solid #ccc; border-radius: 4px; overflow: hidden; background: #fff;">
            <div style="height: 20px; background: #e9ecef; position: relative;">
                <div [style.width.%]="progressPercent" style="height: 100%; background: #28a745; transition: width 0.3s ease;"></div>
                <span style="position: absolute; top: 0; left: 50%; transform: translateX(-50%); font-size: 12px; line-height: 20px; color: #333;">{{ progressPercent }}%</span>
            </div>
            
            <div style="padding: 10px; display: flex; justify-content: space-between; align-items: center; background: #f8f9fa; border-bottom: 1px solid #eee;">
                <span style="font-weight: bold; font-size: 0.9em;">Processing Steps</span>
                <button *ngIf="progressPercent === 100" (click)="resetProgress()" style="padding: 2px 8px; font-size: 0.8em; cursor: pointer; border: 1px solid #ccc; background: #fff; border-radius: 4px;">Hide Status</button>
            </div>
            
            <div *ngIf="modelLoadingProgress" style="padding: 10px; background: #e2e3e5; font-size: 0.8em; border-bottom: 1px solid #ddd;">
                <strong>Model Loading:</strong> {{ modelLoadingProgress }}
            </div>

            <details [open]="isProcessing" style="padding: 10px;">
                <summary style="display: none;">Details</summary>
                <ul style="list-style: none; padding: 0; margin: 0;">
                    <li *ngFor="let step of steps" style="padding: 5px 0; display: flex; align-items: center;">
                        <span style="margin-right: 10px; width: 20px; text-align: center;">
                            <span *ngIf="step.status === 'completed'" style="color: green;">✓</span>
                            <span *ngIf="step.status === 'loading'">⏳</span>
                            <span *ngIf="step.status === 'error'" style="color: red;">✗</span>
                            <span *ngIf="step.status === 'pending'" style="color: #ccc;">○</span>
                        </span>
                        <span [style.color]="step.status === 'pending' ? '#999' : '#333'" [style.fontWeight]="step.status === 'loading' ? 'bold' : 'normal'">
                            {{ step.name }}
                        </span>
                    </li>
                </ul>
            </details>
        </div>
      </div>
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3>Stored Documents ({{ documents.length }})</h3>
        <div>
            <input type="file" #importInput (change)="importData($event)" accept=".json" style="display: none;">
            <button (click)="importInput.click()" style="padding: 5px 10px; margin-right: 5px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Import Data</button>
            <button (click)="exportData()" [disabled]="documents.length === 0" [style.opacity]="documents.length === 0 ? 0.5 : 1" [style.cursor]="documents.length === 0 ? 'not-allowed' : 'pointer'" style="padding: 5px 10px; background: #17a2b8; color: white; border: none; border-radius: 4px;">Export Data</button>
        </div>
      </div>

      <div *ngFor="let doc of documents" style="margin: 10px 0; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
        <details style="background: #fff;">
            <summary style="padding: 15px; cursor: pointer; background: #f8f9fa; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                <span style="display: flex; align-items: center;">
                    <!-- Dynamic File Icon (Left) -->
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" [title]="doc.fileType" style="margin-right: 15px;">
                        <path d="M6 4C6 2.89543 6.89543 2 8 2H20L26 8V28C26 29.1046 25.1046 30 24 30H8C6.89543 30 6 29.1046 6 28V4Z" fill="white" stroke="#666" stroke-width="2"/>
                        <path d="M20 2V8H26" stroke="#666" stroke-width="2" stroke-linejoin="round"/>
                        <rect x="4" y="18" width="24" height="10" rx="2" [attr.fill]="getFileColor(doc.fileType)"/>
                        <text x="16" y="25" fill="white" font-family="sans-serif" font-size="8" font-weight="bold" text-anchor="middle">{{ doc.fileType | uppercase }}</text>
                    </svg>

                    <span>
                        {{ doc.user_data?.fullName || 'Unknown Candidate' }} 
                        <span style="font-weight: normal; color: #666; font-size: 0.9em;">(ID: {{ doc.requestId | slice:0:8 }}...)</span>
                    </span>
                </span>
                <button (click)="deleteDocument(doc.requestId); $event.stopPropagation()" style="padding: 2px 8px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8em;">Delete</button>
            </summary>
            
            <div style="padding: 20px; border-top: 1px solid #ddd;">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-weight: bold; margin-bottom: 5px;">Document Location:</label>
                    <input type="text" [value]="doc.doc_location" readonly style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; background: #eee;">
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-weight: bold; margin-bottom: 5px;">Full Name:</label>
                    <input type="text" [value]="doc.user_data?.fullName" readonly style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-weight: bold; margin-bottom: 5px;">Email:</label>
                    <input type="text" [value]="doc.user_data?.email" readonly style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-weight: bold; margin-bottom: 5px;">Skills:</label>
                    <div style="padding: 8px; border: 1px solid #ccc; border-radius: 4px; background: #f9f9f9;">
                        {{ doc.user_data?.skills?.join(', ') }}
                    </div>
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-weight: bold; margin-bottom: 5px;">Experience:</label>
                    <div *ngFor="let exp of doc.user_data?.experience" style="margin-bottom: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
                        <strong>{{ exp.title }}</strong> at {{ exp.company }}<br>
                        <span style="font-size: 0.9em; color: #666;">{{ exp.dates }}</span>
                    </div>
                </div>

                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #ccc;">
                    <p style="margin: 0; color: #666; font-size: 0.8em;"><strong>Doc Vector (First 5):</strong> [{{ doc.doc_vector?.slice(0, 5)?.join(', ') }}...]</p>
                    <p style="margin: 5px 0 0 0; color: #666; font-size: 0.8em;"><strong>Data Vector (First 5):</strong> [{{ doc.user_data_vector?.slice(0, 5)?.join(', ') }}...]</p>
                </div>
            </div>
        </details>
      </div>
    </div>
  `
} )
export class AppComponent implements OnInit {
  documents: any[] = [];
  selectedFileType: string | null = null;

  // Model Selection
  showSettings = false;
  selectedProvider: ModelProvider = 'browser';
  availableChatModels: ModelConfig[] = [];
  selectedChatModelId = '';
  selectedEmbeddingModelId = '';
  embeddingModels: ModelConfig[] = [];

  // Helper for grouping
  getInstalledModels ( models: ModelConfig[] ) {
    return models.filter( m => m.isInstalled !== false );
  }

  getCloudModels ( models: ModelConfig[] ) {
    return models.filter( m => m.isInstalled === false );
  }

  isModelInstalled ( modelId: string, models: ModelConfig[] ): boolean {
    const model = models.find( m => m.id === modelId );
    return model ? model.isInstalled !== false : false; // Default to false (show download) if not found
  }

  // OpenAI
  openAIKey = '';
  showKeyInput = false;

  // Ollama Pull
  isPullingEmbedding = false;
  embeddingPullProgress = { status: '', completed: 0, total: 0, percent: 0 };
  embeddingPullAbortController: AbortController | null = null;

  isPullingChat = false;
  chatPullProgress = { status: '', completed: 0, total: 0, percent: 0 };
  chatPullAbortController: AbortController | null = null;

  isProcessing = false;
  progressPercent = 0;
  modelLoadingProgress = '';

  steps: ProgressStep[] = [
    { name: 'Upload Document', status: 'pending' },
    { name: 'Parse Text', status: 'pending' },
    { name: 'Load AI Models', status: 'pending' },
    { name: 'Extract Info (AI)', status: 'pending' },
    { name: 'Vectorize Document', status: 'pending' },
    { name: 'Vectorize Extracted Data', status: 'pending' },
    { name: 'Store in Database', status: 'pending' }
  ];

  ollamaKey = '';
  ollamaUrl = 'http://localhost:11434/api';

  constructor (
    private embeddingService: EmbeddingService,
    private storageService: StorageService,
    private fileParsingService: FileParsingService,
    private modelRegistry: ModelRegistryService,
    private localExtractionService: LocalExtractionService,
    private ollamaService: OllamaService
  ) {
    this.modelRegistry.chatModels$.subscribe( models => {
      this.availableChatModels = models;
    } );

    this.modelRegistry.selectedChatModel$.subscribe( id => {
      this.selectedChatModelId = id;
      this.checkOllamaModelStatus( id, 'chat' );
    } );

    this.modelRegistry.selectedProvider$.subscribe( provider => {
      this.selectedProvider = provider;
      this.showKeyInput = provider === 'openai';
    } );

    this.modelRegistry.openAIKey$.subscribe( key => {
      this.openAIKey = key;
    } );

    // Load Ollama Key
    const savedOllamaKey = localStorage.getItem( 'cv-parser-ollama-key' );
    if ( savedOllamaKey ) {
      this.ollamaKey = savedOllamaKey;
      this.ollamaService.setApiKey( savedOllamaKey );
    }

    // Load Ollama URL
    const savedOllamaUrl = localStorage.getItem( 'cv-parser-ollama-url' );
    if ( savedOllamaUrl ) {
      this.ollamaUrl = savedOllamaUrl;
      this.ollamaService.setApiUrl( savedOllamaUrl );
    }
  }

  ngOnInit () {
    this.refreshList();
    this.modelRegistry.embeddingModels$.subscribe( models => {
      this.embeddingModels = models;
    } );
    this.modelRegistry.selectedEmbeddingModel$.subscribe( id => {
      this.selectedEmbeddingModelId = id;
    } );
  }

  toggleSettings () {
    this.showSettings = !this.showSettings;
  }

  onProviderChange ( provider: string ) {
    this.modelRegistry.setProvider( provider as ModelProvider );
  }

  onEmbeddingModelChange ( modelId: string ) {
    // Just check status to update internal state if needed, but don't prompt
    this.checkOllamaModelStatus( modelId, 'embedding' );
  }

  onChatModelChange ( modelId: string ) {
    // Just check status to update internal state if needed, but don't prompt
    this.checkOllamaModelStatus( modelId, 'chat' );
  }

  checkOllamaModelStatus ( modelId: string, type: 'chat' | 'embedding' ) {
    // Always update local selection so the UI reflects the user's choice
    if ( type === 'chat' ) {
      this.selectedChatModelId = modelId;
    } else {
      this.selectedEmbeddingModelId = modelId;
    }

    if ( this.selectedProvider === 'ollama' ) {
      const model = this.availableChatModels.find( m => m.id === modelId ) ||
        this.embeddingModels.find( m => m.id === modelId );

      if ( model && model.isInstalled !== false ) {
        // Safe to set as active in registry
        if ( type === 'chat' ) {
          this.modelRegistry.setChatModel( modelId );
        } else {
          this.modelRegistry.setEmbeddingModel( modelId );
        }
      } else {
        // Not installed. Do NOT set in registry yet.
        // The UI will handle the "Download" button enablement.
      }
    } else {
      // Non-ollama
      if ( type === 'chat' ) {
        this.modelRegistry.setChatModel( modelId );
      } else {
        this.modelRegistry.setEmbeddingModel( modelId );
      }
    }
  }

  async downloadEmbeddingModel () {
    if ( !this.selectedEmbeddingModelId ) return;
    this.embeddingPullAbortController = new AbortController();
    await this.pullOllamaModel( this.selectedEmbeddingModelId, 'embedding', this.embeddingPullAbortController.signal );
  }

  cancelEmbeddingPull () {
    if ( this.embeddingPullAbortController ) {
      this.embeddingPullAbortController.abort();
      this.embeddingPullAbortController = null;
    }
  }

  async downloadChatModel () {
    if ( !this.selectedChatModelId ) return;
    this.chatPullAbortController = new AbortController();
    await this.pullOllamaModel( this.selectedChatModelId, 'chat', this.chatPullAbortController.signal );
  }

  cancelChatPull () {
    if ( this.chatPullAbortController ) {
      this.chatPullAbortController.abort();
      this.chatPullAbortController = null;
    }
  }

  confirmingEmbeddingDelete = false;
  private embeddingDeleteTimeout: any;

  async deleteEmbeddingModel () {
    if ( !this.selectedEmbeddingModelId ) return;

    if ( !this.confirmingEmbeddingDelete ) {
      this.confirmingEmbeddingDelete = true;
      // Reset after 3 seconds
      if ( this.embeddingDeleteTimeout ) clearTimeout( this.embeddingDeleteTimeout );
      this.embeddingDeleteTimeout = setTimeout( () => {
        this.confirmingEmbeddingDelete = false;
      }, 3000 );
      return;
    }

    // Confirmed
    this.confirmingEmbeddingDelete = false;
    if ( this.embeddingDeleteTimeout ) clearTimeout( this.embeddingDeleteTimeout );

    this.isPullingEmbedding = true;
    this.embeddingPullProgress = { status: 'Deleting...', completed: 0, total: 0, percent: 100 };

    try {
      console.log( 'Starting delete process for embedding model:', this.selectedEmbeddingModelId );
      // Add a small delay so the user sees the "Deleting..." state
      await new Promise( resolve => setTimeout( resolve, 1000 ) );

      console.log( 'Calling ollamaService.deleteModel...' );
      const success = await this.ollamaService.deleteModel( this.selectedEmbeddingModelId );
      console.log( 'Delete result:', success );

      console.log( 'Refreshing models...' );
      await this.modelRegistry.refreshModels();
      console.log( 'Models refreshed.' );

      // Reset selection if needed, or just let the UI update status
    } catch ( e ) {
      console.error( 'Delete failed:', e );
      alert( 'Failed to delete model: ' + e );
    } finally {

      this.isPullingEmbedding = false;
      this.embeddingPullProgress = { status: '', completed: 0, total: 0, percent: 0 };
    }
  }

  confirmingChatDelete = false;
  private chatDeleteTimeout: any;

  async deleteChatModel () {
    if ( !this.selectedChatModelId ) return;

    if ( !this.confirmingChatDelete ) {
      this.confirmingChatDelete = true;
      // Reset after 3 seconds
      if ( this.chatDeleteTimeout ) clearTimeout( this.chatDeleteTimeout );
      this.chatDeleteTimeout = setTimeout( () => {
        this.confirmingChatDelete = false;
      }, 3000 );
      return;
    }

    // Confirmed
    this.confirmingChatDelete = false;
    if ( this.chatDeleteTimeout ) clearTimeout( this.chatDeleteTimeout );

    this.isPullingChat = true;
    this.chatPullProgress = { status: 'Deleting...', completed: 0, total: 0, percent: 100 };

    try {
      console.log( 'Starting delete process for chat model:', this.selectedChatModelId );
      // Add a small delay so the user sees the "Deleting..." state
      await new Promise( resolve => setTimeout( resolve, 1000 ) );

      console.log( 'Calling ollamaService.deleteModel...' );
      const success = await this.ollamaService.deleteModel( this.selectedChatModelId );
      console.log( 'Delete result:', success );

      console.log( 'Refreshing models...' );
      await this.modelRegistry.refreshModels();
      console.log( 'Models refreshed.' );
    } catch ( e ) {
      console.error( 'Delete failed:', e );
      alert( 'Failed to delete model: ' + e );
    } finally {
      this.isPullingChat = false;
      this.chatPullProgress = { status: '', completed: 0, total: 0, percent: 0 };
    }
  }

  async pullOllamaModel ( modelName: string, type: 'chat' | 'embedding', signal?: AbortSignal ) {
    let startTime = Date.now();

    // Track progress per layer (digest)
    const layers = new Map<string, { completed: number, total: number }>();

    if ( type === 'chat' ) {
      this.isPullingChat = true;
      this.chatPullProgress = { status: `Pulling ${ modelName }...`, completed: 0, total: 0, percent: 0 };
    } else {
      this.isPullingEmbedding = true;
      this.embeddingPullProgress = { status: `Pulling ${ modelName }...`, completed: 0, total: 0, percent: 0 };
    }

    try {
      await this.ollamaService.pullModel( modelName, ( status, completed, total, digest ) => {
        // Update layer progress
        if ( digest ) {
          layers.set( digest, { completed, total } );
        } else if ( total > 0 ) {
          // Fallback for responses without digest but with progress (unlikely for multi-layer)
          layers.set( 'unknown', { completed, total } );
        }

        // Calculate global progress
        let globalCompleted = 0;
        let globalTotal = 0;

        layers.forEach( layer => {
          globalCompleted += layer.completed;
          globalTotal += layer.total;
        } );

        let percent = 0;
        if ( globalTotal > 0 ) {
          percent = Math.round( ( globalCompleted / globalTotal ) * 100 );
        } else if ( status === 'success' || status.includes( 'verifying' ) || status.includes( 'writing' ) ) {
          percent = 100;
        }

        // Calculate Speed (Global)
        const now = Date.now();
        const duration = ( now - startTime ) / 1000; // seconds
        let speed = '';

        if ( duration > 0 && globalCompleted > 0 ) {
          const mbLoaded = globalCompleted / ( 1024 * 1024 );
          const mbTotal = globalTotal / ( 1024 * 1024 );
          const speedVal = mbLoaded / duration;
          speed = `( download speed ${ speedVal.toFixed( 1 ) } MB / s )`;

          if ( globalTotal > 0 ) {
            status = `Pulling ${ modelName } - Pulled ${ mbLoaded.toFixed( 1 ) } MB of ${ mbTotal.toFixed( 1 ) } MB ${ speed } `;
          }
        }

        if ( type === 'chat' ) {
          this.chatPullProgress = { status, completed: globalCompleted, total: globalTotal, percent };
        } else {
          this.embeddingPullProgress = { status, completed: globalCompleted, total: globalTotal, percent };
        }
      }, signal );

      this.modelRegistry.refreshModels(); // Refresh to update status

      // Now set it as active
      if ( type === 'chat' ) {
        this.modelRegistry.setChatModel( modelName );
      } else {
        this.modelRegistry.setEmbeddingModel( modelName );
        this.selectedEmbeddingModelId = modelName;
      }

    } catch ( e: any ) {
      if ( e.message === 'Download cancelled by user' ) {
        console.log( 'Download cancelled' );
      } else {
        alert( `Failed to pull model: ${ e } ` );
      }
    } finally {
      if ( type === 'chat' ) {
        this.isPullingChat = false;
      } else {
        this.isPullingEmbedding = false;
      }
    }
  }

  saveOpenAIKey () {
    this.modelRegistry.setOpenAIKey( this.openAIKey );
    alert( 'API Key Saved!' );
  }

  saveOllamaConfig () {
    this.ollamaService.setApiKey( this.ollamaKey );
    this.ollamaService.setApiUrl( this.ollamaUrl );
    localStorage.setItem( 'cv-parser-ollama-key', this.ollamaKey );
    localStorage.setItem( 'cv-parser-ollama-url', this.ollamaUrl );
    this.modelRegistry.refreshModels();
    alert( 'Ollama Configuration Saved!' );
  }

  refreshLibrary () {
    this.modelRegistry.refreshModels();
  }

  resetProgress () {
    this.progressPercent = 0;
    this.modelLoadingProgress = '';
    this.steps.forEach( s => s.status = 'pending' );
  }

  updateStep ( index: number, status: 'loading' | 'completed' | 'error' ) {
    this.steps[ index ].status = status;
    if ( status === 'completed' ) {
      this.progressPercent = Math.round( ( ( index + 1 ) / this.steps.length ) * 100 );
    }
  }

  async onFileSelected ( event: any ) {
    const file: File = event.target.files[ 0 ];
    if ( file ) {
      this.selectedFileType = file.name.split( '.' ).pop()?.toLowerCase() || 'txt';
      this.isProcessing = true;
      this.resetProgress();

      try {
        // 1. Upload File
        this.updateStep( 0, 'loading' );
        const uploadResult = await this.uploadFile( file );
        console.log( 'File uploaded:', uploadResult );
        this.updateStep( 0, 'completed' );

        // 2. Parse Text
        this.updateStep( 1, 'loading' );
        const text = await this.fileParsingService.parseFile( file );
        this.updateStep( 1, 'completed' );

        // 3. Load AI Models
        this.updateStep( 2, 'loading' );
        // Initialize Chat Model
        await this.localExtractionService.initialize(
          this.selectedChatModelId,
          ( progress ) => this.modelLoadingProgress = progress
        );
        // Initialize Embedding Model (if not already)
        await this.embeddingService.initModel( this.selectedEmbeddingModelId );
        this.updateStep( 2, 'completed' );
        this.modelLoadingProgress = 'Models Ready';

        // 4. Extract Info (AI)
        this.updateStep( 3, 'loading' );
        const userData = await this.localExtractionService.extractData( text );
        this.updateStep( 3, 'completed' );

        // 5. Vectorize Document
        this.updateStep( 4, 'loading' );
        const docVector = await this.embeddingService.getEmbedding( text );
        this.updateStep( 4, 'completed' );

        // 6. Vectorize User Data
        this.updateStep( 5, 'loading' );
        const userDataString = JSON.stringify( userData );
        const userDataVector = await this.embeddingService.getEmbedding( userDataString );
        this.updateStep( 5, 'completed' );

        // 7. Store in DB
        this.updateStep( 6, 'loading' );
        const requestId = crypto.randomUUID();
        const fileType = file.name.split( '.' ).pop()?.toLowerCase() || 'txt';

        await this.storageService.storeDocument(
          requestId,
          uploadResult.filename, // doc_location
          docVector,
          userData,
          userDataVector,
          fileType
        );
        this.updateStep( 6, 'completed' );

        await this.refreshList();

        // Reset file input
        event.target.value = '';

      } catch ( err ) {
        console.error( 'Pipeline error:', err );
        // Find current loading step and mark as error
        const currentStep = this.steps.find( s => s.status === 'loading' );
        if ( currentStep ) currentStep.status = 'error';

        alert( 'Error processing document: ' + err );
      } finally {
        this.isProcessing = false;
        this.selectedFileType = null;
      }
    }
  }

  async uploadFile ( file: File ): Promise<{ filename: string, path: string }> {
    const formData = new FormData();
    formData.append( 'file', file );

    const response = await fetch( 'http://localhost:3000/upload', {
      method: 'POST',
      body: formData
    } );

    if ( !response.ok ) {
      throw new Error( 'Upload failed' );
    }
    return await response.json();
  }

  async refreshList () {
    this.documents = await this.storageService.getAllDocuments();
  }

  async exportData () {
    const dataStr = JSON.stringify( this.documents, null, 2 );
    const blob = new Blob( [ dataStr ], { type: 'application/json' } );
    const url = window.URL.createObjectURL( blob );

    const a = document.createElement( 'a' );
    a.href = url;
    a.download = 'cv-data.json';
    a.click();

    window.URL.revokeObjectURL( url );
  }

  async importData ( event: any ) {
    const file = event.target.files[ 0 ];
    if ( !file ) return;

    const reader = new FileReader();
    reader.onload = async ( e: any ) => {
      try {
        const data = JSON.parse( e.target.result );
        if ( Array.isArray( data ) ) {
          await this.storageService.importDocuments( data );
          await this.refreshList();
          alert( 'Data imported successfully!' );
        } else {
          alert( 'Invalid data format' );
        }
      } catch ( err ) {
        console.error( err );
        alert( 'Error importing data' );
      }
      // Reset input
      event.target.value = '';
    };
    reader.readAsText( file );
  }

  async deleteDocument ( requestId: string ) {
    if ( confirm( 'Are you sure you want to delete this document?' ) ) {
      await this.storageService.deleteDocument( requestId );
      await this.refreshList();
    }
  }

  getFileColor ( fileType: string ): string {
    switch ( fileType ) {
      case 'pdf': return '#dc3545'; // Red
      case 'docx':
      case 'doc': return '#007bff'; // Blue
      case 'txt': return '#6c757d'; // Gray
      case 'json': return '#28a745'; // Green
      case 'md': return '#6f42c1'; // Purple
      default: return '#333'; // Dark
    }
  }
}
