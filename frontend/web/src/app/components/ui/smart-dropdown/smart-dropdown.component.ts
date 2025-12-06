import { Component, EventEmitter, Input, Output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModelConfig } from '../../../services/model-registry.service';

@Component( {
    selector: 'app-smart-dropdown',
    standalone: true,
    imports: [ CommonModule, FormsModule ],
    templateUrl: './smart-dropdown.component.html',
    styleUrls: [ './smart-dropdown.component.css' ]
} )
export class SmartDropdownComponent {
    @Input() label: string = '';
    @Input() models: ModelConfig[] = [];
    // Updated type to support nested hierarchy with optional metadata
    @Input() groups: { label: string, options?: ModelConfig[], subgroups?: { label: string, options: ModelConfig[], noKeyConfigured?: boolean, message?: string }[] }[] = [];
    @Input() selectedModelId: string = '';

    // Action States
    @Input() showDownload: boolean = false;
    @Input() showDelete: boolean = false;
    @Input() isInstalled: boolean = false;
    @Input() isPulling: boolean = false;
    @Input() deleteConfirming: boolean = false;
    @Input() showInfoButton: boolean = false;

    @Output() modelChange = new EventEmitter<string>();
    @Output() infoClick = new EventEmitter<string>();
    @Output() download = new EventEmitter<void>();
    @Output() openBYOM = new EventEmitter<void>(); // Open Bring Your Own Model modal
    @Output() delete = new EventEmitter<void>();
    @Output() cancelPull = new EventEmitter<void>();

    // Custom Dropdown State
    isOpen = false;

    toggleDropdown () {
        if ( !this.isDisabled ) {
            this.isOpen = !this.isOpen;
        }
    }

    closeDropdown () {
        this.isOpen = false;
    }

    selectModel ( modelId: string ) {
        this.selectedModelId = modelId;
        this.modelChange.emit( modelId );
        this.closeDropdown();
    }

    get selectedModelName (): string {
        const model = this.getSelectedModel();
        if ( model ) return model.name;
        return 'Select a Model...';
    }

    getSelectedModel (): ModelConfig | undefined {
        // Search in flat models
        let model = this.models.find( m => m.id === this.selectedModelId );
        if ( model ) return model;

        // Search in groups (recursive-ish)
        for ( const group of this.groups ) {
            if ( group.options ) {
                model = group.options.find( m => m.id === this.selectedModelId );
                if ( model ) return model;
            }
            if ( group.subgroups ) {
                for ( const subgroup of group.subgroups ) {
                    model = subgroup.options.find( m => m.id === this.selectedModelId );
                    if ( model ) return model;
                }
            }
        }
        return undefined;
    }

    formatSize ( bytes: number | undefined ): string {
        if ( !bytes ) return '';
        const units = [ 'B', 'KB', 'MB', 'GB', 'TB', 'PB' ];
        let unitIndex = 0;
        let size = bytes;
        while ( size >= 1024 && unitIndex < units.length - 1 ) {
            size /= 1024;
            unitIndex++;
        }
        return `${ size.toFixed( 1 ) } ${ units[ unitIndex ] }`;
    }

    formatNumber ( num: number | string | undefined ): string {
        if ( !num ) return '';
        // If string contains non-digit suffixes (like "128k"), return as-is
        if ( typeof num === 'string' && /[a-zA-Z]/.test( num ) ) {
            return num;
        }
        const n = typeof num === 'string' ? parseInt( num, 10 ) : num;
        if ( isNaN( n ) ) return String( num );
        if ( n >= 1000000 ) return `${ ( n / 1000000 ).toFixed( 1 ) }M`;
        if ( n >= 1000 ) return `${ ( n / 1000 ).toFixed( 1 ) }K`;
        return String( n );
    }

    get isDisabled (): boolean {
        return this.isPulling;
    }

    // Handle click outside to close
    @HostListener( 'document:click', [ '$event' ] )
    onDocumentClick ( event: MouseEvent ) {
        const target = event.target as HTMLElement;
        if ( !target.closest( '.smart-dropdown-container' ) ) {
            this.closeDropdown();
        }
    }
}
