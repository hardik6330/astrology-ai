// "AI is busy" card for the single-hand flow, with the retry cooldown.

import Card from "@/common/Card";
import Button from "@/common/Button";

export default function OverloadCard({ cooldown, preview, onRetry, onClear }) {
  return (
    <Card
      className="text-center"
      style={{ borderColor: "rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.08)" }}
    >
      <div className="mb-2 text-4xl">⏳</div>
      <p className="mx-0 mt-0 mb-1.5 text-[15px] font-semibold text-warning">AI is busy right now</p>
      <p className="mx-0 mt-0 mb-4 text-[12.5px] leading-[1.6] text-subtle">
        Our reader couldn't analyze your palm after several tries.
        {cooldown > 0 ? " Please wait a moment before trying again." : " You can try again now."}
      </p>
      {preview ? (
        <Button
          variant="magic"
          onClick={onRetry}
          disabled={cooldown > 0}
          fullWidth
          className="disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cooldown > 0 ? `🕒 Try Again in ${cooldown}s` : "🔄 Try Again with Same Photo"}
        </Button>
      ) : (
        <Button
          variant="magic"
          onClick={onClear}
          disabled={cooldown > 0}
          fullWidth
          className="disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cooldown > 0 ? `🕒 Wait ${cooldown}s` : "Upload a New Photo"}
        </Button>
      )}
    </Card>
  );
}
