import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModelConfig } from '../../../../services/model-registry.service';
import { SmartDropdownComponent } from '../../../ui/smart-dropdown/smart-dropdown.component';

@Component( {
    selector: 'app-openai-config',
    standalone: true,
    imports: [ CommonModule, FormsModule, SmartDropdownComponent ],
    templateUrl: './openai-config.component.html'
} )
export class OpenAiConfigComponent {
    @Input() chatModels: ModelConfig[] = [];
    @Input() embeddingModels: ModelConfig[] = [];
    @Input() selectedChatModelId: string = '';
    @Input() selectedEmbeddingModelId: string = '';
    @Input() apiKey: string = '';
    @Input() isRefreshing: boolean = false;
    @Input() metadataLastUpdated: number | null = null;

    @Output() chatModelChange = new EventEmitter<string>();
    @Output() embeddingChange = new EventEmitter<string>();
    @Output() apiKeyChange = new EventEmitter<string>();
    @Output() saveKey = new EventEmitter<void>();
    @Output() removeKey = new EventEmitter<void>();
    @Output() refreshMetadata = new EventEmitter<void>();
    @Output() viewMetadata = new EventEmitter<string>();
}
