# Inbound Report via WhatsApp Group

The app can send one Inbound Report PDF to one WhatsApp group after a Post Intake and respond to `Laporan GRN #035` or `Laporan GRN #035-XI2026` in that group. The automatic target is SJ Qty, or Receiving Qty when SJ Qty is null. It sends once when Intake Qty is within 20 pieces above or below the target. A missing or zero target does not trigger a report. It does not wait for QC; the PDF includes Sample QC results available at send time. Later changes do not resend the automatic report. A group member can request a fresh PDF at any time.

This requires Meta's official Groups API. An existing ordinary WhatsApp group cannot be connected to the API; create a new group from an Official Business Account (OBA) Cloud API number and invite the three participants. Groups API currently permits up to eight participants and supports document messages. Do not use WhatsApp Web automation or a personal account for this integration.

## Meta setup

1. Obtain an OBA-approved sender number on WhatsApp Cloud API and a long-lived system-user access token with WhatsApp messaging permission.
2. Create an API group, invite the participants, and record its group ID and the sender phone-number ID. The group should contain only intended report recipients.
3. In WhatsApp Manager, create and get approval for a **group-specific Utility template** with a **DOCUMENT header** and body `Laporan Inbound untuk GRN {{1}} sudah tersedia.`. Set its approved name and language in the environment. The PDF is the document header, so the automatic send is one group message. The chat-command reply uses a regular document message.
4. Subscribe the Meta app to the `messages` webhook. Set callback URL to `https://YOUR_DOMAIN/api/inbound/wa-report/webhook`. Give Meta the same `WA_WEBHOOK_VERIFY_TOKEN` configured on the server. The endpoint validates the raw webhook body with the app secret.
5. Configure the server-only variables from `.env.example` in the deployment environment. Never prefix them with `NEXT_PUBLIC_` or put the access token in a browser. Use `WA_REPORT_START_AT` as an ISO 8601 timestamp, for example `2026-11-20T07:00:00Z`, to deliberately activate automatic sends. Existing GRNs can still qualify when a **new** Post Intake occurs after that time; no historic data is sent in a batch.
6. Set `WA_REPORT_ALLOWED_SENDER_IDS` to the three participants' comma-separated `from_user_id` values (BSUIDs). For initial discovery, temporarily set `WA_REPORT_LOG_UNKNOWN_SENDERS=true`, ask each member to send a text message in the API group, read only the sender IDs from server logs, and turn the flag off again. Until allowlisted, their commands are ignored.
7. Deploy, post a test Intake within the tolerance, and verify one new row with `status = 'sent'` in `inbound_wa_report_deliveries` plus one PDF message in the API group. Then test a group command. A short GRN number that matches multiple years prompts for the full number.

## Delivery and failures

The automatic trigger runs after a successful Post Intake. The `inbound_wa_report_deliveries` table reserves one automatic delivery per GRN and group, and one reply per incoming WhatsApp message ID, to avoid duplicates. It is server-only (RLS plus service-role grants). A failed send is recorded with its error and is **not automatically retried**: after a Meta timeout, a retry could duplicate a message that actually arrived. Check failed rows and Meta delivery-status webhooks before manually resolving or resending. A successful API acceptance is recorded as `sent`; it does not prove device delivery.

This flow is event-driven by the Intake page. If the browser loses connectivity immediately after Post Intake, the WA trigger may be missed. The Intake data remains saved. Until a server-side reconciliation job is added, review the delivery log when this happens and use a group command for a fresh report.

Official references: [Groups API](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/), [group messages and webhooks](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/groups-messaging/), [document-header templates](https://whatsappbusiness.com/blog/manage-message-templates-whatsapp-business-api/).
