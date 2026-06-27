---
version: alpha
name: Mews Modern
description: A crisp hospitality-tech system with bold typography, playful magenta accents, and spacious editorial layouts.
colors:
  primary: '#ff83da'
  primary-soft: '#ffc5ee'
  secondary: '#000000'
  tertiary: '#e5e7eb'
  neutral: '#ffffff'
  surface: '#f7f7f7'
  on-surface: '#000000'
  error: '#d92d20'
typography:
  headline-display:
    fontFamily: Soehne
    fontSize: 39px
    fontWeight: 700
    lineHeight: 47px
    letterSpacing: 0.36px
  headline-lg:
    fontFamily: Soehne
    fontSize: 32px
    fontWeight: 700
    lineHeight: 40px
    letterSpacing: -0.77px
  headline-md:
    fontFamily: Soehne
    fontSize: 26px
    fontWeight: 400
    lineHeight: 31px
    letterSpacing: 0.15px
  headline-sm:
    fontFamily: Soehne
    fontSize: 21px
    fontWeight: 400
    lineHeight: 25px
    letterSpacing: 0px
  body-lg:
    fontFamily: Soehne
    fontSize: 17px
    fontWeight: 400
    lineHeight: 26px
    letterSpacing: 0.17px
  body-md:
    fontFamily: Soehne
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: 0.12px
  body-sm:
    fontFamily: Soehne
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0.08px
  label-lg:
    fontFamily: Soehne
    fontSize: 14px
    fontWeight: 700
    lineHeight: 20px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Soehne
    fontSize: 12px
    fontWeight: 700
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Soehne
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0px
  caption:
    fontFamily: Soehne
    fontSize: 12px
    fontWeight: 700
    lineHeight: 16px
    letterSpacing: 0.04em
rounded:
  none: 0px
  sm: 4px
  md: 8px
  lg: 16px
  xl: 24px
  full: 9999px
spacing:
  xs: 8px
  sm: 16px
  md: 30px
  lg: 40px
  xl: 80px
  gutter: 24px
  margin: 32px
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-surface}'
    typography: '{typography.label-md}'
    rounded: '{rounded.full}'
    padding: '14px 16px'
    height: '40px'
  button-secondary:
    backgroundColor: 'transparent'
    textColor: '{colors.on-surface}'
    typography: '{typography.label-md}'
    rounded: '{rounded.full}'
    padding: '14px 16px'
    height: '40px'
  button-link:
    backgroundColor: 'transparent'
    textColor: '{colors.on-surface}'
    typography: '{typography.label-sm}'
    rounded: '{rounded.none}'
    padding: '0px'
  card:
    backgroundColor: '{colors.primary-soft}'
    textColor: '{colors.on-surface}'
    rounded: '{rounded.md}'
    padding: '16px'
  input:
    backgroundColor: '{colors.neutral}'
    textColor: '{colors.on-surface}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.full}'
    padding: '12px 16px'
  chip:
    backgroundColor: '{colors.secondary}'
    textColor: '{colors.neutral}'
    typography: '{typography.label-sm}'
    rounded: '{rounded.full}'
    padding: '8px 12px'
---

# Mews Modern

## Overview

Mews feels like a confident hospitality SaaS brand: modern, energetic, and commercially polished, but with a playful flash of magenta that keeps it from feeling sterile. The experience is spacious and editorial, using large type, broad margins, and clear contrast to support a premium B2B audience. Overall the tone is professional-first, with just enough personality to signal innovation and warmth.

## Colors

- **Primary (#ff83da):** A vivid bubblegum-magenta accent used for high-visibility CTAs, badges, and interactive highlights. It creates the brand’s playful signature without overwhelming the layout.
- **Primary soft (#ffc5ee):** A lighter blush-magenta surface used for cards, panels, and softer background moments. It helps sections feel friendly and airy.
- **Secondary (#000000):** Deep black used for headline text, navigation, button text, and strong structural contrast. It provides the system’s sharp, editorial backbone.
- **Tertiary (#e5e7eb):** A quiet cool gray for borders and subtle separators. It supports structure without drawing attention away from content.
- **Neutral (#ffffff):** White is the main canvas color for dialogs, controls, and content surfaces. It keeps the UI clean and legible.
- **Surface (#f7f7f7):** A very light neutral surface for page framing and background differentiation. Use it when a section needs gentle separation from the white canvas.
- **On-surface (#000000):** The default text and icon color on light surfaces, preserving the brand’s crisp contrast.
- **Error (#d92d20):** Reserved for validation and destructive states; it should remain rare so the magenta brand accent stays distinct.

## Typography

Soehne is the sole voice of the system, giving Mews a contemporary, compact, and highly legible feel. Headlines are bold and tightly set, with `headline-display` and `headline-lg` carrying strong weight for hero moments and major section titles. Mid-level headings like `headline-md` and `headline-sm` loosen into regular weight for a more editorial, conversational tone.

Body copy stays clean and readable with medium line heights and modest positive letter spacing, matching the screenshot’s business-focused messaging. Labels and buttons use heavier weights and slightly increased letter spacing to feel crisp in navigation, actions, and interface chrome. The system does not rely on uppercase as a default convention; emphasis comes from weight, size, and spacing rather than all-caps treatment.

## Layout & Spacing

The layout is wide and generous, with clear horizontal breathing room and a strong preference for modular sections over dense columns. Spacing follows a steady rhythm built around 8px, 16px, 30px, 40px, and 80px steps, which creates a balanced mix of compact controls and expansive editorial framing. Cards and media blocks use simple internal padding rather than intricate nested spacing, helping the page remain easy to scan.

Containers should feel fixed-max-width rather than edge-to-edge, with content centered and aligned to a predictable grid. Use larger section padding for marketing pages and lighter padding for utility surfaces like dialogs and cards. Buttons and inline controls should maintain generous touch targets without appearing bulky.

## Elevation & Depth

The system is mostly flat, relying on contrast, borders, and tonal layering rather than strong shadow stacks. The primary depth signal is the modal dialog, which sits above the page with a soft, broad shadow that feels floating but restrained. Cards typically use subtle borders and color contrast to separate regions instead of heavy elevation.

This creates a calm, modern SaaS feel where hierarchy comes from layout and typography, not from dramatic depth effects. Reserve shadows for overlays, popovers, and dialogs; keep standard cards and panels nearly flat. Where separation is needed, prefer pale fills and thin borders over large blur radii.

## Shapes

The shape language is rounded and approachable, anchored by pill buttons and soft-cornered dialogs. Interactive controls, chips, and primary buttons should lean into `rounded.full` for the brand’s friendly, polished personality. Structural surfaces like cards and modals use moderate radii such as `rounded.md` to soften the interface without losing clarity.

Avoid sharp corners except where a control must read as a plain text link or utility element. The overall feel should be smooth and contemporary, never angular or overly decorative.

## Components

Buttons are a major brand expression and should feel concise, rounded, and high-contrast. Use `button-primary` for the main action: magenta fill, black text, `rounded.full`, and compact padding that still achieves a 40px minimum height. Use `button-secondary` for less prominent actions with transparent background and black outline; it should match the same size and radius as the primary button. Use `button-link` for inline legal or navigation links, keeping it visually minimal with underlined text and no surrounding shape.

Cards should use `card` with the soft blush background, subtle border, and 16px padding. They should support content blocks, feature callouts, and media captions without adding strong shadows. Inputs should be pill-shaped, clean, and lightweight; use white fill, black text, and generous internal padding so form fields feel aligned with the polished button system. Chips, tags, and category pills should feel compact and dark, as in the screenshot’s small section filters, with `chip` styling for terse labels and active-state emphasis.

Navigation items should remain understated and text-forward, relying on spacing and active-state contrast rather than boxed buttons. Dialogs and overlays should use a white surface, soft radius, and restrained shadow, with action buttons aligned horizontally and spaced evenly. Lists and utility links should inherit the label typography and keep visual noise low.

## Do's and Don'ts

- Do use Soehne consistently across headlines, body text, labels, and controls.
- Do keep primary actions pill-shaped, compact, and magenta.
- Do rely on black text for most content; the palette is intentionally high-contrast and simple.
- Do use wide spacing and generous margins to preserve the premium editorial feel.
- Don't introduce heavy gradients, neon colors, or multi-color UI chrome.
- Don't overuse shadows; reserve elevation for dialogs and transient overlays.
- Don't square off buttons or chips unless a link or utility element truly needs it.
- Don't let components become dense or cramped; the brand reads best with breathing room.
