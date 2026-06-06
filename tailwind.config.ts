import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0b1220",
          panel: "#111b2f"
        },
        accent: {
          DEFAULT: "#38bdf8",
          success: "#34d399",
          danger: "#fb7185"
        }
      },
      keyframes: {
        arrowReveal: {
          "0%": { transform: "scale(0.3) rotate(-25deg)", opacity: "0" },
          "60%": { transform: "scale(1.18) rotate(6deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" }
        },
        popIn: {
          "0%": { transform: "scale(0)", opacity: "0" },
          "70%": { transform: "scale(1.3)" },
          "100%": { transform: "scale(1)", opacity: "1" }
        },
        flashSuccess: {
          "0%, 100%": { opacity: "0" },
          "25%": { opacity: "1" }
        },
        flashDanger: {
          "0%, 100%": { opacity: "0" },
          "25%": { opacity: "1" }
        },
        confettiFall: {
          "0%": { transform: "translateY(-20%) rotate(0deg)", opacity: "1" },
          "100%": { transform: "translateY(360px) rotate(720deg)", opacity: "0" }
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        nextCardPulse: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(217,70,239,0)" },
          "50%": { boxShadow: "0 0 26px 4px rgba(217,70,239,0.45)" }
        },
        candleFlicker: {
          "0%, 100%": { opacity: "0.55" },
          "20%": { opacity: "0.8" },
          "45%": { opacity: "0.4" },
          "70%": { opacity: "0.7" },
          "85%": { opacity: "0.5" }
        },
        cardSheen: {
          "0%": { transform: "translateX(-160%) skewX(-12deg)" },
          "60%, 100%": { transform: "translateX(160%) skewX(-12deg)" }
        },
        borderShift: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" }
        },
        twinkle: {
          "0%, 100%": { opacity: "0.2", transform: "scale(0.75)" },
          "50%": { opacity: "1", transform: "scale(1.15)" }
        },
        floatSlow: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" }
        },
        warpDrift: {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(140px)" }
        },
        diceShake: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "20%": { transform: "translateY(-3px) rotate(-9deg)" },
          "45%": { transform: "translateY(2px) rotate(7deg)" },
          "70%": { transform: "translateY(-2px) rotate(-5deg)" }
        },
        // Distance-aware lunge: the travel distance is fed in per-render via the
        // --charge-distance CSS var (measured gap between the two beasts) so the
        // attacker actually reaches its opponent at any screen size. A small
        // backward wind-up (12%) precedes the lunge, and the apex is held briefly
        // (50%→62%) as a hit-stop so the contact reads as an impact.
        chargeRight: {
          "0%": { transform: "translateX(0)" },
          "12%": { transform: "translateX(calc(var(--charge-distance, 46px) * -0.08))" },
          "30%": { transform: "translateX(calc(var(--charge-distance, 46px) * 0.16))" },
          "50%": { transform: "translateX(var(--charge-distance, 46px))" },
          "62%": { transform: "translateX(var(--charge-distance, 46px))" },
          "78%": { transform: "translateX(calc(var(--charge-distance, 46px) * 0.82))" },
          "100%": { transform: "translateX(0)" }
        },
        chargeLeft: {
          "0%": { transform: "translateX(0)" },
          "12%": { transform: "translateX(calc(var(--charge-distance, 46px) * 0.08))" },
          "30%": { transform: "translateX(calc(var(--charge-distance, 46px) * -0.16))" },
          "50%": { transform: "translateX(calc(var(--charge-distance, 46px) * -1))" },
          "62%": { transform: "translateX(calc(var(--charge-distance, 46px) * -1))" },
          "78%": { transform: "translateX(calc(var(--charge-distance, 46px) * -0.82))" },
          "100%": { transform: "translateX(0)" }
        },
        // Directional recoil: the victim is knocked away from the attacker (sign
        // baked into each variant) with a couple of diminishing bounces. Distance
        // scales with the hit via --kb.
        knockbackLeft: {
          "0%": { transform: "translateX(0) rotate(0deg)" },
          "18%": { transform: "translateX(calc(var(--kb, 14px) * -1)) rotate(-6deg)" },
          "45%": { transform: "translateX(calc(var(--kb, 14px) * 0.4)) rotate(3deg)" },
          "70%": { transform: "translateX(calc(var(--kb, 14px) * -0.18)) rotate(-1.5deg)" },
          "100%": { transform: "translateX(0) rotate(0deg)" }
        },
        knockbackRight: {
          "0%": { transform: "translateX(0) rotate(0deg)" },
          "18%": { transform: "translateX(var(--kb, 14px)) rotate(6deg)" },
          "45%": { transform: "translateX(calc(var(--kb, 14px) * -0.4)) rotate(-3deg)" },
          "70%": { transform: "translateX(calc(var(--kb, 14px) * 0.18)) rotate(1.5deg)" },
          "100%": { transform: "translateX(0) rotate(0deg)" }
        },
        // Camera shake on impact; amplitude via --shake (scaled by hit size).
        stageShake: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "15%": { transform: "translate(calc(var(--shake, 4px) * -1), calc(var(--shake, 4px) * 0.5))" },
          "30%": { transform: "translate(var(--shake, 4px), calc(var(--shake, 4px) * -0.4))" },
          "45%": { transform: "translate(calc(var(--shake, 4px) * -0.7), 0)" },
          "60%": { transform: "translate(calc(var(--shake, 4px) * 0.5), calc(var(--shake, 4px) * 0.3))" },
          "80%": { transform: "translate(calc(var(--shake, 4px) * -0.25), 0)" }
        },
        // Floating damage/heal number: pops then drifts up and fades.
        damageFloat: {
          "0%": { transform: "translate(-50%, 4px) scale(0.6)", opacity: "0" },
          "18%": { transform: "translate(-50%, -4px) scale(1.15)", opacity: "1" },
          "70%": { transform: "translate(-50%, -22px) scale(1)", opacity: "1" },
          "100%": { transform: "translate(-50%, -38px) scale(1)", opacity: "0" }
        },
        // KO: tip back, topple past 180°, then settle upside-down.
        koTopple: {
          "0%": { transform: "rotate(0deg) translateY(0)" },
          "22%": { transform: "rotate(-14deg) translateY(0)" },
          "65%": { transform: "rotate(196deg) translateY(6px)" },
          "82%": { transform: "rotate(174deg) translateY(0)" },
          "100%": { transform: "rotate(180deg) translateY(0)" }
        },
        // Win screen: the loser is launched off the stage, tumbling and fading.
        koFlyoffLeft: {
          "0%": { transform: "translate(0, 0) rotate(0deg)", opacity: "1" },
          "22%": { transform: "translate(-44px, -22px) rotate(-30deg)", opacity: "1" },
          "100%": { transform: "translate(-620px, 48px) rotate(-520deg)", opacity: "0" }
        },
        koFlyoffRight: {
          "0%": { transform: "translate(0, 0) rotate(0deg)", opacity: "1" },
          "22%": { transform: "translate(44px, -22px) rotate(30deg)", opacity: "1" },
          "100%": { transform: "translate(620px, 48px) rotate(520deg)", opacity: "0" }
        },
        // Win screen: the winner winds up, drives across into the loser, holds at
        // the point of contact, then strides back to center.
        winnerLungeLeft: {
          "0%": { transform: "translateX(0)" },
          "12%": { transform: "translateX(16px)" },
          "34%": { transform: "translateX(-150px)" },
          "48%": { transform: "translateX(-150px)" },
          "72%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(0)" }
        },
        winnerLungeRight: {
          "0%": { transform: "translateX(0)" },
          "12%": { transform: "translateX(-16px)" },
          "34%": { transform: "translateX(150px)" },
          "48%": { transform: "translateX(150px)" },
          "72%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(0)" }
        }
      },
      animation: {
        "arrow-reveal": "arrowReveal 0.6s ease-out both",
        "pop-in": "popIn 0.45s ease-out both",
        "flash-success": "flashSuccess 1.1s ease-out",
        "flash-danger": "flashDanger 1.1s ease-out",
        confetti: "confettiFall 2.8s linear infinite",
        "fade-up": "fadeUp 0.5s ease-out both",
        "next-card-pulse": "nextCardPulse 1.8s ease-in-out infinite",
        "candle-flicker": "candleFlicker 4.5s ease-in-out infinite",
        "card-sheen": "cardSheen 3.8s ease-in-out infinite",
        "border-shift": "borderShift 7s ease infinite",
        twinkle: "twinkle 3s ease-in-out infinite",
        "float-slow": "floatSlow 6s ease-in-out infinite",
        "warp-drift": "warpDrift 3s linear infinite",
        "dice-shake": "diceShake 0.55s ease-in-out infinite",
        "charge-right": "chargeRight 0.6s ease-in-out both",
        "charge-left": "chargeLeft 0.6s ease-in-out both",
        "knockback-left": "knockbackLeft 0.5s ease-out both",
        "knockback-right": "knockbackRight 0.5s ease-out both",
        "stage-shake": "stageShake 0.45s ease-out both",
        "damage-float": "damageFloat 1s ease-out both",
        "ko-topple": "koTopple 0.8s ease-out both",
        "ko-flyoff-left": "koFlyoffLeft 1.1s ease-in both",
        "ko-flyoff-right": "koFlyoffRight 1.1s ease-in both",
        "winner-lunge-left": "winnerLungeLeft 0.9s ease-out both",
        "winner-lunge-right": "winnerLungeRight 0.9s ease-out both"
      }
    }
  },
  plugins: []
};

export default config;
