import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModelRegistryService } from '../../../services/model-registry.service';

@Component( {
    selector: 'app-openai-key-modal',
    standalone: true,
    imports: [ CommonModule, FormsModule ],
    templateUrl: './openai-key-modal.component.html',
    styleUrls: [ './openai-key-modal.component.css' ]
} )
export class OpenAIKeyModalComponent {
    @Output() close = new EventEmitter<void>();
    @Output() saved = new EventEmitter<void>();

    apiKey = '';
    isSaving = false;
    showKey = false;

    constructor ( private modelRegistry: ModelRegistryService ) {
        // Load existing key if available
        this.apiKey = this.modelRegistry.getOpenAIKey() || '';
    }

    toggleShowKey () {
        this.showKey = !this.showKey;
    }

    async saveKey () {
        if ( !this.apiKey.trim() ) return;

        this.isSaving = true;
        try {
            this.modelRegistry.setOpenAIKey( this.apiKey.trim() );
            await this.modelRegistry.refreshModels();
            this.saved.emit();
            this.close.emit();
        } finally {
            this.isSaving = false;
        }
    }

    onClose () {
        this.close.emit();
    }

    onBackdropClick ( event: MouseEvent ) {
        if ( ( event.target as HTMLElement ).classList.contains( 'modal-backdrop' ) ) {
            this.onClose();
        }
    }
}
