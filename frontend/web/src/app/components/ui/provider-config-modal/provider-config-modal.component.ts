import { Component, EventEmitter, Input, Output, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModelRegistryService } from '../../../services/model-registry.service';
import { OllamaService } from '../../../services/ollama.service';

@Component( {
    selector: 'app-provider-config-modal',
    standalone: true,
    imports: [ CommonModule, FormsModule ],
    templateUrl: './provider-config-modal.component.html',
    styleUrls: [ './provider-config-modal.component.css' ]
} )
export class ProviderConfigModalComponent implements AfterViewInit {
    @Input() activeTab: 'online' | 'offline' = 'offline';
    @Input() focusField: 'ollama-url' | 'openai-key' | null = null;
    @Output() close = new EventEmitter<void>();
    @Output() saved = new EventEmitter<void>();

    @ViewChild( 'ollamaUrlInput' ) ollamaUrlInput!: ElementRef<HTMLInputElement>;
    @ViewChild( 'openaiKeyInput' ) openaiKeyInput!: ElementRef<HTMLInputElement>;

    ollamaBaseUrl = 'http://localhost:11434';
    openaiApiKey = '';
    showApiKey = false;
    isSaving = false;

    constructor (
        private modelRegistry: ModelRegistryService,
        private ollamaService: OllamaService
    ) {
        // Load existing values
        this.ollamaBaseUrl = this.ollamaService.getApiUrl() || 'http://localhost:11434';
        this.openaiApiKey = this.modelRegistry.getOpenAIKey() || '';
    }

    ngAfterViewInit () {
        // Focus the appropriate field after view is ready
        setTimeout( () => {
            if ( this.focusField === 'ollama-url' && this.ollamaUrlInput ) {
                this.ollamaUrlInput.nativeElement.focus();
                this.ollamaUrlInput.nativeElement.select();
            } else if ( this.focusField === 'openai-key' && this.openaiKeyInput ) {
                this.openaiKeyInput.nativeElement.focus();
            }
        }, 100 );
    }

    switchTab ( tab: 'online' | 'offline' ) {
        this.activeTab = tab;
    }

    toggleShowApiKey () {
        this.showApiKey = !this.showApiKey;
    }

    async saveConfig () {
        this.isSaving = true;
        try {
            // Save Ollama URL
            if ( this.ollamaBaseUrl.trim() ) {
                this.ollamaService.setApiUrl( this.ollamaBaseUrl.trim() );
                await this.modelRegistry.saveOllamaBaseUrl( this.ollamaBaseUrl.trim() );
            }

            // Save OpenAI Key
            if ( this.openaiApiKey.trim() ) {
                this.modelRegistry.setOpenAIKey( this.openaiApiKey.trim() );
            }

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
