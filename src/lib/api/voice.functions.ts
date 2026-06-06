import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SynthesizeInput = z.object({ text: z.string().min(1).max(2000) });

export const synthesizeVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SynthesizeInput.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
    if (!apiKey) {
      throw new Error("ElevenLabs is not configured (ELEVENLABS_API_KEY missing)");
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: data.text,
          model_id: "eleven_multilingual_v2",
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`ElevenLabs error: ${err.slice(0, 200)}`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    return { audio_base64: buf.toString("base64"), content_type: "audio/mpeg" };
  });
