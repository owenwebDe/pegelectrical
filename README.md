# Peg Electrical & General Service

Demo website for **Peg Electrical & General Service** — domestic, commercial and
industrial electrical installation in Port Harcourt. 10 Alcon Rd, Woji, Port
Harcourt 500102, Rivers State.

Built by [IconEdge Technologies LTD](https://github.com/owenwebDe).

Same engine as the Olem, TK-OLA and Fidotech demos — GSAP 3.13 + Lenis motion
layer, Three.js hero, the ported liquid-glass refraction.

## Running it

Static HTML. No build step, no dependencies to install.

```bash
npx serve .          # or any static server
```

Deploying: point Vercel, Netlify or any static host at this folder. `vercel.json`
and `netlify.toml` are included and only set cache and security headers.

## What is verified, and where it came from

Everything factual on this page came from Peg Electrical's own public Google
Maps listing, or from their WhatsApp conversation with IconEdge on 9 Nov 2026.
Nothing else is claimed.

| On the page | Source |
|---|---|
| Peg Electrical & General Service | Google listing, their registered name |
| 10 Alcon Rd, Woji, Port Harcourt 500102, Rivers | Google listing |
| 0703 059 7173, WhatsApp and phone | Google listing, WhatsApp confirmed |
| Electrician | Google listing category |
| 5.0 rating | Google listing (**1 review** — see below) |

**They have no website.** A search returned 8 results and none were theirs, so
this is the first one.

## What the page deliberately does NOT claim

This is the same discipline as the Olem demo: the gaps are left open rather than
faked, because a claim the client has to walk back is worse than a gap.

- **No prices anywhere.** They asked "How much" on WhatsApp and were told Boss
  would advise after they saw a sample. So the page quotes nothing and the
  materials section says every job is priced for the work it needs.
- **No materials supply arm.** The Olem site sells materials; nothing on record
  says Peg does. That section was turned into *What we install* — the same six
  categories, described as things they fit rather than things they sell.
- **No referral story.** Olem's page says almost every job comes by referral.
  That is Olem's claim, not Peg's. It was replaced with the testing standard and
  the one fact that is on record: the 5.0 Google rating.
- **No promise of references.** The original offered to send "a reference from a
  job near you". We cannot promise that on their behalf, so it now invites the
  customer to send their own photographs instead.
- **No past projects, no client names, no completed-job claims.**

### About the 5.0 rating

It is genuine, and it is from **one review**. The page says "Rated on Google"
and does not say "hundreds of happy customers". If Peg would rather not lead
with it at all, it is one line in the hero facts.

## Photographs are placeholders

**All four photographs in `assets/img/` are licensed stand-ins, not Peg's work.**
They are credited in `credits.html` under CC BY / CC BY-SA licences and were shot
in Europe and America. Real photographs of Peg's own boards, risers and finished
rooms would improve this page more than anything else in the repo.

## The quote form

Peg has **no email address on file** and the site has no backend, so the form in
`#quote` composes its five fields into a single WhatsApp message and opens it.
It works on any static host, the enquiry arrives complete, and the client keeps a
copy in their own chat.

It is wired in `assets/app.js` (`quoteForm()`), deliberately **before** the
reduced-motion bail-out — the form is the page's transaction, not an animation,
so it works with every effect switched off. The number lives in one place, the
`data-wa` attribute on the form.

## Still to confirm with Peg

- **Services.** The page lists domestic, commercial and industrial wiring, which
  is standard for the trade and matches their listing. Their name says "& General
  Service" — ask what else they do, because it is probably not on the page.
- **Email address** — there is none on the site at all right now
- **Logo** — the page uses a placeholder ring-and-bolt mark
- **Photographs** of their own work, and whether any client may be named
- **Office hours**, and whether they take emergency call-outs
- **Service area** — the page says Port Harcourt and across Rivers State. Confirm
  how far they travel
- Any registration (CAC, NEMSA) they want shown — none is claimed at present
- Whether the hero line "Wiring for homes, offices & plants" is right, or whether
  they mostly do one of the three
