"use client";

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useContentDraft } from '@/context/ContentDraftContext';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, Copy, Check, Share2, PlusIcon, Upload, ImageIcon, Clock, Download, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { Id } from '../../../../convex/_generated/dataModel';
import Chatbot from '@/components/chat/Chatbot';
import Markdown from 'react-markdown';
import { Spinner } from '@/components/ui/spinner';
import { PublishDialog } from '@/components/post/PublishDialog';
import { ImageUploadDialog } from '@/components/post/ImageUploadDialog';
import TwitterView from '@/components/preview/TwitterView';
import LinkedinView from '@/components/preview/LinkedinView';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';



const Page = () => {
  const { user } = useAuth();
  const {
    selectedDraftId,
    setSelectedDraftId,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    copiedId,
    setCopiedId,
    selectedConversationId,
    setSelectedConversationId
  } = useContentDraft();

  const [sidebarTab, setSidebarTab] = useState<"drafts" | "posts" | "scheduled">("drafts");

  const contentDrafts = useQuery(
    api.contentDrafts.getUserContentDrafts,
    user?._id ? { userId: user._id } : "skip"
  );

  const allScheduledPosts = useQuery(
    api.scheduledPosts.getUserScheduledPosts,
    user?._id ? { userId: user._id, status: "pending" } : "skip"
  );

  const publishLogs = useQuery(
    api.publishLogs.getUserPublishLogs,
    user?._id ? { userId: user._id, limit: 100 } : "skip"
  );

  const socialAccounts = useQuery(
    api.users.getSocialAccounts,
    user?._id ? { userId: user._id } : "skip"
  );

  // Get X account subscription type for proper character limit in preview
  const xAccount = socialAccounts?.find(acc => acc.platform === 'x' && acc.isActive);
  const xAccountSubType = xAccount?.subType;

  const [imageUploadDialogOpen, setImageUploadDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Inline editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editPlatforms, setEditPlatforms] = useState<{ platform: 'twitter' | 'linkedin' | 'blog', content: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Preview Inline Editing State
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [inlineContents, setInlineContents] = useState<Record<string, string>>({});
  const [isSavingInline, setIsSavingInline] = useState(false);


  const selectedDraft = useMemo(() =>
    contentDrafts?.find(d => d._id === selectedDraftId),
    [contentDrafts, selectedDraftId]
  );

  const updateDraft = useMutation(api.contentDrafts.updateContentDraft);
  const createDraft = useMutation(api.contentDrafts.createContentDraft);
  const removeImage = useMutation(api.contentDrafts.removeImage);

  // Initialize activeTab when a draft is selected
  React.useEffect(() => {
    if (selectedDraft && selectedDraft.platforms.length > 0) {
      setActiveTab(selectedDraft.platforms[0].platform);

      const newContents: Record<string, string> = {};
      selectedDraft.platforms.forEach(p => {
        newContents[p.platform] = p.content;
      });
      setInlineContents(newContents);
      setIsInlineEditing(false);
    }
  }, [selectedDraft, setActiveTab]);

  const filteredDrafts = useMemo(() => {
    if (!contentDrafts) return [];
    return contentDrafts.filter(draft =>
      draft.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [contentDrafts, searchQuery]);

  const filteredScheduledPosts = useMemo(() => {
    if (!allScheduledPosts || !contentDrafts) return [];
    return allScheduledPosts
      .map(sp => ({
        ...sp,
        draft: contentDrafts.find(d => d._id === sp.draftId)
      }))
      .filter(item =>
        item.draft?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [allScheduledPosts, contentDrafts, searchQuery]);

  const filteredPublishLogs = useMemo(() => {
    if (!publishLogs || !contentDrafts) return [];
    return publishLogs
      .filter(log => log.status === "success" && log.draftId)
      .map(log => ({
        ...log,
        draft: contentDrafts.find(d => d._id === log.draftId)
      }))
      .filter(item =>
        item.draft?.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [publishLogs, contentDrafts, searchQuery]);

  const hasScheduledPost = (draftId: Id<"contentDrafts">) => {
    return allScheduledPosts?.some(sp => sp.draftId === draftId && sp.status === "pending") || false;
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getPlatformContent = (platform: string) => {
    if (!selectedDraft) return null;
    return selectedDraft.platforms.find(p => p.platform === platform);
  };

  const imageUrl = useQuery(
    api.ai_tools.getStorageUrl,
    selectedDraft?.imageStorageId ? { storageId: selectedDraft.imageStorageId } : "skip"
  );

  const addPlatform = useMutation(api.contentDrafts.addPlatform);



  const handleImageUpdated = () => {
    // Image updated successfully, the query will automatically refresh
  };

  const handleImageRemove = async () => {
    if (!user || !selectedDraft) return;
    try {
      await removeImage({
        userId: user._id as Id<"users">,
        draftId: selectedDraft._id
      });
    } catch (error) {
      console.error('Failed to remove image:', error);
    }
  };

  const handleCreateNewPost = () => {
    setSelectedDraftId(null);
    setEditTitle('');
    setEditPlatforms([
      { platform: 'twitter', content: '' },
      { platform: 'linkedin', content: '' }
    ]);
    setIsEditing(true);
  };

  const handleEditPost = () => {
    if (selectedDraft) {
      setEditTitle(selectedDraft.title);
      setEditPlatforms([...selectedDraft.platforms]);
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle('');
    setEditPlatforms([]);
  };

  const handleEditContentChange = (platform: string, content: string) => {
    setEditPlatforms(prev => prev.map(p =>
      p.platform === platform ? { ...p, content } : p
    ));
  };

  const handleSaveEdit = async () => {
    if (!user || !editTitle.trim() || editPlatforms.every(p => !p.content.trim())) {
      return;
    }

    setIsSaving(true);
    try {
      if (selectedDraft) {
        await updateDraft({
          userId: user._id as Id<"users">,
          draftId: selectedDraft._id,
          title: editTitle.trim(),
          platforms: editPlatforms.filter(p => p.content.trim())
        });
      } else {
        await createDraft({
          userId: user._id as Id<"users">,
          title: editTitle.trim(),
          originalIdea: editPlatforms[0]?.content.substring(0, 100) || editTitle,
          platforms: editPlatforms.filter(p => p.content.trim())
        });
      }
      setIsEditing(false);
      setEditTitle('');
      setEditPlatforms([]);
    } catch (error) {
      console.error('Failed to save draft:', error);
    } finally {
      setIsSaving(false);
    }
  };


  const handleSaveInlineEdit = async () => {
    if (!user || !selectedDraft) return;
    setIsSavingInline(true);
    try {
      const updatedPlatforms = selectedDraft.platforms.map(p => ({
        ...p,
        content: inlineContents[p.platform] ?? p.content
      }));

      await updateDraft({
        userId: user._id as Id<"users">,
        draftId: selectedDraft._id,
        title: selectedDraft.title,
        platforms: updatedPlatforms
      });
      setIsInlineEditing(false);
    } catch (error) {
      console.error('Failed to save inline edits:', error);
    } finally {
      setIsSavingInline(false);
    }
  };



  return (
    <>
      <div className="flex h-[calc(100vh-4rem)] w-full bg-background selection:bg-neutral-200 dark:selection:bg-neutral-800">
        {/* Sidebar - 1 part */}
        <aside className="w-80 border-r border-border/40 flex flex-col bg-background/50 shrink-0">
          <div className="p-4 space-y-6 border-b border-border/40">
            <div className="flex items-center justify-between">
              <h1 className="font-serif text-2xl font-medium tracking-tight">Posts</h1>
              <Button
                onClick={handleCreateNewPost}
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full shadow-none"
              >
                <PlusIcon className="h-4 w-4" />
              </Button>
            </div>

            <Tabs value={sidebarTab} onValueChange={(v) => setSidebarTab(v as "drafts" | "posts" | "scheduled")} className="w-full">
              <TabsList className="w-full grid grid-cols-3 bg-transparent p-0 h-auto rounded-none border-border/40 gap-1 pb-1">
                <TabsTrigger value="drafts" className="rounded-none data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none border border-transparent py-1.5 text-[10px] uppercase font-mono tracking-wider transition-all">Drafts</TabsTrigger>
                <TabsTrigger value="posts" className="rounded-none data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none border border-transparent py-1.5 text-[10px] uppercase font-mono tracking-wider transition-all">Published</TabsTrigger>
                <TabsTrigger value="scheduled" className="rounded-none data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none border border-transparent py-1.5 text-[10px] uppercase font-mono tracking-wider transition-all">Scheduled</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground transition-colors group-focus-within:text-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="pl-9 h-9 bg-muted/30 border-none shadow-none focus-visible:ring-1 focus-visible:ring-border rounded-full text-xs"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto noscrollbar pb-4">
            {sidebarTab === "drafts" ? (
              // All Drafts
              <div className="flex flex-col">
                {filteredDrafts && filteredDrafts.length > 0 ? (
                  filteredDrafts.map((draft) => (
                    <button
                      key={draft._id}
                      onClick={() => {
                        setSelectedDraftId(draft._id);
                        setIsEditing(false);
                        setIsInlineEditing(false);

                      }}
                      className={`w-full p-4 text-left transition-all duration-200 border-b border-border/20 ${selectedDraftId === draft._id ? 'bg-muted/80' : 'hover:bg-muted/40'
                        }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-medium line-clamp-2 leading-snug flex-1">
                            {draft.title}
                          </h3>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex gap-1.5 flex-wrap">
                            {draft.platforms.map(p => (
                              <span key={p.platform} className="text-[9px] px-1.5 py-0.5 rounded-full border border-border/60 text-muted-foreground shrink-0 uppercase tracking-widest bg-muted/50">
                                {p.platform}
                              </span>
                            ))}
                          </div>
                          <p className="text-[10px] uppercase font-mono text-muted-foreground">
                            {format(new Date(draft.updatedAt), 'MMM d')}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No drafts yet. Create your first post!
                  </div>
                )}
              </div>
            ) : sidebarTab === "posts" ? (
              // Published Posts
              <div className="flex flex-col">
                {filteredPublishLogs && filteredPublishLogs.length > 0 ? (
                  filteredPublishLogs.map((log) => (
                    <button
                      key={log._id}
                      onClick={() => log.draftId && setSelectedDraftId(log.draftId)}
                      className={`w-full p-4 text-left transition-all duration-200 border-b border-border/20 ${selectedDraftId === log.draftId ? 'bg-muted/80' : 'hover:bg-muted/40'
                        }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-medium line-clamp-2 leading-snug flex-1">
                            {log.draft?.title || 'Untitled'}
                          </h3>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-foreground text-background shrink-0 uppercase font-mono tracking-widest">
                            {log.platform}
                          </span>
                          <p className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 uppercase">
                            <span>{format(new Date(log.publishedAt), 'MMM d')}</span>
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No published posts yet
                  </div>
                )}
              </div>
            ) : (
              // Scheduled Posts
              <div className="flex flex-col">
                {filteredScheduledPosts && filteredScheduledPosts.length > 0 ? (
                  filteredScheduledPosts.map((scheduled) => (
                    <button
                      key={scheduled._id}
                      onClick={() => setSelectedDraftId(scheduled.draftId)}
                      className={`w-full p-4 text-left transition-all duration-200 border-b border-border/20 ${selectedDraftId === scheduled.draftId ? 'bg-muted/80' : 'hover:bg-muted/40'
                        }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-medium line-clamp-2 leading-snug flex-1">
                            {scheduled.draft?.title || 'Untitled'}
                          </h3>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-border/60 text-muted-foreground shrink-0 uppercase tracking-widest bg-muted/50">
                            {scheduled.platform}
                          </span>
                          <p className="text-[10px] font-mono uppercase text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            <span>{format(new Date(scheduled.scheduledFor), 'MMM d, h:mm a')}</span>
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No scheduled posts
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* View Area - 2.5 parts */}
        <main className="flex-1 flex flex-col min-w-0 bg-background/95 relative overflow-hidden">
          {isEditing ? (
            // Inline Edit Mode
            <>
              <div className="sticky top-0 z-10 bg-card/50 backdrop-blur-md border-b border-border/40">
                <div className="flex items-center justify-between p-4">
                  <h2 className="font-serif text-xl tracking-tight">
                    {selectedDraft ? 'Edit Post' : 'Create New Post'}
                  </h2>
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 rounded-full shadow-none text-xs px-4"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 rounded-full shadow-none text-xs px-6"
                      onClick={handleSaveEdit}
                      disabled={isSaving || !editTitle.trim()}
                    >
                      {isSaving ? (
                        <>
                          <Spinner className="mr-2 h-3 w-3" />
                          Saving
                        </>
                      ) : (
                        'Save'
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 noscrollbar">
                <div className="max-w-2xl mx-auto space-y-10">
                  {/* Title Input */}
                  <div className="space-y-3">
                    <Label htmlFor="edit-title" className="text-xs uppercase tracking-widest text-muted-foreground">Title</Label>
                    <Input
                      id="edit-title"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Enter post title"
                      className="text-xl font-sans border-none shadow-none focus-visible:ring-0 px-0 h-auto placeholder:text-muted-foreground/30 bg-transparent rounded-none border-b border-border"
                    />
                  </div>

                  {/* Platform Content Tabs */}
                  <div className="space-y-4">
                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">Content</Label>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                      <TabsList className="w-fit bg-transparent gap-2 p-0 h-auto" variant={"line"}>
                        {editPlatforms.map(p => (
                          <TabsTrigger
                            key={p.platform}
                            value={p.platform}
                            className="capitalize data-[state=active]:bg-foreground data-[state=active]:text-primary px-2 py-1.5 shadow-none text-xs"
                          >
                            {p.platform}
                          </TabsTrigger>
                        ))}
                      </TabsList>

                      {editPlatforms.map(p => (
                        <TabsContent key={p.platform} value={p.platform} className="mt-6">
                          <div className="space-y-4">
                            <Textarea
                              value={p.content}
                              onChange={(e) => handleEditContentChange(p.platform, e.target.value)}
                              placeholder={`Write your ${p.platform} post...`}
                              rows={15}
                              className="resize-none font-mono text-sm leading-relaxed p-6 bg-muted/20 border-border/30 rounded-xl shadow-inner focus-visible:ring-1 focus-visible:ring-border"
                            />
                            <div className="flex justify-between items-center text-[11px] font-mono text-muted-foreground uppercase tracking-widest px-2">
                              <span>{p.content.length} chars</span>
                              {p.platform === 'twitter' && (
                                <span className={p.content.length > 280 ? 'text-destructive font-bold' : ''}>
                                  {280 - p.content.length} left
                                </span>
                              )}
                            </div>
                          </div>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </div>
                </div>
              </div>
            </>
          ) : selectedDraft ? (
            <>
              <div className="sticky top-0 z-10 bg-card/60 backdrop-blur-md border-b border-border/40">
                <div className="flex items-center justify-between p-3 px-6">
                  <Tabs value={activeTab} onValueChange={setActiveTab} >
                    <TabsList className="h-9 rounded-full bg-transparent p-0 gap-1.5" variant={"line"}>
                      {selectedDraft.platforms.map((p) => (
                        <TabsTrigger
                          key={p.platform}
                          value={p.platform}
                          className="capitalize text-xs rounded-full border border-transparent data-[state=active]:bg-foreground data-[state=active]:text-primary data-[state=active]:shadow-none px-2 py-1 transition-all"
                        >
                          {p.platform}
                        </TabsTrigger>
                      ))}

                      {/* Show it only if platforms length is less than 3 */}

                      {(['twitter', 'linkedin', 'blog'] as const)
                        .filter((p) => !selectedDraft.platforms.some((ep) => ep.platform === p))
                        .map((platform) => (
                          <Button
                            key={platform}
                            variant="outline"
                            size="sm"
                            className="rounded-full h-7 text-xs shadow-none border-dashed border-border/60 ml-2"
                            aria-label={`Add ${platform}`}
                            onClick={() => {
                              if (!user) return;
                              const existingContent = selectedDraft.platforms.find(p => p.platform === activeTab)?.content
                                || selectedDraft.platforms[0]?.content
                                || selectedDraft.originalIdea
                                || '';

                              addPlatform({
                                draftId: selectedDraft._id,
                                platform: {
                                  platform: platform,
                                  content: existingContent
                                },
                                userId: user._id as Id<"users">
                              });

                              setActiveTab(platform);
                              setInlineContents(prev => ({
                                ...prev,
                                [platform]: existingContent
                              }));
                            }}
                          >
                            <PlusIcon className="w-3 h-3 mr-1" />
                            Add {platform}
                          </Button>
                        ))}
                    </TabsList>
                  </Tabs>
                  <div className="flex items-center gap-2">

                    {/* Cancel Button */}
                    {isInlineEditing && (
                      <Button
                        variant={"ghost"}
                        size="sm"
                        className="h-8 rounded-full shadow-none text-xs px-4"
                        onClick={() => {
                          setIsInlineEditing(false);
                          if (selectedDraft) {
                            const newContents: Record<string, string> = {};
                            selectedDraft.platforms.forEach(p => {
                              newContents[p.platform] = p.content;
                            });
                            setInlineContents(newContents);
                          }
                        }}
                      >
                        Cancel
                      </Button>
                    )}

                    <Button
                      variant={isInlineEditing ? "default" : "outline"}
                      size="sm"
                      className="h-8 rounded-full shadow-none text-xs px-4 border-border/60"
                      onClick={() => {
                        if (isInlineEditing) {
                          handleSaveInlineEdit();
                        } else {
                          setIsInlineEditing(true);
                        }
                      }}
                      disabled={isSavingInline}
                    >
                      {isSavingInline && <Spinner className="h-3 w-3 mr-1.5" />}
                      {isInlineEditing ? "Save Edits" : "Edit"}
                    </Button>

                    <div className="w-px h-4 bg-border/40 mx-1"></div>

                    <PublishDialog userId={user?._id as Id<"users">} draftId={selectedDraft._id} platforms={selectedDraft.platforms} />

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full shadow-none"
                      onClick={() => {
                        const content = getPlatformContent(activeTab);
                        if (content) handleCopy(content.content, activeTab);
                      }}
                    >
                      {copiedId === activeTab ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 lg:p-12 noscrollbar">
                {/* Platform Preview */}
                {selectedDraft.platforms.map((platformData) => (
                  <div
                    key={platformData.platform}
                    className={activeTab === platformData.platform ? 'block' : 'hidden'}
                  >
                    <div className="max-w-2xl mx-auto">
                      {/* Render platform-specific preview */}
                      {platformData.platform === 'twitter' ? (
                        <TwitterView
                          content={inlineContents['twitter'] ?? platformData.content}
                          imageUrl={imageUrl}
                          timestamp={selectedDraft.createdAt}
                          authorName={user?.name}
                          accountSubType={xAccountSubType}
                          isEditable={isInlineEditing}
                          onChange={(val) => setInlineContents(prev => ({ ...prev, twitter: val }))}
                          onImageUpload={() => setImageUploadDialogOpen(true)}
                          onImageRemove={handleImageRemove}
                        />
                      ) : platformData.platform === 'linkedin' ? (
                        <LinkedinView
                          content={inlineContents['linkedin'] ?? platformData.content}
                          imageUrl={imageUrl}
                          timestamp={selectedDraft.createdAt}
                          authorName={user?.name}
                          isEditable={isInlineEditing}
                          onChange={(val) => setInlineContents(prev => ({ ...prev, linkedin: val }))}
                          onImageUpload={() => setImageUploadDialogOpen(true)}
                          onImageRemove={handleImageRemove}
                        />
                      ) : (
                        <div className="prose max-w-none">
                          {isInlineEditing ? (
                            <Textarea
                              value={inlineContents[platformData.platform] ?? platformData.content}
                              onChange={(e) => {
                                const val = e.target.value;
                                setInlineContents(prev => ({ ...prev, [platformData.platform]: val }));
                              }}
                              className="font-mono text-sm resize-none bg-muted/20 border-border/30 rounded-xl p-6 shadow-inner"
                              rows={15}
                            />
                          ) : (
                            <div className="font-sans text-lg leading-relaxed text-foreground/90 py-8">
                              <Markdown>
                                {inlineContents[platformData.platform] ?? platformData.content}
                              </Markdown>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-4">
              <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="font-serif text-lg tracking-tight">Select a post or create a new one</p>
            </div>
          )}
        </main>

        {/* Chatbot - 1 part */}
        <aside className="w-120 border-l border-border/40 flex flex-col overflow-hidden relative shrink-0">
          <Chatbot
            showHeader={false}
            chatType="contentDraft"
            contextData={{
              xAccountSubType: xAccountSubType,
              ...(selectedDraft ? {
                post: {
                  type: 'post',
                  title: selectedDraft.title,
                  platforms: selectedDraft.platforms,
                  activeTab: activeTab,
                  originalIdea: selectedDraft.originalIdea,
                  id: selectedDraft._id,
                }
              } : {})
            }}
          />
        </aside>
      </div >

      {/* Image Upload Dialog */}
      {
        selectedDraft && user && (
          <ImageUploadDialog
            open={imageUploadDialogOpen}
            onOpenChange={setImageUploadDialogOpen}
            userId={user._id as Id<"users">}
            draftId={selectedDraft._id}
            currentImageUrl={imageUrl}
            onImageUpdated={handleImageUpdated}
          />
        )
      }
    </>
  );
};

export default Page;