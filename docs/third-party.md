# Third-party UI sources

| Source | Item | URL | Licence | Use | Changes |
| --- | --- | --- | --- | --- | --- |
| BoardUI | Free components and design tokens | https://www.boardui.com | MIT | Prototype UI | Teal accent ramp and Hindi font fallback per B2–B3 |
| Motion | motion 12.42.2 | https://motion.dev | MIT | Staff number interpolation and /demo words | Already installed; no parent-route import |

| 21st.dev prompts | app-sign-in, hero-02 | Supplied by the human as prompts | Not stated | Layout reference for AuthLayout and StaffPage | No code, images, packages or copy taken. Rebuilt with BoardUI tokens and plain CSS |
| React Bits | CountUp (TS-TW) | https://reactbits.dev/r/CountUp-TS-TW.json | MIT + Commons Clause; copyright David Haz, retained in components/vendor/reactbits/LICENSE.md | S1 totals | Kept numeric interpolation only, exact SSR and completion, inr formatting, 500ms only after a stored value changes, reduced-motion bypass |
| React Bits | BlurText (TS-TW) | https://reactbits.dev/r/BlurText-TS-TW.json | MIT + Commons Clause; same retained licence | /demo heading | Whole words only, 200ms ease-out, no loop, reduced-motion CSS and hook |

No Pro components, 21st.dev code or MotionSites prompts were imported. docs/inbox/ was absent; timeline, empty state and role cards use BoardUI/CSS. React Bits is included only within this application; the public-repository interpretation remains assumption A23 for the TDD.
