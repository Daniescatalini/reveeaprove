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
