export type UserRole = "agency" | "member" | "client";

export type ContentStatus =
  | "draft"
  | "creating"
  | "awaiting_approval"
  | "approved"
  | "revision_requested"
  | "scheduled"
  | "published";

export type PipelineStage =
  | "needs_recording"
  | "needs_design"
  | "needs_caption"
  | "waiting_client"
  | "revision"
  | "approved"
  | "published";

export type MediaType = "image" | "video";
export type ContentFormat = "static" | "carousel" | "video";

export type Profile = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string | null;
  agency_id?: string | null;
  client_id?: string | null;
};

export type Agency = {
  id: string;
  name: string;
  owner_id: string;
  billing_document?: string | null;
  workspace_settings?: Record<string, unknown> | null;
};

export type Client = {
  id: string;
  agency_id: string;
  name: string;
  email?: string | null;
  instagram_handle?: string | null;
  phone?: string | null;
  avatar?: string | null;
  brand_color?: string | null;
  invite_code?: string | null;
};

export type PostMedia = {
  id: string;
  post_id: string;
  media_url: string;
  media_type: MediaType;
  thumbnail_url?: string | null;
  order_index: number;
};

export type Post = {
  id: string;
  client_id: string;
  title: string;
  caption?: string | null;
  instructions?: string | null;
  status: ContentStatus;
  pipeline_stage: PipelineStage;
  content_format?: ContentFormat | null;
  scheduled_date: string;
  scheduled_time?: string | null;
  feed_order: number;
  created_by?: string | null;
  created_at: string;
  submitted_at?: string | null;
  approved_at?: string | null;
  revision_requested_at?: string | null;
  scheduled_at?: string | null;
  updated_at?: string | null;
  media: PostMedia[];
};

export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
};

export type TeamMember = {
  id: string;
  agency_id: string;
  user_id?: string | null;
  name: string;
  email: string;
  role_title: string;
  avatar?: string | null;
  access_code: string;
  status: "active" | "invited" | "inactive";
  created_at: string;
  updated_at?: string | null;
};

export type SubscriptionPlan = "start" | "studio" | "premium";
export type BillingCycle = "monthly" | "annual";
export type SubscriptionStatus = "trial" | "active" | "past_due" | "suspended" | "cancelled" | "exempt";
export type BillingPaymentStatus = "pending" | "confirmed" | "received" | "overdue" | "failed" | "cancelled" | "refunded";
export type ReferralStatus = "pending" | "active" | "converted" | "credited" | "cancelled";
export type CampaignStatus = "creating" | "awaiting_approval" | "approved" | "active" | "paused" | "finished" | "revision_requested";
export type CampaignPlatform = "Meta Ads" | "Google Ads" | "TikTok Ads" | "Pinterest Ads" | "Outra";
export type MonthlyGoalStatus = "planned" | "in_progress" | "done" | "paused" | "cancelled";
export type ActivityItemType = "post" | "campaign" | "monthly_goal";
export type NotificationItemType = ActivityItemType | "billing" | "referral";

export type Subscription = {
  id: string;
  agency_id: string;
  plan: SubscriptionPlan;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  asaas_customer_id?: string | null;
  asaas_subscription_id?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  past_due_since?: string | null;
  suspended_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  trial_ends_at?: string | null;
  payment_method?: string | null;
  next_invoice_url?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type BillingHistory = {
  id: string;
  agency_id: string;
  subscription_id?: string | null;
  asaas_payment_id?: string | null;
  amount: number;
  status: BillingPaymentStatus | string;
  due_date?: string | null;
  paid_at?: string | null;
  invoice_url?: string | null;
  payment_method?: string | null;
  created_at: string;
};

export type BillingEvent = {
  id: string;
  agency_id?: string | null;
  event_type: string;
  description?: string | null;
  raw_payload?: Record<string, unknown> | null;
  created_at: string;
};

export type CampaignMedia = {
  id: string;
  campaign_id: string;
  url: string;
  type: MediaType;
  order_index: number;
  created_at?: string | null;
};

export type Campaign = {
  id: string;
  agency_id: string;
  client_id: string;
  title: string;
  objective?: string | null;
  platform: CampaignPlatform | string;
  audience?: string | null;
  daily_budget?: number | null;
  total_budget?: number | null;
  start_date: string;
  end_date?: string | null;
  status: CampaignStatus;
  responsible_user_id?: string | null;
  responsible_name?: string | null;
  copy?: string | null;
  internal_notes?: string | null;
  client_feedback?: string | null;
  created_at: string;
  updated_at?: string | null;
  media: CampaignMedia[];
};

export type MonthlyGoal = {
  id: string;
  agency_id: string;
  client_id: string;
  month: number;
  year: number;
  title: string;
  description?: string | null;
  planned_actions?: string | null;
  responsible_user_id?: string | null;
  responsible_name?: string | null;
  status: MonthlyGoalStatus;
  client_feedback?: string | null;
  result_notes?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type ActivityHistory = {
  id: string;
  agency_id: string;
  client_id?: string | null;
  item_type: ActivityItemType;
  item_id: string;
  action: string;
  user_id?: string | null;
  description?: string | null;
  created_at: string;
};

export type StoredNotification = {
  id: string;
  agency_id: string;
  client_id?: string | null;
  recipient_user_id?: string | null;
  item_type: NotificationItemType;
  item_id?: string | null;
  title: string;
  detail?: string | null;
  read_at?: string | null;
  created_at: string;
};

export type ExemptAccount = {
  id: string;
  agency_id?: string | null;
  email?: string | null;
  reason?: string | null;
  created_by?: string | null;
  created_at: string;
};

export type Referral = {
  id: string;
  agency_id: string;
  referral_code: string;
  referred_agency_id?: string | null;
  discount_percent: number;
  status: ReferralStatus;
  created_at: string;
  converted_at?: string | null;
};
