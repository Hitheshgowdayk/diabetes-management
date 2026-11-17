import { useEffect, useState } from 'react';
import { Apple, Footprints, HeartPulse } from 'lucide-react';
import { apiRequest } from '../lib/api';
import type { NutritionArticle } from '../types';

export function NutritionPage() {
  const [articles, setArticles] = useState<NutritionArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plateImgFailed, setPlateImgFailed] = useState(false);
  const [activityImgFailed, setActivityImgFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiRequest<{ articles: NutritionArticle[] }>('/api/nutrition')
      .then((data) => {
        if (!cancelled) setArticles(data.articles);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load nutrition guide.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">Food, Nutrition &amp; Lifestyle Guide</h1>
        <p className="mt-1 text-sm text-slate-600">
          Evidence-aligned educational awareness on balanced meals, carbohydrate pacing, and everyday physical activity.
        </p>
      </div>

      {/* Editorial Visual Guides */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {!plateImgFailed ? (
            <img
              src="/src/assets/images/nutrition_balanced_plate_1794937162940.jpg"
              alt="Balanced meal plate with non-starchy vegetables, grilled salmon, and quinoa"
              referrerPolicy="no-referrer"
              onError={() => setPlateImgFailed(true)}
              className="h-56 w-full object-cover"
            />
          ) : (
            <div className="h-56 w-full bg-slate-100 flex flex-col items-center justify-center text-slate-500">
              <Apple className="h-8 w-8 text-[#0D9488]" />
              <span className="mt-2 text-xs font-medium">Balanced Plate Visual</span>
            </div>
          )}
          <div className="p-5">
            <p className="text-xs font-medium text-[#0D9488]">Meal Planning Framework</p>
            <h2 className="mt-1 text-lg font-bold text-[#0F172A]">Balanced Plate Proportions</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Half non-starchy vegetables, one-quarter lean protein, and one-quarter whole-grain or high-fiber
              carbohydrates offer a practical, flexible structure without rigid diet rules.
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {!activityImgFailed ? (
            <img
              src="/src/assets/images/nutrition_active_lifestyle_1794937162678.jpg"
              alt="Person walking briskly on a sunlit park path for daily physical activity"
              referrerPolicy="no-referrer"
              onError={() => setActivityImgFailed(true)}
              className="h-56 w-full object-cover"
            />
          ) : (
            <div className="h-56 w-full bg-slate-100 flex flex-col items-center justify-center text-slate-500">
              <Footprints className="h-8 w-8 text-[#0F2942]" />
              <span className="mt-2 text-xs font-medium">Active Lifestyle Guide</span>
            </div>
          )}
          <div className="p-5">
            <p className="text-xs font-medium text-[#0F2942]">Physical Activity Awareness</p>
            <h2 className="mt-1 text-lg font-bold text-[#0F172A]">Consistent Daily Movement</h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Short walks after meals and regular moderate movement help muscles take up glucose naturally. Always
              check with your clinician before starting strenuous exercise routines.
            </p>
          </div>
        </div>
      </div>

      {/* Database-Backed Educational Articles */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {articles.map((article) => (
            <article key={article.id} className="bg-white border border-slate-200 rounded-xl p-6">
              <p className="text-xs font-medium text-[#0D9488]">{article.category}</p>
              <h3 className="mt-1 text-base font-bold text-[#0F172A]">{article.title}</h3>
              <p className="mt-2 text-xs font-medium text-slate-500">{article.summary}</p>
              <p className="mt-3 text-sm text-slate-700 leading-relaxed">{article.content}</p>
            </article>
          ))}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-3">
        <HeartPulse className="h-5 w-5 text-[#0D9488] shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 leading-relaxed">
          Educational Notice: Nutrition and lifestyle content is provided for general health literacy and does not
          prescribe restrictive diets or replace individualized medical nutrition therapy from a registered dietitian or
          physician.
        </p>
      </div>
    </div>
  );
}
