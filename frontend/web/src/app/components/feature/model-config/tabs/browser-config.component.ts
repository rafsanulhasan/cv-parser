import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModelConfig } from '../../../../services/model-registry.service';
import { ModelSelectComponent } from '../../../ui/model-select/model-select.component';

@Component( {
    selector: 'app-browser-config',
    standalone: true,
    imports: [ CommonModule, ModelSelectComponent ],
    templateUrl: './browser-config.component.html'
} )
export class BrowserConfigComponent {
    @Input() chatModels: ModelConfig[] = [];
    @Input() embeddingModels: ModelConfig[] = [];
    @Input() selectedChatModelId: string = '';
    @Input() selectedEmbeddingModelId: string = '';

    @Output() chatModelChange = new EventEmitter<string>();
    @Output() embeddingModelChange = new EventEmitter<string>();

    // Browser mode doesn't need much logic, mostly pass-through
}
