# Codex Agent Prompt — Rebrand "Life Care" Demo into Stuwie's Salon & Spa

## Context
This project folder currently contains a generic demo site (`index.html` + supporting
CSS/JS) built for a "Life Care" spa/salon placeholder brand. We are repurposing it as
a **client demo** for a real business: **Stuwie's Salon & Spa**, located in Nansana–
Masitowa, Kampala, Uganda.

This is NOT a simple find-and-replace reskin. The goal is to use the existing site as
a structural starting point but design a genuinely distinct identity for Stuwie's —
new layout decisions, new sections, and visual choices driven by their actual brand
assets, not just swapped colors and text on the old template.

## Assets available (inspect the repo before starting)
- `assets/images/` — photorealistic generated + real photos for each service
  category (facials, body scrubs, massages, waxing, mani/pedi, ladies' hair,
  gents' barbering, spa packages/couples, team photos) plus one real interior
  photo of the salon.
- Root folder — the Stuwie's logo file (monogram of interlocking S-shapes forming
  scissors inside a triangle, blue/grey/black on white, wordmark "STUWIE'S Salon &
  Spa", tagline "No Place You'd Rather Be") and the full service menu (image/PDF)
  listing prices and categories.
- Look up filenames yourself — don't assume names, glob the folders first.

## Brand facts to build from
- Tagline: "No Place You'd Rather Be"
- Brand voice lines: "You deserve to look good, feel great and live beautifully."
  and "Feel Good. Look Great. Be Your Best."
- Positioning (their own "Why Choose Us" points): Professional Care, Quality
  Products, Relaxing Experience, Hygiene & Safety, Value for Money — this is an
  accessible, full-service, family/community salon, not an exclusive luxury spa.
- Full service range: Facials, Body Scrubs, Massages (incl. prenatal), Waxing,
  Manicure & Pedicure, Hair Services (Ladies), Barbering (Gents), Spa Packages
  (Signature, Couples, Bridal, VIP/Group), Gift Vouchers, Loyalty Membership.
- Colors: pull the exact blue/grey/black values from the logo file rather than
  guessing hex codes.

## Structure to build (adapt as you see fit, don't just copy 1:1 from the old file)
1. **Hero** — logo + tagline as the headline, real interior photo as backdrop.
2. **Trust bar** — the five "Why Choose Us" points as short, scannable cards.
3. **Services** — grouped by category (tabs or cards), pulling real prices from
   the menu asset.
4. **Packages spotlight** — Bridal / Couples / VIP-Group packages get their own
   visual section with pricing, since these are the highest-value bookings.
5. **Team / Meet the Team** (NEW SECTION) — group photo + individual staff cards
   using the generated headshots in `assets/images/`. Include name + role
   placeholders (e.g. "Barber", "Hairstylist") that are easy for the client to
   edit later.
6. **Gallery** — service category photos.
7. **Location/Contact/Book** — map placeholder, WhatsApp, hours, loyalty note.

## New functional features (client-requested)
1. **Team section** as described above.
2. **Booking → email notification**: when someone submits "Book an Appointment,"
   the salon should receive an email notification on their end. Since this is a
   static front-end demo, implement this using a client-side email service that
   doesn't require a backend server — e.g. **EmailJS** or a **Formspree** form
   endpoint. Wire up the form so submission triggers an email to a placeholder
   address (clearly marked `REPLACE_WITH_CLIENT_EMAIL`) with the client's name,
   phone, requested service, and selected date/time. Document in a comment block
   at the top of the relevant JS file exactly which service was used and what
   needs to be configured (API key, service ID, etc.) before this goes live.

   **Email must be a structured HTML table, not plain text.** Build it as an
   inline-CSS HTML email (external stylesheets aren't reliable in email
   clients), matching Stuwie's brand:
   - Header bar in Stuwie's blue with the wordmark and tagline "No Place You'd
     Rather Be"
   - A details table with alternating row shading (light blue / light grey)
     listing: Customer Name, Phone, Service Requested, Preferred Date,
     Preferred Time, Notes
   - A "Reply to Confirm Booking" button/link (see below — this links to
     WhatsApp, not email)
   - A dark footer strip with "Booked via website — Stuwie's Salon & Spa" and
     the salon's address
   Pull the exact blue/grey/black hex values from the logo file rather than
   guessing.

   **"Reply to Confirm Booking" button → links to WhatsApp, not mailto.**
   Build this as a `https://wa.me/<CUSTOMER_PHONE>?text=<URL-encoded pre-filled
   message>` link, using the phone number the customer entered on the booking
   form (strip it to digits-only international format, e.g. `256700123456`,
   before inserting into the wa.me URL). Pre-fill the message with something
   like "Hi [Name], confirming your [Service] appointment on [Date] at [Time]
   at Stuwie's Salon & Spa." This means clicking the button from the email
   opens a WhatsApp chat with that specific customer, ready to send — not an
   email client. Do not collect or require a customer email address for this
   to work; it depends only on the phone number, which is already a required
   field on the booking form.
3. **Date & time picker**: the booking form should let the customer pick an
   appointment date and time — use a lightweight, dependency-light date/time
   picker (native `<input type="date">` + `<input type="time">` is acceptable for
   a demo, or a small library like Flatpickr if you want a nicer UI). Keep it
   mobile-friendly.
4. **WhatsApp send option — already exists, do not remove it**: the current
   Life Care demo already has a working WhatsApp booking flow. Preserve that
   functionality exactly (find it in the existing code before changing
   anything) — carry it over into the new design rather than rebuilding it
   from scratch or dropping it in favor of the new email flow. Update only
   what's needed for the rebrand: swap in the salon's real WhatsApp number
   (it's on the menu asset) and update the pre-filled message text to reflect
   Stuwie's services. The email notification and date/time picker below are
   ADDITIONAL to this existing WhatsApp flow, not a replacement for it — a
   customer should be able to book via WhatsApp exactly as before, and now also
   have the option to submit through the new form which triggers an email.
5. **Working map, no API key**: the location section needs an actual working
   map, not a static placeholder image. Do this without any paid/keyed API —
   use a plain `<iframe>` embed, either:
   - Google Maps "Embed a Map" share link (the free `google.com/maps/embed?pb=...`
     iframe src does not require an API key), or
   - OpenStreetMap's free embed (`openstreetmap.org/export/embed.html`).
   Center it on Wilsen Hotel Building, Nansana–Masitowa, Kampala. Pick real
   coordinates/search terms so the pin actually lands on the right area rather
   than a placeholder location.

## Non-negotiable: don't simplify by dropping features
If a requested feature seems hard to do without a backend or paid API, find a
working no-API/no-server way to do it (as above for WhatsApp and maps) rather
than quietly omitting it, replacing it with a static mockup, or leaving a "TODO"
in its place. Every feature listed above must actually function in the browser
when the demo is opened locally. If something is genuinely impossible without a
paid service, say so explicitly in your plan before implementing — don't just
skip it silently.

## Revision round 2 — apply on top of the already-built demo
The site has already been built once. These changes modify the existing
`index.html`, not a rebuild. Inspect the current markup/JS first (the booking
modal is `#bookingModal`/`#bookingForm`, service cards are `.service-card`,
package cards are `.package-card`, the WhatsApp-to-salon builder is
`salonBookingUrl(data)`, the branded HTML email builder is
`buildHtmlEmail(data)`) and edit in place rather than regenerating from scratch.

1. **"Book This Service" button on every service and package card.** Each
   `.service-card` and `.package-card` needs its own small "Book This" button
   (in addition to the existing global "Book Now" in the header/hero/FAB). 
   Clicking it should open the existing booking modal AND pre-select the
   matching option in the `#requestedService` dropdown (e.g. via a
   `data-service="Facial"` attribute on the button matched against the
   `<option>` values) so the customer doesn't have to re-select what they were
   already looking at.

2. **Consolidate the booking form to a single send action.** Remove the two
   separate buttons (`#sendWhatsApp` and `#sendEmailNotice`) and replace with
   one submit button, e.g. "Send Booking Request." Add a required `email`
   field to the form (it currently only has name/phone/service/date/time/notes)
   — email becomes compulsory alongside the existing required fields.

3. **New submit flow:**
   - On submit, validate all required fields including the new email field.
   - Silently send the booking (same `buildHtmlEmail`/Formspree logic as
     today — no visible email client opens, no page navigation).
   - On success, instead of a plain `alert(...)`, show a small styled
     confirmation popup (reuse the existing modal visual style — rounded
     corners, brand blue header, `modalRise`-style animation) with:
     - A confirmation message, e.g. "Your booking request has been sent to
       Stuwie's Salon & Spa."
     - A secondary button: "Also Send via WhatsApp" — this reuses the
       existing `salonBookingUrl(data)` function (the one that messages the
       salon directly with the booking details) and opens it the same way the
       old `#sendWhatsApp` button did.
     - A way to dismiss the popup without sending WhatsApp (close icon or
       "Done" button).
   - If the Formspree endpoint is still unconfigured (placeholder), keep the
     existing preview-in-new-tab fallback, but still show the same
     confirmation popup with the WhatsApp option afterward — don't skip the
     popup just because the email service isn't wired up yet.
   - The "Reply to Confirm Booking" link embedded inside the branded email
     itself (built from `customerConfirmUrl(data)`) is unaffected by this
     change — that continues to message the *customer* when Stuwie's clicks it
     from their inbox. The new popup's WhatsApp button is a *different* action:
     the customer optionally messaging the *salon* themselves right after
     submitting.

4. **Swap in the new dedicated Nail Enhancements image.** The Nail
   Enhancements service card (in the `panel-beauty` service panel) currently
   points at `assets/images/Scovia-Nails.png` — the same file used for
   Scovia's Team section photo. Keep `Scovia-Nails.png` as her Team card image
   unchanged. Once a new file named `assets/images/nail-enhancements.png` is
   added to the repo, update only the Nail Enhancements service card's `<img
   src="">` to point at `nail-enhancements.png` instead, so the two sections no
   longer share the same photo. If `nail-enhancements.png` isn't present in
   `assets/images/` yet, leave the current image in place and note it as a
   pending asset rather than breaking the layout.

5. **Swap the three remaining mismatched package images**, same pattern as
   item 4 above — update only if the file exists in `assets/images/`, otherwise
   leave the current placeholder and flag it as pending:
   - **Royal Glow Experience** package card currently reuses `hero.webp`. Swap
     to `assets/images/royal-glow-package.png` once present.
   - **Bridal Luxury** package card currently reuses `Facials.png`. Swap to
     `assets/images/bridal-luxury-package.png` once present.
   - **VIP & Group** package card currently reuses `Team.png`. Swap to
     `assets/images/vip-group-package.png` once present.

## Design refinement pass — make the visual identity more distinctive
The current build is competent but generic: system-font typography, flat
blue-on-white styling, and numbered 01–05 trust badges that don't actually
represent a sequence. Push the visual identity further so it reads as
unmistakably Stuwie's rather than an interchangeable spa template:

- **Typography** — the client's own menu graphic uses a script/cursive accent
  font for brand-voice lines like "You deserve to look good, feel great and
  live beautifully." Introduce a comparable script or characterful display
  font (via Google Fonts, e.g. something in the same spirit as the menu's
  script treatment) for headline/tagline moments — paired deliberately with a
  clean sans for body text and pricing, not swapped in everywhere. Use it with
  restraint: taglines and section eyebrows, not paragraph text.
- **Signature motif** — the logo's interlocking-S/triangle mark currently only
  appears once, in the hero logo panel. Turn it into a recurring signature
  element used sparingly: e.g. a triangular clip-path or corner accent on
  section dividers, or a faint background watermark behind a section heading.
  This should be the one deliberately bold visual risk on the page — keep
  everything else disciplined around it.
- **Replace the numbered trust badges.** The five "Why Choose Us" points
  (Professional Care, Quality Products, Relaxing Experience, Hygiene & Safety,
  Value for Money) are parallel value props, not a sequence — the current
  01–05 numbering implies an order that isn't real. Replace with a treatment
  derived from the brand itself (small icon glyphs, or a subtle echo of the
  triangle motif) instead of generic numbering.
- **Warm secondary accent** — the palette is currently blue/grey/black applied
  fairly flat throughout (blue links, blue buttons, blue accents everywhere).
  Once real photos are in place, pull a secondary warm accent color from them
  — skin tones, or the warm yellow ceiling lighting visible in the real
  interior reference photo — and use it sparingly against the blue/black base
  so the palette has more than one note.
- Keep everything else disciplined: don't stack multiple bold moves on top of
  each other. One signature element done well beats several competing ones.
  Maintain the existing quality floor — responsive, keyboard-focus-visible,
  `prefers-reduced-motion` respected.

## Constraints
- Keep everything self-contained (HTML/CSS/JS), no build step required to view
  the demo locally.
- Fully responsive — most Ugandan salon customers will view this on mobile.
- Reuse existing CSS architecture where it's sound; refactor where the old
  "Life Care" styling doesn't fit Stuwie's brand.
- The main file stays named `index.html`.
- This is a demo, not the final signed deal — leave clearly marked placeholders
  (email config, map coordinates, phone number if not yet finalized) rather than
  hardcoding guesses as if they were real.

## Deliverable
Before writing code, give a short plan: what you found in the assets, the exact
color palette you extracted, and the section-by-section structure you intend to
build. Then implement it.

## Honest UI/UX assessment and next improvement pass
The client asked for something in the Life Care direction or better. The current
Stuwie's build is stronger functionally than Life Care because it uses real
pricing, real service categories, team content, package booking CTAs, WhatsApp,
email notification scaffolding, and a working map. However, visually it still
needs a stronger polish pass to clearly beat the Life Care demo. It has too many
similar boxed card sections, the hero still feels more like a template than a
cinematic salon/spa first impression, and the package area should feel more
valuable than normal services because those are the highest-ticket bookings.

Recommended direction:
- Keep the current content architecture and booking logic.
- Make the hero more immersive: full-bleed interior imagery, darker editorial
  overlay, integrated logo/brand badge, clear tagline, and high-confidence CTAs.
- Reduce the feeling that every section is a card grid. Use editorial bands,
  larger featured panels, and staggered image/text treatment where useful.
- Make packages the visual peak of the page, with one larger featured package
  and secondary package tiles instead of four equal generic cards.
- Keep the Stuwie's identity disciplined: blue/black core, warm accent used
  sparingly, script only for tagline/brand-voice moments, and the triangle motif
  as the single recurring signature element.
- Preserve mobile speed to booking: service/package CTAs must remain obvious and
  preselect the requested service in the modal.

## Booking UX revision: item-level service cart
The service booking flow should move beyond broad category booking. Customers
need to book exact menu items such as "Classic Deep Cleansing Facial", "Swedish
Massage 60 mins", "Deluxe Pedicure", or "Skin Fade", and they should be able to
combine multiple services in one appointment request.

Implementation direction:
- Keep the visual service categories/tabs, but make each price-list row an
  actionable booking item.
- Add an `Add` button beside each individual service row, storing service name,
  category/card title, duration, and price.
- Maintain a visible booking cart/selection summary with selected services,
  remove controls, estimated total, and a "Complete Booking Request" action.
- Package cards can still use their larger visual treatment, but their "Book
  This" action should also add/select the package as a cart item.
- The booking modal should submit one customer/date/time request containing all
  selected items.
- WhatsApp and Formspree/email output should include a structured item list and
  estimated total, not just one broad service category.
- Preserve fallback behavior: if the user opens the global booking form without
  adding items, allow them to choose/type one requested service so the flow does
  not dead-end.

## Notification/storage implementation: Google Apps Script + styled Sheet
Use Google Apps Script instead of Formspree for the booking backend. The static
site posts booking data to a deployed Apps Script Web App. Apps Script should:
- Send the salon a branded HTML email notification.
- Append the booking to a Google Sheet.
- Style the Google Sheet with a blue header row, frozen headers, wrapped cells,
  alternating row shading, borders, highlighted status/total columns, and useful
  column widths.
- Preserve the website's confirmation popup and optional WhatsApp follow-up.

The frontend config is `BOOKING_WEB_APP_URL` in `index.html`. The Apps Script
source is `apps-script-booking.gs`; set `SHEET_ID` and `SALON_EMAIL`, deploy as a
Web App, then paste the deployment URL into `BOOKING_WEB_APP_URL`.

## Map/location refinement
The map should be more useful than a raw iframe. Use an OpenStreetMap embed near
Nansana-Masitowa/Wilsen Mall and pair it with clear human directions:
"basement at Wilsen Hotel / Wilsen Mall, Nansana-Masitowa." Include direct
actions for Google Maps search, OpenStreetMap, and WhatsApp directions so users
have a fallback if the exact pin varies between map providers.
