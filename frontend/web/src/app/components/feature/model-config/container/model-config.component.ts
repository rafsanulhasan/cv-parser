import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SmartDropdownComponent } from '../../../ui/smart-dropdown/smart-dropdown.component';
import { ModelConfig } from '../../../../services/model-registry.service';

@Component( {
    selector: 'app-model-config',
    standalone: true,
    imports: [ CommonModule, SmartDropdownComponent ],
    templateUrl: './model-config.component.html'
} )
export class ModelConfigComponent {
    @Input() providers: { id: string, name: string }[] = [
        { id: 'browser', name: 'Browser (WebLLM)' },
        { id: 'ollama', name: 'Ollama (Local)' },
        { id: 'openai', name: 'OpenAI (Cloud)' }
    ];
    @Input() selectedProvider: string = 'browser';
    @Input() showSettings: boolean = false;

    // Unified Chat Model Inputs
    @Input() chatModels: { label: string, options?: ModelConfig[], subgroups?: { label: string, options: ModelConfig[] }[] }[] = [];
    @Input() selectedChatModelId: string = '';

    // Action State Pass-through
    @Input() showDownload: boolean = false;
    @Input() showDelete: boolean = false;
    @Input() isInstalled: boolean = false;
    @Input() isPulling: boolean = false;
    @Input() deleteConfirming: boolean = false;

    @Output() providerChange = new EventEmitter<string>();
    @Output() toggleSettings = new EventEmitter<void>();

    @Output() chatModelChange = new EventEmitter<string>();
    @Output() openAddModel = new EventEmitter<void>();

    // Action Events
    @Output() downloadModel = new EventEmitter<void>();
    @Output() deleteModel = new EventEmitter<void>();
    @Output() cancelPull = new EventEmitter<void>();
}
