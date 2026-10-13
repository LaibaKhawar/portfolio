import { ImageResponse } from "next/og";
import { profile } from "@/content/profile";

export const alt = "Laiba Khawar, AI Engineer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const stages = ["Ingest", "Embed", "Retrieve", "Reason", "Verify", "Respond"];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#315b8c", padding: 72, color: "#f5ebdd", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: 22, color: "#f5ebdd", letterSpacing: 4, textTransform: "uppercase" }}>{profile.role}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -3 }}>{profile.name}</div>
          <div style={{ fontSize: 36, color: "#f5ebdd", marginTop: 12 }}>LLM systems that retrieve, reason, and verify.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 22, color: "#f5ebdd" }}>
          {stages.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex", padding: "8px 16px", border: "1px solid rgba(245, 235, 221,0.5)", borderRadius: 999, color: "#f5ebdd", background: i === 2 ? "#f2765e" : "transparent" }}>{s}</div>
              {i < stages.length - 1 ? <div style={{ width: 28, height: 2, background: "#f2765e", opacity: 0.6 }} /> : null}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
