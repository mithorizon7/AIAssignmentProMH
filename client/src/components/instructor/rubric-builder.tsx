import React, { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PlusCircle, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Rubric, RubricCriterion } from "@shared/schema";

export interface RubricBuilderProps {
  rubric: Rubric;
  setRubric: Dispatch<SetStateAction<Rubric>>;
}

export function RubricBuilder({ rubric, setRubric }: RubricBuilderProps) {
  const handleAddCriterion = () => {
    setRubric((prev) => ({
      ...prev,
      criteria: [
        ...prev.criteria,
        {
          id: Date.now().toString(),
          name: "",
          description: "",
          weight: 10,
          type: "code_quality",
          maxScore: 100
        },
      ],
    }));
  };

  const handleRemoveCriterion = (id: string) => {
    setRubric((prev) => ({
      ...prev,
      criteria: prev.criteria.filter((c) => c.id !== id),
    }));
  };

  const handleCriterionChange = (id: string, field: keyof RubricCriterion, value: any) => {
    setRubric((prev) => ({
      ...prev,
      criteria: prev.criteria.map((c) =>
        c.id === id ? { ...c, [field]: field === "weight" ? Number(value) : value } : c
      ),
    }));
  };

  const handlePassingThresholdChange = (value: string) => {
    const threshold = parseInt(value, 10);
    if (!isNaN(threshold) && threshold >= 0 && threshold <= 100) {
      setRubric((prev) => ({
        ...prev,
        passingThreshold: threshold,
      }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-medium">Passing Threshold</h3>
          <div className="flex items-center mt-1 space-x-2">
            <Input
              type="number"
              min={0}
              max={100}
              value={rubric.passingThreshold}
              onChange={(e) => handlePassingThresholdChange(e.target.value)}
              className="w-20 field-focus-animation"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>
        <Button
          type="button"
          onClick={handleAddCriterion}
          variant="outline"
          className="press-effect"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Criterion
        </Button>
      </div>

      {rubric.criteria.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <p className="text-muted-foreground">
            No criteria defined yet. Add your first criterion to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rubric.criteria.map((criterion, index) => (
            <Card key={criterion.id} className="overflow-hidden scale-in" style={{animationDelay: `${index * 50}ms`}}>
              <CardContent className="p-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor={`criterion-${criterion.id}-name`} className="text-sm font-medium mb-1 block">
                      Criterion Name
                    </label>
                    <Input
                      id={`criterion-${criterion.id}-name`}
                      value={criterion.name}
                      onChange={(e) => handleCriterionChange(criterion.id, "name", e.target.value)}
                      placeholder="e.g., Code Structure"
                      className="field-focus-animation"
                    />
                  </div>
                  <div>
                    <label htmlFor={`criterion-${criterion.id}-maxScore`} className="text-sm font-medium mb-1 block">
                      Max Score
                    </label>
                    <Input
                      id={`criterion-${criterion.id}-maxScore`}
                      type="number"
                      min={1}
                      max={1000}
                      value={criterion.maxScore}
                      onChange={(e) => handleCriterionChange(criterion.id, "maxScore", e.target.value)}
                      className="field-focus-animation"
                    />
                  </div>
                  <div>
                    <label htmlFor={`criterion-${criterion.id}-weight`} className="text-sm font-medium mb-1 block">
                      Weight (%)
                    </label>
                    <Input
                      id={`criterion-${criterion.id}-weight`}
                      type="number"
                      min={0}
                      max={100}
                      value={criterion.weight}
                      onChange={(e) => handleCriterionChange(criterion.id, "weight", e.target.value)}
                      className="field-focus-animation"
                    />
                  </div>
                </div>
                
                <div className="mt-3">
                  <label htmlFor={`criterion-${criterion.id}-description`} className="text-sm font-medium mb-1 block">
                    Description
                  </label>
                  <Textarea
                    id={`criterion-${criterion.id}-description`}
                    value={criterion.description}
                    onChange={(e) => handleCriterionChange(criterion.id, "description", e.target.value)}
                    placeholder="Describe what this criterion evaluates and how it should be assessed"
                    rows={3}
                    className="field-focus-animation"
                  />
                </div>
                
                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 press-effect"
                    onClick={() => handleRemoveCriterion(criterion.id)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}