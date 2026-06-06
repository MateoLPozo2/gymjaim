import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/send-due-reviews")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { processDueReviewQueue } = await import("@/lib/reviews/process-due-reviews");
        try {
          const result = await processDueReviewQueue(supabaseAdmin);
          return Response.json(result);
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : String(e) },
            { status: 500 },
          );
        }
      },
    },
  },
});
