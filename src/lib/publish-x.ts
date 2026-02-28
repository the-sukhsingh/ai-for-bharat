import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export interface ConvexContext {
  query: <T = any>(query: any, args: any) => Promise<T>;
  mutation: <T = any>(mutation: any, args: any) => Promise<T>;
}

export interface PublishXParams {
  userId: Id<"users">;
  accountId: Id<"socialAccounts">;
  content: string;
  imageUrl?: string | null;
  draftId?: Id<"contentDrafts">;
  convexContext: ConvexContext;
}

export interface PublishResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
  details?: any;
}

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
 * Publish content to X (Twitter)
 * Uses X API v2 to create tweets or threads
 */
export async function publishToX({
  userId,
  accountId,
  content,
  imageUrl,
  draftId,
  convexContext,
}: PublishXParams): Promise<PublishResult> {
  try {
    // Get the social account from Convex
    const account = await convexContext.query(api.users.getSocialAccountWithTokens, {
      accountId,
    });

    if (!account) {
      await convexContext.mutation(api.publishLogs.logPublish, {
        userId,
        draftId,
        socialAccountId: accountId,
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
    if (account.userId !== userId) {
      await convexContext.mutation(api.publishLogs.logPublish, {
        userId,
        draftId,
        socialAccountId: accountId,
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
      // Token is expired, attempt to refresh
      if (!account.refreshToken) {
        await convexContext.mutation(api.publishLogs.logPublish, {
          userId,
          draftId,
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
        await convexContext.mutation(api.publishLogs.logPublish, {
          userId,
          draftId,
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

      // Update tokens in Convex
      await convexContext.mutation(api.users.updateSocialAccountTokens, {
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
    const threadPosts = splitIntoThreadPosts(content);
    
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
      const tweetResponse = await fetch('https://api.twitter.com/2/tweets', {
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
        
        // Log failed publish
        await convexContext.mutation(api.publishLogs.logPublish, {
          userId,
          draftId,
          socialAccountId: account._id,
          platform: 'x',
          status: 'failed',
          errorMessage: `X API error on tweet ${i + 1}/${threadPosts.length}: ${JSON.stringify(errorData)}`,
        });
        
        return {
          success: false,
          error: `Failed to post tweet ${i + 1} of ${threadPosts.length}`,
          details: errorData,
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
    await convexContext.mutation(api.publishLogs.logPublish, {
      userId,
      draftId,
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
      details: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
