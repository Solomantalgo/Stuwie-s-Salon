# Guided bookings

`bookings.html` adapts the nine-step structure in `Trials/Trial500k`: category, service, professional, date, time, details, notes, review, payment, then a request confirmation.

## Availability loading

After the initial render, `ensureAvailability()` starts the existing Apps Script JSONP request in the background. Category, Service, Professional and Date remain usable while it loads. A shared `availabilityPromise` prevents duplicate requests on entering or returning to Time. Successful display data stays in memory for this page only. A failed request clears the promise and retains its error; the Time step offers Retry through `refreshAvailability()`. Navigation does not refresh availability. Entering Time shows a 2-second calendar-check transition, even when prefetch is already complete. If the network takes longer, the loading indicator stays until it settles. Known errors show Retry immediately. Back remains usable and reduced-motion preferences disable the spinner animation. This presentation delay never creates additional requests or invents availability.

Every new page load requests again. No localStorage/sessionStorage, service worker, Vercel API or new backend cache is used. Submission still calls `loadAvailability()` directly for a fresh slot check; conflicts return to Time without posting the booking.

Run `node tests/availability.cjs` for isolated request-count, delayed-response, error/retry, reload and final-conflict checks. It uses the same Playwright/Chromium environment options as the payment suite.

## Existing integrations

- Uses `stuwiesBookingCart` and the existing item shape. Service selections persist across home, services and bookings pages.
- Reads `STUWIES_CONFIG.webAppUrl` and the existing JSONP availability response (`booked_slots`, `blocked_slots`, `closed_days`). Uses the existing eight displayed start times and six-month booking horizon, interpreted in Kampala time. Rechecks immediately before submission and fails closed if availability cannot be read.
- Sends the existing Apps Script POST field names. Professional and payment details are also included in `notes`, which the current backend already stores and includes in email. Structured `payment` is also normalized and stored in Payments, linked by Booking ID; Bookings P:R stores the calculated payment summary. Deploy the updated Apps Script to enable ledger storage. Professional preferences continue to be recorded in Notes.
- Keeps the existing `no-cors` submission transport. Its opaque response cannot confirm acceptance or provide a server booking ID. The completion screen therefore asks the customer to await salon confirmation; it never labels a reservation or payment verified. WhatsApp is an explicit customer action after submission.
- Home and services booking buttons open the new page. Existing modal code remains available with `?legacyBooking` on those pages. Product ordering is unchanged.

## Production payment policy

Payment is required. Payment type and provider are independent required choices, with **no default selection**:

- **50% Deposit**: exact fixed service total × 0.5. No rounding to a different percentage.
- **Full Payment**: exact fixed service total × 1; balance remaining is zero.
- **MTN Mobile Money** or **Airtel Money**, selected using keyboard-accessible radio cards.

Pay later, arrange payment, the provider dropdown, payment phone and manually typed transaction-reference fields have been removed from the guided payment step. Submission requires both choices, but does not require a fabricated reference or pretend that a payment succeeded. The request may be sent while merchant setup or final pricing is pending; it remains subject to salon confirmation. This phase enforces payment choice, not verified settlement.

### Central configuration and logos

`config.js` is the sole merchant configuration source. Under `payment.providers.mtn` and `payment.providers.airtel`, each provider has `name`, `merchantId`, `merchantConfigured`, and `logo`. Both merchant IDs are deliberately empty and both flags are false. Set the actual salon-approved ID and change that provider's flag to true to enable initiation. Blank, nonnumeric and all-zero IDs are blocked. Never put test merchant numbers in production configuration.

Provider logos are installed locally at:

- `assets/images/payment/mtn-momo-logo.png`
- `assets/images/payment/airtel-money-logo.png`

Artwork sources are recorded in `assets/images/payment/README.md`. Missing images are still hidden gracefully and provider names remain visible and accessible. Logos render at 48px with `object-fit: contain`; no fake logos or hotlinks are used.

### Provider handoff

MTN uses the requested merchant sequence `*165*3*MERCHANT_ID*AMOUNT#`, dynamically built from configuration and the calculated amount. The browser URI is `tel:*165*3*MERCHANT_ID*AMOUNT%23`, preserving `*` and encoding the final `#` to prevent URL fragment truncation. Recognized Android/iOS user agents attempt dialer navigation on an explicit Pay click. This is an attempt only: external dialers have no reliable browser payment callback. Desktop and unsupported-device fallback shows the merchant ID, amount and manual MTN instructions. Manual instructions remain visible on mobile too.

`buildAirtelPaymentUri()` deliberately returns null: no verified Airtel merchant sequence was found in the inspected booking code or docs. Airtel uses its configured merchant ID and amount with manual instructions to open the Airtel Money menu and use the merchant payment option. Replace this isolated function once the provider-approved sequence is supplied. No Airtel dial string is invented. The website never collects a PIN.

Android documents the `tel:` dialer mechanism at https://developer.android.com/guide/components/intents-common#Phone. Browser emulation verifies our URI and branching, not carrier acceptance. Physical Android/MTN and iOS device checks remain required with the real merchant ID before enabling live use.

### Variable prices and state

From prices, ranges, custom quotes, per-person pricing, and nonnumeric prices produce **null** `serviceTotal`, `paymentAmount`, and `balanceRemaining` in the payment record. They show: “One or more selected services require the salon to confirm the final price before payment.” No Pay CTA or dialer URI is available. The existing cart and booking details are retained. `payableTotal()` is the future integration point for a server-approved quote; no client-entered quote is accepted. If an exact 50% amount is not a whole Uganda shilling, initiation is blocked rather than rounding it.

The draft starts with empty type/provider, `paymentStatus: 'not_started'`, `paymentAmount: null`, `paymentInitiatedAt: null`, and an empty reference. Lifecycle values are `not_started`, `initiated`, `submitted`, `verified`, `failed`, and `cancelled`. This frontend assigns only `not_started` and `initiated`. Pay clicks, including manual instruction flows, mean initiated only. Booking submission does not advance payment status. Choice survives rerender and Back/Forward. Cart, payment type, provider, or merchant changes reset initiation and recalculate the amount.

`paymentRecord()` supplies type, provider name and key, status, merchant ID, service total, amount, balance remaining, empty reference, initiation timestamp, null verification timestamp, and a price-review flag. Deposit balance is `serviceTotal - paymentAmount`; it is a projected balance after verification, not proof of payment. These fields accompany the existing booking POST and downloadable request. A concise unverified summary remains in Notes for current Sheet/email compatibility.

### Payment storage and staff verification

The existing workbook ID and sheet names are retained. No replacement workbook or differently structured ledger is created. Existing Bookings A:O, Availability data and Form Responses 1 are preserved. Setup updates known Dashboard guidance rows without clearing staff-added content. Nonblank unexpected headers cause setup to stop rather than reorder columns.

Bookings adds exactly **P Payment Status**, **Q Amount Paid**, **R Balance** after Source. Payments uses the prepared A:Q schema:

| Column | Header |
| --- | --- |
| A | Payment ID |
| B | Booking ID |
| C | Created At |
| D | Provider |
| E | Provider Key |
| F | Payment Type |
| G | Expected Amount |
| H | Transaction Amount |
| I | Balance Before |
| J | Balance After |
| K | Transaction Reference |
| L | Provider Status |
| M | Verification Status |
| N | Initiated At |
| O | Verified At |
| P | Verified By |
| Q | Notes |

A valid `data.payment` creates a Pending ledger row after its booking is created, linked by Booking ID. New booking and payment IDs include UUID suffixes. Payment IDs use `PAY-STW-yyyyMMdd-HHmmss-XXXXXXXX`. Provider keys are restricted to mtn/airtel and names are derived server-side. Types are deposit/full. Numeric browser amounts must be nonnegative safe whole-shilling numbers; invalid selections/amounts are rejected before booking insertion. Expected Amount is recalculated as total × 0.5 or total × 1. Ranges and labelled estimates do not become payable quotes.

Browser status is restricted to `not_started` or `initiated`; claims of paid/successful/verified become `not_started`. The initial row leaves Transaction Amount, Balance After, Verified At and Verified By blank. A valid supplied transaction reference is recorded only as an unverified claim. The booking starts with Amount Paid **0** and Balance equal to the **full service total**, not the browser's projected deposit balance. An unknown total stays blank pending a quote. Neither localStorage nor query parameters prove payment.

#### Staff workflow

1. Find the booking and its linked Payments row. Independently confirm the service price and expected amount, then locate the actual transaction in the relevant MTN/Airtel merchant records.
2. Enter actual **Transaction Amount (H)** and **Transaction Reference (K)**.
3. Set **Verification Status (M)** to **Verified**. The installed `onEdit(e)` handler processes edits intersecting column M, including multiple rows pasted together.
4. The script requires a unique linked booking with an exact total, positive Expected/Transaction amounts that match exactly, a reference, and valid provider/type. Reusing an already Verified reference for the same provider is blocked across bookings too.
5. Valid rows receive Verified At, staff email when available (otherwise `Sheet staff`), and Balance Before/After. Failed validation changes M to **Mismatch**, explains the reason in Notes, and credits no money. Correct the inputs after checking merchant records and select Verified again.

This is **staff-assisted reconciliation**. Numeric equality alone is not proof that a merchant received money. The script relies on the staff member checking merchant records and the correct salon price. Provider API confirmation and a trusted server catalogue/quoted-price system can replace that manual review later.

**Multiple payments:** add another Payments row with the same Booking ID, correct provider name/key, deposit/full payment type, Expected Amount for that transaction and actual amount/reference. For a remaining-balance payment, `full` describes completing payment, while Expected Amount is the remaining balance. Blank Payment ID/Created At are filled during verification. Do not duplicate a previously verified reference or copy its verification markers. A 100,000 booking can therefore have a 50,000 deposit followed by a separate 50,000 transaction.

**Calculated summary:** Amount Paid is the sum of valid processed Verified transaction amounts for that Booking ID. Pending, Initiated, Mismatch, Failed and Cancelled rows do not count. Balance is `max(service total - Amount Paid, 0)`. Positive partial payment gives **Deposit Paid**; enough verified payment gives **Paid in Full**. Without verified funds, status is Unpaid, Awaiting Payment, Payment Initiated, or Payment Failed according to the linked rows. Repeated verification recomputes the sum, so it never doubles a payment.

The exact booking total is retained in Bookings **Estimated Total (I)**. For variable-priced bookings, staff must establish the salon-approved full quote there (a number or exact `UGX 100,000` format), then fill Expected Amount and reconcile the transaction. Do not substitute the first number of a price range. Balance updates when verification is processed.

For corrections, first change M from Verified to Pending so the payment is removed from the sum; then edit amounts/reference and select Verified again. Other column edits alone do not run verification. Do not delete verified rows or change their Booking ID in place. Keep the workbook restricted to trusted staff and protect calculated/identity columns against accidental edits. API or script writes do not fire the edit trigger automatically; future reconciliation must call equivalent trusted verification logic explicitly.

#### Booking status, aging and public actions

Payment verification updates only Bookings P:R. Main booking Status stays separate. New still becomes Pending after 1 minute. After 1 hour, New/Pending bookings with Deposit Paid or Paid in Full are protected from automatic cancellation, retaining their blocked slot for staff review. Previously Cancelled bookings remain Cancelled even if a payment is later verified. Shared script locks serialize booking writes, payment recalculation and aging; aging writes only the main Status/Notes columns.

Public `booking_action` continues to reject Paid. No public payment verification links are added. Manage Booking controls appointment actions only. Staff email and Dashboard explain that money is verified in Payments. Historical main-status Paid values are retained for compatibility; this code does not generate new ones from payment verification.

#### Apps Script deployment

1. Copy the complete updated `apps-script-booking.gs` into the **existing** Apps Script project. Keep the existing spreadsheet ID. Do not create another Payments sheet.
2. Run `setupWorkbook_()` once and authorize if prompted. It uses the prepared schema and applies blue headers, column widths and Payments M validation: Pending, Verified, Mismatch, Failed, Cancelled.
3. Run `installPaymentEditTrigger()` **once under the designated staff/admin account**, then authorize. Confirm exactly one spreadsheet **On edit** trigger for `onEdit`. The handler uses the installable event's `triggerUid` to avoid also processing a bound script's automatic simple trigger. See Google's [event documentation](https://developers.google.com/apps-script/guides/triggers/events) and [installable-trigger guide](https://developers.google.com/apps-script/guides/triggers/installable). Trigger creators can manage only their own triggers; avoid installing duplicates from other staff accounts.
4. Keep the existing `runBookingAging` time trigger. If absent, run `installBookingAgingTrigger()` once.
5. Update the existing web-app deployment to a **new version**, preserving its `/exec` URL and access settings. Source edits alone do not update the deployed receiver.
6. Confirm the installed trigger runs successfully with a controlled staff test, then reconcile only actual merchant transactions. No live workbook changes or test bookings were made by the local test suite.

Merchant IDs remain centrally configured in `config.js`. Before enabling live initiation, supply each real ID and verify the merchant identity and handoff on physical phones. This backend phase adds ledger storage and staff verification; automated MTN/Airtel API reconciliation and customer-facing authenticated payment confirmation remain future work. The frontend's existing opaque `no-cors` response still cannot display a server-confirmed booking ID or payment result.

## Team and catalogue

`team.js` lists only Jalira Muyonjo, the current staff member confirmed by the salon owner, with her supplied portrait and role (Masseuse & Esthetician). She can be requested for massage, facial and body-scrub categories; other categories retain no-preference booking. Removed professional IDs safely resolve to no preference. Home-page profiles offer booking links with the professional preselected. Preferences are requests, not guarantees: the existing API has a shared salon calendar, not staff-specific availability.

`booking-catalogue.js` contains the 71 service choices and nine packages extracted from `services.html`. Keep it in sync when changing that menu. `bookings-base.css` carries the existing service-page visual styles; `bookings.css` adds the responsive booking structure. `team.css` adds profile and action styles without replacing the existing team layout.

## Verification

`tests/payments.cjs` runs browser regression checks with all booking traffic mocked and dialer navigation intercepted. It uses an isolated test-only merchant value; no test destination is written into production configuration. Run `node tests/payments.cjs`. Set `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` if the supplied workspace Playwright/Chromium paths differ.

Coverage: missing/both required selections, fixed-price totals, exact deposit and full balances, state persistence, cart recalculation and initiation reset, encoded mobile MTN URI, desktop and Airtel manual instructions, variable prices, missing merchant configuration, unverified structured payloads, final slot conflicts, availability retry, and responsive payment layouts. Physical carrier/dialer behavior requires device testing; the automated suite cannot establish payment success. No live booking or payment is sent by these checks.

`node tests/payment-backend.cjs` runs the Apps Script against an in-memory workbook emulator. It covers exact column schemas and data preservation; linked POST rows; pending, deposit and full balances; multiple payments; mismatches and missing references; forged browser success; unsafe amounts; duplicate references; repeated/reversed verification; staff identity fallback; variable-price quotes; edit-trigger filtering; and verified-payment aging protection. No Google calls, email or live writes occur.


### Staff-facing presentation

The booking notification email now groups customer, appointment and payment information, then provides a Manage Booking action. Payment initiation is shown as initiation only; the email directs staff to the Payments sheet for verification. Manage Booking keeps contact and appointment actions together, shows read-only payment summary fields when supplied, and never offers a public payment verification action. The generated Dashboard tab provides live booking and payment KPI formulas plus a quick guide for aging, availability and staff-assisted payment reconciliation.
