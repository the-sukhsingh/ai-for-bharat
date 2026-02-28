"use client"
import React, { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { useAuth } from '@/context/AuthContext';
import { useContentDraft } from '@/context/ContentDraftContext';
import { useSocialScript } from '@/context/SocialScriptContext';
import { Send, Paperclip, Plus, Bot, User, ImageIcon, X, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Markdown from 'react-markdown';

interface ChatMessage {
    id: string;
    content: string;
    sender: 'user' | 'ai';
    timestamp: string;
    type?: 'text' | 'document' | 'draft';
    fileName?: string;
}

interface Chatbotprops {
    initialChatId?: string | null;  // Changed to string to match Convex Id<"chats">
    initialMessages?: ChatMessage[];
    showHeader?: boolean;
    showInput?: boolean;
    chatType?: 'contentDraft' | 'socialScript';
    contextData?: any;
}


const Chatbot = ({ initialChatId = null, initialMessages = [], showHeader = true, showInput = true, chatType = 'contentDraft', contextData: propContextData }: Chatbotprops) => {
    const { data: session } = useSession();

    const contentDraftContext = useContentDraft();
    const socialScriptContext = useSocialScript();
    const activeContext = chatType === 'contentDraft' ? contentDraftContext : socialScriptContext;
    const { selectedConversationId, setSelectedConversationId, contextData: contextContextData } = activeContext;

    const resolvedContextData = propContextData || contextContextData;

    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
    const [isLoading, setIsLoading] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const eventSourceRef = useRef<EventSource | null>(null)
    const lastMessageIdRef = useRef<string | null>(null)
    const seenMessageIdsRef = useRef<Set<string>>(new Set())
    // Use selectedConversationId from context if available, otherwise use initialChatId
    const [chatId, setChatId] = useState<string | null>(initialChatId || (selectedConversationId as string | null))
    const prevChatIdRef = useRef<string | null>(chatId)

    const [inputMessage, setInputMessage] = useState('')
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)])
        }
    }

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    }


    // Fetch messages from Convex when chatId is available
    const convexMessages = useQuery(
        api.messages.listChatMessages,
        chatId && user?._id ? { userId: user._id, chatId: chatId as Id<"chats"> } : "skip"
    );

    const scriptSuggestions: string[] = [
        "Create a script for instagram reel about cryptography",
        "Create a script for a youtube video about AI tools for content creation",
    ];

    const postSuggestions: string[] = [
        "Create a LinkedIn post about learning AI",
        "Write an X post about productivity tips",
    ]

    const suggestions: string[] = chatType === 'socialScript' ? scriptSuggestions : postSuggestions;

    // Sync messages from Convex
    useEffect(() => {
        // If chatId changed, replace all messages
        if (chatId !== prevChatIdRef.current) {
            prevChatIdRef.current = chatId;
            if (convexMessages && convexMessages.length > 0) {
                const formattedMessages: ChatMessage[] = convexMessages.map((msg: any) => {
                    const hasDraft = msg.draftData && msg.draftData.platforms && msg.draftData.platforms.length > 0;
                    return {
                        id: msg._id,
                        content: msg.content,
                        sender: msg.role === 'user' ? 'user' : 'ai',
                        timestamp: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        type: hasDraft ? 'draft' : 'text',
                        draftData: hasDraft ? msg.draftData : undefined,
                    };
                });
                setMessages(formattedMessages);
            } else if (!chatId) {
                // Clear messages when starting a new chat
                setMessages([]);
            }
        } else if (convexMessages && chatId) {
            // Same chat, update messages from Convex (for new AI responses)
            const formattedMessages: ChatMessage[] = convexMessages.map((msg: any) => {
                const hasDraft = msg.draftData && msg.draftData.platforms && msg.draftData.platforms.length > 0;
                return {
                    id: msg._id,
                    content: msg.content,
                    sender: msg.role === 'user' ? 'user' : 'ai',
                    timestamp: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    type: hasDraft ? 'draft' : 'text',
                    draftData: hasDraft ? msg.draftData : undefined,
                };
            });
            setMessages(formattedMessages);
        }
    }, [chatId, convexMessages]);

    // Sync chatId when selectedConversationId changes from outside (e.g., user selects a conversation)
    useEffect(() => {
        if (selectedConversationId && selectedConversationId !== chatId) {
            setChatId(selectedConversationId as string);
        }
    }, [selectedConversationId]);

    const handleNewChat = () => {
        setMessages([])
        setChatId(null)
        prevChatIdRef.current = null
        setSelectedConversationId(null)
        lastMessageIdRef.current = null
        seenMessageIdsRef.current.clear()
        if (eventSourceRef.current) {
            eventSourceRef.current.close()
            eventSourceRef.current = null
        }
    }

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])


    const handleSendMessage = async (message: string) => {
        if (!message.trim() && selectedFiles.length === 0) return

        // Clear the input message state
        setInputMessage('')
        const filesToSend = [...selectedFiles]
        setSelectedFiles([])

        const userMessage: ChatMessage = {
            id: `temp-${Date.now()}`,
            content: message,
            sender: 'user',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'text',
        }
        setMessages(prev => [...prev, userMessage])
        setIsLoading(true)

        try {
            const formData = new FormData()
            formData.append('question', message)
            formData.append('chatType', chatType)
            if (chatId) {
                formData.append('chatId', chatId.toString())
            }

            // Add context data if available
            if (resolvedContextData) {
                formData.append('contextData', JSON.stringify(resolvedContextData))
            }

            if (filesToSend.length > 0) {
                filesToSend.forEach(file => {
                    formData.append('file', file)
                    const documentMessage: ChatMessage = {
                        id: `doc-${Date.now()}`,
                        content: `Uploaded image: ${file.name}`,
                        sender: 'user',
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        type: 'document',
                        fileName: file.name,
                    }
                    setMessages(prev => [...prev, documentMessage])
                })
            }

            const response = await fetch('/api/ask', {
                method: 'POST',
                body: formData,
            })

            const data = await response.json()

            if (!response.ok) {
                const errorMessage: ChatMessage = {
                    id: (Date.now() + 1).toString(),
                    content: `Error: ${data.error || 'Failed to send message'}`,
                    sender: 'ai',
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
                setMessages(prev => [...prev, errorMessage])
            } else {
                if (data.conversationId) {
                    // Only update chatId if it's a new conversation
                    if (!chatId) {
                        setChatId(data.conversationId)
                        // Sync with global chat context
                        setSelectedConversationId(data.conversationId as Id<"chats">);
                    }
                }

            }
        } catch (error) {
            console.error('Error sending message:', error)
            const errorMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                content: 'Failed to send message. Please try again.',
                sender: 'ai',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
            setMessages(prev => [...prev, errorMessage])
        }
        setIsLoading(false)

    }

    return (
        <div className="flex flex-col absolute inset-0 w-full h-full max-w-3xl mx-auto bg-background overflow-hidden min-h-0">
            {/* Header */}
            {showHeader && (
                <div className="flex items-center justify-between py-4 px-6 border-b border-border/40 sticky top-0 z-10 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleNewChat}
                            className="rounded-full hover:bg-muted transition-colors"
                            title="New Chat"
                        >
                            <Plus className="w-5 h-5 text-muted-foreground" />
                        </Button>
                        <div>
                            <h2 className="text-base font-medium flex items-center gap-2 tracking-tight">
                                <Sparkles className="w-4 h-4 text-primary" />
                                {chatType === 'contentDraft' ? 'Content Creator AI' : 'Social Script AI'}
                            </h2>
                        </div>
                    </div>
                </div>
            )}

            {/* Chat Area */}
            <ScrollArea className="flex-1 min-h-0 px-4 lg:px-6" ref={messagesEndRef}>
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center p-8 mt-12 mb-auto">
                        <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-6">
                            <Bot className="w-6 h-6 text-foreground/70" />
                        </div>
                        <h3 className="text-xl font-medium mb-2 tracking-tight">How can I help you today?</h3>
                        <p className="text-sm text-muted-foreground mb-8 max-w-sm">
                            I can help you create amazing {chatType === 'contentDraft' ? 'social media posts' : 'video scripts'}. Give me an idea or choose from the suggestions below.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-xl">
                            {suggestions.map((suggestion, index) => (
                                <Button
                                    key={index}
                                    variant="ghost"
                                    className="h-auto whitespace-normal p-4 text-left justify-start bg-muted/30 hover:bg-muted border border-transparent hover:border-border/50 transition-all text-sm font-normal rounded-xl"
                                    onClick={() => handleSendMessage(suggestion)}
                                >
                                    {suggestion}
                                </Button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6 max-w-3xl mx-auto py-6">
                        {messages.map((msg, index) => (
                            <div
                                key={msg.id || index}
                                className={`flex gap-4 animate-in slide-in-from-bottom-2 duration-300 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                            >
                                <Avatar className={`w-8 h-8 rounded-full ${msg.sender === 'user' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted border border-border/50'}`}>
                                    {msg.sender === 'user' ? (
                                        <>
                                            {user?.imageUrl ? <AvatarImage src={user.imageUrl} className="rounded-full" /> : <User className="w-4 h-4 m-auto text-primary" />}
                                            <AvatarFallback className="bg-transparent"><User className="w-4 h-4" /></AvatarFallback>
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-foreground/70">
                                            <Bot className="w-4 h-4" />
                                        </div>
                                    )}
                                </Avatar>
                                <div className={`flex flex-col gap-1.5 max-w-[95%] w-full ${msg.sender === 'user' ? 'items-end ml-auto' : 'items-start'}`}>
                                    <div className={`px-4 py-3 rounded-2xl text-sm w-full ${msg.sender === 'user'
                                        ? 'bg-muted text-foreground rounded-tr-sm whitespace-pre-wrap w-fit'
                                        : 'bg-transparent text-foreground -ml-4 max-w-none'
                                        }`}>
                                        {msg.type === 'document' ? (
                                            <div className="flex items-center gap-2 text-muted-foreground bg-muted/50 p-3 rounded-xl border border-border/50 w-fit">
                                                <ImageIcon className="w-4 h-4" />
                                                <span className="text-sm font-medium">{msg.fileName || msg.content}</span>
                                            </div>
                                        ) : msg.sender === 'ai' ? (
                                            <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-pre:bg-muted/50 max-w-none font-sans wrap-break-word bg-transparent">
                                                <Markdown>{msg.content}</Markdown>
                                            </div>
                                        ) : (
                                            <div className="wrap-break-word">
                                                {msg.content}
                                            </div>
                                        )}
                                    </div>
                                    <div className={`px-1 text-[10px] text-muted-foreground/50 font-medium ${msg.sender !== 'user' && 'ml-0'}`}>{msg.timestamp}</div>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-4 animate-in fade-in">
                                <Avatar className="w-8 h-8 rounded-full bg-muted border border-border/50">
                                    <div className="w-full h-full flex items-center justify-center text-foreground/70">
                                        <Bot className="w-4 h-4 animate-pulse" />
                                    </div>
                                </Avatar>
                                <div className="py-3 text-sm text-muted-foreground flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/50" />
                                    Thinking...
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </ScrollArea>

            {/* Input Area */}
            {showInput && (
                <div className="p-3 bg-background border-t border-border/40">
                    <div className="max-w-3xl mx-auto">
                        {selectedFiles.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                                {selectedFiles.map((file, i) => (
                                    <div key={i} className="relative group bg-muted/50 border border-border/50 rounded-lg p-1 pr-7 flex items-center gap-2 max-w-[200px]">
                                        <div className="w-7 h-7 bg-muted rounded overflow-hidden flex items-center justify-center shrink-0">
                                            {file.type.startsWith('image/') ? (
                                                <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <ImageIcon className="w-3 h-3 text-muted-foreground" />
                                            )}
                                        </div>
                                        <span className="text-[11px] truncate font-medium">{file.name}</span>
                                        <button
                                            onClick={() => removeFile(i)}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md text-muted-foreground flex items-center justify-center transition-colors"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <form
                            onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputMessage); }}
                            className="relative flex items-end gap-2 border border-border/50 rounded-2xl p-1.5 focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/20 transition-all bg-background"
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                multiple
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="shrink-0 h-9 w-9 rounded-xl hover:bg-muted text-muted-foreground"
                                onClick={() => fileInputRef.current?.click()}
                                title="Attach image"
                            >
                                <Paperclip className="w-4 h-4" />
                            </Button>
                            <Input
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                placeholder="Message AI..."
                                className="border-0 bg-transparent focus-visible:ring-0 px-2 min-h-[40px] shadow-none flex-1 text-[15px] outline-none ring-0 placeholder:text-muted-foreground/60 py-2.5"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={(!inputMessage.trim() && selectedFiles.length === 0) || isLoading}
                                className={`shrink-0 h-9 w-9 rounded-xl transition-all ${inputMessage.trim() || selectedFiles.length > 0
                                    ? 'bg-foreground text-background hover:bg-foreground/90'
                                    : 'bg-muted text-muted-foreground hover:bg-muted'
                                    }`}
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </Button>
                        </form>
                        <div className="text-center mt-1.5">
                            <span className="text-[11px] text-muted-foreground/60 font-medium">AI can make mistakes. Consider verifying important information.</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Chatbot