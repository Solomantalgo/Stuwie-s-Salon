# Guided bookings

`bookings.html` adapts the nine-step structure in `Trials/Trial500k`: category, service, professional, date, time, details, notes, review, payment, then a request confirmation.

## Existing integrations

- Uses `stuwiesBookingCart` and the existing item shape. Service selections persist across home, services and bookings pages.
- Reads `STUWIES_CONFIG.webAppUrl` and the existing JSONP availability response (`booked_slots`, `blocked_slots`, `closed_days`). Uses the existing eight displayed start times and six-month booking horizon, interpreted in Kampala time. Rechecks immediately before submission and fails closed if availability cannot be read.
- Sends the existing Apps Script POST field names. Professional and payment details are also included in `notes`, which the current backend already stores and includes in email. Structured `preferred_professional` and `payment` fields are supplied for future backend use. No Apps Script schema change or redeployment is required for the notes integration.
- Keeps the existing `no-cors` submission transport. Its opaque response cannot confirm acceptance or provide a server booking ID. The completion screen therefore asks the customer to await salon confirmation; it never labels a reservation or payment verified. WhatsApp is an explicit customer action after submission.
- Home and services booking buttons open the new page. Existing modal code remains available with `?legacyBooking` on those pages. Product ordering is unchanged.

## Payment setup

The current site policy is a 50% deposit, retained here rather than copying Trial500k's demonstration percentage. Customers may submit a deposit/full-payment transaction reference or arrange payment with the salon. References have `submitted` status only; they are not verified transactions.

Set `payment.provider` and `payment.merchantId` in `config.js` to the salon-approved destination when supplied. Until then the page offers a link to ask the salon for payment details. There is no simulated payment prompt, automatic charge, PIN entry, or invented merchant number. Provider checkout would require a real provider integration separately.

For `From` prices, ranges, per-person packages or custom quotes, payment amount and balance remain null until the salon confirms pricing. Estimates are labelled accordingly.

## Team and catalogue

`team.js` uses the four existing staff members, photographs and published specialties. Home-page profiles offer booking links with the professional preselected. Preferences are requests, not guarantees: the existing API has a shared salon calendar, not staff-specific availability.

`booking-catalogue.js` contains the 71 service choices and nine packages extracted from `services.html`. Keep it in sync when changing that menu. `bookings-base.css` carries the existing service-page visual styles; `bookings.css` adds the responsive booking structure. `team.css` adds profile and action styles without replacing the existing team layout.

## Verification

Local browser checks intercepted all remote submissions; no live bookings or payment requests were created. Verified deposit/full/variable-price payloads, retained payment notes, final slot conflicts, availability failure/retry, cart clearing and handoff, empty-cart removal, professional preselection, profile controls, primary booking routes, JavaScript errors, and layouts at 360, 390, 768 and 1280 pixels. JavaScript syntax and git whitespace checks pass.
