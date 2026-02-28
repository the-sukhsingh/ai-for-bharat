"use client";

import React, { useState, useRef } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Upload, X, ImageIcon } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

interface ImageUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: Id<"users">;
  draftId: Id<"contentDrafts">;
  currentImageUrl?: string | null;
  onImageUpdated?: () => void;
}

export function ImageUploadDialog({
  open,
  onOpenChange,
  userId,
  draftId,
  currentImageUrl,
  onImageUpdated,
}: ImageUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.ai_tools.generateUploadUrl);
  const updateImageStorageId = useMutation(api.contentDrafts.updateImageStorageId);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image size must be less than 10MB');
      return;
    }

    setError(null);
    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      setError(null);

      // Step 1: Get upload URL
      const uploadUrl = await generateUploadUrl();

      // Step 2: Upload the file
      const uploadResult = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': selectedFile.type },
        body: selectedFile,
      });

      if (!uploadResult.ok) {
        throw new Error('Failed to upload image');
      }

      const { storageId } = await uploadResult.json();

      // Step 3: Update the draft with new storage ID
      await updateImageStorageId({
        userId,
        draftId,
        imageStorageId: storageId as Id<"_storage">,
      });

      // Success - close dialog and reset state
      setSelectedFile(null);
      setPreviewUrl(null);
      onOpenChange(false);
      onImageUpdated?.();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!uploading) {
      onOpenChange(open);
      if (!open) {
        handleRemoveFile();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-125 ">
        <DialogHeader>
          <DialogTitle>
            {currentImageUrl ? 'Change Image' : 'Upload Image'}
          </DialogTitle>
          <DialogDescription>
            {currentImageUrl
              ? 'Upload a new image to replace the current one'
              : 'Upload an image for this post'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          {/* Upload Area */}
          {!previewUrl && !currentImageUrl && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 hover:border-muted-foreground/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="h-8 w-8" />
                <p className="text-sm font-medium">Click to upload image</p>
                <p className="text-xs">PNG, JPG, GIF up to 10MB</p>
              </div>
            </button>
          )}

          {/* Current Image Preview */}
          {currentImageUrl && !previewUrl && (
            <div className="space-y-3">
              <div className="text-sm font-medium">Current Image</div>
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
                <img
                  src={currentImageUrl}
                  alt="Current"
                  className="object-cover w-full h-full"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full"
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                Select New Image
              </Button>
            </div>
          )}

          {/* New Image Preview */}
          {previewUrl && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">New Image</div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {selectedFile?.name} ({(selectedFile!.size / 1024).toFixed(1)} KB)
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleDialogClose(false)}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
          >
            {uploading ? (
              <>
                <Spinner className="mr-2" />
                Uploading...
              </>
            ) : (
              'Upload'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
