import React, { useState, useEffect } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { CheckCircle, AlertCircle } from "lucide-react";
import { Control, FieldPath, FieldValues } from "react-hook-form";

interface EnhancedFormFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
> {
  control: Control<TFieldValues>;
  name: TName;
  label: string;
  description?: string;
  placeholder?: string;
  type?: "text" | "email" | "password" | "number" | "textarea" | "select" | "checkbox" | "switch" | "radio" | "date";
  options?: { label: string; value: string }[];
  required?: boolean;
  showSuccessState?: boolean;
  validateOnBlur?: boolean;
  validateOnChange?: boolean;
  className?: string;
  min?: number;
  max?: number;
  rows?: number;
}

export function EnhancedFormField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>
>({
  control,
  name,
  label,
  description,
  placeholder,
  type = "text",
  options = [],
  required = false,
  showSuccessState = true,
  validateOnBlur = true,
  validateOnChange = false,
  className = "",
  min,
  max,
  rows = 4,
  ...props
}: EnhancedFormFieldProps<TFieldValues, TName>) {
  const [isTouched, setIsTouched] = useState(false);
  const [isValid, setIsValid] = useState(false);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        // Handle validation and success states
        const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          field.onBlur();
          if (validateOnBlur) {
            setIsTouched(true);
          }
        };

        const handleChange = (
          value: any,
          e?: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
        ) => {
          field.onChange(value);
          if (validateOnChange) {
            setIsTouched(true);
          }
        };

        // Update isValid state when fieldState.error changes
        useEffect(() => {
          if (isTouched) {
            setIsValid(!fieldState.error);
          }
        }, [fieldState.error, isTouched]);

        const showError = isTouched && fieldState.error;
        const showSuccess = isTouched && !fieldState.error && showSuccessState;

        // Common class for input fields
        const inputClass = `
          ${fieldState.error ? "form-field-error" : ""}
          ${showSuccess ? "form-field-success" : ""}
          field-focus-animation
        `;

        return (
          <FormItem className={className}>
            <div className="flex items-center gap-1.5">
              <FormLabel className={required ? "after:content-['*'] after:text-destructive after:ml-0.5" : ""}>
                {label}
              </FormLabel>
              
              {showSuccess && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              
              {showError && (
                <AlertCircle className="h-4 w-4 text-destructive animate-pulse" />
              )}
            </div>
            
            <FormControl>
              {type === "text" || type === "email" || type === "password" || type === "number" ? (
                <Input
                  {...field}
                  type={type}
                  placeholder={placeholder}
                  className={inputClass}
                  onBlur={handleBlur}
                  onChange={(e) => handleChange(e.target.value, e)}
                  min={min}
                  max={max}
                  {...props}
                />
              ) : type === "date" ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={`w-full justify-start text-left font-normal ${inputClass}`}
                      type="button"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? (
                        format(field.value, "PPP")
                      ) : (
                        <span className="text-muted-foreground">{placeholder || "Select a date"}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(date) => {
                        handleChange(date);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              ) : type === "textarea" ? (
                <Textarea
                  {...field}
                  placeholder={placeholder}
                  className={inputClass}
                  onBlur={handleBlur}
                  onChange={(e) => handleChange(e.target.value, e)}
                  rows={rows}
                  {...props}
                />
              ) : type === "select" ? (
                <Select
                  onValueChange={(value) => handleChange(value)}
                  defaultValue={field.value?.toString()}
                  {...props}
                >
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder={placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : type === "checkbox" ? (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      handleChange(checked);
                    }}
                    {...props}
                  />
                  <span className="text-sm text-muted-foreground">{placeholder}</span>
                </div>
              ) : type === "switch" ? (
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      handleChange(checked);
                    }}
                    {...props}
                  />
                  <span className="text-sm text-muted-foreground">{placeholder}</span>
                </div>
              ) : type === "radio" ? (
                <RadioGroup
                  onValueChange={(value) => handleChange(value)}
                  defaultValue={field.value}
                  className="flex flex-col space-y-1"
                  {...props}
                >
                  {options.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={option.value} />
                      <label htmlFor={option.value} className="text-sm text-muted-foreground">
                        {option.label}
                      </label>
                    </div>
                  ))}
                </RadioGroup>
              ) : null}
            </FormControl>
            
            {description && <FormDescription>{description}</FormDescription>}
            
            <FormMessage className={showError ? "error-shake" : ""} />
          </FormItem>
        );
      }}
    />
  );
}