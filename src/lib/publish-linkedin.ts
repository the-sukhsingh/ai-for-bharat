import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export interface ConvexContext {
  query: <T = any>(query: any, args: any) => Promise<T>;
  mutation: <T = any>(mutation: any, args: any) => Promise<T>;
}

export interface PublishLinkedInParams {
  userId: Id<"users">;
  accountId: Id<"socialAccounts">;
  content: string;
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
 * Publish content to LinkedIn
 * Uses LinkedIn UGC Post API to create posts with text and images
 * Reference: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin
 */
export async function publishToLinkedIn({
  userId,
  accountId,
  content,
  draftId,
  convexContext,
}: PublishLinkedInParams): Promise<PublishResult> {
  try {
    // Get draft details if draftId is provided (to check for images)
    let imageUrl: string | null = null;
    if (draftId) {
      const draft = await convexContext.query(api.contentDrafts.getContentDraftById, {
        draftId,
        requestingUserId: userId,
      });

      if (draft?.imageStorageId) {
        imageUrl = await convexContext.query(api.ai_tools.getStorageUrl, {
          storageId: draft.imageStorageId,
        });
      }
    }

    // Get the social account from Convex
    const account = await convexContext.query(api.users.getSocialAccountWithTokens, {
      accountId,
    });

    if (!account) {
      await convexContext.mutation(api.publishLogs.logPublish, {
        userId,
        draftId,
        socialAccountId: accountId,
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
    if (account.userId !== userId) {
      await convexContext.mutation(api.publishLogs.logPublish, {
        userId,
        draftId,
        socialAccountId: accountId,
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
      // LinkedIn tokens don't have refresh tokens in the standard OAuth flow
      // User needs to reconnect
      await convexContext.mutation(api.publishLogs.logPublish, {
        userId,
        draftId,
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
        // Step 1: Register the upload with LinkedIn
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

          // Step 2: Download image from Convex
          const imageResponse = await fetch(imageUrl);
          const imageBuffer = await imageResponse.arrayBuffer();

          // Step 3: Upload the image binary to LinkedIn
          const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${account.accessToken}`,
            },
            body: imageBuffer,
          });

          if (!uploadResponse.ok) {
            console.error('Failed to upload image to LinkedIn');
            imageAsset = null; // Continue without image if upload fails
          }
        } else {
          console.error('Failed to register upload with LinkedIn');
        }
      } catch (imageError) {
        console.error('Error uploading image:', imageError);
        // Continue without image if there's an error
      }
    }

    // Create LinkedIn UGC Post
    // Reference: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/ugc-post-api
    const postPayload: any = {
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: content
          },
          shareMediaCategory: imageAsset ? "IMAGE" : "NONE"
        }
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
      }
    };

    // Add media if image was successfully uploaded
    if (imageAsset) {
      postPayload.specificContent["com.linkedin.ugc.ShareContent"].media = [{
        status: "READY",
        description: {
          text: content
        },
        media: imageAsset,
        title: {
          text: "Image"
        }
      }];
    }

    // Create post using LinkedIn UGC API
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
      
      // Log failed publish
      await convexContext.mutation(api.publishLogs.logPublish, {
        userId,
        draftId,
        socialAccountId: account._id,
        platform: 'linkedin',
        status: 'failed',
        errorMessage: `LinkedIn API error: ${errorData}`,
      });

      return {
        success: false,
        error: "Failed to post to LinkedIn",
        details: errorData,
      };
    }

    const postData = await postResponse.json();
    
    // Extract post ID from response
    const postId = postData.id;
    
    // LinkedIn post URL format
    const postUrl = `https://www.linkedin.com/feed/update/${postId}`;

    // Log successful publish
    await convexContext.mutation(api.publishLogs.logPublish, {
      userId,
      draftId,
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
      details: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
