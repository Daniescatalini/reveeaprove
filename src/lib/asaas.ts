import type { BillingCycle, SubscriptionPlan } from "@/types/domain";
import { getPlanPrice } from "@/lib/plans";

const ASAAS_API_URL = process.env.ASAAS_API_URL ?? "https://api.asaas.com/v3";
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const TRIAL_DAYS = 7;

export function getTrialDueDate() {
  return new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString().slice(0, 10);
}

type AsaasRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
};

export async function asaasRequest<T>(path: string, options: AsaasRequestOptions = {}) {
  if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY não configurada.");
  const response = await fetch(`${ASAAS_API_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      access_token: ASAAS_API_KEY
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(data?.errors) ? data.errors.map((item: any) => item.description).join(" ") : "Erro no Asaas.";
    throw new Error(message);
  }
  return data as T;
}

export function asaasBillingType(paymentMethod?: string | null) {
  if (paymentMethod === "credit_card") return "CREDIT_CARD";
  if (paymentMethod === "pix") return "PIX";
  return "UNDEFINED";
}

export function asaasSubscriptionPayload(input: {
  customer: string;
  plan: SubscriptionPlan;
  cycle: BillingCycle;
  paymentMethod?: string | null;
  nextDueDate?: string;
  value?: number;
  externalReference?: string;
}) {
  return {
    customer: input.customer,
    billingType: asaasBillingType(input.paymentMethod),
    value: input.value ?? getPlanPrice(input.plan, input.cycle),
    nextDueDate: input.nextDueDate ?? getTrialDueDate(),
    cycle: input.cycle === "annual" ? "YEARLY" : "MONTHLY",
    description: `ReveeAprove - Plano ${input.plan === "premium" ? "Premium" : input.plan === "studio" ? "Studio" : "Start"}`,
    externalReference: input.externalReference
  };
}
