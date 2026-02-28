'use client';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Twitter } from 'lucide-react';
import { Id } from '../../convex/_generated/dataModel';

export default function XConnectButton({ userId, userEmail }: { userId: string; userEmail: string }) {
    const config = useQuery(api.users.getXConnection, { userId: userId as Id<"users"> });

    const handleConnect = () => {
        const codeVerifier = generateCodeVerifier();
        const state = btoa(JSON.stringify({ email: userEmail, codeVerifier }));
        
        generateCodeChallenge(codeVerifier).then(codeChallenge => {
            const params = new URLSearchParams({
                response_type: 'code',
                client_id: process.env.NEXT_PUBLIC_X_CLIENT_ID!,
                redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/x/callback`,
                scope: 'tweet.read tweet.write users.read offline.access',
                state: state,
                code_challenge: codeChallenge,
                code_challenge_method: 'S256'
            });
            
            window.location.href = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
        });
    };

    if (config === undefined) return <div>Loading...</div>;

    return (
        <Button onClick={handleConnect} variant={config.connected ? 'default' : 'outline'}>
            <Twitter className="mr-2 h-4 w-4" />
            {config.connected ? `Connected: @${config.accountName}` : 'Connect X (Twitter)'}
        </Button>
    );
}

// PKCE helpers for OAuth 2.0
function generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64URLEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return base64URLEncode(new Uint8Array(hash));
}

function base64URLEncode(buffer: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...buffer));
    return base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}
