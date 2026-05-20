import { NextResponse } from "next/server";
import { asaasRequest, asaasSubscriptionPayload, getTrialDueDate } from "@/lib/asaas";
import { generateReferralCode, getEstimatedPriceWithReferralDiscount } from "@/lib/plans";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { BillingCycle, SubscriptionPlan } from "@/types/domain";

async function getAgencyBillingEmail(agencyId: string, fallback?: string | null) {
  if (fallback) return fallback;
  if (!supabaseAdmin) return undefined;
  const { data } = await supabaseAdmin
    .from("users")
    .select("email")
    .eq("agency_id", agencyId)
    .eq("role", "agency")
    .maybeSingle();
  return data?.email ?? undefined;
}

async function getActiveReferralCount(agencyId: string) {
  if (!supabaseAdmin) return 0;
  const { count } = await supabaseAdmin
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agencyId)
    .in("status", ["active", "converted", "credited"]);
  return count ?? 0;
}

function toDateOnly(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function getTrialEndIso(subscription: any) {
  const existingTrial = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
  if (existingTrial && !Number.isNaN(existingTrial.getTime()) && existingTrial.getTime() > Date.now()) {
    return existingTrial.toISOString();
  }
  return new Date(Date.now() + 7 * 86400000).toISOString();
}

async function ensureAsaasSubscription(input: {
  agencyId: string;
  agency: any;
  subscription: any;
  plan: SubscriptionPlan;
  billingCycle: BillingCycle;
}) {
  const activeReferralCount = await getActiveReferralCount(input.agencyId);
  const subscriptionValue = getEstimatedPriceWithReferralDiscount(input.plan, input.billingCycle, activeReferralCount);
  let asaasSubscriptionId = input.subscription?.asaas_subscription_id ?? null;
  let customerId = input.subscription?.asaas_customer_id ?? null;

  if (!customerId) {
    const billingEmail = await getAgencyBillingEmail(input.agencyId, input.agency?.email);
    const customer = await asaasRequest<{ id: string }>("/customers", {
      method: "POST",
      body: {
        name: input.agency?.name ?? "Agência ReveeAprove",
        email: billingEmail
      }
    });
    customerId = customer.id;
  }

  if (!asaasSubscriptionId) {
    const trialEndsAt = getTrialEndIso(input.subscription);
    const created = await asaasRequest<{ id: string }>("/subscriptions", {
      method: "POST",
      body: asaasSubscriptionPayload({
        customer: customerId,
        plan: input.plan,
        cycle: input.billingCycle,
        value: subscriptionValue,
        nextDueDate: toDateOnly(trialEndsAt) ?? getTrialDueDate()
      })
    });
    asaasSubscriptionId = created.id;
  }

  const trialEndsAt = getTrialEndIso(input.subscription);
  const { data: updated } = await supabaseAdmin!
    .from("subscriptions")
    .upsert({
      agency_id: input.agencyId,
      plan: input.plan,
      billing_cycle: input.billingCycle,
      status: input.subscription?.status === "exempt" ? "exempt" : input.subscription?.status ?? "trial",
      asaas_customer_id: customerId,
      asaas_subscription_id: asaasSubscriptionId,
      trial_ends_at: input.subscription?.trial_ends_at ?? trialEndsAt,
      current_period_start: input.subscription?.current_period_start ?? new Date().toISOString(),
      current_period_end: input.subscription?.current_period_end ?? trialEndsAt,
      updated_at: new Date().toISOString()
    }, { onConflict: "agency_id" })
    .select()
    .single();

  return { subscription: updated, asaasSubscriptionId };
}

async function getLatestSubscriptionPayment(asaasSubscriptionId: string) {
  const response = await asaasRequest<{ data?: any[] }>(`/subscriptions/${asaasSubscriptionId}/payments?limit=10`);
  const payments = response.data ?? [];
  return payments.find((payment) => ["PENDING", "OVERDUE"].includes(payment.status))
    ?? payments.find((payment) => payment.invoiceUrl || payment.bankSlipUrl || payment.paymentLink)
    ?? payments[0]
    ?? null;
}

function getPaymentUrl(payment: any) {
  return payment?.invoiceUrl ?? payment?.bankSlipUrl ?? payment?.paymentLink ?? null;
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: "Supabase admin não configurado." }, { status: 500 });
    const body = await request.json();
    const agencyId = String(body.agencyId ?? "");
    const action = String(body.action ?? "");
    if (!agencyId) return NextResponse.json({ error: "Agência não informada." }, { status: 400 });

    const { data: agency } = await supabaseAdmin.from("agencies").select("*").eq("id", agencyId).single();
    const { data: subscription } = await supabaseAdmin.from("subscriptions").select("*").eq("agency_id", agencyId).maybeSingle();

    if (action === "change_plan") {
      const plan = (body.plan ?? "studio") as SubscriptionPlan;
      const billingCycle = (body.billingCycle ?? "monthly") as BillingCycle;
      const applyNextCycle = Boolean(body.applyNextCycle);
      const activeReferralCount = await getActiveReferralCount(agencyId);
      const subscriptionValue = getEstimatedPriceWithReferralDiscount(plan, billingCycle, activeReferralCount);

      let asaasSubscriptionId = subscription?.asaas_subscription_id ?? null;
      let customerId = subscription?.asaas_customer_id ?? null;

      if (!customerId) {
        const billingEmail = await getAgencyBillingEmail(agencyId, agency?.email);
        const customer = await asaasRequest<{ id: string }>("/customers", {
          method: "POST",
          body: {
            name: agency?.name ?? "Agência ReveeAprove",
            email: billingEmail
          }
        });
        customerId = customer.id;
      }

      if (asaasSubscriptionId && !applyNextCycle) {
        await asaasRequest(`/subscriptions/${asaasSubscriptionId}`, {
          method: "PUT",
          body: asaasSubscriptionPayload({ customer: customerId, plan, cycle: billingCycle, value: subscriptionValue })
        });
      } else if (!asaasSubscriptionId) {
        const trialEndsAt = getTrialEndIso(subscription);
        const created = await asaasRequest<{ id: string }>("/subscriptions", {
          method: "POST",
          body: asaasSubscriptionPayload({
            customer: customerId,
            plan,
            cycle: billingCycle,
            value: subscriptionValue,
            nextDueDate: toDateOnly(trialEndsAt) ?? getTrialDueDate()
          })
        });
        asaasSubscriptionId = created.id;
      }

      const trialEndsAt = getTrialEndIso(subscription);
      const { data: updated } = await supabaseAdmin
        .from("subscriptions")
        .upsert({
          agency_id: agencyId,
          plan,
          billing_cycle: billingCycle,
          status: subscription?.status === "exempt" ? "exempt" : subscription?.status ?? "trial",
          asaas_customer_id: customerId,
          asaas_subscription_id: asaasSubscriptionId,
          trial_ends_at: subscription?.trial_ends_at ?? trialEndsAt,
          current_period_start: subscription?.current_period_start ?? new Date().toISOString(),
          current_period_end: subscription?.current_period_end ?? trialEndsAt,
          updated_at: new Date().toISOString()
        }, { onConflict: "agency_id" })
        .select()
        .single();

      return NextResponse.json({
        subscription: updated,
        message: applyNextCycle ? "Alteração programada para o próximo ciclo." : "Plano atualizado."
      });
    }

    if (action === "cancel") {
      if (subscription?.asaas_subscription_id) {
        await asaasRequest(`/subscriptions/${subscription.asaas_subscription_id}`, { method: "DELETE" });
      }
      const { data: updated } = await supabaseAdmin
        .from("subscriptions")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancel_reason: body.reason ?? null,
          updated_at: new Date().toISOString()
        })
        .eq("agency_id", agencyId)
        .select()
        .single();
      return NextResponse.json({ subscription: updated, message: "Assinatura cancelada." });
    }

    if (action === "reactivate") {
      const { data: updated } = await supabaseAdmin
        .from("subscriptions")
        .update({
          status: "active",
          cancelled_at: null,
          suspended_at: null,
          past_due_since: null,
          updated_at: new Date().toISOString()
        })
        .eq("agency_id", agencyId)
        .select()
        .single();
      return NextResponse.json({ subscription: updated, message: "Assinatura reativada." });
    }

    if (action === "payment_link" || action === "update_payment") {
      if (subscription?.status === "exempt") {
        return NextResponse.json({
          checkoutUrl: null,
          message: "Essa conta está liberada manualmente e não precisa de pagamento."
        });
      }

      const plan = (subscription?.plan ?? "studio") as SubscriptionPlan;
      const billingCycle = (subscription?.billing_cycle ?? "monthly") as BillingCycle;
      const ensured = await ensureAsaasSubscription({ agencyId, agency, subscription, plan, billingCycle });
      const payment = await getLatestSubscriptionPayment(ensured.asaasSubscriptionId);
      const invoiceUrl = getPaymentUrl(payment);

      if (payment) {
        await supabaseAdmin.from("billing_history").upsert({
          agency_id: agencyId,
          subscription_id: ensured.subscription?.id ?? subscription?.id ?? null,
          asaas_payment_id: payment.id,
          amount: Number(payment.value ?? 0),
          status: String(payment.status ?? "pending").toLowerCase(),
          due_date: payment.dueDate ?? null,
          paid_at: payment.paymentDate ?? payment.clientPaymentDate ?? null,
          invoice_url: invoiceUrl,
          payment_method: payment.billingType ?? null
        }, { onConflict: "asaas_payment_id" });
      }

      if (invoiceUrl) {
        await supabaseAdmin
          .from("subscriptions")
          .update({ next_invoice_url: invoiceUrl, updated_at: new Date().toISOString() })
          .eq("agency_id", agencyId);
      }

      return NextResponse.json({
        checkoutUrl: invoiceUrl,
        subscription: ensured.subscription,
        message: invoiceUrl ? "Abrindo pagamento." : "Assinatura criada. O link de pagamento ainda não foi liberado pelo Asaas; tente novamente em alguns segundos."
      });
    }

    if (action === "ensure_referral") {
      const code = generateReferralCode(agency?.name ?? agencyId);
      const { data: existing } = await supabaseAdmin
        .from("referrals")
        .select("*")
        .eq("agency_id", agencyId)
        .is("referred_agency_id", null)
        .maybeSingle();
      if (existing) return NextResponse.json({ referral: existing });
      const { data } = await supabaseAdmin
        .from("referrals")
        .insert({ agency_id: agencyId, referral_code: code, discount_percent: 10, reward_amount: 3 })
        .select()
        .single();
      return NextResponse.json({ referral: data });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro na assinatura." }, { status: 500 });
  }
}
