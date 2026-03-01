'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Twitter, Linkedin, Loader2, CheckCircle2, AlertCircle, Clock, Calendar, X, Edit2, Trash2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';

interface PublishDialogProps {
  userId: Id<"users">;
  draftId: Id<"contentDrafts">;
  platforms: Array<{
    platform: "twitter" | "linkedin" | "blog";
    content: string;
  }>;
}


export function PublishDialog({
  userId,
  draftId,
  platforms,
}: PublishDialogProps) {
  const { user } = useAuth();

  const getInitialScheduleTime = () => {
    const date = new Date();
    date.setMinutes(date.getMinutes() + 5);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const [open, setOpen] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [publishResults, setPublishResults] = useState<Record<string, 'success' | 'error'>>({});
  const [activeTab, setActiveTab] = useState<'now' | 'schedule'>('now');
  const [scheduleInput, setScheduleInput] = useState(getInitialScheduleTime());
  const [parsedDate, setParsedDate] = useState<Date | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<Id<"scheduledPosts"> | null>(null);

  // Get user's social accounts
  const socialAccounts = useQuery(api.users.getSocialAccounts, { userId });
  const updateDraftStatus = useMutation(api.contentDrafts.updateContentDraftStatus);
  const publishedLog = useQuery(api.publishLogs.getDraftPublishLogs, { draftId });
  const scheduledPosts = useQuery(api.scheduledPosts.getDraftScheduledPosts, { draftId });
  const schedulePost = useMutation(api.scheduledPosts.schedulePost);
  const updateScheduledPost = useMutation(api.scheduledPosts.updateScheduledPost);
  const cancelScheduledPost = useMutation(api.scheduledPosts.cancelScheduledPost);
  const deleteScheduledPost = useMutation(api.scheduledPosts.deleteScheduledPost);

  const platformConfig = {
    twitter: {
      icon: Twitter,
      label: 'X (Twitter)',
      color: 'text-gray-800 dark:text-gray-200',
      bgColor: 'bg-gray-50 dark:bg-gray-950',
    },
    x: {
      icon: Twitter,
      label: 'X (Twitter)',
      color: 'text-gray-800 dark:text-gray-200',
      bgColor: 'bg-gray-50 dark:bg-gray-950',
    },
    linkedin: {
      icon: Linkedin,
      label: 'LinkedIn',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    },
  };

  // Parse date input
  useEffect(() => {
    if (scheduleInput) {
      const date = new Date(scheduleInput);
      if (!isNaN(date.getTime())) {
        setParsedDate(date);
      } else {
        setParsedDate(null);
      }
    } else {
      setParsedDate(null);
    }
  }, [scheduleInput]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setScheduleInput(getInitialScheduleTime());
      setEditingScheduleId(null);
      setParsedDate(null);
      setSelectedPlatforms([]);
    }
  }, [open]);

  // Map platform names (content drafts use 'twitter', social accounts use 'x')
  const getPlatformKey = (platform: string) => {
    return platform === 'twitter' ? 'x' : platform;
  };

  const isAccountConnected = (platform: string) => {
    if (!socialAccounts) return false;
    const platformKey = getPlatformKey(platform);
    return socialAccounts.some(
      account => account.platform === platformKey && account.isActive
    );
  };

  const getConnectedAccount = (platform: string) => {
    if (!socialAccounts) return null;
    const platformKey = getPlatformKey(platform);
    return socialAccounts.find(
      account => account.platform === platformKey && account.isActive
    );
  };

  const handleTogglePlatform = (platform: string) => {
    if (!isAccountConnected(platform)) return;

    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handlePublishNow = async () => {
    if (user?.plan === 'free') {
      toast.error('Post publishing is only available on Basic and Pro plans. Please upgrade.');
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast.error('Please select at least one platform');
      return;
    }

    setPublishing(true);
    setPublishResults({});
    const results: Record<string, 'success' | 'error'> = {};

    try {
      for (const platform of selectedPlatforms) {
        const account = getConnectedAccount(platform);
        const platformData = platforms.find(p => p.platform === platform);

        if (!account || !platformData) {
          results[platform] = 'error';
          continue;
        }

        try {
          const response = await fetch(`/api/publish/${getPlatformKey(platform)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accountId: account._id,
              content: platformData.content,
              draftId,
            }),
          });

          if (response.ok) {
            results[platform] = 'success';
          } else {
            const error = await response.json();
            console.error(`Failed to publish to ${platform}:`, error);
            results[platform] = 'error';
          }
        } catch (error) {
          console.error(`Error publishing to ${platform}:`, error);
          results[platform] = 'error';
        }

        setPublishResults({ ...results });
      }

      // Update draft status if at least one platform succeeded
      const hasSuccess = Object.values(results).some(r => r === 'success');
      if (hasSuccess) {
        await updateDraftStatus({
          userId,
          draftId,
          status: 'published',
        });
      }

      // Show summary toast
      const successCount = Object.values(results).filter(r => r === 'success').length;
      const errorCount = Object.values(results).filter(r => r === 'error').length;

      if (errorCount === 0) {
        toast.success(`Published to ${successCount} platform${successCount > 1 ? 's' : ''} successfully!`);
        setOpen(false);
      } else if (successCount > 0) {
        toast.warning(`Published to ${successCount} platform${successCount > 1 ? 's' : ''}, ${errorCount} failed`);
      } else {
        toast.error('Failed to publish to all platforms');
      }
    } catch (error) {
      console.error('Publishing error:', error);
      toast.error('An error occurred while publishing');
    } finally {
      setPublishing(false);
      setSelectedPlatforms([]);
    }
  };

  const handleSchedule = async () => {
    if (user?.plan === 'free') {
      toast.error('Post scheduling is only available on Basic and Pro plans. Please upgrade.');
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast.error('Please select at least one platform');
      return;
    }

    if (!parsedDate) {
      toast.error('Please enter a valid schedule time');
      return;
    }

    if (parsedDate.getTime() <= Date.now()) {
      toast.error('Schedule time must be in the future');
      return;
    }

    setPublishing(true);

    try {
      for (const platform of selectedPlatforms) {
        const account = getConnectedAccount(platform);
        const platformData = platforms.find(p => p.platform === platform);

        if (!account || !platformData) {
          continue;
        }

        await schedulePost({
          userId,
          draftId,
          socialAccountId: account._id,
          platform: getPlatformKey(platform) as "linkedin" | "x" | "twitter",
          content: platformData.content,
          scheduledFor: parsedDate.getTime(),
        });
      }

      toast.success(`Scheduled ${selectedPlatforms.length} post${selectedPlatforms.length > 1 ? 's' : ''} for ${format(parsedDate, 'MMM d, yyyy \'at\' h:mm a')}`);
      setSelectedPlatforms([]);
      setScheduleInput(getInitialScheduleTime());
      setParsedDate(null);
      setOpen(false);
    } catch (error) {
      console.error('Scheduling error:', error);
      toast.error('Failed to schedule posts');
    } finally {
      setPublishing(false);
    }
  };

  const handleCancelSchedule = async (scheduleId: Id<"scheduledPosts">) => {
    try {
      await cancelScheduledPost({ userId, scheduleId });
      toast.success('Schedule cancelled');
    } catch (error) {
      console.error('Error cancelling schedule:', error);
      toast.error('Failed to cancel schedule');
    }
  };

  const handleDeleteSchedule = async (scheduleId: Id<"scheduledPosts">) => {
    try {
      await deleteScheduledPost({ userId, scheduleId });
      toast.success('Schedule deleted');
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast.error('Failed to delete schedule');
    }
  };

  const handleUpdateSchedule = async (scheduleId: Id<"scheduledPosts">) => {
    if (!parsedDate) {
      toast.error('Please enter a valid schedule time');
      return;
    }
    if (parsedDate.getTime() <= Date.now()) {
      toast.error('Schedule time must be in the future');
      return;
    }
    setPublishing(true);
    try {
      await updateScheduledPost({
        userId,
        scheduleId,
        scheduledFor: parsedDate.getTime(),
      });
      toast.success('Schedule updated successfully');
      setEditingScheduleId(null);
      setScheduleInput(getInitialScheduleTime());
      setParsedDate(null);
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast.error('Failed to update schedule');
    } finally {
      setPublishing(false);
    }
  };

  const handlePublishScheduledNow = async (schedule: any) => {
    if (user?.plan === 'free') {
      toast.error('Post publishing is only available on Basic and Pro plans. Please upgrade.');
      return;
    }

    setPublishing(true);
    try {
      const account = getConnectedAccount(schedule.platform);

      // cancel schedule first
      await cancelScheduledPost({ userId, scheduleId: schedule._id });

      if (account) {
        const response = await fetch(`/api/publish/${getPlatformKey(schedule.platform)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountId: account._id,
            content: schedule.content,
            draftId,
          }),
        });

        if (response.ok) {
          await updateDraftStatus({ userId, draftId, status: 'published' });
          toast.success(`Published to ${schedule.platform} successfully!`);
        } else {
          toast.error(`Failed to publish to ${schedule.platform}`);
        }
      } else {
        toast.error(`Account not connected for ${schedule.platform}`);
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to publish now');
    } finally {
      setPublishing(false);
    }
  };

  const availablePlatforms = platforms.filter(p =>
    ['twitter', 'linkedin'].includes(p.platform)
  );

  const connectedCount = availablePlatforms.filter(p => isAccountConnected(p.platform)).length;
  const pendingSchedules = scheduledPosts?.filter(s => s.status === 'pending') || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={connectedCount === 0 && user?.plan !== 'free'}
          onClick={(e) => {
            if (user?.plan === 'free') {
              e.preventDefault();
              toast.error('Post publishing is only available on Basic and Pro plans. Please upgrade.');
            }
          }}
        >
          Publish
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publish to Social Media</DialogTitle>
          <DialogDescription>
            Publish or schedule your content to connected platforms
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'now' | 'schedule')}>
          <TabsList className="w-full grid grid-cols-2 bg-transparent p-0 h-auto rounded-none border-border/40 gap-1 pb-1">
            <TabsTrigger value="now" className="rounded-none data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none border border-transparent py-1.5 text-[10px] uppercase font-mono tracking-wider transition-all">Publish Now</TabsTrigger>
            <TabsTrigger value="schedule" className="rounded-none data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none border border-transparent py-1.5 text-[10px] uppercase font-mono tracking-wider transition-all">Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="now" className="space-y-4">
            <div className="space-y-3">
              <Label>Select Platforms</Label>
              {availablePlatforms.map((platformData) => {
                const platform = platformData.platform;
                const config = platformConfig[platform as keyof typeof platformConfig];
                const Icon = config?.icon || Twitter;
                const connected = isAccountConnected(platform);
                const isSelected = selectedPlatforms.includes(platform);
                const isPublished = publishedLog?.some(log => log.platform === getPlatformKey(platform) && log.status === "success");

                return (
                  <div
                    key={platform}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border transition-colors
                      ${!connected || publishing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-accent'}
                      ${isSelected ? 'bg-accent border-primary' : ''}
                    `}
                    onClick={() => {
                      if (connected && !publishing) {
                        handleTogglePlatform(platform);
                      }
                    }}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={!connected || publishing}
                      className="pointer-events-none"
                    />
                    <Icon className={`h-5 w-5 ${config?.color}`} />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{config?.label || platform}</div>
                      {!connected && (
                        <div className="text-xs text-muted-foreground">Not connected</div>
                      )}
                    </div>
                    {isPublished && (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Published
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>

            {Object.keys(publishResults).length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>Results</Label>
                  {Object.entries(publishResults).map(([platform, result]) => {
                    const config = platformConfig[platform as keyof typeof platformConfig];
                    return (
                      <div key={platform} className="flex items-center gap-2 text-sm">
                        {result === 'success' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span>{config?.label || platform}</span>
                        <span className={result === 'success' ? 'text-green-600' : 'text-red-600'}>
                          {result === 'success' ? 'Success' : 'Failed'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            <div className="space-y-3">
              <Label>Select Platforms</Label>
              {availablePlatforms.map((platformData) => {
                const platform = platformData.platform;
                const config = platformConfig[platform as keyof typeof platformConfig];
                const Icon = config?.icon || Twitter;
                const connected = isAccountConnected(platform);
                const isSelected = selectedPlatforms.includes(platform);

                return (
                  <div
                    key={platform}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border transition-colors
                      ${!connected || publishing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-accent'}
                      ${isSelected ? 'bg-accent border-primary' : ''}
                    `}
                    onClick={() => {
                      if (connected && !publishing) {
                        handleTogglePlatform(platform);
                      }
                    }}
                  >
                    <Checkbox
                      checked={isSelected}
                      disabled={!connected || publishing}
                      className="pointer-events-none"
                    />
                    <Icon className={`h-5 w-5 ${config?.color}`} />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{config?.label || platform}</div>
                      {!connected && (
                        <div className="text-xs text-muted-foreground">Not connected</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {!editingScheduleId && (
              <div className="space-y-2">
                <Label htmlFor="schedule-input">Schedule Time</Label>
                <Input
                  id="schedule-input"
                  type="datetime-local"
                  value={scheduleInput}
                  onChange={(e) => setScheduleInput(e.target.value)}
                  disabled={publishing}
                  className="w-full flex-1"
                />
                {parsedDate && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                    <Calendar className="h-4 w-4" />
                    <span>Will be published on {format(parsedDate, 'MMM d, yyyy \'at\' h:mm a')}</span>
                  </div>
                )}
                {selectedPlatforms.length > 0 && parsedDate && (
                  <Button
                    onClick={handleSchedule}
                    disabled={publishing}
                    className="w-full mt-2"
                  >
                    {publishing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Scheduling...
                      </>
                    ) : (
                      <>
                        <Clock className="h-4 w-4 mr-2" />
                        Schedule Post
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {pendingSchedules.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>Scheduled Posts</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {pendingSchedules.map((schedule) => {
                      const config = platformConfig[schedule.platform as keyof typeof platformConfig];
                      const Icon = config?.icon || Twitter;
                      const isEditing = editingScheduleId === schedule._id;

                      return (
                        <div key={schedule._id} className="flex flex-col gap-3 p-3 rounded-lg border">
                          <div className="flex items-center gap-3">
                            <Icon className={`h-4 w-4 ${config?.color}`} />
                            <div className="flex-1">
                              <div className="text-sm font-medium">{config?.label || schedule.platform}</div>
                              {!isEditing && (
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(schedule.scheduledFor), 'MMM d, yyyy \'at\' h:mm a')}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {!isEditing && (
                                <Button
                                  size="sm"
                                  title="Publish Now"
                                  variant="ghost"
                                  onClick={() => handlePublishScheduledNow(schedule)}
                                  disabled={publishing}
                                >
                                  <Send className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                title={isEditing ? "Save Time" : "Edit Time"}
                                variant="ghost"
                                onClick={() => {
                                  if (isEditing) {
                                    handleUpdateSchedule(schedule._id);
                                  } else {
                                    setEditingScheduleId(schedule._id);
                                    const date = new Date(schedule.scheduledFor);
                                    const localIso = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                                    setScheduleInput(localIso);
                                  }
                                }}
                                disabled={publishing}
                              >
                                {isEditing ? <CheckCircle2 className="h-3 w-3" /> : <Edit2 className="h-3 w-3" />}
                              </Button>
                              <Button
                                size="sm"
                                title="Cancel Schedule"
                                variant="ghost"
                                onClick={() => {
                                  if (isEditing) {
                                    setEditingScheduleId(null);
                                    setScheduleInput(getInitialScheduleTime());
                                  } else {
                                    handleCancelSchedule(schedule._id);
                                  }
                                }}
                                disabled={publishing}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          {isEditing && (
                            <div className="space-y-2 pt-2 border-t">
                              <Input
                                type="datetime-local"
                                className="h-8 text-xs"
                                value={scheduleInput}
                                onChange={(e) => setScheduleInput(e.target.value)}
                                disabled={publishing}
                              />
                              {parsedDate && (
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(parsedDate, 'MMM d, yyyy \'at\' h:mm a')}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          {activeTab === 'now' && (
            <Button
              onClick={handlePublishNow}
              disabled={selectedPlatforms.length === 0 || publishing}
            >
              {publishing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Publish Now
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

