import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ProgressStep {
    name: string;
    status: 'pending' | 'loading' | 'completed' | 'error';
}

@Component( {
    selector: 'app-file-uploader',
    standalone: true,
    imports: [ CommonModule ],
    templateUrl: './file-uploader.component.html'
} )
export class FileUploaderComponent {
    @Input() disabled: boolean = false;
    @Input() selectedFileType: string | null = null;
    @Input() isProcessing: boolean = false;
    @Input() progressPercent: number = 0;
    @Input() modelLoadingProgress: string = '';
    @Input() steps: ProgressStep[] = [];

    @Output() fileSelected = new EventEmitter<Event>();
    @Output() resetProgress = new EventEmitter<void>();

    // Copy helper from AppComponent
    getFileColor ( fileType: string ): string {
        const colors: { [ key: string ]: string } = {
            'pdf': '#dc3545',
            'docx': '#007bff',
            'txt': '#6c757d',
            'md': '#6f42c1',
            'json': '#28a745'
        };
        return colors[ fileType ] || '#6c757d';
    }
}
