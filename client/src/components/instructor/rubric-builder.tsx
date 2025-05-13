import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as SharedEnums from '@shared/enums';
import { v4 as uuidv4 } from 'uuid';
import { RubricCriterion, Rubric } from '@shared/schema';
import { QuillEditor } from "@/components/quill-editor";
import { QuillContent } from "@/components/quill-content";

interface RubricBuilderProps {
  value: Rubric;
  onChange: (rubric: Rubric) => void;
}

export function RubricBuilder({ value, onChange }: RubricBuilderProps) {
  const [newCriterionName, setNewCriterionName] = useState('');
  const [newCriterionType, setNewCriterionType] = useState(SharedEnums.RUBRIC_CRITERIA_TYPE.CODE_QUALITY);
  const [newCriterionDescription, setNewCriterionDescription] = useState('');
  const [newCriterionMaxScore, setNewCriterionMaxScore] = useState(10);
  const [newCriterionWeight, setNewCriterionWeight] = useState(1);
  
  const handleAddCriterion = () => {
    if (!newCriterionName.trim()) return;
    
    const newCriterion: RubricCriterion = {
      id: uuidv4(),
      type: newCriterionType,
      name: newCriterionName,
      description: newCriterionDescription,
      maxScore: newCriterionMaxScore,
      weight: newCriterionWeight
    };
    
    onChange({
      ...value,
      criteria: [...value.criteria, newCriterion]
    });
    
    // Reset form
    setNewCriterionName('');
    setNewCriterionDescription('');
    setNewCriterionMaxScore(10);
    setNewCriterionWeight(1);
  };
  
  const handleRemoveCriterion = (id: string) => {
    onChange({
      ...value,
      criteria: value.criteria.filter(c => c.id !== id)
    });
  };
  
  const handleUpdatePassingThreshold = (threshold: number) => {
    onChange({
      ...value,
      passingThreshold: threshold
    });
  };
  
  const getTotalPoints = () => {
    return value.criteria.reduce((sum, criterion) => sum + criterion.maxScore * criterion.weight, 0);
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Assignment Rubric</CardTitle>
          <CardDescription>
            Define criteria for AI evaluation and feedback
          </CardDescription>
        </CardHeader>
        <CardContent>
          {value.criteria.length > 0 ? (
            <div className="space-y-4">
              {value.criteria.map((criterion) => (
                <div key={criterion.id} className="flex items-start p-3 border rounded-md relative group hover:border-primary/50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{criterion.name}</span>
                      <span className="bg-primary/10 text-primary rounded-md text-xs px-2 py-0.5">
                        {criterion.type}
                      </span>
                    </div>
                    <QuillContent 
                      content={criterion.description} 
                      className="text-sm text-muted-foreground mb-1" 
                    />
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>Max Score: {criterion.maxScore}</span>
                      <span>Weight: {criterion.weight}x</span>
                      <span>Total: {criterion.maxScore * criterion.weight} points</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2"
                    onClick={() => handleRemoveCriterion(criterion.id)}
                  >
                    <span className="material-icons-outlined text-sm">delete</span>
                  </Button>
                </div>
              ))}
              
              <div className="flex justify-between p-3 border rounded-md bg-secondary/10">
                <span className="font-medium">Total Points</span>
                <span>{getTotalPoints()} points</span>
              </div>
              
              <div className="flex items-center gap-4 p-3 border rounded-md">
                <Label htmlFor="passingThreshold" className="whitespace-nowrap">
                  Passing Threshold (%)
                </Label>
                <div className="flex-1">
                  <Input
                    id="passingThreshold"
                    type="number"
                    min={0}
                    max={100}
                    value={value.passingThreshold || 60}
                    onChange={(e) => handleUpdatePassingThreshold(parseInt(e.target.value))}
                    className="w-20"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 border border-dashed rounded-md">
              <p className="text-muted-foreground">No criteria defined yet</p>
              <p className="text-xs text-muted-foreground">Add criteria below to build your rubric</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add Criterion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="criterionName">Criterion Name</Label>
                <Input
                  id="criterionName"
                  value={newCriterionName}
                  onChange={(e) => setNewCriterionName(e.target.value)}
                  placeholder="e.g., Code Organization"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="criterionType">Type</Label>
                <Select 
                  value={newCriterionType}
                  onValueChange={setNewCriterionType}
                >
                  <SelectTrigger id="criterionType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SharedEnums.RUBRIC_CRITERIA_TYPE).map(([key, value]) => (
                      <SelectItem key={value} value={value}>
                        {key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="criterionDescription">Description</Label>
              <QuillEditor
                value={newCriterionDescription}
                onChange={setNewCriterionDescription}
                placeholder="Describe what this criterion evaluates"
                className="min-h-[150px]"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxScore">Max Score</Label>
                <Input
                  id="maxScore"
                  type="number"
                  min={1}
                  value={newCriterionMaxScore}
                  onChange={(e) => setNewCriterionMaxScore(parseInt(e.target.value))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="weight">Weight</Label>
                <Input
                  id="weight"
                  type="number"
                  min={1}
                  value={newCriterionWeight}
                  onChange={(e) => setNewCriterionWeight(parseInt(e.target.value))}
                />
              </div>
            </div>
            
            <Button 
              onClick={handleAddCriterion}
              disabled={!newCriterionName.trim()}
              className="w-full md:w-auto md:ml-auto"
            >
              <span className="material-icons-outlined text-sm mr-1">add</span>
              Add Criterion
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}