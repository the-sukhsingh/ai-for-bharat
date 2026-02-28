"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn, extractYouTubeVideoId, fetchYouTubeThumbnail } from "@/lib/utils";
import { ImagePlus, Upload, Sparkles, Download, X, CheckCircle2, AlertCircle, Trash2, Calendar, Image, Loader2Icon, Check, Loader, Plus } from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useSession } from "next-auth/react";
import { FileUpload } from "@/components/ui/file-upload";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'

import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'


interface GeneratedImage {
  id: string;
  data: string;
  mimeType: string;
}

const templates = [
  { id: "1", name: "Template 1", path: "/1.jpg" },
  { id: "2", name: "Template 2", path: "/2.jpg" },
  { id: "3", name: "Template 3", path: "/3.jpg" },
];

const ThumbnailCreator = () => {
  const { data: session } = useSession();
  const [prompt, setPrompt] = useState("");
  const [mainImage, setMainImage] = useState<File | null>(null);
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [customTemplatePreview, setCustomTemplatePreview] = useState<string | null>(null);
  const [count, setCount] = useState(3);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [isLoadingThumbnail, setIsLoadingThumbnail] = useState(false);


  const handleFileUpload = (files: File[]) => {
    setMainImage(files[0]);
  };

  // Fetch user thumbnails
  const userThumbnails = useQuery(api.thumbnails.getUserThumbnails, { id: session?.user?.id as Id<"users"> || "none" as Id<"users"> }) || [];
  const deleteThumbnail = useMutation(api.thumbnails.deleteThumbnail);


  const handleReferenceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setReferenceImages((prev) => [...prev, ...files]);
  };


  const removeReferenceImage = (index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
  };



  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);

    try {
      const response = await fetch("/api/generate-thumbnail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          mainImage: mainImage ? await fileToBase64(mainImage) : null,
          referenceImages: await Promise.all(referenceImages.map(fileToBase64)),
          selectedTemplate: selectedTemplate === "custom" ? null : selectedTemplate,
          customTemplate: selectedTemplate === "custom" && customTemplatePreview ? customTemplatePreview : null,
          count,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate thumbnails");
      }

      const data = await response.json();
      setGeneratedImages(data.images);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate thumbnails");
    } finally {
      setIsGenerating(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const downloadImage = (image: GeneratedImage) => {
    const link = document.createElement("a");
    link.href = `data:${image.mimeType};base64,${image.data}`;
    link.download = `thumbnail-${image.id}.jpg`;
    link.click();
  };

  const handleDeleteThumbnail = async (thumbnailId: Id<"thumbnails">) => {
    try {
      await deleteThumbnail({ thumbnailId, id: session?.user?.id as Id<"users"> || "none" as Id<"users"> });
    } catch (err) {
      console.error("Failed to delete thumbnail:", err);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleAddYouTubeThumbnail = async () => {
    const videoId = extractYouTubeVideoId(youtubeUrl);
    if (!videoId) {
      setYoutubeError("Invalid YouTube URL");
      return;
    }
    setIsLoadingThumbnail(true);
    setYoutubeError(null);
    try {
      const thumbnail = await fetchYouTubeThumbnail(videoId);


      setReferenceImages((prev) => [...prev, thumbnail]);

      // // Add it to reference images
      // setReferenceImagePreviews((prev) => [...prev, thumbnail]);
      // setYoutubeUrl(""); // Clear the input
    }
    catch (err) {
      setYoutubeError("Failed to fetch YouTube thumbnail");
    }
    finally {
      setIsLoadingThumbnail(false);
    }
  };

  const handleThumbnailDownload = async (thumbnailUrl: string) => {
    // Get the image blob and download it
    const response = await fetch(thumbnailUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "thumbnail.jpg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full bg-background selection:bg-neutral-200 dark:selection:bg-neutral-800">
      {/* Left Sidebar */}
      <aside className="w-80 border-r border-border/40 flex flex-col bg-background/50 shrink-0">
        <div className="p-4 space-y-6">
          <h2 className="font-serif text-2xl font-medium tracking-tight">Thumbnails</h2>
        </div>

        <div className="flex-1 overflow-y-auto noscrollbar p-4 space-y-10">
          {/* Prompt Section */}
          <div className="space-y-3">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Prompt</h3>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter thumbnail description..."
              className="w-full h-32 resize-none bg-muted/30 border-border/40 focus:border-foreground/30 focus-visible:ring-0 shadow-none text-sm"
            />
          </div>

          {/* Style Template Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Style Template</h3>
              {selectedTemplate && (
                <button
                  onClick={() => {
                    setSelectedTemplate(null);
                    setCustomTemplatePreview(null);
                  }}
                  className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    if (selectedTemplate === template.id) {
                      setSelectedTemplate(null);
                    } else
                      setSelectedTemplate(template.id);
                    setCustomTemplatePreview(null);
                  }}
                  className={cn(
                    "relative aspect-video rounded-md overflow-hidden border transition-all",
                    selectedTemplate === template.id
                      ? "border-foreground ring-1 ring-foreground"
                      : "border-border/40 hover:border-foreground/50 opacity-80 hover:opacity-100",
                  )}
                >
                  <img
                    src={template.path}
                    alt={template.name}
                    className="w-full h-full object-cover"
                  />
                  {
                    selectedTemplate === template.id && (
                      <div className="absolute inset-0 bg-background/20 backdrop-blur-[1px] flex justify-center items-center">
                        <div className="w-5 h-5 bg-foreground rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-background" />
                        </div>
                      </div>
                    )
                  }
                </button>
              ))}
            </div>
          </div>

          {/* Reference Image Section */}
          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold border-b border-border/40 pb-2">Reference Content</h3>

            {/* Youtube Video */}
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground font-mono">From YouTube</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => {
                    setYoutubeUrl(e.target.value);
                    setYoutubeError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isLoadingThumbnail) {
                      handleAddYouTubeThumbnail();
                    }
                  }}
                  placeholder="Paste URL..."
                  className="flex-1 px-3 py-2 text-sm bg-muted/30 border border-border/40 rounded-md focus:outline-none focus:border-foreground/30 placeholder:text-muted-foreground/50"
                  disabled={isLoadingThumbnail}
                />
                <button
                  onClick={handleAddYouTubeThumbnail}
                  disabled={isLoadingThumbnail || !youtubeUrl.trim()}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center shrink-0 border",
                    isLoadingThumbnail || !youtubeUrl.trim()
                      ? "bg-muted/50 border-border/40 text-muted-foreground/50 cursor-not-allowed"
                      : "bg-foreground border-foreground text-background hover:bg-foreground/90",
                  )}
                  title="Add YouTube thumbnail"
                >
                  {isLoadingThumbnail ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </button>
              </div>
              {youtubeError && (
                <p className="text-[10px] text-destructive mt-1 underline decoration-destructive/50 underline-offset-2">{youtubeError}</p>
              )}
            </div>

            {/* Reference Image Previews */}
            <div className="space-y-2 pt-2">
              <p className="text-[11px] text-muted-foreground font-mono">Upload Images</p>
              <div className="grid grid-cols-4 gap-2">
                <label className="aspect-square flex items-center justify-center border border-dashed border-border/60 rounded-md hover:border-foreground/50 hover:bg-muted/30 transition-colors cursor-pointer text-muted-foreground hover:text-foreground">
                  <Plus className="h-5 w-5" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleReferenceImageUpload}
                    className="hidden"
                  />
                </label>
                {referenceImages.map((preview, index) => (
                  <div
                    key={index}
                    className="relative aspect-square rounded-md overflow-hidden border border-border/40 group"
                  >
                    <img
                      src={typeof preview === "string" ? preview : URL.createObjectURL(preview)}
                      alt={`Reference ${index + 1}`}
                      className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300"
                    />
                    <button
                      onClick={() => removeReferenceImage(index)}
                      className="absolute top-1 right-1 bg-background/80 hover:bg-foreground text-foreground hover:text-background backdrop-blur-sm rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                      title="Remove image"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background/95 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8 lg:p-12 noscrollbar">
          <div className="max-w-4xl mx-auto space-y-16">

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive" className="rounded-none border-l-2 border-l-destructive bg-destructive/5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs font-mono">{error}</AlertDescription>
              </Alert>
            )}

            {/* Generate Section */}
            <div className="space-y-0 ">
              <div className="rounded-xl p-1 ">
                <FileUpload onChange={handleFileUpload} />
              </div>

              {/* Generate Button */}
              {!isGenerating  && (
                <div className="flex justify-center pt-4">
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim()}
                    className="h-12 px-8 rounded-full text-sm font-medium tracking-wide shadow-none"
                    size="lg"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Images
                  </Button>
                </div>
              )}
            </div>

            {/* Generated Images Section */}
            {(isGenerating || generatedImages.length > 0) && (
              <div className="space-y-6 pt-4 border-t border-border/40">
                <h3 className="font-serif text-2xl tracking-tight">Generated Results</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      className="group relative border border-border/40 rounded-xl overflow-hidden bg-muted/20 aspect-video flex-1"
                    >
                      {isGenerating ? (
                        <div className="w-full h-full animate-pulse bg-muted/50 flex flex-col items-center justify-center gap-3">
                          <Loader2Icon className="w-5 h-5 text-muted-foreground animate-spin" />
                          <span className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground">Processing</span>
                        </div>
                      ) : generatedImages[index] ? (
                        <>
                          <img
                            src={`data:${generatedImages[index].mimeType};base64,${generatedImages[index].data}`}
                            alt={`Generated ${index + 1}`}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full bg-background text-foreground hover:bg-foreground hover:text-background border-border/60"
                              onClick={() => downloadImage(generatedImages[index])}
                            >
                              <Download className="w-3.5 h-3.5 mr-2" />
                              Download
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-border/30 m-2 rounded-lg text-muted-foreground/30">
                          <ImagePlus className="w-6 h-6 mb-2" />
                          <span className="text-[10px] uppercase tracking-widest">Slot {index + 1}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Previous Thumbnails Section */}
            <div className="pt-16 border-t border-border/40">
              <h3 className="font-serif text-2xl tracking-tight mb-8">Previous Thumbnails</h3>

              {userThumbnails.length === 0 ? (
                <div className="py-12 border border-dashed border-border/40 rounded-xl flex flex-col items-center justify-center bg-muted/10">
                  <Image className="w-8 h-8 opacity-50 mb-3" />
                  <p className="text-sm text-muted-foreground font-medium">No history found</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Your generated thumbnails will appear here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {userThumbnails.map((thumbnail) => (
                    <div
                      key={thumbnail._id}
                      className="group relative rounded-xl overflow-hidden border border-border/40 bg-card hover:border-foreground/30 transition-all duration-300"
                    >
                      {thumbnail.imageUrl ? (
                        <>
                          <img
                            src={thumbnail.imageUrl}
                            alt={thumbnail.prompt}
                            className="w-full aspect-video object-cover"
                          />

                          {/* Desktop Hove Overlay */}
                          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-background/90 via-background/20 to-transparent p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300 flex items-end justify-between">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-full bg-background text-foreground border-none shadow-sm"
                              onClick={() => {
                                if (thumbnail.imageUrl) {
                                  handleThumbnailDownload(thumbnail.imageUrl);
                                }
                              }}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </Button>

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full bg-background text-foreground border-none shadow-sm">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="rounded-2xl border-border/40">
                                <DialogHeader>
                                  <DialogTitle className="font-serif text-xl font-light">Delete Thumbnail?</DialogTitle>
                                  <DialogDescription className="text-sm">
                                    This action cannot be undone. Are you sure you want to delete this thumbnail from your history?
                                  </DialogDescription>
                                </DialogHeader>
                                <DialogFooter className="mt-4">
                                  <DialogClose asChild>
                                    <Button variant="outline" className="rounded-full shadow-none border-border/60">Cancel</Button>
                                  </DialogClose>
                                  <Button className="rounded-full shadow-none bg-foreground text-background hover:bg-foreground/90" onClick={() => {
                                    handleDeleteThumbnail(thumbnail._id);
                                  }}>Delete</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </>
                      ) : (
                        <div className="w-full aspect-video flex items-center justify-center bg-muted/20">
                          <Loader2Icon className="w-5 h-5 text-muted-foreground animate-spin" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ThumbnailCreator;