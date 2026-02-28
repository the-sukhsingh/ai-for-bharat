import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Id } from '../../convex/_generated/dataModel';

interface ContentDraftContextType {
    selectedConversationId: string | null;
    setSelectedConversationId: (id: string | null) => void;
    contextData: any;
    setContextData: (data: any) => void;
    selectedDraftId: Id<"contentDrafts"> | null;
    setSelectedDraftId: (id: Id<"contentDrafts"> | null) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    activeTab: string;
    setActiveTab: (tab: string) => void;
    copiedId: string | null;
    setCopiedId: (id: string | null) => void;
}

const ContentDraftContext = createContext<ContentDraftContextType | undefined>(undefined);

export const ContentDraftProvider = ({ children }: { children: ReactNode }) => {
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [contextData, setContextData] = useState<any>(null);
    const [selectedDraftId, setSelectedDraftId] = useState<Id<"contentDrafts"> | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [activeTab, setActiveTab] = useState<string>('');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    return (
        <ContentDraftContext.Provider
            value={{
                selectedConversationId, setSelectedConversationId,
                contextData, setContextData,
                selectedDraftId, setSelectedDraftId,
                searchQuery, setSearchQuery,
                activeTab, setActiveTab,
                copiedId, setCopiedId
            }}
        >
            {children}
        </ContentDraftContext.Provider>
    );
};

export const useContentDraft = () => {
    const context = useContext(ContentDraftContext);
    if (context === undefined) {
        throw new Error('useContentDraft must be used within a ContentDraftProvider');
    }
    return context;
};
