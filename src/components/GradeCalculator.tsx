import React, { useState } from 'react';
import { Course, Assignment } from '../types';
import { Calculator, Target, TrendingUp } from 'lucide-react';

interface GradeCalculatorProps {
  courses: Course[];
  assignments: Assignment[];
  onUpdateScore: (assignmentId: string, score: number | null) => void;
  onUpdateWeight: (assignmentId: string, weightPercent: number | null) => void;
}

export const GradeCalculator: React.FC<GradeCalculatorProps> = ({
  courses,
  assignments,
  onUpdateScore,
  onUpdateWeight
}) => {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    courses[0]?.id || ''
  );
  const [targetGrade, setTargetGrade] = useState<number>(93);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const courseAssignments = assignments.filter((a) => a.courseId === selectedCourseId);

  let totalGradedWeight = 0;
  let totalEarnedPoints = 0;
  let remainingWeight = 0;

  courseAssignments.forEach((a) => {
    const weight = a.weightPercent || 0;
    if (a.score !== undefined && a.score !== null && !isNaN(a.score)) {
      totalGradedWeight += weight;
      totalEarnedPoints += (a.score * weight) / 100;
    } else {
      remainingWeight += weight;
    }
  });

  const hasAnyGrade = totalGradedWeight > 0;
  const currentPercentage = hasAnyGrade ? (totalEarnedPoints / totalGradedWeight) * 100 : 0;
  // Genuine sum of every item's weight, for the "does this add up to 100%" check —
  // deliberately not the `|| 100` fallback used below for the projection math.
  const weightSum = totalGradedWeight + remainingWeight;
  const totalCourseWeight = weightSum || 100;
  const targetTotalPoints = (targetGrade * totalCourseWeight) / 100;
  const neededEarnedPoints = targetTotalPoints - totalEarnedPoints;
  const neededScoreOnRemaining = remainingWeight > 0 ? (neededEarnedPoints / remainingWeight) * 100 : 0;

  const getLetterGrade = (pct: number) => {
    if (pct >= 93) return { grade: 'A', color: 'text-emerald-700', stroke: '#059669', bg: 'bg-emerald-50 border-emerald-200' };
    if (pct >= 90) return { grade: 'A-', color: 'text-emerald-600', stroke: '#10b981', bg: 'bg-emerald-50 border-emerald-200' };
    if (pct >= 87) return { grade: 'B+', color: 'text-blue-700', stroke: '#2563eb', bg: 'bg-blue-50 border-blue-200' };
    if (pct >= 83) return { grade: 'B', color: 'text-blue-700', stroke: '#2563eb', bg: 'bg-blue-50 border-blue-200' };
    if (pct >= 80) return { grade: 'B-', color: 'text-blue-600', stroke: '#3b82f6', bg: 'bg-blue-50 border-blue-200' };
    if (pct >= 77) return { grade: 'C+', color: 'text-amber-700', stroke: '#d97706', bg: 'bg-amber-50 border-amber-200' };
    if (pct >= 70) return { grade: 'C', color: 'text-amber-700', stroke: '#d97706', bg: 'bg-amber-50 border-amber-200' };
    return { grade: 'F', color: 'text-rose-700', stroke: '#dc2626', bg: 'bg-rose-50 border-rose-200' };
  };

  const currentGradeInfo = hasAnyGrade
    ? getLetterGrade(currentPercentage)
    : { grade: '—', color: 'text-slate-400', stroke: '#CBD5E1', bg: 'bg-slate-50 border-slate-200' };
  const circleRadius = 54;
  const strokeDasharray = 2 * Math.PI * circleRadius;
  const strokeDashoffset = hasAnyGrade
    ? strokeDasharray - (strokeDasharray * Math.min(currentPercentage, 100)) / 100
    : strokeDasharray; // empty ring — no grades entered yet

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-caplen-navy flex items-center gap-2">
            <Calculator className="h-6 w-6 text-vibrant-purpleText" />
            <span>Grade & Target Score Simulator</span>
          </h1>
          <p className="text-xs text-caplen-muted mt-1 font-medium">
            Calculate your current weighted course grade and project required scores on remaining exams.
          </p>
        </div>

        {courses.length > 0 && (
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="rounded-2xl bg-white border border-slate-200 px-4 py-2 text-xs font-bold text-caplen-navy focus:outline-none shadow-xs font-heading"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}: {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {courses.length === 0 ? (
        <div className="caplen-card p-12 text-center my-8">
          <p className="text-sm text-caplen-muted">Please import at least one course syllabus to use the Grade Calculator.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Gauge & Target Simulator */}
          <div className="caplen-card p-6 flex flex-col justify-between">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-caplen-muted block mb-4 text-center">
                Current Standing
              </span>

              {/* Gauge */}
              <div className="relative flex items-center justify-center my-4">
                <svg className="w-40 h-40 transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r={circleRadius}
                    stroke="#E2E8F0"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r={circleRadius}
                    stroke={currentGradeInfo.stroke}
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className={`font-heading text-4xl font-extrabold ${currentGradeInfo.color}`}>
                    {currentGradeInfo.grade}
                  </span>
                  <span className="font-mono text-xs font-bold text-caplen-navy mt-0.5 number-display">
                    {hasAnyGrade ? `${currentPercentage.toFixed(1)}%` : 'No grades yet'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-caplen-muted text-center mb-6">
                Based on <strong className="text-caplen-navy number-display">{totalGradedWeight}%</strong> evaluated course weight
              </p>

              {/* Simulator */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-caplen-navy flex items-center gap-1.5 font-heading">
                    <Target className="h-4 w-4 text-vibrant-purpleText" />
                    <span>Target Desired Grade</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-caplen-navy bg-vibrant-purple px-2.5 py-0.5 rounded-full border border-vibrant-purpleBorder number-display">
                    {targetGrade}% ({getLetterGrade(targetGrade).grade})
                  </span>
                </div>

                <input
                  type="range"
                  min="60"
                  max="100"
                  value={targetGrade}
                  onChange={(e) => setTargetGrade(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-caplen-navy"
                />

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <div className="flex items-start gap-2.5">
                    <TrendingUp className="h-5 w-5 text-caplen-navy shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-xs font-extrabold text-caplen-navy font-heading">Target Requirement</h5>
                      {remainingWeight <= 0 ? (
                        <p className="text-xs text-caplen-muted mt-1">
                          All course assignments have been graded!
                        </p>
                      ) : neededScoreOnRemaining > 100 ? (
                        <p className="text-xs text-rose-600 mt-1">
                          Requires <strong className="font-mono number-display">{neededScoreOnRemaining.toFixed(1)}%</strong> on remaining {remainingWeight}% weight.
                        </p>
                      ) : neededScoreOnRemaining < 0 ? (
                        <p className="text-xs text-emerald-600 mt-1">
                          Target grade already secured! 🎉
                        </p>
                      ) : (
                        <p className="text-xs text-slate-700 mt-1">
                          You need an average of{' '}
                          <strong className="font-mono text-emerald-700 font-extrabold text-sm number-display">
                            {neededScoreOnRemaining.toFixed(1)}%
                          </strong>{' '}
                          on your remaining <strong className="number-display">{remainingWeight}%</strong> weight to hit {targetGrade}%!
                        </p>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Assignment Inputs */}
          <div className="lg:col-span-2 caplen-card p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-heading text-base font-extrabold text-caplen-navy flex items-center gap-2">
                <span>Course Breakdown — {selectedCourse?.name}</span>
              </h3>
              <span className="text-xs font-mono font-bold text-caplen-muted number-display">
                {courseAssignments.length} Assignments
              </span>
            </div>
            <p className={`text-[11px] font-bold mb-4 number-display ${
              weightSum === 100 ? 'text-emerald-600' : 'text-amber-600'
            }`}>
              Weight allocated: {weightSum}%
              {weightSum !== 100 && ' — adjust the weights below so they sum to 100% for an accurate grade'}
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-mono font-bold">
                  <tr>
                    <th className="py-3 px-3.5 rounded-l-xl">Assignment</th>
                    <th className="py-3 px-3.5">Type</th>
                    <th className="py-3 px-3.5">Weight %</th>
                    <th className="py-3 px-3.5 rounded-r-xl">Earned Score %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-caplen-navy">
                  {courseAssignments.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="py-3.5 px-3.5 font-bold">
                        {item.title}
                      </td>
                      <td className="py-3.5 px-3.5">
                        <span className="capitalize text-[10px] font-mono font-bold bg-vibrant-purple text-vibrant-purpleText border border-vibrant-purpleBorder px-2 py-0.5 rounded-full">
                          {item.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-3.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="Weight"
                            value={item.weightPercent !== undefined && item.weightPercent !== null ? item.weightPercent : ''}
                            onChange={(e) =>
                              onUpdateWeight(
                                item.id,
                                e.target.value !== '' ? parseFloat(e.target.value) : null
                              )
                            }
                            className="w-20 rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-mono font-bold text-caplen-navy placeholder-slate-400 focus:outline-none focus:bg-white number-display"
                          />
                          <span className="text-slate-400 font-mono text-xs">%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="Enter %"
                            value={item.score !== undefined && item.score !== null ? item.score : ''}
                            onChange={(e) =>
                              onUpdateScore(
                                item.id,
                                e.target.value !== '' ? parseFloat(e.target.value) : null
                              )
                            }
                            className="w-24 rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-mono text-caplen-navy placeholder-slate-400 focus:outline-none focus:bg-white number-display"
                          />
                          <span className="text-slate-400 font-mono text-xs">%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}
    </div>
  );
};
