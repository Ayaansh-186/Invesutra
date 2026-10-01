import { ImageResponse } from "next/og";

export const socialImageSize = {
  width: 1200,
  height: 630,
};

export function createSocialImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#102820",
          color: "white",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          padding: "72px",
          width: "100%",
        }}
      >
        <div
          style={{
            borderLeft: "10px solid #b9e9cb",
            display: "flex",
            flexDirection: "column",
            maxWidth: "980px",
            paddingLeft: "48px",
          }}
        >
          <div style={{ color: "#b9e9cb", display: "flex", fontSize: 28 }}>
            Mutual fund portfolio intelligence
          </div>
          <div style={{ display: "flex", fontSize: 86, fontWeight: 700, marginTop: 18 }}>
            Invesutra
          </div>
          <div style={{ color: "#d6e4de", display: "flex", fontSize: 36, lineHeight: 1.35, marginTop: 22 }}>
            Understand your investments. Make clearer portfolio decisions.
          </div>
        </div>
      </div>
    ),
    socialImageSize,
  );
}
