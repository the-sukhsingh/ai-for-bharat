"use client";

import React, { useState, useMemo } from 'react';
import { useSocialScript } from '@/context/SocialScriptContext';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Copy, Check, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { Id } from '../../../../convex/_generated/dataModel';
import ChatInterface from '@/components/chat/Chatbot';
import Markdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';

export default function ScriptsPage() {
  const { user } = useAuth();

  const userScripts = useQuery(
    api.socialScripts.getUserSocialScripts,
    user?._id ? { userId: user._id } : "skip"
  );

  const {
    selectedScriptId,
    setSelectedScriptId,
    searchQuery,
    setSearchQuery,
    copiedSection,
    setCopiedSection,
    selectedConversationId,
    setSelectedConversationId
  } = useSocialScript();

  const selectedScript = useMemo(() =>
    userScripts?.find(s => s._id === selectedScriptId),
    [userScripts, selectedScriptId]
  );

  const filteredScripts = useMemo(() => {
    if (!userScripts) return [];
    return userScripts.filter(script =>
      script.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [userScripts, searchQuery]);

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const copyFullScript = () => {
    if (!selectedScript) return;
    const fullText = `${selectedScript.hook}\n\n${selectedScript.scriptSections.map(s => `${s.heading}\n${s.content}`).join('\n\n')}\n\n${selectedScript.cta}${selectedScript.hashtags ? '\n\n' + selectedScript.hashtags.map(h => '#' + h).join(' ') : ''}`;
    handleCopy(fullText, 'full');
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full bg-background selection:bg-neutral-200 dark:selection:bg-neutral-800">
      {/* Sidebar - 1 part */}
      <aside className="w-80 border-r border-border/40 flex flex-col bg-background/50 shrink-0">
        <div className="p-4 space-y-6">
          <h2 className="font-serif text-2xl font-medium tracking-tight">Scripts</h2>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search scripts..."
              className="pl-9 h-9 bg-muted/30 border-none shadow-none focus-visible:ring-1 focus-visible:ring-border rounded-full text-xs"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto noscrollbar px-2 pb-4">
          {filteredScripts.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No scripts found
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredScripts.map((script) => (
                <button
                  key={script._id}
                  onClick={() => setSelectedScriptId(script._id)}
                  className={`w-full p-4 text-left transition-all duration-200 rounded-xl ${selectedScriptId === script._id ? 'bg-muted/80' : 'hover:bg-muted/40'
                    }`}
                >
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-medium line-clamp-2 leading-snug">{script.title}</h3>
                    <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider">
                      {format(new Date(script.createdAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* View Area - 2.2 parts */}
      <main className="flex-1 flex flex-col min-w-0 bg-background/95 relative overflow-hidden">
        {selectedScript ? (
          <>
            <div className="border-b border-border/40 p-4 pl-8 flex items-center justify-between bg-card/10 backdrop-blur-md">
              <div className='flex items-center gap-4'>
                <h1 className="font-serif text-xl tracking-tight">{selectedScript.title}</h1>
                <Badge variant="outline" className='capitalize rounded-full shadow-none text-xs border-border/60 text-muted-foreground font-medium py-0.5'>
                  {selectedScript.platform}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-full shadow-none text-xs px-4 border-border/60"
                onClick={copyFullScript}
              >
                {copiedSection === 'full' ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Copy Script
                  </>
                )}
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 lg:p-12 noscrollbar">
              <div className="max-w-3xl mx-auto space-y-12">
                {/* Hook */}
                <div className="relative group">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Hook</h3>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleCopy(selectedScript.hook, 'hook')}
                    >
                      {copiedSection === 'hook' ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <div className="text-lg md:text-xl font-serif leading-relaxed text-foreground/90">
                    <Markdown>{selectedScript.hook}</Markdown>
                  </div>
                </div>

                {/* Script Sections */}
                <div className="space-y-10">
                  {selectedScript.scriptSections.map((section, index) => (
                    <div key={index} className="relative group pl-6 border-l-2 border-border/20 hover:border-foreground/30 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium tracking-tight">{section.heading}</h3>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity -mr-2"
                          onClick={() => handleCopy(section.content, `section-${index}`)}
                        >
                          {copiedSection === `section-${index}` ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                      <div className="text-sm leading-relaxed text-muted-foreground">
                        <Markdown>{section.content}</Markdown>
                      </div>
                      {section.duration && (
                        <div className="mt-3 inline-block px-2 py-1 rounded bg-muted/40 text-[10px] uppercase font-mono tracking-widest text-muted-foreground">
                          {section.duration}s duration
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="relative group pt-4 border-t border-border/20">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Call to Action</h3>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleCopy(selectedScript.cta, 'cta')}
                    >
                      {copiedSection === 'cta' ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <p className="text-base font-medium leading-relaxed">{selectedScript.cta}</p>
                </div>

                {/* Hashtags */}
                {selectedScript.hashtags && selectedScript.hashtags.length > 0 && (
                  <div className="pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Hashtags</h3>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-full opacity-50 hover:opacity-100 transition-opacity"
                        onClick={() => handleCopy(selectedScript.hashtags!.join(' '), 'hashtags')}
                      >
                        {copiedSection === 'hashtags' ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedScript.hashtags.map((tag, i) => (
                        <span key={i} className="text-[11px] font-mono px-3 py-1.5 rounded-full bg-muted/50 border border-border/30 text-muted-foreground">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="font-serif text-lg tracking-tight">Select a script to view details</p>
          </div>
        )}
      </main>

      {/* Chatbot - 1 part */}
      <aside className="w-120 border-l border-border/40 flex flex-col overflow-hidden relative shrink-0 bg-background">
        <ChatInterface
          showHeader={false}
          chatType="socialScript"
          contextData={selectedScript ? {
            script: {
              type: 'script',
              title: selectedScript.title,
              hook: selectedScript.hook,
              scriptSections: selectedScript.scriptSections,
              cta: selectedScript.cta,
              hashtags: selectedScript.hashtags,
              id: selectedScript._id,
            }
          } : undefined}
        />
      </aside>
    </div>
  );
}