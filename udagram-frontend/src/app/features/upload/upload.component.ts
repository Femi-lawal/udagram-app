import {
  Component,
  signal,
  inject,
  ViewChild,
  ElementRef,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { FeedService } from "../../core/services/feed.service";

@Component({
  selector: "app-upload",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="upload-page">
      <div class="upload-container">
        <div class="upload-header">
          <button class="btn btn--icon" routerLink="/">
            <span class="material-icons">arrow_back</span>
          </button>
          <h1>Create new post</h1>
          <button
            class="btn btn--text"
            [disabled]="!selectedFile() || uploading()"
            (click)="submit()"
          >
            {{ uploading() ? "Sharing..." : "Share" }}
          </button>
        </div>

        <div class="upload-content">
          @if (!selectedFile()) {
          <!-- Upload Area -->
          <div
            class="upload-dropzone"
            [class.upload-dropzone--dragover]="isDragOver()"
            (dragover)="onDragOver($event)"
            (dragleave)="onDragLeave()"
            (drop)="onDrop($event)"
            (click)="fileInput.click()"
          >
            <span class="material-icons upload-dropzone__icon"
              >add_photo_alternate</span
            >
            <h2>Drag photos here</h2>
            <p class="text-secondary">or click to select from your computer</p>
            <button class="btn btn--primary upload-dropzone__btn">
              Select from computer
            </button>
            <input
              #fileInput
              type="file"
              accept="image/*"
              (change)="onFileSelected($event)"
              hidden
            />
          </div>
          } @else {
          <!-- Preview and Edit -->
          <div class="upload-preview">
            <div class="upload-preview__image">
              <img [src]="previewUrl()" alt="Preview" />
              <button class="upload-preview__remove" (click)="removeFile()">
                <span class="material-icons">close</span>
              </button>
            </div>

            <div class="upload-preview__details">
              <div class="upload-preview__user">
                <img [src]="userAvatar" class="avatar" alt="" />
                <span class="upload-preview__username">{{ userName }}</span>
              </div>

              <textarea
                class="upload-caption"
                [(ngModel)]="caption"
                placeholder="Write a caption..."
                maxlength="2200"
                rows="6"
              ></textarea>

              <div class="upload-caption__count">
                {{ caption.length }}/2,200
              </div>

              <div class="upload-options">
                <div class="upload-option" (click)="toggleLocation()">
                  <span>Add location</span>
                  <span class="material-icons">location_on</span>
                </div>

                @if (showLocationInput()) {
                <input
                  type="text"
                  class="upload-location-input"
                  [(ngModel)]="location"
                  placeholder="Enter location..."
                />
                }

                <div class="upload-option">
                  <span>Accessibility</span>
                  <span class="material-icons">chevron_right</span>
                </div>

                <div class="upload-option">
                  <span>Advanced settings</span>
                  <span class="material-icons">chevron_right</span>
                </div>
              </div>
            </div>
          </div>
          }
        </div>

        @if (error()) {
        <div class="upload-error">
          <span class="material-icons">error</span>
          {{ error() }}
        </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .upload-page {
        min-height: 100vh;
        background-color: var(--ig-light);
        padding: var(--ig-spacing-xl) var(--ig-spacing-md);
      }

      .upload-container {
        max-width: 800px;
        margin: 0 auto;
        background: var(--ig-white);
        border-radius: var(--ig-radius-lg);
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      .upload-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--ig-spacing-md);
        border-bottom: 1px solid var(--ig-border);

        h1 {
          font-size: var(--ig-font-md);
          font-weight: 600;
        }

        .btn--text {
          color: var(--ig-primary);
          font-weight: 600;

          &:disabled {
            opacity: 0.3;
          }
        }
      }

      .upload-content {
        min-height: 400px;
      }

      .upload-dropzone {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 400px;
        cursor: pointer;
        transition: background-color 0.2s;

        &:hover {
          background-color: var(--ig-light);
        }

        &--dragover {
          background-color: rgba(0, 149, 246, 0.1);
          border: 2px dashed var(--ig-primary);
        }

        &__icon {
          font-size: 80px;
          color: var(--ig-dark);
          margin-bottom: var(--ig-spacing-md);
        }

        h2 {
          font-size: var(--ig-font-lg);
          font-weight: 300;
          margin-bottom: var(--ig-spacing-sm);
        }

        p {
          margin-bottom: var(--ig-spacing-lg);
        }

        &__btn {
          padding: var(--ig-spacing-sm) var(--ig-spacing-md);
        }
      }

      .upload-preview {
        display: flex;

        @media (max-width: 614px) {
          flex-direction: column;
        }

        &__image {
          flex: 1;
          position: relative;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 400px;

          img {
            max-width: 100%;
            max-height: 500px;
            object-fit: contain;
          }
        }

        &__remove {
          position: absolute;
          top: var(--ig-spacing-md);
          right: var(--ig-spacing-md);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.6);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: none;

          &:hover {
            background: rgba(0, 0, 0, 0.8);
          }
        }

        &__details {
          flex: 0 0 340px;
          border-left: 1px solid var(--ig-border);

          @media (max-width: 614px) {
            flex: none;
            border-left: none;
            border-top: 1px solid var(--ig-border);
          }
        }

        &__user {
          display: flex;
          align-items: center;
          gap: var(--ig-spacing-sm);
          padding: var(--ig-spacing-md);
          border-bottom: 1px solid var(--ig-border);
        }

        &__username {
          font-weight: 600;
        }
      }

      .upload-caption {
        width: 100%;
        border: none;
        padding: var(--ig-spacing-md);
        font-size: var(--ig-font-md);
        font-family: inherit;
        resize: none;

        &:focus {
          outline: none;
        }

        &__count {
          padding: 0 var(--ig-spacing-md) var(--ig-spacing-sm);
          font-size: var(--ig-font-xs);
          color: var(--ig-secondary);
          text-align: right;
          border-bottom: 1px solid var(--ig-border);
        }
      }

      .upload-options {
        padding: var(--ig-spacing-sm) 0;
      }

      .upload-option {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--ig-spacing-md);
        cursor: pointer;

        &:hover {
          background: var(--ig-light);
        }

        .material-icons {
          color: var(--ig-secondary);
        }
      }

      .upload-location-input {
        width: calc(100% - 32px);
        margin: 0 var(--ig-spacing-md) var(--ig-spacing-md);
        padding: var(--ig-spacing-sm);
        border: 1px solid var(--ig-border);
        border-radius: var(--ig-radius-sm);
        font-size: var(--ig-font-sm);

        &:focus {
          outline: none;
          border-color: var(--ig-primary);
        }
      }

      .upload-error {
        display: flex;
        align-items: center;
        gap: var(--ig-spacing-sm);
        padding: var(--ig-spacing-md);
        background: var(--ig-error);
        color: white;

        .material-icons {
          font-size: 20px;
        }
      }
    `,
  ],
})
export class UploadComponent {
  private feedService = inject(FeedService);
  private router = inject(Router);
  @ViewChild("fileInput") fileInput!: ElementRef<HTMLInputElement>;

  selectedFile = signal<File | null>(null);
  previewUrl = signal<string>("");
  isDragOver = signal<boolean>(false);
  showLocationInput = signal<boolean>(false);
  uploading = signal<boolean>(false);
  error = signal<string>("");

  caption = "";
  location = "";

  userAvatar = "https://i.pravatar.cc/150?u=user";
  userName = "user";

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(): void {
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onFileSelected(event: Event): void {
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
      this.error.set("Image must be less than 10MB");
      return;
    }

    this.error.set("");
    this.selectedFile.set(file);

    const reader = new FileReader();
    reader.onload = () => {
      this.previewUrl.set(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  removeFile(): void {
    this.selectedFile.set(null);
    this.previewUrl.set("");
    this.caption = "";
    this.location = "";
    if (this.fileInput) {
      this.fileInput.nativeElement.value = "";
    }
  }

  toggleLocation(): void {
    this.showLocationInput.update((v) => !v);
  }

  submit(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.uploading.set(true);
    this.error.set("");

    this.feedService.createPost(file, this.caption).subscribe({
      next: (post) => {
        this.uploading.set(false);
        this.router.navigate(["/post", post.id]);
      },
      error: (err) => {
        this.uploading.set(false);
        this.error.set(err.error?.message || "Failed to upload post");
      },
    });
  }
}
