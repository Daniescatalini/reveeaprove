import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN;

function mapPaymentStatus(event: string) {
  if (event.includes("CONFIRMED") || event.includes("RECEIVED")) return "confirmed";
  if (event.includes("OVERDUE")) return "overdue";
  if (event.includes("FAILED")) return "failed";
  if (event.includes("REFUNDED")) return "refunded";
  if (event.includes("DELETED") || event.includes("CANCELLED")) return "cancelled";
  return "pending";
}

function shouldSuspendFromPayment(payment: any) {
  const dueDate = payment?.dueDate ? new Date(`${payment.dueDate}T00:00:00`) : null;
  if (!dueDate || Number.isNaN(dueDate.getTime())) return false;
  return Date.now() - dueDate.getTime() >= 5 * 86400000;
}

export async function POST(request: Request) {
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: "Supabase admin não configurado." }, { status: 500 });
    if (WEBHOOK_TOKEN) {
      const token = request.headers.get("asaas-access-token") ?? request.headers.get("x-webhook-token");
      if (token !== WEBHOOK_TOKEN) return NextResponse.json({ error: "Webhook não autorizado." }, { status: 401 });
    }

    const payload = await request.json();
    const event = String(payload.event ?? "");
    const payment = payload.payment ?? {};
    const asaasSubscriptionId = payment.subscription ?? payload.subscription?.id ?? null;

    const { data: subscription } = asaasSubscriptionId
      ? await supabaseAdmin.from("subscriptions").select("*").eq("asaas_subscription_id", asaasSubscriptionId).maybeSingle()
      : { data: null };

    const agencyId = subscription?.agency_id ?? null;
    await supabaseAdmin.from("billing_events").insert({
      agency_id: agencyId,
      event_type: event || "ASAAS_WEBHOOK",
      description: payment.description ?? payload.description ?? null,
      raw_payload: payload
    });

    if (agencyId && payment.id) {
      await supabaseAdmin.from("billing_history").upsert({
        agency_id: agencyId,
        subscription_id: subscription?.id ?? null,
        asaas_payment_id: payment.id,
        amount: Number(payment.value ?? 0),
        status: mapPaymentStatus(event),
        due_date: payment.dueDate ?? null,
        paid_at: payment.paymentDate ?? payment.clientPaymentDate ?? null,
        invoice_url: payment.invoiceUrl ?? payment.bankSlipUrl ?? null,
        payment_method: payment.billingType ?? null
      }, { onConflict: "asaas_payment_id" });
    }

    if (subscription) {
      if (event.includes("CONFIRMED") || event.includes("RECEIVED")) {
        await supabaseAdmin.from("subscriptions").update({
          status: "active",
          past_due_since: null,
          suspended_at: null,
          next_invoice_url: payment.invoiceUrl ?? null,
          current_period_start: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq("id", subscription.id);

        await supabaseAdmin
          .from("referrals")
          .update({
            status: "active",
            converted_at: new Date().toISOString()
          })
          .eq("referred_agency_id", subscription.agency_id)
          .eq("status", "pending");
      }

      if (event.includes("OVERDUE") || event.includes("FAILED")) {
        const suspend = shouldSuspendFromPayment(payment);
        await supabaseAdmin.from("subscriptions").update({
          status: suspend ? "suspended" : "past_due",
          past_due_since: subscription.past_due_since ?? new Date().toISOString(),
          suspended_at: suspend ? new Date().toISOString() : subscription.suspended_at ?? null,
          next_invoice_url: payment.invoiceUrl ?? payment.bankSlipUrl ?? null,
          updated_at: new Date().toISOString()
        }).eq("id", subscription.id);
      }

      if (event.includes("SUBSCRIPTION_UPDATED")) {
        await supabaseAdmin.from("subscriptions").update({
          updated_at: new Date().toISOString()
        }).eq("id", subscription.id);
      }

      if (event.includes("SUBSCRIPTION_DELETED") || event.includes("SUBSCRIPTION_INACTIVATED")) {
        await supabaseAdmin.from("subscriptions").update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq("id", subscription.id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro no webhook." }, { status: 500 });
  }
}
