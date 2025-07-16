import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { QuillModule } from 'ngx-quill';
import { Subject, takeUntil } from 'rxjs';

// Services
import { LoggingService } from '../../services/logging.service';

@Component({
  selector: 'app-rich-text-editor',
  templateUrl: './rich-text-editor.component.html',
  styleUrls: ['./rich-text-editor.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    QuillModule
  ],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextEditorComponent),
      multi: true
    }
  ],
  host: {
    'class': 'block w-full'
  }
})
export class RichTextEditorComponent implements OnInit, OnDestroy, ControlValueAccessor {
  @Input() placeholder = 'Start writing...';
  @Input() readonly = false;
  @Input() minHeight = '200px';
  @Input() theme: 'snow' | 'bubble' = 'snow';
  @Output() contentChange = new EventEmitter<string>();
  @Output() editorFocus = new EventEmitter<void>();
  @Output() editorBlur = new EventEmitter<void>();

  private destroy$ = new Subject<void>();
  private quillInstance: any;
  
  content = '';
  isDisabled = false;
  editorStyles: any = {};
  
  // Quill configuration optimized for mobile
  quillConfig = {
    theme: 'snow',
    placeholder: this.placeholder,
    modules: {
      toolbar: {
        container: [
          ['bold', 'italic', 'underline'],
          [{ 'header': [1, 2, 3, false] }],
          [{ 'list': 'ordered'}, { 'list': 'bullet' }],
          ['blockquote'],
          ['link'],
          ['clean']
        ],
        handlers: {
          // Custom handlers can be added here
        }
      },
      history: {
        delay: 1000,
        maxStack: 50,
        userOnly: true
      }
    },
    formats: [
      'bold', 'italic', 'underline',
      'header',
      'list',
      'blockquote',
      'link'
    ]
  };

  // ControlValueAccessor implementation
  private onChange = (value: string) => {};
  private onTouched = () => {};

  constructor(private logging: LoggingService) {}

  ngOnInit() {
    // Update placeholder in config
    this.quillConfig.placeholder = this.placeholder;
    this.quillConfig.theme = this.theme;
    
    // Set editor styles
    this.editorStyles = {
      'min-height': this.minHeight,
      'height': this.minHeight
    };
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ControlValueAccessor methods
  writeValue(value: string): void {
    this.content = value || '';
    // Set content directly on Quill instance if available
    if (this.quillInstance) {
      if (value) {
        this.quillInstance.clipboard.dangerouslyPasteHTML(value);
      } else {
        this.quillInstance.setText('');
      }
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }

  // Event handlers
  onContentChanged(event: any): void {
    const html = event.html;
    const text = event.text;
    
    this.content = html;
    this.onChange(html);
    this.contentChange.emit(html);
    
    this.logging.debug('Rich text content changed', { 
      textLength: text?.length || 0,
      htmlLength: html?.length || 0 
    });
  }

  onEditorFocus(): void {
    this.onTouched();
    this.editorFocus.emit();
    this.logging.debug('Rich text editor focused');
  }

  onEditorBlur(): void {
    this.editorBlur.emit();
    this.logging.debug('Rich text editor blurred');
  }

  onEditorCreated(quill: any): void {
    this.quillInstance = quill;
    this.logging.debug('Rich text editor created');
    
    // Set initial content if available
    if (this.content) {
      quill.clipboard.dangerouslyPasteHTML(this.content);
    }
    
    // Mobile optimizations
    if (this.isMobile()) {
      this.optimizeForMobile(quill);
    }
  }

  // Helper methods
  private isMobile(): boolean {
    return window.innerWidth <= 768;
  }

  private optimizeForMobile(quill: any): void {
    // Add mobile-specific optimizations
    const toolbar = quill.getModule('toolbar');
    if (toolbar && toolbar.container) {
      toolbar.container.style.border = 'none';
      toolbar.container.style.borderBottom = '1px solid #e5e5e5';
    }

    // Adjust editor height for mobile
    const editor = quill.root;
    if (editor) {
      editor.style.fontSize = '16px'; // Prevents zoom on iOS
      editor.style.minHeight = this.minHeight;
    }
  }

  // Public methods
  getWordCount(): number {
    if (!this.content) return 0;
    const text = this.stripHtml(this.content);
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  getCharacterCount(): number {
    if (!this.content) return 0;
    return this.stripHtml(this.content).length;
  }

  private stripHtml(html: string): string {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  }

  getPlainText(): string {
    return this.stripHtml(this.content);
  }

  isEmpty(): boolean {
    const text = this.getPlainText();
    return !text || text.trim().length === 0;
  }

  focus(): void {
    // Method to programmatically focus the editor
    // Implementation depends on Quill instance access
  }

  clear(): void {
    this.content = '';
    this.onChange('');
    this.contentChange.emit('');
  }
} 