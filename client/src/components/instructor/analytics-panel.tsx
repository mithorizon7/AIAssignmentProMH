import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AnalyticsData } from "@/lib/types";
import { formatPercentage } from "@/lib/utils/format";

interface AnalyticsPanelProps {
  data: AnalyticsData;
  loading?: boolean;
}

export function AnalyticsPanel({ data, loading = false }: AnalyticsPanelProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assignment Analytics</CardTitle>
          <CardDescription>Loading analytics...</CardDescription>
        </CardHeader>
        <CardContent className="h-60 flex items-center justify-center">
          <div className="animate-spin">
            <span className="material-icons text-4xl text-primary">refresh</span>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Assignment Analytics</CardTitle>
        <CardDescription>Performance metrics and insights</CardDescription>
      </CardHeader>
      
      <CardContent>
        {/* Submission Progress */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-neutral-800 mb-3">Submission Progress</h3>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-neutral-700">
              {data.assignmentStats.submittedCount}/{data.assignmentStats.totalCount} Students
            </span>
            <span className="text-sm text-neutral-600">
              {formatPercentage(data.assignmentStats.submissionPercentage)}
            </span>
          </div>
          <Progress value={data.assignmentStats.submissionPercentage} className="h-2.5" />
          
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center p-2 bg-blue-50 rounded-lg">
              <div className="text-sm font-medium text-neutral-700">Submitted</div>
              <div className="text-xl font-bold text-primary">{data.assignmentStats.submittedCount}</div>
            </div>
            <div className="text-center p-2 bg-amber-50 rounded-lg">
              <div className="text-sm font-medium text-neutral-700">In Progress</div>
              <div className="text-xl font-bold text-amber-600">{data.assignmentStats.inProgressCount}</div>
            </div>
            <div className="text-center p-2 bg-red-50 rounded-lg">
              <div className="text-sm font-medium text-neutral-700">Not Started</div>
              <div className="text-xl font-bold text-red-600">{data.assignmentStats.notStartedCount}</div>
            </div>
          </div>
        </div>
        
        {/* Submission Timeline */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-neutral-800 mb-3">Submissions Over Time</h3>
          <div className="h-48 bg-neutral-50 rounded-lg flex items-end justify-between p-4 border border-neutral-200">
            {data.submissionTimeline.map((item, index) => {
              const maxCount = Math.max(...data.submissionTimeline.map(t => t.count));
              const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
              const date = new Date(item.date);
              const day = date.getDate();
              const month = date.getMonth() + 1;
              
              return (
                <div key={index} className="flex flex-col items-center">
                  <div 
                    className={`w-8 ${
                      index === data.submissionTimeline.length - 1 && height < 30
                        ? 'bg-primary-light opacity-50'
                        : 'bg-primary'
                    } rounded-t-sm`} 
                    style={{ height: `${height}%` }}
                  ></div>
                  <div className={`text-xs mt-1 ${
                    index === data.submissionTimeline.length - 1 ? 'font-medium' : ''
                  }`}>
                    {month}/{day}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* AI Feedback Stats */}
        <div>
          <h3 className="text-lg font-medium text-neutral-800 mb-3">AI Feedback Metrics</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-neutral-700">Avg. Feedback Generation Time</span>
                <span className="text-sm font-medium text-green-600">
                  {data.avgFeedbackTime}s
                </span>
              </div>
              <Progress 
                value={Math.min(100, (60 - data.avgFeedbackTime) / 60 * 100)} 
                className="h-1.5 bg-neutral-200"
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-neutral-700">Avg. Revisions Per Student</span>
                <span className="text-sm font-medium text-neutral-600">
                  {data.avgRevisionsPerStudent.toFixed(1)}
                </span>
              </div>
              <Progress 
                value={Math.min(100, data.avgRevisionsPerStudent / 5 * 100)} 
                className="h-1.5 bg-neutral-200"
              />
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-neutral-700">Improvement After Feedback</span>
                <span className="text-sm font-medium text-green-600">
                  +{data.avgImprovementPercentage}%
                </span>
              </div>
              <Progress 
                value={Math.min(100, data.avgImprovementPercentage)} 
                className="h-1.5 bg-neutral-200"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
