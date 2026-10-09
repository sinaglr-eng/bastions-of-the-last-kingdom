# Boss Health and Touch Selection — 0.3.25

Pause / Resume and game speed appear immediately to the left of Enemy Waves. They keep their existing 44 px touch targets, keyboard behavior and live state.

Selecting a placed defender in the bottom draft updates the command panel, including its portrait, name, rank comparison and stats. Accepted pointer taps are validated against the current card and tower identity. Touch releases use the card under the release coordinates rather than depending only on the event target. A native click can select a card when no usable pointer release was delivered; this fallback cannot keep a defender by itself. Dragging, cancelled and multi-finger gestures cannot become selections or keeper confirmations. Two accepted taps on the same eligible draft candidate can still keep it, and the separate Keep / Merge buttons remain available.

For boss waves, the unselected combat panel shows a health bar and current / maximum HP from the actual living, revealed bosses. Approaching bosses and concealed health are identified separately. Ordinary waves retain their live and approaching invader counts. A revealed boss's health updates after damage and healing, and remains stationary while the combat is paused.

Verification distinguishes automated touch-event sequences and browser checks at tablet portrait / landscape sizes from testing on a physical iPad. Neither desktop browser dimensions nor a simulated touch event are claimed as a hardware Safari test.
