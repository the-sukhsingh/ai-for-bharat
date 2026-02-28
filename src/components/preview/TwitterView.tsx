import React, { useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Repeat2, Share, BarChart } from 'lucide-react';
import { format } from 'date-fns';
import { Textarea } from '../ui/textarea';

interface TwitterViewProps {
  content: string;
  imageUrl?: string | null;
  timestamp?: number;
  authorName?: string;
  authorHandle?: string;
  authorAvatar?: string;
  accountSubType?: string; // X subscription type: Basic, Premium, PremiumPlus, None
  isEditable?: boolean;
  onChange?: (newContent: string) => void;
  onImageRemove?: () => void;
  onImageUpload?: () => void;
}

/**
 * Get the character limit for an X account based on subscription type
 * Basic, Premium, PremiumPlus: 25,000 characters
 * None or undefined: 280 characters (free tier)
 */
const getCharacterLimit = (subType?: string): number => {
  if (!subType || subType === 'None') {
    return 280;
  }
  // Basic, Premium, PremiumPlus all support long posts
  if (['Basic', 'Premium', 'PremiumPlus'].includes(subType)) {
    return 25000;
  }
  // Default to free tier limit
  return 280;
};

// Helper function to split content into thread posts based on character limit.
const splitIntoThreadPosts = (content: string, charLimit: number): string[] => {
  if (!content) return [''];

  const posts: string[] = [];
  let currentString = content;

  while (currentString.length > charLimit) {
    let splitIndex = currentString.lastIndexOf(' ', charLimit);

    // If no space found, or space is at the very beginning, force break at charLimit
    if (splitIndex <= 0) {
      splitIndex = charLimit;
    }

    posts.push(currentString.substring(0, splitIndex));
    currentString = currentString.substring(splitIndex);
  }

  if (currentString.length > 0) {
    posts.push(currentString);
  }

  return posts;
};

// Helper function to remove leading numbers from posts (e.g., "1. Tweet text" -> "Tweet text")
const cleanPostContent = (post: string): string => {
  return post.replace(/^\d+\.?\s*/, '');
};

const TwitterView: React.FC<TwitterViewProps> = ({
  content,
  imageUrl,
  timestamp = Date.now(),
  authorName = 'Your Name',
  authorHandle = 'yourhandle',
  authorAvatar,
  accountSubType,
  isEditable,
  onChange,
  onImageRemove,
  onImageUpload,
}) => {
  const charLimit = getCharacterLimit(accountSubType);
  const threadPosts = splitIntoThreadPosts(content, charLimit);
  const isThread = threadPosts.length > 1;

  const textareasRef = useRef<(HTMLTextAreaElement | null)[]>([]);
  const lastThreadCount = useRef(threadPosts.length);

  useEffect(() => {
    // When thread posts increase (e.g. crossing char limit), move focus to the new last text area
    if (isEditable && threadPosts.length > lastThreadCount.current) {
      const lastTextarea = textareasRef.current[threadPosts.length - 1];
      if (lastTextarea) {
        lastTextarea.focus();
        const length = lastTextarea.value.length;
        lastTextarea.setSelectionRange(length, length);
      }
    }
    lastThreadCount.current = threadPosts.length;
  }, [threadPosts.length, isEditable]);

  return (
    <div className="max-w-xl mx-auto space-y-2 flex-1">
      {threadPosts.map((post, index) => {
        const cleanedPost = cleanPostContent(post);
        const isFirstPost = index === 0;
        const showImage = isFirstPost && imageUrl;

        return (
          <div key={index} className="bg-background border rounded-lg overflow-hidden">
            {/* Thread indicator */}
            {isThread && (
              <div className="px-4 pt-2 pb-0">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="font-medium">{index + 1}/{threadPosts.length}</span>
                  {!isFirstPost && <span>· Thread</span>}
                </div>
              </div>
            )}

            {/* Post Content */}
            <div className="p-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={authorAvatar} />
                  <AvatarFallback>{authorName[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-sm">{authorName}</span>
                    <span className="text-muted-foreground text-sm">@{authorHandle}</span>
                    <span className="text-muted-foreground text-sm">·</span>
                    <span className="text-muted-foreground text-sm">
                      {format(new Date(timestamp), 'MMM d')}
                    </span>
                  </div>

                  {/* Content */}
                  {isEditable ? (

                    <Textarea
                      ref={(el) => {
                        textareasRef.current[index] = el;
                      }}
                      value={post}
                      onChange={(e) => {
                        const newThreads = [...threadPosts];
                        newThreads[index] = e.target.value;
                        if (onChange) onChange(newThreads.join(''));
                      }}
                      className="my-3 text-sm w-full bg-transparent py-2 border-none outline-none resize-none focus:ring-0 h-auto focus:outline-none focus-visible:ring-0"
                      rows={Math.max(3, post.split('\n').length)}
                      style={{ overflow: 'hidden' }}
                    />
                  ) : (
                    <div className="mt-2 text-sm whitespace-pre-wrap wrap-break-words">
                      {cleanedPost}
                    </div>
                  )}

                  {/* Character count indicator for long posts */}
                  {cleanedPost.length > 280 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {cleanedPost.length.toLocaleString()} characters · Long post
                    </div>
                  )}

                  {/* Image - only shown on first post */}
                  {(showImage || (isFirstPost && isEditable)) && (
                    <div className="mt-3 group relative">
                      {showImage ? (
                        <div className="rounded-xl overflow-hidden border relative">
                          <img
                            src={imageUrl}
                            alt="Post image"
                            className="w-full h-auto object-cover"
                          />
                          {isEditable && (
                            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={onImageUpload}
                                className="bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full transition-colors backdrop-blur-sm"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                              </button>
                              <button
                                onClick={onImageRemove}
                                className="bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full transition-colors backdrop-blur-sm"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                              </button>
                            </div>
                          )}
                        </div>
                      ) : isEditable ? (
                        <div onClick={onImageUpload} className="w-full rounded-xl bg-muted border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center p-8 cursor-pointer hover:border-muted-foreground/50 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground mb-2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                          <span className="text-sm font-medium text-muted-foreground">Add Image</span>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Engagement Buttons */}
                  <div className="flex items-center justify-between mt-3 max-w-md">
                    <button className="flex items-center gap-2 text-muted-foreground hover:text-blue-500 transition-colors group">
                      <MessageCircle className="h-4 w-4" />
                      <span className="text-xs">0</span>
                    </button>
                    <button className="flex items-center gap-2 text-muted-foreground hover:text-green-500 transition-colors group">
                      <Repeat2 className="h-4 w-4" />
                      <span className="text-xs">0</span>
                    </button>
                    <button className="flex items-center gap-2 text-muted-foreground hover:text-pink-500 transition-colors group">
                      <Heart className="h-4 w-4" />
                      <span className="text-xs">0</span>
                    </button>
                    <button className="flex items-center gap-2 text-muted-foreground hover:text-blue-500 transition-colors group">
                      <BarChart className="h-4 w-4" />
                      <span className="text-xs">0</span>
                    </button>
                    <button className="flex items-center gap-2 text-muted-foreground hover:text-blue-500 transition-colors group">
                      <Share className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TwitterView;