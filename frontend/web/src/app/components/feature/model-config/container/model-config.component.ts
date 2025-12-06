import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component( {
    selector: 'app-model-config',
    standalone: true,
    imports: [ CommonModule ],
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

    @Output() providerChange = new EventEmitter<string>();
    @Output() toggleSettings = new EventEmitter<void>();
}
