import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Id } from '../../convex/_generated/dataModel';

interface SocialScriptContextType {
    selectedConversationId: string | null;
    setSelectedConversationId: (id: string | null) => void;
    contextData: any;
    setContextData: (data: any) => void;

    selectedScriptId: Id<"socialScripts"> | null;
    setSelectedScriptId: (id: Id<"socialScripts"> | null) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    copiedSection: string | null;
    setCopiedSection: (section: string | null) => void;
}

const SocialScriptContext = createContext<SocialScriptContextType | undefined>(undefined);

export const SocialScriptProvider = ({ children }: { children: ReactNode }) => {
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [contextData, setContextData] = useState<any>(null);
    const [selectedScriptId, setSelectedScriptId] = useState<Id<"socialScripts"> | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [copiedSection, setCopiedSection] = useState<string | null>(null);

    return (
        <SocialScriptContext.Provider value={{
            selectedConversationId, setSelectedConversationId,
            contextData, setContextData,
            selectedScriptId, setSelectedScriptId,
            searchQuery, setSearchQuery,
            copiedSection, setCopiedSection
        }}>
            {children}
        </SocialScriptContext.Provider>
    );
};

export const useSocialScript = () => {
    const context = useContext(SocialScriptContext);
    if (context === undefined) {
        throw new Error('useSocialScript must be used within a SocialScriptProvider');
    }
    return context;
};
