# Guided bookings

`bookings.html` adapts the nine-step structure in `Trials/Trial500k`: category, service, professional, date, time, details, notes, review, payment, then a request confirmation.

## Availability loading

After the initial render, `ensureAvailability()` starts the existing Apps Script JSONP request in the background. Category, Service, Professional and Date remain usable while it loads. A shared `availabilityPromise` prevents duplicate requests on entering or returning to Time. Successful display data stays in memory for this page only. A failed request clears the promise and retains its error; the Time step offers Retry through `refreshAvailability()`. Navigation does not refresh availability. Entering Time shows a 2-second calendar-check transition, even when prefetch is already complete. If the network takes longer, the loading indicator stays until it settles. Known errors show Retry immediately. Back remains usable and reduced-motion preferences disable the spinner animation. This presentation delay never creates additional requests or invents availability.

Every new page load requests again. No localStorage/sessionStorage, service worker, Vercel API or new backend cache is used. Submission still calls `loadAvailability()` directly for a fresh slot check; conflicts return to Time without posting the booking.

Run `node tests/availability.cjs` for isolated request-count, delayed-response, error/retry, reload and final-conflict checks. It uses the same Playwright/Chromium environment options as the payment suite.

## Existing integrations

- Uses `stuwiesBookingCart` and the existing item shape. Service selections persist across home, services and bookings pages.
- Reads `STUWIES_CONFIG.webAppUrl` and the existing JSONP availability response (`booked_slots`, `blocked_slots`, `closed_days`). Uses the existing eight displayed start times and six-month booking horizon, interpreted in Kampala time. Rechecks immediately before submission and fails closed if availability cannot be read.
- Sends the existing Apps Script POST field names. Professional and payment details are also included in `notes`, which the current backend already stores and includes in email. Structured `preferred_professional` and `payment` fields are supplied for future backend use. No Apps Script schema change or redeployment is required for the notes integration.
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

### Backend boundary and rollout

Actual transaction storage, reconciliation and verification are the **next implementation phase**. The current Apps Script receiver still persists Notes rather than dedicated payment columns. It must not interpret browser amounts, timestamps or status as verified transactions. The next backend must recalculate prices from trusted catalogue/approved quotes, bind attempts to booking IDs, securely reconcile provider transactions, handle duplicates and failures, and return authenticated payment confirmation. Neither localStorage nor query strings are payment proof.

The public `Mark Paid` control was removed from `confirm.html`, and `handleBookingAction_` now rejects `Paid` from the public endpoint. Redeploy `apps-script-booking.gs` to activate that server safeguard; editing the local source does not update the deployed Google endpoint. Existing booking status columns, availability checks, customer notes, professional selection and email integration remain intact. Staff should verify transactions through the future protected reconciliation flow. Existing manually maintained Sheet booking statuses are not migrated.

Before live initiation: supply each real merchant ID, verify the displayed merchant identity and MTN sequence on physical phones, validate Airtel manual instructions with the salon/provider, and redeploy the Apps Script safeguard. Automated verification is not implemented by enabling merchant configuration.

## Team and catalogue

`team.js` lists only Jalira Muyonjo, the current staff member confirmed by the salon owner, with her supplied portrait and role (Masseuse & Esthetician). She can be requested for massage, facial and body-scrub categories; other categories retain no-preference booking. Removed professional IDs safely resolve to no preference. Home-page profiles offer booking links with the professional preselected. Preferences are requests, not guarantees: the existing API has a shared salon calendar, not staff-specific availability.

`booking-catalogue.js` contains the 71 service choices and nine packages extracted from `services.html`. Keep it in sync when changing that menu. `bookings-base.css` carries the existing service-page visual styles; `bookings.css` adds the responsive booking structure. `team.css` adds profile and action styles without replacing the existing team layout.

## Verification

`tests/payments.cjs` runs browser regression checks with all booking traffic mocked and dialer navigation intercepted. It uses an isolated test-only merchant value; no test destination is written into production configuration. Run `node tests/payments.cjs`. Set `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` if the supplied workspace Playwright/Chromium paths differ.

Coverage: missing/both required selections, fixed-price totals, exact deposit and full balances, state persistence, cart recalculation and initiation reset, encoded mobile MTN URI, desktop and Airtel manual instructions, variable prices, missing merchant configuration, unverified structured payloads, final slot conflicts, availability retry, and responsive payment layouts. Physical carrier/dialer behavior requires device testing; the automated suite cannot establish payment success. No live booking or payment is sent by these checks.
