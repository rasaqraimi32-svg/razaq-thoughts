"use client";

import { useActionState } from "react";
import { submitCommentAction } from "@/app/articles/comment-actions";
import type { MutationState } from "@/lib/journal/types";

type Props = {
  articleId: string;
  slug: string;
};

const initialState: MutationState = {};

export default function CommentForm({ articleId, slug }: Props) {
  const [state, formAction, pending] = useActionState(
    submitCommentAction.bind(null, articleId, slug),
    initialState,
  );

  return (
    <form action={formAction} className="comment-form">
      {state.success && (
        <div className="comment-success" role="status">
          {state.success}
        </div>
      )}

      {state.error && !state.errors && (
        <div className="comment-error" role="alert">
          {state.error}
        </div>
      )}

      <div className="comment-fields">
        <div className="comment-field">
          <label htmlFor="comment-name">Name</label>
          <input
            id="comment-name"
            name="name"
            type="text"
            autoComplete="name"
            maxLength={100}
            required
            aria-invalid={Boolean(state.errors?.name)}
            aria-describedby={state.errors?.name ? "comment-name-error" : undefined}
          />
          {state.errors?.name && (
            <p id="comment-name-error" className="comment-field-error">
              {state.errors.name}
            </p>
          )}
        </div>

        <div className="comment-field">
          <label htmlFor="comment-email">Email</label>
          <input
            id="comment-email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            aria-invalid={Boolean(state.errors?.email)}
            aria-describedby={state.errors?.email ? "comment-email-error" : undefined}
          />
          {state.errors?.email && (
            <p id="comment-email-error" className="comment-field-error">
              {state.errors.email}
            </p>
          )}
        </div>
      </div>

      <div className="comment-field">
        <label htmlFor="comment-content">Your comment</label>
        <textarea
          id="comment-content"
          name="content"
          rows={6}
          maxLength={2000}
          required
          aria-invalid={Boolean(state.errors?.content)}
          aria-describedby={state.errors?.content ? "comment-content-error" : undefined}
        />
        {state.errors?.content && (
          <p id="comment-content-error" className="comment-field-error">
            {state.errors.content}
          </p>
        )}
      </div>

      <p className="comment-note">
        Your comment will be reviewed before it appears publicly. Your email
        address will not be displayed.
      </p>

      <button type="submit" className="button" disabled={pending}>
        {pending ? "Submitting…" : "Submit comment"}
      </button>
    </form>
  );
}