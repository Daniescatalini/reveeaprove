import type { BillingCycle, Subscription, SubscriptionPlan, SubscriptionStatus } from "@/types/domain";

export type FeatureName =
  | "custom_cover"
  | "agency_branding"
  | "full_history"
  | "full_pipeline"
  | "team_members"
  | "unlimited_clients"
  | "premium_profile"
  | "advanced_notifications"
  | "advanced_customization"
  | "future_automations"
  | "priority_support"
  | "analytics"
  | "reports";

type PlanConfig = {
  id: SubscriptionPlan;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  clientLimit: number | null;
  memberLimit: number;
  monthlyContentLimit: number | null;
  storageLimitMb?: number | null;
  features: FeatureName[];
};

export const PLANS: Record<SubscriptionPlan, PlanConfig> = {
  start: {
    id: "start",
    name: "Start",
    monthlyPrice: 19.9,
    annualPrice: 199,
    clientLimit: 2,
    memberLimit: 0,
    monthlyContentLimit: 20,
    storageLimitMb: null,
    features: []
  },
  studio: {
    id: "studio",
    name: "Studio",
    monthlyPrice: 49.9,
    annualPrice: 499,
    clientLimit: 10,
    memberLimit: 2,
    monthlyContentLimit: null,
    storageLimitMb: null,
    features: ["team_members", "custom_cover", "agency_branding", "full_history", "full_pipeline"]
  },
  premium: {
    id: "premium",
    name: "Premium",
    monthlyPrice: 97.9,
    annualPrice: 979,
    clientLimit: null,
    memberLimit: 10,
    monthlyContentLimit: null,
    storageLimitMb: null,
    features: ["custom_cover", "agency_branding", "full_history", "full_pipeline", "team_members", "unlimited_clients", "premium_profile", "advanced_notifications", "advanced_customization", "future_automations", "priority_support", "analytics", "reports"]
  }
};

export const REFERRAL_DISCOUNTS = {
  newAgencyPercent: 10,
  rewardPerActiveReferral: 3,
  maxPercent: 80,
  studioMinimumCharge: 10
};

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function getPlanPrice(plan: SubscriptionPlan, cycle: BillingCycle) {
  const config = PLANS[plan];
  return cycle === "annual" ? config.annualPrice : config.monthlyPrice;
}

export function getPlanLabel(plan?: SubscriptionPlan | null) {
  return plan ? PLANS[plan]?.name ?? "Plano" : "Sem plano";
}

export function getStatusLabel(status?: SubscriptionStatus | null) {
  const labels: Record<SubscriptionStatus, string> = {
    trial: "Período gratuito",
    active: "Ativa",
    past_due: "Pagamento pendente",
    suspended: "Suspensa",
    cancelled: "Cancelada",
    exempt: "Conta liberada manualmente"
  };
  return status ? labels[status] : "Sem assinatura";
}

export function getPastDueDaysLeft(subscription?: Subscription | null) {
  if (!subscription?.past_due_since) return null;
  const started = new Date(subscription.past_due_since).getTime();
  if (Number.isNaN(started)) return null;
  const elapsedDays = Math.floor((Date.now() - started) / 86400000);
  return Math.max(0, 5 - elapsedDays);
}

export function shouldSuspendAccess(subscription?: Subscription | null) {
  if (!subscription) return false;
  if (subscription.status === "suspended") return true;
  if (subscription.status !== "past_due") return false;
  const daysLeft = getPastDueDaysLeft(subscription);
  return daysLeft !== null && daysLeft <= 0;
}

export function canUseFeature(subscription: Subscription | null | undefined, feature: FeatureName) {
  if (!subscription) return false;
  if (subscription.status === "exempt") return true;
  return PLANS[subscription.plan]?.features.includes(feature) ?? false;
}

export function getLimit(subscription: Subscription | null | undefined, limit: "clients" | "members") {
  if (!subscription) return 0;
  if (subscription.status === "exempt") return null;
  const plan = PLANS[subscription.plan];
  return limit === "clients" ? plan.clientLimit : plan.memberLimit;
}

export function getContentLimit(subscription: Subscription | null | undefined) {
  if (!subscription) return 0;
  if (subscription.status === "exempt") return null;
  return PLANS[subscription.plan]?.monthlyContentLimit ?? null;
}

export function getReferralDiscountAmount(plan: SubscriptionPlan, cycle: BillingCycle, activeReferralCount: number) {
  if (cycle === "annual") return 0;
  const basePrice = getPlanPrice(plan, cycle);
  const rawDiscount = activeReferralCount * REFERRAL_DISCOUNTS.rewardPerActiveReferral;
  const maxDiscount = basePrice * (REFERRAL_DISCOUNTS.maxPercent / 100);
  const minCharge = plan === "studio" ? REFERRAL_DISCOUNTS.studioMinimumCharge : 1;
  return Math.max(0, Math.min(rawDiscount, maxDiscount, Math.max(0, basePrice - minCharge)));
}

export function getEstimatedPriceWithReferralDiscount(plan: SubscriptionPlan, cycle: BillingCycle, activeReferralCount: number) {
  return Math.max(0, getPlanPrice(plan, cycle) - getReferralDiscountAmount(plan, cycle, activeReferralCount));
}

export function generateReferralCode(seed: string) {
  return seed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 8)
    .toUpperCase()
    .padEnd(6, "R");
}
