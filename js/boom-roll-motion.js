// The turning: a gentle turn one way and back at rest (±6°), a full turn either way by hand, the angle kept
// when let go and the rest turn resuming round it after a pause; reduced motion keeps only the hand.
export function rollMotion({ still = false } = {}) {
  const st = { angle: 0, base: 0, t: 0, held: false, since: 9, sway: 0, still };
  const TAU = Math.PI * 2;
  return {
    state: st,
    step(dt) {
      st.t += dt;
      if (st.held) return;
      st.since += dt;
      const want = st.still ? 0 : Math.min(1, Math.max(0, (st.since - 0.9) / 1.2));
      st.sway += (want - st.sway) * Math.min(1, dt * 3);
      st.angle = st.base + (6 * Math.PI / 180) * st.sway * Math.sin(st.t * TAU / 4.6);
    },
    hold() { st.held = true; st.sway = 0; st.base = st.angle; },
    turnBy(rad) { st.angle += rad; st.base = st.angle; },
    letGo() { st.held = false; st.since = 0; st.base = st.angle; },
    nudge(rad) { st.base += rad; st.angle += rad; st.since = 0; st.sway = 0; },
  };
}
