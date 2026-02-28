import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Get the character limit for an X account based on subscription type
 * Basic, Premium, PremiumPlus: 25,000 characters
 * None or undefined: 280 characters (free tier)
 */
function getCharacterLimit(subType?: string): number {
    if (!subType || subType === 'None') {
        return 280;
    }
    // Basic, Premium, PremiumPlus all support long posts
    if (['Basic', 'Premium', 'PremiumPlus'].includes(subType)) {
        return 25000;
    }
    // Default to free tier limit
    return 280;
}

/**
 * Helper function to split content into thread posts
 * Thread posts are separated by two newline characters
 */
function splitIntoThreadPosts(content: string): string[] {
    const posts = content.split('\n\n').map(post => post.trim()).filter(post => post.length > 0);
    return posts.length > 0 ? posts : [content];
}

/**
 * Helper function to remove leading numbers from posts (e.g., "1. Tweet text" -> "Tweet text")
 */
function cleanPostContent(post: string): string {
    return post.replace(/^\d+\.?\s*/, '');
}

/**
 * Upload media to X (Twitter)
 * @returns media_id string if successful, null otherwise
 */
async function uploadMediaToX(imageUrl: string, accessToken: string): Promise<string | null> {
    try {
        // Fetch the image
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            console.error('Failed to fetch image:', imageResponse.statusText);
            return null;
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString('base64');

        // Upload media using X API v1.1 (media upload uses v1.1, not v2)
        const formData = new FormData();
        formData.append('media_data', imageBase64);

        const uploadResponse = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
            body: formData,
        });

        if (!uploadResponse.ok) {
            console.error('Failed to upload media:', await uploadResponse.text());
            return null;
        }

        const uploadData = await uploadResponse.json();
        return uploadData.media_id_string;
    } catch (error) {
        console.error('Error uploading media:', error);
        return null;
    }
}

/**
 * Publish to X (Twitter) - Internal Action
 */
export const publishToX = internalAction({
    args: {
        userId: v.id("users"),
        accountId: v.id("socialAccounts"),
        content: v.string(),
        draftId: v.optional(v.id("contentDrafts")),
    },
    returns: v.object({
        success: v.boolean(),
        postId: v.optional(v.string()),
        postUrl: v.optional(v.string()),
        error: v.optional(v.string()),
    }),
    handler: async (ctx, args) => {
        try {
            // Get draft details if draftId is provided (to check for images)
            let imageUrl: string | null = null;
            if (args.draftId) {
                const draft = await ctx.runQuery(internal.contentDrafts.getContentDraftByIdInternal, {
                    draftId: args.draftId,
                });

                if (draft?.imageStorageId) {
                    imageUrl = await ctx.runQuery(internal.ai_tools.getStorageUrlInternal, {
                        storageId: draft.imageStorageId,
                    });
                }
            }

            // Get the social account
            const account: any = await ctx.runQuery(internal.users.getSocialAccountById, {
                accountId: args.accountId,
            });

            if (!account) {
                await ctx.runMutation(internal.publishLogs.logPublishInternal, {
                    userId: args.userId,
                    draftId: args.draftId,
                    socialAccountId: args.accountId,
                    platform: 'x',
                    status: 'failed',
                    errorMessage: 'Social account not found',
                });
                
                return {
                    success: false,
                    error: "Social account not found",
                };
            }

            // Verify account belongs to user
            if (account.userId !== args.userId) {
                await ctx.runMutation(internal.publishLogs.logPublishInternal, {
                    userId: args.userId,
                    draftId: args.draftId,
                    socialAccountId: args.accountId,
                    platform: 'x',
                    status: 'failed',
                    errorMessage: 'Unauthorized',
                });
                
                return {
                    success: false,
                    error: "Unauthorized",
                };
            }

            // Check if token is expired and refresh if needed
            if (account.tokenExpiresAt && account.tokenExpiresAt < Date.now()) {
                if (!account.refreshToken) {
                    await ctx.runMutation(internal.publishLogs.logPublishInternal, {
                        userId: args.userId,
                        draftId: args.draftId,
                        socialAccountId: account._id,
                        platform: 'x',
                        status: 'failed',
                        errorMessage: 'Access token expired',
                    });
                    
                    return {
                        success: false,
                        error: "Access token expired. Please reconnect your X account.",
                    };
                }

                // Refresh the token
                const X_CLIENT_ID = process.env.X_CLIENT_ID;
                const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;

                if (!X_CLIENT_ID || !X_CLIENT_SECRET) {
                    return {
                        success: false,
                        error: "X OAuth not configured",
                    };
                }

                const authString = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64');

                const refreshResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': `Basic ${authString}`,
                    },
                    body: new URLSearchParams({
                        grant_type: 'refresh_token',
                        refresh_token: account.refreshToken,
                    }),
                });

                if (!refreshResponse.ok) {
                    await ctx.runMutation(internal.publishLogs.logPublishInternal, {
                        userId: args.userId,
                        draftId: args.draftId,
                        socialAccountId: account._id,
                        platform: 'x',
                        status: 'failed',
                        errorMessage: 'Failed to refresh access token',
                    });
                    
                    return {
                        success: false,
                        error: "Failed to refresh access token. Please reconnect your X account.",
                    };
                }

                const refreshData = await refreshResponse.json();

                // Update tokens
                await ctx.runMutation(internal.users.updateSocialAccountTokensInternal, {
                    accountId: account._id,
                    accessToken: refreshData.access_token,
                    refreshToken: refreshData.refresh_token,
                    tokenExpiresAt: Date.now() + (refreshData.expires_in * 1000),
                });

                // Use the new token
                account.accessToken = refreshData.access_token;
            }

            // Get character limit based on account subscription type
            const charLimit = getCharacterLimit(account.subType);
            
            // Split content into thread posts
            const threadPosts = splitIntoThreadPosts(args.content);
            
            // Upload media if provided (will be attached to first tweet only)
            let mediaId: string | null = null;
            if (imageUrl) {
                mediaId = await uploadMediaToX(imageUrl, account.accessToken);
                if (!mediaId) {
                    console.warn('Failed to upload media, proceeding without image');
                }
            }

            // Post thread
            let previousTweetId: string | undefined;
            const postedTweets: Array<{ id: string; text: string }> = [];

            for (let i = 0; i < threadPosts.length; i++) {
                const post = threadPosts[i];
                const cleanedPost = cleanPostContent(post);
                
                // Truncate based on account's character limit
                let tweetText = cleanedPost;
                if (tweetText.length > charLimit) {
                    tweetText = tweetText.substring(0, charLimit - 3) + '...';
                }

                // Build tweet payload
                const tweetPayload: any = {
                    text: tweetText,
                };

                // Add media only to first tweet
                if (i === 0 && mediaId) {
                    tweetPayload.media = {
                        media_ids: [mediaId],
                    };
                }

                // Add reply reference for thread
                if (previousTweetId) {
                    tweetPayload.reply = {
                        in_reply_to_tweet_id: previousTweetId,
                    };
                }

                // Create tweet using X API v2
                const tweetResponse: any = await fetch('https://api.twitter.com/2/tweets', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${account.accessToken}`,
                    },
                    body: JSON.stringify(tweetPayload),
                });

                if (!tweetResponse.ok) {
                    const errorData = await tweetResponse.json();
                    console.error('X API error:', errorData);
                    
                    await ctx.runMutation(internal.publishLogs.logPublishInternal, {
                        userId: args.userId,
                        draftId: args.draftId,
                        socialAccountId: account._id,
                        platform: 'x',
                        status: 'failed',
                        errorMessage: `X API error on tweet ${i + 1}/${threadPosts.length}: ${JSON.stringify(errorData)}`,
                    });
                    
                    return {
                        success: false,
                        error: `Failed to post tweet ${i + 1} of ${threadPosts.length}`,
                    };
                }

                const tweetData = await tweetResponse.json();
                previousTweetId = tweetData.data.id;
                postedTweets.push({
                    id: tweetData.data.id,
                    text: tweetText,
                });
            }

            // Get the first tweet for the URL
            const firstTweetId = postedTweets[0].id;
            const postUrl = `https://twitter.com/${account.username}/status/${firstTweetId}`;

            // Log successful publish
            await ctx.runMutation(internal.publishLogs.logPublishInternal, {
                userId: args.userId,
                draftId: args.draftId,
                socialAccountId: account._id,
                platform: 'x',
                status: 'success',
                postId: firstTweetId,
                postUrl: postUrl,
            });

            return {
                success: true,
                postId: firstTweetId,
                postUrl: postUrl,
            };

        } catch (error) {
            console.error("X publish error:", error);
            
            return {
                success: false,
                error: "Failed to publish to X",
            };
        }
    },
});

/**
 * Publish to LinkedIn - Internal Action
 */
export const publishToLinkedIn = internalAction({
    args: {
        userId: v.id("users"),
        accountId: v.id("socialAccounts"),
        content: v.string(),
        draftId: v.optional(v.id("contentDrafts")),
    },
    returns: v.object({
        success: v.boolean(),
        postId: v.optional(v.string()),
        postUrl: v.optional(v.string()),
        error: v.optional(v.string()),
    }),
    handler: async (ctx, args) => {
        try {
            // Get draft details if draftId is provided (to check for images)
            let imageUrl: string | null = null;
            if (args.draftId) {
                const draft = await ctx.runQuery(internal.contentDrafts.getContentDraftByIdInternal, {
                    draftId: args.draftId,
                });

                if (draft?.imageStorageId) {
                    imageUrl = await ctx.runQuery(internal.ai_tools.getStorageUrlInternal, {
                        storageId: draft.imageStorageId,
                    });
                }
            }

            // Get the social account
            const account: any = await ctx.runQuery(internal.users.getSocialAccountById, {
                accountId: args.accountId,
            });

            if (!account) {
                await ctx.runMutation(internal.publishLogs.logPublishInternal, {
                    userId: args.userId,
                    draftId: args.draftId,
                    socialAccountId: args.accountId,
                    platform: 'linkedin',
                    status: 'failed',
                    errorMessage: 'Social account not found',
                });
                
                return {
                    success: false,
                    error: "Social account not found",
                };
            }

            // Verify account belongs to user
            if (account.userId !== args.userId) {
                await ctx.runMutation(internal.publishLogs.logPublishInternal, {
                    userId: args.userId,
                    draftId: args.draftId,
                    socialAccountId: args.accountId,
                    platform: 'linkedin',
                    status: 'failed',
                    errorMessage: 'Unauthorized',
                });
                
                return {
                    success: false,
                    error: "Unauthorized",
                };
            }

            // Check if token is expired
            if (account.tokenExpiresAt && account.tokenExpiresAt < Date.now()) {
                await ctx.runMutation(internal.publishLogs.logPublishInternal, {
                    userId: args.userId,
                    draftId: args.draftId,
                    socialAccountId: account._id,
                    platform: 'linkedin',
                    status: 'failed',
                    errorMessage: 'Access token expired',
                });

                return {
                    success: false,
                    error: "Access token expired. Please reconnect your LinkedIn account.",
                };
            }

            // Convert accountId to LinkedIn Person URN format
            const authorUrn = `urn:li:person:${account.accountId}`;

            // Handle image upload if present
            let imageAsset: string | null = null;
            if (imageUrl) {
                try {
                    const registerUploadResponse = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${account.accessToken}`,
                            'X-Restli-Protocol-Version': '2.0.0',
                        },
                        body: JSON.stringify({
                            registerUploadRequest: {
                                recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
                                owner: authorUrn,
                                serviceRelationships: [{
                                    relationshipType: 'OWNER',
                                    identifier: 'urn:li:userGeneratedContent'
                                }]
                            }
                        }),
                    });

                    if (registerUploadResponse.ok) {
                        const registerData = await registerUploadResponse.json();
                        const uploadUrl = registerData.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
                        imageAsset = registerData.value.asset;

                        const imageResponse = await fetch(imageUrl);
                        const imageBuffer = await imageResponse.arrayBuffer();

                        const uploadResponse = await fetch(uploadUrl, {
                            method: 'PUT',
                            headers: {
                                'Authorization': `Bearer ${account.accessToken}`,
                            },
                            body: imageBuffer,
                        });

                        if (!uploadResponse.ok) {
                            console.error('Failed to upload image to LinkedIn');
                            imageAsset = null;
                        }
                    }
                } catch (imageError) {
                    console.error('Error uploading image:', imageError);
                }
            }

            // Create LinkedIn UGC Post
            const postPayload: any = {
                author: authorUrn,
                lifecycleState: "PUBLISHED",
                specificContent: {
                    "com.linkedin.ugc.ShareContent": {
                        shareCommentary: {
                            text: args.content
                        },
                        shareMediaCategory: imageAsset ? "IMAGE" : "NONE"
                    }
                },
                visibility: {
                    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                }
            };

            if (imageAsset) {
                postPayload.specificContent["com.linkedin.ugc.ShareContent"].media = [{
                    status: "READY",
                    description: {
                        text: args.content
                    },
                    media: imageAsset,
                    title: {
                        text: "Image"
                    }
                }];
            }

            const postResponse = await fetch('https://api.linkedin.com/v2/ugcPosts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${account.accessToken}`,
                    'X-Restli-Protocol-Version': '2.0.0',
                },
                body: JSON.stringify(postPayload),
            });

            if (!postResponse.ok) {
                const errorData = await postResponse.text();
                console.error('LinkedIn API error:', errorData);
                
                await ctx.runMutation(internal.publishLogs.logPublishInternal, {
                    userId: args.userId,
                    draftId: args.draftId,
                    socialAccountId: account._id,
                    platform: 'linkedin',
                    status: 'failed',
                    errorMessage: `LinkedIn API error: ${errorData}`,
                });

                return {
                    success: false,
                    error: "Failed to post to LinkedIn",
                };
            }

            const postData = await postResponse.json();
            const postId = postData.id;
            const postUrl = `https://www.linkedin.com/feed/update/${postId}`;

            await ctx.runMutation(internal.publishLogs.logPublishInternal, {
                userId: args.userId,
                draftId: args.draftId,
                socialAccountId: account._id,
                platform: 'linkedin',
                status: 'success',
                postId: postId,
                postUrl: postUrl,
            });

            return {
                success: true,
                postId: postId,
                postUrl: postUrl,
            };

        } catch (error) {
            console.error("LinkedIn publish error:", error);
            
            return {
                success: false,
                error: "Failed to publish to LinkedIn",
            };
        }
    },
});
