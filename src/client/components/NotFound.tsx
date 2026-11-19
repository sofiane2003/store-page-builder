import { Link } from "@tanstack/react-router";
import { EmptyState } from "@/client/components/EmptyState";
import { Button } from "@/client/components/ui/button";

export function NotFoundState({ what, back }: { what: string; back: "/" | "/quizzes" }) {
  return (
    <div data-testid="not-found">
      <EmptyState
        kind="filtered"
        title={`${what} not found`}
        action={<Button variant="outline" render={<Link to={back} />}>Back</Button>}
      />
    </div>
  );
}
