import {
  Component,
  EventEmitter,
  Output,
  signal,
  ElementRef,
  ViewChild,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { FeedService } from "../../../core/services/feed.service";

type UploadStep = "select" | "edit" | "caption";

@Component({
  selector: "app-upload-modal",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="onBackdropClick($event)">
      <div
        class="modal"
        [class.modal--expanded]="step() !== 'select'"
        data-testid="upload-modal"
      >
        <!-- Header -->
        <header class="modal-header">
          @if (step() === 'select') {
          <span class="header-spacer"></span>
          <h2>Create new post</h2>
          <button class="btn--close" (click)="close.emit()" aria-label="Close">
            <span class="material-icons-outlined">close</span>
          </button>
          } @else if (step() === 'edit') {
          <button class="btn--back" (click)="goBack()" aria-label="Back">
            <span class="material-icons-outlined">arrow_back</span>
          </button>
          <h2>Edit</h2>
          <button
            class="btn--next"
            (click)="nextStep()"
            data-testid="next-button"
          >
            Next
          </button>
          } @else {
          <button class="btn--back" (click)="goBack()" aria-label="Back">
            <span class="material-icons-outlined">arrow_back</span>
          </button>
          <h2>Create new post</h2>
          <button
            class="btn--share"
            (click)="share()"
            [disabled]="uploading()"
            data-testid="share-button"
          >
            @if (uploading()) {
            <span class="spinner spinner--small"></span>
            } @else { Share }
          </button>
          }
        </header>

        <!-- Content -->
        <div class="modal-content">
          @switch (step()) { @case ('select') {
          <div
            class="upload-dropzone"
            [class.upload-dropzone--active]="isDragging()"
            (dragover)="onDragOver($event)"
            (dragleave)="onDragLeave($event)"
            (drop)="onDrop($event)"
            data-testid="upload-dropzone"
          >
            <div class="upload-icon">
              <span class="material-icons-outlined">add_photo_alternate</span>
            </div>
            <h3>Drag photos here</h3>
            <p>or</p>
            <input
              type="file"
              #fileInput
              accept="image/*"
              (change)="onFileSelect($event)"
              hidden
            />
            <button class="btn btn--primary" (click)="fileInput.click()">
              Select from computer
            </button>
          </div>
          } @case ('edit') {
          <div class="edit-container">
            <div class="edit-preview">
              <img
                [src]="previewUrl()"
                alt="Preview"
                data-testid="image-preview"
              />

              <!-- Aspect Ratio Controls -->
              <div class="edit-controls">
                <button
                  class="control-btn"
                  [class.control-btn--active]="aspectRatio() === 'original'"
                  (click)="setAspectRatio('original')"
                  title="Original"
                >
                  <span class="material-icons-outlined">crop_free</span>
                </button>
                <button
                  class="control-btn"
                  [class.control-btn--active]="aspectRatio() === '1:1'"
                  (click)="setAspectRatio('1:1')"
                  title="1:1"
                >
                  <span class="material-icons-outlined">crop_square</span>
                </button>
                <button
                  class="control-btn"
                  [class.control-btn--active]="aspectRatio() === '4:5'"
                  (click)="setAspectRatio('4:5')"
                  title="4:5"
                >
                  <span class="material-icons-outlined">crop_portrait</span>
                </button>
                <button
                  class="control-btn"
                  [class.control-btn--active]="aspectRatio() === '16:9'"
                  (click)="setAspectRatio('16:9')"
                  title="16:9"
                >
                  <span class="material-icons-outlined">crop_landscape</span>
                </button>
              </div>
            </div>
          </div>
          } @case ('caption') {
          <div class="caption-container">
            <div class="caption-preview">
              <img [src]="previewUrl()" alt="Preview" />
            </div>

            <div class="caption-form">
              <div class="caption-header">
                <img
                  [src]="'https://i.pravatar.cc/150?u=me'"
                  alt="Your avatar"
                  class="caption-avatar"
                />
                <span class="caption-username">username</span>
              </div>

              <textarea
                class="caption-input"
                [(ngModel)]="caption"
                placeholder="Write a caption..."
                maxlength="2200"
                data-testid="caption-input"
              ></textarea>

              <div class="caption-footer">
                <button class="emoji-btn" title="Add emoji">😊</button>
                <span class="char-count">{{ caption.length }}/2,200</span>
              </div>

              <!-- Location -->
              <button class="option-btn">
                <span>Add location</span>
                <span class="material-icons-outlined">location_on</span>
              </button>

              <!-- Accessibility -->
              <button
                class="option-btn"
                (click)="showAltText.set(!showAltText())"
              >
                <span>Accessibility</span>
                <span class="material-icons-outlined">{{
                  showAltText() ? "expand_less" : "expand_more"
                }}</span>
              </button>

              @if (showAltText()) {
              <div class="alt-text-section">
                <p class="alt-text-info">
                  Alt text describes your photos for people with visual
                  impairments.
                </p>
                <input
                  type="text"
                  class="input alt-text-input"
                  [(ngModel)]="altText"
                  placeholder="Write alt text..."
                />
              </div>
              }

              <!-- Advanced Settings -->
              <button
                class="option-btn"
                (click)="showAdvanced.set(!showAdvanced())"
              >
                <span>Advanced settings</span>
                <span class="material-icons-outlined">{{
                  showAdvanced() ? "expand_less" : "expand_more"
                }}</span>
              </button>

              @if (showAdvanced()) {
              <div class="advanced-section">
                <label class="toggle-option">
                  <span>Turn off commenting</span>
                  <input type="checkbox" [(ngModel)]="disableComments" />
                  <span class="toggle"></span>
                </label>

                <label class="toggle-option">
                  <span>Hide like count</span>
                  <input type="checkbox" [(ngModel)]="hideLikes" />
                  <span class="toggle"></span>
                </label>
              </div>
              }
            </div>
          </div>
          } }
        </div>

        @if (error()) {
        <div class="modal-error" data-testid="error-message">
          {{ error() }}
        </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.65);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: var(--ig-spacing-lg);
      }

      .modal {
        background: var(--ig-white);
        border-radius: var(--ig-radius-lg);
        width: 100%;
        max-width: 400px;
        max-height: 90vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;

        &--expanded {
          max-width: 800px;

          @media (max-width: 800px) {
            max-width: 100%;
          }
        }
      }

      .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--ig-spacing-sm) var(--ig-spacing-md);
        border-bottom: 1px solid var(--ig-border);
        min-height: 42px;

        h2 {
          font-size: var(--ig-font-md);
          font-weight: 600;
          text-align: center;
          flex: 1;
        }
      }

      .header-spacer {
        width: 24px;
      }

      .btn--close,
      .btn--back {
        background: none;
        border: none;
        cursor: pointer;
        padding: var(--ig-spacing-xs);
        display: flex;
        align-items: center;
        justify-content: center;

        .material-icons-outlined {
          font-size: 24px;
        }
      }

      .btn--next,
      .btn--share {
        background: none;
        border: none;
        color: var(--ig-primary);
        font-weight: 600;
        font-size: var(--ig-font-sm);
        cursor: pointer;
        padding: var(--ig-spacing-xs);

        &:hover {
          color: var(--ig-dark);
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      .modal-content {
        flex: 1;
        overflow: auto;
      }

      .upload-dropzone {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px;
        min-height: 400px;
        transition: background-color 0.2s;

        &--active {
          background: rgba(0, 149, 246, 0.1);
        }
      }

      .upload-icon {
        margin-bottom: var(--ig-spacing-md);

        .material-icons-outlined {
          font-size: 96px;
          color: var(--ig-dark);
        }
      }

      .upload-dropzone h3 {
        font-size: 22px;
        font-weight: 300;
        color: var(--ig-dark);
        margin-bottom: var(--ig-spacing-sm);
      }

      .upload-dropzone p {
        color: var(--ig-secondary);
        margin-bottom: var(--ig-spacing-md);
      }

      .edit-container,
      .caption-container {
        display: flex;
        height: 500px;

        @media (max-width: 600px) {
          flex-direction: column;
          height: auto;
        }
      }

      .edit-preview {
        flex: 1;
        position: relative;
        background: var(--ig-dark);
        display: flex;
        align-items: center;
        justify-content: center;

        img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
      }

      .edit-controls {
        position: absolute;
        bottom: var(--ig-spacing-md);
        left: var(--ig-spacing-md);
        display: flex;
        gap: var(--ig-spacing-sm);
      }

      .control-btn {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(26, 26, 26, 0.8);
        border: none;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;

        .material-icons-outlined {
          font-size: 18px;
        }

        &--active {
          background: var(--ig-white);
          color: var(--ig-dark);
        }
      }

      .caption-preview {
        width: 50%;
        background: var(--ig-dark);
        display: flex;
        align-items: center;
        justify-content: center;

        img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        @media (max-width: 600px) {
          width: 100%;
          height: 300px;
        }
      }

      .caption-form {
        width: 50%;
        display: flex;
        flex-direction: column;

        @media (max-width: 600px) {
          width: 100%;
        }
      }

      .caption-header {
        display: flex;
        align-items: center;
        gap: var(--ig-spacing-sm);
        padding: var(--ig-spacing-md);
      }

      .caption-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
      }

      .caption-username {
        font-weight: 600;
        font-size: var(--ig-font-sm);
      }

      .caption-input {
        flex: 1;
        border: none;
        resize: none;
        padding: 0 var(--ig-spacing-md);
        font-size: var(--ig-font-md);
        font-family: inherit;
        line-height: 1.5;
        min-height: 100px;

        &:focus {
          outline: none;
        }

        &::placeholder {
          color: var(--ig-secondary);
        }
      }

      .caption-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--ig-spacing-sm) var(--ig-spacing-md);
        border-bottom: 1px solid var(--ig-border);
      }

      .emoji-btn {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
      }

      .char-count {
        color: var(--ig-secondary);
        font-size: var(--ig-font-xs);
      }

      .option-btn {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: var(--ig-spacing-sm) var(--ig-spacing-md);
        background: none;
        border: none;
        border-bottom: 1px solid var(--ig-border);
        font-size: var(--ig-font-md);
        cursor: pointer;

        .material-icons-outlined {
          color: var(--ig-secondary);
        }
      }

      .alt-text-section,
      .advanced-section {
        padding: var(--ig-spacing-md);
        border-bottom: 1px solid var(--ig-border);
      }

      .alt-text-info {
        font-size: var(--ig-font-sm);
        color: var(--ig-secondary);
        margin-bottom: var(--ig-spacing-sm);
      }

      .alt-text-input {
        width: 100%;
      }

      .toggle-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--ig-spacing-sm) 0;
        cursor: pointer;

        input {
          display: none;
        }

        .toggle {
          width: 44px;
          height: 24px;
          background: var(--ig-border);
          border-radius: 12px;
          position: relative;
          transition: background-color 0.2s;

          &::after {
            content: "";
            position: absolute;
            top: 2px;
            left: 2px;
            width: 20px;
            height: 20px;
            background: white;
            border-radius: 50%;
            transition: transform 0.2s;
          }
        }

        input:checked + .toggle {
          background: var(--ig-primary);

          &::after {
            transform: translateX(20px);
          }
        }
      }

      .modal-error {
        padding: var(--ig-spacing-sm);
        background: #ffebee;
        color: var(--ig-error);
        font-size: var(--ig-font-sm);
        text-align: center;
      }

      .spinner--small {
        width: 16px;
        height: 16px;
        border-width: 2px;
      }
    `,
  ],
})
export class UploadModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() uploaded = new EventEmitter<void>();
  @ViewChild("fileInput") fileInput!: ElementRef<HTMLInputElement>;

  step = signal<UploadStep>("select");
  isDragging = signal<boolean>(false);
  previewUrl = signal<string>("");
  aspectRatio = signal<"original" | "1:1" | "4:5" | "16:9">("1:1");
  uploading = signal<boolean>(false);
  error = signal<string>("");
  showAltText = signal<boolean>(false);
  showAdvanced = signal<boolean>(false);

  selectedFile: File | null = null;
  caption = "";
  altText = "";
  disableComments = false;
  hideLikes = false;

  constructor(private feedService: FeedService) {}

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains("modal-backdrop")) {
      this.close.emit();
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFile(input.files[0]);
    }
  }

  processFile(file: File): void {
    if (!file.type.startsWith("image/")) {
      this.error.set("Please select an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      this.error.set("File size must be less than 10MB");
      return;
    }

    this.selectedFile = file;
    this.previewUrl.set(URL.createObjectURL(file));
    this.step.set("edit");
    this.error.set("");
  }

  setAspectRatio(ratio: "original" | "1:1" | "4:5" | "16:9"): void {
    this.aspectRatio.set(ratio);
  }

  goBack(): void {
    const currentStep = this.step();
    if (currentStep === "edit") {
      this.step.set("select");
      this.selectedFile = null;
      this.previewUrl.set("");
    } else if (currentStep === "caption") {
      this.step.set("edit");
    }
  }

  nextStep(): void {
    const currentStep = this.step();
    if (currentStep === "edit") {
      this.step.set("caption");
    }
  }

  share(): void {
    if (!this.selectedFile) return;

    this.uploading.set(true);
    this.error.set("");

    this.feedService.createPost(this.selectedFile, this.caption).subscribe({
      next: () => {
        this.uploading.set(false);
        this.uploaded.emit();
        this.close.emit();
      },
      error: (err) => {
        this.uploading.set(false);
        this.error.set(
          err.error?.message || "Failed to upload. Please try again."
        );
      },
    });
  }
}
