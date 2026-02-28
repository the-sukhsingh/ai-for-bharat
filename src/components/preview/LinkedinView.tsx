import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThumbsUp, MessageSquare, Repeat2, Send, Globe } from 'lucide-react';
import { format } from 'date-fns';
import { Textarea } from '../ui/textarea';

interface LinkedinViewProps {
  content: string;
  imageUrl?: string | null;
  timestamp?: number;
  authorName?: string;
  authorHeadline?: string;
  authorAvatar?: string;
  isEditable?: boolean;
  onChange?: (newContent: string) => void;
  onImageRemove?: () => void;
  onImageUpload?: () => void;
}

const LinkedinView: React.FC<LinkedinViewProps> = ({
  content,
  imageUrl,
  timestamp = Date.now(),
  authorName = 'Your Name',
  authorHeadline = 'Your Professional Headline',
  authorAvatar,
  isEditable,
  onChange,
  onImageRemove,
  onImageUpload,
}) => {
  return (
    <div className="max-w-xl mx-auto bg-background border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={authorAvatar} />
            <AvatarFallback>{authorName[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="font-semibold text-sm">{authorName}</div>
            <div className="text-xs text-muted-foreground">{authorHeadline}</div>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <span>{format(new Date(timestamp), 'MMM d, yyyy')}</span>
              <span>·</span>
              <Globe className="h-3 w-3" />
            </div>
          </div>
        </div>

        {/* Content */}
        {isEditable ? (
          <Textarea
            value={content}
            onChange={(e) => onChange?.(e.target.value)}
            className="mt-3 text-sm w-full bg-transparent p-0 border-none outline-none resize-none focus:ring-0 h-auto focus:outline-none focus-visible:ring-0"
          />
        ) : (
          <div className="mt-3 text-sm whitespace-pre-wrap wrap-break-word">
            {content}
          </div>
        )}
      </div>

      {/* Image */}
      {(isEditable || imageUrl) && (
        <div className="w-full relative group p-4 pt-0">
          {imageUrl ? (
            <div className="relative rounded-lg overflow-hidden border">
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
            <div onClick={onImageUpload} className="w-full rounded-lg bg-muted border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center p-8 cursor-pointer hover:border-muted-foreground/50 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground mb-2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
              <span className="text-sm font-medium text-muted-foreground">Add Image</span>
            </div>
          ) : null}
        </div>
      )}

      {/* Engagement Stats */}
      <div className="px-4 py-2 border-t border-b">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="flex items-center -space-x-1">
              <div className="h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center">
                <ThumbsUp className="h-2 w-2 text-white fill-white" />
              </div>
            </div>
            <span>0</span>
          </div>
          <div className="flex items-center gap-3">
            <span>0 comments</span>
            <span>0 reposts</span>
          </div>
        </div>
      </div>

      {/* Engagement Buttons */}
      <div className="px-4 py-2 flex items-center justify-around">
        <button className="flex items-center gap-2 text-muted-foreground hover:bg-muted px-4 py-2 rounded transition-colors">
          <ThumbsUp className="h-4 w-4" />
          <span className="text-xs font-medium">Like</span>
        </button>
        <button className="flex items-center gap-2 text-muted-foreground hover:bg-muted px-4 py-2 rounded transition-colors">
          <MessageSquare className="h-4 w-4" />
          <span className="text-xs font-medium">Comment</span>
        </button>
        <button className="flex items-center gap-2 text-muted-foreground hover:bg-muted px-4 py-2 rounded transition-colors">
          <Repeat2 className="h-4 w-4" />
          <span className="text-xs font-medium">Repost</span>
        </button>
        <button className="flex items-center gap-2 text-muted-foreground hover:bg-muted px-4 py-2 rounded transition-colors">
          <Send className="h-4 w-4" />
          <span className="text-xs font-medium">Send</span>
        </button>
      </div>
    </div>
  );
};

export default LinkedinView;