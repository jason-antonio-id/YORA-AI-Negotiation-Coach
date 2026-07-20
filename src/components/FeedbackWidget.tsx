import React, { useState } from 'react';
import { useSupabase } from '../lib/SupabaseContext';

export function FeedbackWidget() {
  const { user } = useSupabase();
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === null || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email || '', rating, comment }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      }
    } catch (err) {
      console.error("Error submitting feedback:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-white border border-border-light rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] animate-fade-in-up">
      {submitted ? (
        <div className="flex flex-col items-center justify-center py-4 text-center gap-2">
          <span className="text-4xl">🙏</span>
          <h3 className="font-display-lg text-lg font-bold text-charcoal">Terima kasih atas feedbacknya!</h3>
          <p className="text-xs text-subtitle-grey">Masukan Anda sangat berharga untuk terus meningkatkan YORA.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h3 className="font-display-lg text-base font-bold text-charcoal">Gimana pengalaman Anda dengan YORA?</h3>
            <p className="text-xs text-subtitle-grey mt-1">Bantu kami meningkatkan kualitas dengan memberikan rating.</p>
          </div>

          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => {
              const isSelected = rating !== null && star <= rating;
              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1 rounded-md transition-transform active:scale-90"
                  title={`${star} / 5`}
                >
                  <span
                    className="material-symbols-outlined text-3xl"
                    style={{
                      fontVariationSettings: isSelected ? "'FILL' 1" : "'FILL' 0",
                      color: isSelected ? '#E30613' : '#D1D5DB',
                    }}
                  >
                    star
                  </span>
                </button>
              );
            })}
          </div>

          {rating !== null && (
            <div className="space-y-3 animate-fade-in-up">
              <div>
                <label htmlFor="feedback-comment" className="text-xs font-bold text-subtitle-grey block mb-1">
                  Ada yang bisa kami perbaiki? (opsional)
                </label>
                <textarea
                  id="feedback-comment"
                  rows={3}
                  maxLength={500}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tulis saran atau komentar Anda di sini..."
                  className="w-full text-sm p-3 border border-border-light rounded-xl bg-surface-muted outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none text-charcoal"
                />
                <div className="text-right text-[10px] text-subtitle-grey/60 mt-1">
                  {comment.length} / 500
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-primary hover:bg-opacity-90 text-white font-bold text-sm rounded-full flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {submitting ? (
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                ) : null}
                Kirim Feedback
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
