import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component( {
    selector: 'app-document-list',
    standalone: true,
    imports: [ CommonModule ],
    templateUrl: './document-list.component.html'
} )
export class DocumentListComponent {
    @Input() documents: any[] = [];

    @Output() delete = new EventEmitter<string>();
    @Output() importData = new EventEmitter<Event>();
    @Output() exportData = new EventEmitter<void>();

    // Copy helper from AppComponent
    getFileColor ( fileType: string ): string {
        const colors: { [ key: string ]: string } = {
            'pdf': '#dc3545',
            'docx': '#007bff',
            'txt': '#6c757d',
            'md': '#6f42c1',
            'json': '#28a745'
        };
        return colors[ fileType ] || '#6c757d'; // Default gray
    }

    onDelete ( id: string, event: Event ) {
        event.stopPropagation();
        this.delete.emit( id );
    }
}
