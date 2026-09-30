import CommentSimulationTools from "@/components/admin/CommentSimulationTools";
import Link from "next/link";
import { getAdminComments } from "@/lib/journal/admin-comment-queries";
import {
  approveCommentAction,
  rejectCommentAction,
  deleteCommentAction,
} from "../comment-actions";

function formatCommentDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(date));
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function AdminCommentsPage() {
  const comments = await getAdminComments();

  return (
    <main className="admin-content">
      <div className="admin-page-heading">
        <div>
          <p className="eyebrow">Moderation</p>
          <h1>Comments</h1>
          <p className="muted-note">
            Review reader comments before they appear publicly.
          </p>
        </div>
      </div>

      <CommentSimulationTools />

      {comments.length === 0 ? (
        <div className="admin-empty-state">
          <h2>No comments yet</h2>
          <p>
            Reader comments submitted through your articles will appear here.
          </p>
        </div>
      ) : (
        <div className="admin-comments-list">
          {comments.map((comment) => (
            <article className="admin-comment-card" key={comment.id}>
              <div className="admin-comment-header">
                <div>
                  <p className="eyebrow">{statusLabel(comment.status)}</p>
                  <h2>{comment.name}</h2>
                </div>

                <time dateTime={comment.createdAt}>
                  {formatCommentDate(comment.createdAt)}
                </time>
              </div>

              <div className="admin-comment-meta">
                <span>{comment.email}</span>
                {comment.articleSlug ? (
                  <Link href={`/articles/${comment.articleSlug}`}>
                    {comment.articleTitle}
                  </Link>
                ) : (
                  <span>{comment.articleTitle}</span>
                )}
              </div>

              <p className="admin-comment-content">
                {comment.content}
              </p>

              <div className="admin-comment-actions">
                {comment.status !== "approved" && (
                  <form
                    action={approveCommentAction.bind(
                      null,
                      comment.id,
                    )}
                  >
                    <button type="submit" className="button">
                      Approve
                    </button>
                  </form>
                )}

                {comment.status !== "rejected" && (
                  <form
                    action={rejectCommentAction.bind(
                      null,
                      comment.id,
                    )}
                  >
                    <button type="submit" className="text-link">
                      Reject
                    </button>
                  </form>
                )}

                <form
                  action={deleteCommentAction.bind(
                    null,
                    comment.id,
                  )}
                >
                  <input type="hidden" name="confirm" value="yes" />
                  <button type="submit" className="text-link">
                    Delete
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}