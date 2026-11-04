import type { ProgressVM } from "@/lib/types";

type Point = { date: string; name: string; score: string; percent: number };

// One line of marks, oldest to newest, on a fixed 0 to 100% scale so a small change never looks dramatic.
// Server-rendered with no chart library: parent routes have a script budget. Hover or tap a point for its test; the list above is the table view.
export function MarksChart({ tests, label, formatDate }: { tests: ProgressVM["tests"]; label: string; formatDate: (date: string) => string }) {
  const points: Point[] = [...tests].reverse().map((test) => ({ date: formatDate(test.testDate), name: test.testName, score: `${test.score}/${test.maxScore}`, percent: Math.round(test.score / test.maxScore * 100) }));
  const x = (index: number) => 6 + index / (points.length - 1) * 88;
  return <div role="group" aria-label={label} className="marks-chart">
    {[100, 50, 0].map((tick) => <span key={tick} aria-hidden className="marks-tick" style={{ top: `${100 - tick}%` }}>{tick}%</span>)}
    <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="marks-line"><polyline points={points.map((point, index) => `${x(index)},${100 - point.percent}`).join(" ")} /></svg>
    {points.map((point, index) => <span key={`${point.date}-${point.name}`} tabIndex={0} role="img" aria-label={`${point.name}, ${point.date}, ${point.score}`} className="marks-point" data-edge={index === 0 ? "start" : index === points.length - 1 ? "end" : undefined} style={{ left: `${x(index)}%`, top: `${100 - point.percent}%` }}>
      {index === 0 || index === points.length - 1 ? <span aria-hidden className="marks-value">{point.percent}%</span> : null}
      <span aria-hidden className="marks-tip"><bdi>{point.name}</bdi> · {point.date} · <bdi>{point.score}</bdi></span>
    </span>)}
    {points.map((point, index) => <span key={`${point.date}-${point.name}-axis`} aria-hidden className="marks-date" data-middle={index > 0 && index < points.length - 1 ? true : undefined} style={{ left: `${x(index)}%` }}>{point.date}</span>)}
  </div>;
}
