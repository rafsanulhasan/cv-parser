import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModelConfig } from '../../../services/model-registry.service';

@Component( {
    selector: 'app-smart-dropdown',
    standalone: true,
    imports: [ CommonModule, FormsModule ],
    templateUrl: './smart-dropdown.component.html'
} )
export class SmartDropdownComponent {
    @Input() label: string = '';
    @Input() models: ModelConfig[] = [];
    @Input() selectedModelId: string = '';
    @Input() isDisabled: boolean = false;
    @Input() showInfoButton: boolean = false;

    // For Ollama actions
    @Input() showDownload: boolean = false;
    @Input() showDelete: boolean = false;
    @Input() isPulling: boolean = false;
    @Input() isInstalled: boolean = false;
    @Input() deleteConfirming: boolean = false;

    @Output() modelChange = new EventEmitter<string>();
    @Output() infoClick = new EventEmitter<void>();
    @Output() download = new EventEmitter<void>();
    @Output() cancelPull = new EventEmitter<void>();
    @Output() delete = new EventEmitter<void>();

    get installedModels (): ModelConfig[] {
        return this.models.filter( m => m.isInstalled !== false );
    }

    get availableToDownloadModels (): ModelConfig[] {
        return this.models.filter( m => m.isInstalled === false );
    }

    get isOllamaGrouped (): boolean {
        // Basic heuristic: if we have "isInstalled" property separation, we group
        return this.models.some( m => m.isInstalled === false );
    }

    onModelChange ( id: string ) {
        this.selectedModelId = id;
        this.modelChange.emit( id );
    }
}
