/**
 * Ambient background for the authenticated app.
 *
 * Deliberately CSS, not canvas. A canvas field would cost a rAF loop and
 * battery on a page whose real job is rendering live market data — this is
 * three blurred radial blobs animating transform and opacity only, so it
 * stays on the compositor and never touches layout or paint.
 *
 * Opacity is low on purpose. The design system is flat near-black with one
 * lime accent; this adds depth behind the cards without turning into the
 * gradient soup it would be at any higher strength.
 *
 * Not a client component — it renders no interactivity and needs no JS.
 * `prefers-reduced-motion` is honoured in CSS, which also covers users who
 * change the setting after load.
 */
export function Ambient() {
  return (
    <div aria-hidden="true" className="ambient" data-testid="ambient">
      <span className="ambient-blob ambient-blob-1" />
      <span className="ambient-blob ambient-blob-2" />
      <span className="ambient-blob ambient-blob-3" />
    </div>
  )
}
