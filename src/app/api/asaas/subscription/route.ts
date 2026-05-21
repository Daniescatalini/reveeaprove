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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPaymentUrl(payment: any) {
  return payment?.invoiceUrl ?? payment?.bankSlipUrl ?? payment?.paymentLink ?? payment?.transactionReceiptUrl ?? null;
}

function normalizeBillingDocument(value?: unknown) {
  const digits = value ? String(value).replace(/\D/g, "") : "";
  return digits || null;
}

async function persistBillingDocument(agencyId: string, document?: string | null) {
  if (!document) return;
  await supabaseAdmin!.from("agencies").update({ billing_document: document }).eq("id", agencyId);
}

async function ensureAsaasSubscription(input: {
  agencyId: string;
  agency: any;
  subscription: any;
  plan: SubscriptionPlan;
  billingCycle: BillingCycle;
  billingDocument?: string | null;
  paymentMethod?: string | null;
}) {
  const activeReferralCount = await getActiveReferralCount(input.agencyId);
  const subscriptionValue = getEstimatedPriceWithReferralDiscount(input.plan, input.billingCycle, activeReferralCount);
  let asaasSubscriptionId = input.subscription?.asaas_subscription_id ?? null;
  let customerId = input.subscription?.asaas_customer_id ?? null;
  let initialPaymentUrl: string | null = null;

  if (!customerId) {
    const billingEmail = await getAgencyBillingEmail(input.agencyId, input.agency?.email);
    const customer = await asaasRequest<{ id: string }>("/customers", {
      method: "POST",
      body: {
        name: input.agency?.name ?? "Agência ReveeAprove",
        email: billingEmail,
        cpfCnpj: input.billingDocument ?? undefined
      }
    });
    customerId = customer.id;
  } else if (input.billingDocument) {
    await asaasRequest(`/customers/${customerId}`, {
      method: "PUT",
      body: {
        name: input.agency?.name ?? "Agência ReveeAprove",
        cpfCnpj: input.billingDocument
      }
    });
  }

  if (!asaasSubscriptionId) {
    const trialEndsAt = getTrialEndIso(input.subscription);
    const created = await asaasRequest<any>("/subscriptions", {
      method: "POST",
      body: asaasSubscriptionPayload({
        customer: customerId,
        plan: input.plan,
        cycle: input.billingCycle,
        paymentMethod: input.paymentMethod ?? "credit_card",
        value: subscriptionValue,
        externalReference: input.agencyId,
        nextDueDate: toDateOnly(trialEndsAt) ?? getTrialDueDate()
      })
    });
    asaasSubscriptionId = created.id;
    initialPaymentUrl = getPaymentUrl(created);
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

  return { subscription: updated, asaasSubscriptionId, initialPaymentUrl };
}

async function getLatestSubscriptionPayment(asaasSubscriptionId: string) {
  const response = await asaasRequest<{ data?: any[] }>(`/subscriptions/${asaasSubscriptionId}/payments?limit=10`);
  let payments = response.data ?? [];
  if (!payments.length) {
    const fallback = await asaasRequest<{ data?: any[] }>(`/payments?subscription=${encodeURIComponent(asaasSubscriptionId)}&limit=10`);
    payments = fallback.data ?? [];
  }
  if (!payments.length) {
    await wait(900);
    const retry = await asaasRequest<{ data?: any[] }>(`/payments?subscription=${encodeURIComponent(asaasSubscriptionId)}&limit=10`);
    payments = retry.data ?? [];
  }
  return payments.find((payment) => ["PENDING", "OVERDUE"].includes(payment.status))
    ?? payments.find((payment) => payment.invoiceUrl || payment.bankSlipUrl || payment.paymentLink)
    ?? payments[0]
    ?? null;
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

    if (action === "activate_trial") {
      const plan = (body.plan ?? subscription?.plan ?? "studio") as SubscriptionPlan;
      const billingCycle = (body.billingCycle ?? subscription?.billing_cycle ?? "monthly") as BillingCycle;
      const trialEndsAt = getTrialEndIso(subscription);

      if (subscription?.status === "exempt") {
        return NextResponse.json({
          subscription,
          message: "Essa conta está liberada manualmente e já tem acesso completo."
        });
      }

      const { data: updated } = await supabaseAdmin
        .from("subscriptions")
        .upsert({
          agency_id: agencyId,
          plan,
          billing_cycle: billingCycle,
          status: "trial",
          trial_ends_at: subscription?.trial_ends_at ?? trialEndsAt,
          current_period_start: subscription?.current_period_start ?? new Date().toISOString(),
          current_period_end: subscription?.current_period_end ?? trialEndsAt,
          updated_at: new Date().toISOString()
        }, { onConflict: "agency_id" })
        .select()
        .single();

      return NextResponse.json({
        subscription: updated,
        message: "Teste gratuito ativado. Você já pode começar."
      });
    }

    if (action === "change_plan") {
      const plan = (body.plan ?? "studio") as SubscriptionPlan;
      const billingCycle = (body.billingCycle ?? "monthly") as BillingCycle;
      const applyNextCycle = Boolean(body.applyNextCycle);
      const activeReferralCount = await getActiveReferralCount(agencyId);
      const subscriptionValue = getEstimatedPriceWithReferralDiscount(plan, billingCycle, activeReferralCount);
      const billingDocument = normalizeBillingDocument(body.billingDocument) ?? normalizeBillingDocument(agency?.billing_document);
      await persistBillingDocument(agencyId, normalizeBillingDocument(body.billingDocument));

      let asaasSubscriptionId = subscription?.asaas_subscription_id ?? null;
      let customerId = subscription?.asaas_customer_id ?? null;

      if (!customerId) {
        const billingEmail = await getAgencyBillingEmail(agencyId, agency?.email);
        const customer = await asaasRequest<{ id: string }>("/customers", {
          method: "POST",
          body: {
            name: agency?.name ?? "Agência ReveeAprove",
            email: billingEmail,
            cpfCnpj: billingDocument ?? undefined
          }
        });
        customerId = customer.id;
      } else if (billingDocument) {
        await asaasRequest(`/customers/${customerId}`, {
          method: "PUT",
          body: {
            name: agency?.name ?? "Agência ReveeAprove",
            cpfCnpj: billingDocument
          }
        });
      }

      if (asaasSubscriptionId && !applyNextCycle) {
        await asaasRequest(`/subscriptions/${asaasSubscriptionId}`, {
          method: "PUT",
          body: asaasSubscriptionPayload({ customer: customerId, plan, cycle: billingCycle, paymentMethod: "credit_card", value: subscriptionValue, externalReference: agencyId })
        });
      } else if (!asaasSubscriptionId) {
        const trialEndsAt = getTrialEndIso(subscription);
        const created = await asaasRequest<{ id: string }>("/subscriptions", {
          method: "POST",
          body: asaasSubscriptionPayload({
            customer: customerId,
            plan,
            cycle: billingCycle,
            paymentMethod: "credit_card",
            value: subscriptionValue,
            externalReference: agencyId,
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

      const plan = (body.plan ?? subscription?.plan ?? "studio") as SubscriptionPlan;
      const billingCycle = (body.billingCycle ?? subscription?.billing_cycle ?? "monthly") as BillingCycle;
      const billingDocument = normalizeBillingDocument(body.billingDocument) ?? normalizeBillingDocument(agency?.billing_document);
      await persistBillingDocument(agencyId, normalizeBillingDocument(body.billingDocument));
      if (!subscription?.asaas_customer_id && !billingDocument) {
        return NextResponse.json({ error: "Informe o CPF ou CNPJ para abrir o pagamento." }, { status: 400 });
      }
      const ensured = await ensureAsaasSubscription({ agencyId, agency, subscription, plan, billingCycle, billingDocument, paymentMethod: "credit_card" });
      const payment = await getLatestSubscriptionPayment(ensured.asaasSubscriptionId);
      const invoiceUrl = getPaymentUrl(payment) ?? ensured.initialPaymentUrl;

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
        message: invoiceUrl ? "Abrindo ativação." : "Sua ativação foi registrada. Aguarde alguns segundos e clique novamente para abrir o pagamento."
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
