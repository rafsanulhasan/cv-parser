import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModelConfig } from '../../../../services/model-registry.service';
import { ModelSelectComponent } from '../../../ui/model-select/model-select.component';

@Component( {
    selector: 'app-ollama-config',
    standalone: true,
    imports: [ CommonModule, FormsModule, ModelSelectComponent ],
    templateUrl: './ollama-config.component.html'
} )
export class OllamaConfigComponent {
    @Input() chatModels: ModelConfig[] = [];
    @Input() embeddingModels: ModelConfig[] = [];
    @Input() selectedChatModelId: string = '';
    @Input() selectedEmbeddingModelId: string = '';
    @Input() ollamaApiUrl: string = '';

    // State from parent
    @Input() isPulling: boolean = false;
    @Input() pullProgress: any = null;
    @Input() deleteConfirming: boolean = false;

    @Output() chatModelChange = new EventEmitter<string>();
    @Output() embeddingModelChange = new EventEmitter<string>();
    @Output() apiUrlChange = new EventEmitter<string>();

    // Actions
    @Output() downloadModel = new EventEmitter<{ id: string, type: 'chat' | 'embedding' }>();
    @Output() deleteModel = new EventEmitter<{ id: string, type: 'chat' | 'embedding' }>();
    @Output() cancelPull = new EventEmitter<void>();

    get selectedChatModel () { return this.chatModels.find( m => m.id === this.selectedChatModelId ); }
    get selectedEmbeddingModel () { return this.embeddingModels.find( m => m.id === this.selectedEmbeddingModelId ); }

    onChatModelDownload () {
        this.downloadModel.emit( { id: this.selectedChatModelId, type: 'chat' } );
    }

    onEmbeddingModelDownload () {
        this.downloadModel.emit( { id: this.selectedEmbeddingModelId, type: 'embedding' } );
    }

    onChatModelDelete () {
        this.deleteModel.emit( { id: this.selectedChatModelId, type: 'chat' } );
    }

    onEmbeddingModelDelete () {
        this.deleteModel.emit( { id: this.selectedEmbeddingModelId, type: 'embedding' } );
    }
}
