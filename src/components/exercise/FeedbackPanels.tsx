interface PanelProps {
  role: string;
  subtitle: string;
  text: string | null;
  loading: boolean;
  variant: "coach" | "critic";
}

function FeedbackPanel({ role, subtitle, text, loading, variant }: PanelProps) {
  const colors =
    variant === "coach"
      ? "border-l-success text-success"
      : "border-l-accent text-accent";

  return (
    <div className={`rounded-lg border border-border bg-secondary/40 pl-4 pr-5 py-4 border-l-[3px] ${colors}`}>
      <p className="text-xs font-semibold flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full flex-shrink-0 bg-current" />
        {role} —{" "}
        <span className="font-normal">{subtitle}</span>
      </p>
      {loading ? (
        <div className="mt-2 space-y-2">
          <div className="h-3 rounded bg-muted animate-pulse w-full" />
          <div className="h-3 rounded bg-muted animate-pulse w-5/6" />
          <div className="h-3 rounded bg-muted animate-pulse w-4/6" />
        </div>
      ) : (
        <p className="mt-2 text-sm text-foreground/90 leading-relaxed">{text}</p>
      )}
    </div>
  );
}

interface FeedbackPanelsProps {
  coach: string | null;
  critic: string | null;
  loading: boolean;
}

export function FeedbackPanels({ coach, critic, loading }: FeedbackPanelsProps) {
  if (!loading && !coach && !critic) return null;

  return (
    <div className="mt-5 flex flex-col gap-3">
      <FeedbackPanel
        role="The Coach"
        subtitle="clean form"
        text={coach}
        loading={loading}
        variant="coach"
      />
      <FeedbackPanel
        role="The Critic"
        subtitle="the question you can't dodge"
        text={critic}
        loading={loading}
        variant="critic"
      />
    </div>
  );
}
