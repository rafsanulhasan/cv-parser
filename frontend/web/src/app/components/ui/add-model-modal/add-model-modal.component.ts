import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModelRegistryService, ModelConfig } from '../../../services/model-registry.service';
import { OllamaService } from '../../../services/ollama.service';

@Component( {
    selector: 'app-add-model-modal',
    standalone: true,
    imports: [ CommonModule, FormsModule ],
    templateUrl: './add-model-modal.component.html'
} )
export class AddModelModalComponent implements OnInit {
    @Input() provider: 'ollama' | 'openai' | 'browser' = 'openai';
    @Output() close = new EventEmitter<void>();
    @Output() modelAdded = new EventEmitter<string>();

    availableModels: ModelConfig[] = [];
    loading = false;
    searchQuery = '';
    manualModelId = '';

    // Progress/Status for Model Interactions
    actionStatus: { [ id: string ]: string } = {};

    constructor (
        private modelRegistry: ModelRegistryService,
        private ollamaService: OllamaService
    ) { }

    async ngOnInit () {
        this.refreshList();
    }

    async refreshList () {
        this.loading = true;
        this.availableModels = await this.modelRegistry.getAvailableModels( this.provider );
        this.loading = false;
    }

    get filteredModels () {
        return this.availableModels.filter( m =>
            m.name.toLowerCase().includes( this.searchQuery.toLowerCase() ) ||
            m.id.toLowerCase().includes( this.searchQuery.toLowerCase() )
        );
    }

    async addModel ( model: ModelConfig ) {
        if ( this.provider === 'openai' ) {
            this.modelRegistry.addOpenAIModel( model.id );
            this.modelAdded.emit( model.id );
            this.actionStatus[ model.id ] = 'Added';
        } else if ( this.provider === 'ollama' ) {
            // Trigger pull
            this.actionStatus[ model.id ] = 'Pulling...';
            // We don't wait for pull to finish to close? Maybe we do?
            // For now, let's just trigger it and let the main UI handle global progress?
            // Or we can simple call pullModel and show progress here.
            // The requirement says: "Ollama: Triggers `ollama pull`."
            // Ideally we show progress.
            // But `ollamaService.pullModel` takes a callback.
            // Let's implement a simple progress tracker here just for the "Add" action?
            // Or just fire and forget if the global toaster handles it?
            // The AppComponent has the progress bar logic.
            // Maybe we just emit 'modelAdded' and let parent handle the pulling?
            // But `modelAdded` implies it's ready?
            // Actually `modelRegistry` doesn't have `pullOllamaModel`.
            // Let's call `ollamaService.pullModel` here but maybe delegate the UI feedback to AppComponent via an event?
            // Simplest: Emit an event `requestPull` or `addModel` and let App handle the complexity of progress bars.
            this.modelAdded.emit( model.id ); // Parent should handle pulling for Ollama
        }
    }

    addManualOpenAIModel () {
        if ( this.manualModelId.trim() ) {
            this.modelRegistry.addOpenAIModel( this.manualModelId.trim() );
            this.modelAdded.emit( this.manualModelId.trim() );
            this.manualModelId = '';
            this.refreshList();
        }
    }

    onClose () {
        this.close.emit();
    }
}
