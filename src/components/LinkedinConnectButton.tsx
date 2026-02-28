'use client';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Button } from '@/components/ui/button';
import { Linkedin } from 'lucide-react';
import { Id } from '../../convex/_generated/dataModel';

export default function LinkedinConnectButton({ userId, userEmail }: { userId: string; userEmail: string }) {
    const config = useQuery(api.users.getLinkedInConnection, { userId: userId as Id<"users"> });

    const handleConnect = () => {
        // Encode user email in state for verification after callback
        const state = btoa(JSON.stringify({ email: userEmail, timestamp: Date.now() }));
        
        // LinkedIn OAuth 2.0 scopes
        // r_liteprofile: Basic profile info (name, photo)
        // r_emailaddress: User's email address
        // w_member_social: Share content on behalf of the user
        const scopes = ['openid', 'profile', 'email', 'w_member_social'];
        
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: process.env.NEXT_PUBLIC_LINKEDIN_CLIENT_ID || '',
            redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin/callback`,
            state: state,
            scope: scopes.join(' '),
        });
        
        // Redirect to LinkedIn authorization endpoint
        window.location.href = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
    };

    if (config === undefined) return <div>Loading...</div>;

    return (
        <Button onClick={handleConnect} variant={config.connected ? 'default' : 'outline'}>
            <Linkedin className="mr-2 h-4 w-4" />
            {config.connected ? `Connected: ${config.accountName}` : 'Connect LinkedIn'}
        </Button>
    );
}
